# Plan de test manuel du module événements

À suivre dans l'ordre sur event-village-dev, chapitres 0 à 18 de `docs/parcours-evenement-complet.md`. Mis à jour en place au lot 9 bis : une ligne dont le résultat change le dit par « depuis le lot 9 bis » ; les écarts corrigés ne sont plus attendus. Ce plan renvoie aux essais de `docs/recette-billetterie.md` sans les recopier, et n'ajoute que ce qui manque. Mode A (simulé) par défaut : les SMS et les codes se lisent dans la fenêtre 2 ; les emails s'écrivent dans cette fenêtre si la clé Resend est absente. Les textes complets des messages, avec leurs modèles, sont cités aux étapes du parcours.

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
| Essai 1 | La bannière « Intégrations simulées » n'est pas à l'écran | Elle s'écrit dans la fenêtre 2 (`instrumentation.ts:15`) ; depuis le lot 9 bis, l'essai le dit lui-même, et en réel la fenêtre 2 affiche « [réel] SMS, paiements et emails RÉELS : de l’argent réel sera débité. » | Regarder la fenêtre 2 |
| Essai 27 | Lamine voit « Un billet vous attend peut-être », pas le billet | Les comptes du seed n'ont pas de numéro vérifié (`scripts/dev/seed-dev.core.ts:202-205`) | Faire d'abord l'essai P0.3 |
| Essai 46 | Avant le lot 9 bis : pas de carte « Espèces à rembourser » | Depuis le lot 9 bis, les ventes au guichet figurent dans la liste « Espèces à rembourser par l'organisateur » (R20) ; l'essai a été réécrit | Le suivre tel quel |
| Essai 54 | Avant le lot 9 bis : « Accès refusé » à l'ouverture de Notifications | Depuis le lot 9 bis, le seed donne au compte `admin` les 8 permissions des essais (`scripts/dev/seed-dev.core.ts:243-257`) | Le suivre tel quel ; P0.2 sert à tester un refus |
| Essai 55 | Avant le lot 9 bis : passait sans tester la suspension prévue | Depuis le lot 9 bis, l'essai passe par la fiche partenaire, avec motif, messages et cascade (R5, R6) | Le suivre tel quel ; P2.3 vérifie la cascade |

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

## 2. Le partenaire (40 min)

