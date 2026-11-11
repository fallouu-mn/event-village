# Glossaire d'Event Village

Ce glossaire fixe **un seul nom pour chaque chose**. Il sert à écrire les écrans, les SMS, les emails, les guides et les cahiers de recette. Quand deux mots désignent la même chose, on emploie le mot retenu ici, et jamais l'autre.

Il a été établi au lot 9 bis (constat R76 de la revue critique de `docs/parcours-evenement-complet.md`). Les mots entre guillemets sont ceux de l'écran.

---

## 1. Les personnes et les comptes

| Mot retenu | Ce que c'est | À ne pas dire |
|---|---|---|
| **client** | Une personne qui achète ou reçoit des billets. | utilisateur, acheteur (sauf pour l'acheteur d'un billet précis) |
| **partenaire** | Le compte professionnel qui crée et vend des événements, avec ses écrans : « Espace partenaire », « Devenir partenaire », la fiche partenaire de l'administration. | organisateur, pour parler du compte ou de ses écrans |
| **organisateur** | La même entreprise, mais **vue par le public et les clients** : fiche publique d'un événement, « Remboursement par l'organisateur », « Espèces à rembourser par l'organisateur », mention « Organisateur » du billet PDF. | partenaire, dans un texte lu par un client |
| **contrôleur** | La personne qui scanne les billets à l'entrée et tient une caisse au guichet. | scanneur, agent |
| **administrateur** | Un membre de l'équipe Event Village. Il n'agit que sur ce que ses **permissions** lui ouvrent. | admin, dans un texte lu par un client |
| **Superadmin** | L'administrateur principal. Lui seul crée un administrateur, change ses permissions et modifie les **Réglages de la plateforme**. | super-administrateur |
| **compte de démonstration** | Un compte créé par `npm run seed:dev` pour les essais sur le PC. En réel, il ne reçoit jamais rien : la supervision affiche « Non envoyé : compte de démonstration ». | compte de test, faux compte |

États d'un compte, tels que l'écran les affiche : **Actif**, **Suspendu**, **En attente**, **Supprimé**. Un compte effacé à la demande de son titulaire s'affiche « Données effacées ».

État du dossier d'un partenaire : **En attente**, **Validé**, **Refusé**, **Suspendu**. On dit « refusé » ou « refusée », jamais « rejeté » ni « rejetée » : « La demande du partenaire « … » a été refusée. »

---

## 2. Les événements et les billets

