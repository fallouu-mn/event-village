# Plan de test manuel du module événements

À suivre dans l'ordre sur event-village-dev, chapitres 0 à 18 de `docs/parcours-evenement-complet.md`. Mis à jour en place au lot 9 bis : une ligne dont le résultat change le dit par « depuis le lot 9 bis » ; les écarts corrigés ne sont plus attendus. Mis à jour de même au lot 9 ter : une ligne nouvelle ou réécrite le dit par « depuis le lot 9 ter », et renvoie à l'étape du parcours et à l'essai de `docs/recette-billetterie.md` (essais 77 à 93) qui la détaillent. Les essais P10.5 à P10.11 et P12.2 à P12.4 se suivent : ils utilisent les zones et les portes préparées en P6.7. Ce plan renvoie aux essais de `docs/recette-billetterie.md` sans les recopier, et n'ajoute que ce qui manque. Mode A (simulé) par défaut : les SMS et les codes se lisent dans la fenêtre 2 ; les emails s'écrivent dans cette fenêtre si la clé Resend est absente. Les textes complets des messages, avec leurs modèles, sont cités aux étapes du parcours.

Légende : **OK / anomalie** à cocher. **Fenêtre** : `F2` = fenêtre 2 du mode A (`dev`) ; `Cloche` = la cloche du compte ; `Écran` = texte à l'écran.

| Bloc | Durée estimée | Exige |
|---|---|---|
| 0. Préparation | 25 min | — |
| 1. Client | 40 min | — |
| 2. Partenaire | 45 min | — |
| 3. Création | 35 min | — |
| 4. Validation | 30 min | — |
| 5. Modification | 55 min | — |
| 6. Équipe | 60 min | téléphone pour le SMS réel en mode B seulement ; deux comptes contrôleurs pour P6.6 et P6.7 |
| 7. Achat | 80 min | téléphone et mode B pour 7.19 et 7.20 ; mode réel en https pour P7.7 |
| 8. Après l'achat | 50 min | — |
| 9. Rappels | 25 min, plus l'attente | — |
| 10. Jour J | 90 min | téléphone (vibration, caméra) et mode B pour le hors-ligne ; deux téléphones pour P10.5 à P10.11 |
| 11. Guichet et caisse | 35 min | téléphone conseillé |
| 12. Pilotage | 40 min | compte `superadmin` pour P12.3 |
| 13. Suspension | 35 min | — |
| 14. Annulation | 45 min | — |
| 15. Billet seul | 25 min | — |
| 16. Fin de l'événement | 55 min, plus 48 h pour le retrait | — |
| 17. Cas transverses | 30 min | — |
| 18. Admin | 45 min | — |

## Essais existants qui échoueront, ou qui ne prouvent pas ce qu'ils disent

| Essai | Ce qui se passera | Raison | Que faire |
|---|---|---|---|
| Essai 1 | La bannière « Intégrations simulées » n'est pas à l'écran | Elle s'écrit dans la fenêtre 2 (`instrumentation.ts:15`) ; depuis le lot 9 bis, l'essai le dit lui-même, et en réel la fenêtre 2 affiche « [réel] SMS, paiements et emails RÉELS : de l’argent réel sera débité. » | Regarder la fenêtre 2 |
| Essai 27 | Lamine voit « Un billet vous attend peut-être », pas le billet | Les comptes du seed n'ont pas de numéro vérifié (`scripts/dev/seed-dev.core.ts:202-205`) | Faire d'abord l'essai P0.3 |
| Essais 11, 31, 40, 41, 42, 58 et 62 | Depuis le lot 9 ter, une copie imprimée avant ce lot ne correspond plus à l'écran (les lignes sans objet des essais 46, 54 et 55, qui passent depuis le lot 9 bis, ont été retirées de ce tableau) | Ces essais ont été réécrits ou complétés au lot 9 ter : ville choisie dans une liste, « Déjà utilisé à {heure} », export à colonnes Origine, Zone et Porte, rapport de clôture unique, retraits en cours au brut, lignes « Numéro » et « Nom de l’invité » des invitations | Reprendre `docs/recette-billetterie.md` à jour |
| Essai 80 | Depuis le lot 9 ter : « [fiche-partenaire] NON PROTÉGÉ … » et sortie 1 | La migration `20261110000001_lot9ter_rls` n'est pas appliquée sur ce projet : la protection est dans la base, pas dans l'écran | Arrêter l'essai, prévenir l'équipe technique, appliquer les migrations du lot 9 ter (`docs/essai-local.md` section 3) |
| Essais 84 et 85 | Depuis le lot 9 ter : 85 sans objet en simulé ; 84 ne montre pas « Constater non versé » sur un versement ordinaire | 85 n'a de sens qu'en réel, adresse en https (`lib/payments/cashin-init.ts:56-60`) ; le constat ne s'ouvre que pour un SUPERADMIN et un versement à l'issue incertaine sans identifiant SamirPay | 85 avec l'essai 60, en réel ; 84 en mode A, faux SamirPay en délai dépassé |

## 0. Préparation (25 min)

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| Essais 1, 2 | `.env.local` en mode simulé, avec les lignes de quotas | Voir `docs/recette-billetterie.md` | Comptes connectés | Aucun | ☐ OK ☐ anomalie |
| P0.1 | Terminal PowerShell | Lancer `npm run seed:dev`, retaper la référence du projet | 6 comptes, 4 événements, aucune vente | F2 : aucun SMS | ☐ OK ☐ anomalie |
| P0.2 | Connecté en `superadmin` | `/admin/users`, « Permissions » sur `admin` : depuis le lot 9 bis, les 8 cases sont déjà cochées par le seed, en français (« Consulter les événements », « Gérer les événements », « Consulter les envois de messages », « Relancer les envois de messages », « Consulter les partenaires et leurs contacts », « Valider les partenaires », « Consulter les paiements », « Gérer les remboursements ») ; en décocher une pour un essai de refus, la recocher après | Message « Les permissions de l'administrateur… ont été enregistrées. » | Aucun | ☐ OK ☐ anomalie |
| P0.3 | Connecté en `client2` | `/tickets?tab=recus`, « Confirmer mon numéro », code lu en F2 | Message « Numéro confirmé. Les billets qui vous attendent s’affichent maintenant. » | F2 : « Event Village : votre code de vérification est {code}. Valable 10 minutes. » | ☐ OK ☐ anomalie |

