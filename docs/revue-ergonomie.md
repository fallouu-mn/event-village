# Revue d'ergonomie — module événements

> Revue faite le 13/11/2026 sur `main` à `0cf8eb8` (code identique à `0889df6`, lots 1 à 9 ter ; seuls des fichiers
> `docs/` ont changé depuis). **Aucun code de l'application n'a changé.** Elle juge l'application **en utilisateur** :
> nombre d'étapes, mots compris ou non, information absente au moment où elle sert, impasses, messages qui ne disent
> pas quoi faire, écrans qui font la même chose différemment, ce qui est caché, ce qui est illisible sur téléphone.
> Chaque constat cite l'écran (adresse), la capture ou le `fichier:ligne`, et le constat `G-xx` du guide
> (`docs/guide/15-constats.md`) quand il existe. `M/` = `supabase/migrations/`.

## Sommaire

0. [Méthode et limites](#0-méthode-et-limites)
1. [À lire en premier : les 15 problèmes qui gênent le plus](#1-à-lire-en-premier--les-15-problèmes-qui-gênent-le-plus)
2. [Par personne](#2-par-personne) — P1 Superadmin, P2 ADMIN, P3 partenaire, P4 acheteur, P5 contrôleur
3. [Page « Équipe »](#3-page--équipe-)
4. [Création d'un événement](#4-création-dun-événement)
5. [Administration](#5-administration)
6. [Décisions D1, D2, D3, U2, U4, A2 prêtes à coder](#6-décisions-d1-d2-d3-u2-u4-a2-prêtes-à-coder)
7. [Messages](#7-messages)
8. [Cohérence](#8-cohérence)
9. [Liste consolidée des changements E-01 à E-86](#9-liste-consolidée-des-changements-e-01-à-e-86)
10. [À ne pas changer](#10-à-ne-pas-changer)
11. [Points à arbitrer](#11-points-à-arbitrer)
12. [Captures](#12-captures)

---

## 0. Méthode et limites

**Sources.** Le guide `docs/guide/*` (216 scénarios, 103 types de messages, 97 constats), `docs/glossaire.md`, le
code de `main`, et les captures de la CI.

**Écart avec la consigne, à connaître.**
- **L'application n'a pas été lancée en local.** Docker est toujours absent de ce poste : `supabase start` est
  impossible, donc pas de Supabase local ni de `seed:dev`, et aucun parcours Playwright en direct. Aucune base,
  locale ou distante, n'a été lue ; `.env.local` et `.private/` n'ont pas été ouverts.
- **Les captures viennent du run 136, pas du run 134.** Le dernier run vert de `origin/ci-results` est le 136
  (`runs/136-43301091495`, 12/11 à 21:36), qui porte exactement le code de main (`0889df6`) ; le 134 porte un commit
  antérieur (`6796ecf`). Ce run donne 441 captures de 134 écrans, Playwright à 390×844 (DPR 2) et 1440×900, en clair et
  en sombre (le scanner et la caisse n'existent qu'en sombre : thème forcé par `app/controller/layout.tsx`).
- **Une capture ne montre que la partie visible de l'écran**, pas la page entière : ce qui est plus bas a été jugé sur
  le code. Pas de capture de l'accueil de l'administration, de `/admin/finance` en haut de page, des Réglages de la
  plateforme, de `/admin/users`, du journal d'audit ni du parrainage de l'administration : ces écrans sont jugés sur le
  code seul, et c'est dit à chaque fois.

**Comment.** Cinq analyses en parallèle (équipe ; création d'un événement ; administration ; messages ; parcours de
l'acheteur, du contrôleur et de la partenaire, avec la cohérence), puis relecture croisée. Les constats nouveaux les
plus graves ont été revérifiés dans le code avant d'entrer dans ce rapport (N-01, N-02, N-03, N-05, N-07, solde
SamirPay jamais lu par l'administration). Les SMS proposés ont été mesurés avec la fonction `smsSegments` du dépôt
(`lib/notifications/sms-format.ts:74-85`), avec l'adresse fictive `https://app.eventvillage.sn` (27 caractères) : tous
tiennent en un segment GSM-7 au pire cas.

**Constats nouveaux** (absents du guide), numérotés N-xx :

| Id | Constat | Preuve |
|---|---|---|
| N-01 | Un admin qui fait « Retirer de tous vos événements » sur `/partner/team` retire le contrôleur des événements de **tous** les organisateurs (avis et SMS de retrait compris) : la route ne résout aucune partenaire pour un admin et ne filtre pas. | `app/api/partner/team/all/route.ts:333-357` ; fenêtre `app/partner/team/page.tsx:649` |
| N-02 | Finances de la partenaire : un retrait « Retardé », « En attente » ou « En cours d'envoi » affiche « Versé : 5 940 F CFA · frais : 60 F CFA ». | `app/partner/finance/page.tsx:930-931` ; capture `partenaire-finances-retrait-retarde` |
| N-03 | Fiche d'un événement sur téléphone : ni prix ni bouton d'achat au premier écran ; la billetterie est rendue après le programme et la carte, la barre d'achat n'apparaît qu'avec un billet au panier. | `app/events/[id]/page.tsx:817`, `:1011` ; captures `evenement-publie`, `fiche-barre-achat` |
| N-04 | `/admin/finance` ne dit ni ce qui est dû aux partenaires, ni ce qu'Event Village peut retirer ; aucun écran de l'administration ne lit le solde SamirPay (seul `lib/payments/cashout.service.ts:290`, `:399` l'appelle). | `app/admin/finance/page.tsx:159-312` |
| N-05 | L'accueil de l'administration ne montre pas les versements bloqués : « À traiter » n'a que « Événements à valider » et « Partenaires à valider » ; « Versements à reprendre » est sous 13 blocs de `/admin/finance`, et les alertes y mènent sans ancre. | `app/admin/dashboard/page.tsx:516-534` ; `app/admin/finance/page.tsx:312` ; `lib/notifications/catalog.ts:1206`, `:1221`, `:1227`, `:1233` |
| N-06 | Un brouillon déjà soumis (refusé ou retiré de la validation) ne peut être ni supprimé ni annulé : il reste à vie dans l'onglet « Brouillon ». | `M/20261103000001_lot6_dette.sql:214-220` ; guide 04.0, 04.6 |
| N-07 | Fenêtre des droits d'un ADMIN : elle s'ouvre avant la lecture et garde les cases de l'ADMIN ouvert juste avant ; si la lecture échoue, « Enregistrer les permissions » donnerait au second les droits du premier. | `app/admin/users/page.tsx:243-256` |
| N-08 | « Suspendre l'événement » annonce « les détenteurs de billets sont prévenus », alors que leur avis est optionnel (sujet « actualités des événements ») et sans SMS. | `app/admin/events/[id]/page.tsx:200-201` ; `M/20261109000009_lot9bis_messages.sql:171-196` |
| N-09 | Un client dont la partenaire ou l'administration rembourse le billet payé en ligne ne reçoit ni SMS ni push : `REFUND_REQUESTED` part en cloche et email seulement, avec le titre « Remboursement demandé » alors qu'il n'a rien demandé. | `lib/notifications/catalog.ts:852-857` |
| N-10 | Le numéro du billet n'est que dans l'email d'achat : un client sans adresse vérifiée n'a aucun moyen de le donner à l'entrée manuelle que promettent `ACCOUNT_SUSPENDED` et l'aide du scanner. | `lib/notifications/catalog.ts:648-668` |
| N-11 | « Renvoyer l'invitation par SMS » depuis l'onglet Équipe envoie le SMS **sans le prénom** (le serveur met « Contrôleur ») ; aux deux endroits le toast dit « Droits mis à jour sur l'événement. » pour un simple renvoi. | `components/partner/pilotage/TeamTab.tsx:205-210` ; `app/api/partner/team/invite/route.ts:61`, `:522`, `:543-551` |
| N-12 | Une carte du catalogue peut afficher en même temps le badge « Complet » (en ligne) et, en bas, « Vente sur place uniquement » (guichet) : l'acheteur ne sait pas s'il peut encore venir. | `components/events/EventCard.tsx:114` ; `lib/events/catalog.server.ts:126`, `:137-139` |
| N-13 | La dernière catégorie vendue déclenche à la fois `CATEGORY_SOLD_OUT` et `EVENT_SOLD_OUT` : deux SMS à la partenaire pour la même nouvelle. | guide `10-notifications.md:1422` |
| N-14 | L'alerte « Créance sur un compte » (`ADMIN_FINANCE_DEBT`) ne dit pas quel compte et mène à `/admin/finance`, qui ne parle jamais de créance (aucune lecture de `finance_debts` dans `app/admin` ni `app/api/admin`). | `lib/notifications/catalog.ts:1240-1245` |

**Conventions.** Effort : **S** moins d'un jour, **M** un à trois jours, **L** plus de trois jours. Priorité : **P1**
avant la mise en ligne (fait échouer, bloque ou trompe un utilisateur réel au lancement), **P2** juste après, **P3**
plus tard. Les changements sont numérotés **E-01 à E-86** (section 9) ; les tableaux par personne y renvoient.
Vocabulaire : celui du glossaire (« partenaire » pour le compte, « organisateur » dans les textes lus par le public,
« F CFA », « catégorie », « contrôleur », « Superadmin »).

---

## 1. À lire en premier : les 15 problèmes qui gênent le plus

Classés par gêne réelle au lancement (argent et entrée d'abord), puis par nombre de personnes touchées.

| # | Problème, en une phrase | Qui | Changement | Prio |
|---|---|---|---|---|
| 1 | Le Superadmin ne peut pas savoir combien Event Village peut retirer de SamirPay : ni solde, ni « dû aux partenaires », et « Reversements partenaires » n'est pas net des remboursements ; s'il vide le compte d'après cet écran, les versements suivants se bloquent (N-04, G-25). | P1 | E-06 | P1 |
| 2 | Un événement saisi sans date de fin se termine 6 h après son début sans que personne le sache : un festival de 10:00 à 23:00 arrête sa vente à 16:00 et refuse les retardataires à 22:00, et la fiche de l'administration affiche « Non précisée (fin de journée) » (G-10). | P3, P1 | E-01 | P1 |
| 3 | Sur téléphone, la fiche d'un événement n'a ni prix ni bouton d'achat au premier écran : la billetterie est sous le programme et la carte (N-03). | P4 | E-02 | P1 |
| 4 | Un retrait retardé ou pas encore envoyé s'affiche « Versé : 5 940 F CFA » dans les Finances de la partenaire (N-02). | P3 | E-03 | P1 |
| 5 | Le message de suspension d'un client lui dit de présenter « le billet hors ligne déjà enregistré », que la déconnexion vient d'effacer ; et le numéro du billet n'est que dans l'email (G-05, N-10). | P4 | E-04 | P1 |
| 6 | Les alertes de plafond SMS disent « les envois sont suspendus » alors que ce sont les **codes de connexion** qui s'arrêtent et que les SMS d'achat continuent : le Superadmin ne comprend pas pourquoi plus personne ne se connecte par code (G-13). | P1 | E-05 | P1 |
| 7 | Les versements bloqués (de l'argent que des clients et des partenaires attendent) ne sont pas sur l'accueil de l'administration ; ils sont sous 13 blocs de la page Finance, et les alertes y mènent sans ancre (N-05). | P1, P2 | E-07 | P1 |
| 8 | Un clic du Superadmin dans les Réglages ouvre au public des services pas prêts (salles, tables, commandes), dont l'entrée de menu vise un restaurant écrit en dur (G-44). | P1 | E-08 | P1 |
| 9 | La fenêtre des droits d'un ADMIN peut afficher, puis enregistrer, les droits de l'ADMIN ouvert juste avant (N-07). | P1 | E-12 | P1 |
| 10 | Un admin qui « retire de tous vos événements » un contrôleur le retire chez tous les organisateurs, SMS compris (N-01, G-69). | P2, P3 | E-09 | P1 |
| 11 | Dans l'onglet Équipe du pilotage, les invitations envoyées n'apparaissent jamais et « Renvoyer l'invitation par SMS » est proposé à tous : la partenaire recommence, use le quota du numéro et se fait refuser (G-21, G-22, N-11). | P3 | E-10, E-11 | P1 |
| 12 | La page Équipe ne montre ni la porte, ni la caisse ouverte, ni les entrées, ni la dernière activité de chaque contrôleur, et l'onglet Équipe du pilotage fait la même chose autrement (section 3). | P3 | E-13 à E-21 | P2 |
| 13 | Un grand concert avec carré VIP demande trois visites (création, puis modification pour les couleurs et la consigne, puis pilotage après validation pour les zones) et environ 38 touches, contre 23 en une visite avec le formulaire en 5 étapes (A1, U1, U3). | P3 | E-22 à E-24 | P2 |
| 14 | Plusieurs confirmations de l'administration disent faux ou taisent qui est prévenu : réactivation « prévenu avec votre motif » (motif jamais envoyé), « Constater non versé » qui fait partir « refusé par l'opérateur », clôture titrée « Terminer » qui rouvre le contrôle sans le dire, suspension « détenteurs prévenus » (G-06, G-28, G-61, G-20, N-08). | P1, P2 | E-32, E-33 | P2 |
| 15 | Un ADMIN ne voit pas ce qu'il peut faire : menu complet quelles que soient ses permissions, « Vérifiez votre connexion » sur un refus de droit, boutons qui disparaissent sans phrase, codes bruts (`REFUND_PENDING`, `CLIENT`, journal d'audit, « Valeur refusée pour finance.service_fee_rate : 60 ») (G-37, G-38, G-40). | P2, P1 | E-31, E-34, E-37 | P2 |

Juste après ces quinze : les liens de messages qui mènent à un onglet vide (G-80, E-42), la partenaire jamais
prévenue qu'un contrôleur accepte ou refuse (G-65, E-20), le refus « Transfert en cours » sans consigne au scanner
(G-73, E-60), et le bandeau du paiement en attente qui disparaît avant que le serveur accepte un nouvel achat (G-23,
E-55).

**Bilan des priorités** : 12 changements P1 (11 S, 1 M : environ 2 semaines), 54 P2, 20 P3.

---

## 2. Par personne

### 2.1 P1 — Le Superadmin (le client, non développeur, surtout sur téléphone)

| Tâche | Aujourd'hui (étapes, écrans) | Ce qui gêne | Proposition | Effort | Prio |
|---|---|---|---|---|---|
| Savoir chaque matin ce qui l'attend | Barre du bas « Accueil » → `/admin/dashboard` (pas de capture) : « À traiter » (2 cartes), « Indicateurs », « Candidatures des partenaires », « Raccourcis » (`app/admin/dashboard/page.tsx:515-656`). Versements : « Finance », puis défiler ; envois en échec : « Notifications » ; créances : nulle part. | Versements bloqués absents (N-05) ; créances sans écran (N-14) ; événements suspendus à clore signalés nulle part ; cloche noyée (58 non lus sur `admin-remboursements-a-reprendre`). | Ligne « Versements à reprendre » en tête de l'accueil (E-07), puis page « À faire aujourd'hui » complète (section 5.1, E-29). | S puis M | P1 puis P2 |
| Valider une candidature | Accueil → onglet « En attente » → « Dossier » → « Ouvrir » chaque pièce → « Valider la candidature » → confirmation (`app/admin/dashboard/page.tsx:405-427`, `:658-876`). 4 à 5 gestes. | Compteurs tirés de `statistics.read` : sans elle, onglets sans nombre ; pas de recherche, pas d'onglet « Suspendus », file qui ne se recharge pas après un dossier complété (G-47). | Compteurs lus avec `partners.read`, recherche, onglet « Suspendus » (E-71) ; confirmation qui dit qui est prévenu (E-32). | S | P3 |
| Valider ou refuser un événement | « Validation » → « En attente de validation » → « Examiner la fiche » → « Valider » / « Refuser » → confirmation (captures `admin-evenements-en-attente`, `admin-fiche-en-attente`). | Fonctionne bien. Fiche « Fin : Non précisée (fin de journée) » fausse (G-10) ; le SMS de refus coupe le motif à 40 caractères sans le dire (G-39). | E-01 ; texte de confirmation de la section 5.3 (E-32). | S | P1 (G-10), P2 |
| Suspendre puis réactiver | Compte : `/admin/users`. Partenaire : fenêtre « Dossier » de l'accueil (sans recherche) ou `/admin/users` → « Voir la fiche partenaire ». Événement : sa fiche. Trois endroits. | Partenaire difficile à retrouver sur téléphone ; réactivation qui annonce un motif jamais envoyé (G-06) ; suspension d'un événement qui promet des détenteurs prévenus (N-08). | Recherche des partenaires (E-71) ; textes de la section 5.3 (E-32) ; motif transmis ou promesse retirée (E-44). | S | P2 |
| Combien gagné, combien dû, combien retirable | Menu → « Finance » → `/admin/finance` (pas de capture du haut) : 6 cartes, 4 petites, 3 « Frais SamirPay », versements, tableau ; filtres en bas qui changent aussi le haut (`app/admin/finance/page.tsx:122`, `:159-347`). | « Gagné » : il faut lire « Revenu net après parrainage », qui oublie les frais de retrait (G-90) ; l'accueil donne un autre « Revenu net » (`app/api/admin/metrics/route.ts:70`, `:85`). « Dû » : rien (G-25). « Retirable » : rien, pas de solde (N-04). Chaque bloc filtre sur une date différente (G-85). | Trois chiffres en tête, une seule période en haut (section 5.4, E-06, E-30). | M | P1 |
| Traiter un versement à reprendre | Alerte → `/admin/finance` → défiler sous 13 blocs → carte → « Renvoyer » / « Marquer versé » → justification (10 caractères) → confirmer (captures `admin-remboursements-a-reprendre`, `admin-versements-*`). | Lien sans ancre ; aucune boîte ne dit qui reçoit quel message ; « Constater non versé » fait partir un SMS faux (G-28) ; solde SamirPay absent avant « Renvoyer ». | Ancre et ligne sur l'accueil (E-07) ; textes 5.3 (E-32) ; messages neutres (E-33) ; solde en tête du bloc (E-06). | S | P1 (accès), P2 |
| Créer un ADMIN et lui donner des droits | `/admin/users` → « Créer un Compte / Admin » → formulaire, carte « ADMINISTRATEUR », « Créer le compte Administrateur » → retrouver la ligne → « Permissions » → cocher parmi 16 → « Enregistrer les permissions » (`app/admin/users/page.tsx:564-900`). Plus de 10 gestes, deux parcours séparés, pas de capture. | Un ADMIN créé n'a aucun droit, sans que l'écran le dise ; aucun message ne lui est envoyé, le mot de passe se transmet à la main et n'est jamais à changer (G-31) ; grille de 16 libellés sans dire ce qu'ils ouvrent ; deux droits n'ouvrent aucun écran (G-42) ; cases d'un autre ADMIN possibles (N-07) ; « Permissions Granulaires », « RBAC » (G-37). | Grille vidée avant lecture (E-12) ; création enchaînée sur les droits, profils prêts, dépendances cochées d'office (section 5.5, E-36). | S puis M | P1 (N-07), P2 |
| Changer un réglage sans risque | « Finance » → bouton discret « Réglages de la plateforme » (`app/admin/finance/page.tsx:177`) ou « Tarification » → 33 lignes → « Modifier » → valeur, motif → « Enregistrer » (`app/admin/finance-settings/page.tsx:346-428`). Pas de capture. | Pas d'entrée de menu (G-43) ; aucune confirmation « avant → après » ; une valeur hors bornes répond « Valeur refusée pour finance.service_fee_rate : 60 » ; l'historique ne montre pas l'auteur (`changed_by` lu, non affiché) ; les services pas prêts s'activent d'un clic (G-44). | Verrou des services (E-08) ; entrée de menu, explication et valeur risquée par réglage, confirmation avant → après (section 5.6, E-35). | S puis M | P1 (verrou), P2 |
| Comprendre une alerte | Cloche → « Versement à reprendre », « Créance sur un compte », « Plafond de SMS atteint »… → lien. | « Créance » mène dans le vide (N-14) ; alertes de plafond fausses (G-13, G-14) et « minuit (UTC, heure de Dakar) » ; une panne du fournisseur produit une alerte par ligne et par admin. | E-05, E-38, E-40, E-69 ; chaque alerte reprise dans « À faire aujourd'hui » (E-29). | S | P1 (G-13), P2 |

### 2.2 P2 — L'ADMIN employé, avec des droits limités

| Tâche | Ce qu'il voit aujourd'hui sans la permission | Ce qui gêne | Proposition | Effort | Prio |
|---|---|---|---|---|---|
| Le matin | Sans `statistics.read` : « Indicateurs indisponibles » / « Impossible de charger les indicateurs de la plateforme. Vérifiez votre connexion, puis réessayez. » (`app/admin/dashboard/page.tsx:552-556`). | Il croit à une panne de réseau ; « Réessayer » ne sert à rien. | « À faire aujourd'hui » limité à ses files, pied « Vous ne voyez que les files que vos droits vous ouvrent. Voir mes droits » (E-29) ; refus qui nomme la permission (E-34). | S | P2 |
| Valider un partenaire, un événement | Sans `partners.validate` ou `events.write`, les boutons disparaissent sans une phrase (`app/admin/dashboard/page.tsx:417-426`, `app/admin/events/[id]/page.tsx:537-551`). | Il cherche le bouton. | Bandeau « Lecture seule : votre compte n'a pas la permission « Valider, publier, suspendre… un événement ». Demandez-la au Superadmin. » (E-34). | S | P2 |
| Suspendre | Comptes : boutons masqués ; compte partenaire sans `partners.read` : « Statut géré depuis la fiche partenaire », sans lien (`app/admin/users/page.tsx:511`, `:515`). | Impasse. | Même bandeau ; « Vous n'avez pas accès aux fiches des partenaires. » (E-34). | S | P2 |
| Finance | Avec `refunds.manage` seule : en haut, erreur rouge « Rapprochement indisponible » + « Réessayer » ; les versements fonctionnent plus bas (`app/admin/finance/page.tsx:203-205`, `:312`). | La page a l'air en panne. | Synthèse masquée sans `payments.read`, avec une phrase ; accès direct aux versements (E-07, E-34). | S | P2 |
| Créer un compte | Avec `users.write` : seules « CONTRÔLEUR » et « CLIENT STANDARD » (`app/admin/users/page.tsx:706`). | Correct ; libellés en capitales et aides techniques (« Scanner de billets sur site (/scan) »). | Libellés de la section 5.2 (E-37). | S | P2 |
| Changer un réglage | « Lecture seule : seul un superadministrateur peut modifier ces réglages. » (`app/admin/finance-settings/page.tsx:305`), mais page introuvable sans passer par Finance (G-43). | Introuvable. | Entrée de menu ouverte à tous, marquée « Lecture seule » (E-35). | S | P2 |
| Parrainage | « Promouvoir Ambassadeur ⭐ » proposé puis refusé ; sans `users.read`, « Aucun utilisateur trouvé. » (G-38). | Il se croit en faute. | Bouton masqué à l'ADMIN ; refus expliqué (E-37). | S | P2 |
| Scanner | « Scanner de contrôle » du menu → `/partner/scan` → « Lecture de vos événements impossible pour le moment. » (G-08). | Impasse. | Entrée retirée sauf rôle contrôleur (E-34). | S | P2 |
| Savoir ce qu'il peut faire | Rien ne l'affiche. Menu complet sauf le journal ; barre du bas « Accueil, Validation, Comptes, Finance » (`components/layout/AppLayout.tsx:170-176`, `:211-242`). | Il découvre ses droits en se heurtant aux refus. | Menu et barre filtrés par permission, page « Mes droits » (section 5.5, E-34). | M | P2 |

### 2.3 P3 — La partenaire (organisatrice pressée)

| Tâche | Aujourd'hui (étapes, écrans) | Ce qui gêne | Proposition | Effort | Prio |
|---|---|---|---|---|---|
| S'inscrire | `/partner/register` : étape 1 « votre dossier » (structure, activités, adresse, NINEA, RCCM, gérant, téléphone, email, mot de passe et confirmation, pièces), étape 2 code SMS (`partenaire-inscription`). | « Email professionnel » obligatoire mais aidé par « Recommandé : … » (G-51) ; « Renvoyer le code » mal décompté après un refus (G-12) ; « reversements par SamirPay » (`:381`) ; « Activités proposées » commence par « Restaurant » (service fermé). | Aide « Obligatoire : vos confirmations et rapports y arrivent. » ; texte d'accueil sans jargon ; activités des services fermés masquées (E-65, E-56). | S | P2 |
| Attendre la validation | Bandeau « Compte en cours de vérification » : « … En attendant, votre profil reste modifiable. » (`app/partner/dashboard/page.tsx:459-461`). | Elle modifie, enregistre, lit « Votre compte n'est pas actif. Contactez le support. » (G-15). | Retirer la phrase, ou ouvrir l'enregistrement du profil en attente (à arbitrer, section 11) (E-65). | S | P2 |
| Premiers pas | `/partner/dashboard` : « Actualiser », « Export comptable », bouton principal « Scanner des billets », puis « Publiez votre premier événement » / « 0 étape franchie sur 8 » / « Créer un événement » (`partenaire-premiers-pas`). | Deux boutons principaux orange concurrents sur un compte sans événement. | Sans événement publié, un seul principal : « Créer un événement » (E-83). | S | P3 |
| Créer un événement (petite soirée, grand concert avec carré VIP) | 4 étapes, enregistrement à la 4e seulement, soumission sur la carte de la liste ; couleur et consigne en modification seulement ; zones dans le pilotage après validation (section 4.1). | Grand concert : environ 38 touches, 3 visites, 12 écrans ; étapes réduites à « 1 2 3 4 » sur téléphone (`partenaire-creation`). | Formulaire en 5 étapes et écran « Vérifier avant d'envoyer » (section 4, E-22 à E-24). | L | P2 |
| Préparer billetterie, couleurs, consignes, zones | Billets à la création ; couleur et consigne dans « Modifier » → « Billets » → catégorie enregistrée → « Au contrôle des entrées » (`partenaire-categorie-canaux`) ; zones dans Pilotage › Équipe sous le formulaire d'invitation (`partenaire-zones`). | Trois endroits, trois boutons « Enregistrer », un ordre imposé ; impossible une fois soumis sans « Retirer de la validation » (A1). | Couleur automatique, consigne sous « Options d'entrée (facultatif) », zones à l'étape « Entrées » (E-22, E-23). | M + M | P2 |
| Soumettre, comprendre la validation | Carte « Soumettre à la validation », sans récapitulatif ; message de validation « Vous pouvez le publier depuis votre espace. » | Les manques se découvrent après coup ; rien n'annonce les contrôleurs, les invitations ni le PIN ; « Retirer de la validation » rend le brouillon insupprimable sans le dire (N-06). | Écran de fin (E-24) ; message de validation complété (E-25) ; avertissement au retrait et « Archiver le brouillon » (E-80). | S | P2 |
| Constituer et gérer son équipe | `/partner/team` et onglet Équipe du pilotage, deux écrans différents (section 3). | Porte, caisse, entrées, dernière activité absentes de la page ; invitations invisibles dans l'onglet ; renvoi proposé à tort (G-21, G-22). | Un composant unique (section 3, E-10, E-11, E-13 à E-21). | L | P1 (G-21, G-22), P2 |
| Suivre ses ventes | Tableau de bord : « Ventes en ligne », « Net partenaire » (`partenaire-tableau-de-bord`) ; pilotage : 7 onglets, en-tête qui occupe environ 45 % de l'écran à chaque onglet, « Caisse » et « Clôture » hors écran (`pilotage-apercu`) ; aucune nouvelle d'une vente hors cloche une par commande. | Le même montant porte trois noms : « Net partenaire », « Recettes en ligne », « Montant net organisateur » ; statistiques d'une autre génération (« CA Total », « FCFA », « PUBLIE », G-50). | Un nom : « Recettes en ligne nettes » (E-64) ; cloche regroupée et résumé du matin (D3, E-51) ; lien « Statistiques de ventes » masqué puis page refaite (E-65, E-86). | S à M | P2 |
| Inviter des invités | Onglet Invitations : « Inviter par SMS », catégorie, billets par numéro, numéros (`invitations-onglet`). | Clair ; texte de numéro mal saisi hors glossaire (`InvitationsTab.tsx:92`). | Texte unique du glossaire (E-66). | S | P3 |
| Tenir la caisse | Onglet Caisse : « Espèces encaissées », « Caisses ouvertes », « Écart cumulé -2 000 F CFA », section PIN (`pilotage-caisse`). Aucun lien depuis l'équipe. | Signe à interpréter ; « Aucun code PIN : vos contrôleurs ne peuvent ni ouvrir ni clôturer de caisse. » faux pour une clôture sans écart (G-66). | « manque » / « en trop » en mots, texte G-66 corrigé (E-63) ; bandeau PIN et liens depuis l'équipe (E-14). | S | P2 |
| Modifier une date | « Modifier » → étape 1 → date → « Enregistrer les modifications » → encadré « … SMS partiront dans 10 minutes… ». | Rien avant l'envoi d'un SMS irrévocable ; délai parfois faux (G-18) ; aide « prévenus » absente sur la fin et en Validé ; erreur « La fin de vente de « VIP » dépasse la nouvelle fin… » rangée sous la date, sans lien vers la catégorie. | Fenêtre « Prévenir les détenteurs de billets ? » (E-28) ; encadré réécrit (E-27) ; lien vers le champ fautif (E-77). | M | P2 |
| Annuler | « Annuler l'événement » → impact chiffré, avis public, motif interne, titre à retaper (`pilotage-annulation`). | Rien de bloquant. | À garder (section 10). | — | — |
| Rembourser un billet | Onglet Ventes → numéro « TCK-… » → « Rechercher le billet » → fiche (« Porteur », « Vente ») → « Rembourser ce billet » → « Continuer » → « Rembourser le client » (`TicketRefundPanel.tsx:250-346`). | Elle a souvent le nom ou le téléphone du client, pas le numéro ; trois libellés pour une action ; « Porteur » et « Vente » hors glossaire ; aucun avis quand un client se fait rembourser lui-même (G-93). | Recherche par les 10 derniers signes ou le téléphone (E-61) ; « Titulaire », « Origine », « Confirmer le remboursement » (E-66) ; avis (E-48). | M | P2 |
| Retirer son argent | `/partner/finance` : « Disponible au retrait », formulaire, « Recevoir le code de confirmation », « Mes retraits » (`partenaire-finances-retrait-retarde`). | « Versé : 5 940 F CFA » sur un retrait retardé (N-02) ; « code de confirmation » au lieu de « code de retrait » ; blocage de 24 h après un changement de numéro annoncé nulle part (G-34) ; recettes disponibles annoncées par cloche et email seulement. | « Montant envoyé : … » partout, « Versé le … » au versement seulement (E-03) ; G-34 dans la boîte de changement de numéro (E-65) ; SMS « recettes disponibles » (E-47). | S | P1 (N-02), P2 |
| Lire le rapport de clôture | Onglet Clôture : « Montant net organisateur », détail « Recettes en ligne » (déjà net) puis « Remboursé » (`partenaire-rapport-cloture`) ; événement annulé : mêmes ventes au guichet dans deux cartes (`pilotage-especes-a-rembourser`). | Double déduction à la lecture (G-26) ; carte qui ne bouge jamais (G-27) ; « Capacité mise en vente ». | Détail en cascade brut → remboursé → net, carte doublon retirée, « Quantités mises en vente » (E-64). | S | P2 |

### 2.4 P4 — L'acheteur (sur téléphone, réseau moyen)

| Tâche | Aujourd'hui (étapes, écrans) | Ce qui gêne | Proposition | Effort | Prio |
|---|---|---|---|---|---|
| Trouver un événement | `/` et `/explore` : cartes (affiche, pastille « 13 NOV », organisateur, titre, badges, date, lieu, prix), recherche, « Filtres et tri » (`catalogue`, `accueil-dernieres-places`). | Date écrite trois fois par carte (affiche, pastille, ligne) ; une carte occupe presque un écran. | Ligne de date réduite à « ven. · 21:00 » (E-84). | S | P3 |
| Lire le prix et la disponibilité sur la carte | « À partir de » / « Gratuit » même quand tout est gratuit (G-77) ; « Dernières places » au seuil absolu de 10 (G-76) ; « Complet » et « Vente sur place uniquement » sur la même carte (N-12). | Fausse urgence sur une petite catégorie, alerte tardive sur une grande ; « Complet » qui ne l'est pas. | A2 et « Complet en ligne » (E-54) ; U2 (E-53), section 6. | S + M | P2 |
| Trouver où acheter | `/events/{id}` : affiche, titre, date, lieu, description, programme, carte, infos pratiques, organisateur, **puis** « Choisissez vos billets » ; barre d'achat seulement avec un billet au panier (`evenement-publie`, `fiche-barre-achat`). | Premier écran sans prix ni bouton (N-03). | Barre fixe dès l'ouverture : « Billetterie » / « Dès 5 000 F CFA » + « Choisir mes billets » qui amène à la billetterie ; remplacée par « Acheter (…) » dès qu'un billet est choisi (E-02). | S | **P1** |
| Acheter avec Wave ou Orange Money | « - » / « + » → « Acheter 3 billets (23 625 F CFA) » → « Paiement sécurisé » (récapitulatif, opérateur non présélectionné, numéro prérempli, « Payer 5 250 F CFA ») → `/paiement/{id}` (étapes, compte à rebours) → « Paiement confirmé » ou « Le paiement n'a pas abouti » (`paiement-modale`, `paiement-attente`, `paiement-succes`, `paiement-echec`). | Bon parcours. Sur l'échec, le secondaire « Mes billets » mène à une page sans billet de cet achat. Non connecté : `/login` ouvert sur l'onglet « Mot de passe », « Créer un compte client » sous le bouton, texte « commandes, réservations » (services fermés). | « Retour à l'événement » sur l'échec ; connexion venant d'un achat : « Connectez-vous ou créez votre compte pour finir votre achat : votre sélection est gardée. » et « Créer un compte » au-dessus (E-82, E-84). | S | P3 |
| Racheter après un paiement abandonné | Le bandeau « Un paiement est déjà en attente » disparaît à 10 min ; le serveur refuse un second paiement jusqu'à 60 min (G-23). | Elle refait un panier et lit le refus seulement après « Payer ». | Bandeau gardé tant que le paiement est « En attente », avec « Annuler ce paiement » et « Suivre le paiement » (E-55). | S | P2 |
| Retrouver son billet à l'entrée | `/tickets` : trois boutons empilés (« Afficher mes billets hors ligne », « Comment marche le transfert ? », « Réserver un billet » en principal), onglets, carte avec affiche puis QR (`mes-billets`). | Le QR n'est pas dans le premier écran ; le bouton principal de la page des billets est « Réserver un billet ». | Boutons en ligne secondaire sous les onglets, « Réserver un billet » à vide seulement ; le jour J, le prochain billet s'ouvre QR en premier, comme `/billet/hors-ligne` (`billet-hors-ligne-qr`) (E-58). | M | P2 |
| Transférer, recevoir | Fenêtre « Transférer ce billet » ; destinataire : onglet « Reçus » ouvert seul, « Envoyé par Marième N. », « Accepter le billet » / « Refuser » (`mes-billets-recus`). | Bon. « Envoyé par Un utilisateur » sans nom ; « Transfert en attente » (pastille) et « Transfert en cours » (ligne) ; aucun SMS quand le billet revient à l'expéditeur ; échéance de 48 h sans lien avec le début (G-81). | U4 (E-52) ; « Transfert en cours » partout (E-66) ; SMS au retour (E-46). | S | P2 |
| Être remboursé | Après report : bandeau + « Me faire rembourser » ; suivi : `/profile/payments` (`mes-paiements`). | Paiement « Confirmé » jusqu'au versement (G-89) ; billet remboursé par l'organisateur sans SMS ni push et titré « Remboursement demandé » (N-09). | « Remboursement en cours » / « Remboursement retardé… » (E-59) ; SMS et texte (E-45). | S | P2 |
| S'inscrire, se connecter | `/register` en deux étapes : numéro, puis code, prénom, nom, mot de passe, email facultatif (`inscription`). | Numéro déjà inscrit : « Recevoir un code de connexion » ouvre l'onglet « Mot de passe » (G-32) ; trop d'essais : décompte de 60 s au lieu de 15 min, message du serveur masqué (G-12) ; trois façons de confirmer un mot de passe. | E-57, E-56, E-85. | S | P2 |
| Compte suspendu | Message : « présentez le billet hors ligne déjà enregistré… » (G-05). | Le billet hors ligne est effacé ; le numéro n'est que dans l'email (N-10). | Texte et lien corrigés (E-04) ; numéro du billet à arbitrer (section 11). | S | **P1** |

### 2.5 P5 — Le contrôleur (de nuit ou en plein soleil, file d'attente devant lui)

| Tâche | Aujourd'hui (étapes, écrans) | Ce qui gêne | Proposition | Effort | Prio |
|---|---|---|---|---|---|
| Activer son compte | `/controller/setup?phone=…` : numéro, 6 cases de code, mot de passe avec règles cochées en direct, confirmation, « Activer mon compte » (`controleur-activation`). | Numéro brut « +221700000199 » ; règle de mot de passe propre au contrôleur (G-31) ; il peut ouvrir une session par code SMS sans jamais activer (G-97). | Numéro « 70 000 01 99 », une seule règle, connexion par code refusée tant que le compte n'est pas activé (à arbitrer) (E-62). | S | P2 |
| Ouvrir le scanner à la bonne porte | `/controller/scanner` → « Commencer le contrôle » → événement → « Votre porte : Entrée principale… » → « Commencer le contrôle » (`scanner-accueil`). 2 appuis. | Bon. | À garder. | — | — |
| Scanner vite | Caméra ouverte ; « Entrée principale : 54 entrées », « En ligne » (`controleur-scanner`). | **0 appui entre deux billets valides** (retour automatique en 1,5 s, `CombatFlashOverlay.tsx:174-180`) ; même QR relu dans les 20 s ignoré. Rien à reprendre. | À garder. | — | — |
| Comprendre chaque résultat | Plein écran coloré, contrastes de 8:1 à 12,6:1 (`app/globals.css:70-81`), titre et nom très gros (`scanner-accepte`, `scanner-accepte-consigne`). | « Transfert en cours » sans consigne (G-73, `scanner-transfert-en-cours`) ; « QR expiré : demandez au client d'ouvrir son billet dans l'application » en titre de 4 lignes (`scanner-refuse`) ; « Accès refusé » / « : billet VIP » (deux-points en tête de ligne, `scanner-mauvaise-zone`) ; « Événement annulé » sans quoi dire ; les deux rouges très foncés sont les moins distinguables en plein soleil (icône et titre portent le sens). | Ligne « Le client doit annuler le transfert dans Mes billets, ou le destinataire l'accepter, puis présenter le billet. » (E-60) ; titre court + consigne, espace insécable avant « : », ligne « Billets remboursés : aucune entrée possible. » ; essai terrain des rouges avant tout changement (E-81). | S | P2, P3 |
| Saisie manuelle | « Numéro du billet » → « Vérifier le billet » → fiche → case « Pièce d'identité conforme au titulaire » → « Pièce conforme, valider l'entrée » (`scanner-saisie-manuelle`). | Numéro complet exigé à l'identique : « TCK-20261112-CBABC7A6AC », 22 signes avec tirets, au clavier, de nuit. | 10 derniers signes acceptés, sans tirets, en majuscules d'office, recherche limitée à l'événement du contrôleur (E-61). | M | P2 |
| Vendre au guichet | Onglet « Guichet » : catégories, « - » / « + », « Numéro de l'acheteur (facultatif) », « J'ai reçu 5 000 F CFA : valider la vente » (`scanner-guichet`). | Le bouton principal passe sur deux lignes et sort du premier écran. | « Encaisser 5 000 F CFA » (E-84). | S | P3 |
| Liste des invités | 4 chiffres → « Rechercher » → « Choisir » → « J'ai vérifié la pièce d'identité » → « Valider l'entrée d'une personne » (`scanner-liste-invites-resultat`). | Clair ; une personne à la fois, voulu. | À garder. | — | — |
| Ouvrir et fermer sa caisse | « Ouvrir ma caisse » → fonds, « Code PIN du régisseur » → « Ouvrir la caisse » ; clôture avec écart : « Écart de -2 000 F CFA… » → justification, PIN → « Clôturer avec l'écart » ; puis « Z de caisse », « Imprimer le Z » (`caisse-ouverture`, `caisse-cloture-ecart`, `caisse-ticket-z`). | Titres « ma caisse », boutons « la caisse » ; PIN annoncé « de 4 à 8 chiffres » alors qu'il en a 6 ; signe à interpréter ; « Z de caisse » interdit par le glossaire. | « Il manque 2 000 F CFA par rapport aux ventes enregistrées. » / « Il y a 2 000 F CFA de trop… » ; « Récapitulatif de caisse » ; boutons identiques aux titres (E-63). | S | P2 |

---

## 3. Page « Équipe »

### 3.1 Ce qu'une partenaire doit voir et faire, et ce qui existe

| Besoin | `/partner/team` aujourd'hui | Onglet Équipe du pilotage | Donnée côté serveur | Manque |
|---|---|---|---|---|
| Nom, numéro | oui ; nom répété deux fois sur la carte mobile, numéro non cliquable (`partenaire-equipe__mobile`) | oui ; « Compte sans nom » si vide | `users` | appeler, WhatsApp |
| État : actif, activation en attente, invitation en attente | « Actif », « Activation en attente », « Invitation en attente » + « Jusqu'au {date} » (`app/partner/team/page.tsx:441-454`) | aucun ; seulement « Compte inactif » (une coquille jamais activée y passe pour active) | `controller_account_states` (`M/20261109000008_lot9bis_cycle.sql:2189-2215`) | servir à l'onglet |
| Compte suspendu | servi, jamais affiché (`all/route.ts:254`) | « Compte inactif » | `users.status` | afficher |
| Invitation expirée, refusée | non | non | `controller_invitations` : `EXPIRED`, `DECLINED`, `responded_at` | lecture à étendre |
| Code d'activation expiré | non | non | `otp_codes` (`CONTROLLER_SETUP`, `expires_at`) | « Code expiré le … » |
| Événements | une pastille par affectation, tous statuts, sans date (la liste grossit à chaque soirée) | celui de l'onglet | `event_controllers` + `events` | « à venir » / « passés », datés |
| **Porte** par événement, « Peut changer de porte » | non | oui (« Enregistrer » placé au-dessus de l'interrupteur qu'il enregistre, `partenaire-equipe-portes`) | `event_controllers.gate_id`, `gate_change_allowed` | servir sur la page |
| Point d'entrée (sans zone) | non | oui | `event_controllers.entry_point` | servir sur la page |
| **Espèces** par événement | agrégat faux (« autorisé » si un seul événement l'autorise, `page.tsx:434`) | oui, enregistré aussitôt sans confirmation | `can_accept_cash` par affectation (déjà servi, `all/route.ts:267`) | afficher par événement |
| **Caisse ouverte** | non | badge non cliquable | `controller_shifts.status = 'OUVERT'` | lien Caisse |
| PIN régisseur en place | non | non (onglet Caisse) | `event_regisseur_pins` | bandeau si espèces sans PIN |
| **Entrées validées**, **dernière activité** | non | oui (« 128 entrées validées · dernière activité le … ») | `ticket_scans` | servir sur la page ; lien Entrées |
| Inviter sur un ou plusieurs événements | oui (cases, interrupteur « Encaissement des espèces ») | un seul (case « Autoriser l'encaissement en espèces ») | `POST /api/partner/team/invite` | — |
| Renvoyer | « Renvoyer le SMS », comptes à activer seulement | « Renvoyer l'invitation par SMS » sur **tous** (G-21), sans prénom (N-11) | `resend` | bon filtre partout |
| Renvoyer, annuler une invitation (compte existant) | non | non | renvoi possible ; **aucune** route d'annulation, pas de statut `CANCELLED` | migration, RPC, route |
| Renommer | non | non | aucune route ; un compte établi garde son nom | coquille seulement |
| Changer la porte, les espèces | espèces par « Gérer » | oui | `PATCH …/gate`, `…/assignments` | — |
| Retirer d'un événement, de l'équipe | oui, avec deux icônes sans libellé pour « Retirer de tous » et « Supprimer de l'équipe » (`partenaire-equipe__ordinateur`) ; fenêtre qui tait la déconnexion de tous les appareils (G-68) | d'un événement seulement | `DELETE …/team/{eventId}`, `…/all`, `…/controller/{id}` | une action, conséquence dite |
| Mise à jour en direct | badge « En direct », mais seul le statut des événements relit la page (G-65) | scans, caisses, statut ; pas les affectations ni les invitations (G-22) | `event_controllers` et `controller_invitations` hors temps réel | signaux à ajouter |
| Droits de l'admin | boutons montrés à tous, « Supprimer » échoue sans `partnerId` (G-69), « Retirer de tous » touche tous les organisateurs (N-01) | lecture seule même avec `events.write` (G-72) | `event_actor_profile` (`is_owner`, `is_staff`) | `can_manage` servi |

**Conclusion.** Toutes les informations demandées existent déjà en base, sauf l'annulation d'une invitation. Le
travail est une lecture serveur unique et un composant, sans nouvelle donnée métier.

Les deux écrans font la même chose autrement : « Numéro du contrôleur » / « Téléphone du contrôleur » ; deux textes
d'erreur de numéro (aucun n'est celui du glossaire) ; interrupteur / case pour les espèces ; espèces enregistrées par
lot avec « Enregistrer » / aussitôt sans confirmation ; « Contrôleur » / « Compte sans nom » pour un nom vide ;
« Retirer de cet événement ? » avec nom / « Retirer ce contrôleur de l'événement ? » sans nom. Sur téléphone, l'onglet
s'ouvre sur le formulaire d'invitation et la liste est deux à trois écrans plus bas (`pilotage-equipe__mobile`).

### 3.2 L'écran proposé : un seul composant `TeamPanel`

**Principe.** `components/partner/team/TeamPanel.tsx`, avec `scope = tous les événements` sur `/partner/team` (filtre
par événement) et `scope = un événement` dans l'onglet Équipe du pilotage. « Zones et portes » quitte l'onglet Équipe
pour l'étape « Entrées » de l'événement (section 4, U1) ; l'onglet n'en garde qu'un résumé et un lien. Une seule
lecture : `GET /api/partner/team?eventId=…&partnerId=…`, nouvelle RPC `partner_team_view` qui renvoie `can_manage`,
les membres (identité, état du compte, activation, `other_organizers`, affectations avec porte, point d'entrée,
espèces, caisse ouverte, entrées, dernier scan), les invitations (en attente, expirées, refusées, la plus récente par
compte sur 30 jours), les événements assignables et les alertes.

**Blocs, de haut en bas**

1. **En-tête.** Page : indicateur de mise à jour, titre « Équipe de contrôle », ligne « {n} contrôleurs · {a} prêts ·
   {p} en attente ». Onglet : « Équipe de cet événement », même ligne pour l'événement. Boutons : « Inviter un
   contrôleur » (principal) ; « Actualiser » (page seulement).
2. **Bandeaux d'action** (servis par le serveur), chacun avec son bouton :
   - « {n} contrôleur(s) sans porte » / « Ils ne peuvent pas scanner tant que vous ne leur attribuez pas une porte. » →
     « Attribuer les portes » ;
   - « Aucun code PIN régisseur » / « {n} contrôleur(s) autorisé(s) aux espèces ne pourront pas ouvrir leur caisse. » →
     « Générer le code PIN » (onglet Caisse) ;
   - « {n} caisse(s) ouverte(s) » / « Fermez-les à la fin de la soirée pour clore le rapport. » → « Voir la caisse »
     (événement terminé seulement) ;
   - « {n} invitation(s) sans réponse » / « Expirées ou refusées : relancez ou effacez-les. » → « Voir ».
3. **Filtres** (page) : « Rechercher » (« Nom ou numéro ») ; « Événement » : « Événements à venir » par défaut, puis
   chaque événement, les passés groupés ; puces « Tous », « Prêts », « En attente », « Sans porte », « À relancer ».
   Onglet : puces seulement, dès 6 membres.
4. **Liste.**

**Colonnes sur ordinateur** (onglet ; sur la page, une sous-ligne par événement à venir, précédée de
« {titre} · {jeu. 12 nov. 22:00} », les événements passés repliés derrière « {n} événement(s) passé(s) ») :

| Contrôleur | État | Porte | Espèces | Caisse | Entrées | Dernier scan | |
|---|---|---|---|---|---|---|---|
| « Lamine Cissé », « 70 000 01 08 », icônes « Appeler » et « WhatsApp » | badge | « Porte Nord · Entrée générale », ou « Sans porte » en orange ; sans zone : point d'entrée ou « Non précisé » | « Autorisées » / « Non » | « Ouverte » (lien) / « — » | « 128 » (lien) | « 22:41 » + « En service » si moins de 10 min | « Modifier » + menu « ⋯ » |

**Carte sur téléphone (390 px), sans rien déplier**

1. Nom, une seule fois, et badge d'état à droite.
2. « 70 000 01 08 » et deux boutons de 44 px : « Appeler », « WhatsApp ».
3. Onglet : « Porte : Porte Nord · Entrée générale » (ou « Sans porte : ne peut pas scanner » en orange ; sans zone
   « Point d'entrée : … »). Page : une ligne par événement à venir, « Nuit du Sabar · jeu. 12 nov. 22:00 — Porte Nord ».
4. Puces : « Espèces autorisées » ou « Sans espèces » ; « Caisse ouverte » (lien) ; « 128 entrées · dernier scan
   22:41 » (lien) ; « En service ».
5. « Modifier » (onglet) ou « Gérer les événements » (page), et « ⋯ » : « Renvoyer le SMS d'activation » (compte à
   activer seulement), « Retirer de cet événement », « Retirer de l'équipe ».

La liste est visible dans le premier écran de l'onglet ; l'invitation passe dans une fenêtre.

**États et lignes d'invitation**

| État | Badge | Ligne d'aide | Actions |
|---|---|---|---|
| Actif | « Prêt » (vert) | — | Modifier, ⋯ |
| Compte à activer | « Activation en attente » (orange) | « Code envoyé le {date}, valable jusqu'au {date}. » ou « Code expiré le {date} : renvoyez le SMS. » | « Renvoyer le SMS d'activation », Modifier |
| Compte suspendu | « Compte suspendu » (rouge) | « Il ne peut pas scanner. Contactez le support. » | Retirer |
| Invitation en attente | « Invitation envoyée » (bleu) | « {Mo*** D***} doit accepter avant le {dim. 15 nov. à 21:05}. Événements : {titres}. » ; si un événement n'accepte plus de contrôleur : « « {titre} » n'accepte plus de contrôleur : il n'y sera pas affecté. » (G-75) | « Renvoyer l'invitation », « Annuler l'invitation », Appeler, WhatsApp |
| Invitation expirée | « Sans réponse » (gris) | « Invitation expirée le {date}. » | « Inviter de nouveau », « Effacer » |
| Invitation refusée | « Refusée » (gris) | « Refusée le {date}. » | « Inviter de nouveau », « Effacer » |

**Fenêtres (textes exacts)**

- **Modifier** — titre « {Nom} · {titre} » ; « Porte » (« Aucune porte », « Porte Nord · Entrée générale »…) ;
  interrupteur « Peut changer de porte » / « Il choisit lui-même sa porte dans le scanner. » ; sans zone « Point
  d'entrée » ; interrupteur « Encaisser les espèces » / « Il vend des billets au guichet de cet événement. » ; **un
  seul** bouton « Enregistrer » pour les trois réglages. Toast : « Réglages de {nom} enregistrés. Il les voit à son
  prochain retour dans le scanner. » Si les espèces passent à non avec une caisse ouverte : « Retirer le droit
  d'encaisser ? » / « {Nom} ne pourra plus vendre au guichet. Sa caisse reste ouverte : il doit la clôturer avec le
  régisseur. Il n'est pas prévenu par message : dites-le-lui. » / « Retirer le droit » · « Revenir ».
- **Inviter** (même fenêtre aux deux endroits) — « Inviter un contrôleur » / « Il reçoit un SMS pour activer son accès
  au scanner. » ; « Prénom », « Nom » (« Facultatif ») ; « Numéro de téléphone » (erreur : le texte unique du
  glossaire, « Numéro de mobile sénégalais invalide. Exemple : 77 123 45 67. ») ; « Événements » (dans l'onglet,
  l'événement courant coché d'office, les autres proposés) ; « Encaisser les espèces » ; « Inviter » / « Inviter sur
  {n} événements ».
- **Ce numéro a déjà un compte** (G-64, remplace le texte du serveur) — « Titulaire : {Mo*** D***} » ; « Nous lui
  envoyons une invitation par SMS. Il ne contrôlera vos événements qu'après l'avoir acceptée dans l'application, sous
  72 h. Son compte, ses billets et son portefeuille ne changent pas. » ; « Revenir » / « Envoyer l'invitation ». Toast :
  « Invitation envoyée à {Mo*** D***} : réponse attendue avant le {date}. » et la ligne « Invitation envoyée » apparaît
  aussitôt dans les deux vues (G-22).
- **Renvoyer le SMS d'activation** — « Renvoyer le code à {nom} ? » / « Un SMS part vers {70 000 01 08} avec un
  nouveau code valable 24 h ; l'ancien code ne marche plus. 3 envois au plus par jour vers ce numéro. » ; toast « SMS
  renvoyé à {nom} : code valable jusqu'au {date}. » (au lieu de « Droits mis à jour… », N-11).
- **Renvoyer l'invitation** — « {Mo*** D***} reçoit un nouveau SMS ; l'invitation est prolongée de 72 h. »
- **Annuler l'invitation** — « Annuler l'invitation de {Mo*** D***} ? » / « Le lien du SMS ne mènera plus à rien : il
  verra « Aucune invitation en attente ». Aucun message ne lui est envoyé. » / « Annuler l'invitation » · « Garder ».
- **Retirer de cet événement** — « Retirer {nom} de « {titre} » ? » / « Il ne peut plus scanner les billets de cet
  événement, dès son prochain scan. Il reçoit un SMS et un avis. Ses scans déjà faits restent dans les entrées. » Avec
  une caisse ouverte : bouton grisé et « {Nom} a une caisse ouverte sur cet événement : fermez-la d'abord dans l'onglet
  Caisse. » + « Ouvrir la caisse » (le serveur refuse déjà, `lib/shifts/shift.service.ts:113-125`).
- **Retirer de l'équipe** (fusion de « Retirer de tous » et « Supprimer », G-68) — « Retirer {nom} de votre équipe ? »
  / « Il est retiré de vos {n} événements et reçoit un SMS et un avis. » puis, s'il ne contrôle pour personne
  d'autre : « Son accès au scanner est fermé et il est déconnecté de l'application sur tous ses téléphones, espace
  client compris. Il pourra se reconnecter pour ses billets. » ; sinon « Il garde ses affectations chez d'autres
  organisateurs. » ; toujours : « Pour le reprendre, invitez-le de nouveau : il sera affecté sans nouvelle
  acceptation. »

**Appeler et WhatsApp.** `tel:+221{9 chiffres}` ; `https://wa.me/221{9 chiffres}?text={message}`. Messages prêts,
sans jamais de code :
- prêt : « Bonjour {prénom}, ici {organisateur}. Vous contrôlez l'entrée de « {titre} » le {jeu. 12 nov. à 22:00},
  porte {Porte Nord}. Ouvrez le scanner : {adresse}/controller/scanner » ;
- activation en attente : « Bonjour {prénom}, ici {organisateur}. Pour scanner les billets de « {titre} », activez
  votre compte avec le code reçu par SMS : {adresse}/controller/setup. Si le code a expiré, dites-le-moi et je vous le
  renvoie. » ;
- invitation envoyée : « Bonjour, ici {organisateur}. Je vous ai invité à contrôler l'entrée de « {titre} » sur Event
  Village. Acceptez l'invitation avant le {date} : {adresse}/invitations ».

**Caisse et Entrées.** Page : liens `/partner/events/{id}?tab=caisse` et `?tab=entrees`. Onglet : un lien vers la même
page ne change pas d'onglet (`useTabParam` ne lit l'adresse qu'au montage, `components/ui/Tabs.tsx:153-158`) : rappel
`onOpenTab` branché sur l'onglet actif du pilotage. « Caisse ouverte » et « Aucun code PIN régisseur » → Caisse ;
« 128 entrées » → Entrées.

**En direct.** Page : ajouter `controller_shifts` et les notifications de la partenaire, `ticket_scans` seulement avec
un événement choisi, relecture de secours toutes les 60 s. Acceptation ou refus d'une invitation : avis à la
partenaire (E-20, section 7.3) qui relit l'équipe. Affectations faites ailleurs : publier `event_controllers` pour la
propriétaire (E-76, P3). L'indicateur « En direct » ne s'affiche que si ces signaux couvrent l'équipe ; sinon « Mis à
jour à {heure} ».

**États vides.**
- Page sans événement assignable : « Pas encore d'équipe » / « Pour inviter un contrôleur, il faut un événement validé
  ou publié. » / « Voir mes événements ».
- Page sans membre : « Aucun contrôleur dans votre équipe » / « Invitez vos contrôleurs : ils reçoivent un SMS et
  scannent les billets à l'entrée. » / « Inviter un premier contrôleur ».
- Onglet sans membre : « Personne ne contrôle encore cet événement » / « Invitez au moins un contrôleur par porte. » /
  « Inviter un contrôleur ».
- Onglet, brouillon ou en attente : « Équipe disponible après la validation » / « Les contrôleurs s'ajoutent dès que
  l'événement est validé. » ; terminé ou annulé : liste en lecture, « Événement terminé : l'équipe ne change plus. ».
- Chargement : 3 cartes squelette ; erreur : « Équipe indisponible » + « Réessayer » ; relecture ratée : « {erreur}
  La liste affichée est celle de la dernière lecture réussie. » (texte actuel).

**Droits.** `can_manage` = propriétaire, ou admin muni de `events.write` (G-72) ; boutons masqués aux autres, y compris
à l'admin `events.read` seul. Admin sur `/partner/team` : choix « Organisateur » obligatoire avant toute lecture,
`partnerId` passé à toutes les écritures ; la route refuse un admin sans `partnerId` : « Choisissez l'organisateur dont
vous gérez l'équipe. » (G-69, N-01). G-97 : tant qu'un compte à activer peut ouvrir une session par code SMS, le badge
« Activation en attente » ment (section 11).

**Changements** : E-09, E-10, E-11 (P1) ; E-13 à E-21 (P2) ; E-75, E-76 (P3).

---

## 4. Création d'un événement

### 4.1 Aujourd'hui

- « Mes événements » → « Créer un événement » → `/partner/events/new`. **Quatre étapes** : « Informations »,
  « Programme », « Accès », « Billets » (`components/events/EventForm.tsx:80-85`) ; sur téléphone, seulement « 1 2 3 4 »
  (libellé caché sous 640 px, `EventForm.tsx:878` ; capture `partenaire-creation`). Rien n'est enregistré avant
  l'étape 4 (« Enregistrer le brouillon ») ; la soumission se fait ensuite sur la carte de la liste.
- **Couleur et consigne** : seulement dans « Modifier » → « Billets » → catégorie **déjà enregistrée** → « Au contrôle
  des entrées » → « Enregistrer la catégorie » (`EventTicketing.tsx:243`, `:381-406` ; `partenaire-categorie-canaux`).
  Le schéma de création et la base les refusent (`lib/validations/event.ts:331-347`, `:435` ; `event_create` →
  `ticket_category_normalize`, « Ce champ de la catégorie de billets n'est pas accepté. »,
  `M/20261106000001_lot8_canaux.sql:579-584`), alors que la création d'une catégorie seule les accepte déjà
  (`M/20261110000011_lot9ter_stock.sql:289-310`). Une fois soumis, l'événement ne se modifie plus : il faut le retirer
  de la validation, ce qui rend le brouillon insupprimable (N-06).
- **Zones et portes** : Pilotage → onglet « Équipe » (5e onglet sur 7, coupé sur téléphone, `pilotage-apercu`), sous le
  formulaire « Inviter un contrôleur » (`partenaire-zones`). La base les accepte dès le brouillon, mais la carte ne
  propose « Piloter » qu'à partir de Validé (`PartnerEventCard.tsx:46`, `:132-136`).
- **Prix minimum** (G-60) : le minimum de 100 F CFA n'est pas dit dans l'aide (« Montant entier ; 0 pour une entrée
  gratuite. », `EventTicketing.tsx:273`) ; refusé par la base sans numéro de catégorie, affiché « Formulaire : Le prix
  d'un billet payant est d'au moins 100 F CFA. Pour un billet gratuit, indiquez 0. », lien qui ne mène nulle part.
- **Fin par défaut** (G-10) : sans date de fin, l'événement se termine 6 h après son début (vente arrêtée, contrôle
  fermé 6 h plus tard, passage à Terminé, fonds). Aides actuelles : « Facultative. Pour une soirée qui passe minuit,
  indiquez la date du lendemain. » et « Facultative ; avec une heure de fin, la date de fin est demandée. »
  (`EventForm.tsx:970-975`) ; fiche admin : « Fin : Non précisée (fin de journée) » (`app/admin/events/[id]/page.tsx:600`),
  faux.
- **Message de validation** (`EVENT_VALIDATED`, `lib/notifications/catalog.ts:902-908`) : SMS « Event Village : votre
  événement {titre} est validé. Publiez-le depuis votre espace : {lien}/partner/events » ; cloche « « {titre} » est
  validé. Vous pouvez le publier depuis votre espace. » Rien sur les contrôleurs, les invitations ou le PIN, alors que
  contrôleurs et invitations sont possibles dès Validé (`lib/events/event-status.ts:14`).

**Les deux parcours, comptés** (touches = boutons, cases et choix ; saisies identiques des deux côtés) :

| Parcours | Aujourd'hui | Proposé |
|---|---|---|
| A. Petite soirée, une porte (une catégorie « Entrée » à 3 000 F CFA, 150 places, affiche) | 12 touches, 7 écrans, 1 visite + publication ; + 6 touches et une seconde visite pour une consigne (bracelet), et seulement avant de soumettre | 12 touches, 8 écrans, 1 visite ; + 1 touche pour une consigne |
| B. Grand concert avec carré VIP (Standard 10 000 F, 2 000 places, en ligne et guichet ; VIP 50 000 F, 200 places, en ligne, Or, « Remettre bracelet doré » ; zones « Entrée générale » portes Nord et Sud + « Carré VIP » contrôle de zone) | ≈ 38 touches, 3 visites (création ; modification pour couleurs et consigne ; pilotage après validation pour les zones), ≈ 12 écrans | 23 touches, 1 visite + publication, 8 écrans |

Pour la petite soirée sans consigne, le nombre de touches est identique : le gain est l'absence de seconde visite, la
couleur sans y penser et la soumission sans repasser par la liste.

### 4.2 Le formulaire proposé (décision U3), étape par étape

En-tête : « Créer un événement » / « Remplissez les 5 étapes, vérifiez, puis envoyez à la validation. Vous pouvez aussi
garder un brouillon. » Étapes nommées sur téléphone (au moins l'étape active) ; ligne « Étape {n} sur 5 : {titre} » ;
« Précédent », « Suivant » (qui contrôle l'étape), numéros cliquables.

**Étape 1 — « Informations générales »**
- Aide : « Titre, date, lieu et affiche : ce que le public voit en premier. L'affiche peut attendre, mais elle est
  demandée pour soumettre. »
- Champs actuels, mêmes règles. « Date de fin » : aide « Facultative. Sans date de fin, l'événement se termine 6 heures
  après son début. Pour une soirée qui passe minuit, indiquez la date du lendemain. » « Heure de fin » : « Facultative.
  Date de fin sans heure : l'événement se termine ce jour-là à 23:59. »
- **Ligne calculée sous les dates** (G-10), même règle que `lib/events/event-end.ts` :
  - sans date de fin : « Fin retenue : dim. 6 déc. 2026 à 02:00 (6 heures après le début, faute de date de fin). La
    vente s'arrête au plus tard à cette heure. » ;
  - date sans heure : « Fin retenue : dim. 6 déc. 2026 à 23:59 (date de fin sans heure). » ;
  - fin complète : « Fin : dim. 6 déc. 2026 à 04:00. »
- Le libellé « Catégorie de l'événement » prend le mot que le glossaire réserve aux catégories de billets, et la liste
  propose « Gastronomie & Tables » et « Salles & Réceptions », services fermés : renommer le champ « Type d'événement »
  et masquer les choix des services fermés (E-66).

**Étape 2 — « Programme »** : inchangée (« Facultatif. Les lignes vides sont ignorées et le programme est trié par
heure à l'enregistrement. »).

**Étape 3 — « Accès et informations pratiques »** : champs inchangés ; aide nouvelle « Facultatif. Tout se complète
plus tard ; après la validation, seul un changement d'adresse prévient les détenteurs de billets. »

**Étape 4 — « Billetterie »**
- Aide : « Au moins une catégorie pour soumettre. Chaque catégorie reçoit une couleur au contrôle : le contrôleur la
  voit en grand, avec le nom de la catégorie, quand il scanne le billet. »
- Une catégorie déjà ouverte à l'arrivée (« Catégorie 1 »).

| Champ | Oblig. | Défaut | Aide exacte | Contrôle |
|---|---|---|---|---|
| « Nom de la catégorie » | oui | vide | « Par exemple : Standard, VIP, Étudiant » | inchangé |
| « Prix (F CFA) » | oui | vide | « Montant entier : 0 pour une entrée gratuite, sinon 100 F CFA au moins. » (minimum lu au chargement) | 0 ou ≥ minimum, contrôlé au « Suivant » |
| « Quantité mise en vente » | oui | vide | inchangée | inchangé |
| « Couleur au contrôle » : 9 pastilles (« Aucune » + 8 couleurs, nom lu par le lecteur d'écran) | non | **automatique** | « Couleur au contrôle : Or » + « Choisie automatiquement ; touchez une autre pastille pour la changer. » | palette fermée |
| « Où vendre cette catégorie », « Maximum de billets par commande », dates de vente, « Détail affiché aux acheteurs », « Catégorie active » | — | inchangés | inchangées | inchangés |
| Bloc repliable **« Options d'entrée (facultatif) »** → « Consigne d'entrée » | non | replié (ouvert si une consigne existe) | « Par exemple : Remettre bracelet doré » ; « 60 caractères au plus. Affichée en gros au contrôleur quand le billet est validé à l'entrée. » | ≤ 60 caractères |

**Couleur automatique.** Ordre : **Turquoise, Or, Rose, Bleu nuit, Blanc, Violet, Argent, Noir** (palette existante,
`lib/scan/scan-result.ts:208`, réordonnée). « Standard » puis « VIP » reçoivent Turquoise puis Or sans deviner sur le
nom ; les quatre premières se distinguent même au soleil ; les paires qui se confondent (Blanc / Argent, Bleu nuit /
Violet / Noir) ne se rencontrent qu'à partir de 6 catégories. Chaque nouvelle catégorie prend la première couleur
qu'aucune autre catégorie de l'événement n'utilise (actives ou non) ; retirer une catégorie libère sa couleur.
Au-delà de 8 : « Aucune couleur » et l'aide « Les 8 couleurs sont prises : le contrôleur verra seulement le nom de
cette catégorie. » Couleur déjà prise choisie à la main : « Déjà utilisée par « VIP » : au contrôle, ces deux catégories
ne se distingueront que par leur nom. » Aucune couleur ajoutée après coup aux catégories existantes (les contrôleurs
déjà formés la connaissent).

**Étape 5 — « Entrées (facultatif) »**
- État initial : encadré **« Une seule entrée pour toutes les catégories : rien à régler. »** / « Tous vos contrôleurs
  scannent toutes les catégories. Ajoutez des zones seulement si une catégorie a un accès à part (carré VIP,
  backstage). Vous pourrez aussi le faire plus tard. » ; bouton **« Ajouter des zones »**.
- Ensuite : l'éditeur actuel (`components/partner/zones/ZonesEditor.tsx:255-361`) : zone « Entrée » (type « Entrée »,
  toutes les catégories cochées) avec une porte « Entrée » ; par zone « Nom de la zone », « Type » (« Entrée » /
  « Composte le billet : la personne entre. » ; « Contrôle de zone » / « Vérifie la catégorie sans composter. Un billet
  jamais composté est signalé « Pas encore entré ». »), « Catégories admises » (pastille et nom de couleur tirés de
  l'étape 4), « Portes » ; « Ajouter une zone », « Revenir à une seule entrée ». En création, pas de bouton
  « Enregistrer les zones » : elles partent avec l'événement ; en modification, la même étape garde « Enregistrer les
  zones ».
- Phrase de bas d'étape : « Vous donnerez une porte à chaque contrôleur après la validation, dans l'onglet Équipe du
  pilotage. »
- Boutons : « Précédent », « Vérifier avant d'envoyer ».

**Écran de fin — « Vérifier avant d'envoyer »** (non numéroté)
- Une section par étape, chacune avec « Modifier » : titre ; « sam. 5 déc. 2026 à 20:00 → dim. 6 déc. 2026 à 02:00
  (fin retenue : début + 6 h) » ; lieu ; affiche « Ajoutée » ou « Manquante » ; programme « {n} lignes » ; accès
  « Renseigné » ou « Rien de renseigné » ; une ligne par catégorie (nom · prix · quantité · pastille et couleur · canaux
  · consigne) ; entrées « Une seule entrée » ou « 2 zones : Entrée générale (portes Nord, Sud) ; Carré VIP (porte Carré
  VIP) ».
- Manques bloquants : encadré « Avant de soumettre » avec les textes de la base (« Ajoutez une affiche à
  l'événement. », « Ajoutez au moins une catégorie de billets active. », « La date de début est passée : changez-la
  avant de soumettre. »), chacun menant à son étape.
- Encadré **« Après la validation »** : « Vous recevrez un SMS. Vous pourrez alors publier l'événement et, dès ce
  moment, inviter vos contrôleurs (onglet Équipe), envoyer des invitations (onglet Invitations) et créer le code PIN
  de caisse si vous vendez au guichet (onglet Caisse). Ces actions préviennent des personnes ou créent des billets :
  elles attendent donc la validation. »
- « Pendant la vérification, l'événement ne se modifie pas : pour corriger, retirez-le de la validation. »
- Boutons : « Soumettre à la validation » (principal, enregistre puis soumet) et « Enregistrer le brouillon sans
  soumettre ». Toast : « Événement envoyé à la validation : vous serez prévenu par SMS de la décision. »

**Message de validation** (`EVENT_VALIDATED`, E-25) : cloche et email « « {titre} » est validé : vous pouvez le
publier depuis votre espace. Dès maintenant, même avant de publier : invitez vos contrôleurs (onglet Équipe), envoyez
vos invitations (onglet Invitations) et créez le code PIN de caisse si vous vendez au guichet (onglet Caisse). » ; push :
première phrase ; SMS inchangé (127 caractères, la liste ferait deux segments).

**Prix minimum (G-60, E-26).** `event_create` refuse le prix avec le champ `ticket_categories.{i}.price` (le
déclencheur reste comme filet) ; l'erreur se range sous « Prix (F CFA) » de la bonne catégorie, l'étape « Billets » se
rouvre, et le récapitulatif nomme la catégorie : « Catégorie « VIP » : Prix (F CFA) : Le prix d'un billet payant est
d'au moins 100 F CFA. Pour un billet gratuit, indiquez 0. » ; mieux, contrôle dès « Suivant » avec le minimum exposé en
lecture aux partenaires.

**Ce qui change côté serveur.** Couleur et consigne acceptées par le schéma de création et par `event_create` (sur le
modèle de `ticket_category_create`) : S à M. Zones avec l'événement : `event_create` reçoit les zones (catégories
désignées par leur rang) et applique la logique de `event_zones_save` dans la même transaction (M) ; repli moins cher,
non atomique : `PUT …/zones` juste après la création, et en cas d'échec « Brouillon enregistré, mais les zones ne l'ont
pas été : {motif}. Ouvrez l'étape Entrées pour les reprendre. » Soumission depuis le formulaire : transition
`EN_ATTENTE` après la création (S). **Effort total U3 : L (5 à 7 jours).**

### 4.3 Modifiable après validation : la règle et ce que l'écran doit dire

Aujourd'hui **rien ne repasse en validation** (`event_update` n'écrit jamais le statut). Effets réels :

| Élément | Détenteurs prévenus | Contrôleurs prévenus | Administration avertie | Verrou |
|---|---|---|---|---|
| Titre | oui, cloche et push sans SMS | non | oui | — |
| Dates, heures de début et de fin | oui (cloche, push ; SMS et email à 10 min, tout de suite si un début est à moins d'1 h) ; report de plus de 24 h → droit au remboursement | oui | oui | nouveau début futur ; fin de vente ≤ nouvelle fin |
| Lieu, ville, adresse précise | oui (idem) | oui | oui | — |
| Affiche | non | non | oui | — |
| Type d'événement | non | non | non | après la 1re vente |
| Jauge | non | non | non | ≥ vendus |
| Description, programme, position, téléphone, stationnement, accès, règles | non | non | non | — |
| Catégorie : ajout, prix, canaux | non | non | oui | prix verrouillé dès un billet émis |
| Catégorie : nom, quantité, maximum, dates de vente, détail, active | non | non | non | quantité ≥ vendus |
| Couleur au contrôle, consigne d'entrée, zones et portes | non | non | non | porte déjà utilisée figée |

Preuves : `M/20261109000009_lot9bis_messages.sql:656-679`, `:731-733`, `:1083-1180` ;
`M/20261110000006_lot9ter_equipe_messages.sql:30-34`, `:144-197`.

**Règle proposée.** Garder l'absence de nouvelle validation pour tout, et le dire. Ne rien envoyer aux acheteurs pour
ce que règlent les étapes 2, 4 et 5, et l'étape 3 hors adresse (c'est déjà le cas). **Ne pas étendre « sans prévenir »
à la date, aux heures, au lieu, à la ville ni à l'adresse** : ces messages évitent qu'un acheteur se présente au
mauvais endroit ou au mauvais jour, et le report de plus de 24 h ouvre un droit au remboursement qui suppose d'être
prévenu (point à confirmer, section 11).

**Encadré de modification** (remplace `EventForm.tsx:823-831`), titre « Modifier un événement validé » :
- « Rien ne repasse en validation : vos changements s'appliquent dès l'enregistrement. »
- « Sans prévenir personne : description, programme, informations pratiques sauf l'adresse, position, jauge, billets
  (quantités, dates de vente, couleur, consigne) et entrées. »
- « Les détenteurs de billets sont prévenus : date, heures, lieu, ville, adresse ; le titre, dans l'application
  seulement. »
- « L'équipe Event Village est informée, sans nouvelle validation : titre, affiche, lieu, date, nouvelle catégorie,
  prix, canaux de vente. »
- « Après la première vente : le type d'événement et le prix d'une catégorie ne changent plus ; la jauge ne descend
  pas sous les billets vendus. »

L'aide « Les détenteurs de billets seront prévenus de ce changement. » s'affiche dès Validé (pas seulement Publié et
Suspendu, `EventForm.tsx:94`) et aussi sous « Date de fin » et « Heure de fin ».

**Avant d'enregistrer un champ qui prévient** (G-18, E-28) : fenêtre « Prévenir les détenteurs de billets ? » —
« Changements envoyés : nouvelle date : dim. 6 déc. 2026 à 21:00. Ils reçoivent tout de suite une notification dans
l'application, puis un SMS dans 10 minutes ; vos corrections faites d'ici là partent dans le même SMS. » (variante :
« … puis un SMS tout de suite. » si l'ancien ou le nouveau début est à moins d'une heure ; phrase en plus pour un report
de plus de 24 h : « Report de plus de 24 h : les acheteurs pourront se faire rembourser en totalité, frais compris,
jusqu'au nouveau début. ») ; boutons « Enregistrer et prévenir » / « Revenir au formulaire ». Après l'enregistrement,
l'heure réelle d'envoi lue dans la réponse du serveur (« 12 SMS partiront à 21:10 » ou « 12 SMS sont partis »).

### 4.4 Décision U1 : les zones dans « Entrées » plutôt que dans « Équipe »

1. Les zones décrivent l'événement (quelles catégories entrent par où), comme la couleur et la consigne : elles se
   décident avec les billets, pas avec l'équipe.
2. Elles ne contactent personne et ne créent aucun billet : rien n'oblige à attendre la validation, et la base les
   accepte déjà en brouillon.
3. Elles doivent exister avant d'attribuer une porte : aujourd'hui l'ordre est inversé à l'écran (inviter d'abord,
   zones ensuite), et un contrôleur sans porte ne peut pas scanner un événement à zones (`ZonesEditor.tsx:222-230`).
4. L'étape facultative « Une seule entrée… rien à régler » rassure la petite soirée sans lui imposer un réglage.

L'onglet Équipe garde la porte de chaque contrôleur et « Peut changer de porte » (c'est une affectation de personne),
et un résumé « Zones : Entrée générale (2 portes), Carré VIP (1 porte). Modifier les zones ». **Homonyme à trancher** :
le pilotage a déjà un onglet « Entrées » (statistiques de scan, `app/partner/events/[id]/page.tsx:57`) ; proposition
minimale : ligne « Zones et portes : {résumé}. Modifier » en tête de cet onglet, à défaut renommer l'onglet du
pilotage « Passages » (section 11).

**Changements** : E-01 (P1) ; E-22 à E-28 (P2) ; E-77 à E-80 (P3).

---

## 5. Administration

### 5.1 « À faire aujourd'hui »

En tête de `/admin/dashboard`, à la place de « À traiter » ; la barre du bas « Accueil » y mène ; les « Indicateurs »
passent dessous, repliés sur téléphone. Titre « À faire aujourd'hui », sous-titre « {jeudi 13 novembre}, mis à jour à
{09:42}. » Une carte par ligne dont le compteur est supérieur à 0, dans l'ordre ci-dessous (l'argent attendu par des
personnes d'abord) ; les lignes à 0 sont regroupées sous « À jour » (une ligne chacune, coche verte, sans bouton :
« Versements à reprendre : aucun ») ; sur téléphone, une carte par rangée, compteur en grand, bouton pleine largeur.

| # | Ligne (texte exact) | Bouton → adresse | Permission | D'où vient le compteur |
|---|---|---|---|---|
| 1 | « {n} versement(s) à reprendre » — « Des clients ou des partenaires attendent cet argent depuis plus de 30 minutes. » ; si l'un est incertain : « Dont {k} à l'issue incertaine : vérifiez auprès de SamirPay avant toute action. » | « Traiter les versements » → `/admin/finance#versements-a-reprendre` | `refunds.manage` | existe : `cashouts_to_resume` (`app/api/admin/refunds/route.ts:203-209`) |
| 2 | « {n} événement(s) à valider » — « Le plus ancien attend depuis {2 jours}. » | « Examiner les événements » → `/admin/events?status=EN_ATTENTE` | `events.read` | existe (`counts.EN_ATTENTE`) ; ancienneté à ajouter |
| 3 | « {n} candidature(s) de partenaire » — « Dont {k} dossier(s) complété(s) après un refus. » | « Examiner les candidatures » → `/admin/dashboard?partenaires=EN_ATTENTE#partenaires` | `partners.read` | existe sous `statistics.read` : à déplacer ; `k` à ajouter |
| 4 | « {n} événement(s) suspendu(s) à décider » — « {a} dont la date est passée : clôturez-le(s) ou annulez-le(s). {b} à venir : réactivez-le(s) ou annulez-le(s). » | « Voir les événements suspendus » → `/admin/events?status=SUSPENDU` | `events.read` | total existant ; partage à ajouter |
| 5 | « {n} envoi(s) de messages en échec aujourd'hui » — « SMS, emails ou notifications qui ne sont pas partis. » | « Voir les envois en échec » → `/admin/notifications?status=FAILED` | `notifications.read` | existe : `admin_notifications_stats` |
| 6 | si l'alerte est atteinte : « SMS optionnels : {used} sur {cap} aujourd'hui » — « Au-delà de {cap}, rappels et annonces partent sans SMS. » ; « Demain, {planned} rappels SMS prévus pour {remaining} disponibles. » | « Voir la supervision » ; Superadmin : « Changer le plafond » → `/admin/finance-settings#notifications` | `notifications.read` | existe |
| 7 | « {n} partenaire(s) doivent de l'argent à Event Village » — « {montant} au total, repris sur leurs prochaines ventes. » | « Voir les créances » → `/admin/finance#creances` | `payments.read` | à créer (`finance_debts`) |
| 8 | si supérieur à 0 : « {n} paiement(s) avec un écart de montants » — « Le total payé ne correspond pas à la part du partenaire et aux frais. Signalez-le à l'équipe technique. » | « Voir les paiements en écart » → `/admin/finance?ecarts=1` | `payments.read` | à créer en comptage SQL |

- **Rien à faire** : « Rien à faire pour le moment » / « Aucun versement bloqué, aucun événement ni aucune candidature
  en attente. Cette page se met à jour toute seule. »
- **ADMIN sans la permission d'une ligne** : la ligne n'apparaît pas ; pied unique « Vous ne voyez que les files que
  vos droits vous ouvrent. » + « Voir mes droits » ; sans aucune : « Aucune file ne vous est ouverte pour l'instant.
  Demandez des droits au Superadmin. »
- Route `GET /api/admin/todo` : `{ visible, count, detail }` par ligne, chaque compteur lu seulement si la permission
  est là ; une panne de lecture d'une ligne donne « Compteur indisponible » sur cette ligne, jamais 0.
- Mise à jour : signaux en direct existants pour les soumissions et les candidatures, à étendre aux versements et aux
  échecs, sinon relecture toutes les 60 s.

### 5.2 Zéro code technique à l'écran : table des libellés

Déjà propre, à garder : statut d'un événement (`lib/events/event-status.ts:75-111`), boîte d'envoi
(`lib/notifications/outbox-labels.ts`), rôles et statuts de compte de `/admin/users` (`lib/labels/account.ts`),
libellés des permissions dans les refus (`lib/admin/permission-labels.ts`), libellés des réglages.

**Statuts de paiement** (`/admin/finance`, ancien `StatusBadge` de `components/ui/Badge.tsx:61-147`) :

| Code | Affiché | Proposé |
|---|---|---|
| `SUCCESS` | « PAYÉ » (filtre : « Confirmés ») | « Payé » (filtre et badge) |
| `PARTIAL` | « PARTIEL » | « Remboursé en partie » |
| `REFUND_PENDING` | **« REFUND_PENDING »** | « Remboursement en cours » |
| `REFUNDED` | « REMBOURSÉ » | « Remboursé » |
| inconnu | le code | « Statut inconnu » |

**Rôles**

| Code | Où | Affiché | Proposé |
|---|---|---|---|
| `SUPERADMIN` | menu (`AppLayout.tsx:82`), profil (`app/profile/page.tsx:51`), réglages (`finance-settings/page.tsx:284`, `:305`), connexion (`LoginForm.tsx:56`) | « Super administrateur », « Super-administrateur », « superadministrateur », « Superadministrateurs » (G-45) | « Superadmin » partout (glossaire) |
| `CLIENT`, `PARTENAIRE`… | `/admin/referral` (`page.tsx:319`) | « CLIENT », « PARTENAIRE » bruts (G-38) | `roleLabel()` |
| `PARTENAIRE` | audit, historique d'un événement | « Organisateur » | « Partenaire » (écran d'administration) |
| `SYSTEM` | journal (`audit/page.tsx:233`) | « SYSTEM » | « Automatique » |
| rôles à la création | `users/page.tsx:696-783` | « CONTRÔLEUR », « ADMINISTRATEUR », « SUPERADMIN », « CLIENT STANDARD » ; aides « Scanner de billets sur site (/scan) », « Accès maître absolu HQ », « Utilisateur public standard » | « Contrôleur », « Administrateur », « Superadmin », « Client » ; « Scanne les billets des événements où un partenaire l'affecte », « Agit selon les droits que vous lui donnez », « Tous les droits, dont les réglages et la création d'administrateurs », « Achète des billets, sans accès professionnel » |
| note du contrôleur | `users/page.tsx:795` | « Routage : Redirigé automatiquement vers le scanner de billets (/scan) dès sa connexion. » (faux, G-37) | « À sa connexion, il arrive sur son scanner. Il ne contrôle qu'après avoir été affecté à un événement par un partenaire. » |

**En-têtes et jargon**

| Où | Aujourd'hui | Proposé |
|---|---|---|
| `/admin/users` (`:333`, `:336`) | « Console Superadmin HQ », « Gestion des Utilisateurs & Permissions RBAC » | « Comptes et administrateurs » |
| `/admin/referral` (`:169`, `:171`) | « Console Superadmin HQ », « Gestion des Ambassadeurs & Parrainage » | « Parrainage et ambassadeurs » |
| création (`:361`, `:567-568`) | « Créer un Compte / Admin », « Créer un Compte Métier », « Attribution de rôle sécurisée et synchronisation instantanée » | « Créer un compte », « Le compte est actif tout de suite. » |
| droits (`:841-842`) | « Permissions Granulaires » | « Droits de {Prénom Nom} » |
| suppression (`:549`, `:935`) | « Anonymiser & Supprimer », « Compte Anonymisé & Banni » | « Supprimer définitivement », « Compte supprimé » |
| colonne Email (`:480`) | `<numéro>@eventvillage.sn` | « Aucun email » |
| parrainage (`:325`, `:356`) | « ⭐ Ambassadeur VIP », « Promouvoir Ambassadeur ⭐ », « Rétrograder », « N1 / N2 » | « Ambassadeur », « Nommer ambassadeur », « Retirer le statut d'ambassadeur », « filleuls directs / filleuls de vos filleuls » |
| erreurs « (erreur {status}) » (finance, réglages, campagnes, notifications, versements) | code HTTP à l'écran | « Le serveur n'a pas répondu comme prévu. Réessayez ; si cela continue, prévenez l'équipe technique. » |
| réglage hors bornes (`M/20261110000002_lot9ter_reglages.sql:138`) | « Valeur refusée pour finance.service_fee_rate : 60 » | « Frais de service : 60 % n'est pas admis. Choisissez entre 0 et 50 %. » (bornes vérifiées avant l'envoi) |
| alertes SMS | « minuit (UTC, heure de Dakar) » | « minuit, heure de Dakar » |
| détail d'une notification | « Origine : Envoi immédiat journalisé (code à usage unique ou invitation) » | « Origine : envoyé tout de suite (code reçu par SMS ou invitation d'un contrôleur) » |

**Journal d'audit** (`/admin/audit`, G-40) : action, objet et rôle bruts, titre « Audit Log #… • {ACTION} », blocs JSON
« Ancienne Valeur (Old Value) », filtres « STATUS_CHANGE (Changement Statut) » et « SEND_COMMUNICATION (Campagne) »
jamais écrits. Proposé : `lib/labels/audit.ts` avec repli « Autre action » (jamais le code), filtres par familles
(Comptes, Partenaires, Événements, Argent, Réglages et droits, Contrôle d'accès, Messages, Sécurité), détail en phrases
(« Frais de service : 5 % → 6 % »), JSON replié sous « Détail technique ». Libellés des actions écrites :

| Code | Libellé | Code | Libellé |
|---|---|---|---|
| `CREATE_USER` | Compte créé | `CASHOUT_RESENT` | Versement renvoyé |
| `UPDATE_USER` | Compte modifié (statut ambassadeur) | `CASHOUT_MARKED_PAID` | Versement marqué versé |
| `ROLES_SET` | Rôles du compte changés | `CASHOUT_NOT_SENT` | Versement constaté non versé |
| `USER_STATUS_SET` | Compte suspendu ou réactivé | `CASHOUT_UNCERTAIN` | Versement à l'issue incertaine |
| `ANONYMIZE_USER` | Compte supprimé (données effacées) | `CASHOUT_BATCH_PARTIAL` | Lot de versements incomplet |
| `ANONYMIZE_USER_CLEANUP_FAILED` | Suppression incomplète | `CASH_COLLECTED` | Espèces encaissées |
| `USER_SESSIONS_REVOKED` | Déconnexion de tous les appareils | `CASH_REFUND_MARKED` | Remboursement en espèces noté |
| `UPDATE_PERMISSIONS` | Droits d'un administrateur changés | `COUNTER_SALE` | Vente au guichet |
| `SUPERADMIN_BOOTSTRAP` | Premier Superadmin créé | `SHIFT_OPENED` / `SHIFT_CLOSED` | Caisse ouverte / clôturée |
| `UNAUTHORIZED_ACCESS_ATTEMPT` | Tentative d'accès refusée | `FINANCE_ALERT` | Alerte financière |
| `PARTNER_REGISTRATION` | Candidature de partenaire déposée | `ADMIN_FINANCE_DEBT` | Créance sur un compte |
| `PARTNER_DOSSIER_RESUBMITTED` | Dossier complété après refus | `REFERRAL_COMMISSION_DEFERRED` | Commission de parrainage reportée |
| `PARTNER_STATUS_SET` | Partenaire validé, refusé, suspendu ou réactivé | `CONTROLLER_INVITATION_CREATED` / `_ACCEPTED` / `_DECLINED` | Invitation de contrôleur envoyée / acceptée / refusée |
| `PARTNER_DOCUMENT_VIEWED` | Pièce d'un dossier consultée | `CONTROLLER_ASSIGNMENTS_UPDATED` | Affectations de contrôleurs changées |
| `EVENT_CREATED` / `EVENT_UPDATED` | Événement créé / modifié | `CONTROLLER_GATE_CHANGED` / `_SET` | Porte d'un contrôleur changée |
| `EVENT_LIVE_UPDATED` | Événement modifié en ligne | `CONTROLLER_CASH_PERMISSION_SET` | Droit d'encaisser changé |
| `EVENT_ZONES_UPDATED` | Zones et portes modifiées | `CONTROLLER_ACCOUNT_ACTIVATED` | Compte contrôleur activé |
| `CATEGORY_CREATED` / `_UPDATED` / `_DELETED` | Catégorie de billets ajoutée / modifiée / supprimée | `CONTROLLER_REMOVED` / `_REMOVED_ALL` / `_DELETED` | Contrôleur retiré / retiré de toute l'équipe / supprimé |
| `TICKET_INVITATIONS_SENT` | Invitations envoyées | `REGISSEUR_PIN_REGENERATED` | Code PIN du régisseur changé |
| `TICKET_INVITATION_CANCELLED` | Invitation annulée | `MANUAL_LOOKUP` | Billet recherché par son numéro |
| `TICKET_INVITATION_GUEST_NAMED` | Nom d'invité saisi | `GUEST_LIST_SEARCH` | Liste des invités consultée |
| `TICKET_CANCELLED` | Billet annulé | `SCAN_FORBIDDEN` | Scan refusé (droits) |
| `TICKET_REFUND_REQUESTED` | Remboursement d'un billet demandé | `NOTIFICATION_RETRY` | Envoi relancé |
| `ACCOUNT_PHONE_CHANGED` | Numéro changé | `SAVE_COMMUNICATION_DRAFT` | Brouillon de campagne enregistré |
| `ACCOUNT_EMAIL_VERIFIED` | Email vérifié | `UPDATE_SERVICE_STATUS` | Service activé ou désactivé |
| `ACCOUNT_PASSWORD_CHANGED` | Mot de passe changé | `UPDATE_PRICING` | Tarif modifié |
| `ACCOUNT_PROFILE_UPDATED` | Profil modifié | `ACCOUNT_AUTH_DESYNC` | Incohérence du compte de connexion |
| `FIRST_ACTIVATION` | Première activation du compte | | |

Objets : `users` « Compte », `partners` « Partenaire », `events` « Événement », `cashouts` « Versement », `payments`
« Paiement », `platform_settings` « Réglage », `admin_permissions` « Droits », `campaigns` « Campagne », autre « Autre ».

**Permissions** (actuel `lib/admin/permission-labels.ts:8-25` → proposé, avec la phrase de la grille et de « Mes droits ») :

| Code | Actuel | Proposé | Ce que ça ouvre | Dépend de |
|---|---|---|---|---|
| `users.read` | Consulter les comptes | Voir les comptes | « Liste et recherche des comptes. » | — |
| `users.write` | Gérer les comptes | Créer, suspendre ou supprimer des comptes | « Clients et contrôleurs ; jamais un administrateur ni un partenaire. » | `users.read` |
| `partners.read` | Consulter les partenaires et leurs contacts | Voir les candidatures et dossiers des partenaires | « Pièces d'identité, NINEA, contacts ; export des participants avec leurs numéros. » | — |
| `partners.validate` | Valider les partenaires | Valider, refuser ou réactiver un partenaire | « Le partenaire est prévenu par SMS. » | `partners.read` |
| `partners.suspend` | Suspendre les partenaires | Suspendre un partenaire | « Ses événements en ligne sont suspendus ; il ne peut plus vendre ni retirer. » | `partners.read` |
| `events.read` | Consulter les événements | Voir les événements | « Fiches, pilotage, équipes et caisses, catalogues. » | — |
| `events.write` | Gérer les événements | Valider, publier, suspendre, clore ou annuler un événement | « Gérer aussi l'équipe de contrôle d'un événement. » | `events.read` |
| `payments.read` | Consulter les paiements | Voir la finance | « Ce que gagne Event Village, ce qui est dû, les paiements. » | — |
| `refunds.manage` | Gérer les remboursements | Traiter les versements à reprendre | « Renvoyer ou marquer versé un remboursement ou un retrait ; rembourser un billet. » | — |
| `referrals.manage` | Gérer le parrainage | Voir les taux du parrainage | « Lecture seule : les taux ne se modifient pas encore. » | — |
| `communications.manage` | Gérer les communications | Préparer des campagnes | « Brouillons seulement : l'envoi n'est pas encore ouvert. » | — |
| `statistics.read` | Consulter les statistiques | Voir les indicateurs | « Chiffres de l'accueil : volume, revenu, nombre de comptes. » | — |
| `notifications.read` | Consulter les envois de messages | Voir les envois de SMS, emails et notifications | « Et recevoir les alertes de SMS. » | — |
| `notifications.write` | Relancer les envois de messages | Relancer un envoi en échec | — | `notifications.read` |
| `pricing.manage` | Gérer les tarifs | masquée | aucun écran ; la route touche aux interrupteurs (G-01, G-42) | — |
| `shifts.read` | Consulter les écarts de caisse | masquée | aucun écran (G-42) | — |

### 5.3 Chaque action importante dit sa conséquence avant confirmation

Règle commune : (1) ce qui change, en une phrase ; (2) « Prévenu(s) : » avec le canal de chacun ; (3) ce qui est
bloqué ; (4) ce que le SMS garde du motif s'il le coupe. Les nombres se calculent avant l'ouverture.

| Action | Confirmation actuelle | Problème | Confirmation proposée |
|---|---|---|---|
| Valider une candidature (`dashboard/page.tsx:870-874`) | « « {raison sociale} » pourra créer des événements et vendre des billets. Le responsable est prévenu par SMS. » | juste, incomplet | « « {nom} » pourra créer des événements ; chacun passera encore par votre validation avant d'être publié. Prévenu : {Prénom Nom}, par SMS et notification (et email s'il en a un vérifié). » |
| Refuser une candidature (`:884-887`) | « … sera prévenu par SMS avec votre motif. » | SMS coupé à 60 caractères (G-39) ; second refus annoncé comme reprenable (G-16) | « Prévenu : {Prénom Nom}, par SMS (les 60 premiers caractères du motif), notification et email (motif entier). Il pourra compléter son dossier une seule fois. » ; second refus : « Ce dossier a déjà été complété une fois : ce refus est définitif. » ; aide « Mettez l'essentiel au début : le SMS n'en garde que 60. » |
| Valider un événement (`events/[id]/page.tsx:186-187`) | « L'organisateur est prévenu et pourra publier l'événement. La fiche ne repasse pas en validation. » | canal absent ; « organisateur » | « Prévenu : {partenaire}, par SMS et notification. L'événement reste invisible du public tant que le partenaire ne l'a pas publié. S'il le modifie ensuite, vous en êtes averti, sans nouvelle validation. » |
| Refuser un événement (`:193-194`) | « L'événement revient en brouillon chez l'organisateur, qui voit votre motif… » | SMS coupé à 40 caractères | « L'événement revient en brouillon. Prévenu : {partenaire}, par SMS (les 40 premiers caractères du motif), notification et email (motif entier). » |
| Suspendre un événement (`:200-201`) | « … L'organisateur et les détenteurs de billets sont prévenus ; seul l'organisateur voit le motif. » | faux pour les détenteurs (N-08) ; gel et QR non dits | « La vente et le contrôle des entrées s'arrêtent tout de suite ; le QR des billets disparaît. L'argent de cet événement déjà disponible pour le partenaire est gelé. Prévenus : {partenaire} par SMS et notification, avec votre motif (40 premiers caractères dans le SMS) ; les contrôleurs par notification ; les {n} détenteurs par notification et email seulement, sans SMS ni motif, et seulement s'ils acceptent les actualités des événements. » |
| Réactiver un événement (`:208-209`) | « … L'organisateur et les détenteurs de billets sont prévenus. » | canaux absents ; rappels perdus pendant la suspension | « La page publique, la vente et le contrôle reprennent ; l'argent gelé redevient retirable. Prévenus : {partenaire} par SMS ; les détenteurs par notification et email, sans SMS. Les rappels qui devaient partir pendant la suspension ne partiront pas. » |
| Clore un suspendu (`:219-225`, `:791-795` ; `admin-cloture-motif`) | titre « Terminer l'événement ? », bouton « Clore l'événement » | deux mots (G-61) ; SMS aux détenteurs non dit ; contrôle **rouvert** (G-20) ; fiche publique « a eu lieu » (G-19) | titre « Clore l'événement ? » : « L'événement passe « Terminé », sans annulation : personne n'est remboursé automatiquement. Prévenus par SMS et notification : {partenaire} (avec votre motif) et les {n} détenteurs (« clos sans remboursement automatique »). Attention : pendant 6 h après la fin prévue, les billets redeviennent scannables. Si les participants doivent être remboursés, choisissez plutôt « Annuler l'événement ». » |
| Terminer un publié | même texte | proposé avant le début puis refusé (G-59) | bouton masqué avant le début ; « La vente s'arrête. Les entrées restent contrôlables pendant 6 h. Prévenu : {partenaire}. Les détenteurs ne sont pas prévenus. » |
| Annuler un événement (`EventCancelDialog.tsx:156-217`) | impact chiffré, titre à retaper | bon ; canaux absents | ajouter « Prévenus par SMS : les détenteurs, les acheteurs, les contrôleurs et {partenaire} (avec l'avis public, jamais le motif interne). » |
| Suspendre un compte (`users/page.tsx:916`) | « … ne pourra plus se connecter : ses sessions sont fermées. Ses billets payés restent valables à l'entrée. Il est prévenu avec votre motif. » | motif coupé à 35 caractères ; billet hors ligne effacé (G-05) ; scanner perdu non dit | « {p} {n} est déconnecté de tous ses appareils et ne pourra plus se connecter. Prévenu : par SMS (les 35 premiers caractères du motif), notification et email s'il en a un vérifié. Ses billets payés restent valables : à l'entrée, il donne le numéro du billet et une pièce d'identité. » ; contrôleur : « Il ne peut plus scanner pour aucun événement. » |
| Réactiver un compte (`:915`, `:919`) | « Il est prévenu avec votre motif. » | **faux** (G-06) | « {p} {n} pourra de nouveau se connecter. Prévenu : par SMS « compte réactivé », sans votre motif. » ; aide « Gardé au journal ; la personne ne le voit pas. » (ou motif transmis, E-44) |
| Supprimer un compte (`:933-935`) | « Attention : Cette action va anonymiser définitivement cet utilisateur (conformité RGPD)… il sera banni… » | jargon ; personne non prévenue ; proposé sur un partenaire (G-02) | « Supprimer définitivement {Prénom Nom} ? » / « Nom, téléphone et email sont effacés pour toujours ; ce compte ne pourra plus jamais se connecter. Ses paiements et billets restent dans l'historique. La personne n'est pas prévenue. Pour confirmer, tapez SUPPRIMER. » ; masqué sur un partenaire |
| Suspendre un partenaire (`PartnerStatusDialog.tsx:57-62`) | « … ses événements en ligne sont suspendus et ses fonds sont gelés… Il est prévenu avec votre motif. » | autres personnes touchées non dites ; motif coupé à 60 | « « {nom} » est déconnecté et ne peut plus vendre ni retirer d'argent. Ses {n} événements en ligne sont suspendus : leurs détenteurs reçoivent une notification et un email (sans SMS), ses contrôleurs ne peuvent plus scanner. Prévenu : {nom}, par SMS (60 premiers caractères du motif), notification et email. » |
| Réactiver un partenaire (`:64-69`) | aide « Ce motif est communiqué au partenaire » | faux (G-06) | garder le texte, ajouter « Prévenu : {nom}, par SMS « compte réactivé », sans votre motif. » |
| Créer un ADMIN (`users/page.tsx:828`) | aucune confirmation ; « … a été créé avec succès. » | sans droits, sans message, sans le dire | « Compte créé. {p} n'a encore aucun droit et n'a reçu aucun message : donnez-lui son mot de passe vous-même. Choisissez maintenant ses droits. » → grille |
| Changer les droits (`:878-897`) | aucun texte | effet et absence d'avis non dits | « Effet immédiat sur le serveur ; {p} voit ses nouveaux écrans en rechargeant la page. Il n'est pas prévenu. Il recevra désormais les alertes liées à ces droits. » |
| Renvoyer un versement (`RefundsToRetry.tsx:396-397`) | « Le versement repart vers ce bénéficiaire dès votre confirmation. » | ni canal ni solde | « {montant} part vers le {Wave} {77 ••• •• 34} de {Fatou D.}. Solde SamirPay actuel : {solde}. Quand SamirPay confirme, {Fatou} reçoit un SMS « … versé ». » |
| Marquer versé (`:397`) | « Vérifiez auprès du support SamirPay… Il sera confirmé sans nouvel envoi. » | SMS « versé » immédiat non dit | ajouter « Prévenu tout de suite : {Fatou}, par SMS « … versé ». Si l'argent n'est pas réellement parti, elle croira avoir été payée : ne le faites qu'avec la référence SamirPay sous les yeux. » |
| Constater non versé (`:393-396` ; `admin-versements-constater-non-verse`) | « … Rien ne repart automatiquement. » | messages envoyés non dits, et faux (G-28) | corriger les messages (E-33), puis ajouter « Prévenus : pour un retrait, le partenaire par SMS « votre retrait n'a pas été versé, le montant est revenu sur votre solde » ; pour un remboursement, l'acheteur par SMS « remboursement retardé » s'il ne l'a pas déjà reçu. » |
| Changer un réglage (`finance-settings/page.tsx:421`) | aucune confirmation | ni avant → après, ni risque | « {Libellé} : {5 %} → {6 %}. S'applique aux opérations faites à partir de maintenant ; le passé ne change pas. Personne n'est prévenu. » + alerte de valeur risquée (5.6) ; « Confirmer le changement » |
| Nommer ou retirer ambassadeur (`referral/page.tsx:346-357`) | aucune confirmation (G-38) | un clic change les taux | « Nommer {p} ambassadeur ? Ses futurs filleuls rapporteront le taux ambassadeur ({N1} / {N2}). Il n'est pas prévenu. » ; bouton masqué à l'ADMIN |

### 5.4 Finance : trois questions, trois chiffres

En tête de `/admin/finance`, au-dessus de tout (trois cartes empilées sur téléphone). Fonction SQL
`finance_admin_summary(p_from, p_to)` à créer (SECURITY DEFINER, service_role seulement, sur le modèle de
`finance_platform_revenue`, `M/20261101000008_lot3_rapports.sql:77-97`), plus la lecture du solde SamirPay
(`lib/samirpay/http-client.ts:290-299`).

| Carte | Intitulé | Phrase sous le chiffre | Période |
|---|---|---|---|
| 1 | **Gagné par Event Village** | « Frais de service et de retrait, moins les frais SamirPay et les commissions de parrainage, remboursements déduits. » | la période choisie |
| 2 | **Dû aux partenaires** | « Ventes encore à verser aux partenaires, disponibles ou non. Dont {x} retirables aujourd'hui. » | à l'instant |
| 3 | **Retirable par Event Village** | « Ce que vous pouvez sortir du compte SamirPay sans manquer d'argent pour les partenaires, les parrains et les remboursements. » | à l'instant |

**Formules**

```
Gagné (période) =
    Σ paiements Event Village (SUCCESS, PARTIAL, REFUNDED, REFUND_PENDING ; COALESCE(paid_at, created_at) dans la période)
        de (net_event_village_revenue − refunded_net_revenue)
  − Σ commissions de parrainage (≠ CANCELLED) de ces paiements
  + Σ withdrawals.fee_amount des retraits versés (date de confirmation du versement)            -- G-90
  − Σ cashouts.samirpay_fees réels des versements confirmés de la période (hors simulation)
  + Σ frais SamirPay de remboursement refacturés au partenaire (écritures REGULARISATION)

Dû aux partenaires (instant) =
    Σ finance_ledger.amount (account_kind = 'ORGANISATEUR')
  + Σ withdrawals.net_amount (ORGANISATEUR, PENDING ou PROCESSING)
  sous-lignes : retirable aujourd'hui (Σ withdrawable de finance_account_balance) ; en attente de la fin des
  événements (available_at > now()) ; gelé ; retraits en cours d'envoi
  dessous : « Dû aux parrains » (même formule, PARRAINAGE) ; « Remboursements à verser aux acheteurs »
  (versements de remboursement A_ENVOYER, ENVOYE, INCERTAIN, et ECHOUE à renvoyer)

Retirable par Event Village (instant) =
    max(0, solde SamirPay − dû aux partenaires − dû aux parrains − remboursements à verser − réserve)
  réserve = (ces trois montants) × taux de frais de versement constaté sur 90 jours
            (finance.withdrawal_fee_rate tant qu'aucun frais réel n'est connu)
```

- Solde illisible : « Solde SamirPay illisible pour le moment : ne retirez rien avant qu'il s'affiche. » Résultat
  négatif : « 0 F CFA » et bandeau rouge « Le compte SamirPay ne couvre pas tout ce qui est dû ({écart} F CFA
  manquants). Ne retirez rien : des versements risquent de se bloquer. » Mode d'essai : « Mode d'essai : chiffre sans
  valeur réelle. »
- Créances à part, « À récupérer sur les partenaires (créances) : {x} », non soustraites ; bloc `#creances`,
  destination de l'alerte `ADMIN_FINANCE_DEBT` (N-14).
- NON VÉRIFIÉ : le solde SamirPay compte-t-il un encaissement dès sa confirmation, ou après un délai de règlement ?
  Dans le second cas, ajouter une ligne « En cours de règlement chez SamirPay ».

**Période commune (G-85).** Un seul sélecteur en haut, sous les trois cartes : « Aujourd'hui », « 7 derniers jours »,
« Ce mois-ci », « Mois dernier », « Depuis le début », avec « La période s'applique au premier chiffre et au détail ;
les deux autres sont à l'instant. » Une date par nature d'opération (paiement : `COALESCE(paid_at, created_at)` ;
remboursement, retrait, frais de versement : `cashouts.confirmed_at`), bornes calculées en heure de Dakar côté
serveur ; le filtre de statut ne touche plus que le tableau « Paiements ».

**Corrections.** G-25 : « Reversements partenaires » devient « Part des partenaires sur ces ventes, remboursements
déduits » (paiement de 23 625 F CFA entièrement remboursé → 0 F CFA, aujourd'hui 22 500 F CFA) ; même chose pour
« Frais de service perçus ». G-86 : « Frais estimés » sur les seuls retraits, les remboursements ont leur ligne de frais
réels. G-90 : « Frais de retrait perçus » (retrait de 22 500 F CFA versé → 225 F CFA), compris dans « Gagné ». Accueil :
« Revenu net de la plateforme » (`dashboard/page.tsx:567-574`, aide fausse « Commissions et frais Event Village »)
devient « Gagné par Event Village, ce mois-ci », même fonction. Plus bas, dans cet ordre : « Versements à reprendre »
(ancre, solde SamirPay en tête), « Créances », « Détail de ce qui a été gagné », « Frais SamirPay », « Paiements »
paginés par 20 (aujourd'hui tous les paiements sont lus et empilés sur téléphone, `admin.service.ts:131`).

### 5.5 Ce qu'un ADMIN peut faire : menu selon ses droits et « Mes droits »

Aujourd'hui le menu ne lit que les rôles (`components/layout/AppLayout.tsx:186-242`) : un ADMIN sans aucune
permission voit « Tableau de bord », « Événements », « Utilisateurs », « Catalogues et services », « Finance »,
« Tarification », « Parrainage », « Communications », « Notifications », « Scanner ». Chaque écran refuse à sa façon
(« Vérifiez votre connexion », état d'erreur avec un « Réessayer » inutile, « Accès refusé », « Aucun utilisateur
trouvé. »), et les boutons disparaissent sans phrase.

**Proposé.**

| Entrée | Visible si |
|---|---|
| Accueil (À faire aujourd'hui) | toujours |
| Événements, Catalogues et services | `events.read` |
| Comptes | `users.read` |
| Finance | `payments.read` ou `refunds.manage` |
| Parrainage | `users.read` ou `referrals.manage` |
| Campagnes | `communications.manage` |
| Notifications | `notifications.read` |
| Réglages de la plateforme | toujours (« Lecture seule » pour l'ADMIN) |
| Journal d'audit | Superadmin |
| Mes droits | ADMIN |
| Scanner | retiré (G-08), sauf rôle contrôleur |

- La barre du bas suit le même filtre ; sa dernière case devient « Plus », qui ouvre le menu.
- Page « Mes droits » (`/admin/mes-droits`) : « Voici ce que votre compte peut faire. Pour un droit de plus, demandez-le
  au Superadmin. » ; « Vous pouvez » (chaque droit et sa phrase) ; « Vous ne pouvez pas » (en gris). Un écran en
  lecture seule porte un bandeau qui y mène ; un refus nomme la permission : « Votre compte n'a pas la permission
  « Voir les indicateurs ». »
- Grille du Superadmin : groupée par thème, une phrase sous chaque droit, dépendances cochées d'office, quatre profils
  prêts à cocher (« Modération » : événements et partenaires ; « Finance » : paiements et versements ; « Support » :
  comptes et envois ; « Lecture seule »), `pricing.manage` et `shifts.read` masqués ; grille vidée et « Chargement… »
  avant la lecture, « Droits illisibles : fermez et rouvrez. » et « Enregistrer » grisé en cas d'échec (N-07).
- Création d'un ADMIN enchaînée sur ses droits dans la même fenêtre (« Créer », puis « Choisir ses droits »).

### 5.6 Réglages de la plateforme trouvables, expliqués, risques signalés

- **Entrée de menu** « Réglages de la plateforme » (section « Système »), pour tout administrateur, « Lecture seule »
  pour l'ADMIN ; suppression de « Tarification » et de `/admin/pricing`, simple renvoi (G-43, glossaire) ; sommaire et
  ancres (`#finance`, `#controle`, `#notifications`, `#services`), champ « Chercher un réglage » ; auteur affiché dans
  l'historique ; retour « Administration » vers `/admin/dashboard`.
- **Verrou des services (P1, E-08)** : section « Fonctionnalités » renommée « Services en préparation » ; chaque
  interrupteur porte « Pas prêt pour la mise en ligne : ne l'activez pas sans l'accord de l'équipe technique. » ;
  l'activer demande de taper ACTIVER.

| Réglage | Explication proposée (une phrase et un exemple) | Valeur risquée |
|---|---|---|
| Frais de service | « Ce que l'acheteur paie en plus du prix, pour Event Village. Ex. : à 5 %, un billet de 5 000 F CFA coûte 5 250 F CFA. » | sous le taux SamirPay (1,5 %) : chaque vente coûte de l'argent ; au-delà de 10 % : prix ressenti comme abusif |
| Durée de garde des places pendant un paiement | « Temps pendant lequel les places restent réservées pendant que l'acheteur paie. Ex. : 10 min ; payé à la 12e minute, il a ses billets s'il reste des places, sinon il est remboursé. » | 5 : acheteurs lents remboursés ; 60 : un concert complet bloqué une heure par des paniers abandonnés |
| Prix minimum d'un billet payant | « Prix le plus bas d'un billet payant ; un billet gratuit reste à 0. Ex. : à 100 F CFA, on ne peut pas vendre à 50 F CFA. » | sous le minimum d'encaissement SamirPay : paiements refusés |
| Frais agrégateur Wave, Orange Money | « Ce que SamirPay prend sur un paiement, d'après votre contrat. Sert seulement à calculer ce que gagne Event Village ; l'acheteur ne paie pas plus. » | différent du contrat : « Gagné » faux |
| Frais agrégateur d'une annulation | « Quand un billet payé est remboursé (remboursement d'un billet ou annulation), qui perd les frais SamirPay déjà payés : Event Village ou le partenaire. » (G-91) | « Organisateur » : le solde du partenaire baisse à chaque remboursement et peut devenir une créance |
| Délai de garde des ventes | « Activé : l'argent d'une vente n'est retirable qu'après la fin de l'événement. Désactivé : dès le paiement. » | **désactivé** : un partenaire retire avant l'événement ; s'il est annulé, Event Village rembourse sans pouvoir reprendre l'argent |
| Délai après la fin de l'événement | « Heures d'attente après la fin avant que l'argent soit retirable. Ex. : 48 h, un événement fini samedi 23 h est retirable lundi 23 h. » | 0 : plus de marge pour une réclamation |
| Frais de retrait | « Ce que le partenaire laisse à Event Village à chaque retrait. Ex. : à 1 %, un retrait de 50 000 F CFA verse 49 500 F CFA. » | sous les frais SamirPay constatés (avertissement existant) |
| Montant minimum de retrait | « Plus petit retrait qu'un partenaire ou un parrain peut demander. Ex. : 5 000 F CFA. » | 0 : multitude de petits retraits payés à SamirPay |
| Retraits par virement bancaire | « Propose le virement bancaire en plus de Wave et Orange Money. » | **activé** : aucun circuit n'existe ; ne pas activer |
| Délai de validation des commissions | « Jours avant qu'une commission de parrainage devienne retirable. Ex. : 7 jours après la fin de l'événement. » | faible |
| Ouverture du contrôle avant le début | « Heures avant le début à partir desquelles les billets sont scannables. Ex. : 6 h, pour un concert à 20 h, dès 14 h. » | 0 : le public ne peut pas entrer avant l'heure |
| Fermeture du contrôle après la fin | « Heures après la fin pendant lesquelles les billets restent scannables. Ex. : 6 h. » | 0 : un événement qui déborde ne contrôle plus ; vaut aussi pour un événement clos (G-20) |
| Saisie manuelle d'un numéro de billet | « Qui peut faire entrer quelqu'un en tapant le numéro de son billet, après avoir vu sa pièce d'identité. » | portée large : plus de personnes valident un billet sans QR |
| Vente au guichet en espèces | « Permet aux contrôleurs autorisés de vendre des billets en espèces sur place, au prix facial. » | **désactivé pendant un événement** : le guichet s'arrête à toutes les portes |
| Seuil « bientôt complet » | voir U2 (section 6.4) : devient « Plafond « Dernières places » » | faible |
| Alerte de refus à une porte : nombre, durée | « Nombre de billets refusés à une même porte, pendant la durée observée, qui déclenche une alerte au partenaire. Ex. : 10 refus en 5 minutes. » (G-74 : compléter la liste des refus comptés) | 3 : alertes sans cesse ; 500 : jamais |
| Rappel la veille, heure | « Envoie la veille un rappel à chaque détenteur de billet. Ex. : 10 h. » | désactivé : plus de rappel |
| Rappel avant le début, heures | « Rappel quelques heures avant le début, avec le conseil d'ouvrir son billet avant d'arriver. Ex. : 3 h. » | avec la plage sans SMS, un début entre 1 h et 10 h 59 n'a jamais de SMS (G-95, corrigé par D2) |
| SMS des rappels (veille, avant le début) | « Envoyer aussi ce rappel par SMS : toujours, seulement à qui n'a pas reçu la notification push, ou jamais. » | « Toujours » : un SMS facturé par détenteur et par événement |
| Début et fin de la plage sans SMS | « Heures de Dakar pendant lesquelles aucun SMS optionnel ne part. Ils partent à la fin de la plage s'ils sont encore utiles. Ex. : de 22 h à 8 h. » (avec D2 ; aujourd'hui ils sont perdus) | plage longue : rappels tardifs |
| Plafond quotidien des SMS optionnels | « Nombre maximal de SMS optionnels (rappels, annonces) par jour ; au-delà, ils partent sans SMS. Les SMS indispensables n'y sont pas comptés. Ex. : 700. » (G-14) | 0 : plus aucun rappel par SMS |
| Seuil d'alerte des SMS indispensables | « Nombre de SMS indispensables du jour au-delà duquel vous êtes alerté. Ils n'ont pas de plafond global, mais chaque numéro en reçoit au plus 30 par jour. Ex. : 2 000. » (G-14) | très haut : aucune alerte en cas d'emballement |
| SMS des rappels pour les billets gratuits | « Envoyer aussi les rappels par SMS à qui n'a que des billets gratuits ou des invitations. » | un événement gratuit de 2 000 inscrits coûte 2 000 SMS par rappel |
| Salles de fête, Réservation de tables, Commandes de repas | « Ouvre … aux clients et aux partenaires. » | **activé** : module pas prêt (G-44, guide 14) ; verrou |

### 5.7 Sur téléphone

Avec capture : la file de validation, la fiche d'un événement, les boîtes à motif, les versements à reprendre et la
supervision se lisent et s'actionnent bien (cibles de 44 px, textes de 16 px). Le bloc « Versements à reprendre »
n'est atteint qu'après environ 13 hauteurs de carte.

Sans capture, jugé sur le code : `/admin/users`, `/admin/audit` et `/admin/referral` ne sont pas sur le système de
design (boutons de filtre d'environ 28 px, textes de 10 à 12 px, tableau de 7 colonnes en défilement horizontal pour
l'audit, aucune pagination sur `/admin/users` qui empile jusqu'à un millier de cartes, recherche relancée à chaque
frappe) ; `/admin/finance` a ses filtres en bas et sa liste non paginée. Proposé : passer ces trois écrans sur
`PageHeader`, `DataList`, `Tabs`, `Field`, `Badge`, pagination par 20, recherche après 300 ms, et les ajouter au
script de captures (E-37).

### 5.8 Aide « ? » sur les écrans sensibles

Bouton « ? » de 44 px à droite du titre, qui ouvre « Comment lire cette page » (feuille du bas sur téléphone, texte de
16 px, « Fermer »).

- **Finance** — « **Gagné par Event Village** : ce qui reste à Event Village sur la période, une fois payés SamirPay et
  les parrains, remboursements déduits. Les frais SamirPay des paiements sont estimés avec les taux des Réglages ;
  ceux des versements sont les vrais. **Dû aux partenaires** : l'argent des ventes qui appartient aux partenaires,
  qu'ils puissent déjà le retirer ou qu'ils attendent la fin de leurs événements. Il est sur votre compte SamirPay
  mais n'est pas à vous. **Retirable par Event Village** : ce que vous pouvez sortir de SamirPay aujourd'hui sans
  empêcher un partenaire, un parrain ou un acheteur d'être payé. Si ce chiffre est à 0, ne retirez rien. La période
  choisie ne change que le premier chiffre ; les deux autres sont calculés à l'instant. »
- **Versements à reprendre** — « Un versement est de l'argent qu'Event Village envoie : un remboursement à un
  acheteur, ou un retrait à un partenaire ou à un parrain. Il apparaît ici quand il n'est pas parti depuis 30 minutes.
  **Renvoyer** : essaie de nouveau ; si SamirPay a peut-être déjà payé, il vérifie d'abord, pour ne jamais payer deux
  fois. **Marquer versé** : seulement si le support SamirPay vous a confirmé le paiement ; la personne reçoit aussitôt
  un SMS « versé ». **Issue incertaine** : n'agissez pas avant d'avoir appelé le support SamirPay. Un versement
  « Bloqué : solde insuffisant » repart seul quand votre compte SamirPay est approvisionné. »
- **Réglages de la plateforme** — « Chaque changement vaut pour les opérations suivantes ; le passé ne change jamais.
  Exemple : passer les frais de service de 5 à 6 % ne touche pas les billets déjà vendus. Le motif que vous écrivez
  reste dans l'historique, avec votre nom. Les réglages marqués « Valeur risquée » peuvent coûter de l'argent ou
  arrêter un service pendant un événement : en cas de doute, demandez à l'équipe technique. « Services en
  préparation » : ne les activez pas avant qu'on vous dise qu'ils sont prêts. »
- **Droits d'un administrateur** — « Un administrateur ne fait que ce que vous cochez. Un nouvel administrateur n'a
  aucun droit. « Voir » permet de lire ; les autres droits permettent d'agir. Cocher un droit d'action coche aussi le
  droit de voir qui va avec. L'effet est immédiat ; la personne voit ses nouveaux écrans en rechargeant la page. Elle
  n'est pas prévenue. Seul un Superadmin crée un administrateur, change ses droits et modifie les réglages. »
- **Suspendre** (compte, partenaire, événement) — « Suspendre arrête tout de suite, et peut être annulé par
  « Réactiver ». Un compte suspendu ne peut plus se connecter ; ses billets payés restent valables à l'entrée. Un
  partenaire suspendu ne vend plus et ne retire plus ; ses événements en ligne sont suspendus. Un événement suspendu
  n'est plus vendu ni contrôlé ; l'argent déjà disponible pour le partenaire est gelé. La personne concernée reçoit un
  SMS avec le début de votre motif : écrivez l'essentiel en premier. Pour rembourser les participants, il faut
  annuler l'événement, pas le suspendre. »

**Changements** : E-06, E-07, E-08, E-12 (P1) ; E-29 à E-39 (P2) ; E-71 à E-74 (P3).

---

## 6. Décisions D1, D2, D3, U2, U4, A2 prêtes à coder

Mécanismes existants réutilisés : regroupement par ligne en attente reprise `FOR UPDATE` (`notif_tickets_scanned`,
`M/20261109000009_lot9bis_messages.sql:1561-1593`) ; destinataires administrateurs selon une permission
(`notif_admin_recipients`, `M/20261103000002_lot6_outbox.sql:402-423`) ; revérification à l'envoi avec les issues
`SKIP`, `CANCEL`, `WAIT` (`notification_outbox_claim`, dernière définition `M/20261109000010_lot9bis_email.sql:276-640`) ;
plage sans SMS (`notif_in_quiet_hours`, `notif.sms_quiet_start` / `_end`) ; contrôle quotidien appelé à chaque passage
de l'envoyeur (`notification_daily_checks`, `M/20261109000009_lot9bis_messages.sql:1243-1370`) ; préférence par sujet
et par canal (`notif_preference_enabled`, sujet `PRO_ACTIVITY`) ; partage `wa.me` (`components/tickets/TicketCard.tsx:350-354`).

### 6.1 D1 — SMS aux administrateurs pour ce qui attend leur action

**Comportement.** Quand un événement est soumis, qu'une partenaire s'inscrit ou complète son dossier, chaque
administrateur qui peut **agir** reçoit, en plus de la cloche, du push et de l'email actuels, **un SMS au plus toutes
les 30 minutes**, qui dit combien d'éléments attendent sa validation **au moment de l'envoi**. Jamais entre 22 h et
8 h : ce qui arrive la nuit part à 8 h.

- **Qui** : compte actif Superadmin, ou ADMIN avec `events.write` (événements) ou `partners.validate` (candidatures).
  Un ADMIN qui n'a que la lecture garde la cloche, sans SMS.
- **Regroupement** : une seule ligne SMS en attente par administrateur (type nouveau `ADMIN_TODO_SMS`) ; un nouvel
  élément s'ajoute à la ligne existante, sinon une ligne est créée avec `due_at = max(maintenant, dernier SMS
  ADMIN_TODO_SMS envoyé à cet administrateur + 30 min)`, repoussée à 8 h si elle tombe dans la plage sans SMS.
- **Contenu calculé à l'envoi** : nombre d'événements en attente (s'il a `events.write`) et de candidatures en attente
  (s'il a `partners.validate`).
- **Indispensable** (pas d'interrupteur) : seuls ceux qui ont le droit d'agir le reçoivent ; hors plafond global,
  limite de 30 par numéro et par jour (au plus 28 SMS D1 possibles entre 8 h et 22 h).

| Cas à l'envoi | SMS | Caractères (exemple / pire), GSM-7, 1 segment |
|---|---|---|
| 1 événement | « Event Village : l'événement {titre≤30} de {organisateur≤20} attend votre validation : {URL}/admin/events » | 128 / 148 |
| 1 candidature | « Event Village : {organisateur≤30} demande un compte partenaire et attend votre validation : {URL}/admin/dashboard » | 135 / 148 |
| plusieurs événements | « Event Village : {e} événements attendent votre validation : {URL}/admin/events » | 98 / 100 |
| plusieurs candidatures | « Event Village : {p} candidatures partenaires attendent votre validation : {URL}/admin/dashboard » | 115 / 117 |
| les deux | « Event Village : {e} événement(s) et {p} candidature(s) attendent votre validation : {URL}/admin/dashboard » (accords selon le nombre) | 117 / 123 |

| Cas limite | Résultat |
|---|---|
| Tout a été traité avant l'envoi | ligne « Annulée », motif nouveau « Déjà traité par l'administration » |
| Une partie traitée | SMS avec les nombres actuels |
| Permission retirée entre-temps | « Annulée », motif nouveau « L'administrateur n'a plus le droit d'agir » ; s'il garde une des deux permissions, on ne compte que ce qu'il peut traiter |
| Administrateur suspendu, sans numéro, compte de démonstration | règles existantes (« Compte suspendu », « Aucun numéro de téléphone », « Non envoyé : compte de démonstration ») |
| Soumission retirée par la partenaire | l'événement n'est plus en attente : il sort du compte |
| Soumission à 21 h 55, envoyeur en retard jusqu'à 22 h 01 | attente jusqu'à 8 h, SMS avec les nombres de 8 h |

À créer : type `ADMIN_TODO_SMS` (« À valider (SMS aux administrateurs) », famille indispensable, canal SMS, audience
ADMIN) ; fonction `notif_admin_todo_add(kind, ref, now)` appelée à côté des trois mises en file existantes
(`M/20261109000009_lot9bis_messages.sql:138-141`, `M/20261103000006_lot6_pros_admin.sql:650-654`,
`M/20261109000004_lot9bis_droits.sql:709-714`) ; branche dans `notification_outbox_claim` ; modèles au catalogue ; deux
libellés de motif ; index `notification_outbox (type, recipient_user_id, sent_at)`.

**Critères.** (1) Soumission à 14:00 : chaque administrateur `events.write` et chaque Superadmin ayant un numéro reçoit
un SMS avant 14:02 ; un ADMIN `events.read` seul n'a aucune ligne. (2) Seconde soumission à 14:10 : rien à 14:10, un
SMS à 14:30 « 2 événements attendent… ». (3) Les deux validés à 14:25 : la ligne de 14:30 est « Annulée », « Déjà
traité par l'administration ». (4) Soumission à 23:00 : SMS à 08:00, aucun `sent_at` entre 22:00 et 07:59. (5) Tous les
modèles ≤ 160 GSM-7 au pire cas (test du catalogue). **Effort M. P2.**

### 6.2 D2 — SMS optionnels de la nuit reportés à 8 h (G-95)

**Comportement.** Un SMS d'un type optionnel réservé entre 22 h et 8 h n'est plus « Non envoyé » : il reste « En
attente » et repart à la fin de la plage. À 8 h, toutes les revérifications existantes s'appliquent ; ce qui n'est
plus utile est annulé, ce qui fait doublon est fusionné.

- Dans `notification_outbox_claim` (`M/20261109000010_lot9bis_email.sql:496-501`), l'issue `SKIP / QUIET_HOURS`
  devient une issue nouvelle `DEFER` : `next_attempt_at` = prochaine fin de plage (heure de Dakar), statut en attente,
  aucune tentative ni aucun budget consommé (le budget optionnel est pris à 8 h, sur le jour de 8 h).
- **Encore utile à 8 h** : revérifications existantes (`:452-485`) — rappel annulé si l'événement n'est plus publié, a
  changé de début ou a commencé ; plus de billet valable ; affectation retirée ; préférence coupée ; compte suspendu.
  Rappel « SMS seulement sans push » : le SMS part seulement si le push n'a pas été accepté (`:505-521`).
- **Regroupement à 8 h** : `CATEGORY_SOLD_OUT` et `EVENT_SOLD_OUT` du même événement → seul « complet » part, l'autre
  « Remplacée par une notification plus récente » (libellé existant) ; `FIRST_TICKET_SOLD` perd son SMS (D3).
- Types touchés : `REMINDER_J1`, `REMINDER_H3`, `CONTROLLER_REMINDER`, `CATEGORY_SOLD_OUT`, `EVENT_SOLD_OUT`. Plage
  désactivée (début = fin) : rien n'est reporté.
- Libellés : motif « Reportée à la fin de la plage sans SMS » ; détail « Plage sans SMS : de 22 h à 8 h (heure de
  Dakar) ; reportée au {jour} à 8 h » ; aide du réglage « Heure de Dakar à partir de laquelle aucun SMS optionnel ne
  part. Ils sont envoyés à la fin de la plage s'ils sont encore utiles (événement pas encore commencé, billet toujours
  valable). De 0 à 23. » Aucun texte de SMS ne change.
- À adapter : la prévision `ADMIN_SMS_FORECAST` compte les rappels de la plage comme dus à 8 h
  (`M/20261105000002_lot7_sms.sql:740-745`, `:766-770`).

**Critères.** (1) Événement à 06:00, rappel dû à 03:00, sans push : à 03:00 « En attente », « Reportée… » ; rien avant
08:00 ; à 08:00 « Annulée », « Événement déjà commencé ». (2) Événement à 09:30, rappel dû à 06:30, sans push : SMS
entre 08:00 et 08:01. (3) Même cas avec un push accepté : « Non envoyée », « Push accepté par le service, SMS non
envoyé ». (4) Dernière catégorie vendue à 02:00 : un seul SMS à 08:00. (5) Aucune ligne SMS optionnelle envoyée entre
22:00 et 07:59 sur une semaine de recette. **Effort M. P2.**

### 6.3 D3 — La partenaire prévenue de ses ventes

1. **Cloche regroupée** : la première vente depuis plus de 15 min part tout de suite ; les suivantes du même
   événement s'ajoutent à une seule cloche, due 15 min après la précédente (mise en file actuelle à remplacer :
   `M/20261106000003_lot8_paiement.sql:239-248`). Montant : valeur des billets hors frais de service. Ventes au
   guichet : pas dans la cloche, dans le résumé.
   - une commande : titre « Nouvelle commande » — « 2 billets vendus pour « Concert Test » (+10 000 F CFA). »
   - regroupée : titre « Nouvelles ventes » — « 3 billets vendus pour « Concert Test » en 2 commandes depuis 14:05
     (+30 000 F CFA). » (le « +300 F » de la décision s'écrit « F CFA » selon le glossaire) ; lien
     `/partner/events/{id}?tab=ventes`.
2. **Résumé SMS chaque matin à 9 h** : type nouveau `PARTNER_SALES_DAILY` (SMS seul, optionnel, sujet « Activité de
   vos ventes ») ; un SMS par partenaire qui a vendu ou remboursé au moins un billet la veille (jour de Dakar, en
   ligne et au guichet, billets gratuits et invitations exclus) ; mis en file par `notification_daily_checks` entre
   9 h et 12 h, une fois par jour et par compte.

| Cas | SMS | Caractères (ex. / pire), GSM-7, 1 seg. |
|---|---|---|
| un événement | « Event Village : hier, {n} billets vendus pour {titre≤25} (+{montant}). Détail : {URL}/partner/events » | 127 / 143 |
| un événement, avec remboursements | « Event Village : hier, {n} billets vendus pour {titre≤16} (+{montant}), {r} remboursé(s) (-{montant r}). {URL}/partner/events » | 146 / 160 |
| plusieurs événements | « Event Village : hier, {n} billets vendus sur {k} événements (+{montant}){, {r} remboursés (-{montant r})}. {URL}/partner/events » | 147 / 156 |
| remboursements seulement | « Event Village : hier, {r} billet(s) remboursé(s) pour {titre≤25} (-{montant r}). Détail : {URL}/partner/events » | 126 / 147 |

3. **Désactivable** : l'interrupteur SMS du sujet « Activité de vos ventes » coupe le résumé, l'interrupteur
   Application coupe la cloche. Description du sujet : « Nouvelles ventes (regroupées toutes les 15 minutes), premier
   billet vendu, catégories et événements complets. Par SMS : un résumé des ventes de la veille chaque matin à 9 h, et
   les événements complets. »
4. `FIRST_TICKET_SOLD` perd son SMS (le résumé le dit le lendemain) ; « complet » garde le sien (action possible :
   ajouter des places) ; plus de double SMS « catégorie complète » + « événement complet » (N-13).

Cas limites : aucune vente la veille → aucun SMS ; sans numéro, suspendue, budget optionnel atteint → motifs existants ;
événement annulé avant l'échéance de la cloche → « Annulée ». **Critères.** (1) 5 paiements en 6 min → au plus 2
cloches en 15 min. (2) Le lendemain entre 09:00 et 09:02, un SMS par partenaire concernée, ≤ 160 GSM-7. (3) Interrupteur
SMS coupé → « Désactivée dans les préférences du destinataire ». (4) Plus aucune ligne SMS `FIRST_TICKET_SOLD`.
**Effort M. P2.**

### 6.4 U2 — « Dernières places » relatif, carte et fiche cohérentes (G-76)

Aujourd'hui un seul seuil absolu, `access.low_stock_threshold` = 10 : une catégorie de 10 places affiche « Plus que 10
places » dès sa mise en vente (fausse urgence) ; une catégorie de 500 places ne devient rare qu'à 10 places (2 %). La
fiche juge par catégorie, la carte quand toutes les catégories achetables en ligne sont au seuil
(`app/api/events/[id]/route.ts:120-121`, `lib/events/catalog.server.ts:123-128`, et la même règle en base pour le temps
réel, `M/20261110000011_lot9ter_stock.sql:101-111`, `:183-191`).

**Règle proposée, par catégorie.** Q = quantité mise en vente, P = plafond (le réglage existant).
`seuil(Q) = min(P, max(3, ⌈20 % × Q⌉))` ; la catégorie est « dans ses dernières places » si `0 < restant ≤ seuil(Q)`.
Taux 20 % et plancher 3 en constantes (une fonction TypeScript, une fonction SQL), pas de nouveau réglage.

- **Réglage** : même clé, mêmes bornes, devient le plafond ; libellé « Plafond « Dernières places » » ; défaut 50 (la
  migration passe la valeur à 50 seulement si elle vaut encore 10). Aide : « Une catégorie passe en « Dernières
  places » quand il lui reste 20 % de sa quantité mise en vente ou moins (3 places au moins), sans dépasser ce plafond.
  La fiche donne le nombre exact à partir de 10 places restantes. La carte d'un événement affiche « Dernières places »
  quand toutes ses catégories en vente en ligne en sont là. Entier de 1 à 1 000. »
- **Fiche** : restant ≤ 10 → « Plus que {n} places » / « Plus qu'une place » (inchangé) ; 10 < restant ≤ seuil(Q) →
  « Dernières places » (sans nombre) ; au-delà « Disponible ».
- **Carte** : règle inchangée dans sa forme, donc cohérente par construction : « Dernières places » seulement si
  chaque catégorie achetable de la fiche affiche « Dernières places », « Plus que {n} places » ou « Plus qu'une place ».

| Q | Seuil aujourd'hui | Seuil proposé (P = 50) | Fiche à la mise en vente | Fiche à 40 restantes |
|---|---|---|---|---|
| 10 | 10 | 3 | aujourd'hui « Plus que 10 places », proposé « Disponible » | — |
| 50 | 10 | 10 | « Disponible » | « Disponible » |
| 500 | 10 | 50 | « Disponible » | aujourd'hui « Disponible », proposé « Dernières places » |

Fichiers : `lib/events/low-stock.server.ts`, `lib/events/catalog.server.ts`, `app/api/events/[id]/route.ts`,
`app/api/events/route.ts`, `lib/events/popular.service.ts`, `app/events/[id]/page.tsx`, une migration (fonctions de
stock public et resynchronisation), `app/admin/finance-settings/page.tsx:81`, glossaire, tests de stock public.
**Critères** : `lowStockLimit(10, 50) = 3`, `(50, 50) = 10`, `(500, 50) = 50`, `(2, 50) = 3` ; une catégorie de 10
places publiée : carte sans badge, fiche « Disponible » ; après 7 ventes : carte « Dernières places », fiche « Plus que
3 places » ; pour chaque catégorie, l'état servi par la base égale celui de `GET /api/events/{id}`. **Effort M. P2.**

### 6.5 U4 — « Prévenir par WhatsApp » après un transfert

- **Où** : fenêtre « Transférer ce billet », état réussi (`components/tickets/TransferModal.tsx:188-196`) : bouton
  principal « Prévenir par WhatsApp », puis le bouton existant renommé « Autre application » (partage natif ou copie),
  puis « Terminer » ; et sur la carte du billet, encadré « Transfert en cours vers {numéro} »
  (`TicketCard.tsx:569-592`), à côté de « Annuler le transfert ».
- **Message** (aucun numéro de billet, aucun QR, aucun code) :
  « Bonjour, je vous ai transféré un billet pour « {titre} » sur Event Village.
  Pour le recevoir, connectez-vous avec ce numéro ({77 123 45 67}) et acceptez-le avant le {jeu. 12 nov. 2026 à 18:30} :
  {URL}/tickets?tab=recus »
- **Lien** : `https://wa.me/221XXXXXXXXX?text={encodeURIComponent(message)}`, numéro tiré de la réponse du serveur
  (déjà normalisé), `{URL}` = `NEXT_PUBLIC_APP_URL` (pas `window.location.origin`, pour ne jamais partager une adresse
  d'aperçu) ; ouverture dans un nouvel onglet. Adresse en fin de ligne pour rester cliquable.
- **Sans WhatsApp** : `wa.me` ouvre la page web de WhatsApp, qui propose l'installation ; « Autre application » reste
  le repli. Sous les boutons : « Le SMS d'Event Village part dans tous les cas. WhatsApp ou une autre application
  permet d'ajouter un mot de votre part. » Aide du transfert, étape 2 : « Vous pouvez aussi le prévenir sur WhatsApp,
  en un geste, après l'envoi. »
- **Critères** : après un transfert vers « 77 123 45 67 », le bouton ouvre une adresse qui commence par
  `https://wa.me/221771234567?text=` ; le texte décodé contient le titre, l'échéance et `/tickets?tab=recus` et ne
  contient pas `TCK-` (test unitaire) ; même bouton sur la carte d'un billet en transfert ; cible ≥ 44 px.
  **Effort S. P2.**

### 6.6 A2 — Libellé de prix de la carte (G-77)

B = catégories achetables en ligne maintenant (`isBuyableOnline`, `lib/events/catalog.server.ts:108-110`). Fonction
partagée `priceSummary` (`lib/events/price-summary.ts`), servie dans un champ `priceLabel` ; le prix minimum reste
servi pour le tri « Prix croissant ».

| Situation | Petite ligne | Ligne en gras |
|---|---|---|
| B vide | « Billetterie » | état actuel : « Bientôt en vente », « Complet », « Vente sur place uniquement », « Vente en ligne terminée » |
| tout B gratuit | « Billetterie » | « Gratuit » |
| B gratuit et payant | « Billetterie » | « Gratuit ou dès 5 000 F CFA » |
| B tout payant | « Billetterie » | « Dès 5 000 F CFA » |

- Montants par `formatFcfa` (espace insécable), jamais `toLocaleString` ; « À partir de » disparaît.
- Catégorie gratuite épuisée, close, pas encore ouverte, inactive ou au guichet seulement : hors de B → « Dès … ».
- Plus de place en ligne mais encore au guichet : badge **« Complet en ligne »** au lieu de « Complet » (N-12), bas de
  carte « Vente sur place uniquement » ; plus aucune place nulle part : « Complet » (inchangé).
- Même petite ligne et même ligne en gras dans la barre fixe de la fiche (E-02). `FeaturedEventCard`, utilisé nulle
  part, est supprimé. Glossaire : ajouter « Gratuit ou dès … », « Dès … », « Complet en ligne ».
- **Critères** : quatre événements de démonstration (tout gratuit ; gratuit + 5 000 ; 5 000 + 10 000 ; gratuit épuisé
  + 5 000) → « Gratuit », « Gratuit ou dès 5 000 F CFA », « Dès 5 000 F CFA », « Dès 5 000 F CFA » ; complet en ligne
  avec guichet ouvert → « Complet en ligne » ; aucune carte ne contient « À partir de ». **Effort S. P2.**

---

## 7. Messages

### 7.1 Règle et méthode

Règle du chef de projet : **SMS** pour ce que la personne doit savoir vite ou qui touche son argent, son billet, son
compte, un changement d'horaire ou de lieu, une annulation ; **cloche et email** pour le reste. Les 103 types de
`docs/guide/10-notifications.md` ont été relus comme le destinataire les lit. Un SMS existant n'est retiré que s'il est
clairement inutile.

Contraintes vérifiées avant d'écrire un texte : le texte fixe d'un SMS doit rester dans l'alphabet GSM-7 de base ;
« » ’ ê â ô î û ç œ y sont interdits (`lib/notifications/sms-format.ts:5-8`, `:19-21`) ; les valeurs saisies sont
translittérées et coupées par `smsVar` (`:94-156`). La mesure a fait tomber deux tournures : « n'a pas pu **être**
versé » et « **contrôler** » font passer un SMS en UCS-2, donc en deux segments ; d'où « n'a pas été versé » et
« scanner les billets » dans les propositions. Cloche, push et email gardent « » et ’.

« Mes billets » a quatre onglets : `a-venir` (défaut), `tous`, `historique`, `recus` ; un billet annulé ou remboursé
n'est que dans « Historique » ou « Tous ».

**Bilan des 103 types** : 66 justes (dont 27 et 29 avec un SMS retiré, 54, 55 et 71 avec le SMS D1) ; 9 faux (33, 39,
56, 59, 62, 63, 64, 84, 85) ; 4 dont seul le lien est à corriger (4, 58, 69, 92) ; 5 SMS à ajouter (7, 76, 77, 91, 95) ;
8 à reformuler ou compléter (17, 19, 20, 37, 41, 60, 72, 86) ; 2 à regrouper (28 avec D3, 61) ; 8 inutiles
aujourd'hui, services fermés (42 à 48, 93) ; 1 SMS inutile (53).

### 7.2 Tableau des 103 types

Abréviations : C cloche, P push, E email, S SMS ; (I) indispensable, (O) optionnel. Le texte proposé n'est donné que si
le verdict n'est pas « OK » ; chaque SMS proposé porte sa mesure (exemple / pire cas, GSM-7, segments). Numéros de
ligne : `lib/notifications/catalog.ts`.

| # | Type (code — nom) | Destinataire | Canaux actuels | Canaux proposés | Lien actuel → bon ? | Verdict | Texte proposé |
|---|---|---|---|---|---|---|---|
| 1 | `PURCHASE_CONFIRMED` — Confirmation d'achat | acheteur (SMS au numéro payeur) | C S E (I) | = | `/tickets` → oui | OK | — |
| 2 | `FREE_TICKETS_CONFIRMED` — Billets gratuits confirmés | client | C S E (I) | = | `/tickets` → oui | OK | — |
| 3 | `COUNTER_RECEIPT` — Reçu de vente au guichet | numéro saisi au guichet | S (I) | = | aucun (SMS seul) → normal | OK | — |
| 4 | `INVITATION_RECEIVED` — Invitation reçue | numéro invité ; compte vérifié | S C P E (I) | = | C/P/E `/tickets?tab=recus` → **non** (G-80 : billets rangés dans « À venir », « Reçus » dit « Aucun billet reçu en attente ») ; SMS `/tickets` → oui | lien faux | Lien C/P/E : `/tickets` (catalog.ts:700). Textes inchangés. |
| 5 | `TRANSFER_OFFERED` — Billet transféré (offre) | destinataire du transfert | S C P E (I) | = (+ U4 côté expéditeur) | `?tab=recus` → oui ; SMS `/tickets` → oui (la page bascule sur « Reçus » si un billet attend, `app/tickets/page.tsx:199`) | OK | — (le SMS ne dit pas qui envoie : U4 y répond) |
| 6 | `TRANSFER_CANCELLED` — Transfert annulé | destinataire du transfert | S C P E (I) | = | `/tickets` → oui | OK | — |
| 7 | `TRANSFER_EXPIRED` — Transfert expiré | expéditeur | C P E (I) | C P E **+ S** (son billet lui revient, le QR redevient utilisable) | `/tickets` → oui | à compléter (canal) | SMS : `Event Village : votre billet {titre≤30} n'a pas été accepté à temps : il vous revient. {URL}/tickets` — ex. 124 / pire 142, GSM-7, 1 seg. |
| 8 | `TRANSFER_CLAIMED_SENDER` — Transfert accepté (expéditeur) | expéditeur | C P E (I) | = (issue attendue de son geste) | `?tab=historique` → oui | OK | — |
| 9 | `TRANSFER_RECEIVED` — Billet reçu | nouveau détenteur | C P E (I) | = (il vient d'accepter à l'écran) | `/tickets` → oui | OK | — |
| 10 | `TICKET_SCANNED` — Entrée validée | détenteur | C P E (I) | = (l'email sert d'alerte si quelqu'un d'autre entre avec le billet) | `?tab=historique` → oui | OK | — |
| 11 | `EVENT_CANCELLED` — Annulation d'un événement | détenteurs, acheteurs, numéros | C S E P (I) | = | `/tickets` → oui si le billet reste `VALIDE` jusqu'au remboursement (statut du billet après annulation **NON VÉRIFIÉ**) | OK | — |
| 12 | `EVENT_SUSPENDED_HOLDER` — Suspension (détenteurs) | détenteurs | C P E (O) | = | `/events/{id}` → oui (bandeau « Événement suspendu », `app/api/events/[id]/route.ts:15-18`) | OK | — |
| 13 | `EVENT_REACTIVATED_HOLDER` — Reprise (détenteurs) | détenteurs | C P E (O) | = | `/events/{id}` → oui | OK | — |
| 14 | `EVENT_CHANGED` — Changement d'un événement | détenteurs, numéros | C P S E (I) | = | C/P/E `/events/{id}`, SMS `/tickets` → oui | OK | — |
| 15 | `REMINDER_J1` — Rappel la veille | détenteurs | C P S E (O) | = ; SMS de nuit reporté (D2) | `/tickets` → oui | OK | — |
| 16 | `REMINDER_H3` — Rappel avant le début | détenteurs | C P S E (O) | = ; SMS de nuit reporté (D2) | `/tickets` → oui | OK | — |
| 17 | `REFUND_REQUESTED` — Remboursement demandé | titulaire du remboursement | C E (I) | C E ; **+ S + P quand le remboursement n'est pas demandé par le titulaire** (organisateur ou admin : son billet est annulé) | `?tab=historique` → oui | à reformuler + canal | Cloche (demande du titulaire) : titre `Remboursement en cours` ; texte `Le remboursement de votre billet pour « {titre} » ({montant}) est lancé sur votre compte {opérateur}. Vous serez prévenu dès qu'il est versé.` Cloche (organisateur ou admin) : titre `Billet annulé par l'organisateur` ; texte `Votre billet pour « {titre} » est annulé par l'organisateur. Son remboursement ({montant}) est lancé sur votre compte {opérateur} : vous serez prévenu du versement.` SMS (organisateur ou admin seulement) : `Event Village : votre billet {titre≤25} est annulé par l'organisateur. Remboursement de {montant} en cours sur votre compte {opérateur}.` — ex. 133 (Wave) / 141 (Orange Money) ; pire 158, GSM-7, 1 seg. Données à ajouter : `operator`, `initiated_by` (M/20261109000007_lot9bis_versements.sql:384-392). |
| 18 | `REFUND_PAID` — Remboursement versé | bénéficiaire | C S E P (I) | = | `?tab=historique` → oui | OK | — |
| 19 | `PASSWORD_CHANGED` — Mot de passe modifié | tout compte | C S E (I) | = | `/profile` → oui | à reformuler (P3) : « contactez le support » sans dire comment | SMS : `Event Village : le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, écrivez à support@eventvillage.sn` — 128, GSM-7, 1 seg. (adresse = `SUPPORT_EMAIL`, `lib/support.ts:8-13`) |
| 20 | `PHONE_CHANGED` — Numéro modifié | ancien numéro (S), compte (E) | S E (I) | = | `/profile` → oui | à reformuler (P3), même raison | SMS : `Event Village : le numéro de votre compte a été modifié. Si ce n'est pas vous, écrivez à support@eventvillage.sn` — 112, GSM-7, 1 seg. |
| 21 | `PUSH_TEST` — Notification d'essai | demandeur | P (I) | = | `/profile/notifications` → oui | OK | — |
| 22 | `EVENT_VALIDATED` — Événement validé | partenaire | C S E P (I) | = (elle attend pour vendre) | C `/partner/events/{id}`, SMS `/partner/events` → oui | OK | — |
| 23 | `EVENT_REJECTED` — Événement non validé | partenaire | C S E P (I) | = | idem → oui | OK | — |
| 24 | `EVENT_SUSPENDED` — Événement suspendu | partenaire | C S E P (I) | = (ventes arrêtées) | idem → oui | OK | — |
| 25 | `EVENT_REACTIVATED` — Événement réactivé | partenaire | C S E P (I) | = | idem → oui | OK | — |
| 26 | `EVENT_PUBLISHED_BY_ADMIN` — Publié par l'administration | partenaire | C P E (I) | = | `/partner/events/{id}` → oui | OK | — |
| 27 | `FIRST_TICKET_SOLD` — Premier billet vendu | partenaire | C P S E (O) | C P E (**SMS retiré** : repris par le résumé du matin, D3) | `?tab=ventes` → oui | OK (canal) | — |
| 28 | `NEW_ORDER` — Nouvelle commande | partenaire | C (O), une cloche **par commande** | C **regroupée au plus toutes les 15 min par événement** (D3) | `?tab=ventes` → oui | à reformuler (D3) | Voir 6.3 : `Nouvelle commande` / `Nouvelles ventes`. |
| 29 | `CATEGORY_SOLD_OUT` — Catégorie complète | partenaire | C P S E (O) | = ; **pas de SMS quand `EVENT_SOLD_OUT` part dans la même opération** (doublon : la dernière catégorie déclenche les deux, guide 10-notifications.md:1422) ; SMS de nuit reporté (D2) | `?tab=ventes` → oui | OK (doublon de SMS à supprimer) | — |
| 30 | `EVENT_SOLD_OUT` — Événement complet | partenaire | C P S E (O) | = ; SMS de nuit reporté (D2) | `?tab=ventes` → oui | OK | — |
| 31 | `SHIFT_DISCREPANCY` — Écart de caisse | partenaire | C S P E (I) | = | `?tab=caisse` → oui | OK | — |
| 32 | `WITHDRAWAL_PAID` — Retrait versé | bénéficiaire | C S E P (I) | = | `/partner/finance` ou `/wallet` → oui | OK | — |
| 33 | `WITHDRAWAL_REJECTED` — Retrait refusé | bénéficiaire | C S E P (I) | = | idem → oui | **faux** (G-28) | Cloche : titre `Retrait non versé` ; texte `Votre retrait de {montant} n'a pas été versé. Le montant est revenu sur votre solde : vous pouvez demander un nouveau retrait.` SMS : `Event Village : votre retrait de {montant} n'a pas été versé. Le montant est revenu sur votre solde.` — ex. 103 / pire 106, GSM-7, 1 seg. (vrai dans les deux cas : refus de l'opérateur et « Constater non versé ») |
| 34 | `WITHDRAWAL_UNCERTAIN` — Retrait en vérification | bénéficiaire | C S P E (I) | = | idem → oui | OK | — |
| 35 | `CANCEL_REFUNDS_DONE` — Remboursements d'une annulation terminés | partenaire | C E P (I) | = | `?tab=cloture` → oui | OK | — |
| 36 | `CANCEL_REFUNDS_BLOCKED` — Remboursements bloqués | partenaire | C E P (I) | = (l'administration agit) | `?tab=cloture` → oui | OK | — |
| 37 | `PARTNER_REGISTERED_ACK` — Inscription partenaire reçue | partenaire | C E (I) | = | `/partner/dashboard` → oui | à reformuler (P3) : ne dit pas comment arrive la suite | Cloche : `Votre demande de compte partenaire « {organisateur} » est en cours d'examen par l'équipe Event Village. Vous recevrez sa décision par SMS.` |
| 38 | `PARTNER_VALIDATED` — Compte partenaire validé | partenaire | C S E (I) | = | C `/partner/dashboard`, SMS `/login` → oui | OK | — |
| 39 | `PARTNER_REJECTED` — Demande refusée | partenaire | C S E (I) | = | `/partner/dashboard` → oui | **faux** au second refus (G-16) ; SMS sans la suite | Voir 7.3 (G-16) : deux variantes cloche et SMS. |
| 40 | `PARTNER_SUSPENDED` — Compte partenaire suspendu | partenaire | C S E (I) | = | `/partner/dashboard` → page refusée au compte suspendu (G-07) | OK (lien sans effet : à revoir avec G-07) | — |
| 41 | `PARTNER_REACTIVATED` — Compte partenaire réactivé | partenaire | C S E (I) | = | C `/partner/dashboard`, SMS `/login` → oui | **manque le motif annoncé** (G-06) | Cloche et email : `Votre compte partenaire est réactivé. Motif : {motif}. Vous pouvez de nouveau publier vos événements.` (SMS inchangé ; ou retirer la promesse de l'écran, `components/admin/PartnerStatusDialog.tsx:63-69`) |
| 42 | `TRIAL_STARTED` — Période d'essai activée | partenaire | C E (I) | à arbitrer | `/partner/dashboard` → oui | inutile tant que l'essai n'a aucun effet (G-54) | Ne plus envoyer, ou `Votre période d'essai de {jours} jours commence aujourd'hui ; elle se termine le {date}.` si l'essai reçoit une fin réelle. |
| 43 | `SUBSCRIPTION_ACTIVATED` — Abonnement activé | partenaire | C E (I) | = | `/partner/subscription` | inutile aujourd'hui (abonnements non construits, guide 14) | — |
| 44 | `PAYMENT_SUCCESS` — Paiement confirmé | payeur hors billets | C E (I) | = | `/orders` (module des commandes fermé) | inutile aujourd'hui | — |
| 45 | `HALL_RESERVATION_REQUESTED` | partenaire de la salle | C E (I) | = | `/partner/halls` | inutile aujourd'hui (salles fermées, `features.halls_enabled`) | — |
| 46 | `HALL_RESERVATION_CONFIRMED` | client | C E (I) | = | `/orders` | inutile aujourd'hui | — |
| 47 | `HALL_RESERVATION_CANCELLED` | client, partenaire | C E (I) | = | `/orders`, `/partner/halls` | inutile aujourd'hui | — |
| 48 | `PROMOTION_DECIDED` — Décision sur une mise en avant | partenaire | C E (I) | = | `/partner/events/{id}` | inutile (la demande est refusée côté partenaire, G-94) | — |
| 49 | `CONTROLLER_ASSIGNED` — Affectation | contrôleur | C P S E (I) | = | C `/controller/scanner`, SMS `/login` → oui | OK | — |
| 50 | `CONTROLLER_UNASSIGNED` — Retrait d'affectation | contrôleur | C P S E (I) | = (il ne doit pas venir) | `/controller/scanner` → oui | OK | — |
| 51 | `CONTROLLER_REMINDER` — Rappel de contrôle la veille | contrôleur | C P S E (O) | = (18 h, hors nuit) | `/controller/scanner`, SMS `/login` → oui | OK | — |
| 52 | `SHIFT_CLOSED_BY_OTHER` — Caisse fermée par un tiers | contrôleur | C P E (I) | = | `/controller/scanner` → oui | OK | — |
| 53 | `CONTROLLER_ACTIVATED` — Compte de contrôleur activé | contrôleur | C S E (I) | C E (**SMS retiré**) | `/controller/scanner` → oui | SMS inutile : il vient d'activer son compte à l'écran (`app/api/controller/setup/route.ts:205`) | — |
| 54 | `ADMIN_EVENT_SUBMITTED` — Événement à valider | admins `events.read` | C P E (I) | = **+ S regroupé** aux admins `events.write` et SUPERADMIN (D1) | `/admin/events/{id}` → oui | OK + D1 | Voir 6.1. |
| 55 | `ADMIN_PARTNER_REGISTERED` — Nouvelle candidature | admins `partners.read` | C P E (I) | = **+ S regroupé** aux admins `partners.validate` et SUPERADMIN (D1) | `/admin/dashboard` → oui (onglet « En attente » par défaut, `app/admin/dashboard/page.tsx:176`) | OK + D1 | Voir 6.1. |
| 56 | `ADMIN_REFUND_TO_RETRY` — Remboursement à reprendre | admins `refunds.manage` | C P E (I) | = | `/admin/finance` → **en haut de page** ; la liste « Versements à reprendre » est en bas (`app/admin/finance/page.tsx:312`) | **faux** sur un constat de non-versement (G-28) + lien imprécis | Variante non versé : `Un remboursement de {montant} a été constaté non versé : relancez-le depuis « Versements à reprendre ».` Lien : `/admin/finance#versements-a-reprendre` (ancre à poser sur le titre, `components/admin/RefundsToRetry.tsx:406`). |
| 57 | `ADMIN_DUPLICATE_PAYMENT` — Paiement en double remboursé | admins `refunds.manage` | C P E (I) | = | `/admin/finance` → oui (information) | OK | — |
| 58 | `ADMIN_CASHOUT_UNCERTAIN` — Versement incertain | admins `refunds.manage` | C P E (I) | = | `/admin/finance` → en haut de page | lien imprécis | Lien : `/admin/finance#versements-a-reprendre`. |
| 59 | `ADMIN_WITHDRAWAL_REJECTED` — Retrait refusé par l'opérateur | admins `refunds.manage` | C E (I) | = | `/admin/finance` | **faux** sur un constat (G-28) | Titre `Retrait non versé` ; variante opérateur : `Le retrait de {montant} a été refusé par l'opérateur ; le montant est revenu sur le solde du bénéficiaire.` ; variante constat : `Le retrait de {montant} a été constaté non versé ; le montant est revenu sur le solde du bénéficiaire.` |
| 60 | `ADMIN_FINANCE_DEBT` — Créance sur un compte | admins `payments.read` | C E (I) | = | `/admin/finance` → oui | à reformuler (P3) : ne dit pas **quel** compte (`catalog.ts:1240-1245`) | `Un débit de {montant} sur le compte organisateur de {organisateur} dépasse le solde disponible : une créance de {créance} sera compensée sur ses gains futurs.` (donnée `company` à ajouter) |
| 61 | `ADMIN_NOTIFICATION_FAILED` — Envoi en échec | admins `notifications.read` | C E (I) | C regroupée par heure ; E une fois par heure | `/admin/notifications/{id}` → oui | à regrouper (P3) : une panne du fournisseur produit une alerte **par ligne et par admin** (`M/20261103000002_lot6_outbox.sql:635-655`) | Regroupée : titre `Envois en échec` ; texte `{n} notifications ont échoué depuis {heure}, dont {k} par SMS. Ouvrez la supervision pour les relancer.` ; lien `/admin/notifications?status=FAILED`. |
| 62 | `ADMIN_SMS_DAILY_THRESHOLD` — Volume de SMS indispensables élevé | admins `notifications.read` | C E (I) | = | `/admin/notifications` → oui | **faux** (G-14) | Voir 7.3. |
| 63 | `ADMIN_SMS_CAP_GLOBAL` — Plafond de SMS atteint | admins `notifications.read` | C E (I) | = | `/admin/notifications` → oui | **faux** (G-13) | Voir 7.3. |
| 64 | `ADMIN_SMS_CAP_NON_OTP` — Quota de SMS hors code atteint | admins `notifications.read` | C E (I) | = | `/admin/notifications` → oui | **faux** (G-13) | Voir 7.3. |
| 65 | `ADMIN_SMS_OPTIONAL_80` — SMS optionnels à 80 % | admins `notifications.read` | C E (I) | = | `/admin/notifications` → oui | OK | — |
| 66 | `ADMIN_SMS_FORECAST` — Rappels de demain au-delà du budget | admins `notifications.read` | C E (I) | = | `/admin/notifications` → oui | OK (calcul à revoir avec D2) | — |
| 67 | `REFUND_DELAYED` — Remboursement retardé | bénéficiaire | C S E P (I) | = | `?tab=historique` → oui | OK | — |
| 68 | `WITHDRAWAL_DELAYED` — Retrait retardé | bénéficiaire | C S E P (I) | = | `/partner/finance` → oui | OK | — |
| 69 | `ADMIN_CASHOUT_TO_RESUME` — Versement à reprendre | admins `refunds.manage` | C P E (I) | = | `/admin/finance` → en haut de page | lien imprécis | Lien : `/admin/finance#versements-a-reprendre`. |
| 70 | `PAYMENT_REFUND_STARTED` — Remboursement d'un paiement | client | C S E P (I) | = | `?tab=historique` → oui | OK | — |
| 71 | `ADMIN_PARTNER_RESUBMITTED` — Dossier complété | admins `partners.read` | C P E (I) | = **+ S regroupé** (D1) | `/admin/dashboard` → oui | OK + D1 | Voir 6.1. |
| 72 | `EVENT_CLOSED_HOLDER` — Clôture d'un suspendu (détenteurs) | détenteurs | C S E P (I) | = | `/tickets` → oui | à reformuler (P3) : « clos » est du jargon et le message ne dit pas à qui s'adresser (et la fiche publique dit l'inverse, G-19) | Cloche : `« {titre} » est clos par l'équipe Event Village après sa suspension. Il n'est pas annulé : aucun remboursement automatique. Pour toute question, écrivez à {support}.` (SMS inchangé, 140/158). |
| 73 | `EVENT_CLOSED_BY_ADMIN` — Clôture par l'administration | partenaire | C S E P (I) | = | `/partner/events/{id}` → oui | OK | — |
| 74 | `SHIFT_OPEN_AT_END` — Caisse encore ouverte à la fin | partenaire | C P S E (I) | = | `?tab=caisse` → oui | OK | — |
| 75 | `TRANSFER_REVOKED` — Transfert annulé par un remboursement | destinataire | S C P E (I) | = | `/tickets` → oui | OK | — |
| 76 | `TRANSFER_DECLINED_SENDER` — Transfert refusé | expéditeur | C P E (I) | C P E **+ S** (son billet lui revient) | `/tickets` → oui | à compléter (canal) | SMS : `Event Village : le destinataire a refusé votre billet {titre≤30}. Il vous revient : {URL}/tickets` — ex. 121 / pire 138, GSM-7, 1 seg. (point final omis après « ... ») |
| 77 | `TRANSFER_RECIPIENT_CHANGED` — Transfert annulé (numéro changé) | expéditeur | C P E (I) | C P E **+ S** | `/tickets` → oui | à compléter (canal) | SMS : `Event Village : transfert du billet {titre≤25} annulé, le destinataire a changé de numéro. Il vous revient : {URL}/tickets` — ex. 146 / pire 159, GSM-7, 1 seg. |
| 78 | `CONTROLLER_INVITATION` — Invitation à contrôler | titulaire d'un compte | S C P E (I) | = | `/invitations` → oui (seule entrée vers cette page, G-71) | OK | — |
| 79 | `EVENT_CANCELLED_BY_ADMIN` — Annulation par l'administration | partenaire | C S E (I) | = | `?tab=cloture` → oui | OK | — |
| 80 | `ADMIN_EVENT_CANCELLED` — Annulé par l'organisateur | admins `events.read` | C E (I) | = | `/admin/events/{id}` → oui | OK | — |
| 81 | `CONTROLLER_EVENT_CANCELLED` — Annulation d'un événement contrôlé | contrôleurs | C S E (I) | = | `/controller/scanner` → oui | OK | — |
| 82 | `CONTROLLER_EVENT_CHANGED` — Changement d'un événement contrôlé | contrôleurs | C S E (I) | = | C `/controller/scanner`, SMS `/login` → oui | OK | — |
| 83 | `CONTROLLER_EVENT_STATUS` — Suspension ou reprise | contrôleurs | C E (I) | = | `/controller/scanner` → oui | OK | — |
| 84 | `TICKET_CANCELLED` — Billet annulé | détenteur ; numéro d'une invitation non réclamée | C S E (I) | = | `/tickets` → **non** : le billet passe `ANNULE` (`M/20261109000009_lot9bis_messages.sql:1052`) et n'est plus dans « À venir » | **faux** si l'admin annule (G-83) + lien | Lien : `/tickets?tab=historique`. Variantes « admin » : voir 7.3 (G-83). |
| 85 | `ACCOUNT_SUSPENDED` — Compte suspendu | compte suspendu | C S E (I) | = | `/billet/hors-ligne` → **non** (vide après fermeture de session, G-05) | **faux** (G-05) | Voir 7.3. |
| 86 | `ACCOUNT_REACTIVATED` — Compte réactivé | compte | C S E (I) | = | `/login` → oui | **manque le motif annoncé** (G-06) | Cloche et email : `Votre compte est réactivé. Motif : {motif}. Vous pouvez de nouveau vous connecter.` (SMS inchangé) ; ou retirer « Il est prévenu avec votre motif. » (`app/admin/users/page.tsx:915`, `:919`). |
| 87 | `ADMIN_EVENT_CHANGED` — Modifié après validation | admins `events.read` | C E (I) | = | `/admin/events/{id}` → oui | OK | — |
| 88 | `EVENT_SUBMITTED_ACK` — Envoyé en validation | partenaire | C E (I) | = | `/partner/events/{id}` → oui | OK | — |
| 89 | `EVENT_FINISHED` — Événement terminé | partenaire | C E (I) | = | `?tab=cloture` → oui | OK | — |
| 90 | `CLOSING_REPORT_READY` — Rapport de clôture prêt | partenaire | C E (I) | = | `?tab=cloture` → oui | OK | — |
| 91 | `FUNDS_AVAILABLE` — Recettes disponibles | partenaire | C E (I) | C E **+ S** (son argent devient retirable) | `/partner/finance` → oui | à compléter (canal) | SMS : `Event Village : les recettes de {titre≤30} sont disponibles. Demandez votre retrait : {URL}/partner/finance` — ex. 131 / pire 149, GSM-7, 1 seg. |
| 92 | `TICKET_REFUNDED_HOLDER` — Billet transféré annulé (détenteur) | détenteur actuel | S C P E (I) | = | `/tickets` → **non** (billet annulé, hors « À venir ») | lien faux | Lien : `/tickets?tab=historique`. |
| 93 | `ADMIN_EVENT_PUBLISHED` — Publié par l'organisateur | admins `events.read` | C E (I) | C seule (email inutile : simple suite d'une validation déjà faite) | `/admin/events/{id}` → oui | inutile (email) | — |
| 94 | `ADMIN_EVENT_WITHDRAWN` — Soumission retirée | admins `events.read` | C E (I) | = ; retire l'événement du SMS D1 en attente | `/admin/events/{id}` → oui | OK | — |
| 95 | `SCAN_REFUSALS_ALERT` — Refus en série à une porte | partenaire | C P E (I) | C P E **+ S** (à savoir tout de suite, la file attend ; push seulement si l'appareil est abonné) | `?tab=entrees` → oui | à compléter (canal) | SMS : `Event Village : {porte≤12} : {n} refus en {m} min pour {titre≤20}. Vérifiez cette porte avec votre équipe. {URL}/partner/events` — ex. 145 / pire 159, GSM-7, 1 seg. (« contrôleurs » interdit : « ô ») |
| 96 | `OTP_LOGIN` — Code de connexion | numéro | S immédiat (I) | = | — | OK | — |
| 97 | `OTP_REGISTER` — Code d'inscription | numéro | S immédiat (I) | = | — | OK | — |
| 98 | `OTP_PASSWORD_RESET` — Code de réinitialisation | numéro | S immédiat (I) | = | — | OK | — |
| 99 | `OTP_WITHDRAWAL` — Code de retrait | numéro du compte | S immédiat (I) | = | — | OK | — |
| 100 | `OTP_PHONE_CHANGE` — Code de changement de numéro | nouveau numéro | S immédiat (I) | = | — | OK | — |
| 101 | `OTP_AUTH_HOOK` — Code de connexion (Supabase) | numéro | S immédiat (I) | = | — | OK | — |
| 102 | `CONTROLLER_INVITE` — Invitation d'un contrôleur | numéro invité | S immédiat (I) | = | `/controller/setup?phone=…` → oui | OK | — |
| 103 | `EMAIL_VERIFICATION` — Vérification de l'adresse email | adresse saisie | E immédiat (I) | = | `/verify-email?t=…` → oui | OK | — |

### 7.3 Messages faux

| Constat | Texte actuel | Pourquoi faux | Texte proposé | Prio |
|---|---|---|---|---|
| G-05 `ACCOUNT_SUSPENDED` (`catalog.ts:1577-1586`) | « … présentez le billet hors ligne déjà enregistré sur votre téléphone, ou donnez le numéro du billet avec une pièce d'identité. Contactez le support. » ; lien `/billet/hors-ligne` | la fermeture de session efface les billets hors ligne (`AuthProvider.tsx:177-182`) : la page est vide | Cloche et email : « Votre compte est suspendu. Motif : {motif}. Vos billets payés restent valables : à l'entrée, donnez le numéro du billet (dans votre email ou SMS de confirmation) avec une pièce d'identité. Pour toute question, écrivez à {support}. » ; SMS « Event Village : votre compte est suspendu. Motif : {motif≤30} Vos billets payés restent valables : à l'entrée, donnez leur numéro. » (140 / 150, 1 seg.) ; lien `/login`. Le numéro n'étant que dans l'email (N-10), voir section 11. | P1 |
| G-13 `ADMIN_SMS_CAP_GLOBAL` (`catalog.ts:1273-1281`) | « Le plafond de {plafond} SMS par jour est atteint : les envois sont suspendus jusqu'à minuit (UTC, heure de Dakar). » | ce sont les **codes** qui s'arrêtent ; les SMS indispensables ne sont pas soumis au plafond global (`sms-guard.ts:103-106`, `:164-166`) | Titre « Plafond de SMS atteint : codes bloqués » ; « Le plafond de {plafond} SMS par jour est atteint : plus aucun code par SMS (connexion, inscription, retrait) ne part jusqu'à minuit, heure de Dakar. Les clients ne peuvent plus se connecter par code. Les SMS d'achat, de billet, d'annulation et de remboursement partent toujours. » | P1 |
| G-13 `ADMIN_SMS_CAP_NON_OTP` (`:1282-1289`) | « … seuls les codes de connexion partent encore jusqu'à minuit (UTC, heure de Dakar). » | les SMS indispensables continuent aussi | Titre « Quota de SMS hors codes atteint » ; « La part de {part} SMS par jour hors codes est atteinte : jusqu'à minuit, heure de Dakar, les rappels, les signaux de vente et les invitations de contrôleurs ne partent plus par SMS. Les codes et les SMS d'achat, de billet, d'annulation et de remboursement partent toujours. » | P1 |
| G-14 `ADMIN_SMS_DAILY_THRESHOLD` (`:1268`) et aides des réglages (`finance-settings/page.tsx:92-93`) | « Ils n'ont pas de plafond » ; « ne sont jamais plafonnés » | 30 par numéro et 30 par compte déclencheur et par jour (`sms-guard.ts:106-118`) | « {nombre} SMS indispensables envoyés aujourd'hui (seuil d'alerte : {seuil}). Ils n'ont pas de plafond global, mais chaque numéro en reçoit au plus 30 par jour et chaque compte en déclenche au plus 30 : vérifiez leur origine dans la supervision. » ; aides : « n'ont pas de plafond global (30 par numéro et 30 par compte déclencheur et par jour) ». Lié : lever la limite par compte déclencheur pour les SMS indispensables déclenchés par un administrateur ou la propriétaire (E-41). | P2 |
| G-16 `PARTNER_REJECTED` (`:1029-1033`) | cloche « … Vous pouvez compléter votre dossier une fois depuis votre tableau de bord. » même au second refus ; SMS sans la suite | le tableau de bord dit « Votre dossier a déjà été complété une fois. Contactez le support pour la suite. » | 1er refus : SMS « Event Village : demande partenaire refusée. Motif : {motif≤35} Complétez votre dossier : {URL}/partner/dashboard » (151 / 158) ; 2e refus : cloche « … Votre dossier a déjà été complété une fois : contactez le support à {support}. » ; SMS « Event Village : demande partenaire refusée. Motif : {motif≤50} Dossier déjà complété une fois : contactez le support. » (134 / 157) | P2 |
| G-28 `WITHDRAWAL_REJECTED` (`:986-991`), `ADMIN_WITHDRAWAL_REJECTED`, `ADMIN_REFUND_TO_RETRY` | « … a été refusé par l'opérateur. Le montant est revenu sur votre solde. » | « Constater non versé » passe par le même déclencheur : rien n'est parti, l'opérateur n'a rien refusé | Bénéficiaire, vrai dans les deux cas : titre « Retrait non versé » ; « Votre retrait de {montant} n'a pas été versé. Le montant est revenu sur votre solde : vous pouvez demander un nouveau retrait. » ; SMS « Event Village : votre retrait de {montant} n'a pas été versé. Le montant est revenu sur votre solde. » (103 / 106). Administrateurs : deux variantes, « refusé par l'opérateur » / « constaté non versé ». | P2 |
| G-83 `TICKET_CANCELLED` (`:1555-1575`) | « … est annulée par l'organisateur. » même quand l'administration annule | l'auteur est connu (`M/20261109000009_lot9bis_messages.sql:1018`) mais pas transmis | variantes « … par l'équipe Event Village » ; SMS d'une invitation « Event Village : votre invitation pour {titre≤30} du {date} est annulée par l'équipe Event Village. » (114 / 132) | P3 |
| G-06 `ACCOUNT_REACTIVATED`, `PARTNER_REACTIVATED` | aucun motif, alors que l'écran promet « Il est prévenu avec votre motif. » | promesse fausse | Soit le motif part (cloche et email « Votre compte est réactivé. Motif : {motif}. Vous pouvez de nouveau vous connecter. »), soit l'écran cesse de le promettre (E-32, E-44) | P2 |
| N-09 `REFUND_REQUESTED` (`:852-857`) | titre « Remboursement demandé », cloche et email seulement | quand la partenaire ou l'administration rembourse, le client n'a rien demandé et son billet est annulé sans SMS | Demandé par lui : titre « Remboursement en cours » — « Le remboursement de votre billet pour « {titre} » ({montant}) est lancé sur votre compte {opérateur}. Vous serez prévenu dès qu'il est versé. » ; par l'organisateur ou l'administration : titre « Billet annulé par l'organisateur », + SMS et push « Event Village : votre billet {titre≤25} est annulé par l'organisateur. Remboursement de {montant} en cours sur votre compte {opérateur}. » (133 / 158) | P2 |
| Aide de la plage sans SMS (`finance-settings/page.tsx:90`) | « le rappel passe alors par les autres canaux » | vrai seulement pour qui a la cloche ouverte, un push ou un email vérifié (G-95) | remplacée par l'aide de D2 | P2 |

### 7.4 Messages qui manquent

| Type proposé | Destinataire | Déclencheur | Canaux | Texte |
|---|---|---|---|---|
| `PARTNER_CONTROLLER_ACCEPTED` (G-65, G-75) | partenaire | un contrôleur accepte | C P E (I) | « Invitation acceptée » — « {nom} a accepté de contrôler l'entrée de « {titre} »{, et N autres événements}. » ; sans affectation créée : « {nom} a accepté votre invitation, mais aucun de vos événements n'est ouvert au contrôle : affectez-le depuis votre équipe. » ; lien `/partner/team` |
| `PARTNER_CONTROLLER_DECLINED` (G-65) | partenaire | un contrôleur refuse (aujourd'hui une ligne d'audit seule, `M/20261109000008_lot9bis_cycle.sql:2109-2115`) | C P E (I), + S si un des événements commence dans moins de 48 h | « Invitation refusée » — « {nom} a refusé de contrôler l'entrée de « {titre} ». Invitez une autre personne depuis votre équipe. » ; SMS « Event Village : {nom≤18} refuse de scanner les billets de {titre≤20} Invitez quelqu'un d'autre : {URL}/partner/team » (145 / 156) |
| `PARTNER_CONTROLLER_EXPIRED` (G-65) | partenaire | invitation échue, relevée par la tâche horaire des transferts qui la passe « expirée » | C E (I) | « Invitation sans réponse » — « {nom} n'a pas répondu à temps à votre invitation pour « {titre} ». Renvoyez-la ou invitez une autre personne. » |
| `PARTNER_TICKET_REFUNDED` (G-93) | partenaire | remboursement d'un billet demandé par quelqu'un d'autre qu'elle (client après report, administration) | C E (I), regroupé au plus toutes les 15 min par événement, compté dans le résumé D3 | « Billet remboursé » — « Un billet de « {titre} » ({catégorie}) est remboursé à son acheteur, à sa demande : il est retiré de vos ventes. » ; regroupé : « {n} billets de « {titre} » sont remboursés à leurs acheteurs depuis {heure} : ils sont retirés de vos ventes. » ; lien `?tab=ventes` |
| SMS de `TRANSFER_EXPIRED` | expéditeur | transfert non accepté à temps | + S | « Event Village : votre billet {titre≤30} n'a pas été accepté à temps : il vous revient. {URL}/tickets » (124 / 142) |
| SMS de `TRANSFER_DECLINED_SENDER` | expéditeur | transfert refusé | + S | « Event Village : le destinataire a refusé votre billet {titre≤30}. Il vous revient : {URL}/tickets » (121 / 138) |
| SMS de `TRANSFER_RECIPIENT_CHANGED` | expéditeur | destinataire qui change de numéro | + S | « Event Village : transfert du billet {titre≤25} annulé, le destinataire a changé de numéro. Il vous revient : {URL}/tickets » (146 / 159) |
| SMS de `FUNDS_AVAILABLE` | partenaire | recettes devenues retirables | + S | « Event Village : les recettes de {titre≤30} sont disponibles. Demandez votre retrait : {URL}/partner/finance » (131 / 149) |
| SMS de `SCAN_REFUSALS_ALERT` | partenaire | refus en série à une porte pendant l'événement (push seulement si abonné) | + S | « Event Village : {porte≤12} : {n} refus en {m} min pour {titre≤20}. Vérifiez cette porte avec votre équipe. {URL}/partner/events » (145 / 159) |
| Moyen de contact du support | tous | « Contactez le support » sans dire comment (`PASSWORD_CHANGED`, `PHONE_CHANGED`, `PARTNER_SUSPENDED`, `ACCOUNT_SUSPENDED`) | — | adresse `SUPPORT_EMAIL` dans la cloche et, quand ça tient, dans le SMS : « Event Village : le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, écrivez à support@eventvillage.sn » (128) |
| `ACCOUNT_DELETED` (G-02 c) | compte supprimé | suppression d'un compte | S E | « Event Village : votre compte a été supprimé à votre demande ou par l'administration. Pour toute question : support@eventvillage.sn » (à mesurer à l'implémentation) |

**Liens à corriger** (G-80) : `INVITATION_RECEIVED` → `/tickets` (les billets sont dans « À venir », « Reçus » dit
« Aucun billet reçu en attente ») ; `TICKET_CANCELLED` et `TICKET_REFUNDED_HOLDER` → `/tickets?tab=historique` ; alertes
de versement (`ADMIN_REFUND_TO_RETRY`, `ADMIN_CASHOUT_UNCERTAIN`, `ADMIN_CASHOUT_TO_RESUME`,
`ADMIN_WITHDRAWAL_REJECTED`) → `/admin/finance#versements-a-reprendre`. **À retirer** : SMS de `CONTROLLER_ACTIVATED`
(il vient d'activer à l'écran), email de `ADMIN_EVENT_PUBLISHED`. **À regrouper** : `ADMIN_NOTIFICATION_FAILED`, une
alerte par ligne et par administrateur aujourd'hui (`M/20261103000002_lot6_outbox.sql:635-655`) → « Envois en échec » —
« {n} notifications ont échoué depuis {heure}, dont {k} par SMS. Ouvrez la supervision pour les relancer. », une par
heure.

**Changements** : E-04, E-05 (P1) ; E-40 à E-52 (P2) ; E-67 à E-70 (P3).

---

## 8. Cohérence

### 8.1 Écarts au glossaire encore affichés (module événements)

Recherche par `rg` dans `app/`, `components/`, `lib/` (`*.ts`, `*.tsx`), commentaires exclus, puis tri à la main des
chaînes réellement affichées. Les services fermés (salles, tables, commandes) sont mis à part.

| Terme à ne pas employer | Occurrences | Écarts visibles | Mot retenu |
|---|---|---|---|
| « FCFA » (G-78) | 29 | **6** : PDF du billet `app/api/tickets/[id]/pdf/route.ts:114`, `:118` (« Total payé :{total} FCFA », sans espace) ; statistiques `app/partner/stats/page.tsx:281`, `:313`, `:353` ; `app/api/withdrawals/otp/route.ts:23`. Les 21 autres : services fermés | « F CFA » par `formatFcfa` |
| « F » seul après un montant | 3 | `app/partner/stats/page.tsx:245` (« CA Total ») ; `lib/payments/cashout.service.ts:298` (« ({solde} F disponibles) », lu par l'administration) | « F CFA » |
| montant sans `formatFcfa` | 4 | `lib/events/event.service.ts:132` (refus du prix minimum lu par la partenaire) ; servis non affichés : `catalog.server.ts:131`, `:213`, `app/api/events/[id]/route.ts:128` | `formatFcfa` |
| « ticket » | 3 | titre d'onglet « … Ticketing & Réservations » (`app/layout.tsx:26`) ; « Lecture du ticket Z… » (`app/api/controller/shifts/[id]/summary/route.ts:34`) | « billet », « récapitulatif de caisse » |
| « Z de caisse », « le Z » | 4 | `components/shifts/ShiftModals.tsx:361`, `:366` ; `components/partner/pilotage/ClosingTab.tsx:163`, `:167` | « Récapitulatif de caisse » |
| « capacité » au sens jauge | 6 | « Vendus / capacité » (`app/partner/dashboard/page.tsx:338`) ; « Capacité mise en vente » (`ClosingReportSummary.tsx:39`, PDF `partner-dashboard.service.ts:918`, `:943`) ; « Capacité totale (jauge) » (`EventForm.tsx:1000`) ; refus SQL (`M/20261110000011_lot9ter_stock.sql:322`) | « jauge », « quantités mises en vente » |
| « catégorie » pour le type d'événement | 1 | « Catégorie de l'événement » (`EventForm.tsx`, étape 1) | « Type d'événement » (le glossaire réserve « catégorie » aux billets) |
| « Porteur » | 3 | « Porteur non renseigné » (`CombatFlashOverlay.tsx:261`, `:273`) ; `TicketRefundPanel.tsx:279`, alors que `ManualEntryForm.tsx:120` et `ScanResultPanel.tsx:116` disent « Titulaire » | « Titulaire » |
| « Transfert en attente » | 1 | pastille `TicketCard.tsx:494` (la ligne voisine dit « Transfert en cours ») | « Transfert en cours » |
| « Vente » pour l'origine | 1 | `TicketRefundPanel.tsx:280` | « Origine » |
| « code de confirmation » | 1 | « Recevoir le code de confirmation » (`app/partner/finance/page.tsx:769`) | « code de retrait » |
| « Un utilisateur » | 1 | « Envoyé par Un utilisateur » (`IncomingTransfers.tsx:73`) | « Envoyé par un client d'Event Village » |
| « reversements » | 1 | « avec des reversements par SamirPay » (`app/partner/register/page.tsx:381`) | « vos recettes vous sont versées sur Wave ou Orange Money » |
| « admin », « superadministrateur » hors administration | 3 | « Administrateurs et Superadministrateurs » (`LoginForm.tsx:56`) ; « … ou à un admin » (refus lu par un contrôleur, `shift.service.ts:186`) | « Superadmin », « administrateur » |
| « bientôt complet » | 1 | libellé du réglage (`finance-settings/page.tsx:81`) | « Plafond « Dernières places » » (U2) |
| « organisateur » dans un écran de la partenaire | 7 | « Espèces du guichet rendues par l'organisateur » et voisins (`RefundProgress.tsx:118`, `:127` ; `CashRefundsList.tsx:108`, `:128`, `:167` ; `TicketRefundPanel.tsx:104`) ; « affiché aux clients et aux organisateurs » (`app/partner/profile/page.tsx:278`) | à arbitrer (section 11) : « par vous » dans le pilotage, « par l'organisateur » côté client |
| « organisateur(s) » dans l'administration | — | « Examinez les soumissions des organisateurs… » (`admin-evenements-en-attente`) ; confirmations de la section 5.3 ; rôle « Organisateur » dans l'audit et l'historique | « partenaire » |
| Numéro mal saisi | 5 textes | « Numéro sénégalais de 9 chiffres requis (ex : 77 123 45 67). » (`app/partner/team/page.tsx:284`) ; « Saisissez un numéro sénégalais à 9 chiffres… » (`TeamTab.tsx:334`) ; « Numéro 1 : saisissez un numéro sénégalais à 9 chiffres… » (`InvitationsTab.tsx:92`) ; textes serveur de G-35 | « Numéro de mobile sénégalais invalide. Exemple : 77 123 45 67. » (`INVALID_SN_PHONE_MESSAGE`) |
| « Superadmin » | 4 libellés | voir 5.2 (G-45) | « Superadmin » |

Sans écart affiché : « XOF » (champ technique), « formule », « rejeté », « OTP », « cashout » / « payout », « Vos
billets » comme titre de page (en dehors des SMS).

### 8.2 Un seul nom par chose, mêmes boutons aux mêmes endroits

| Écart | Où | Proposition |
|---|---|---|
| Recettes en ligne moins remboursements : « Net partenaire », « Recettes en ligne », « Montant net organisateur » | `app/partner/dashboard/page.tsx:366`, `:509` ; `app/partner/events/page.tsx:235` ; `SalesTab.tsx:57` ; `ClosingReportSummary.tsx:23`, `:44` | « Recettes en ligne nettes » partout ; « Ventes en ligne » pour le brut |
| Page des événements de la partenaire : « Événements » (menu), « Billetterie » (barre du bas), « Mes événements » (titre, retour) | `AppLayout.tsx:163` ; `app/partner/events/page.tsx:203` | « Événements » dans la barre ; « Billetterie » garde un seul sens (la vente de billets) |
| Équipe : « Numéro du contrôleur » / « Téléphone du contrôleur » ; interrupteur / case pour les espèces ; « Contrôleur » / « Compte sans nom » | section 3.1 | un composant, un vocabulaire |
| Retrouver un billet par son numéro : « Vérifier le billet » (scanner) / « Rechercher le billet » (pilotage) | `ManualEntryForm.tsx` ; `TicketRefundPanel.tsx` | « Rechercher le billet » tant que rien n'est validé |
| Caisse : titre « Ouvrir ma caisse » / bouton « Ouvrir la caisse » ; « Clôturer ma caisse » / « Clôturer la caisse » | `ShiftModals.tsx:117`, `:154`, `:246`, `:254` | boutons identiques aux titres |
| Rembourser : « Rembourser ce billet » → « Continuer » → « Rembourser le client » | `TicketRefundPanel.tsx:70-71`, `:327` | « Rembourser ce billet » puis « Confirmer le remboursement » |
| Clôture d'un suspendu : « Terminer l'événement ? » / « Clore l'événement » / « Motif de la clôture » (G-61) | `app/admin/events/[id]/page.tsx:219-225`, `:791-795` | « Clore » partout pour un suspendu |
| Actualiser : bouton texte (tableau de bord, Finances) / icône seule (Espèces à rembourser) ; deux icônes seules pour deux retraits (`/partner/team`) | `pilotage-especes-a-rembourser` ; `partenaire-equipe__ordinateur` | toujours un texte |
| Un bouton principal qui n'est pas la tâche de l'écran : « Réserver un billet » sur Mes billets ; « Scanner des billets » sur un tableau de bord vide | `app/tickets/page.tsx:290-292` ; `app/partner/dashboard/page.tsx:430` | un principal par écran, celui de sa tâche |
| Confirmation du mot de passe : non (client), oui (partenaire, contrôleur) ; trois règles de mot de passe (G-31) | `app/register/page.tsx:520-545` ; `app/partner/register/page.tsx:576` ; `app/controller/setup/page.tsx:249-257` | une seule règle, bouton « Afficher », sans confirmation |
| Échec de paiement : secondaire « Mes billets » ; succès : « Voir mes billets » | `paiement-echec`, `paiement-succes` | échec : « Retour à l'événement » |
| Trois manières de refuser selon l'écran de l'administration | section 5.5 | refus qui nomme la permission et mène à « Mes droits » |

**Changements** : E-64, E-66 (P2) ; E-74, E-85 (P3).

---

## 9. Liste consolidée des changements E-01 à E-86

Constats liés : `G-xx` (guide), `N-xx` (section 0), décisions `D1`, `D2`, `D3`, `U1` à `U4`, `A1`, `A2`. Les textes
exacts sont dans la section citée.

### P1 — avant la mise en ligne (12)

| Id | Changement | Liés | Critère d'acceptation vérifiable | Effort | Section |
|---|---|---|---|---|---|
| E-01 | Fin retenue affichée en direct sous les dates du formulaire ; aides « Date de fin » / « Heure de fin » ; fiche admin calculée (« dim. 6 déc. 2026 à 02:00 (non saisie : début + 6 h) ») | G-10 | Début 05/12/2026 20:00 sans fin : le formulaire affiche « Fin retenue : dim. 6 déc. 2026 à 02:00 … » et la fiche admin « dim. 6 déc. 2026 à 02:00 (non saisie : début + 6 h) » ; `rg "fin de journée"` ne trouve plus rien | S | 4.2 |
| E-02 | Fiche, téléphone : barre fixe dès l'ouverture (« Billetterie » / libellé A2 + « Choisir mes billets »), remplacée par « Acheter (…) » dès qu'un billet est choisi | N-03 | Capture `evenement-publie__mobile` : un prix et « Choisir mes billets » visibles sans défiler ; un appui amène « Choisissez vos billets » en haut de l'écran | S | 2.4 |
| E-03 | Finances partenaire : « Montant envoyé : {net} · frais : {frais} » pour tout retrait, « Versé le {date} : {net} » pour un retrait versé seulement | N-02 | Capture `partenaire-finances-retrait-retarde` : aucun « Versé » sur un retrait « Retardé », « En attente » ou « En cours d'envoi » | S | 2.3 |
| E-04 | `ACCOUNT_SUSPENDED` : plus de promesse du billet hors ligne ; numéro du billet et pièce d'identité ; lien `/login` | G-05, N-10 | Texte sans « hors ligne » ; lien ≠ `/billet/hors-ligne` ; SMS ≤ 160 GSM-7 (140 / 150) | S | 7.3 |
| E-05 | `ADMIN_SMS_CAP_GLOBAL` et `ADMIN_SMS_CAP_NON_OTP` disent ce qui s'arrête vraiment ; « UTC » retiré | G-13 | Rendu des deux modèles : textes de 7.3 mot pour mot ; ni « les envois sont suspendus » ni « seuls les codes » | S | 7.3 |
| E-06 | `/admin/finance` : « Gagné par Event Village », « Dû aux partenaires », « Retirable par Event Village », bloc « Créances » ; fonction `finance_admin_summary` et lecture du solde SamirPay | N-04, G-25, G-90, N-14 | Jeu d'essai : un paiement de 23 625 F CFA (prix 22 500), solde simulé 30 000 F CFA → « Dû aux partenaires » 22 500 F CFA ; « Retirable » = 30 000 − 22 500 − réserve ; solde illisible → « ne retirez rien » | M | 5.4 |
| E-07 | Ligne « Versements à reprendre » en tête de l'accueil de l'administration ; ancre `#versements-a-reprendre` ; les alertes de versement y mènent | N-05 | Un versement bloqué : la carte est visible sur l'accueil à 390 px sans défiler ; le lien de l'alerte fait défiler jusqu'au bloc | S | 5.1 |
| E-08 | Verrou des services pas prêts : « Services en préparation », mention « Pas prêt… », saisie de ACTIVER | G-44 | Activer « Salles de fête » sans taper ACTIVER est impossible | S | 5.6 |
| E-09 | `DELETE /api/partner/team/all` exige `partnerId` pour un admin ; la page le passe | N-01, G-69 | Admin sans `partnerId` : refus 400, aucune affectation supprimée ; avec : seules celles de cet organisateur | S | 3.2 |
| E-10 | Onglet Équipe : « Renvoyer… » seulement pour un compte à activer, avec le prénom ; toast « SMS renvoyé à {nom}… » | G-21, N-11 | Contrôleur activé : aucun bouton de renvoi ; compte à activer : SMS « Bonjour {prénom}… » ; plus de « Droits mis à jour » pour un renvoi | S | 3.2 |
| E-11 | Onglet Équipe : invitations en attente visibles (« Invitation envoyée ») | G-22 | Après « Envoyer l'invitation » dans l'onglet, la ligne apparaît sans recharger, et sur `/partner/team` | S | 3.2 |
| E-12 | Fenêtre des droits : grille vidée et « Chargement… » avant la lecture ; échec → « Droits illisibles : fermez et rouvrez. », « Enregistrer » grisé | N-07 | Ouvrir les droits de B après ceux de A ne montre jamais les cases de A ; lecture en échec : « Enregistrer » inactif | S | 5.5 |

### P2 — juste après la mise en ligne (54)

| Id | Changement | Liés | Critère d'acceptation vérifiable | Effort | Section |
|---|---|---|---|---|---|
| E-13 | Lecture unique `partner_team_view` (porte, point d'entrée, espèces, caisse, entrées, dernier scan, état, activation, invitations, `other_organizers`, `can_manage`, alertes) | G-22, G-65, G-72 | Une requête par affichage ; chaque cellule de 3.2 vient de la réponse, aucun comptage à l'écran | M | 3.2 |
| E-14 | Composant `TeamPanel` sur `/partner/team` et dans l'onglet ; porte et espèces par événement ; une fenêtre « Modifier » avec un seul « Enregistrer » ; bandeaux ; liens Caisse, Entrées, PIN (`onOpenTab`) | G-21, G-22, U1 | Un seul fichier de liste ; mêmes libellés aux deux endroits ; liste visible au premier écran de l'onglet à 390 px ; « Caisse ouverte » ouvre l'onglet Caisse sans recharger | L | 3.2 |
| E-15 | Appeler (`tel:`) et WhatsApp (`wa.me`, messages prêts sans code) | — | Sur téléphone, « Appeler » ouvre le composeur avec +221… ; « WhatsApp » ouvre `wa.me` avec le texte prêt | S | 3.2 |
| E-16 | « Retirer de l'équipe » remplace « Retirer de tous » et « Supprimer » ; texte selon qu'il contrôle pour d'autres ; toast selon `deactivated` | G-68 | La fenêtre cite la déconnexion de tous les appareils quand elle aura lieu ; plus aucune icône seule pour un retrait | S | 3.2 |
| E-17 | Droits de l'admin dans l'équipe : `can_manage` = propriétaire ou `events.write` ; choix de l'organisateur obligatoire sur la page | G-69, G-72 | Admin `events.write` : boutons de l'onglet présents et efficaces ; admin `events.read` : aucun bouton ; « Retirer de l'équipe » réussit | S | 3.2 |
| E-18 | Fenêtre « Ce numéro a déjà un compte » au texte unique | G-64 | Le mot « affectation » n'apparaît plus dans cette fenêtre | S | 3.2 |
| E-19 | Invitations : expirées et refusées visibles (« Inviter de nouveau », « Effacer ») ; « Renvoyer l'invitation » ; « Annuler l'invitation » (statut, RPC, route) | G-65 | Invitation refusée : « Refusée le {date} » ; après annulation, `/invitations` du titulaire dit « Aucune invitation en attente » | M | 3.2 |
| E-20 | Avis à la partenaire quand un contrôleur accepte, refuse ou laisse expirer ; relecture de l'équipe | G-65, G-75 | Trois cas de test : une cloche chacun, avec le nom ; SMS de refus si l'événement est à moins de 48 h (145 / 156) ; la ligne passe à « Prêt » sans « Actualiser » | M | 7.4 |
| E-21 | Activation : « Code envoyé le … / Code expiré le … » | — | Compte à activer dont le code a 25 h : « Code expiré le … » | S | 3.2 |
| E-22 | Couleur au contrôle automatique (Turquoise, Or, Rose, Bleu nuit, Blanc, Violet, Argent, Noir), pastilles ; consigne sous « Options d'entrée (facultatif) » ; acceptées par `event_create` | A1, U3 | Standard + VIP créés sans toucher aux couleurs → TURQUOISE puis OR en base ; une 9e catégorie → « Aucune couleur » avec l'aide ; consigne saisie à la création visible au scan sans passer par « Modifier » | M | 4.2 |
| E-23 | Étape 5 « Entrées (facultatif) » ; zones enregistrées avec l'événement (atomique) ; même étape en modification ; l'onglet Équipe n'en garde qu'un résumé ; nom de l'onglet « Entrées » du pilotage tranché | U1, U3 | Parcours B en une visite ; le brouillon créé a 2 zones et 3 portes ; l'onglet Équipe ne contient plus d'éditeur de zones | M + M | 4.2, 4.4 |
| E-24 | Écran « Vérifier avant d'envoyer » : manques, « Après la validation », « Soumettre à la validation » ; étapes nommées sur téléphone | U3 | Parcours A : 12 touches, aucune visite de la liste avant la soumission ; brouillon sans affiche → « Avant de soumettre » avec « Ajoutez une affiche à l'événement. » | S à M | 4.2 |
| E-25 | Message de validation : cloche, push et email listent contrôleurs, invitations, PIN de caisse ; SMS inchangé | U3 | Le modèle rendu contient « invitez vos contrôleurs », « envoyez vos invitations », « code PIN de caisse » ; SMS toujours 1 segment | S | 4.2 |
| E-26 | Prix minimum : refus par catégorie dans `event_create`, aide avec le minimum, contrôle au « Suivant » | G-60 | VIP à 50 F CFA → étape 4 ouverte, message sous le prix de « VIP », aucune ligne « Formulaire : » | S | 4.2 |
| E-27 | Encadré de modification réécrit ; aide « prévenus » dès Validé et sous la fin | — | Événement Validé : l'aide est sous titre, dates, heures de fin, lieu, ville, adresse ; l'encadré contient « Rien ne repasse en validation » | S | 4.3 |
| E-28 | Fenêtre « Prévenir les détenteurs de billets ? » avant d'enregistrer ; heure réelle d'envoi après | G-18 | Début à 40 min : la fenêtre dit « un SMS tout de suite » ; après enregistrement, aucun « dans 10 minutes » quand le SMS est parti | M | 4.3 |
| E-29 | Page « À faire aujourd'hui » complète, route `GET /api/admin/todo` | G-47, N-14 | Les 8 lignes ; « Rien à faire pour le moment » ; ADMIN avec `events.read` seul : lignes 2 et 4 et « Voir mes droits » | M | 5.1 |
| E-30 | Finance : période commune en haut, une date par opération, filtre de statut limité au tableau, frais de retrait affichés, frais estimés limités aux retraits ; même « Gagné » sur l'accueil | G-25, G-85, G-86, G-90 | Paiement entièrement remboursé → 0 F CFA de part des partenaires ; même « Gagné » sur l'accueil et la finance pour « Ce mois-ci » | M | 5.4 |
| E-31 | Statuts de paiement en français (`REFUND_PENDING` et capitales remplacés), même mot dans le filtre et le badge | — | Aucun badge en capitales ni code brut dans `/admin/finance` | S | 5.2 |
| E-32 | Confirmations de l'administration avec qui est prévenu, par quel canal, ce qui est bloqué, ce que le SMS garde du motif ; clôture titrée « Clore l'événement ? » ; « Terminer » masqué avant le début | G-06, G-20, G-39, G-59, G-61, N-08 | Chaque boîte de 5.3 contient « Prévenu » ou « Prévenus » ; essai 93 de la recette mis à jour avec le nouveau titre | S | 5.3 |
| E-33 | « Constater non versé » : messages distincts d'un refus de l'opérateur, et boîte qui le dit | G-28 | Constat sur un retrait : la cloche et le SMS reçus ne contiennent pas « opérateur » | S | 7.3 |
| E-34 | Menu et barre du bas filtrés par permission ; page « Mes droits » ; bandeaux « Lecture seule » ; refus qui nomme la permission ; entrée « Scanner » retirée | G-08, G-38 | ADMIN avec `events.read` et `events.write` : menu « Accueil », « Événements », « Catalogues et services », « Réglages de la plateforme », « Mes droits » et rien d'autre ; sans `statistics.read` : « Votre compte n'a pas la permission « Voir les indicateurs ». » | M | 5.5 |
| E-35 | Réglages de la plateforme : entrée de menu, suppression de « Tarification », sommaire, recherche, auteur dans l'historique, bornes vérifiées avant l'envoi, confirmation avant → après, explications et valeurs risquées | G-43, G-74, G-76, G-91, G-95, G-14 | Entrée visible dans le menu d'un ADMIN et du Superadmin ; saisir 60 dans « Frais de service » affiche « Choisissez entre 0 et 50 % » sans envoi ; l'historique montre l'auteur | M | 5.6 |
| E-36 | Création d'un ADMIN enchaînée sur ses droits ; profils prêts ; dépendances cochées d'office ; libellés et phrases des 16 permissions ; `pricing.manage` et `shifts.read` masqués | G-31, G-37, G-42 | Créer un ADMIN mène à la grille dans la même fenêtre ; cocher « Valider, refuser ou réactiver un partenaire » coche « Voir les candidatures… » | M | 5.5 |
| E-37 | `/admin/users`, `/admin/referral`, `/admin/audit` sur le système de design, paginés, utilisables à 390 px ; libellés de 5.2 | G-37, G-38, G-45 | Captures `admin-comptes`, `admin-parrainage`, `admin-journal` ajoutées au script : 0 cible sous 44 px, 0 texte sous 14 px | M | 5.2, 5.7 |
| E-38 | Bloc `#creances` dans la finance ; `ADMIN_FINANCE_DEBT` nomme le compte et y mène | N-14 | L'avis « Créance sur un compte » ouvre un bloc qui liste le partenaire et le montant | S | 5.4 |
| E-39 | Suppression d'un compte : bouton masqué sur un compte partenaire ; texte sans jargon ; saisie de SUPPRIMER | G-02 | Aucun bouton « Supprimer » sur une ligne de partenaire | S | 5.3 |
| E-40 | `ADMIN_SMS_DAILY_THRESHOLD` et aides des réglages SMS justes | G-14 | Plus de « jamais plafonnés » ni de « pas de plafond » seul | S | 7.3 |
| E-41 | Limite de 30 SMS par compte déclencheur levée pour les SMS indispensables déclenchés par un administrateur ou la propriétaire de l'événement | G-14 | 31 invitations annulées par une partenaire → 31 SMS « Envoyée » | M | 7.3 |
| E-42 | Liens des messages : `INVITATION_RECEIVED` → `/tickets` ; `TICKET_CANCELLED`, `TICKET_REFUNDED_HOLDER` → `?tab=historique` ; alertes de versement → ancre | G-80 | Un appui sur la cloche montre le billet ou la liste concernée sans défiler | S | 7.4 |
| E-43 | `PARTNER_REJECTED` en deux variantes ; SMS avec la suite | G-16, G-39 | Second refus : la cloche ne contient pas « Vous pouvez compléter » | S | 7.3 |
| E-44 | Motif de réactivation transmis, ou promesse retirée de l'écran | G-06 | Réactivation avec « Vérification faite » : la cloche reçue le contient, ou l'écran ne promet plus rien | S | 7.3 |
| E-45 | `REFUND_REQUESTED` : titres justes ; SMS et push quand la partenaire ou l'administration rembourse | N-09 | Remboursement lancé par la partenaire : SMS au client (133 / 158) | S | 7.3 |
| E-46 | SMS quand un billet revient à l'expéditeur (expiré, refusé, numéro changé) | — | Transfert expiré : SMS 124 / 142 | S | 7.4 |
| E-47 | SMS de `FUNDS_AVAILABLE` et de `SCAN_REFUSALS_ALERT` | — | SMS mesurés 131 / 149 et 145 / 159 | S | 7.4 |
| E-48 | Avis à la partenaire quand un billet est remboursé à la demande d'un client | G-93 | Cloche dans la minute ; ligne « remboursé » dans le résumé du lendemain | S | 7.4 |
| E-49 | D1 — SMS regroupé aux administrateurs qui peuvent agir | D1 | Critères 1 à 5 de 6.1 | M | 6.1 |
| E-50 | D2 — report à 8 h des SMS optionnels de la nuit | D2, G-95 | Critères 1 à 5 de 6.2 | M | 6.2 |
| E-51 | D3 — cloche de ventes regroupée 15 min, résumé SMS à 9 h, `FIRST_TICKET_SOLD` sans SMS, un seul SMS « complet » | D3, N-13 | Critères 1 à 4 de 6.3 | M | 6.3 |
| E-52 | U4 — « Prévenir par WhatsApp » (fenêtre de transfert et carte du billet) | U4, G-81 | Critères de 6.5 | S | 6.5 |
| E-53 | U2 — seuil « Dernières places » relatif, réglage devenu plafond | U2, G-76 | Critères de 6.4 | M | 6.4 |
| E-54 | A2 — « Gratuit », « Gratuit ou dès … », « Dès … » ; « Complet en ligne » | A2, G-77, N-12 | Critères de 6.6 | S | 6.6 |
| E-55 | Bandeau du paiement en attente gardé jusqu'au statut final, avec « Annuler ce paiement » | G-23 | Paiement en attente de 15 min : le bandeau est visible sur la fiche avec les deux boutons | S | 2.4 |
| E-56 | Écrans d'authentification : lire `retryAfterSeconds` et le message du serveur | G-12 | Quota de connexion par code atteint : décompte = `retryAfterSeconds` (15 min), texte du serveur visible | S | 2.4 |
| E-57 | « Recevoir un code de connexion » ouvre l'onglet « Code SMS » prérempli | G-32 | Depuis `/register` avec un numéro inscrit : onglet « Code SMS » actif et numéro rempli | S | 2.4 |
| E-58 | Mes billets : boutons d'en-tête en ligne secondaire, « Réserver un billet » à vide seulement ; le jour J, QR du prochain billet en premier | — | Capture `mes-billets__mobile` le jour J : le QR est dans le premier écran (844 px) | M | 2.4 |
| E-59 | Mes paiements : « Remboursement en cours », « Remboursement retardé, l'équipe Event Village s'en occupe. » | G-89 | Billet remboursé, versement non confirmé : la ligne n'affiche plus « Confirmé » | S | 2.4 |
| E-60 | Scanner « Transfert en cours » : ligne « Le client doit annuler le transfert dans Mes billets, ou le destinataire l'accepter, puis présenter le billet. » | G-73 | Capture `scanner-transfert-en-cours` : la ligne est visible sous le titre | S | 2.5 |
| E-61 | Saisie manuelle et remboursement : numéro accepté par ses 10 derniers signes, sans tirets, en minuscules ; remboursement aussi par le téléphone du titulaire | — | Saisie « cbabc7a6ac » → billet TCK-20261112-CBABC7A6AC de l'événement ; deux billets de même suffixe sur deux événements : seul celui de l'événement du contrôleur | M | 2.3, 2.5 |
| E-62 | Contrôleur : connexion par code refusée tant que le compte n'est pas activé (à arbitrer) ; une seule règle de mot de passe ; numéro mis en forme | G-97, G-31 | Compte invité non activé : `send-otp` refusé avec « Activez d'abord votre compte contrôleur avec le lien reçu par SMS. » ; l'activation applique la règle commune | S | 2.5, 11 |
| E-63 | Caisse : écart dit en mots ; « Récapitulatif de caisse » ; boutons identiques aux titres ; texte G-66 juste ; PIN « a 6 chiffres » | G-66 | Captures `caisse-cloture-ecart`, `caisse-ticket-z`, `pilotage-caisse` : aucun « Z », aucun écart précédé d'un signe seul | S | 2.5 |
| E-64 | « Recettes en ligne nettes » partout ; rapport de clôture en cascade brut → remboursé → net ; carte doublon du guichet retirée ; « Quantités mises en vente » | G-26, G-27 | Rapport avec remboursements : brut − remboursé = net affiché ; `rg "Net partenaire\|Montant net organisateur"` vide | S | 2.3, 8.2 |
| E-65 | Partenaire : aide de l'email (G-51), phrase « profil modifiable » retirée (G-15), blocage des retraits annoncé au changement de numéro (G-34), lien « Statistiques de ventes » masqué (G-50), activités des services fermés masquées | G-15, G-34, G-50, G-51 | Textes présents ou absents par `rg` ; essai 9 de la recette n'attend plus la modification du profil en attente | S | 2.3 |
| E-66 | Glossaire à l'écran : « F CFA » dans le PDF et partout ; « Titulaire », « Transfert en cours », « Origine », « code de retrait », « Type d'événement », « Superadmin », « jauge » ; texte unique du numéro mal saisi | G-35, G-78 | `rg` des termes de 8.1 sur `app components lib` (hors services fermés et commentaires) : 0 occurrence affichée | S | 8.1 |

### P3 — plus tard (20)

| Id | Changement | Liés | Critère d'acceptation vérifiable | Effort | Section |
|---|---|---|---|---|---|
| E-67 | `TICKET_CANCELLED` nomme l'auteur réel | G-83 | Annulation par un admin → « l'équipe Event Village » | S | 7.3 |
| E-68 | `CONTROLLER_ACTIVATED` sans SMS ; `ADMIN_EVENT_PUBLISHED` sans email | — | Registre : canaux retirés | S | 7.4 |
| E-69 | `ADMIN_NOTIFICATION_FAILED` regroupé par heure | — | 50 échecs en 1 h → une cloche par administrateur | M | 7.4 |
| E-70 | Contact du support dans les messages ; `PARTNER_REGISTERED_ACK` et `EVENT_CLOSED_HOLDER` complétés ; types des services fermés hors recette ; `ACCOUNT_DELETED` | G-02, G-19, G-54, G-94 | SMS mesurés 128 et 112 ; textes du tableau 7.2 | S | 7.2, 7.4 |
| E-71 | Candidatures : recherche, onglet « Suspendus », compteurs lus avec `partners.read` | G-47 | ADMIN avec `partners.read` sans `statistics.read` : nombres des onglets visibles | S | 2.1 |
| E-72 | Journal d'audit en français : libellés, familles, détail en phrases, JSON replié | G-40 | Aucun code en capitales ni JSON visible sans ouvrir « Détail technique » | M | 5.2 |
| E-73 | Bouton « ? » et textes d'aide des écrans sensibles | — | Un « ? » sur Finance, Versements, Réglages, Droits, Suspendre ; feuille du bas à 390 px | S | 5.8 |
| E-74 | « (erreur {status}) » remplacés ; « Superadmin » partout ; « Partenaire » au lieu d'« Organisateur » dans l'administration | G-45 | `rg "erreur \${res.status}" app/admin components/admin` ne trouve plus rien d'affiché | S | 5.2 |
| E-75 | Ligne d'invitation qui dit qu'un événement n'accepte plus de contrôleur ; renommer un compte à activer | G-75 | Ligne « « {titre} » n'accepte plus de contrôleur… » ; « Renommer » change le prénom du prochain SMS | S à M | 3.2 |
| E-76 | `event_controllers` publié en temps réel pour la propriétaire | G-65 | Une affectation faite sur un autre appareil apparaît en moins de 5 s | M | 3.2 |
| E-77 | Erreur « fin de vente dépasse la nouvelle fin » : lien vers le champ « Fin de la vente » de la catégorie nommée | — | Le lien ouvre l'étape 4 et met le focus sur « Fin de la vente » de « VIP » | S | 2.3 |
| E-78 | Étapes du formulaire actuel nommées sur téléphone, en attendant U3 | — | À 390 px, le bouton actif montre son nom | S | 4.1 |
| E-79 | Mes événements : ligne d'état sur la carte ; cartes avant les indicateurs sur téléphone | — | À 390 px, la première carte est visible sans défiler ; brouillon sans affiche → « À compléter : affiche » | M | 2.3 |
| E-80 | « Archiver le brouillon » pour un brouillon déjà soumis ; avertissement au retrait de la validation | N-06 | Un brouillon refusé archivé disparaît de « Brouillon », son historique reste lisible par l'administration | M | 2.3 |
| E-81 | Scanner : titre « QR expiré » et consigne en ligne ; espace insécable avant « : » ; ligne sous « Événement annulé » ; essai des rouges en plein soleil | — | Captures `scanner-refuse`, `scanner-mauvaise-zone`, `scanner-evenement-annule` : titre sur deux lignes au plus, aucune ligne qui commence par « : » | S | 2.5 |
| E-82 | Connexion venant d'un achat : texte et « Créer un compte » au-dessus ; description sans « commandes, réservations » | — | `/login?redirect=/events/…` : « Créer un compte » visible au premier écran | S | 2.4 |
| E-83 | Tableau de bord partenaire sans événement : un seul principal « Créer un événement » ; en-tête du pilotage replié au défilement | — | Capture `partenaire-premiers-pas` : un seul bouton orange | S à M | 2.3 |
| E-84 | Divers : « Encaisser {montant} » au guichet, « Retour à l'événement » sur l'échec de paiement, date de carte allégée, « Portefeuille » masqué au visiteur | — | Captures correspondantes | S | 2.4, 2.5 |
| E-85 | Une seule manière de saisir un mot de passe (bouton « Afficher », sans confirmation) | G-31 | Inscription client, inscription partenaire, activation contrôleur : même champ | S | 8.2 |
| E-86 | Statistiques de la partenaire refaites : mêmes cartes et mots que le tableau de bord, chiffres sur les ventes de la période | G-50 | Page sans « CA », « FCFA », « PUBLIE » ; ventes d'un événement créé avant la période comptées | M | 2.3 |

---

## 10. À ne pas changer

Ce qui marche bien et doit rester tel quel, preuves à l'appui.

**Contrôle des entrées**
- **Cadence du scanner** : 0 appui entre deux entrées validées (retour automatique en 1,5 s, réglable de 1 à 3 s,
  `CombatFlashOverlay.tsx:174-180`) ; refus 3 s ou un toucher ; même QR ignoré 20 s ; vibrations distinctes, aucun son.
- **Plein écran du résultat** : fonds pleins, contrastes de 8:1 à 12,6:1 (`app/globals.css:70-81`), icône + titre +
  couleur (jamais la couleur seule), nom du titulaire en très grand, consigne et bande de couleur de la catégorie
  (`scanner-accepte`, `scanner-accepte-consigne`). Incidents techniques en gris avec « Le billet n'est pas en cause… »
  (`scanner-reseau-lent`).
- **Écran de départ du contrôleur** (porte et compteur annoncés avant la caméra, `scanner-accueil`) ; déconnexion
  confirmée.
- **Saisie manuelle et liste des invités** : vérification avant validation, pièce d'identité, une personne à la fois.
- **Palette fermée de 8 couleurs** sans rouge, vert ni orange, pastille toujours accompagnée du nom
  (`ZonesEditor.tsx:306-309`).
- **Refus serveur du retrait d'un contrôleur dont la caisse est ouverte** (`lib/shifts/shift.service.ts:113-125`) et
  blocage de la suppression d'une porte occupée.
- **Page `/invitations` du titulaire** : organisateur, événements datés, « À accepter avant le … », confirmation
  (`invitation-controleur`) ; consentement du compte existant (72 h, aucun rôle avant l'accord) ; code d'activation
  jamais montré à la partenaire.

**Achat et billets**
- **Fenêtre de paiement** (`paiement-modale`) : récapitulatif, opérateur non présélectionné, numéro prérempli
  expliqué, montant dans le bouton ; pages de suivi, de succès et d'échec claires, avec référence.
- **Panier gardé à la connexion** et retour par `redirect` jusqu'au bout de l'inscription.
- **Onglet « Reçus » ouvert de lui-même** quand un billet attend ; carte de réception claire (`mes-billets-recus`).
- **Page `/billet/hors-ligne`** : QR d'emblée, « Disponible hors ligne » (`billet-hors-ligne-qr`) — modèle du mode
  « Présenter » (E-58).
- **Partage sans numéro de billet** : « Prévenir mon proche » et le partage WhatsApp de la carte ne donnent que le titre
  et le lien.

**Partenaire**
- **Création tout ou rien** (événement et catégories en une transaction) : à étendre aux couleurs et aux zones, pas à
  défaire.
- **Garde avant de quitter** qui nomme ce qui sera perdu (`edition-quitter-sans-enregistrer`) ; **encadré d'erreurs
  cliquable** qui mène au champ ; **liste des manques servie par la base** à la soumission.
- **Annulation** : impact chiffré, avis public distinct du motif interne, titre à retaper (`pilotage-annulation`).
- **Verrous dits en clair** (« Prix verrouillé : 12 billets vendus. Créez une autre catégorie pour un nouveau
  tarif. »).
- **Pas de nouvelle validation après une modification** : à garder, et à dire.
- **Remboursement d'un billet** : fiche complète et phrase de conséquence avant toute action (« Event Village verse
  3 150 F CFA au client sur le compte qui a payé. Le billet ne donnera plus accès à l'événement. »).
- **Finances** : « Disponible au retrait » mis en avant, prochaine disponibilité datée, minimum et frais annoncés avant
  la demande (`partenaire-finances`).
- **« Gérer les affectations »** en une opération tout ou rien, espèces par événement : à garder comme fenêtre « Gérer
  les événements » du panneau.

**Administration**
- **File de validation et fiche d'un événement** : libellés de statut uniques, boutons servis par la base selon les
  droits, motif obligatoire, mise à jour en direct, boutons de 44 px en tête de fiche (`admin-evenements-en-attente`,
  `admin-fiche-en-attente`).
- **Versements à reprendre** : un conseil par état, justification de 10 caractères, relecture SamirPay avant tout renvoi
  pour ne jamais payer deux fois, mot de passe redemandé pour « Constater non versé », numéros masqués « 77 ••• •• 34 ».
- **Supervision des notifications** : statuts, canaux, motifs et types traduits ; « Relancer » refusé sur un envoi
  incertain, avec son explication.
- **Réglages** : motif obligatoire, historique, avertissement « Frais de retrait sous le coût réel », effet jamais
  rétroactif.
- **Droits décidés par le serveur**, l'écran ne fait que masquer (`admin_can`) ; refus qui ne montrent jamais un code.

**Messages**
- **Discipline des SMS** : un segment GSM-7 pour tout le catalogue, valeurs translittérées et coupées, mesure par
  test ; ni lien raccourci, ni jeton, ni QR dans un SMS.
- **Regroupements existants** : changement d'événement fusionné sur 10 minutes, aucun SMS pour un titre seul ; entrées
  validées regroupées par commande ; un SMS d'affectation par opération.
- **Revérification à l'envoi** : un rappel d'un événement reporté, annulé ou commencé ne part pas (c'est ce qui rend D2
  sûr) ; rappel « SMS seulement sans push ».
- **Emails d'achat, de billets gratuits et de billet reçu** : faits, numéros, consignes, aucun QR
  (`email-achat-1-billet`).
- **`formatFcfa`** (`lib/format.ts`) : le seul format de montant, à étendre partout.

---

## 11. Points à arbitrer

| # | Question | Ce que propose la revue | Pourquoi c'est à trancher |
|---|---|---|---|
| 1 | « Tout reste modifiable après validation … sans prévenir les acheteurs » (U3) couvre-t-il la date, les heures et le lieu ? | Non : ces changements continuent de prévenir les détenteurs (section 4.3). | Sans message, un acheteur vient au mauvais endroit ou au mauvais jour, et le droit au remboursement après un report de plus de 24 h suppose d'être prévenu. |
| 2 | Nom de l'étape « Entrées » : le pilotage a déjà un onglet « Entrées » (statistiques de scan). | Lien « Zones et portes : … Modifier » en tête de l'onglet ; à défaut, renommer l'onglet du pilotage « Passages ». | Deux écrans du même nom pour deux choses. |
| 3 | G-97 : un contrôleur jamais activé peut ouvrir une session par code SMS. | Refuser le code tant que le compte n'est pas activé (E-62). Sinon, une connexion par code vaut activation et le badge passe à « Prêt ». | Le badge « Activation en attente » ment dans les deux cas actuels ; choix de sécurité et de consentement. |
| 4 | Numéro du billet absent du SMS d'achat (N-10). | Au minimum, ne plus promettre ce que le client n'a pas (E-04). Ajouter le numéro coûterait un second segment par achat (le SMS est à 159 caractères au pire). | Coût SMS contre entrée possible sans email vérifié. |
| 5 | « Organisateur » dans les écrans de la partenaire (« Espèces à rembourser par l'organisateur »). | « par vous » dans le pilotage, « par l'organisateur » côté client. | Le glossaire cite lui-même cet usage comme admis. |
| 6 | G-15 : partenaire en attente et profil. | Retirer la phrase « votre profil reste modifiable » (E-65), ou ouvrir l'enregistrement du profil en attente. | Décision produit ; l'essai 9 de la recette en dépend. |
| 7 | Invitations de contrôleur expirées ou refusées : « Effacer » une ligne (champ `hidden_at`) ou ne montrer que les 30 derniers jours ; servir à la partenaire le numéro qu'elle a saisi (le lot 1C.1 masque le nom du titulaire). | `hidden_at` et numéro servi. | Règle de confidentialité du lot 1C.1. |
| 8 | Le solde SamirPay compte-t-il un encaissement dès sa confirmation, ou après un délai de règlement ? | Si délai, ligne « En cours de règlement chez SamirPay » dans « Retirable » (E-06). | NON VÉRIFIÉ ; à demander à SamirPay. |
| 9 | Les deux rouges du scanner (#991B1B, #7F1D1D) en plein soleil. | Essai terrain avant tout changement ; repli #B91C1C (blanc 6,5:1). | Non vérifiable sur capture. |
| 10 | `TRIAL_STARTED` et types des services fermés (essai, abonnement, salles, mise en avant). | Ne plus envoyer l'avis d'essai tant que l'essai n'a aucun effet (G-54). | Dépend de la feuille de route des services. |
| 11 | Case « Publier dès la validation » sur l'écran de fin de création. | Idée non chiffrée : épargne deux touches et une visite. | Change le moment où l'événement devient public. |

---

## 12. Captures

40 captures du run 136 (`origin/ci-results`, `runs/136-43301091495`), compressées en JPEG (qualité 80, 390 px de large
pour le téléphone, 960 px pour l'ordinateur ; 1,3 Mo en tout) dans `docs/revue-ergonomie-captures/`. Nom d'origine
conservé : `<écran>__<mobile|ordinateur>__<clair|sombre>`.

| Capture | Ce qu'elle montre | Section |
|---|---|---|
| [partenaire-equipe__mobile__clair](revue-ergonomie-captures/partenaire-equipe__mobile__clair.jpg) | nom répété, numéro non cliquable, « Encaissement espèces autorisé » global, pastilles sans date | 3 |
| [partenaire-equipe__ordinateur__clair](revue-ergonomie-captures/partenaire-equipe__ordinateur__clair.jpg) | ni porte, ni caisse, ni entrées ; deux icônes de retrait sans libellé | 3 |
| [pilotage-equipe__mobile__clair](revue-ergonomie-captures/pilotage-equipe__mobile__clair.jpg) | l'onglet s'ouvre sur le formulaire d'invitation, la liste est hors écran | 3 |
| [partenaire-equipe-portes__mobile__clair](revue-ergonomie-captures/partenaire-equipe-portes__mobile__clair.jpg) | « Enregistrer » au-dessus de « Peut changer de porte », renvoi proposé à un contrôleur actif (G-21) | 3 |
| [pilotage-caisse__mobile__clair](revue-ergonomie-captures/pilotage-caisse__mobile__clair.jpg) | caisses et PIN dans un autre onglet, sans lien depuis l'équipe ; écart signé | 3, 2.3 |
| [invitation-controleur__mobile__clair](revue-ergonomie-captures/invitation-controleur__mobile__clair.jpg) | invitation claire côté titulaire (à garder) | 10 |
| [partenaire-creation__mobile__clair](revue-ergonomie-captures/partenaire-creation__mobile__clair.jpg) | étapes « 1 2 3 4 » sans nom ; « Catégorie de l'événement » avec des services fermés | 4.1 |
| [partenaire-categorie-canaux__mobile__clair](revue-ergonomie-captures/partenaire-categorie-canaux__mobile__clair.jpg) | couleur au contrôle au bout d'une longue carte, en modification seulement (A1) | 4.1 |
| [partenaire-zones__mobile__clair](revue-ergonomie-captures/partenaire-zones__mobile__clair.jpg) | « Zones et portes » sous « Inviter le contrôleur » (U1) | 4.4 |
| [pilotage-apercu__mobile__clair](revue-ergonomie-captures/pilotage-apercu__mobile__clair.jpg) | onglet « Équipe » coupé ; en-tête qui prend près de la moitié de l'écran ; onglet « Entrées » homonyme | 4.4, 2.3 |
| [partenaire-edition__mobile__clair](revue-ergonomie-captures/partenaire-edition__mobile__clair.jpg) | encadré des modifications après validation, incomplet | 4.3 |
| [partenaire-evenements__mobile__clair](revue-ergonomie-captures/partenaire-evenements__mobile__clair.jpg) | aucune carte d'événement au premier écran | 2.3 |
| [pilotage-annulation__mobile__clair](revue-ergonomie-captures/pilotage-annulation__mobile__clair.jpg) | fenêtre d'annulation claire (à garder) | 10 |
| [edition-quitter-sans-enregistrer__mobile__clair](revue-ergonomie-captures/edition-quitter-sans-enregistrer__mobile__clair.jpg) | garde de sortie qui nomme ce qui sera perdu (à garder) | 10 |
| [admin-remboursements-a-reprendre__mobile__clair](revue-ergonomie-captures/admin-remboursements-a-reprendre__mobile__clair.jpg) | versements bien présentés mais loin dans la page ; 58 avis non lus | 5.1 |
| [admin-cloture-motif__mobile__clair](revue-ergonomie-captures/admin-cloture-motif__mobile__clair.jpg) | « Terminer l'événement ? » pour « Clore l'événement », sans dire le SMS ni la réouverture du contrôle | 5.3 |
| [admin-versements-constater-non-verse__mobile__clair](revue-ergonomie-captures/admin-versements-constater-non-verse__mobile__clair.jpg) | ne dit pas le SMS « refusé par l'opérateur » qui part (G-28) | 5.3 |
| [admin-fiche-partenaire-suspendre__mobile__clair](revue-ergonomie-captures/admin-fiche-partenaire-suspendre__mobile__clair.jpg) | suspension sans les personnes touchées ni la coupure du motif | 5.3 |
| [admin-fiche-en-attente__mobile__clair](revue-ergonomie-captures/admin-fiche-en-attente__mobile__clair.jpg) | « Refuser » et « Valider » en tête de fiche (à garder) | 10 |
| [admin-evenements-en-attente__mobile__clair](revue-ergonomie-captures/admin-evenements-en-attente__mobile__clair.jpg) | file de validation lisible (à garder) ; « organisateurs » | 10, 8.1 |
| [admin-notifications__mobile__clair](revue-ergonomie-captures/admin-notifications__mobile__clair.jpg) | supervision claire ; barre du bas d'un ADMIN fixe, sans Réglages | 5.5 |
| [cloche-ouverte__mobile__clair](revue-ergonomie-captures/cloche-ouverte__mobile__clair.jpg) | la cloche coupe le texte : seul le titre compte | 7 |
| [mes-billets-recus__mobile__clair](revue-ergonomie-captures/mes-billets-recus__mobile__clair.jpg) | « Reçus » : bonne destination d'un transfert, mauvaise d'une invitation (G-80) | 7.4 |
| [aide-transfert__mobile__clair](revue-ergonomie-captures/aide-transfert__mobile__clair.jpg) | étape 2 de l'aide, où annoncer WhatsApp (U4) | 6.5 |
| [email-achat-1-billet__390__clair](revue-ergonomie-captures/email-achat-1-billet__390__clair.jpg) | seul support du numéro de billet (N-10) ; email complet (à garder) | 7.3, 10 |
| [evenement-publie__mobile__clair](revue-ergonomie-captures/evenement-publie__mobile__clair.jpg) | premier écran de la fiche sans prix ni bouton d'achat (N-03) | 2.4 |
| [fiche-barre-achat__mobile__clair](revue-ergonomie-captures/fiche-barre-achat__mobile__clair.jpg) | billetterie encore sous le programme et la carte ; barre seulement avec un panier | 2.4 |
| [accueil-dernieres-places__mobile__clair](revue-ergonomie-captures/accueil-dernieres-places__mobile__clair.jpg) | « À partir de » et « Dernières places » (A2, U2) | 6.4, 6.6 |
| [mes-billets__mobile__clair](revue-ergonomie-captures/mes-billets__mobile__clair.jpg) | trois boutons et des onglets avant le billet ; QR hors du premier écran | 2.4 |
| [billet-hors-ligne-qr__mobile__clair](revue-ergonomie-captures/billet-hors-ligne-qr__mobile__clair.jpg) | QR au premier écran : le modèle à suivre | 10 |
| [partenaire-finances-retrait-retarde__mobile__clair](revue-ergonomie-captures/partenaire-finances-retrait-retarde__mobile__clair.jpg) | « Retardé » et « Versé : 5 940 F CFA » sur la même ligne (N-02) | 2.3 |
| [partenaire-premiers-pas__mobile__clair](revue-ergonomie-captures/partenaire-premiers-pas__mobile__clair.jpg) | deux boutons principaux concurrents sur un compte sans événement | 2.3 |
| [partenaire-rapport-cloture__mobile__clair](revue-ergonomie-captures/partenaire-rapport-cloture__mobile__clair.jpg) | « Montant net organisateur », troisième nom des recettes nettes (G-26) | 8.2 |
| [scanner-accepte__mobile__sombre](revue-ergonomie-captures/scanner-accepte__mobile__sombre.jpg) | « Entrée validée » lisible d'un coup d'œil (à garder) | 10 |
| [scanner-accepte-consigne__mobile__sombre](revue-ergonomie-captures/scanner-accepte-consigne__mobile__sombre.jpg) | catégorie, consigne et zone ensemble (à garder) | 10 |
| [scanner-transfert-en-cours__mobile__sombre](revue-ergonomie-captures/scanner-transfert-en-cours__mobile__sombre.jpg) | refus sans consigne (G-73) | 2.5 |
| [scanner-refuse__mobile__sombre](revue-ergonomie-captures/scanner-refuse__mobile__sombre.jpg) | « QR expiré : demandez au client… » en titre de quatre lignes | 2.5 |
| [scanner-mauvaise-zone__mobile__sombre](revue-ergonomie-captures/scanner-mauvaise-zone__mobile__sombre.jpg) | « : billet VIP » en tête de ligne | 2.5 |
| [scanner-saisie-manuelle__mobile__sombre](revue-ergonomie-captures/scanner-saisie-manuelle__mobile__sombre.jpg) | numéro complet de 22 signes à taper | 2.5 |
| [caisse-cloture-ecart__mobile__sombre](revue-ergonomie-captures/caisse-cloture-ecart__mobile__sombre.jpg) | écart « -2 000 F CFA » à interpréter | 2.5 |
