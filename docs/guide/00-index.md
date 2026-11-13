# 00 — Guide complet d'Event Village : sommaire et mode d'emploi

> Ce guide décrit **tout ce que l'application fait aujourd'hui**, pour chaque rôle, chaque écran, chaque bouton,
> chaque scénario et chaque message, afin de vérifier en recette que tout est juste avant de clore le module
> événements. Il ne décrit pas un projet : il décrit le code de `main` à `0889df6` (lots 1 à 9 ter appliqués sur
> event-village-dev). **Aucun code n'a changé pour l'écrire.** Ce que le code fait et que l'écran dit autrement est
> relevé dans `15-constats.md`, sans correction.

## Sommaire

| Fichier | Ce qu'il couvre | Sections | Scénarios (7 points) |
|---|---|---|---|
| `00-index.md` | ce sommaire, comment lire, glossaire, rôles, réponses aux questions de la recette, vérification finale | — | — |
| `01-roles-menus-ecrans.md` | la coquille et les contrôles d'accès ; pour chaque rôle (visiteur, client, partenaire en attente, validée, refusée, suspendue, contrôleur, ADMIN avec et sans chaque permission, SUPERADMIN) le menu latéral et la barre du bas dans l'ordre affiché ; messages de refus ; passage d'un espace à l'autre ; pages présentes mais inutilisables ; pages qu'aucun menu n'ouvre | 01.0 à 01.14 | 6 (01.1 à 01.5, 01.8) |
| `02-comptes.md` | inscription client (numéro d'abord, email facultatif), connexion par mot de passe et par code, verrous, mot de passe oublié (SMS, email), nouveau mot de passe, changement de mot de passe, mot de passe redemandé (10 min), changement de numéro, email et vérification, photo, préférences par sujet, page profil, suspension, réactivation, anonymisation, quotas du compte | 02.1 à 02.20 | 19 |
| `03-partenaire.md` | inscription partenaire en deux étapes (pièces, NINEA, RCCM, code SMS), attente, file et fiche admin, validation, refus avec motif, complément unique et second refus, suspension (cascade, sessions, fonds) et réactivation, essai, profil, abonnement, tableau de bord, statistiques, calendrier, finances (soldes, gel, retraits, devis, refus, verrou de 24 h, suivi), tableau des états du dossier | 03.1 à 03.23 | 22 |
| `04-evenement-cycle.md` | les 7 statuts et les 17 transitions avec qui les fait, fin par défaut (début + 6 h), création en 4 étapes champ par champ, catégories, brouillon, suppression, soumission, retrait, refus, validation, publication (partenaire, admin), modification et verrous, messages aux détenteurs regroupés sur 10 min, report de plus de 24 h, billetterie d'un événement créé (couleur et consigne, A1), suspension, réactivation, clôture d'un suspendu, annulation, fin manuelle et automatique, cascade partenaire, rapport de clôture, export | 04.0 à 04.23 | 23 |
| `05-equipe-controle-acces.md` | équipe de contrôle (invitation d'un nouveau numéro, activation, renvoi, compte existant et consentement, contrôleur d'une autre partenaire, affectations, permission espèces, retraits), zones et portes, couleur et consigne (A1), fenêtre du contrôle, scanner (chaque résultat, texte, couleur, vibration), saisie manuelle, billet hors ligne, liste des invités, guichet, PIN régisseur, caisses, onglet Entrées, alerte de refus | 05.1 à 05.30 | 29 |
| `06-achat-paiement.md` | fiche publique, cartes (« À partir de », « Gratuit », « Dernières places », « Complet »), panier et devis, gratuits et limite par compte, panier mixte, Wave et Orange Money, page de suivi et garde des places, confirmation, retour, échec, annulation, abandon, second achat, succès tardif (H1), double paiement, prix minimum, erreurs SamirPay, SamirPay muet, circuit de l'argent chiffré, Mes paiements | 06.1 à 06.22 | 21 |
| `07-billets.md` | Mes billets, carte et statuts, QR tournant (20 s), PDF, billet hors ligne, transfert (envoi, acceptation, refus, annulation, expiration 48 h, numéro changé, transfert puis remboursement), invitations (envoi, nom de l'invité, compte vérifié, réclamation sans compte, annulation, refus), billet d'un client suspendu | 07.1 à 07.18 | 18 |
| `08-argent.md` | versements (natures, états, blocages), remboursement d'un billet (en ligne, espèces, gratuit, après la fin, transféré, après report), remboursements d'une annulation, espèces du guichet, effets comptables, « Versements à reprendre », Renvoyer, Marquer versé, Constater non versé, frais de versement, retraits, fonds gelés, soldes, rapport de clôture et `/admin/finance` (chaque chiffre et sa formule), réglages finance.* | 08.0 à 08.22 | 21 |
| `09-parrainage.md` | code et lien, filleuls, niveaux N1 et N2, taux et durées, calcul d'une commission, disponibilité (fin + 7 jours), gel, annulation au remboursement, Portefeuille, retrait des commissions, statut Ambassadeur, écran admin, messages, renvois au lot 13 | 09.1 à 09.14 | 12 |
| `10-notifications.md` | **catalogue complet des 103 types** (généré depuis le registre et le catalogue du code, aucun écart) avec destinataires, déclencheur, canaux, indispensable ou optionnel, sujet, regroupement, heures calmes, plafonds, textes exacts de chaque canal, caractères et segments de chaque SMS ; boîte d'envoi et tentatives, envois immédiats, heures calmes, plafonds SMS, email vérifié, push abonné, comptes de démonstration, supervision ; listes « messages d'un admin » et « messages de la partenaire à chaque vente » | 10.0 à 10.13 | 5 |
| `11-admin-superadmin.md` | qui entre dans l'administration, les 16 permissions (ce qu'elles ouvrent et bloquent), premier SUPERADMIN, création de compte et d'ADMIN, permissions, suspension et anonymisation, partenaires, modération des événements, catalogues, finance, tarification, les 33 réglages SUPERADMIN (valeur initiale et bornes), parrainage, campagnes, supervision, journal d'audit, scanner de l'admin, messages reçus par un admin, ce qu'aucun écran ne permet | 11.0 à 11.20 | 14 |
| `12-taches-planifiees.md` | principe commun (secret, refus), les 9 tâches (fréquence, effet, messages, ce qui se passe si elle ne tourne pas), `npm run cron:local` (8 tâches), planification de production (pg_cron et Vault), ce qui n'est pas planifié | 12.0 à 12.12 | 12 |
| `13-limites-quotas-securite.md` | règles communes des quotas, garde SMS, codes, connexion, liens, invitations, contrôle d'accès, achats et argent, fichiers, quantités et longueurs, notifications, délais ; protections en place et leurs limites | sections 1 à 15 | 3 (13.1 à 13.3) |
| `14-non-implemente.md` | interrupteurs `features.*`, salles (lot 10), tables (lot 11), commandes (lot 12), abonnement et essai, mise en avant, parrainage complet (lot 13), moyens de paiement non construits, virement, campagnes et WhatsApp, liste d'attente et codes promo, manques de l'administration, tableau cahier des charges → état → lot | 14.1 à 14.14 | 11 (format adapté, voir plus bas) |
| `15-constats.md` | les **96 constats G-01 à G-96** (0 bloquant, 29 visibles, 67 mineurs), avec preuve et correspondance avec les notes des rédacteurs | — | — |

**Total : 216 scénarios** au format en 7 points, 103 types de messages au catalogue, 96 constats.

Les 13 sections numérotées qui ne sont pas des scénarios sont des tableaux de synthèse ou des règles communes :
02.20, 03.23, 04.0, 05.30, 06.19, 08.0, 08.22, 09.13, 09.14, 12.12, 14.12 à 14.14 (les rédacteurs les comptaient
parfois comme scénarios : leur total annoncé était 229). Dans 01, 10 et 11, les sections décrivent les écrans et
contiennent des scénarios titrés « Scénario nn.n ».

## Comment lire ce guide

### Le format des scénarios

Chaque scénario a la même forme, en 7 points :

1. **Qui, où** : rôle, adresse, menu, bouton exact.
2. **Ce qu'il saisit** : champs, obligatoires ou non, limites, textes d'aide, messages d'erreur exacts.
3. **Ce que fait le système** : changements d'état, ce qui est enregistré, délais.
4. **Messages envoyés** : tableau `Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact`.
5. **Ce que voient les autres rôles**, en direct ou au rechargement.
6. **Ce qui est impossible ou refusé**, avec le message exact.
7. **Preuves** (`fichier:ligne`) et **essai** associé de `docs/recette-billetterie.md` quand il existe.

Les scénarios sont numérotés `<fichier>.<n>` (exemple : `04.12`) ; les renvois d'un fichier à l'autre utilisent ces
numéros. Dans `14-non-implemente.md`, les 7 points sont adaptés à ce qui n'existe pas : prévu, à l'écran aujourd'hui,
ce que fait le code, messages, autres rôles, impossible aujourd'hui, lot prévu. Dans `13`, les sections sont numérotées
de 1 à 15 et les trois scénarios 13.1 à 13.3.

### Les preuves

- Chaque fait porte sa preuve `fichier:ligne`, relative à la racine du dépôt ; `M/` = `supabase/migrations/`. Pour une
  fonction de la base, c'est la **dernière** définition dans les migrations qui fait foi.
- Les textes entre « » sont **recopiés exactement** du code (apostrophes et espaces compris), d'abord le modèle avec
  ses variables `{…}`, puis un exemple rempli avec des données fictives (« Fatou Diop », « Concert Test », numéro
  `77 000 00 00`).
- **NON VÉRIFIÉ** marque ce qui n'a pas pu être établi par la lecture du code, avec ce qui a été cherché. Aucune base
  distante n'a été lue : les valeurs actuelles des réglages sur event-village-dev, la configuration du projet
  d'authentification hébergé et l'adresse réelle de l'application en production sont NON VÉRIFIÉES partout.
- **Adresse de l'application dans les exemples de SMS.** `10-notifications.md`, qui fait référence pour les textes et
  les longueurs, utilise l'adresse fictive `https://app.eventvillage.sn` (27 caractères, celle que le catalogue retient
  pour garantir un SMS d'un segment) et donne pour chaque SMS l'exemple **et le pire cas**. Les exemples de 02, 03,
  04, 06, 07 et 09 utilisent `https://app.exemple.sn` (22 caractères) : leurs longueurs sont donc de 5 caractères plus
  courtes que celles de 10 pour le même texte. En cas de doute, la longueur de 10 fait foi.
- Les écarts relevés par chaque rédacteur sont cités dans les fichiers par leur identifiant de travail (« constat
  W6-02 ») ; `15-constats.md` donne pour chacun son identifiant G et sa preuve.

### Le vocabulaire

Le guide suit **`docs/glossaire.md`** (un seul nom pour chaque chose ; les mots retenus et ceux à éviter y sont listés).
Trois précisions :

- **partenaire** désigne le compte professionnel et la personne qui le tient (« la partenaire ») ; **organisateur**
  n'apparaît que dans les textes lus par le public ou les clients, recopiés du code.
- **indispensable / optionnel** : la consigne du guide impose ces deux mots dans les tableaux de messages ; « optionnel »
  correspond au « SMS facultatif » du glossaire (un message dont la personne peut couper le sujet dans ses préférences).
- **SUPERADMIN** et **ADMIN** désignent les rôles ; l'écran les affiche « Superadmin », « Super administrateur » ou
  « Super-administrateur » selon la page (constat G-45) et « Administrateur ».

## Tableau des rôles

| Rôle | Comment on l'obtient | Espace | Ce qu'il peut faire | Renvoi |
|---|---|---|---|---|
| Visiteur | sans compte, ou non connecté | site public : `/`, `/explore`, fiches `/events/…` | voir le catalogue et les fiches ; toute page protégée renvoie vers `/login?redirect=…` (`middleware.ts:171-186`) | 01.1 |
| Client | inscription « numéro d'abord » avec code SMS (`/register`) ; rôle CLIENT, compte actif | espace client : Accueil, Explorer, Mes billets, Portefeuille, profil | acheter et réserver des billets gratuits, transférer, recevoir des invitations, se faire rembourser après report, parrainer et retirer ses commissions | 01.2, 02, 06, 07, 09 |
| Partenaire en attente | inscription partenaire (`/partner/register`) : rôles CLIENT et PARTENAIRE, compte et fiche « en attente » (`app/api/partner/register/route.ts:200-206`) | espace partenaire limité à `/partner`, `/partner/dashboard`, `/partner/profile` (`app/partner/layout.tsx:55-57`) | lire son tableau de bord et son profil, attendre la validation ; ni créer d'événement, ni enregistrer son profil, ni acheter (compte non actif : G-15, G-49) | 01.5, 03.4 |
| Partenaire validée | validation du dossier par un admin muni de `partners.validate` « Valider les partenaires », ou le SUPERADMIN (compte et fiche actifs) | espace partenaire complet (`AppLayout.tsx:144-160`) | créer, soumettre, publier, modifier, annuler ses événements ; équipe de contrôle ; pilotage, remboursements, invitations ; finances et retraits ; statistiques | 01.6, 03, 04, 05, 08 |
| Partenaire refusée | refus du dossier avec motif | tableau de bord avec le bandeau du refus | compléter son dossier **une seule fois** ; après un second refus, rien (contacter le support) | 01.7, 03.8, 03.9 |
| Partenaire suspendue | suspension par un admin muni de `partners.suspend` (motif obligatoire) : compte et fiche suspendus, sessions fermées, événements publiés suspendus | aucun : l'écran de connexion la refuse (« Votre compte est suspendu. Veuillez contacter le support. ») | rien jusqu'à la réactivation ; fonds disponibles gelés | 01.8, 03.10, 03.11 |
| Contrôleur | invitation par une partenaire (nouveau numéro : SMS d'activation et `/controller/setup` ; compte existant : invitation à accepter sur `/invitations`) ou création par un admin ; rôles CLIENT et CONTRÔLEUR | espace contrôleur `/controller/…` (compte actif exigé, `middleware.ts:240-259`) et espace client | scanner les billets des événements où il est affecté, à sa porte ; saisie manuelle et liste des invités selon le réglage ; guichet et caisse s'il a la permission espèces | 01.9, 05 |
| ADMIN | créé par le SUPERADMIN, avec des permissions choisies parmi 16 | administration `/admin/…` (`middleware.ts:224-229`) | ce que ses permissions ouvrent : utilisateurs, partenaires, événements, remboursements, finance, notifications, catalogues… ; réglages en lecture seule | 01.10, 11.0 bis, 11 |
| SUPERADMIN | premier compte par la procédure de démarrage ; les suivants créés par un SUPERADMIN | administration complète, plus « Journal d'audit » | toutes les permissions ; seul à créer un ADMIN, changer ses permissions, modifier les **Réglages de la plateforme** et les interrupteurs `features.*`, « Constater non versé », statut Ambassadeur | 01.11, 11.1, 11.13 |

Un compte peut cumuler plusieurs rôles (client + partenaire + contrôleur, par exemple) : 01.12 explique quel menu il
voit et comment il passe d'un espace à l'autre.

## Questions de la recette

Réponses établies par les rédacteurs, puis **revérifiées dans le code** par la passe de cohérence (les mesures de SMS
ont été refaites avec `smsSegments` du code).

### A1 — Où la partenaire règle-t-elle la couleur et la consigne d'entrée d'une catégorie ?

**Dans la modification de l'événement, et nulle part ailleurs**, sur une catégorie **déjà enregistrée** :
« Mes événements » → « Modifier » (`/partner/events/{id}/edit`) → étape « Billets » → carte de la catégorie → bloc
« Au contrôle des entrées » : liste « Couleur au contrôle » (« Aucune couleur », « Blanc », « Or », « Argent »,
« Rose », « Turquoise », « Bleu nuit », « Violet », « Noir ») et champ « Consigne d’entrée » (60 caractères au plus),
puis « Enregistrer la catégorie ».

- Pas à la création de l'événement : le bloc n'apparaît qu'une fois la catégorie enregistrée (« Créer la catégorie »
  d'abord), et le serveur refuserait ces champs avec l'événement (`components/events/EventTicketing.tsx:25-26`, `:243`,
  `:381-406`, `:723` ; `lib/validations/event.ts:516-522`).
- Possible tant que l'événement se modifie (Brouillon, Validé, Publié, Suspendu), même après des ventes ; ni en attente
  de validation, ni terminé, ni annulé (`lib/events/event.service.ts:252-261`).
- Aucun autre écran : l'onglet Équipe du pilotage ne fait que **montrer** la pastille (`components/partner/zones/ZonesEditor.tsx:294-311`),
  l'administration n'a aucun champ. Refus du serveur : « Choisissez une couleur dans la liste. », « La consigne
  d’entrée ne dépasse pas 60 caractères. » (`M/20261110000011_lot9ter_stock.sql:438-457`). Aucun message n'est envoyé
  quand elles changent (`M/20261110000006_lot9ter_equipe_messages.sql:30-34`).
- Détail : 04.15 et 05.13. Essai 77, étape 1.

### A3 — L'invitation d'un nouveau contrôleur part-elle immédiatement ? Combien de caractères et de segments ? Où voir son état ?

- **Oui, immédiatement** : le SMS `CONTROLLER_INVITE` part pendant la requête « Inviter le contrôleur », hors boîte
  d'envoi, à toute heure (pas de plage de nuit), sous la garde SMS, jamais vers un compte de démonstration
  (`app/api/partner/team/invite/route.ts:508-553` ; `lib/sms/mtarget.service.ts:188-195` ; `lib/notifications/sync-log.ts:1-9`).
- **Texte** : « Event Village : Bonjour {prénom}, code d'activation {code} (24 h) pour scanner les billets : {URL}/controller/setup?phone={numéro} »,
  sans prénom « Event Village : code d'activation {code} (24 h) pour scanner les billets : {URL}/controller/setup?phone={numéro} »
  (`lib/notifications/catalog.ts:1796-1816`).
- **Longueur** (GSM-7, mesurée avec `smsSegments` et l'adresse `https://app.eventvillage.sn` de 27 caractères) :
  **141 caractères sans prénom, 156 avec « Fatou », 160 au plus** (prénom coupé à 9 signes, « Mouham... ») : **1 segment**.
  Une adresse de production plus longue fait passer le cas le plus long à 2 segments (adresse de production NON
  VÉRIFIÉE, constat G-70).
- **Où voir son état** : supervision `/admin/notifications` (SUPERADMIN, ou ADMIN avec `notifications.read`), type
  « Invitation d'un contrôleur », canal SMS : statut final (envoyée, non envoyée avec motif, en échec, incertaine) ;
  le détail dit « Origine : Envoi immédiat journalisé (code à usage unique ou invitation) », sans le code ni le lien,
  et sans la taille du SMS (constat G-96) ; une ligne en échec ne se relance pas (`app/admin/notifications/[id]/page.tsx:476` ;
  `lib/notifications/outbox-labels.ts:176` ; `M/20261103000002_lot6_outbox.sql:144`). Côté partenaire : le toast
  « … SMS avec code d'activation envoyé. » ou « … SMS non envoyé : {raison}. Renvoyez l’invitation plus tard. »
  (`app/api/partner/team/invite/route.ts:552-553`), puis l'état « Activation en attente » sur `/partner/team`.
- Détail : 05.2 et 10.2.

### A5 — Texte exact du SMS d'invitation à contrôler envoyé à un compte existant. Nomme-t-il l'organisateur ?

- Type `CONTROLLER_INVITATION`, **indispensable, mis en file** (part au passage suivant de l'envoyeur, moins d'une minute),
  avec cloche, push et email :
  « Event Village : {organisateur} vous invite à scanner les billets de {titre}. Répondez sur {URL}/invitations » ;
  avec plusieurs événements « …de {titre}, et 1 autre. Répondez… » ou « …, et {n} autres. Répondez… »
  (`lib/notifications/catalog.ts:571-574`, `:1465-1489`).
  Exemple : « Event Village : Fatou Diop Events vous invite à scanner les billets de Concert Test. Répondez sur https://app.eventvillage.sn/invitations »
  (137 caractères, GSM-7, 1 segment).
- **Oui, il nomme l'organisateur** : le nom commercial de la partenaire, sinon sa raison sociale, coupé à 18 signes ;
  {titre} = premier événement, coupé à 18 signes (`M/20261109000008_lot9bis_cycle.sql:2014-2015`, `:2047-2061`).
- Un contrôleur déjà connu de la partenaire n'est pas invité mais affecté directement : il reçoit `CONTROLLER_ASSIGNED`,
  qui ne nomme pas l'organisateur. Détail : 05.5, 05.6, 10.12. Essai 86.

### Le SMS optionnel en heures calmes est-il perdu ou reporté à 8 h ?

**Perdu, jamais reporté.** La décision est prise à l'envoi (passage de l'envoyeur, chaque minute) : une ligne SMS d'un
type optionnel, quand l'heure de Dakar est dans la plage (22 h à 8 h à l'installation, réglages `notif.sms_quiet_start`
et `notif.sms_quiet_end`, de 0 à 23, début = fin supprime la plage), passe « Non envoyée », motif « Plage sans SMS
(nuit) ». Ce statut est final : la ligne n'est ni remise en file à 8 h ni relançable (la relance ne vise que « En
échec »). La cloche, le push et l'email du même message partent normalement ; les SMS indispensables et les envois
immédiats (codes, invitation d'un contrôleur) partent aussi la nuit. Types concernés : `REMINDER_J1`, `REMINDER_H3`,
`CONTROLLER_REMINDER`, `FIRST_TICKET_SOLD`, `CATEGORY_SOLD_OUT`, `EVENT_SOLD_OUT`.
Preuves : `M/20261109000010_lot9bis_email.sql:487-503` (dernière définition de `notification_outbox_claim`,
`v_reason := 'QUIET_HOURS'`) ; `M/20261103000003_lot6_reglages.sql:34-37` ; `M/20261103000008_lot6_supervision.sql:442-444` ;
`lib/notifications/outbox-labels.ts:47` ; `app/admin/finance-settings/page.tsx:90-91`. Détail : 10.3 ; conséquence
sur le rappel d'un événement matinal : constat G-95.

### Le seuil de « Dernières places » : valeur, réglable ou non, par catégorie ou par événement ?

**Un seul seuil pour toute la plateforme : 10 places à l'installation, réglable par le SUPERADMIN seul (entier de 1 à
1 000), ni par catégorie ni par événement.**