## 1. Le client (40 min)

Existants : Essais 7, 8, 49, 65, 66, 67, 68, 69.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P1.1 | Numéro neuf (70 + 7 chiffres) | Se connecter par « Code SMS » avec un numéro déjà inscrit | Connexion, numéro marqué vérifié | F2 : « Event Village : votre code de vérification est {code}. Valable 10 minutes. » | ☐ OK ☐ anomalie |
| P1.2 | `client1` | 5 mots de passe faux | « Saisie temporairement bloquée », 60 s | Aucun | ☐ OK ☐ anomalie |
| P1.3 | Compte avec email réel | « Mot de passe oublié » par email | « Si un compte correspond à cette adresse… » ; noter l'expéditeur réel | Email : à relever | ☐ OK ☐ anomalie |
| P1.4 | Depuis le lot 9 bis. `client1`, adresse email neuve | `/profile`, saisir l'adresse, enregistrer le profil, puis ouvrir le lien reçu | Badge « Email non vérifié » jusqu'au lien ; page `/verify-email` « Adresse vérifiée » ; aucun autre email avant | Email : « Vérifiez votre adresse email — Event Village » | ☐ OK ☐ anomalie |
| P1.5 | Depuis le lot 9 bis. `client1`, connecté depuis plus de 10 minutes | Changer de numéro | Fenêtre du mot de passe d'abord, puis code au nouveau numéro ; ensuite « Retrait impossible pendant 24 h après un changement de numéro. Réessayez après le {date}. » pour un compte qui retire | F2 : code au nouveau numéro, puis « Event Village : le numéro de votre compte a été modifié. Si ce n'est pas vous, contactez le support. » à l'ancien | ☐ OK ☐ anomalie |

## 2. Le partenaire (45 min)