Existants : Essais 9, 10, 55 (voir l'avertissement).

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P2.1 | Partenaire de l'Essai 9, connecté avant validation | Ouvrir `/partner/dashboard`, puis `/partner/events` | Depuis le lot 9 bis : bandeau « Compte en cours de vérification » (R7 corrigé) ; `/partner/events` ramène au tableau de bord | Cloche : « Inscription reçue » | ☐ OK ☐ anomalie |
| P2.2 | Un second dossier | Admin : « Refuser » avec motif ; partenaire : se connecter, puis « Compléter mon dossier » | Bandeau « Demande de compte partenaire refusée », motif ; depuis le lot 9 bis, « Compléter mon dossier » une seule fois, le dossier repasse en attente ; une seconde fois : « Votre dossier a déjà été complété une fois. Contactez le support. » | F2 : « Event Village : votre demande de compte partenaire n'est pas acceptée. Motif : {reason} » ; Cloche : « Demande refusée » ; cloche admin : « Dossier complété » | ☐ OK ☐ anomalie |
| P2.3 | Partenaire validé avec un événement publié et un billet vendu | Admin : `/admin/users`, « Voir la fiche partenaire », « Suspendre » avec motif ; puis « Réactiver » | Depuis le lot 9 bis : déconnectée ; l'événement passe « Suspendu » (« Organisateur suspendu »), plus de vente ; à la réactivation, il revient « Publié » (R5, R6 corrigés) | F2 : « Event Village : votre compte partenaire est suspendu. Motif : {reason} Contactez le support. » ; cloche du détenteur : « Événement suspendu » | ☐ OK ☐ anomalie |
| P2.4 | Partenaire validé, jamais connecté | Ouvrir `/partner/dashboard` | « Période d’essai gratuite en cours », 60 jours | Depuis le lot 9 bis, aucun SMS ; cloche : « Période d'essai activée » | ☐ OK ☐ anomalie |

## 3. Création de l'événement (30 min)

Existants : Essais 11, 12, 21, 61 ; `docs/essai-local.md` section 8.1.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P3.1 | Compte `partenaire`, brouillon sans affiche | « Soumettre à la validation » | Depuis le lot 9 bis, fenêtre « Soumission impossible : il manque des informations » qui liste les manques, dont « Ajoutez une affiche à l'événement. » | Aucun | ☐ OK ☐ anomalie |
| P3.2 | Brouillon jamais soumis | « Supprimer le brouillon » | « Brouillon supprimé. » | Aucun | ☐ OK ☐ anomalie |
| P3.3 | Brouillon soumis puis retiré | Chercher « Supprimer le brouillon » | Depuis le lot 9 bis, le bouton n'est pas affiché | Aucun | ☐ OK ☐ anomalie |
| P3.4 | Depuis le lot 9 bis. Brouillon complet | « Soumettre à la validation » | Statut « En attente de validation » | Cloche de la partenaire : « Événement envoyé en validation » ; cloche admin : « Événement à valider » | ☐ OK ☐ anomalie |
| P3.5 | Depuis le lot 9 bis. Catégorie payante | Prix de 50 F | Refusé : sous le prix minimum de 100 F | Aucun | ☐ OK ☐ anomalie |

## 4. Validation (25 min)

Existants : Essais 3, 4, 5, 6, 12, 13, 64, 65 ; `docs/essai-local.md` sections 8.2, 8.14.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P4.1 | Moussa sans « Gérer les événements » (P0.2, décocher) | Ouvrir l'événement en attente | Depuis le lot 9 bis, boutons d'action masqués (R51 corrigé) | Aucun | ☐ OK ☐ anomalie |
| P4.2 | Événement validé | Aïda : « Publier » | « Événement publié. » | Cloche de la partenaire : « Événement publié » ; depuis le lot 9 bis aussi par email si son adresse est vérifiée | ☐ OK ☐ anomalie |
| P4.3 | Événement tout juste publié, sans vente | Accueil, section Populaires | L'événement n'y est pas | Aucun | ☐ OK ☐ anomalie |

## 5. Modification après publication (40 min)

Existant : Essai 14.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P5.1 | Événement publié, 1 billet vendu | Changer le titre | Détenteurs prévenus, pas de SMS | Cloche : « Événement modifié » ; F2 : aucun SMS | ☐ OK ☐ anomalie |
| P5.2 | Événement publié, 1 billet vendu, avant 22 h | Changer le lieu | Écran : « 1 détenteur de billets prévenu… » ; depuis le lot 9 bis, le SMS part 10 minutes après, regroupé | F2 : « Event Village : {title} change de lieu : {new_location}. Vos billets restent valables. {APP_URL}/tickets » ; cloche des contrôleurs : « Contrôle modifié » | ☐ OK ☐ anomalie |
| P5.3 | Événement publié, 1 billet vendu, après 22 h, tâche des messages active | Changer la date | Depuis le lot 9 bis, le SMS part la nuit aussi, 10 minutes après (R14 corrigé) | Cloche : « Événement modifié » ; F2 : « Event Village : {title} change de date : {new_start_at}. Vos billets restent valables. {APP_URL}/tickets » | ☐ OK ☐ anomalie |
| P5.4 | Catégorie sans vente, puis avec vente | Changer le prix | Accepté, puis champ verrouillé | Aucun | ☐ OK ☐ anomalie |
| P5.5 | Événement publié | Ajouter une catégorie | Visible et achetable sans validation ; détenteurs non prévenus | Depuis le lot 9 bis, cloche admin : « Événement modifié après validation » | ☐ OK ☐ anomalie |

## 6. L'équipe (40 min)

Existants : Essais 15, 29 ; `docs/essai-local.md` section 8.8.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P6.1 | Compte `client1` comme Awa | Inviter son numéro ; puis, connecté en `client1`, `/invitations`, accepter | Fenêtre « Compte existant » ; depuis le lot 9 bis, aucune affectation avant l'acceptation d'Awa (R37 corrigé) ; refus possible | F2 : « Event Village : {company} vous invite à scanner les billets de {title}. Répondez sur {APP_URL}/invitations », puis après acceptation « Event Village : affectation à l'entrée de {title}, {start_at}. {APP_URL}/login » | ☐ OK ☐ anomalie |
| P6.2 | Contrôleur activé | Chercher « Renvoyer le SMS » | Depuis le lot 9 bis, bouton absent (R38 corrigé) | Aucun | ☐ OK ☐ anomalie |
| P6.3 | Contrôleur invité sans prénom, activé | Regarder sa ligne | Depuis le lot 9 bis, « Actif » (R39 corrigé) | Aucun | ☐ OK ☐ anomalie |
| P6.4 | Caisse ouverte | Retirer le contrôleur | Refus « Ce contrôleur a une caisse ouverte… » | Aucun | ☐ OK ☐ anomalie |
| P6.5 | Depuis le lot 9 bis. Contrôleur avec droit d'encaisser | Ouvrir une caisse sans PIN | Refus : le PIN régisseur est exigé | Aucun | ☐ OK ☐ anomalie |

## 7. L'achat (60 min)

Existants : Essais 16, 17, 18, 19, 20, 22, 23, 24, 25 et 26 (téléphone, mode B) ; `docs/essai-local.md` sections 8.3, 8.4, 8.5.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P7.1 | Page d'attente ouverte, faux SamirPay en attente | « Annuler le paiement » | « Paiement annulé », places rendues | Aucun | ☐ OK ☐ anomalie |
| P7.2 | Paiement en attente, depuis le lot 9 bis aussi après la fin de la garde des places | Lancer un second achat | « Un paiement est déjà en attente pour cet événement. » | Aucun | ☐ OK ☐ anomalie |
| P7.3 | Panier gratuit + payant | Payer | Une seule confirmation, billets gratuits inclus | F2 : « Event Village : achat confirmé, {ticket_count} billets {title}. Frais de service {service_fee}, total payé {total}. {APP_URL}/tickets » | ☐ OK ☐ anomalie |
| P7.4 | Dernière place | Acheter | « Complet » en direct | Cloche partenaire : « Catégorie complète » | ☐ OK ☐ anomalie |
| P7.5 | Depuis le lot 9 bis. Paiement en attente plus de 10 minutes | Rester sur la page d'attente | Bandeau « Paiement toujours en attente. » ; places plus garanties, paiement encore valable | Aucun | ☐ OK ☐ anomalie |
| P7.6 | Depuis le lot 9 bis. Billet acheté | Ouvrir la carte dans Mes billets | « Prix » et « Frais de service » affichés | Aucun | ☐ OK ☐ anomalie |

## 8. Après l'achat (40 min)

Existants : Essais 27 (après P0.3), 28, 62, 63 ; `docs/essai-local.md` section 8.8 bis.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P8.1 | Transfert en attente | Fatou : « Annuler le transfert » | Billet disponible, QR revenu | F2 : « Event Village : le transfert du billet {title} a été annulé par son propriétaire. » | ☐ OK ☐ anomalie |
| P8.2 | Transfert en attente | Attendre 48 h, ou noter « sans objet » | Après la tâche horaire, QR revenu ; Lamine non prévenu | Cloche de Fatou : « Transfert expiré » | ☐ OK ☐ anomalie |
| P8.3 | Invitation envoyée | Mariama : annuler | « Invitation annulée : la place revient au stock. » ; la fenêtre dit encore « aucun SMS n’est envoyé », texte devenu faux (écart du lot 9 bis) | Depuis le lot 9 bis, F2 : « Event Village : votre invitation pour {title} du {start_at} est annulée par l'organisateur. » (R22 corrigé) | ☐ OK ☐ anomalie |
| P8.4 | Invitation à un compte vérifié | Ouvrir Mes billets de ce compte | Billet présent, sans cloche | F2 : SMS d'invitation seul | ☐ OK ☐ anomalie |
| P8.5 | Depuis le lot 9 bis. Transfert en attente vers Lamine | Lamine : « Refuser le billet » | « Billet refusé : il reste à son expéditeur. » ; billet revenu chez Fatou avec son QR | Cloche de Fatou : « Billet refusé » | ☐ OK ☐ anomalie |
| P8.6 | Depuis le lot 9 bis. Fatou connectée depuis plus de 10 minutes | Lancer un transfert | Fenêtre du mot de passe d'abord ; transfert vers son propre numéro refusé | Aucun avant le transfert | ☐ OK ☐ anomalie |

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
| P10.2 | Événement sans date de fin, heure passée minuit | Quitter l'application, y revenir | Depuis le lot 9 bis, le contrôle reste ouvert jusqu'au début + 6 heures (R16 corrigé) | Aucun | ☐ OK ☐ anomalie |
| P10.3 | Transfert en attente | Saisie manuelle du numéro | Depuis le lot 9 bis, refus « Transfert en cours » (R19 corrigé) | Aucun | ☐ OK ☐ anomalie |
| P10.4 | Avant l'heure d'ouverture | Scanner | « Contrôle pas encore ouvert » | Aucun | ☐ OK ☐ anomalie |

## 11. Le guichet et la caisse (30 min)

Existants : Essais 36, 37, 38 ; `docs/essai-local.md` section 8.9.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P11.1 | Caisse ouverte | Retirer le droit d'encaisser | Depuis le lot 9 bis, l'onglet Caisse du contrôleur reste tant que la caisse est ouverte ; Mariama peut aussi « Fermer cette caisse » dans l'onglet Caisse du pilotage (R17 corrigé) | Aucun | ☐ OK ☐ anomalie |

## 12. Le pilotage (20 min)

Existants : Essais 39, 40, 41.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P12.1 | Pilotage ouvert | Une vente en ligne dans une autre fenêtre | Les chiffres ne bougent pas sans recharger (R49, renvoyé après le lot 9 bis) | Aucun | ☐ OK ☐ anomalie |

## 13. La suspension (30 min)

Aucun essai existant.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P13.1 | « Nuit du Mbalax » publié, 1 billet vendu | Aïda : « Suspendre », motif | Page avec bandeau, hors catalogue | F2 : « Event Village : événement {title} suspendu. Motif : {reason} {APP_URL}/partner/events » ; Cloche du détenteur : « Événement suspendu » ; pas de SMS détenteur ; depuis le lot 9 bis, cloche des contrôleurs : « Événement suspendu » | ☐ OK ☐ anomalie |
| P13.2 | Suspendu | Acheter, scanner, transférer, inviter, retirer l'argent de l'événement, annuler en tant que Mariama | Refus cités à l'étape 13.2 ; billet toujours « Valable », depuis le lot 9 bis QR masqué (R25 corrigé), fonds gelés, annulation réservée à l'admin | Aucun | ☐ OK ☐ anomalie |
| P13.3 | Suspendu | « Réactiver » | Vente reprise | Cloche du détenteur : « Événement de nouveau en ligne » | ☐ OK ☐ anomalie |
| P13.4 | Suspendu, fin passée | Chercher « Réactiver » ; puis « Clore l’événement » avec un motif | Depuis le lot 9 bis, « Réactiver » n'est plus proposé ; « Clore l’événement » passe l'événement « Terminé », sans remboursement (R3 corrigé) ; le champ du motif s'appelle encore « Motif du refus » (écart du lot 9 bis) | F2 : « Event Village : {title} est clos après sa suspension, sans annulation ni remboursement automatique. {APP_URL}/tickets » ; F2 : « Event Village : {title} est clos par l'équipe Event Village après sa suspension. Motif : {reason} » | ☐ OK ☐ anomalie |

## 14. L'annulation (40 min)

Existants : Essais 44, 45, 46 (voir l'avertissement), 58, 60 ; `docs/essai-local.md` sections 8.10, 8.11.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P14.1 | Aïda annule un événement avec ventes | `/admin/events/{id}` | Remboursements lancés ; depuis le lot 9 bis, partenaire prévenue sur le moment (R15 corrigé), contrôleurs aussi | F2 : « Event Village : {title} du {start_at} est annulé. Remboursement automatique en cours. {APP_URL}/tickets » ; F2 : « Event Village : {title} annulé par l'administration. Motif : {public_notice} {APP_URL}/partner/events » | ☐ OK ☐ anomalie |
| P14.2 | Billet transféré à Lamine | Annuler | Lamine lit que le remboursement va à l'acheteur d'origine, l'argent va à Fatou ; depuis le lot 9 bis, Fatou est prévenue même sans billet (R13 corrigé) | Cloche de Lamine : « Événement annulé » ; F2 : SMS à Lamine et à Fatou | ☐ OK ☐ anomalie |
| P14.3 | Caisse ouverte | Annuler | La caisse reste ouverte ; depuis le lot 9 bis, avertissement d'annulation en cours d'événement si l'événement a commencé (R48) | Aucun | ☐ OK ☐ anomalie |
| P14.4 | Depuis le lot 9 bis. Ventes au guichet | Annuler, puis onglet Clôture | Liste « Espèces à rembourser par l'organisateur », case « Remboursé » définitive (R20) | Aucun | ☐ OK ☐ anomalie |

## 15. Billet seul (20 min)

Existants : Essais 58, 59.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P15.1 | Billet gratuit | « Annuler ce billet gratuit » | « Billet annulé » ; depuis le lot 9 bis, le détenteur est prévenu (R22 corrigé) | F2 : « Event Village : votre billet gratuit pour {title} du {start_at} est annulé par l'organisateur. » | ☐ OK ☐ anomalie |
| P15.2 | Transfert en attente | Rembourser le billet | Accepté ; depuis le lot 9 bis, le transfert est annulé dans la même opération et quitte « Reçus » (R61 corrigé) | Cloche de Fatou : « Remboursement demandé » ; F2 : « Event Village : le billet {title} qui vous était transféré a été remboursé à son acheteur. Le transfert est annulé. » | ☐ OK ☐ anomalie |
| P15.3 | Depuis le lot 9 bis. Événement terminé | Mariama : rembourser un billet | Bandeau « Remboursement réservé à Event Village » ; l'admin avec « Gérer les remboursements » le peut | Aucun | ☐ OK ☐ anomalie |

## 16. La fin de l'événement (40 min, plus 48 h pour le retrait)

Existants : Essais 41, 42, 43, 49, 50, 56. Tâche à la main : `node scripts/dev/cron-local.mjs --once ev_events_finish`.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P16.1 | Événement à venir dans 10 min, fin dans 20 min | Attendre la fin, lancer la tâche | « Terminé » ; depuis le lot 9 bis, la partenaire est prévenue | Cloche de la partenaire : « Événement terminé », ou « Caisse encore ouverte » avec un SMS si une caisse l'est | ☐ OK ☐ anomalie |
| P16.2 | Billet non scanné | Mes billets après la fin | Historique, encore « Valable » ; depuis le lot 9 bis, « Événement terminé. » à la place du QR une fois le contrôle fermé (R25 corrigé) | Aucun | ☐ OK ☐ anomalie |
| P16.3 | Disponible d'au moins 6 000 F | Retrait de 6 000 F | Depuis le lot 9 bis, le devis s'affiche avant le code : « Vous recevrez 5 940 F CFA » ; 60 F de frais, 5 940 F versés | F2 : « Event Village : votre code de retrait est {code}. Valable 10 minutes. Ne le donnez à personne. », puis « Event Village : votre retrait de {amount} a été versé sur votre compte Wave. » | ☐ OK ☐ anomalie |

## 17. Cas transverses (30 min)

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P17.1 | `client1` avec un billet | Aïda : « Suspendre », motif ; puis « Réactiver » | Déconnecté, billet inchangé ; depuis le lot 9 bis, motif obligatoire et client prévenu (R59 corrigé) ; billet payé valable à l'entrée | F2 : « Event Village : votre compte est suspendu. Motif : {reason}. Vos billets payés restent valables à l'entrée. Contactez le support. », puis « Event Village : votre compte est réactivé. Vous pouvez de nouveau vous connecter : {APP_URL}/login » | ☐ OK ☐ anomalie |
| P17.2 | Contrôleur en plein scan | Mariama : retirer | Depuis le lot 9 bis, « Vous ne contrôlez plus cet événement » au scan suivant | F2 : « Event Village : votre affectation à l'entrée de {title} est retirée. » | ☐ OK ☐ anomalie |
| P17.3 | Transfert vers Lamine | Lamine change de numéro avant d'accepter | Depuis le lot 9 bis, transfert annulé, billet revenu chez Fatou (R63 corrigé) | F2 : SMS à l'ancien numéro ; cloche de Fatou : « Transfert annulé » | ☐ OK ☐ anomalie |

## 18. Admin et SUPERADMIN (30 min)

Existants : Essais 51, 52, 53, 54 (après P0.2), 56, 57, 58, 60.

| N° | Préparation | Actions | Résultat attendu | Messages attendus | OK / anomalie |
|---|---|---|---|---|---|
| P18.1 | Moussa sans « Gérer les événements » | Ouvrir l'événement, chercher « Annuler l’événement » ; ouvrir le pilotage par l'adresse | Depuis le lot 9 bis, bouton masqué ; refus « Action non autorisée : votre compte n’a pas la permission « Gérer les événements ». » aussi par les adresses de la partenaire (R2 corrigé) | Aucun | ☐ OK ☐ anomalie |
| P18.2 | Une notification en échec | Relancer | « Notification remise en attente… » | Aucun autre | ☐ OK ☐ anomalie |
| P18.3 | Depuis le lot 9 bis. Connecté en `admin` (ADMIN) | `/admin/finance-settings` ; `/admin/users`, créer un compte ADMIN | « Modifier » absent, « Lecture seule : seul un superadministrateur peut modifier ces réglages. … » ; création refusée (R51, R71) | Aucun | ☐ OK ☐ anomalie |
| P18.4 | Depuis le lot 9 bis. Un versement bloqué ou refusé | `/admin/finance`, « Versements à reprendre », « Renvoyer » avec une justification | Ligne renvoyée, décision au journal | Aucun | ☐ OK ☐ anomalie |