- Réglage `access.low_stock_threshold`, valeur initiale 10 (`M/20261102000006_lot5_temps_reel.sql:33`), bornes 1 à
  1 000 (`M/20261110000002_lot9ter_reglages.sql:89`) ; écran `/admin/finance-settings`, ligne « Seuil « bientôt
  complet » », modification avec un motif (`app/admin/finance-settings/page.tsx:81`, scénario 11.13). Une valeur
  illisible ou hors bornes donne 10 (`lib/events/low-stock.server.ts:9-18`).
- Places restantes = quantité mise en vente − vendues − retenues par un paiement en cours.
- Le même seuil sert deux règles :
  - **Fiche de l'événement, par catégorie** : restant ≤ seuil → « Plus que {n} places » (« Plus qu’une place » pour
    une), 0 → « Complet », au-dessus → « Disponible » (`app/api/events/[id]/route.ts:121` ; `app/events/[id]/page.tsx:266-276`).
  - **Carte du catalogue, par événement** : badge « Dernières places » quand **toutes** les catégories achetables en
    ligne ont un restant ≤ seuil ; une seule au-dessus suffit à ôter le badge ; « Complet » quand plus aucune n'est
    achetable et qu'au moins une est épuisée sans être close ; jamais de nombre sur la carte
    (`lib/events/catalog.server.ts:112-128` ; `components/events/EventCard.tsx:112-117`).
