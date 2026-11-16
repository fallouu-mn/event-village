# Après le lancement

Ce qui ne rentre pas dans une finition, noté au fil des lots pour être repris après la mise en ligne. Chaque ligne dit
d'où elle vient et pourquoi elle attend.

## Équipe de contrôle (finition 1)

| Sujet | Pourquoi plus tard | Origine |
|---|---|---|
| « Zones et portes » quitte l'onglet Équipe pour l'étape « Entrées » de l'événement ; l'onglet n'en garderait qu'un résumé et un lien. | Touche la création d'événement, hors périmètre de la finition 1. En attendant, l'éditeur reste sous la liste de l'équipe. | Revue d'ergonomie, section 3.2 et section 4 (U1) |
| Bandeau « Aucun code PIN régisseur » dans l'équipe, avec le bouton « Générer le code PIN » (onglet Caisse). | Demande de lire l'état du PIN dans la lecture de l'équipe ; le PIN reste visible dans l'onglet Caisse. | Revue d'ergonomie, section 3.2, bandeaux |
| Bandeau « {n} caisse(s) ouverte(s) » à la fin de la soirée. | Même raison ; la caisse ouverte est déjà indiquée sur la ligne de chaque contrôleur, avec un lien vers l'onglet Caisse. | Revue d'ergonomie, section 3.2 |
| Mise à jour en direct de l'équipe : publier `event_controllers`, `controller_invitations` et les avis de la partenaire dans le temps réel. | Changement de la publication temps réel (charge, politiques). La page relit l'équipe toutes les 60 s et après chaque action ; l'indicateur dit « Mis à jour à {heure} », jamais « En direct ». | Revue d'ergonomie, E-76 (P3) |
| Choix de l'organisateur dans la page Équipe pour un admin (liste « Organisateur »). | Administration, hors périmètre. Un admin arrive aujourd'hui par `?partnerId=` ; sans lui, la page dit « Choisissez l’organisateur dont vous gérez l’équipe. ». | Revue d'ergonomie, E-17 |
| Retirer les anciennes routes `PATCH /api/partner/team/gate`, `…/entry-point`, `…/assignments/[id]` et `GET /api/partner/team/all`, `GET /api/partner/team/[eventId]`. | L'écran ne les appelle plus (remplacées par `GET /api/partner/team` et `PATCH /api/partner/team/settings`), mais des tests et d'éventuels outils les utilisent encore. Elles exigent déjà le motif d'un admin et gardent leurs contrôles. | Finition 1 |
| Renommer un contrôleur depuis l'équipe (compte encore à activer seulement). | Aucune route aujourd'hui ; un compte établi garde son nom. | Revue d'ergonomie, section 3.1 |
| Lien des avis à la partenaire vers la ligne précise de l'équipe (ancre). | Confort ; le lien ouvre la page Équipe. | Finition 1, E-20 |

## Fin retenue, carte, affiche (finition 2a)

