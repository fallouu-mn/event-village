# Plan de test manuel du module événements

À suivre dans l'ordre sur event-village-dev, chapitres 0 à 18 de `docs/parcours-evenement-complet.md`. Ce plan renvoie aux essais de `docs/recette-billetterie.md` sans les recopier, et n'ajoute que ce qui manque. Mode A (simulé) par défaut : les SMS et les codes se lisent dans la fenêtre 2 ; les emails s'écrivent dans cette fenêtre si la clé Resend est absente. Les textes complets des messages, avec leurs modèles, sont cités aux étapes du parcours.

Légende : **OK / anomalie** à cocher. **Fenêtre** : `F2` = fenêtre 2 du mode A (`dev`) ; `Cloche` = la cloche du compte ; `Écran` = texte à l'écran.

| Bloc | Durée estimée | Exige |
|---|---|---|
| 0. Préparation | 25 min | — |
| 1. Client | 40 min | — |
| 2. Partenaire | 40 min | — |
| 3. Création | 30 min | — |
| 4. Validation | 25 min | — |
| 5. Modification | 40 min | — |
| 6. Équipe | 40 min | téléphone pour le SMS réel en mode B seulement |
| 7. Achat | 60 min | téléphone et mode B pour 7.19 et 7.20 |
| 8. Après l'achat | 40 min | — |
| 9. Rappels | 25 min, plus l'attente | — |
| 10. Jour J | 50 min | téléphone (vibration, caméra) et mode B pour le hors-ligne |
| 11. Guichet et caisse | 30 min | téléphone conseillé |
| 12. Pilotage | 20 min | — |
| 13. Suspension | 30 min | — |
| 14. Annulation | 40 min | — |
| 15. Billet seul | 20 min | — |
| 16. Fin de l'événement | 40 min, plus 48 h pour le retrait | — |
| 17. Cas transverses | 30 min | — |
| 18. Admin | 30 min | — |

## Essais existants qui échoueront, ou qui ne prouvent pas ce qu'ils disent

| Essai | Ce qui se passera | Raison | Que faire |
|---|---|---|---|
| Essai 1 | La bannière « Intégrations simulées » n'est pas à l'écran | Elle s'écrit dans la fenêtre 2 (`instrumentation.ts:12`) | Regarder la fenêtre 2 |
| Essai 27 | Lamine voit « Un billet vous attend peut-être », pas le billet | Les comptes du seed n'ont pas de numéro vérifié (`scripts/dev/seed-dev.core.ts:202-205`) | Faire d'abord l'essai P0.3 |
| Essai 46 | Pas de carte « Espèces à rembourser » | Les ventes au guichet sont déjà « Utilisé » (`M/20261106000001_lot8_canaux.sql:436-440`) : voir R20 | Noter l'écart, ne pas le chercher |
| Essai 54 | « Accès refusé » à l'ouverture de Notifications | Le compte `admin` du seed n'a aucune permission (`scripts/dev/seed-dev.core.ts`, `app/api/admin/notifications/route.ts:25`) | Faire d'abord l'essai P0.2 |
| Essai 55 | Passe, mais ne teste pas la suspension prévue | Le bouton ne pose que le statut du compte : aucun motif, aucun message (R6) | Faire aussi P2.3 |

## 0. Préparation (25 min)

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| Essais 1, 2 | `.env.local` en mode simulé, avec les lignes de quotas | Voir `docs/recette-billetterie.md` | Comptes connectés | Aucun | ☐ OK ☐ anomalie |
| P0.1 | Terminal PowerShell | Lancer `npm run seed:dev`, retaper la référence du projet | 6 comptes, 4 événements, aucune vente | F2 : aucun SMS | ☐ OK ☐ anomalie |
| P0.2 | Connecté en `superadmin` | `/admin/users`, « Permissions » sur `admin`, cocher `events.read`, `events.write`, `notifications.read`, `notifications.write`, `partners.read`, `partners.validate`, `payments.read`, `refunds.manage` | Message « Les permissions de l'administrateur… ont été enregistrées. » | Aucun | ☐ OK ☐ anomalie |
| P0.3 | Connecté en `client2` | `/tickets?tab=recus`, « Confirmer mon numéro », code lu en F2 | Message « Numéro confirmé. Les billets qui vous attendent s’affichent maintenant. » | F2 : « Votre code de verification Event Village est : {code}. Valable 10 minutes. » | ☐ OK ☐ anomalie |

## 1. Le client (40 min)