- L'aide du réglage ne parle que de la fiche (constat G-76). Détail : 06.1, 06.2.

### La carte affiche « À partir de Gratuit » quand une catégorie est gratuite et d'autres payantes : quelle règle exacte ?

**La carte écrit toujours « À partir de » au-dessus du prix le plus bas parmi les catégories achetables en ligne
maintenant ; si ce prix est 0, la valeur écrite est « Gratuit ».**

- Catégorie achetable en ligne maintenant : active, vendue en ligne, au moins une place restante (places retenues
  déduites), vente commencée et pas close (`lib/events/catalog.server.ts:108-110`, `:189-194`).
- Affichage : prix trouvé → « À partir de » puis « Gratuit » (prix 0) ou le montant (« 5 000 F CFA ») ; aucun prix →
  « Billetterie » puis l'état de la vente (« Bientôt en vente », « Vente sur place uniquement », « Complet », « Vente
  en ligne terminée ») (`components/events/EventCard.tsx:70`, `:130-141` ; `lib/events/catalog.server.ts:130-143`).
- Donc : une gratuite achetable + des payantes → « À partir de » / « Gratuit » ; toutes gratuites → aussi « À partir
  de » / « Gratuit » ; la gratuite épuisée, close, inactive ou vendue seulement au guichet ne compte plus → « À partir
  de » / prix de la payante la moins chère. Le libellé « Gratuit » seul préparé par le serveur n'est jamais montré
  (constat G-77). Détail : 06.2.