| Mot retenu | Ce que c'est | À ne pas dire |
|---|---|---|
| **événement** | Ce que le partenaire crée, fait valider puis met en vente. | soirée, spectacle (sauf dans un titre) |
| **catégorie** | Un lot de places d'un même prix dans un événement : « Pass général », « Tarif guichet », « Carré invités ». Une catégorie dont le nom ne se lit plus s'affiche « Catégorie inconnue ». | formule, tarif, pass (sauf dans un nom de catégorie) |
| **quantité mise en vente** | Le nombre de places d'une catégorie. | quota |
| **jauge** | Le nombre total de places de l'événement. La somme des quantités mises en vente ne doit pas la dépasser. | capacité, dans un texte d'écran |
| **billet** | Le droit d'entrée d'une personne, avec son numéro et son QR. | ticket, place (sauf « places restantes ») |
| **Mes billets** | La page des billets du client. La barre du bas peut dire « Billets » faute de place. | Vos billets, comme titre de page |
| **Reçus** | L'onglet de Mes billets où attendent les billets reçus par transfert ou par invitation. | En attente |
| **invitation** | Un billet offert par le partenaire, envoyé à un numéro de téléphone. | billet gratuit (c'est autre chose : une catégorie à 0 F) |
| **transfert** | L'envoi d'un billet par son détenteur à un autre numéro. Pendant qu'il attend, le billet est « Transfert en cours » et ne passe pas à l'entrée. | cession, don |

États d'un billet : **Valable**, **Utilisé**, **Annulé**, **Remboursé**. Le billet PDF reprend les mêmes mots (« STATUT : VALABLE »). Au scan, l'écran dit **« Entrée validée »**.

États d'un événement : **Brouillon**, **En attente de validation**, **Validé**, **Publié**, **Suspendu**, **Terminé**, **Annulé**.

Fin d'un événement : la date et l'heure de fin saisies ; une date de fin sans heure vaut 23 h 59 ; **sans date de fin, l'événement se termine 6 heures après son début**.

---

## 3. L'argent

| Mot retenu | Ce que c'est | À ne pas dire |
|---|---|---|
| **F CFA** | L'unité écrite après un montant : « 5 000 F CFA ». Dans une phrase sans montant, « francs CFA » reste permis. | FCFA, XOF, F seul après un montant |
| **frais de service** | Ce que paie l'acheteur en plus du prix du billet. | commission, frais de plateforme |
| **solde** | Un montant d'argent disponible sur un compte. | portefeuille, pour parler du montant |
| **Portefeuille** | La page des gains de parrainage d'un client (titre : « Portefeuille de parrainage »). | Solde, comme nom de page ; « Portefeuille et parrainage » |
| **retrait** | L'argent que le partenaire, ou le client pour son parrainage, fait verser sur son compte Wave ou Orange Money. | virement, paiement |
| **remboursement** | L'argent rendu à un client. | avoir, restitution |
| **versement** | Tout envoi d'argent par Event Village : un remboursement ou un retrait. L'écran de l'administration qui liste ceux qui sont bloqués s'appelle « Versements à reprendre ». | cashout, payout, dans un texte d'écran |
| **Remboursement retardé** | Ce que voit le client quand son remboursement est bloqué : « Remboursement retardé, l'équipe Event Village s'en occupe. » | Échec, Erreur |
| **vente au guichet** | Un billet vendu sur place, payé en espèces au contrôleur. À l'annulation, la plateforme ne la rembourse jamais : c'est l'organisateur qui rend l'argent. | vente sur place, vente en caisse |
| **caisse** | La session d'un contrôleur au guichet, de « Ouvrir ma caisse » à « Clôturer ma caisse ». Le code demandé à l'ouverture est le **code PIN régisseur**. | Z de caisse, dans un texte d'écran |

---

## 4. Les codes et les messages

| Mot retenu | Ce que c'est | À ne pas dire |
|---|---|---|
| **code** | Le code reçu par SMS. On précise son usage : « code de vérification », « code de retrait », « code d'activation ». | code OTP, OTP |
| **SMS indispensable** | Un message qui part toujours (confirmation d'achat, annulation, remboursement…). On ne peut pas le couper. | SMS obligatoire, SMS transactionnel |
| **SMS facultatif** | Un message que le client peut couper dans ses préférences (rappels, par exemple). | SMS marketing |
| **adresse vérifiée** | Une adresse email confirmée par le lien reçu. Seule une adresse vérifiée reçoit des emails. Sinon, le profil affiche « Email non vérifié » et « Renvoyer le lien ». | adresse validée, adresse confirmée |

Numéro de téléphone mal saisi, partout le même texte : **« Numéro de mobile sénégalais invalide. Exemple : 77 123 45 67. »**

---

## 5. L'administration

| Mot retenu | Ce que c'est | À ne pas dire |
|---|---|---|
| **Réglages de la plateforme** | La page où le Superadmin change les valeurs de la plateforme : frais, délais, seuils, durée de garde des places. | Réglages financiers, Tarification |
| **permission** | Ce qu'un administrateur a le droit de faire : « Consulter les événements », « Gérer les remboursements »… Sans la permission, le bouton n'apparaît pas, et l'action est refusée avec un message en français. | droit, rôle (le rôle est Administrateur ou Superadmin) |
| **supervision** | La page **Notifications** de l'administration, qui montre chaque SMS, email et push avec son état. | journal, logs |

---

## 6. Écarts encore présents dans l'application

Relevé dans le code le 11/11/2026 (branche `lot9bis/cycle-evenement`, commit `78b32ac`). Ces textes n'ont pas encore été alignés sur ce glossaire.

| Où | Texte actuel | Mot retenu |
|---|---|---|
| `lib/validations/event.ts:289-290` | « Le quota est un nombre entier de billets. », « Le quota compte au moins 1 billet. », « Le quota compte au plus 100 000 billets. » | quantité mise en vente |
| `lib/validations/event.ts:425` | « La somme des quotas des catégories actives (…) dépasse la jauge (…). » | quantités mises en vente |
| `components/partner/pilotage/OverviewTab.tsx:35-36`, `:63` | « Les quotas dépassent la jauge déclarée », « Quotas des catégories actives » | quantités mises en vente |
| `components/partner/pilotage/SalesTab.tsx:82` | « Restants = quota de la catégorie moins les ventes… » | quantité mise en vente |
| `app/admin/finance-settings/page.tsx:65`, `:73-74` | « au FCFA supérieur », « Montant entier en FCFA. », unité « FCFA » | F CFA |
| Salles, tables et commandes (`app/api/halls/**`, `app/api/orders/create/route.ts`) | « FCFA » | F CFA (services fermés pour l'instant) |