| Sujet | Pourquoi plus tard | Origine |
|---|---|---|
| Étape « Contrôle à l'entrée (facultatif) » du formulaire de l'événement ; l'onglet « Entrées » du pilotage garde son nom. | Décision : lot 2c. | Consigne de la finition 2a |
| Recadrage de l'affiche choisi par l'organisatrice (déplacer le cadre 16:10 sur l'image). | L'aperçu montre le recadrage au centre, celui des cartes du site ; un outil de recadrage est une fonction nouvelle. | Finition 2a, 1b |
| Purge des images orphelines des autres dossiers (salles, produits, divers). | La finition traite les affiches des événements (dossier events) ; les autres dossiers n'ont pas de référence unique à vérifier. | Finition 2a, 1b |
| Fournisseur de tuiles de carte avec contrat (ou tuiles servies par l'application) au lieu des serveurs d'OpenStreetMap. | Les cartes (formulaire, page publique, fiche admin, onglet Infos) lisent les tuiles d'openstreetmap.org, dont la politique d'usage limite le volume ; adresse réglable par NEXT_PUBLIC_MAP_TILE_URL, à choisir avec le trafic réel. | Finition 2a, 3 |
| Service de recherche de lieu à soi (Nominatim hébergé) ou fournisseur payant si le volume dépasse l'usage permis de l'instance publique. | Une requête par seconde au plus aujourd'hui, réponses gardées 30 jours ; adresse réglable par NOMINATIM_URL. | Finition 2a, 3 |
| Adresse proposée à partir du repère (recherche inverse) pour remplir « Adresse précise ». | Fonction nouvelle, appels supplémentaires au service. | Finition 2a, 3 |
| Position demandée aussi à la publication des événements validés avant la finition 2a (s'il en reste sans repère). | La règle porte sur la soumission ; un événement déjà validé sans repère reste modifiable et publiable. Contrôle de la base au § « À faire de ton côté » du rapport. | Finition 2a, 3 |
| Exemples des champs « Téléphone de contact » et « Stationnement » de l'étape Accès (« 77 123 45 67 », « Parking gratuit sur place ») : écrits comme des valeurs, ils peuvent passer pour déjà remplis. | Même ambiguïté que les coordonnées, corrigée pour celles-ci seulement (« Par exemple : … ») ; ces deux champs viennent du lot 9 ter et sortent du périmètre de la finition. | Relecture des captures de la finition 2a |
| Mention « Leaflet » au pied des cartes (« Leaflet \| © contributeurs OpenStreetMap »). | Choix du lot 8, sur toutes les cartes ; nom de la bibliothèque, donc mot technique. À retirer sur décision (seule la mention OpenStreetMap est exigée). | Relecture des captures de la finition 2a |

## Correctifs de la contre-vérification de la finition 2a

| Sujet | Pourquoi plus tard | Origine |
|---|---|---|
| Écritures des salles, produits, commandes et tables d'une fiche SUSPENDU. | Services fermés par interrupteur (404) : gardées aujourd'hui, à trancher à leur ouverture (une fiche suspendue peut-elle encore vendre ou traiter une commande ?). | Inventaire des écritures, correctif T1 |
| Cadence d'une heure aussi pour les SMS « change de date ». | Non demandée : un aller-retour de date après chaque SMS refait une rafale « change de date ». | Correctif T4 |
| Second changement de lieu dans l'heure qui précède le début. | La cadence l'emporte : l'avis attend la fin de l'heure. À décider : laisser partir tout de suite quand le début est proche. | Correctif T4 |
| Avis de lieu des contrôleurs dans l'application. | Toujours immédiat, comme avant (leurs SMS et emails suivent la fenêtre et l'annulation) : à regrouper comme pour les détenteurs. | Correctif T4 |
| Nom, ville et adresse : pas de « dernière valeur annoncée ». | Seul le repère en a une (consigne). Un aller-retour du nom pendant la retenue envoie un avis du nom actuel, déjà connu des détenteurs. | Correctif T4 |
| Galerie des événements (`gallery_urls`) non réencodée. | Le script réencode les affiches. La galerie n'est ni modifiable ni affichée, mais l'API publique la sert : à vider ou réencoder. | Correctif T5 |
| `event_poster_path_ok` accepte tout hôte devant le chemin du stockage. | La route impose l'adresse du stockage du projet ; la base ne connaît pas cette adresse. | Remarque de la contre-vérification |
| `controller_invitation_create` ne vérifie pas que l'auteur possède la fiche. | Exécutable par le seul compte de service ; la route le vérifie. La fiche suspendue y est désormais refusée en tête (T1). | Remarque de la contre-vérification |
| Purge des affiches bornée à 1 000 dossiers et 1 000 fichiers par dossier. | Au-delà, des orphelines restent : un coût de stockage, pas un risque d'effacement. | Remarque de la contre-vérification |

## Argent de l'administration (finition 3a)

| Sujet | Pourquoi plus tard | Origine |
|---|---|---|
| Page « À faire aujourd'hui » complète (événements à valider avec leur ancienneté, événements suspendus à décider, envois en échec, plafond des SMS, paiements avec un écart), route `GET /api/admin/todo`. | Finition 3b. La 3a ne pose que le bloc « Argent qui attend » (versements à reprendre, remboursements à verser, créances). | Revue d'ergonomie, E-29 |
| Menu et barre du bas selon les droits, page « Mes droits », bandeaux « Lecture seule », refus qui nomme la permission. | Finition 3b. La page Finance dit seulement, sans `payments.read`, que ses chiffres ne sont pas affichés. | Revue d'ergonomie, E-34 |
| Réglages : entrée de menu, sommaire et recherche, confirmation « avant → après », bornes vérifiées avant l'envoi, auteur dans l'historique, valeurs risquées. | Finition 3b. La 3a ajoute seulement les deux réglages de la réserve de prudence, avec leur explication. | Revue d'ergonomie, E-35 |
| Création d'un ADMIN enchaînée sur ses droits, profils prêts, dépendances cochées d'office. | Finition 3b. | Revue d'ergonomie, E-36 |
| Confirmations qui disent qui est prévenu (réactivation, suspension, « Marquer versé »…) et libellés de `/admin/users`, `/admin/referral`, `/admin/audit`. | Finition 3c. | Revue d'ergonomie, E-32, E-37, E-39 |
| Recours d'un admin qui perd son téléphone (changement de numéro par le SUPERADMIN, codes de secours), écran de changement de rôle, espèces d'un événement annulé marquées par un admin, règle des 30 minutes sur les routes partenaire utilisées par un admin. | Finition 3d. | État des lieux du 16/11 |
| « Retirable » : déduire les paiements en échec sans identifiant SamirPay (le client a peut-être été débité) et les frais SamirPay des versements encore à faire. | Non demandés par la consigne ; la réserve de prudence (encaissements des 3 derniers jours par défaut) les couvre largement. À décider avec le client. | Finition 3a |
| Délai de règlement de SamirPay : le solde compte-t-il un encaissement dès sa confirmation ? Ajuster la réserve de prudence (ou la remplacer par une ligne « En cours de règlement ») quand SamirPay aura répondu. | Réponse de SamirPay attendue. | Revue d'ergonomie, point à arbitrer 8 |
| Comparaison « frais SamirPay réels / estimés au taux de retrait » retirée de la page Finance : les frais réels figurent dans le détail de « Gagné », l'alerte sur un taux de retrait trop bas reste dans les réglages. La route `GET /api/admin/finance/reconciliation` n'est plus lue par l'écran (encore lue par des tests) : la retirer ou la réduire. | Nettoyage ; aucune perte de chiffre (les frais réels sont comptés). | Finition 3a |
| `finance_platform_revenue` n'est plus lue par aucun écran ni aucune route (une seule mesure : `finance_admin_earned`) ; seul `tests/security/r3-fonctions-rpc.test.ts` la cite. La supprimer avec ce test. | Nettoyage. | Finition 3a |
| Mise à jour en direct des chiffres de la page Finance (aujourd'hui : au chargement et au changement de période ; solde relu au plus toutes les 5 minutes). | Pas demandé ; la page se recharge. | Finition 3a |