Existants : Essais 9, 10, 55 (voir l'avertissement).

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P2.1 | Partenaire de l'Essai 9, connecté avant validation | Ouvrir `/partner/dashboard`, puis `/partner/events` | Depuis le lot 9 bis : bandeau « Compte en cours de vérification » (R7 corrigé) ; `/partner/events` ramène au tableau de bord | Cloche : « Inscription reçue » | ☐ OK ☐ anomalie |
| P2.2 | Un second dossier | Admin : « Refuser » avec motif ; partenaire : se connecter, puis « Compléter mon dossier » | Bandeau « Demande de compte partenaire refusée », motif ; depuis le lot 9 bis, « Compléter mon dossier » une seule fois, le dossier repasse en attente ; une seconde fois : « Votre dossier a déjà été complété une fois. Contactez le support. » | F2 : « Event Village : votre demande de compte partenaire n'est pas acceptée. Motif : {reason} » ; Cloche : « Demande refusée » ; cloche admin : « Dossier complété » | ☐ OK ☐ anomalie |
| P2.3 | Partenaire validé avec un événement publié et un billet vendu | Admin : `/admin/users`, « Voir la fiche partenaire », « Suspendre » avec motif ; puis « Réactiver » | Depuis le lot 9 bis : déconnectée ; l'événement passe « Suspendu » (« Organisateur suspendu »), plus de vente ; à la réactivation, il revient « Publié » (R5, R6 corrigés) | F2 : « Event Village : votre compte partenaire est suspendu. Motif : {reason} Contactez le support. » ; cloche du détenteur : « Événement suspendu » | ☐ OK ☐ anomalie |
| P2.4 | Partenaire validé, jamais connecté | Ouvrir `/partner/dashboard` | « Période d’essai gratuite en cours », 60 jours | Depuis le lot 9 bis, aucun SMS ; cloche : « Période d'essai activée » | ☐ OK ☐ anomalie |
| P2.5 | Depuis le lot 9 ter. Projet où les migrations du lot 9 ter sont appliquées, `npm run seed:dev` fait | Lancer `npm run essai:fiche-partenaire` (essai 80, étape 2.4 du parcours) | Sortie « [fiche-partenaire] Protégé : la fiche partenaire refuse toute modification directe de son statut (statut {statut} inchangé). » ; la fiche n'est modifiable que par l'écran du profil | Aucun | ☐ OK ☐ anomalie |

## 3. Création de l'événement (35 min)

Existants : Essais 11, 12, 21, 61 ; `docs/essai-local.md` section 8.1.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P3.1 | Compte `partenaire`, brouillon sans affiche | « Soumettre à la validation » | Depuis le lot 9 bis, fenêtre « Soumission impossible : il manque des informations » qui liste les manques, dont « Ajoutez une affiche à l'événement. » | Aucun | ☐ OK ☐ anomalie |
| P3.2 | Brouillon jamais soumis | « Supprimer le brouillon » | « Brouillon supprimé. » | Aucun | ☐ OK ☐ anomalie |
| P3.3 | Brouillon soumis puis retiré | Chercher « Supprimer le brouillon » | Depuis le lot 9 bis, le bouton n'est pas affiché | Aucun | ☐ OK ☐ anomalie |
| P3.4 | Depuis le lot 9 bis. Brouillon complet | « Soumettre à la validation » | Statut « En attente de validation » | Cloche de la partenaire : « Événement envoyé en validation » ; cloche admin : « Événement à valider » | ☐ OK ☐ anomalie |
| P3.5 | Depuis le lot 9 bis. Catégorie payante | Prix de 50 F | Refusé : sous le prix minimum de 100 F | Aucun | ☐ OK ☐ anomalie |
| P3.6 | Depuis le lot 9 ter. Compte `partenaire` | « Créer un événement » : ouvrir la liste « Ville », choisir « Autre ville » ; étape « Accès », saisir « 12345 » dans « Téléphone de contact », puis « 771234567 » (étapes 3.2 et 3.4, essai 91) | 26 villes, de « Cap Skirring » à « Ziguinchor », puis « Autre ville », qui ouvre « Précisez la ville » ; « 12345 » refusé : « Numéro sénégalais invalide. Exemple : 77 123 45 67 ou 33 821 00 00. » ; « 771234567 » accepté, affiché « 77 123 45 67 » sur la fiche publique | Aucun | ☐ OK ☐ anomalie |
| P3.7 | Depuis le lot 9 ter. Événement validé, en modification, étape « Billets » | Sur la catégorie VIP enregistrée, « Couleur au contrôle » « Or », « Consigne d’entrée » « Remettre bracelet doré », « Enregistrer la catégorie » (étape 3.5) | « Catégorie enregistrée. » ; l'aide « Pour vendre des places supplémentaires à un autre prix, créez une nouvelle catégorie. » est sous la quantité | Aucun, ni aux admins ni aux détenteurs | ☐ OK ☐ anomalie |

## 4. Validation (30 min)

Existants : Essais 3, 4, 5, 6, 12, 13, 64, 65 ; `docs/essai-local.md` sections 8.2, 8.14.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P4.1 | Moussa sans « Gérer les événements » (P0.2, décocher) | Ouvrir l'événement en attente | Depuis le lot 9 bis, boutons d'action masqués (R51 corrigé) | Aucun | ☐ OK ☐ anomalie |
| P4.2 | Événement validé | Aïda : « Publier » | « Événement publié. » | Cloche de la partenaire : « Événement publié » ; depuis le lot 9 bis aussi par email si son adresse est vérifiée | ☐ OK ☐ anomalie |
| P4.3 | Événement tout juste publié, sans vente | Accueil, section Populaires | L'événement n'y est pas | Aucun | ☐ OK ☐ anomalie |
| P4.4 | Depuis le lot 9 ter. Un événement validé, un autre en attente de validation | Mariama : « Publier » le premier ; « Retirer de la validation » le second (étapes 4.6 et 3.10, essai 90) | Publié ; retiré, de nouveau modifiable | Cloche admin (`superadmin`) : « Événement publié par l'organisateur », puis « Soumission retirée par l'organisateur » ; aucun SMS | ☐ OK ☐ anomalie |

## 5. Modification après publication (55 min)

Existant : Essai 14.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P5.1 | Événement publié, 1 billet vendu | Changer le titre | Détenteurs prévenus, pas de SMS | Cloche : « Événement modifié » ; F2 : aucun SMS | ☐ OK ☐ anomalie |
| P5.2 | Événement publié, 1 billet vendu, avant 22 h | Changer le lieu | Écran : « 1 détenteur de billets prévenu… » ; depuis le lot 9 bis, le SMS part 10 minutes après, regroupé | F2 : « Event Village : {title} change de lieu : {new_location}. Vos billets restent valables. {APP_URL}/tickets » ; cloche des contrôleurs : « Contrôle modifié » | ☐ OK ☐ anomalie |
| P5.3 | Événement publié, 1 billet vendu, après 22 h, tâche des messages active | Changer la date | Depuis le lot 9 bis, le SMS part la nuit aussi, 10 minutes après (R14 corrigé) | Cloche : « Événement modifié » ; F2 : « Event Village : {title} change de date : {new_start_at}. Vos billets restent valables. {APP_URL}/tickets » | ☐ OK ☐ anomalie |
| P5.4 | Catégorie sans vente, puis avec vente | Changer le prix | Accepté, puis champ verrouillé | Aucun | ☐ OK ☐ anomalie |
| P5.5 | Événement publié | Ajouter une catégorie | Visible et achetable sans validation ; détenteurs non prévenus | Depuis le lot 9 bis, cloche admin : « Événement modifié après validation » | ☐ OK ☐ anomalie |
| P5.6 | Depuis le lot 9 ter. Événement publié, catégorie sans vente | Changer son prix et enregistrer ; puis décocher « Vendue au guichet » et enregistrer (étapes 5.10 et 5.13, essai 90) | Enregistré, statut inchangé | Cloche admin : « Événement modifié après validation », « « {title} » de {company} : nouveau prix pour « {catégorie} » ({nouveau} au lieu de {ancien}) après validation. Vérifiez la fiche. », puis « … : canaux de vente de « {catégorie} » changés (en ligne seulement) après validation. Vérifiez la fiche. » | ☐ OK ☐ anomalie |
| P5.7 | Depuis le lot 9 ter. Catégorie dont l'unique billet a été remboursé | « Modifier » : regarder le prix, la catégorie d'événement et la corbeille de la catégorie (étape 5.1, essai 89) | Prix verrouillé : « Prix verrouillé : des billets ont déjà été émis pour cette catégorie. Créez une autre catégorie pour un nouveau tarif. » ; catégorie d'événement verrouillée ; pas de corbeille | Aucun | ☐ OK ☐ anomalie |
| P5.8 | Depuis le lot 9 ter. Une catégorie modifiée, pas enregistrée | Cliquer « Mes événements » ; puis recharger l'onglet | Fenêtre « Quitter sans enregistrer ? », « Catégorie « {nom} » : vos modifications ne sont pas enregistrées et seront perdues. », boutons « Quitter sans enregistrer » et « Rester sur la page » ; au rechargement, l'avertissement du navigateur. Le bouton « Précédent » n'est pas intercepté (limite connue) | Aucun | ☐ OK ☐ anomalie |

## 6. L'équipe (60 min)

Existants : Essais 15, 29 ; `docs/essai-local.md` section 8.8.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P6.1 | Compte `client1` comme Awa | Inviter son numéro ; puis, connecté en `client1`, `/invitations`, accepter | Fenêtre « Compte existant » ; depuis le lot 9 bis, aucune affectation avant l'acceptation d'Awa (R37 corrigé) ; refus possible | F2 : « Event Village : {company} vous invite à scanner les billets de {title}. Répondez sur {APP_URL}/invitations », puis après acceptation « Event Village : affectation à l'entrée de {title}, {start_at}. {APP_URL}/login » | ☐ OK ☐ anomalie |
| P6.2 | Contrôleur activé | Chercher « Renvoyer le SMS » | Depuis le lot 9 bis, bouton absent (R38 corrigé) | Aucun | ☐ OK ☐ anomalie |
| P6.3 | Contrôleur invité sans prénom, activé | Regarder sa ligne | Depuis le lot 9 bis, « Actif » (R39 corrigé) | Aucun | ☐ OK ☐ anomalie |
| P6.4 | Caisse ouverte | Retirer le contrôleur | Refus « Ce contrôleur a une caisse ouverte… » | Aucun | ☐ OK ☐ anomalie |
| P6.5 | Depuis le lot 9 bis. Contrôleur avec droit d'encaisser | Ouvrir une caisse sans PIN | Refus : le PIN régisseur est exigé | Aucun | ☐ OK ☐ anomalie |
| P6.6 | Depuis le lot 9 ter. Contrôleur actif chez une autre partenaire, jamais affecté par Mariama | Mariama l'invite par son numéro ; le contrôleur accepte dans `/invitations` (étape 6.12, essai 86) | Fenêtre « Compte existant » : « Ce numéro appartient déjà à un compte Event Village ({nom masqué}). Ce titulaire n’a jamais contrôlé vos événements : il doit accepter votre invitation dans l’application avant d’être affecté. Confirmez-vous l’envoi de l’invitation ? » ; après « Envoyer l’invitation », aucune affectation avant son acceptation ; un contrôleur déjà eu par Mariama reste affecté directement | F2 : SMS d'invitation à contrôler, puis SMS d'affectation après l'acceptation | ☐ OK ☐ anomalie |
| P6.7 | Depuis le lot 9 ter. Événement validé avec SIMPLE, VIP et VVIP, deux contrôleurs | Onglet Équipe, « Configurer des zones » : « Entrée générale » (Entrée, les trois catégories, portes « Porte Nord » et « Porte Sud ») ; « Ajouter une zone » : « Carré VIP » (« Contrôle de zone », VIP et VVIP, porte « Accès carré ») ; « Enregistrer les zones » ; attribuer « Porte Nord — Entrée générale » au premier contrôleur, « Porte Sud — Entrée générale » au second avec « Peut changer de porte » (étapes 6.7 et 6.13, essai 81) | « Zones enregistrées. » ; « Porte de {nom} : Porte Nord. » ; au scanner, le premier lit « Votre porte : Porte Nord · Entrée générale (Entrée). … » et n'a pas « Changer de porte » ; le second l'a, choisit « Accès carré · Carré VIP (Contrôle de zone) » et lit « Votre porte : Accès carré. » ; une zone sans porte est refusée : « La zone {nom} n’a aucune porte : ajoutez-en au moins une. » | Aucun | ☐ OK ☐ anomalie |

## 7. L'achat (80 min)

Existants : Essais 16, 17, 18, 19, 20, 22, 23, 24, 25 et 26 (téléphone, mode B) ; `docs/essai-local.md` sections 8.3, 8.4, 8.5.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P7.1 | Page d'attente ouverte, faux SamirPay en attente | « Annuler le paiement » | « Paiement annulé », places rendues | Aucun | ☐ OK ☐ anomalie |
| P7.2 | Paiement en attente, depuis le lot 9 bis aussi après la fin de la garde des places | Lancer un second achat | « Un paiement est déjà en attente pour cet événement. » | Aucun | ☐ OK ☐ anomalie |
| P7.3 | Panier gratuit + payant | Payer | Une seule confirmation, billets gratuits inclus | F2 : « Event Village : achat confirmé, {ticket_count} billets {title}. Frais de service {service_fee}, total payé {total}. {APP_URL}/tickets » | ☐ OK ☐ anomalie |
| P7.4 | Dernière place ; depuis le lot 9 ter, la fiche et l'accueil ouverts dans une autre fenêtre, sans les recharger | Acheter | « Complet » en direct sur la fiche ; depuis le lot 9 ter aussi sur la carte de l'accueil : badge « Dernières places » sous le seuil, puis « Complet » quand plus rien n'est achetable en ligne ; une catégorie épuisée fait passer « À partir de » au prix suivant (étapes 4.8 et 7.14) | Cloche partenaire : « Catégorie complète » | ☐ OK ☐ anomalie |
| P7.5 | Depuis le lot 9 bis. Paiement en attente plus de 10 minutes | Rester sur la page d'attente | Bandeau « Paiement toujours en attente. » ; places plus garanties, paiement encore valable | Aucun | ☐ OK ☐ anomalie |
| P7.6 | Depuis le lot 9 bis. Billet acheté | Ouvrir la carte dans Mes billets | « Prix » et « Frais de service » affichés | Aucun | ☐ OK ☐ anomalie |
| P7.7 | Depuis le lot 9 ter. Mode réel, adresse de l'application en https, avec l'essai 60 | Payer avec Wave, valider ; une seconde fois, abandonner chez Wave (étape 7.5, essai 85) | Wave ramène sur la page de suivi du paiement dans Event Village ; « Paiement confirmé » seulement quand le serveur l'a reçu ; après l'abandon, l'état lu sur le serveur, jamais un succès déduit du retour. En simulé : sans objet | SMS d'achat confirmé pour le premier paiement | ☐ OK ☐ anomalie |
| P7.8 | Depuis le lot 9 ter. Une catégorie « Complet », jauge pleine | Augmenter la quantité de cette catégorie ; puis augmenter la jauge, puis la quantité ; regarder la fiche et l'accueil sans recharger (étape 5.11, essai 79) | Refus sous « Quantité mise en vente » : « Les quantités mises en vente des catégories actives totaliseraient {somme} places. Augmentez d’abord la capacité totale de l’événement (actuellement {jauge}). » ; ensuite, la fiche dit « Plus que {n} places » ou « Disponible » et la carte perd « Complet », sans recharger | Aucun | ☐ OK ☐ anomalie |
| P7.9 | Depuis le lot 9 ter. Paiement en attente sur la dernière place | Ne pas payer ; attendre la fin de la garde (10 min par défaut) et le passage du rapprochement (5 min au plus) | La place revient : la fiche et la carte redeviennent achetables d'elles-mêmes | Aucun | ☐ OK ☐ anomalie |

## 8. Après l'achat (50 min)

Existants : Essais 27 (après P0.3), 28, 62, 63 ; `docs/essai-local.md` section 8.8 bis.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P8.1 | Transfert en attente | Fatou : « Annuler le transfert » | Billet disponible, QR revenu | F2 : « Event Village : le transfert du billet {title} a été annulé par son propriétaire. » | ☐ OK ☐ anomalie |
| P8.2 | Transfert en attente | Attendre 48 h, ou noter « sans objet » | Après la tâche horaire, QR revenu ; Lamine non prévenu | Cloche de Fatou : « Transfert expiré » | ☐ OK ☐ anomalie |
| P8.3 | Invitation envoyée | Mariama : annuler | « Invitation annulée : la place revient au stock. » ; depuis le lot 9 ter, la fenêtre dit « … La place revient au stock et l’invité est prévenu par SMS. » (écart du lot 9 bis corrigé, essai 93) | Depuis le lot 9 bis, F2 : « Event Village : votre invitation pour {title} du {start_at} est annulée par l'organisateur. » (R22 corrigé) | ☐ OK ☐ anomalie |
| P8.4 | Invitation à un compte vérifié | Ouvrir Mes billets de ce compte | Billet présent, sans cloche | F2 : SMS d'invitation seul | ☐ OK ☐ anomalie |
| P8.5 | Depuis le lot 9 bis. Transfert en attente vers Lamine | Lamine : « Refuser le billet » | « Billet refusé : il reste à son expéditeur. » ; billet revenu chez Fatou avec son QR | Cloche de Fatou : « Billet refusé » | ☐ OK ☐ anomalie |
| P8.6 | Depuis le lot 9 bis. Fatou connectée depuis plus de 10 minutes | Lancer un transfert | Fenêtre du mot de passe d'abord ; transfert vers son propre numéro refusé | Aucun avant le transfert | ☐ OK ☐ anomalie |
| P8.7 | Depuis le lot 9 ter. Onglet Invitations, catégorie VIP | « Numéro 1 » : un numéro sans compte, « Nom de l’invité 1 » : « Awa Diop » ; envoyer ; dans l'historique, « Modifier le nom » puis « Enregistrer » (étape 8.8, essai 78) | La confirmation montre la colonne « Invité » ; l'historique aussi ; « Nom de l’invité enregistré. » ; une fois le billet utilisé (P10.8), « Modifier le nom » n'est plus proposé | F2 : SMS d'invitation, sans le nom | ☐ OK ☐ anomalie |

## 9. Les rappels (25 min, plus l'attente)

Existants : Essais 47, 48 (début entre 8 h et 19 h) ; `docs/essai-local.md` section 8.7. Tâche à la main : `node scripts/dev/cron-local.mjs --once ev_reminders`.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P9.1 | Billet gratuit seul, veille de l'événement à 10 h | Lancer la tâche | Cloche et push, pas de SMS | Cloche : « Rappel : c'est demain » | ☐ OK ☐ anomalie |
| P9.2 | Billet payant, sans push | Lancer la tâche à H-3 | SMS envoyé | F2 : « Event Village : {title} à {start_at}. Ouvrez votre billet avant d'arriver : QR renouvelé toutes les 20 s. {APP_URL}/tickets » | ☐ OK ☐ anomalie |

## 10. Le jour J (90 min, téléphone)

Existants : Essais 30, 31, 32, 33, 34, 35 ; `docs/essai-local.md` sections 8.8 et 9.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P10.1 | Billet d'un autre événement | Scanner | « Billet d’un autre événement », trois vibrations marquées (corrigé au lot 9 ter : la ligne disait « deux », le code fait trois impulsions, `lib/hardware/feedback.ts:15-22`) | Aucun | ☐ OK ☐ anomalie |
| P10.2 | Événement sans date de fin, heure passée minuit | Quitter l'application, y revenir | Depuis le lot 9 bis, le contrôle reste ouvert jusqu'au début + 6 heures (R16 corrigé) | Aucun | ☐ OK ☐ anomalie |
| P10.3 | Transfert en attente | Saisie manuelle du numéro | Depuis le lot 9 bis, refus « Transfert en cours » (R19 corrigé) | Aucun | ☐ OK ☐ anomalie |
| P10.4 | Avant l'heure d'ouverture | Scanner | « Contrôle pas encore ouvert » | Aucun | ☐ OK ☐ anomalie |
| P10.5 | Depuis le lot 9 ter. Zones de P6.7, un billet SIMPLE déjà entré, le second contrôleur à « Accès carré » | Présenter le SIMPLE à « Accès carré » (étape 10.14, essai 77) | Écran orange « Accès refusé : billet SIMPLE », « Présentez-vous à : Entrée générale », deux vibrations longues, aucun son ; rien n'est composté | Aucun | ☐ OK ☐ anomalie |
| P10.6 | Depuis le lot 9 ter. Un billet VIP jamais scanné | Le présenter à « Accès carré » ; puis le scanner à la Porte Nord ; puis de nouveau à « Accès carré » (étapes 10.4 et 10.14) | Orange « Pas encore entré », « Passez d’abord par : Entrée générale » ; à la Porte Nord, vert avec « VIP » sur sa bande de couleur, la consigne de P3.7 en gros et « Zone : Entrée générale · Porte Nord » ; au carré, vert « Accès autorisé », « Zone : Carré VIP », « Entré à {HH:MM}, Porte Nord » | Cloche du détenteur : « Entrée validée », une seule fois | ☐ OK ☐ anomalie |
| P10.7 | Depuis le lot 9 ter. Le billet entré à la Porte Nord en P10.6 | Le scanner à la Porte Sud (étape 10.5) | Rouge foncé « Billet déjà utilisé », « Déjà utilisé à {HH:MM}, Porte Nord », trois vibrations | Aucun | ☐ OK ☐ anomalie |
| P10.8 | Depuis le lot 9 ter. Invitation « Awa Diop » de P8.7, contrôleur à la Porte Nord | « Liste des invités », 4 derniers chiffres du numéro, « Rechercher », « Choisir », cocher « J’ai vérifié la pièce d’identité », « Valider l’entrée d’une personne » ; puis rechercher de nouveau (étape 10.15, essai 78) | Carte « Awa Diop », « VIP », « 1 billet » ; bandeau « Vérifiez la pièce d’identité » ; le bouton reste inactif tant que la case n'est pas cochée ; vert, porteur « Awa Diop », badge « Invitation » ; la seconde recherche dit « Aucune invitation non utilisée pour ce numéro. » | Aucun SMS, aucune cloche | ☐ OK ☐ anomalie |
| P10.9 | Depuis le lot 9 ter. Même contrôleur | Faire 31 recherches dans l'heure ; puis chercher depuis l'autre contrôleur (étape 10.15) | La 31e : « Trop de recherches dans l’heure : réessayez dans {n} min. » ; l'autre contrôleur cherche normalement | Aucun | ☐ OK ☐ anomalie |
| P10.10 | Depuis le lot 9 ter. Un contrôleur affecté à l'événement à zones sans porte | « Commencer le contrôle », scanner un billet (étapes 10.2 et 10.3) | Bandeau « Aucune porte attribuée » ; écran gris « Aucune porte affectée », « Demandez à l’organisateur de vous attribuer une porte. Rien n’a été validé. », aucune vibration, aucun compteur | Aucun | ☐ OK ☐ anomalie |
| P10.11 | Depuis le lot 9 ter. Un billet SIMPLE jamais scanné ; le second contrôleur revenu à la Porte Sud par « Changer de porte » | Scanner ce billet au même instant à la Porte Nord et à la Porte Sud | Un seul vert ; l'autre écran est rouge « Billet déjà utilisé », « Déjà utilisé à {HH:MM}, {porte du premier} » | Aucun | ☐ OK ☐ anomalie |

## 11. Le guichet et la caisse (35 min)

Existants : Essais 36, 37, 38 ; `docs/essai-local.md` section 8.9.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P11.1 | Caisse ouverte | Retirer le droit d'encaisser | Depuis le lot 9 bis, l'onglet Caisse du contrôleur reste tant que la caisse est ouverte ; Mariama peut aussi « Fermer cette caisse » dans l'onglet Caisse du pilotage (R17 corrigé) | Aucun | ☐ OK ☐ anomalie |
| P11.2 | Depuis le lot 9 ter. Événement à zones, contrôleur avec caisse à une porte de « Contrôle de zone », puis à la Porte Nord | Onglet « Guichet », vendre un billet (étape 11.2) | À la porte de contrôle : refus « La vente au guichet se fait à une porte d’entrée : demandez à l’organisateur de changer votre porte. » ; à la Porte Nord, une catégorie qui n'entre pas par cette porte est grisée, « N’entre pas par votre porte » | Aucun | ☐ OK ☐ anomalie |

## 12. Le pilotage (40 min)

Existants : Essais 39, 40, 41.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P12.1 | Pilotage ouvert ; « Mes événements » ouvert dans un autre onglet | Une vente en ligne dans une autre fenêtre (étape 12.1, essai 88) | Depuis le lot 9 ter, les chiffres du pilotage changent sans recharger et « En direct » dit vrai (R49 corrigé ; avant, ils ne bougeaient pas) ; « Mes événements » et le tableau de bord de l'administration ne disent jamais « En direct » : « Mis à jour à {HH:MM} » | Aucun | ☐ OK ☐ anomalie |
| P12.2 | Depuis le lot 9 ter. Après P10.5 à P10.11 | Onglet Entrées (étape 12.4) | Cartes « Liste des invités » (1), « Débit » (« {x} par minute »), « Contrôleurs actifs » (« {a} sur {b} ») ; « Mis à jour à {HH:mm} » ; « Par zone » (« Carré VIP (contrôle de zone) »), « Par porte », « Par catégorie », « Par origine » ; « Validations par la liste des invités » avec « Awa Diop » ; « Refus par motif » avec « Mauvaise zone », « Pas encore entré » et « Billet déjà utilisé » | Aucun | ☐ OK ☐ anomalie |
| P12.3 | Depuis le lot 9 ter. `superadmin` règle « Alerte de refus à une porte : nombre de refus » à 3 (P18.7) | Scanner 3 faux billets à la Porte Sud en moins de 5 minutes ; puis remettre le seuil à 10 (étape 12.7, essai 82) | Dans l'onglet Entrées, bandeau rouge « Beaucoup de refus à Porte Sud », « 3 refus dans les 5 dernières minutes. Vérifiez avec le contrôleur : faux billets, mauvaise porte ou billets déjà utilisés. » | Cloche, push et email de la partenaire : « Refus en série à une porte », « Porte Sud : 3 refus en 5 minutes pour « {title} ». Vérifiez la porte avec vos contrôleurs. » ; aucun SMS ; une seule alerte pour la durée observée | ☐ OK ☐ anomalie |
| P12.4 | Depuis le lot 9 ter. Après P12.2 | Onglet Clôture, « Exporter les participants » (étape 12.6) | Description « Fichier CSV : nom, catégorie, origine, statut du billet, heure d’entrée, zone et porte. Aucune donnée de paiement ni numéro de billet. » ; colonnes Nom, Catégorie, Origine, Statut du billet, Heure d’entrée, Zone, Porte ; l'invitée entrée par la liste s'écrit « Invité, entré par la liste » | Aucun | ☐ OK ☐ anomalie |

## 13. La suspension (35 min)

Aucun essai existant.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P13.1 | « Nuit du Mbalax » publié, 1 billet vendu | Aïda : « Suspendre », motif | Page avec bandeau, hors catalogue | F2 : « Event Village : événement {title} suspendu. Motif : {reason} {APP_URL}/partner/events » ; Cloche du détenteur : « Événement suspendu » ; pas de SMS détenteur ; depuis le lot 9 bis, cloche des contrôleurs : « Événement suspendu » | ☐ OK ☐ anomalie |
| P13.2 | Suspendu | Acheter, scanner, transférer, inviter, retirer l'argent de l'événement, annuler en tant que Mariama | Refus cités à l'étape 13.2 ; billet toujours « Valable », depuis le lot 9 bis QR masqué (R25 corrigé), fonds gelés, annulation réservée à l'admin | Aucun | ☐ OK ☐ anomalie |
| P13.3 | Suspendu | « Réactiver » | Vente reprise | Cloche du détenteur : « Événement de nouveau en ligne » | ☐ OK ☐ anomalie |
| P13.4 | Suspendu, fin passée | Chercher « Réactiver » ; puis « Clore l’événement » avec un motif | Depuis le lot 9 bis, « Réactiver » n'est plus proposé ; « Clore l’événement » passe l'événement « Terminé », sans remboursement (R3 corrigé) ; depuis le lot 9 ter, le champ du motif s'appelle « Motif de la clôture » (écart du lot 9 bis corrigé, essai 93) | F2 : « Event Village : {title} est clos après sa suspension, sans annulation ni remboursement automatique. {APP_URL}/tickets » ; F2 : « Event Village : {title} est clos par l'équipe Event Village après sa suspension. Motif : {reason} » | ☐ OK ☐ anomalie |

## 14. L'annulation (45 min)

Existants : Essais 44, 45, 46 (voir l'avertissement), 58, 60 ; `docs/essai-local.md` sections 8.10, 8.11.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P14.1 | Aïda annule un événement avec ventes | `/admin/events/{id}` | Remboursements lancés ; depuis le lot 9 bis, partenaire prévenue sur le moment (R15 corrigé), contrôleurs aussi | F2 : « Event Village : {title} du {start_at} est annulé. Remboursement automatique en cours. {APP_URL}/tickets » ; F2 : « Event Village : {title} annulé par l'administration. Motif : {public_notice} {APP_URL}/partner/events » | ☐ OK ☐ anomalie |
| P14.2 | Billet transféré à Lamine | Annuler | Lamine lit que le remboursement va à l'acheteur d'origine, l'argent va à Fatou ; depuis le lot 9 bis, Fatou est prévenue même sans billet (R13 corrigé) | Cloche de Lamine : « Événement annulé » ; F2 : SMS à Lamine et à Fatou | ☐ OK ☐ anomalie |
| P14.3 | Caisse ouverte | Annuler | La caisse reste ouverte ; depuis le lot 9 bis, avertissement d'annulation en cours d'événement si l'événement a commencé (R48) | Aucun | ☐ OK ☐ anomalie |
| P14.4 | Depuis le lot 9 bis. Ventes au guichet | Annuler, puis onglet Clôture | Liste « Espèces à rembourser par l'organisateur », case « Remboursé » définitive (R20) | Aucun | ☐ OK ☐ anomalie |
| P14.5 | Depuis le lot 9 ter. Billet de Fatou transféré à Lamine, accepté, puis transféré par Lamine à Awa, accepté | Annuler l'événement (étape 14.5) | Awa, détentrice actuelle, lit que le remboursement va à l'acheteur d'origine ; l'argent va à Fatou ; Lamine n'est plus concerné | F2 : SMS d'annulation à Awa et à Fatou, aucun à Lamine ; aucun message « Billet annulé » | ☐ OK ☐ anomalie |

## 15. Billet seul (25 min)

Existants : Essais 58, 59.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P15.1 | Billet gratuit | « Annuler ce billet gratuit » | « Billet annulé » ; depuis le lot 9 bis, le détenteur est prévenu (R22 corrigé) | F2 : « Event Village : votre billet gratuit pour {title} du {start_at} est annulé par l'organisateur. » | ☐ OK ☐ anomalie |
| P15.2 | Transfert en attente | Rembourser le billet | Accepté ; depuis le lot 9 bis, le transfert est annulé dans la même opération et quitte « Reçus » (R61 corrigé) | Cloche de Fatou : « Remboursement demandé » ; F2 : « Event Village : le billet {title} qui vous était transféré a été remboursé à son acheteur. Le transfert est annulé. » | ☐ OK ☐ anomalie |
| P15.3 | Depuis le lot 9 bis. Événement terminé | Mariama : rembourser un billet | Bandeau « Remboursement réservé à Event Village » ; l'admin avec « Gérer les remboursements » le peut | Aucun | ☐ OK ☐ anomalie |
| P15.4 | Depuis le lot 9 ter. Billet de Fatou transféré à Lamine et accepté | Mariama : rembourser ce billet (étape 15.5, essai 83) | Le versement va à Fatou ; Lamine voit « Remboursement en cours » | F2 : « Event Village : votre billet {catégorie} pour {title} a été annulé. Le remboursement est versé à l'acheteur d'origine. » à Lamine ; cloche de Lamine : « Billet annulé » ; cloche de Fatou : « Remboursement demandé » ; rien à un ancien détenteur | ☐ OK ☐ anomalie |

## 16. La fin de l'événement (55 min, plus 48 h pour le retrait)

Existants : Essais 41, 42, 43, 49, 50, 56. Tâche à la main : `node scripts/dev/cron-local.mjs --once ev_events_finish`.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P16.1 | Événement à venir dans 10 min, fin dans 20 min | Attendre la fin, lancer la tâche | « Terminé » ; depuis le lot 9 bis, la partenaire est prévenue | Cloche de la partenaire : « Événement terminé », ou « Caisse encore ouverte » avec un SMS si une caisse l'est | ☐ OK ☐ anomalie |
| P16.2 | Billet non scanné | Mes billets après la fin | Historique, encore « Valable » ; depuis le lot 9 bis, « Événement terminé. » à la place du QR une fois le contrôle fermé (R25 corrigé) | Aucun | ☐ OK ☐ anomalie |
| P16.3 | Disponible d'au moins 6 000 F | Retrait de 6 000 F | Depuis le lot 9 bis, le devis s'affiche avant le code : « Vous recevrez 5 940 F CFA » ; 60 F de frais, 5 940 F versés ; depuis le lot 9 ter, pendant l'envoi, « Retraits en cours » montre 6 000 F CFA, le brut réservé, avec l'aide « Montant réservé sur votre solde, frais compris, pendant l’envoi vers Wave ou Orange Money. » (étape 16.7) | F2 : « Event Village : votre code de retrait est {code}. Valable 10 minutes. Ne le donnez à personne. », puis « Event Village : votre retrait de {amount} a été versé sur votre compte Wave. » | ☐ OK ☐ anomalie |
| P16.4 | Depuis le lot 9 ter. Événement validé, jamais publié, dont la fin est passée | Lancer `node scripts/dev/cron-local.mjs --once ev_events_finish` (étape 16.1, essai 92) | « Terminé » dans « Mes événements » ; jamais dans Explorer ; fiche admin sans lien vers la page publique ; un scan de ses invitations répond « Contrôle pas encore ouvert » | Aucun, à personne | ☐ OK ☐ anomalie |
| P16.5 | Depuis le lot 9 ter. Événement de P12.2, terminé | `/partner/dashboard`, « Clôture » ; puis l'onglet Clôture du pilotage ; puis « Télécharger le PDF » (étape 16.4) | Le même rapport dans la fenêtre et dans l'onglet, avec la section « Entrées » ; la fenêtre ajoute « Ventes par catégorie » ; aucun taux de remplissage ; le PDF a « 3. Entrées par zone », « 4. Entrées par origine », « 5. Entrées par porte » | Aucun | ☐ OK ☐ anomalie |
| P16.6 | Depuis le lot 9 ter. Un événement où un filleul de `client1` a acheté, suspendu par `superadmin` | `client1` : `/wallet`, demander un retrait ; puis réactiver l'événement (étapes 16.11 et 16.12, essai 87) | Bandeau « Commissions gelées : {montant}. » ; refus « Une partie de vos commissions est gelée : un événement pour lequel vos filleuls ont acheté des billets est suspendu. », aucun code ; à la reprise, le bandeau disparaît | Aucun SMS pendant la suspension | ☐ OK ☐ anomalie |

## 17. Cas transverses (30 min)

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P17.1 | `client1` avec un billet | Aïda : « Suspendre », motif ; puis « Réactiver » | Déconnecté, billet inchangé ; depuis le lot 9 bis, motif obligatoire et client prévenu (R59 corrigé) ; billet payé valable à l'entrée | F2 : « Event Village : votre compte est suspendu. Motif : {reason}. Vos billets payés restent valables à l'entrée. Contactez le support. », puis « Event Village : votre compte est réactivé. Vous pouvez de nouveau vous connecter : {APP_URL}/login » | ☐ OK ☐ anomalie |
| P17.2 | Contrôleur en plein scan | Mariama : retirer | Depuis le lot 9 bis, « Vous ne contrôlez plus cet événement » au scan suivant | F2 : « Event Village : votre affectation à l'entrée de {title} est retirée. » | ☐ OK ☐ anomalie |
| P17.3 | Transfert vers Lamine | Lamine change de numéro avant d'accepter | Depuis le lot 9 bis, transfert annulé, billet revenu chez Fatou (R63 corrigé) | F2 : SMS à l'ancien numéro ; cloche de Fatou : « Transfert annulé » | ☐ OK ☐ anomalie |

## 18. Admin et SUPERADMIN (45 min)

Existants : Essais 51, 52, 53, 54 (après P0.2), 56, 57, 58, 60.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P18.1 | Moussa sans « Gérer les événements » | Ouvrir l'événement, chercher « Annuler l’événement » ; ouvrir le pilotage par l'adresse | Depuis le lot 9 bis, bouton masqué ; refus « Action non autorisée : votre compte n’a pas la permission « Gérer les événements ». » aussi par les adresses de la partenaire (R2 corrigé) | Aucun | ☐ OK ☐ anomalie |
| P18.2 | Une notification en échec | Relancer | « Notification remise en attente… » | Aucun autre | ☐ OK ☐ anomalie |
| P18.3 | Depuis le lot 9 bis. Connecté en `admin` (ADMIN) | `/admin/finance-settings` ; `/admin/users`, créer un compte ADMIN | « Modifier » absent, « Lecture seule : seul un superadministrateur peut modifier ces réglages. … » ; création refusée (R51, R71) | Aucun | ☐ OK ☐ anomalie |
| P18.4 | Depuis le lot 9 bis. Un versement bloqué ou refusé | `/admin/finance`, « Versements à reprendre », « Renvoyer » avec une justification | Ligne renvoyée, décision au journal | Aucun | ☐ OK ☐ anomalie |
| P18.5 | Depuis le lot 9 ter. Mode A, faux SamirPay en délai dépassé : un remboursement « Issue incertaine » sans identifiant SamirPay ; connecté en `superadmin` | « Constater non versé », « Référence du support SamirPay », « Motif » d'au moins 10 caractères, mot de passe si demandé ; puis, en `admin`, « Renvoyer » (étapes 14.8 et 18.7, essai 84) | « Versement constaté non versé », « Il reste dans la liste : renvoyez-le quand vous le souhaitez. » ; la ligne dit « Non versé (constaté avec le support SamirPay) » ; rien ne repart seul ; « Renvoyer » fait un seul nouvel envoi | Aucun au constat | ☐ OK ☐ anomalie |
| P18.6 | Depuis le lot 9 ter. La même ligne, connecté en `admin` (ADMIN) | Chercher « Constater non versé » | Bouton absent | Aucun | ☐ OK ☐ anomalie |
| P18.7 | Depuis le lot 9 ter. Connecté en `superadmin` | `/admin/finance-settings`, section « Contrôle d’accès » (étape 18.4) | « Alerte de refus à une porte : nombre de refus » (10) et « Alerte de refus à une porte : durée observée » (5 min) ; un seuil de 2 est refusé par le serveur | Aucun | ☐ OK ☐ anomalie |