Existants : Essais 7, 8, 49, 65, 66, 67, 68, 69.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P1.1 | Numéro neuf (70 + 7 chiffres) | Se connecter par « Code SMS » avec un numéro déjà inscrit | Connexion, numéro marqué vérifié | F2 : « Votre code de verification Event Village est : {code}. Valable 10 minutes. » | ☐ OK ☐ anomalie |
| P1.2 | `client1` | 5 mots de passe faux | « Saisie temporairement bloquée », 60 s | Aucun | ☐ OK ☐ anomalie |
| P1.3 | Compte avec email réel | « Mot de passe oublié » par email | « Si un compte correspond à cette adresse… » ; noter l'expéditeur réel | Email : à relever | ☐ OK ☐ anomalie |

## 2. Le partenaire (40 min)

Existants : Essais 9, 10, 55 (voir l'avertissement).

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P2.1 | Partenaire de l'Essai 9, connecté avant validation | Ouvrir `/partner/dashboard` | Écart attendu R7 : « Tableau de bord indisponible » au lieu de « Compte en cours de vérification » | Cloche : « Inscription reçue » | ☐ OK ☐ anomalie |
| P2.2 | Un second dossier | Admin : « Refuser » avec motif ; partenaire : se connecter | Bandeau « Demande de compte partenaire refusée », motif, pas de renvoi de pièce possible | F2 : « Event Village : votre demande de compte partenaire n'est pas acceptée. Motif : {reason} » ; Cloche : « Demande refusée » | ☐ OK ☐ anomalie |
| P2.3 | Partenaire validé avec un événement publié | Admin : `/admin/users`, « Suspendre » | Déconnecté ; **aucun message** ; l'événement reste en vente (R5, R6) | Aucun | ☐ OK ☐ anomalie |
| P2.4 | Partenaire validé, jamais connecté | Ouvrir `/partner/dashboard` | « Période d’essai gratuite en cours », 60 jours | F2 : « Event Village : votre période d'essai de {days} jours commence aujourd'hui. Bienvenue ! » | ☐ OK ☐ anomalie |

## 3. Création de l'événement (30 min)

Existants : Essais 11, 12, 21, 61 ; `docs/essai-local.md` section 8.1.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P3.1 | Compte `partenaire`, brouillon sans affiche | « Soumettre à la validation » | « L'événement est incomplet : complétez-le avant de le soumettre. », sans dire quoi | Aucun | ☐ OK ☐ anomalie |
| P3.2 | Brouillon jamais soumis | « Supprimer le brouillon » | « Brouillon supprimé. » | Aucun | ☐ OK ☐ anomalie |
| P3.3 | Brouillon soumis puis retiré | « Supprimer le brouillon » | Refus « Ce brouillon a déjà été soumis… » | Aucun | ☐ OK ☐ anomalie |

## 4. Validation (25 min)

Existants : Essais 3, 4, 5, 6, 12, 13, 64, 65 ; `docs/essai-local.md` sections 8.2, 8.14.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P4.1 | Moussa sans `events.write` (P0.2, décocher) | Ouvrir l'événement en attente, « Valider » | Boutons visibles, puis « Permission manquante : events.write » (R51) | Aucun | ☐ OK ☐ anomalie |
| P4.2 | Événement validé | Aïda : « Publier » | « Événement publié. » | Cloche de la partenaire : « Événement publié » | ☐ OK ☐ anomalie |
| P4.3 | Événement tout juste publié, sans vente | Accueil, section Populaires | L'événement n'y est pas | Aucun | ☐ OK ☐ anomalie |

## 5. Modification après publication (40 min)

Existant : Essai 14.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P5.1 | Événement publié, 1 billet vendu | Changer le titre | Détenteurs prévenus, pas de SMS | Cloche : « Événement modifié » ; F2 : aucun SMS | ☐ OK ☐ anomalie |
| P5.2 | Idem, avant 22 h | Changer le lieu | Écran : « 1 détenteur de billets prévenu… » | F2 : « Event Village : {title} change de lieu : {new_location}. Vos billets restent valables. {APP_URL}/tickets » | ☐ OK ☐ anomalie |
| P5.3 | Idem, après 22 h, tâche des messages active | Changer la date | Le SMS ne part pas (R14) | Cloche : « Événement modifié » ; F2 : pas de SMS | ☐ OK ☐ anomalie |
| P5.4 | Catégorie sans vente, puis avec vente | Changer le prix | Accepté, puis champ verrouillé | Aucun | ☐ OK ☐ anomalie |
| P5.5 | Événement publié | Ajouter une catégorie | Visible et achetable sans validation, personne n'est prévenu | Aucun | ☐ OK ☐ anomalie |

## 6. L'équipe (40 min)

Existants : Essais 15, 29 ; `docs/essai-local.md` section 8.8.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P6.1 | Compte `client1` comme Awa | Inviter son numéro | Fenêtre « Compte existant », confirmation par la partenaire seule (R37) | F2 : « Event Village : affectation à l'entrée de {title}, {start_at}. {APP_URL}/login » | ☐ OK ☐ anomalie |
| P6.2 | Contrôleur activé | « Renvoyer le SMS » | Écran dit « prévenu » ; F2 : rien (R38) | Aucun | ☐ OK ☐ anomalie |
| P6.3 | Contrôleur invité sans prénom, activé | Regarder sa ligne | Reste « Activation en attente » (R39) | Aucun | ☐ OK ☐ anomalie |
| P6.4 | Caisse ouverte | Retirer le contrôleur | Refus « Ce contrôleur a une caisse ouverte… » | Aucun | ☐ OK ☐ anomalie |

## 7. L'achat (60 min)

Existants : Essais 16, 17, 18, 19, 20, 22, 23, 24, 25 et 26 (téléphone, mode B) ; `docs/essai-local.md` sections 8.3, 8.4, 8.5.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P7.1 | Page d'attente ouverte, faux SamirPay en attente | « Annuler le paiement » | « Paiement annulé », places rendues | Aucun | ☐ OK ☐ anomalie |
| P7.2 | Paiement en attente | Lancer un second achat | « Un paiement est déjà en attente » | Aucun | ☐ OK ☐ anomalie |
| P7.3 | Panier gratuit + payant | Payer | Une seule confirmation, billets gratuits inclus | F2 : « Event Village : achat confirmé, {ticket_count} billets {title}. Frais de service {service_fee}, total payé {total}. {APP_URL}/tickets » | ☐ OK ☐ anomalie |
| P7.4 | Dernière place | Acheter | « Complet » en direct | Cloche partenaire : « Catégorie complète » | ☐ OK ☐ anomalie |

## 8. Après l'achat (40 min)

Existants : Essais 27 (après P0.3), 28, 62, 63 ; `docs/essai-local.md` section 8.8 bis.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P8.1 | Transfert en attente | Fatou : « Annuler le transfert » | Billet disponible, QR revenu | F2 : « Event Village : le transfert du billet {title} a été annulé par son propriétaire. » | ☐ OK ☐ anomalie |
| P8.2 | Transfert en attente | Attendre 48 h, ou noter « sans objet » | Après la tâche horaire, QR revenu ; Lamine non prévenu | Cloche de Fatou : « Transfert expiré » | ☐ OK ☐ anomalie |
| P8.3 | Invitation envoyée | Mariama : annuler | « Invitation annulée : la place revient au stock. » | Aucun (R22) | ☐ OK ☐ anomalie |
| P8.4 | Invitation à un compte vérifié | Ouvrir Mes billets de ce compte | Billet présent, sans cloche | F2 : SMS d'invitation seul | ☐ OK ☐ anomalie |

## 9. Les rappels (25 min, plus l'attente)

Existants : Essais 47, 48 (début entre 8 h et 19 h) ; `docs/essai-local.md` section 8.7. Tâche à la main : `node scripts/dev/cron-local.mjs --once ev_reminders`.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P9.1 | Billet gratuit seul, veille de l'événement à 10 h | Lancer la tâche | Cloche et push, pas de SMS | Cloche : « Rappel : c'est demain » | ☐ OK ☐ anomalie |
| P9.2 | Billet payant, sans push | Lancer la tâche à H-3 | SMS envoyé | F2 : « Event Village : {title} à {start_at}. Ouvrez votre billet avant d'arriver : QR renouvelé toutes les 20 s. {APP_URL}/tickets » | ☐ OK ☐ anomalie |

## 10. Le jour J (50 min, téléphone)

Existants : Essais 30, 31, 32, 33, 34, 35 ; `docs/essai-local.md` sections 8.8 et 9.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P10.1 | Billet d'un autre événement | Scanner | « Billet d’un autre événement », deux vibrations marquées | Aucun | ☐ OK ☐ anomalie |
| P10.2 | Événement sans date de fin, heure passée minuit | Quitter l'application, y revenir | Écart R16 : caméra remplacée par « Événement terminé » | Aucun | ☐ OK ☐ anomalie |
| P10.3 | Transfert en attente | Saisie manuelle du numéro | Entrée validée (R19) | Cloche de Fatou : « Entrée validée » | ☐ OK ☐ anomalie |
| P10.4 | Avant l'heure d'ouverture | Scanner | « Contrôle pas encore ouvert » | Aucun | ☐ OK ☐ anomalie |

## 11. Le guichet et la caisse (30 min)

Existants : Essais 36, 37, 38 ; `docs/essai-local.md` section 8.9.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P11.1 | Caisse ouverte | Retirer le droit d'encaisser | Onglet Caisse disparaît, caisse sans sortie (R17) | Aucun | ☐ OK ☐ anomalie |

## 12. Le pilotage (20 min)

Existants : Essais 39, 40, 41.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P12.1 | Pilotage ouvert | Une vente en ligne dans une autre fenêtre | Les chiffres ne bougent pas sans recharger (R49) | Aucun | ☐ OK ☐ anomalie |

## 13. La suspension (30 min)

Aucun essai existant.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P13.1 | « Nuit du Mbalax » publié, 1 billet vendu | Aïda : « Suspendre », motif | Page avec bandeau, hors catalogue | F2 : « Event Village : événement {title} suspendu. Motif : {reason} {APP_URL}/partner/events » ; Cloche du détenteur : « Événement suspendu » ; pas de SMS détenteur | ☐ OK ☐ anomalie |
| P13.2 | Suspendu | Acheter, scanner, transférer, inviter | Refus cités à l'étape 13.2 ; billet toujours « Valable » (R25) | Aucun | ☐ OK ☐ anomalie |
| P13.3 | Suspendu | « Réactiver » | Vente reprise | Cloche du détenteur : « Événement de nouveau en ligne » | ☐ OK ☐ anomalie |
| P13.4 | Suspendu, fin passée | « Réactiver » | Refus « La fin de cet événement est passée… » (R3) | Aucun | ☐ OK ☐ anomalie |

## 14. L'annulation (40 min)

Existants : Essais 44, 45, 46 (voir l'avertissement), 58, 60 ; `docs/essai-local.md` sections 8.10, 8.11.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P14.1 | Aïda annule un événement avec ventes | `/admin/events/{id}` | Remboursements lancés ; **partenaire sans message sur le moment**, puis « Remboursements terminés » ou « Remboursements en attente » s’il y a des versements en ligne (R15) | F2 : « Event Village : {title} du {start_at} est annulé. Remboursement automatique en cours. {APP_URL}/tickets » | ☐ OK ☐ anomalie |
| P14.2 | Billet transféré à Lamine | Annuler | Lamine lit le remboursement, l'argent va à Fatou (R13) | Cloche de Lamine : « Événement annulé » | ☐ OK ☐ anomalie |
| P14.3 | Caisse ouverte | Annuler | La caisse reste ouverte | Aucun | ☐ OK ☐ anomalie |

## 15. Billet seul (20 min)

Existants : Essais 58, 59.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P15.1 | Billet gratuit | « Annuler ce billet gratuit » | « Billet annulé », aucun message (R22) | Aucun | ☐ OK ☐ anomalie |
| P15.2 | Transfert en attente | Rembourser le billet | Accepté, transfert encore visible (R61) | Cloche de Fatou : « Remboursement demandé » | ☐ OK ☐ anomalie |

## 16. La fin de l'événement (40 min, plus 48 h pour le retrait)

Existants : Essais 41, 42, 43, 49, 50, 56. Tâche à la main : `node scripts/dev/cron-local.mjs --once ev_events_finish`.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P16.1 | Événement à venir dans 10 min, fin dans 20 min | Attendre la fin, lancer la tâche | « Terminé », personne n'est prévenu | Aucun | ☐ OK ☐ anomalie |
| P16.2 | Billet non scanné | Mes billets après la fin | Historique, encore « Valable », QR actif (R25) | Aucun | ☐ OK ☐ anomalie |
| P16.3 | Disponible d'au moins 6 000 F | Retrait de 6 000 F | 60 F de frais, 5 940 F versés | F2 : « Event Village : votre retrait de {amount} a été versé sur votre compte Wave. » | ☐ OK ☐ anomalie |

## 17. Cas transverses (30 min)

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P17.1 | `client1` avec un billet | Aïda : « Suspendre » | Déconnecté, billet inchangé, aucun message (R59) | Aucun | ☐ OK ☐ anomalie |
| P17.2 | Contrôleur en plein scan | Mariama : retirer | « Contrôle non autorisé » au scan suivant | F2 : « Event Village : votre affectation à l'entrée de {title} est retirée. » | ☐ OK ☐ anomalie |
| P17.3 | Transfert vers Lamine | Lamine change de numéro avant d'accepter | Transfert disparu de « Reçus » (R63) | F2 : SMS à l'ancien numéro | ☐ OK ☐ anomalie |

## 18. Admin et SUPERADMIN (30 min)

Existants : Essais 51, 52, 53, 54 (après P0.2), 56, 57, 58, 60.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P18.1 | Moussa sans `events.write` | Annuler par le navigateur en ouvrant l'écran habituel | Refus à l'écran ; la faille R2 passe par un appel technique, à faire tester par un développeur | Aucun | ☐ OK ☐ anomalie |
| P18.2 | Une notification en échec | Relancer | « Notification remise en attente… » | Aucun autre | ☐ OK ☐ anomalie |