## Passe de cohérence

Faite après la rédaction des fichiers 01 à 14 : renvois croisés, vocabulaire, format des scénarios, contradictions
entre fichiers. Le fond n'a pas été réécrit ; quand deux fichiers se contredisaient, le code a tranché.

**Renvois croisés.** Les 827 renvois `nn.n` des fichiers 01 à 14 mènent tous à une section ou un scénario existant ;
les 140 renvois d'un fichier à un autre ont été relus un par un, aucun ne mène à un mauvais sujet.

**Corrections faites :**

| Fichier | Correction | Ce qui a tranché |
|---|---|---|
| `01-roles-menus-ecrans.md` | Scénario 01.3 : un client suspendu qui se reconnecte n'obtient pas de session utilisable : l'écran de connexion ferme aussitôt la session et affiche « Votre compte est suspendu. Veuillez contacter le support. » (01.3 disait qu'il gardait une session et ne voyait que des refus, en contradiction avec 02.17 et 03.10) | `components/auth/LoginForm.tsx:269-287`, `:365`, `:489` |
| `01-roles-menus-ecrans.md` | Scénario 01.8 : même correction pour la partenaire suspendue ; le tableau de bord en erreur ne se voit plus que dans un onglet resté ouvert avec un jeton encore valable | idem ; `supabase/config.toml:152` |
| `01-roles-menus-ecrans.md` | 01.5 : `/partner/profile` d'une partenaire en attente n'est pas « modifiable » : l'enregistrement est refusé (contradiction avec 03.4) | `app/api/partner/profile/route.ts:114-115`, `:136-137` |
| `11-admin-superadmin.md` | 11.4 et 11.8, point 5 : même correction que 01.3 et 01.8 | `components/auth/LoginForm.tsx:280-285` |
| `11-admin-superadmin.md` | 11.4 et 11.8 : « Motif : {motif} Vos billets… » et « Motif : {motif} Contactez… » → « Motif : {motif}. … » (le catalogue ajoute le point final, comme le disent 02, 03 et 10) | `lib/notifications/catalog.ts:147-150`, `:1582` |
| `05-equipe-controle-acces.md` | 05.29 : renvoi à 11.18 ajouté (le scanner de l'admin ne liste que les événements de sa fiche partenaire) | `lib/events/event.service.ts:191-204` |
| `06-achat-paiement.md` | « formule » → « catégorie » partout (mot à ne pas employer, glossaire) ; aucun texte d'écran ne contient « formule » | `docs/glossaire.md` section 2 |
| `06-achat-paiement.md` | 06.21 : « frais de retrait (1 %, minimum 5 000 F) » → « (1 % ; retrait de 5 000 F CFA au moins) » : le minimum porte sur le retrait, pas sur les frais (03.19, 08.16) | `M/20261101000002_lot3_reglages.sql:69-70` |
| `04`, `05`, `07`, `10`, `12` | « organisatrice » → « partenaire » (le glossaire réserve « organisateur » aux textes lus par le public) ; aucun texte recopié du code n'était touché | `docs/glossaire.md` section 1 |
| `13-limites-quotas-securite.md` | Plage de nuit : « perdu ou reporté : voir 10 » → « perdu, jamais reporté (10.3) » | `M/20261109000010_lot9bis_email.sql:487-503` |
| `13-limites-quotas-securite.md` | Section 8 : la limite des billets gratuits par compte ne vaut que pour un panier entièrement gratuit (06.5) ; le quota de 20 demandes par heure est celui d'une route qu'aucun écran n'appelle (06.4) | constats G-24, G-82 |
| `13-limites-quotas-securite.md` | Section 4 : la règle de mot de passe a deux exceptions (activation d'un contrôleur, compte créé par un admin) | `app/api/controller/setup/route.ts:15-20` ; constat G-31 |

**Constats revus.** W1-04 (« la connexion par mot de passe ne vérifie pas le statut ») est ramené à « mineur » (G-30) :
la route ne vérifie pas, mais l'écran ferme la session. W1-19 citait deux libellés du SUPERADMIN, il y en a trois (G-45).
W4-11 (commission gelée affichée « disponible ») est fusionné dans G-17 : le solde du Portefeuille déduit bien le gel.

**Points laissés tels quels, signalés ici.** Les étiquettes des 7 points varient un peu d'un fichier à l'autre
(« Refus. », « Contenu. », « Ce que voit le contrôleur. ») sans changer leur ordre. Les exemples de SMS de 02, 03, 04,
06, 07 et 09 utilisent une autre adresse fictive que 10 (voir « Les preuves »).

## Vérification finale
