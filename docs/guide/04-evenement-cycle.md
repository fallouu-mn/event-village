# 04 — Cycle de vie d'un événement : création, billetterie, validation, publication, modification, fin

> Guide complet de l'application Event Village, état de `main` à `0889df6` (lots 1 à 9 ter). Source de vérité : le code.
> Chaque fait porte sa preuve `fichier:ligne` (chemins relatifs au dépôt ; `M/` = `supabase/migrations/`).
> Ce qui n'a pas pu être établi est marqué **NON VÉRIFIÉ**. Données d'exemple fictives : partenaire « Fatou Diop »
> (structure « Fatou Diop Events »), événement « Concert Test » au « Grand Théâtre National », Dakar, le samedi
> 5 décembre 2026 à 20:00 ; adresse de l'application `https://app.exemple.sn`.
> Les messages (canaux, plafonds, préférences) sont détaillés dans `10-notifications.md` par leur type ; les tâches
> planifiées dans `12-taches-planifiees.md` ; l'argent des annulations et des remboursements dans `08-argent.md` ;
> l'équipe, les zones et le contrôle des entrées dans `05-equipe-controle-acces.md`. Les écarts relevés en écrivant ce
> fichier sont repris dans `15-constats.md` (identifiants W4-xx).
> Conventions des textes de messages : dans la cloche, le push et l'email, le titre est entre guillemets « » entourés
> d'espaces insécables (`lib/notifications/catalog.ts:142-143`) ; dans un SMS, chaque valeur saisie est coupée à la
> longueur indiquée entre accolades (ex. `{titre, 30}`) et finit alors par « ... », les caractères hors alphabet SMS
> sont remplacés (`lib/notifications/sms-format.ts:1-13`) ; le lien est l'adresse de l'application suivie du chemin
> (`lib/notifications/catalog.ts:171-172`). Les longueurs de SMS données en exemple ont été mesurées avec la fonction
> du code (`smsSegments`) sur les données fictives ci-dessus.

## Sommaire

| N° | Scénario |
|---|---|
| 04.0 | Les 7 statuts, les 17 transitions et qui les fait ; la fin d'un événement |
| 04.1 | Créer un événement : accès, en-tête, étapes, avertissement avant de quitter |
| 04.2 | Étape 1 « Informations générales », champ par champ (ville en liste, affiche, dates, jauge) |
| 04.3 | Étape 2 « Programme » |
| 04.4 | Étape 3 « Accès et informations pratiques » |
| 04.5 | Étape 4 « Billetterie » à la création ; « Enregistrer le brouillon » |
| 04.6 | Supprimer un brouillon jamais soumis |
| 04.7 | Soumettre à la validation (et la liste des manques) |
| 04.8 | Retirer de la validation (partenaire) |
| 04.9 | Refuser avec un motif (administration) |
| 04.10 | Valider (administration) |
| 04.11 | Publier : par la partenaire, par l'administration |
| 04.12 | Modifier un événement : ce qui est permis selon le statut, verrous, conflit |
| 04.13 | Modification après publication : messages aux détenteurs, regroupement sur 10 minutes |
| 04.14 | Report de plus de 24 h : droit au remboursement total |
| 04.15 | Billetterie d'un événement déjà créé : ajouter, modifier, retirer de la vente, supprimer, couleur et consigne |
| 04.16 | Suspendre (administration) |
| 04.17 | Réactiver (administration) |
| 04.18 | Clore un événement suspendu (administration) |
| 04.19 | Annuler : par la partenaire, par l'administration |
| 04.20 | Terminer à la main (administration) |
| 04.21 | Fin automatique : passage à Terminé (Publié, et Validé jamais publié) |
| 04.22 | Suspension et réactivation d'une partenaire : effet sur ses événements |
| 04.23 | Rapport de clôture et export des participants |

---

## 04.0 Les statuts, les transitions et la fin d'un événement

### Les 7 statuts

| Statut (code) | Libellé affiché | Explication affichée | Preuve |
|---|---|---|---|
| `BROUILLON` | « Brouillon » | « En cours de rédaction par l’organisateur, visible de lui seul. » | `lib/events/event-status.ts:76-80` |
| `EN_ATTENTE` | « En attente de validation » | « Soumis à l’équipe Event Village, qui vérifie la fiche avant validation. » | `lib/events/event-status.ts:81-85` |
| `VALIDE` | « Validé » | « Accepté par l’équipe Event Village : l’organisateur peut maintenant le publier. » | `lib/events/event-status.ts:86-90` |
| `PUBLIE` | « Publié » | « En ligne : la page publique est visible et la billetterie est ouverte. » | `lib/events/event-status.ts:91-95` |
| `SUSPENDU` | « Suspendu » | « Mis en pause par l’équipe Event Village : la vente et le contrôle d’accès sont arrêtés. » | `lib/events/event-status.ts:96-100` |
| `TERMINE` | « Terminé » | « L’événement est passé : la vente est close, le bilan reste consultable. » | `lib/events/event-status.ts:101-105` |
| `ANNULE` | « Annulé » | « Annulé : les participants sont prévenus et les billets payés sont remboursés. » | `lib/events/event-status.ts:106-110` |

Le public ne voit que `PUBLIE`, `SUSPENDU`, `ANNULE` et `TERMINE`, et jamais un événement terminé sans avoir été publié
(`lib/events/public-status.ts:8-11`, `:27-29` ; politique `M/20261110000007_lot9ter_evenements.sql:220-226`). Le statut ne
change que par les fonctions de la base : une écriture directe est refusée (`lib/events/event-lifecycle.service.ts:4-9`,
`M/20261102000003_lot5_cycle.sql:219-229`). Chaque changement écrit une ligne d'historique (ancien statut, nouveau
statut, acteur, rôle, motif, canal) (`M/20261102000003_lot5_cycle.sql:223-226`).

### Les 17 transitions permises (table `event_status_transitions`)

La table de départ compte 16 lignes (`M/20261102000003_lot5_cycle.sql:48-65`) ; le lot 9 bis ajoute la clôture d'un
suspendu et retire l'annulation d'un suspendu par la partenaire (`M/20261109000008_lot9bis_cycle.sql:203-209`) ; le
lot 9 ter ajoute la fin automatique d'un Validé (`M/20261110000007_lot9ter_evenements.sql:232-234`).

| De | Vers | Qui | Motif obligatoire | Libellé du bouton | Scénario |
|---|---|---|---|---|---|
| Brouillon | En attente | Partenaire | non | « Soumettre à la validation » | 04.7 |
| En attente | Brouillon | Partenaire | non | « Retirer de la validation » | 04.8 |
| En attente | Brouillon | Administration | **oui** (3 caractères) | « Refuser » | 04.9 |
| En attente | Validé | Administration | non | « Valider » | 04.10 |
| Validé | Publié | Partenaire | non | « Publier » | 04.11 |
| Validé | Publié | Administration | non | « Publier » | 04.11 |
| Publié | Suspendu | Administration | **oui** | « Suspendre » | 04.16 |
| Suspendu | Publié | Administration | non | « Réactiver » | 04.17 |
| Suspendu | Terminé | Administration | **oui** | « Clore l’événement » | 04.18 |
| Publié | Annulé | Partenaire | avis et motif (voir 04.19) | « Annuler l’événement » | 04.19 |
| Publié | Annulé | Administration | avis et motif | « Annuler l’événement » | 04.19 |
| Validé | Annulé | Partenaire | avis et motif | « Annuler l’événement » | 04.19 |
| Validé | Annulé | Administration | avis et motif | « Annuler l’événement » | 04.19 |
| Suspendu | Annulé | Administration seule | avis et motif | « Annuler l’événement » | 04.19 |
| Publié | Terminé | Système (tâche planifiée) | non | « Terminer automatiquement » | 04.21 |
| Validé | Terminé | Système (tâche planifiée) | non | « Terminer automatiquement » | 04.21 |
| Publié | Terminé | Administration | non | « Terminer » | 04.20 |

Ce qui n'existe pas : aucun retour d'un Validé vers Brouillon ou En attente, aucune suspension d'un Validé, aucun
passage hors de Terminé ou d'Annulé ; un Suspendu n'est jamais terminé par la tâche planifiée (elle ne prend que
Publié et Validé, `M/20261110000007_lot9ter_evenements.sql:95-100`) : il reste Suspendu jusqu'à une décision de
l'administration (04.17, 04.18 ou 04.19).

« Administration » veut dire : compte ADMIN muni de la permission `events.write`, ou SUPERADMIN, compte actif
(`app/api/admin/events/[id]/transition/route.ts:25`, `M/20261109000004_lot9bis_droits.sql:114-126`). Un admin qui n'a
que `events.read` voit la fiche mais aucun bouton d'action (`app/admin/events/[id]/page.tsx:323-326`, `:537`, `:547`)
(voir `11-admin-superadmin.md`). L'annulation ne passe jamais par le changement de statut simple : demander « Annulé »
par ce chemin répond « L'annulation passe par la procédure d'annulation, qui rembourse les acheteurs. »
(`M/20261109000008_lot9bis_cycle.sql:266-269`).

Les boutons affichés viennent tous de la base (fonction `event_actions`) : l'écran n'en code aucun
(`app/api/partner/events/route.ts:34-50`, `components/partner/events-list/PartnerEventCard.tsx:118-131`). La base
retire d'avance « Publier » et « Réactiver » quand la fin est passée, et « Clore l’événement » tant que la fin n'est
pas passée (`M/20261109000008_lot9bis_cycle.sql:406-416`). Elle n'enlève pas « Terminer » sur un Publié pas encore
commencé : le bouton est proposé puis refusé (voir 04.20 et constat W4-06).

### Refus communs à toutes les transitions

| Cas | Message exact | Preuve |
|---|---|---|
| Compte ni propriétaire ni administration | « Vous n'êtes pas autorisé à changer le statut de cet événement. » | `M/20261109000008_lot9bis_cycle.sql:259-262` |
| Compte non actif | « Votre compte n'est pas actif. » | `M/20261109000008_lot9bis_cycle.sql:263-265` |
| Bon statut mais mauvais rôle | « Votre rôle ne permet pas de passer cet événement de « {statut actuel} » à « {statut visé} ». » — ex. « Votre rôle ne permet pas de passer cet événement de « En attente de validation » à « Validé ». » | `M/20261109000008_lot9bis_cycle.sql:285-289` |
| Transition hors table | « Un événement « {statut actuel} » ne peut pas passer à « {statut visé} ». » — ex. « Un événement « Brouillon » ne peut pas passer à « Publié ». » | `M/20261109000008_lot9bis_cycle.sql:290-291` |
| Motif trop court | « Un motif d'au moins 3 caractères est obligatoire. » | `M/20261109000008_lot9bis_cycle.sql:294-296` |
| Statut inconnu | « Statut demandé inconnu. » | `app/api/partner/events/[id]/transition/route.ts:40-42` |
| Requête mal formée | « Données invalides : indiquez le statut visé (to) et, si besoin, un motif. » | `app/api/partner/events/[id]/transition/route.ts:36-39` |
| Panne | « Changement de statut impossible pour le moment. » | `app/api/partner/events/[id]/transition/route.ts:54-55` |

### La fin d'un événement (règle unique)

La fin d'un événement est calculée partout de la même façon (`M/20261109000008_lot9bis_cycle.sql:457-467` et `:476-486`,
miroir `lib/events/event-end.ts:1-24`) :

- date **et** heure de fin saisies : cette date à cette heure ;
- date de fin sans heure : cette date à 23:59 ;
- **aucune date de fin : début + 6 heures** (exemple : début samedi 5 décembre à 20:00, fin dimanche 6 décembre à 02:00).

Heure de Dakar (UTC+0 toute l'année) (`lib/validations/event.ts:11-12`). Cette fin borne : la publication
(04.11), la fin des ventes (`M/20261106000001_lot8_canaux.sql:235-241`), la fin de vente des catégories (04.5), la
clôture d'un suspendu (04.18), le passage automatique à Terminé (04.21), la fenêtre du contrôle à l'entrée (fin + 6 h
par défaut, réglage `access.scan_window_after_hours`, `M/20261102000003_lot5_cycle.sql:865-866`,
`M/20261101000009_lot4_reglages_acces.sql:14-15`) et la disponibilité des fonds (voir 08). Aucun écran de saisie ne
dit cette règle des 6 heures, et la fiche de l'administration affiche encore « Non précisée (fin de journée) » (constat
W4-01).

---

## 04.1 Créer un événement : accès, en-tête, étapes, avertissement avant de quitter

1. **Qui, où.** Partenaire validée. « Mes événements » (`/partner/events`), bouton « Créer un événement »
   (`app/partner/events/page.tsx:207-209`), ou bouton de l'état vide « Créer un événement »
   (`app/partner/events/page.tsx:282-283`). Page `/partner/events/new` (`app/partner/events/new/page.tsx:6-8`).
   En-tête : lien « Retour à mes événements », titre « Créer un événement », texte « L’événement est enregistré en
   brouillon. Vous le soumettrez à la validation depuis la liste de vos événements. »
   (`components/events/EventForm.tsx:744-752`). Les accès par rôle (partenaire en attente, refusée, suspendue) sont
   décrits dans `01-roles-menus-ecrans.md`.
2. **Ce qu'il saisit.** Quatre étapes, numérotées 1 à 4, libellés courts « Informations », « Programme », « Accès »,
   « Billets » ; titres « Informations générales », « Programme », « Accès et informations pratiques »,
   « Billetterie » (`components/events/EventForm.tsx:80-85`). Au-dessus : « Étape {n} sur 4 : {titre} » — ex. « Étape 1
   sur 4 : Informations générales » (`components/events/EventForm.tsx:857-859`). On peut toucher une étape à tout
   moment (`:866-869`). En bas : « Précédent », « Suivant », et à la dernière étape « Enregistrer le brouillon »
   (`:1191-1206`). À la création, « Suivant » contrôle d'abord les champs de l'étape affichée et reste sur place s'il y a
   une erreur (`:653-666`) ; toucher directement le numéro d'une étape ne contrôle rien (`:866-869`).
3. **Ce que fait le système.** Rien n'est enregistré avant « Enregistrer le brouillon » (04.5). Les erreurs
   s'affichent dans un encadré en haut du formulaire : titre « Le formulaire contient un point à corriger » ou « Le
   formulaire contient {n} points à corriger » (« Enregistrement impossible » s'il n'y a qu'un message général), puis
   une ligne par erreur « {nom du champ} : {message} », qui mène au champ quand on la touche
   (`components/events/EventForm.tsx:888-912`). Exemple : « Titre : Le titre compte au moins 3 caractères. ». Les noms
   de champs utilisés dans cet encadré : `components/events/EventForm.tsx:326-357`.
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien tant que le brouillon n'est pas enregistré.
6. **Avertissement avant de quitter.** Avec une saisie non enregistrée, toucher un lien interne ouvre la fenêtre
   « Quitter sans enregistrer ? » : « {liste} : vos modifications ne sont pas enregistrées et seront perdues. »,
   boutons « Quitter sans enregistrer » et « Rester sur la page » (`components/events/EventForm.tsx:1215-1226`). La liste
   contient « Informations de l’événement » et, pour chaque catégorie ajoutée, « Nouvelle catégorie « {nom} » » ou
   « Nouvelle catégorie » (`:561-565`). Exemple : « Informations de l’événement, Nouvelle catégorie « VIP » : vos
   modifications ne sont pas enregistrées et seront perdues. ». Fermer ou recharger l'onglet déclenche l'avertissement
   du navigateur ; le bouton « Précédent » du navigateur n'est pas arrêté (`hooks/useUnsavedGuard.ts:6-15`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 11 (`docs/recette-billetterie.md:498-516`), essai 89
   (`docs/recette-billetterie.md:1901-1917`).

## 04.2 Étape 1 « Informations générales »

1. **Qui, où.** Partenaire, `/partner/events/new` (ou `/partner/events/{id}/edit`), étape 1.
2. **Ce qu'il saisit.**

   | Champ (libellé exact) | Obligatoire | Limites, aide, exemple affiché | Messages d'erreur exacts | Preuve |
   |---|---|---|---|---|
   | « Titre de l’événement » | oui | 3 à 120 caractères ; exemple « Par exemple : Nuit du Mbalax » | « Le titre compte au moins 3 caractères. » ; « Le titre compte au plus 120 caractères. » | `components/events/EventForm.tsx:922-932`, `lib/validations/event.ts:183-185` |
   | « Catégorie de l’événement » (boutons) | oui | 4 choix : « Concerts & Musique », « Festivals », « Gastronomie & Tables », « Salles & Réceptions » | « Choisissez une catégorie d’événement dans la liste. » | `components/events/EventForm.tsx:1257-1307`, `lib/constants/event-categories.ts:1-6`, `lib/validations/event.ts:197-199` |
   | « Description » | non | 5 000 caractères, compteur ; exemple « Présentez l’événement : artistes, ambiance, public attendu… » | « La description compte au plus 5 000 caractères. » | `components/events/EventForm.tsx:941-951`, `lib/validations/event.ts:186-187` |
   | « Affiche de l’événement » | non pour enregistrer, **oui pour soumettre** | aide « JPEG, PNG ou WebP, 5 Mo au plus. Obligatoire pour soumettre l’événement à la validation. » ; zone « Choisir une image ou la déposer ici », puis « Image enregistrée », « Remplacer l’image » | « Format non pris en charge : choisissez une image JPEG, PNG ou WebP. » ; « Image trop lourde : 5 Mo au plus. » ; « Connexion impossible : l’image n’a pas été envoyée. Vérifiez votre réseau, puis réessayez. » ; image venue d'ailleurs : « L’affiche doit être déposée depuis le formulaire de l’événement (stockage Event Village). » | `components/events/EventForm.tsx:953-961`, `components/ui/ImageUpload.tsx:60-91`, `:145-181`, `lib/validations/event.ts:207-220`, `app/api/partner/upload/route.ts:9`, `:41-42`, `:58` |
   | Bloc « Dates et horaires (heure de Dakar) » : « Date de début » | oui | — | « Ce champ est obligatoire. » ; « Date invalide (format AAAA-MM-JJ). » ; « Le début de l’événement doit être dans le futur (heure de Dakar). » | `components/events/EventForm.tsx:963-967`, `lib/validations/event.ts:180`, `:402-404`, `:588` |
   | « Heure de début » | oui | — | « Ce champ est obligatoire. » ; « Heure invalide (format HH:mm). » | `components/events/EventForm.tsx:968-969`, `lib/validations/event.ts:181` |
   | « Date de fin » | non | aide « Facultative. Pour une soirée qui passe minuit, indiquez la date du lendemain. » | « Indiquez la date de fin pour l’heure de fin saisie. » ; « La fin de l’événement doit être postérieure à son début. » | `components/events/EventForm.tsx:970-972`, `lib/validations/event.ts:397-415` |
   | « Heure de fin » | non | aide « Facultative ; avec une heure de fin, la date de fin est demandée. » | idem | `components/events/EventForm.tsx:973-975` |
   | « Lieu » | oui | 2 à 200 caractères ; exemple « Par exemple : Grand Théâtre National » | « Le lieu compte au moins 2 caractères. » ; « Le lieu compte au plus 200 caractères. » | `components/events/EventForm.tsx:980-982`, `lib/validations/event.ts:188-190` |
   | « Ville » (liste) | oui | 26 villes dans cet ordre : Cap Skirring, Dakar, Diamniadio, Diourbel, Fatick, Guédiawaye, Joal-Fadiouth, Kaffrine, Kaolack, Kédougou, Kolda, Louga, Matam, Mbacké, Mbour, Pikine, Richard-Toll, Rufisque, Saint-Louis, Saly, Sédhiou, Tambacounda, Thiès, Tivaouane, Touba, Ziguinchor ; puis « Autre ville ». « Dakar » est choisie d'avance à la création | — | `components/events/EventForm.tsx:98-101`, `:221`, `:983-990`, `lib/events/senegal-cities.ts:12-42` |
   | « Précisez la ville » (si « Autre ville ») | oui | 2 à 80 caractères ; aide « Ville absente de la liste. » | « La ville compte au moins 2 caractères. » ; « La ville compte au plus 80 caractères. » | `components/events/EventForm.tsx:991-995`, `lib/validations/event.ts:193-196` |
   | « Capacité totale (jauge) » | non | 1 à 100 000 ; aide « Facultative. La somme des quantités des catégories actives ne peut pas la dépasser. » (en modification, voir 04.12) | « La jauge est un nombre entier. » ; « La jauge compte au moins 1 place. » ; « La jauge compte au plus 100 000 places. » ; « La somme des quantités mises en vente des catégories actives ({somme}) dépasse la jauge ({jauge}). » — ex. « La somme des quantités mises en vente des catégories actives (600) dépasse la jauge (500). » | `components/events/EventForm.tsx:998-1016`, `lib/validations/event.ts:204-205`, `:454-456` |

   Une ville tapée dans « Précisez la ville » qui figure en fait dans la liste (« THIES ») est enregistrée sous la forme de
   la liste (« Thiès ») ; une autre ville est gardée telle quelle (`lib/events/senegal-cities.ts:46-55`,
   `lib/validations/event.ts:191-196`). Un événement dont la ville n'est pas dans la liste s'ouvre en modification avec
   « Autre ville » choisi (`components/events/EventForm.tsx:526`).
3. **Ce que fait le système.** Contrôle immédiat dans le navigateur (mêmes règles que le serveur,
   `lib/validations/event.ts:1-15`). L'affiche est déposée dès qu'elle est choisie, dans le dossier de la partenaire
   (`components/ui/ImageUpload.tsx:76`, `lib/validations/event.ts:158-170`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien (rien n'est enregistré).
6. **Refus.** Voir la colonne des messages ; dépôt d'affiche refusé par le serveur : « Le fichier dépasse la taille
   maximale autorisée (5 Mo). », « Format non pris en charge : formats acceptés JPEG, PNG et WebP. », « Un profil
   d’organisateur est nécessaire pour déposer une image. » (`app/api/partner/upload/route.ts:41-58`).
7. **Preuves et essai.** Fichiers cités. Recette : essais 11 et 91 (`docs/recette-billetterie.md:498-516`, `:1938-1955`).

## 04.3 Étape 2 « Programme »

1. **Qui, où.** Partenaire, étape 2 du formulaire.
2. **Ce qu'il saisit.** Texte d'aide « Facultatif. Les lignes vides sont ignorées et le programme est trié par heure à
   l’enregistrement. » ; sans ligne : « Aucune ligne de programme pour le moment. » ; bouton « Ajouter une ligne »
   (`components/events/EventForm.tsx:1022-1030`, `:1072-1087`). Chaque ligne « Ligne {n} », supprimable par l'icône
   « Supprimer la ligne {n} du programme » (`:1038-1045`) :

   | Champ | Obligatoire | Limites | Messages | Preuve |
   |---|---|---|---|---|
   | « Heure » | oui | HH:mm | « Ce champ est obligatoire. » ; « Heure invalide (format HH:mm). » | `components/events/EventForm.tsx:1048-1049`, `lib/validations/event.ts:181` |
   | « Type » | oui | « Artiste », « Intervenant », « Activité » ; « Artiste » par défaut | « Choisissez le type de la ligne : artiste, intervenant ou activité. » | `components/events/EventForm.tsx:1050-1053`, `lib/validations/event.ts:28-34`, `:261` |
   | « Intitulé » (exemple « Par exemple : Ouverture des portes ») | oui | 120 caractères | « Indiquez le titre de la ligne. » ; « Le titre d’une ligne compte au plus 120 caractères. » | `components/events/EventForm.tsx:1054-1056`, `lib/validations/event.ts:262-263` |
   | « Artiste ou intervenant » | non | 120 caractères | « L’artiste ou l’intervenant compte au plus 120 caractères. » | `components/events/EventForm.tsx:1057-1059`, `lib/validations/event.ts:264` |
   | « Jour » (seulement si la date de fin diffère du début) | non | aide « Pour un événement sur plusieurs jours. » | « Date invalide (format AAAA-MM-JJ). » | `components/events/EventForm.tsx:1060-1064`, `lib/validations/event.ts:266` |
   | « Précisions » | non | 500 caractères | « La description d’une ligne compte au plus 500 caractères. » | `components/events/EventForm.tsx:1065-1067`, `lib/validations/event.ts:265` |

   50 lignes au plus : le bouton « Ajouter une ligne » disparaît à 50 ; message du serveur « Le programme compte au plus
   50 lignes. » (`components/events/EventForm.tsx:1072`, `lib/validations/event.ts:47`, `:292-295`).
3. **Ce que fait le système.** Une ligne sans heure, intitulé, intervenant ni précisions est ignorée ; les lignes
   sont triées par jour puis heure, une ligne sans jour étant rangée au jour du début (`lib/validations/event.ts:285-309`).
   Dans l'encadré d'erreurs, le champ est nommé « Programme, ligne {n} : {champ} » (`components/events/EventForm.tsx:398-403`).
4. **Messages envoyés.** Aucun. Une modification du programme après publication ne prévient personne (04.13).
5. **Ce que voient les autres rôles.** L'administration voit le programme sur la fiche (`app/admin/events/[id]/page.tsx:626-649`).
6. **Refus.** Voir le tableau.
7. **Preuves et essai.** Fichiers cités. Recette : essai 11.

## 04.4 Étape 3 « Accès et informations pratiques »

1. **Qui, où.** Partenaire, étape 3.
2. **Ce qu'il saisit.**
   - « Position sur la carte » : texte « Touchez la carte ou déplacez le repère pour indiquer l’entrée du lieu. Vous
     pouvez aussi saisir les coordonnées. », bouton « Ma position », champs « Latitude » (exemple `14.6937`) et
     « Longitude » (exemple `-17.4441`), puis « Position enregistrée » (`components/events/EventForm.tsx:1093-1102`,
     `components/ui/MapPicker.tsx:165-216`). Facultative. Erreurs : « Coordonnées invalides : latitude entre -90 et 90,
     longitude entre -180 et 180. », « La localisation n’est pas disponible sur cet appareil : placez le repère sur la
     carte. », « Localisation refusée : autorisez-la dans le navigateur ou placez le repère sur la carte. », « Position
     introuvable pour le moment : placez le repère sur la carte. » (`components/ui/MapPicker.tsx:131`, `:141`, `:156-157`).
   - Informations pratiques, toutes facultatives, 300 caractères chacune, message « Chaque information pratique compte au
     plus 300 caractères. » (`lib/validations/event.ts:222-223`) :

     | Champ | Exemple affiché | Aide | Preuve |
     |---|---|---|---|
     | « Adresse précise » | « Rue, quartier, point de repère » | (après publication) « Les détenteurs de billets seront prévenus de ce changement. » | `components/events/EventForm.tsx:1104-1107`, `:96` |
     | « Téléphone de contact » | « 77 123 45 67 » | « Mobile ou fixe sénégalais, par exemple 77 123 45 67 ou 33 821 00 00. » ; erreur « Numéro sénégalais invalide. Exemple : 77 123 45 67 ou 33 821 00 00. » | `components/events/EventForm.tsx:1108-1111`, `lib/validations/auth.ts:42`, `:52-58` |
     | « Stationnement » | « Parking gratuit sur place » | — | `components/events/EventForm.tsx:1112-1114` |
     | « Indications d’accès » | « Entrée principale, accès pour les personnes à mobilité réduite… » | compteur | `components/events/EventForm.tsx:1115-1118` |
     | « Règles à respecter » | « Âge minimum, objets interdits, tenue… » | compteur | `components/events/EventForm.tsx:1119-1122` |

3. **Ce que fait le système.** Le téléphone est enregistré sous la forme `+221…` (mobiles 70, 75, 76, 77, 78 et fixes
   30, 33) ; un ancien numéro saisi librement et renvoyé tel quel est gardé (`lib/validations/event.ts:224-242`,
   `lib/validations/auth.ts:44-58`).
4. **Messages envoyés.** Aucun ici ; un changement d'adresse après validation prévient les détenteurs (04.13).
5. **Ce que voient les autres rôles.** Sur la fiche admin : « Adresse », « Accès », « Stationnement », « Téléphone sur
   place », « Règlement » (`app/admin/events/[id]/page.tsx:166-172`).
6. **Refus.** Voir ci-dessus.
7. **Preuves et essai.** Recette : essai 91 (`docs/recette-billetterie.md:1938-1955`).

## 04.5 Étape 4 « Billetterie » à la création ; « Enregistrer le brouillon »

1. **Qui, où.** Partenaire, étape 4 de `/partner/events/new`. Texte : « Ajoutez au moins une catégorie de billets pour
   pouvoir soumettre l’événement. Les catégories sont enregistrées avec le brouillon. » ; sans catégorie : « Aucune
   catégorie de billets pour le moment. » ; bouton « Ajouter une catégorie » (50 au plus) ; chaque catégorie se retire
   par l'icône « Retirer la catégorie {n} » (`components/events/EventForm.tsx:1140-1189`, `lib/validations/event.ts:52`).
2. **Ce qu'il saisit (une catégorie).**

   | Champ (libellé exact) | Obligatoire | Valeur de départ, limites, aide | Messages exacts | Preuve |
   |---|---|---|---|---|
   | « Nom de la catégorie » (exemple « Par exemple : Standard, VIP, Étudiant ») | oui | 60 caractères ; unique dans l'événement (sans tenir compte des majuscules) | « Indiquez le nom de la catégorie. » ; « Le nom d’une catégorie compte au plus 60 caractères. » ; « Deux catégories portent ce nom : chaque nom doit être unique. » | `components/events/EventTicketing.tsx:250-261`, `lib/validations/event.ts:312-313`, `:442-450` |
   | « Prix (F CFA) » | oui | 0 à 10 000 000, entier ; aide « Montant entier ; 0 pour une entrée gratuite. » ; prix payant d'au moins 100 F CFA (réglage `finance.min_paid_price`, 1 à 100 000) | « Ce champ est obligatoire. » ; « Le prix est un montant entier en francs CFA. » ; « Le prix ne peut pas être négatif. » ; « Le prix ne dépasse pas 10 000 000 F CFA. » ; « Le prix d’un billet payant est d’au moins {minimum} F CFA. Pour un billet gratuit, indiquez 0. » — ex. « Le prix d’un billet payant est d’au moins 100 F CFA. Pour un billet gratuit, indiquez 0. » | `components/events/EventTicketing.tsx:262-277`, `lib/validations/event.ts:316-317`, `lib/events/event.service.ts:129-139`, `M/20261109000005_lot9bis_samirpay.sql:240-269`, `M/20261109000001_lot9bis_reglages.sql:35`, `:91` |
   | « Quantité mise en vente » | oui | 1 à 100 000 ; aide « Nombre de billets de cette catégorie (1 à 100 000). » ; sous les deux champs : « Pour vendre des places supplémentaires à un autre prix, créez une nouvelle catégorie. » | « Ce champ est obligatoire. » ; « La quantité mise en vente est un nombre entier de billets. » ; « La quantité mise en vente compte au moins 1 billet. » ; « La quantité mise en vente compte au plus 100 000 billets. » | `components/events/EventTicketing.tsx:244-246`, `:278-293`, `lib/validations/event.ts:318-319` |
   | « Maximum de billets par commande » | non (10 si vide) | 10 à l'ouverture ; aide « De 1 à 50 billets. » | « Le maximum par commande est un nombre entier. » ; « Le maximum par commande est d’au moins 1 billet. » ; « Le maximum par commande est de 50 billets au plus. » | `components/events/EventTicketing.tsx:107`, `:300-314`, `lib/validations/event.ts:61`, `:320-321`, `:336` |
   | « Début de la vente » | non | aide « Heure de Dakar. Vide : en vente dès la publication. » | « Date de vente invalide (format AAAA-MM-JJ HH:mm, heure de Dakar). » ; « Le début de vente doit précéder la fin de l’événement. » | `components/events/EventTicketing.tsx:315-324`, `lib/validations/event.ts:322-329`, `:365-367` |
   | « Fin de la vente » | non | aide « Heure de Dakar. Au plus tard à la fin de l’événement. » | « La fin de vente doit être postérieure au début de vente. » ; « La fin de vente ne peut pas dépasser la fin de l’événement. » | `components/events/EventTicketing.tsx:325-334`, `lib/validations/event.ts:359-364` |
   | « Détail affiché aux acheteurs » (exemple « Par exemple : accès à la zone devant la scène ») | non | 300 caractères, compteur | « La description d’une catégorie compte au plus 300 caractères. » | `components/events/EventTicketing.tsx:335-347`, `lib/validations/event.ts:314-315` |
   | Bloc « Où vendre cette catégorie » : case « Vendue en ligne » | — | cochée ; aide « Affichée sur la page de l’événement et achetable sur le site. » | — | `components/events/EventTicketing.tsx:110`, `:348-359`, `lib/events/category-channels.ts:16-20` |
   | case « Vendue au guichet » | — | cochée ; aide « Proposée au contrôleur et vendue en espèces à l’entrée. » | — | `components/events/EventTicketing.tsx:111`, `:360-368` |
   | « Catégorie active » | — | cochée | — | `components/events/EventTicketing.tsx:112`, `:407-416` |

   Sous les deux cases : « Résultat : {canaux} », avec « En ligne et au guichet », « En ligne uniquement », « Sur place
   uniquement » ou « Invitations seulement » (`components/events/EventTicketing.tsx:370-373`,
   `lib/events/category-channels.ts:8-11`). Les deux cases décochées affichent l'avertissement « Cette catégorie n’est
   vendue ni en ligne ni au guichet. Distribuez ses billets depuis l’onglet Invitations du pilotage. »
   (`components/events/EventTicketing.tsx:374-379`) ; c'est permis (`lib/validations/event.ts:339-342`).
   **La couleur au contrôle et la consigne d'entrée ne se règlent pas à la création** : le serveur les refuserait ; elles
   apparaissent une fois la catégorie enregistrée (04.15) (`components/events/EventTicketing.tsx:25-26`, `:183-190`,
   `:381`, `lib/validations/event.ts:516-522`).
3. **Ce que fait le système à « Enregistrer le brouillon ».** Tout le formulaire est contrôlé
   (`components/events/EventForm.tsx:622-631`), puis envoyé en une fois : l'événement et ses catégories sont créés
   ensemble, ou rien (`app/api/partner/events/route.ts:62-109`, `lib/events/event.service.ts:270-282`,
   `M/20261109000008_lot9bis_cycle.sql:636-680`). L'événement naît en Brouillon, avec une ligne d'historique de
   création, et la seule offre « billetterie » (`M/20261109000008_lot9bis_cycle.sql:662-668`). La somme des quantités
   des catégories **actives** ne peut pas dépasser la jauge (`lib/validations/event.ts:452-456`). Réussite : message
   « Brouillon enregistré. Soumettez-le à la validation depuis la liste de vos événements. » et retour à « Mes
   événements » (`components/events/EventForm.tsx:701-705`). Journal : `EVENT_CREATED` (`M/20261109000008_lot9bis_cycle.sql:677-679`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** L'administration voit le brouillon dans l'onglet « Brouillon » de `/admin/events`
   (`app/admin/events/page.tsx:40`) ; le public, rien.
6. **Refus.**
   - Partenaire dont le dossier n'est pas validé : « Votre profil d’organisateur doit être validé avant de créer un
     événement. » (`app/api/partner/events/route.ts:87-92`).
   - Compte sans rôle partenaire : « Seul un organisateur peut créer un événement. » (`app/api/partner/events/route.ts:75-77`).
   - Refus du serveur : l'encadré d'erreurs reprend chaque champ ; message général par défaut « L’enregistrement a été
     refusé. » (`components/events/EventForm.tsx:707`) ; plusieurs erreurs : « Le formulaire contient {n} erreurs.
     {premier message} » (`lib/validations/event.ts:647-657`).
   - Prix payant sous le minimum : le message est rangé sous « Formulaire » et non sous la catégorie (constat W4-07).
   - Coupure réseau : « Connexion impossible : rien n’a été enregistré. Vérifiez votre réseau, puis réessayez. »
     (`components/events/EventForm.tsx:154`, `:734-736`).
   - Panne : « Création de l’événement impossible pour le moment. » (`app/api/partner/events/route.ts:104-107`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 11 (`docs/recette-billetterie.md:498-516`).

## 04.6 Supprimer un brouillon jamais soumis

1. **Qui, où.** Partenaire, « Mes événements », carte d'un brouillon, bouton « Supprimer le brouillon »
   (`components/partner/events-list/PartnerEventCard.tsx:147-151`). Le bouton n'existe que pour un brouillon **jamais
   soumis** (`M/20261109000008_lot9bis_cycle.sql:439-442`).
2. **Ce qu'il saisit.** Confirmation « Supprimer ce brouillon ? » : « « {titre} » et ses catégories de billets seront
   supprimés définitivement. », bouton « Supprimer le brouillon » (`app/partner/events/page.tsx:381-390`). Exemple :
   « « Concert Test » et ses catégories de billets seront supprimés définitivement. ».
3. **Ce que fait le système.** Suppression de l'événement, de ses catégories et de sa ligne de création ; message
   « Brouillon supprimé. » (`lib/events/event.service.ts:451-458`, `:477-483`, `app/partner/events/page.tsx:186-189`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** L'événement disparaît de l'onglet « Brouillon » de l'administration ; une fiche
   admin ouverte affiche ensuite « Cet événement n’existe pas ou a été supprimé » (`app/admin/events/[id]/page.tsx:441-452`).
6. **Refus.** Brouillon déjà soumis (même revenu en brouillon) : « Ce brouillon a déjà été soumis : son historique est
   conservé, il ne peut pas être supprimé. » ; autre statut : « Un événement sorti du brouillon ne peut pas être
   supprimé : annulez-le ou laissez-le se terminer. » (`M/20261103000001_lot6_dette.sql:214-220`,
   `lib/events/event.service.ts:486`). Échec : « Suppression impossible pour le moment. » (`app/partner/events/page.tsx:192`).
7. **Preuves.** Fichiers cités.

## 04.7 Soumettre à la validation

1. **Qui, où.** Partenaire, « Mes événements », carte d'un brouillon, bouton « Soumettre à la validation »
   (`components/partner/events-list/PartnerEventCard.tsx:119-131`). Pas de fenêtre de confirmation
   (`app/partner/events/page.tsx:169-181`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** La base vérifie (`M/20261109000008_lot9bis_cycle.sql:298-335`) :
   - dossier de la partenaire **validé** ;
   - une affiche ;
   - au moins une catégorie de billets **active** ;
   - un début dans le futur ;
   - aucune catégorie active dont la période de vente dépasse la fin de l'événement.
   Si tout va bien : statut « En attente de validation », message « Événement soumis : l’équipe Event Village va vérifier
   la fiche. » (`app/partner/events/page.tsx:64-65`). L'événement ne se modifie plus tant qu'il attend (04.12).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Partenaire | cloche, email | indispensable | file, passage suivant de l'envoyeur (chaque minute) | `EVENT_SUBMITTED_ACK` : « Événement envoyé en validation » / « « {titre} » est envoyé à l'équipe Event Village pour validation. Vous serez prévenu de la décision. » — ex. « « Concert Test » est envoyé à l'équipe Event Village pour validation. Vous serez prévenu de la décision. » |
   | Admins munis de `events.read` et SUPERADMIN | cloche, push, email | indispensable | file | `ADMIN_EVENT_SUBMITTED` : « Événement à valider » / « « {titre} » de {société} attend votre validation. » — ex. « « Concert Test » de Fatou Diop Events attend votre validation. » |

   Preuves : `M/20261109000009_lot9bis_messages.sql:138-147`, `lib/notifications/catalog.ts:1610-1618`, `:1189-1197`.
   Détail des canaux : `10-notifications.md`.
5. **Ce que voient les autres rôles.** La liste de l'administration (onglet « En attente de validation », ouvert par
   défaut) se recharge en direct (`app/admin/events/page.tsx:40-42`, `:165-171`). La liste de la partenaire aussi
   (`app/partner/events/page.tsx:131-135`).
6. **Refus.** Manques : fenêtre « Soumission impossible : il manque des informations », texte « Corrigez ces points,
   puis soumettez de nouveau l’événement : » suivi de la liste, boutons « Fermer » et « Compléter l’événement »
   (`app/partner/events/page.tsx:142-160`, `:356-379`). Lignes possibles, exactes : « Ajoutez une affiche à
   l'événement. », « Ajoutez au moins une catégorie de billets active. », « La date de début est passée : changez-la
   avant de soumettre. », « La période de vente de « {nom} » dépasse la fin de l’événement. »
   (`M/20261109000008_lot9bis_cycle.sql:313-325`). Dossier non validé : « Votre profil d’organisateur doit être validé
   avant de soumettre ou de publier un événement. » (`:305-309`).
7. **Preuves et essai.** Recette : essais 12 et 13 (`docs/recette-billetterie.md:518-551`).

## 04.8 Retirer de la validation (partenaire)

1. **Qui, où.** Partenaire, carte d'un événement « En attente de validation », bouton « Retirer de la validation ».
2. **Ce qu'il saisit.** Rien, pas de confirmation.
3. **Ce que fait le système.** Retour en Brouillon ; message « Événement retiré de la validation : vous pouvez de nouveau
   le modifier. » (`app/partner/events/page.tsx:67`). L'événement reste « déjà soumis » : il ne pourra plus être
   supprimé (04.6).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Admins `events.read` et SUPERADMIN | cloche, email | indispensable | file | `ADMIN_EVENT_WITHDRAWN` : « Soumission retirée par l'organisateur » / « « {titre} » de {société} est retiré de la validation par l'organisateur : il n'attend plus votre examen. » |

   Preuves : `M/20261110000006_lot9ter_equipe_messages.sql:106-142`, `lib/notifications/catalog.ts:1666-1676`.
5. **Ce que voient les autres rôles.** L'événement quitte l'onglet « En attente » de l'administration (rechargement en
   direct, `app/admin/events/page.tsx:165-171`).
6. **Refus.** Communs (04.0).
7. **Preuves.** Fichiers cités.

## 04.9 Refuser avec un motif (administration)

1. **Qui, où.** Admin `events.write` ou SUPERADMIN. `/admin/events` → l'événement → `/admin/events/{id}`, bouton
   « Refuser » (`app/admin/events/[id]/page.tsx:537-546`).
2. **Ce qu'il saisit.** Fenêtre « Refuser l’événement », texte « L’événement revient en brouillon chez l’organisateur,
   qui voit votre motif sur sa fiche et peut le soumettre de nouveau. », champ « Motif du refus » (obligatoire, 3 à 500
   caractères, compteur), aide « Au moins 3 caractères. Ce motif est communiqué à l’organisateur et reste dans
   l’historique. », bouton « Refuser » (`app/admin/events/[id]/page.tsx:191-197`, `:785-799`,
   `components/ui/ReasonDialog.tsx:50-51`). Trop court : « Le motif doit contenir au moins 3 caractères. »
   (`components/ui/ReasonDialog.tsx:65`).
3. **Ce que fait le système.** Retour en Brouillon, motif dans l'historique ; message « Refus envoyé : l’organisateur voit
   votre motif. » (`app/admin/events/[id]/page.tsx:195`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Partenaire | SMS, cloche, push, email | indispensable | file | `EVENT_REJECTED` — SMS : « Event Village : événement {titre, 25 car.} non validé. Motif : {motif, 40 car.}. {lien}/partner/events » — ex. « Event Village : événement Concert Test non validé. Motif : Affiche illisible, merci d'en déposer... https://app.exemple.sn/partner/events » (137 caractères, 1 segment) ; cloche « Événement non validé » / « « {titre} » n'est pas validé. Motif : {motif}. » |

   Preuves : `M/20261109000009_lot9bis_messages.sql:149-155`, `lib/notifications/catalog.ts:909-915`. Le motif est
   coupé à 40 caractères dans le SMS (`lib/notifications/catalog.ts:913`).
5. **Ce que voient les autres rôles.** La partenaire voit sur sa carte et dans le pilotage l'encadré « Refusé par
   l’équipe Event Village », le motif (ou « Aucun motif communiqué. ») et « Le {date} »
   (`components/partner/events-list/PartnerEventCard.tsx:104-116`, `M/20261109000008_lot9bis_cycle.sql:418-431`).
   L'administration voit « Motif du refus » et « Communiqué à l’organisateur le {date}. » (`app/admin/events/[id]/page.tsx:568-579`).
6. **Refus.** Communs (04.0) ; erreur affichée dans la fenêtre (`app/admin/events/[id]/page.tsx:414-419`).
7. **Preuves et essai.** Recette : essai 12 (`docs/recette-billetterie.md:518-533`).

## 04.10 Valider (administration)

1. **Qui, où.** Admin `events.write` ou SUPERADMIN, fiche `/admin/events/{id}`, bouton « Valider ».
2. **Ce qu'il saisit.** Confirmation « Valider l’événement ? » : « L’organisateur est prévenu et pourra publier
   l’événement. La fiche ne repasse pas en validation. », boutons « Annuler » et « Valider »
   (`app/admin/events/[id]/page.tsx:184-190`, `:752-783`).
3. **Ce que fait le système.** Statut Validé ; message « Événement validé : l’organisateur peut maintenant le publier. ».
   Aucun contrôle de date à cette étape : un événement dont le début est passé entre-temps peut être validé
   (`M/20261109000008_lot9bis_cycle.sql:311-348`, le contrôle de début ne vaut qu'à la soumission). L'événement n'est pas
   encore public (04.0). Des contrôleurs peuvent y être affectés dès ce statut (`lib/events/event-status.ts:14`, voir 05).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Partenaire | SMS, cloche, push, email | indispensable | file | `EVENT_VALIDATED` — SMS : « Event Village : votre événement {titre, 30 car.} est validé. Publiez-le depuis votre espace : {lien}/partner/events » — ex. « Event Village : votre événement Concert Test est validé. Publiez-le depuis votre espace : https://app.exemple.sn/partner/events » (127 caractères, 1 segment) ; cloche « Événement validé » / « « {titre} » est validé. Vous pouvez le publier depuis votre espace. » |

   Preuves : `M/20261109000009_lot9bis_messages.sql:157-162`, `lib/notifications/catalog.ts:902-908`.
5. **Ce que voient les autres rôles.** La partenaire voit le bouton « Publier » sur sa carte (04.11).
6. **Refus.** Communs (04.0).
7. **Preuves et essai.** Recette : essais 13 et 90 (`docs/recette-billetterie.md:535-551`, `:1919-1936`).

## 04.11 Publier : par la partenaire, par l'administration

1. **Qui, où.**
   - Partenaire : carte d'un événement Validé ou en-tête du pilotage, bouton « Publier »
     (`components/partner/events-list/PartnerEventCard.tsx:119-131`, `app/partner/events/[id]/page.tsx:205-216`).
   - Administration (`events.write`) : fiche `/admin/events/{id}`, bouton « Publier ».
2. **Ce qu'il saisit.** Partenaire : fenêtre « Publier l’événement ? » : « La page publique sera visible de tous et la
   billetterie ouverte selon les dates de vente de chaque catégorie. Après la publication, les changements de date, de
   lieu ou de titre seront notifiés aux acheteurs. », boutons « Pas maintenant » et « Publier »
   (`app/partner/events/page.tsx:306-339`, `app/partner/events/[id]/page.tsx:268-301`). Administration : « Publier
   l’événement ? » : « La page publique devient visible de tous et la billetterie s’ouvre selon les dates de vente. »
   (`app/admin/events/[id]/page.tsx:213-218`).
3. **Ce que fait le système.** Statut Publié : la fiche publique existe, la vente s'ouvre selon les dates de chaque
   catégorie. Message : partenaire « Événement publié : la page publique est en ligne et la billetterie est
   ouverte. » depuis la liste, « Statut de l’événement mis à jour. » depuis le pilotage (`app/partner/events/page.tsx:66`,
   `app/partner/events/[id]/page.tsx:114`) ; administration « Événement publié. ».
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Admins `events.read` et SUPERADMIN (publication par la partenaire) | cloche, email | indispensable | file | `ADMIN_EVENT_PUBLISHED` : « Événement publié par l'organisateur » / « « {titre} » de {société} est publié par l'organisateur : sa page publique est en ligne. » |
   | Partenaire (publication par l'administration) | cloche, push, email | indispensable | file | `EVENT_PUBLISHED_BY_ADMIN` : « Événement publié » / « « {titre} » a été publié par l'administration. » |

   Preuves : `M/20261110000006_lot9ter_equipe_messages.sql:116-121`, `M/20261109000009_lot9bis_messages.sql:164-169`,
   `lib/notifications/catalog.ts:1653-1664`, `:930-935`.
5. **Ce que voient les autres rôles.** Le public voit la fiche et la carte dans « Explorer » ; la fiche publique se met à
   jour en direct (`app/events/[id]/page.tsx:471-476`).
6. **Refus.** Fin passée : « La fin de cet événement est passée : il ne peut plus être publié. » (le bouton n'est
   d'ailleurs plus proposé) (`M/20261109000008_lot9bis_cycle.sql:337-339`, `:414`). Partenaire suspendue, même pour
   l'administration : « Le partenaire est suspendu : son événement ne peut pas être remis en ligne avant sa
   réactivation. » (`:300-304`). Dossier non validé : « Votre profil d’organisateur doit être validé avant de soumettre ou
   de publier un événement. » (`:305-309`).
7. **Preuves et essai.** Recette : essai 13 (`docs/recette-billetterie.md:535-551`).

## 04.12 Modifier un événement : ce qui est permis selon le statut

1. **Qui, où.** Partenaire seule. Bouton « Modifier » de la carte ou du pilotage (`components/partner/events-list/PartnerEventCard.tsx:137-141`,
   `app/partner/events/[id]/page.tsx:217-221`), page `/partner/events/{id}/edit`. En-tête : badge du statut, titre
   « Modifier l’événement », sous-titre = titre de l'événement (`components/events/EventForm.tsx:744-752`). Le bouton
   n'existe que pour Brouillon, Validé, Publié et Suspendu (`M/20261109000008_lot9bis_cycle.sql:438`).
2. **Ce qu'il saisit.** Les mêmes champs (04.2 à 04.4) ; le bouton « Enregistrer les modifications » est présent à chaque
   étape ; la billetterie s'enregistre catégorie par catégorie (04.15) ; à l'étape 4 : « « Enregistrer les
   modifications » concerne les informations de l’événement ; chaque catégorie de billets s’enregistre avec son propre
   bouton. » (`components/events/EventForm.tsx:1196-1212`). Seuls les champs changés partent (`:312-320`, `:633`).
   Après validation (Validé, Publié, Suspendu), encadré « Modifications encadrées après la validation » :
   « Description, programme, informations pratiques, affiche et position : modifiables librement. » ; « Titre, dates,
   heures, lieu, ville et adresse : les détenteurs de billets sont prévenus. » ; « Catégorie d’événement : verrouillée
   dès qu’un billet est vendu, réservé ou offert. Jauge : elle ne peut alors plus être retirée ni descendre sous les
   billets vendus et en cours de paiement, et jamais sous la somme des quantités des catégories actives. »
   (`components/events/EventForm.tsx:823-831`). Pour Publié et Suspendu, titre, date de début, lieu, ville et adresse
   portent l'aide « Les détenteurs de billets seront prévenus de ce changement. » (`:93-96`, `:817`).

   **Verrous** (servis par le serveur, relus après chaque catégorie enregistrée, `components/events/EventForm.tsx:103-133`,
   `:544-555`, `M/20261110000007_lot9ter_evenements.sql:49-70`). « Il y a des ventes » veut dire : un billet de cette
   catégorie ou de l'événement existe, quel que soit son statut (vendu, offert, annulé, remboursé), ou une réservation
   est en cours (`M/20261110000007_lot9ter_evenements.sql:7-11`).

   | Élément | Règle | Texte affiché | Preuve |
   |---|---|---|---|
   | Catégorie de l'événement | verrouillée dès qu'il y a des ventes | « Verrouillée : des billets ont déjà été vendus ou réservés. » (boutons grisés, cadenas) | `components/events/EventForm.tsx:934-939`, `:1300-1305` |
   | Jauge, avec ventes | ne peut plus être retirée, ni descendre sous max(vendus + en cours de paiement, somme des quantités actives) | « Des billets sont vendus ou réservés : la jauge ne peut plus être retirée ni descendre sous {n} places. » | `components/events/EventForm.tsx:1009-1010`, `M/20261110000007_lot9ter_evenements.sql:65` |
   | Jauge, sans vente mais avec catégories actives | jamais sous la somme des quantités actives | « Facultative. Elle ne descend pas sous la somme des quantités des catégories actives : {n} places. » | `components/events/EventForm.tsx:1011-1012` |
   | Début | un nouveau début doit être dans le futur ; un début inchangé n'est pas recontrôlé | « Le nouveau début de l'événement doit être dans le futur (heure de Dakar). » | `M/20261109000009_lot9bis_messages.sql:592-596`, `lib/validations/event.ts:492-494` |

3. **Ce que fait le système.** La base revérifie tout sous verrou (`M/20261109000009_lot9bis_messages.sql:392-930`).
   Une fin qui recule repousse la disponibilité des recettes en ligne pas encore disponibles, jamais l'inverse
   (`:699-705`). Une date de début qui change annule les rappels déjà prévus (`M/20261103000004_lot6_rappels.sql:246-269`)
   et inscrit l'ancien et le nouveau début au journal des reports (04.14) (`M/20261109000009_lot9bis_messages.sql:691-697`).
   Journal : `EVENT_UPDATED` (brouillon) ou `EVENT_LIVE_UPDATED` (après validation) (`:919-924`). Réussite : message
   « Modifications enregistrées. » et encadré « Modifications enregistrées » avec le résumé des messages (04.13)
   (`components/events/EventForm.tsx:718-726`, `:833-842`). Sans changement : « Aucune modification à enregistrer. »
   (`:680-685`).
4. **Messages envoyés.** Voir 04.13 (détenteurs, numéros sans compte, contrôleurs) et, pour l'administration :

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Admins `events.read` et SUPERADMIN, si l'événement est Validé, Publié ou Suspendu et que titre, affiche, lieu, ville, adresse ou dates changent | cloche, email | indispensable | file, une alerte par enregistrement | `ADMIN_EVENT_CHANGED` : « Événement modifié après validation » / « « {titre} » de {société} : {changements} après validation. Vérifiez la fiche. » — ex. « « Concert Test » de Fatou Diop Events : nouveau titre (ancien : « Concert Essai »), nouvelle date après validation. Vérifiez la fiche. » ; changements possibles : « nouveau titre (ancien : « {ancien} ») », « nouvelle affiche », « nouveau lieu », « nouvelle date » |

   Preuves : `M/20261109000009_lot9bis_messages.sql:1083-1139`, `lib/notifications/catalog.ts:547-567`, `:1597-1608`.
   Une modification en Brouillon ne prévient personne.
5. **Ce que voient les autres rôles.** Fiche publique et carte mises à jour (Publié, Suspendu). L'administration voit la
   fiche à jour au rechargement (pas de direct sur la fiche, `app/admin/events/[id]/page.tsx:341-378`).
6. **Refus.**

   | Cas | Écran ou message exact | Preuve |
   |---|---|---|
   | En attente de validation | page « Événement en cours de validation » : « Pour le modifier, retirez-le d’abord de la validation depuis la liste de vos événements, puis soumettez-le à nouveau. » ; serveur : « L’événement est en cours de validation : retirez-le de la validation pour le modifier. » | `components/events/EventForm.tsx:791-807`, `lib/events/event.service.ts:252-256` |
   | Terminé ou annulé | page « Événement figé » : « Un événement terminé ou annulé ne peut plus être modifié. » | `components/events/EventForm.tsx:798-803`, `lib/events/event.service.ts:257-261` |
   | Autre session a enregistré entre-temps | encadré « L’événement a été modifié entre-temps » : « Une autre session a enregistré des changements. Rechargez l’événement pour repartir de la dernière version (vos saisies non enregistrées seront perdues). », bouton « Recharger l’événement » | `components/events/EventForm.tsx:844-854`, `M/20261109000009_lot9bis_messages.sql:502-504` |
   | Administration | « Seul l’organisateur modifie son événement ; l’administration agit par les changements de statut. » | `lib/events/event.service.ts:244-249` |
   | Catégorie d'événement après ventes | « La catégorie de l'événement ne change plus : des billets ont été vendus ou réservés. » | `M/20261109000009_lot9bis_messages.sql:609-611` |
   | Jauge retirée après ventes | « La jauge ne peut plus être supprimée : des billets ont été vendus ou réservés. » | `:617-619` |
   | Jauge sous les ventes | « La jauge ne peut pas descendre sous {n} : billets vendus et paiements en cours compris. » | `:620-623` |
   | Jauge sous les quantités | « La jauge ne peut pas descendre sous la somme des quotas des catégories actives ({n}) : baissez d'abord les quotas. » | `:624-627` |
   | Fin avancée avant une fin de vente | « La fin de vente de « {nom} » dépasse la nouvelle fin de l'événement : avancez d'abord la fin de vente. » — ex. « La fin de vente de « VIP » dépasse la nouvelle fin de l'événement : avancez d'abord la fin de vente. » | `:631-642` |
   | Fin placée avant un début de vente | « Le début de vente doit précéder la fin de l’événement. » | `:643-652` |
   | Événement introuvable | « Événement introuvable » : « Cet événement n’existe pas ou n’appartient pas à votre compte. », bouton « Voir mes événements » | `components/events/EventForm.tsx:777-789` |
   | Réseau | « Connexion impossible : rien n’a été enregistré. Vérifiez votre réseau, puis réessayez. » ; chargement : « Connexion impossible : l’événement n’a pas pu être chargé. Vérifiez votre réseau. » | `components/events/EventForm.tsx:154`, `:535` |
   | Autre refus | message du serveur, sinon « La modification a été refusée. » | `components/events/EventForm.tsx:733` |

7. **Preuves et essai.** Recette : essais 14 et 89 (`docs/recette-billetterie.md:553-569`, `:1901-1917`).

## 04.13 Modification après publication : messages aux détenteurs, regroupement sur 10 minutes

1. **Qui, où.** Partenaire, `/partner/events/{id}/edit` d'un événement Validé, Publié ou Suspendu, bouton
   « Enregistrer les modifications ».
2. **Ce qu'il saisit.** Titre, date ou heure de début ou de fin, lieu, ville, adresse précise.
3. **Ce que fait le système.**
   - **Champs qui déclenchent un message** : titre, dates (début, fin), heures (début, fin), lieu, ville, adresse
     (`M/20261109000009_lot9bis_messages.sql:655-680`). Description, programme, affiche, position, jauge, informations
     pratiques autres que l'adresse : aucun message aux détenteurs. Un titre seul : message dans l'application, **jamais
     de SMS** (`:679`, `:781-787`).
   - **Qui est prévenu** : les comptes qui détiennent un billet **valable** de l'événement (et, pour un événement sur
     plusieurs jours, un billet déjà utilisé), sauf compte supprimé (`:707-714`) ; les numéros **sans compte** : invitation
     pas encore réclamée et acheteur au guichet ayant donné un numéro (un SMS par numéro, sans lien ; un numéro déjà
     prévenu par son compte est retiré) (`:819-876`) ; les contrôleurs affectés (`:878-917`).
   - **Quand** : la cloche et le push partent au passage suivant de l'envoyeur ; le SMS et l'email sont programmés
     **10 minutes après la première modification** ; toute nouvelle modification pendant ces 10 minutes est **ajoutée au
     même SMS et au même email** (l'échéance n'est pas repoussée : fenêtre fixe). Si l'ancien ou le nouveau début est à
     moins d'une heure, le SMS part tout de suite (`:731-733`, `:748-787`, `:789-813`).
   - Au moment de l'envoi, le SMS est abandonné si l'événement n'est plus Validé, Publié ou Suspendu, ou si la personne
     n'a plus de billet valable (`M/20261109000010_lot9bis_email.sql:476-484`) ; une annulation ou une fin efface les
     messages de changement encore en attente (`M/20261109000009_lot9bis_messages.sql:941-963`).
   - **Résumé à l'écran** (encadré « Modifications enregistrées ») : « {n} détenteurs de billets prévenus dans
     l’application ; {m} SMS partiront dans 10 minutes (vos corrections d’ici là y seront regroupées). », au singulier
     « 1 détenteur de billets prévenu dans l’application » et « 1 SMS partira dans 10 minutes (vos corrections d’ici là y
     seront regroupées). » ; sans destinataire : « Aucun détenteur de billets n’était à prévenir. »
     (`components/events/EventForm.tsx:135-153`). Exemple : « 12 détenteurs de billets prévenus dans l’application ; 12
     SMS partiront dans 10 minutes (vos corrections d’ici là y seront regroupées). ». Ce texte annonce « 10 minutes »
     même quand le SMS part tout de suite (début à moins d'une heure) (constat W4-03).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Détenteur (compte) | cloche, push | indispensable | immédiat (file, passage suivant) ; une notification par enregistrement | `EVENT_CHANGED` : « Événement modifié » / « « {titre} » : {changements}. Vos billets restent valables. » — changements : « nouvelle date : {date} », « nouvelle fin : {date} » (ou « nouvelle heure de fin »), « nouveau lieu : {lieu} », « nouvelle adresse : {adresse} » (ou « adresse retirée »), « nouvelle ville : {ville} », « nouveau titre (ancien titre : « {ancien} ») » — ex. « « Concert Test » : nouvelle date : lun. 7 déc. 2026 à 21:00. Vos billets restent valables. » |
   | Détenteur (compte) et numéro sans compte | SMS | indispensable (pas de plage de nuit) | 10 min après la 1re modification, regroupé ; immédiat si un début est à moins d'1 h | Date : « Event Village : {titre, 30} change de date : {date}. Vos billets restent valables. {lien}/tickets » — ex. « Event Village : Concert Test change de date : lun. 7 déc. à 21:00. Vos billets restent valables. https://app.exemple.sn/tickets » (127 car., 1 segment). Lieu : « Event Village : {titre, 30} change de lieu : {lieu, 25}. Vos billets restent valables. {lien}/tickets » (ex. 113 car.). Date et lieu : « Event Village : {titre, 25} change : {date}, {lieu, 20}. Billets toujours valables. {lien}/tickets » (ex. 123 car.). Fin : « Event Village : {titre, 30} : nouvelle fin le {date}. Vos billets restent valables. {lien}/tickets » (ex. 128 car.). Adresse retirée : « Event Village : {titre, 30} : adresse retirée, lieu {lieu, 20}. Billets toujours valables. {lien}/tickets » (ex. 131 car.). Variantes « report » : 04.14 |
   | Détenteur (compte, adresse vérifiée) | email | indispensable | comme le SMS, regroupé | sujet « Événement modifié — Event Village », contenu de la cloche |
   | Contrôleur affecté | cloche (date ou lieu seulement), SMS, email | indispensable | cloche immédiate ; SMS et email à 10 min, regroupés | `CONTROLLER_EVENT_CHANGED` : cloche « Contrôle modifié » / « « {titre} » : nouvelle date : {date}. Votre affectation est maintenue. » ; SMS « Event Village : affectation à l'entrée de {titre, 25} : nouvelle date {date}. {lien}/login » — ex. « Event Village : affectation à l'entrée de Concert Test : nouvelle date lun. 7 déc. à 21:00. https://app.exemple.sn/login » (120 car., 1 segment) |
   | Administration | cloche, email | indispensable | file | `ADMIN_EVENT_CHANGED` (04.12) |

   Preuves : `lib/notifications/catalog.ts:429-490`, `:510-529`, `:824-830`, `:1533-1539` ; mesures des SMS calculées
   avec `smsSegments` (`lib/notifications/sms-format.ts:73-80`) sur les données d'exemple ; plage de nuit réservée aux SMS
   optionnels (`M/20261109000010_lot9bis_email.sql:487-503`). Détail : `10-notifications.md`.
5. **Ce que voient les autres rôles.** Le client voit la cloche tout de suite ; la fiche publique et « Mes billets »
   montrent la nouvelle date ou le nouveau lieu.
6. **Refus.** Voir 04.12.
7. **Preuves et essai.** Recette : essai 14 (`docs/recette-billetterie.md:553-569`).

## 04.14 Report de plus de 24 h : droit au remboursement total

1. **Qui, où.** Déclenché par la partenaire qui recule le début (04.12). Le client agit dans « Mes billets »
   (`/tickets`), sur la carte du billet.
2. **Ce qu'il saisit.** Le client : bouton « Me faire rembourser », puis fenêtre « Me faire rembourser ? » :
   « Remboursement de {montant}, frais de service compris, sur le compte Mobile Money qui a payé. Votre billet sera
   annulé. » (ou, billet reçu d'un autre : « Remboursement de {montant}, frais de service compris. Le remboursement est
   versé à l’acheteur d’origine. Votre billet sera annulé. »), boutons « Me faire rembourser » et « Garder mon billet »
   (`components/tickets/TicketCard.tsx:776-791`).
3. **Ce que fait le système.**
   - Le droit est ouvert pour un billet **valable, payant, payé en ligne**, d'un événement Publié ou Suspendu **pas
     encore commencé**, quand le début actuel est **plus de 24 h après** le début en vigueur au moment de l'achat
     (reports successifs cumulés ; un billet acheté après le report n'a aucun droit ; avancer la date n'ouvre rien)
     (`M/20261109000006_lot9bis_argent.sql:70-74`, `:515-556`).
   - La carte du billet affiche « L’événement a été reporté de plus de 24 h : remboursement total possible ({montant},
     frais de service compris) jusqu’au {date}. » (`components/tickets/TicketCard.tsx:556-563`) ; montant = prix + frais
     de service, borné au reste du paiement ; date limite = nouveau début (`M/20261109000006_lot9bis_argent.sql:561-590`).
     Exemple : « L’événement a été reporté de plus de 24 h : remboursement total possible (10 500 F CFA, frais de service
     compris) jusqu’au lun. 7 déc. 2026 à 20:00. » (dates et montants par `lib/format.ts`, `components/tickets/TicketCard.tsx:54`).
   - La demande annule le billet et rembourse l'acheteur d'origine sur son compte Mobile Money
     (`app/api/tickets/[id]/refund/route.ts:35-87`) ; la suite (versement, retard) : `08-argent.md`.
4. **Messages envoyés.** Le message de changement (04.13) prend alors sa forme « report » pour le détenteur concerné
   (`M/20261109000009_lot9bis_messages.sql:738-743`) :

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Détenteur dont un billet ouvre le droit | SMS | indispensable | comme 04.13 | Date seule : « Event Village : {titre, 20} reporté au {date}. Remboursement total possible avant cette date : {lien}/tickets » — ex. « Event Village : Concert Test reporté au lun. 7 déc. à 20:00. Remboursement total possible avant cette date : https://app.exemple.sn/tickets » (139 car., 1 segment). Date et lieu : « Event Village : {titre, 20} reporté au {date}, nouveau lieu. Remboursement total avant cette date : {lien}/tickets » (ex. 144 car.) |
   | Même détenteur | cloche, push, email | indispensable | comme 04.13 | « Événement modifié » / « « {titre} » est reporté au {date}[, nouveau lieu : {lieu}]. Vos billets restent valables ; vous pouvez aussi demander leur remboursement total, frais compris, dans Mes billets jusqu'au début de l'événement. » |

   Preuves : `lib/notifications/catalog.ts:433-438`, `:458-465`. Les numéros sans compte (invitation non réclamée,
   guichet) reçoivent la forme ordinaire, sans remboursement (`M/20261109000009_lot9bis_messages.sql:861-869`).
5. **Ce que voient les autres rôles.** La partenaire voit le remboursement dans son pilotage (voir 08).
6. **Refus.** « Ce billet n’ouvre pas de remboursement : l’événement n’a pas été reporté de plus de 24 h, ou il a
   commencé. » (`M/20261109000006_lot9bis_argent.sql:1033-1037`) ; sans confirmation : « Confirmez la demande de
   remboursement. » ; billet d'un autre compte : « Billet introuvable. » ; billet déjà annulé : « Ce billet ne peut plus
   être remboursé. » (`app/api/tickets/[id]/refund/route.ts:19-33`, `:55-62`).
7. **Preuves et essai.** Recette : essai 14 (`docs/recette-billetterie.md:553-569`).

## 04.15 Billetterie d'un événement déjà créé

1. **Qui, où.** Partenaire, `/partner/events/{id}/edit`, étape « Billets » (Brouillon, Validé, Publié, Suspendu).
   Texte : « Chaque catégorie s’enregistre séparément. Le prix ne change plus dès qu’un billet est vendu ou réservé ; la
   quantité ne descend jamais sous les ventes. » (`components/events/EventTicketing.tsx:649-651`). Sans catégorie :
   « Aucune catégorie de billets. Ajoutez-en une pour pouvoir soumettre l’événement. » (`:653-658`).
2. **Ce qu'il saisit.** Les champs de 04.5, plus, pour une catégorie **déjà enregistrée**, le bloc « Au contrôle des
   entrées » (`components/events/EventTicketing.tsx:381-406`) :

   | Champ | Valeurs, aide | Message d'erreur | Preuve |
   |---|---|---|---|
   | « Couleur au contrôle » | « Aucune couleur », « Blanc », « Or », « Argent », « Rose », « Turquoise », « Bleu nuit », « Violet », « Noir » ; aide « Bande de couleur montrée au contrôleur avec le nom de la catégorie. » | « Choisissez une couleur dans la liste. » | `components/events/EventTicketing.tsx:55-58`, `:384-393`, `lib/scan/scan-result.ts:208-220`, `lib/validations/event.ts:523-528` |
   | « Consigne d’entrée » (exemple « Par exemple : Remettre bracelet doré ») | 60 caractères ; aide « Facultative, 60 caractères au plus. Affichée en gros au contrôleur quand le billet est validé à l’entrée. » | « La consigne d’entrée ne dépasse pas 60 caractères. » | `components/events/EventTicketing.tsx:394-404`, `lib/validations/event.ts:524`, `:529-533` |

   Chaque carte de catégorie montre son état : « Nouvelle catégorie, pas encore enregistrée », « Aucun billet vendu »,
   ou « {n} billets vendus[, {m} en cours de paiement] », suivi de « · Vente fermée » (inactive) ou « · {canaux} »
   (`components/events/EventTicketing.tsx:677-686`). Boutons : « Créer la catégorie » (nouvelle) ou « Enregistrer la
   catégorie » (grisé sans changement), « Ajouter une catégorie », icône « Supprimer la catégorie {nom} » ou
   « Abandonner la catégorie {n} » (`:688-697`, `:721-734`).
3. **Ce que fait le système.**
   - Création : « Catégorie créée. » ; enregistrement : « Catégorie enregistrée. » ; rien de changé : « Aucune
     modification à enregistrer pour cette catégorie. » (`components/events/EventTicketing.tsx:597-618`).
   - **Prix verrouillé** dès qu'un billet de la catégorie existe (même offert, annulé ou remboursé) ou qu'un paiement est
     en cours : champ grisé, cadenas, et « Prix verrouillé : {n} billets vendus[, {m} billets en cours de paiement].
     Créez une autre catégorie pour un nouveau tarif. », ou, si plus aucun billet n'est compté, « Prix verrouillé : des
     billets ont déjà été émis pour cette catégorie. Créez une autre catégorie pour un nouveau tarif. »
     (`components/events/EventTicketing.tsx:216-225`, `:240`, `:294-299`). Exemple : « Prix verrouillé : 12 billets
     vendus. Créez une autre catégorie pour un nouveau tarif. ».
   - **Quantité** : jamais sous vendus + en cours de paiement ; aide « Jamais sous les ventes : {n} billets vendus, {m} en
     cours de paiement. » (`components/events/EventTicketing.tsx:244-246`).
   - **Supprimer** : seulement sans aucun billet, réservation ni passage au contrôle ; l'icône n'apparaît pas sinon
     (`components/events/EventTicketing.tsx:688`, `M/20261102000004_lot5_edition.sql:1068-1075`). Fenêtre « Supprimer cette
     catégorie ? » : « La catégorie sera supprimée définitivement. Ce n’est possible que si aucun billet n’a été vendu ni
     réservé. », boutons « Supprimer » et « Garder la catégorie » ; pour une nouvelle : « Abandonner cette catégorie ? » /
     « Les informations saisies pour cette nouvelle catégorie seront perdues. » / « Abandonner » (`:736-747`).
   - **Retirer de la vente** : décocher « Catégorie active » puis enregistrer, ou bouton « Retirer de la vente » proposé
     quand la suppression est refusée ; message « Catégorie retirée de la vente. » (`components/events/EventTicketing.tsx:620-628`,
     `:713-717`). La couleur et la consigne sont gardées.
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Admins `events.read` et SUPERADMIN, si l'événement est Validé, Publié ou Suspendu : catégorie ajoutée | cloche, email | indispensable | file | `ADMIN_EVENT_CHANGED` : « …  : catégorie « {nom} » ajoutée après validation. Vérifiez la fiche. » — ex. « « Concert Test » de Fatou Diop Events : catégorie « VIP » ajoutée après validation. Vérifiez la fiche. » |
   | Idem : prix ou canaux changés | cloche, email | indispensable | file | « nouveau prix pour « {nom} » ({nouveau} au lieu de {ancien}) » ; « canaux de vente de « {nom} » changés ({en ligne et au guichet / en ligne seulement / au guichet seulement / aucun canal}) » |

   Preuves : `M/20261109000009_lot9bis_messages.sql:1142-1180`, `M/20261110000006_lot9ter_equipe_messages.sql:144-197`,
   `lib/notifications/catalog.ts:536-566`. Quantité, dates de vente, couleur, consigne, désactivation : aucun message
   (`M/20261110000006_lot9ter_equipe_messages.sql:30-34`). Les détenteurs ne sont jamais prévenus d'un changement de
   catégorie.
5. **Ce que voient les autres rôles.** Le contrôleur voit la couleur et la consigne au scan (voir 05). Le public voit les
   catégories vendues en ligne ; la fiche publique se met à jour en direct (`app/events/[id]/page.tsx:471-476`).
6. **Refus (messages exacts du serveur).**

   | Cas | Message | Preuve |
   |---|---|---|
   | Prix après ventes | « Le prix de cette catégorie est verrouillé : des billets ont été vendus ou réservés. Créez une nouvelle catégorie pour un autre tarif. » | `M/20261110000011_lot9ter_stock.sql:462-465` |
   | Quantité sous les vendus | « Le quota ne peut pas descendre sous les {n} billet(s) déjà vendus. » | `:466-469` |
   | Quantité sous vendus + en cours | « Le quota ne peut pas descendre sous {n} : {v} billet(s) vendus et {r} en cours de paiement. » | `:470-474` |
   | Jauge dépassée | « Les quantités mises en vente des catégories actives totaliseraient {n} places. Augmentez d’abord la capacité totale de l’événement (actuellement {jauge}). » | `:475-486` (création : `:318-324`) |
   | Nom déjà pris | « Une catégorie « {nom} » existe déjà pour cet événement : choisissez un autre nom. » | `:488-493`, `:312-315` |
   | Dates de vente | « La fin de vente doit être postérieure au début de vente. » ; « La fin de vente ne peut pas dépasser la fin de l'événement. » ; « Le début de vente doit précéder la fin de l’événement. » | `:496-504` |
   | Suppression avec ventes | « Des billets de cette catégorie ont été vendus ou réservés : elle ne peut pas être supprimée. Désactivez-la pour arrêter sa vente. » | `M/20261102000004_lot5_edition.sql:1068-1073` |
   | En attente, terminé, annulé, administration | « L’événement est en cours de validation : retirez-le de la validation pour modifier sa billetterie. » ; « La billetterie d’un événement terminé ou annulé ne peut plus être modifiée. » ; « Seul l’organisateur modifie la billetterie de son événement. » | `lib/events/event.service.ts:244-261` |
   | Réseau | « Connexion impossible : la catégorie n’a pas été enregistrée. Vérifiez votre réseau, puis réessayez. » | `components/events/EventTicketing.tsx:521` |
   | Autre | message du serveur, sinon « L’enregistrement de la catégorie a été refusé. » | `components/events/EventTicketing.tsx:575-583` |

7. **Preuves et essai.** Recette : essais 77, 79 et 89 (`docs/recette-billetterie.md:1657-1720`, `:1901-1917`). La
   réponse à la question A1 (où régler couleur et consigne) en découle : voir `00-index.md`.

## 04.16 Suspendre (administration)

1. **Qui, où.** Admin `events.write` ou SUPERADMIN, fiche `/admin/events/{id}` d'un événement Publié, bouton
   « Suspendre ».
2. **Ce qu'il saisit.** Fenêtre « Suspendre l’événement » : « La vente et le contrôle d’accès s’arrêtent immédiatement.
   L’organisateur et les détenteurs de billets sont prévenus ; seul l’organisateur voit le motif. », champ « Motif de la
   suspension » (obligatoire, 3 caractères au moins), bouton « Suspendre » (`app/admin/events/[id]/page.tsx:198-204`,
   `:785-799`).
3. **Ce que fait le système.** Statut Suspendu ; message « Événement suspendu : la vente et le contrôle d’accès sont
   arrêtés. ». Vente refusée (« Cet événement n'est pas ouvert à la vente. », `M/20261106000001_lot8_canaux.sql:235-237`),
   contrôle refusé (`M/20261110000007_lot9ter_evenements.sql:137`), rappels en attente annulés
   (`M/20261103000004_lot6_rappels.sql:239-243`) et aucun rappel n'est créé tant qu'il est suspendu (les rappels ne
   visent que les Publiés, `M/20261105000002_lot7_sms.sql:616-622`). Les recettes déjà disponibles de cet événement et
   les commissions de parrainage qui s'y rattachent sont gelées (non retirables) tant qu'il est Suspendu, sans écriture :
   elles se dégèlent dès qu'il quitte ce statut (`M/20261110000005_lot9ter_argent.sql:282-306` ; voir 08 et 09).
   La partenaire peut encore modifier l'événement mais ne peut plus l'annuler (04.19).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Partenaire | SMS, cloche, push, email | indispensable | file | `EVENT_SUSPENDED` — SMS « Event Village : événement {titre, 25} suspendu. Motif : {motif, 40}. {lien}/partner/events » — ex. « Event Village : événement Concert Test suspendu. Motif : Signalement en cours d'examen. https://app.exemple.sn/partner/events » (125 car., 1 segment) ; cloche « Événement suspendu » / « « {titre} » est suspendu par l'administration. Motif : {motif}. » |
   | Détenteurs (billet valable ou utilisé) | cloche, push, email ; **pas de SMS** | optionnel (sujet « actualités des événements ») | file | `EVENT_SUSPENDED_HOLDER` : « Événement suspendu » / « « {titre} » est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite. » |
   | Contrôleurs affectés | cloche, email | indispensable | file | `CONTROLLER_EVENT_STATUS` : « Événement suspendu » / « « {titre} » est suspendu : le contrôle d'accès est fermé jusqu'à nouvel avis. » |

   Preuves : `M/20261109000009_lot9bis_messages.sql:171-196`, `lib/notifications/catalog.ts:811-816`, `:916-922`,
   `:1541-1552`.
5. **Ce que voient les autres rôles.** Fiche publique : encadré « Événement suspendu » : « La billetterie est
   momentanément fermée par l’organisation. Les billets déjà achetés restent valables ; vous serez informé de la
   suite. » (`app/api/events/[id]/route.ts:15-18`). « Mes billets » : le QR disparaît, remplacé par « Événement suspendu :
   l’entrée n’est pas possible pour le moment. » (`M/20261109000008_lot9bis_cycle.sql:1812-1813`). Partenaire :
   encadré « Suspendu par l’équipe Event Village » avec le motif et la date (`components/partner/events-list/PartnerEventCard.tsx:104-116`).
6. **Refus.** Motif trop court (04.0).
7. **Preuves et essai.** Recette : essai 70 (`docs/recette-billetterie.md:1525-1541`).

## 04.17 Réactiver (administration)

1. **Qui, où.** Admin `events.write` ou SUPERADMIN, fiche d'un événement Suspendu dont la fin n'est pas passée, bouton
   « Réactiver ».
2. **Ce qu'il saisit.** Confirmation « Réactiver l’événement ? » : « La page publique, la vente et le contrôle d’accès
   reprennent. L’organisateur et les détenteurs de billets sont prévenus. » (`app/admin/events/[id]/page.tsx:205-212`).
3. **Ce que fait le système.** Statut Publié ; message « Événement réactivé : la vente reprend. ». Les recettes gelées
   redeviennent retirables (04.16). Les rappels ne sont créés que dans les 15 minutes qui suivent leur échéance, sans
   rattrapage (voir 12) : un rappel dont l'échéance est tombée pendant la suspension ne part pas.
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Partenaire | SMS, cloche, push, email | indispensable | file | `EVENT_REACTIVATED` — SMS « Event Village : votre événement {titre, 30} est de nouveau en ligne. {lien}/partner/events » — ex. « Event Village : votre événement Concert Test est de nouveau en ligne. https://app.exemple.sn/partner/events » (107 car., 1 segment) ; cloche « Événement réactivé » / « « {titre} » est de nouveau en ligne. » |
   | Détenteurs | cloche, push, email ; pas de SMS | optionnel | file | `EVENT_REACTIVATED_HOLDER` : « Événement de nouveau en ligne » / « « {titre} » reprend comme prévu. Vos billets restent valables. » |
   | Contrôleurs affectés | cloche, email | indispensable | file | `CONTROLLER_EVENT_STATUS` : « Événement de nouveau en ligne » / « « {titre} » reprend : votre affectation est maintenue. » |

   Preuves : `M/20261109000009_lot9bis_messages.sql:198-221`, `lib/notifications/catalog.ts:817-822`, `:923-929`, `:1541-1552`.
5. **Ce que voient les autres rôles.** La fiche publique perd l'encadré ; le QR revient dans « Mes billets ».
6. **Refus.** Fin passée : « La fin de cet événement est passée : il ne peut plus être publié. » (et le bouton n'est plus
   proposé) ; partenaire suspendue : « Le partenaire est suspendu : son événement ne peut pas être remis en ligne avant
   sa réactivation. » (`M/20261109000008_lot9bis_cycle.sql:300-304`, `:337-339`, `:414`).
7. **Preuves et essai.** Recette : essai 70.

## 04.18 Clore un événement suspendu (administration)

1. **Qui, où.** Admin `events.write` ou SUPERADMIN, fiche d'un événement Suspendu **dont la fin est passée**, bouton
   « Clore l’événement » (`M/20261109000008_lot9bis_cycle.sql:203-205`, `:415`).
2. **Ce qu'il saisit.** Fenêtre titrée « Terminer l’événement ? », texte « La vente est close. Le contrôle des entrées
   reste possible jusqu’à la fermeture de la fenêtre de scan. », champ « Motif de la clôture » (obligatoire, 3 caractères
   au moins), aide « Au moins 3 caractères. Ce motif est communiqué à l’organisateur et reste dans l’historique. »,
   bouton « Clore l’événement » (`app/admin/events/[id]/page.tsx:219-225`, `:785-799`).
3. **Ce que fait le système.** Statut Terminé, sans annulation ni remboursement automatique ; message « Événement
   terminé. ». Les messages de changement et les rappels en attente sont annulés (`M/20261109000009_lot9bis_messages.sql:941-963`).
   Les recettes gelées pendant la suspension redeviennent retirables (`M/20261110000005_lot9ter_argent.sql:282-306`).
   L'événement étant Terminé, le contrôle des entrées redevient possible jusqu'à la fin + 6 h
   (`M/20261110000007_lot9ter_evenements.sql:138-143`) et le QR peut réapparaître dans « Mes billets » pendant ce temps
   (`M/20261109000008_lot9bis_cycle.sql:1817-1819`) (constat W4-05).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Détenteurs (billet valable ou utilisé) | SMS, cloche, push, email | indispensable | file | `EVENT_CLOSED_HOLDER` — SMS « Event Village : {titre, 30} est clos après sa suspension, sans annulation ni remboursement automatique. {lien}/tickets » — ex. 135 car., 1 segment ; cloche « Événement clos » / « « {titre} » est clos par l'équipe Event Village après sa suspension. Il n'est pas annulé : aucun remboursement automatique. » |
   | Partenaire | SMS, cloche, push, email | indispensable | file | `EVENT_CLOSED_BY_ADMIN` — SMS « Event Village : {titre, 30} est clos par l'équipe Event Village après sa suspension. Motif : {motif, 40}. » — ex. « Event Village : Concert Test est clos par l'équipe Event Village après sa suspension. Motif : Organisateur injoignable. » (119 car., 1 segment) ; cloche « Événement clos par l'administration » / « « {titre} » du {date} est clos par l'administration, sans annulation. Motif : {motif}. » |
   | Partenaire, si une caisse est encore ouverte | SMS, cloche, push, email | indispensable | file | `SHIFT_OPEN_AT_END` (texte en 04.21) |

   Preuves : `M/20261109000009_lot9bis_messages.sql:334-373`, `lib/notifications/catalog.ts:1398-1419`.
5. **Ce que voient les autres rôles.** Fiche publique : encadré « Événement terminé » : « Cet événement a eu lieu. La
   billetterie est fermée. » (`app/api/events/[id]/route.ts:23-26`), alors que les détenteurs lisent qu'il est clos sans
   avoir dit s'il a eu lieu (constat W4-04).
6. **Refus.** Fin pas encore passée : « L’événement n’est pas fini : réactivez-le ou annulez-le. »
   (`M/20261109000008_lot9bis_cycle.sql:340-344`) ; motif trop court (04.0).
7. **Preuves et essai.** Recette : essai 93 (`docs/recette-billetterie.md:1974-1990`).

## 04.19 Annuler : par la partenaire, par l'administration

1. **Qui, où.**
   - Partenaire : événement **Validé ou Publié** ; bouton « Annuler l’événement » de la carte ou du pilotage
     (`components/partner/events-list/PartnerEventCard.tsx:142-146`, `app/partner/events/[id]/page.tsx:222-226`). Elle ne
     peut pas annuler un Suspendu (`M/20261109000008_lot9bis_cycle.sql:207-209`).
   - Administration (`events.write`) : Validé, Publié ou Suspendu ; bouton « Annuler l’événement » de la fiche
     (`app/admin/events/[id]/page.tsx:547-551`).
2. **Ce qu'il saisit.** Fenêtre « Annuler l’événement ? » : « L’annulation est définitive : la vente s’arrête, les
   participants sont prévenus et les billets payés en ligne sont remboursés automatiquement. »
   (`components/events/EventCancelDialog.tsx:156-172`). Bloc « Impact de l’annulation » : « Acheteurs à prévenir »,
   « Billets payés en ligne », « Ventes au guichet » ({n} billets, {montant}), « Billets gratuits et invitations »,
   « Remboursement en ligne (automatique) », « Espèces à rembourser par l’organisateur (jamais par Event Village) », et
   s'il y en a « Paiements en cours (refusés puis remboursés) » (`:190-201`). Si l'événement a commencé : encadré
   « Annulation en cours d’événement » avec « L’événement a commencé : {n} billets déjà utilisés à l’entrée sont aussi
   remboursés, pour {montant}, compris dans le total ci-dessus. » (ou les formes « 1 billet… » et « aucun billet payé en
   ligne n’a encore été utilisé à l’entrée. Tous les billets payés en ligne sont remboursés. ») et case « J’ai compris »
   obligatoire (`:66-75`, `:203-217`). Champs :

   | Champ | Obligatoire | Limites, aide | Message d'erreur | Preuve |
   |---|---|---|---|---|
   | « Avis public aux participants » | oui | 10 à 2 000 caractères ; « Affiché sur la page de l’événement et envoyé aux acheteurs. Expliquez la raison et la suite (remboursement, report éventuel). » | « L’avis public doit contenir au moins 10 caractères. » | `components/events/EventCancelDialog.tsx:129`, `:220-232` |
   | « Motif interne » | oui | 3 à 2 000 caractères ; « Visible seulement de l’organisateur et de l’équipe Event Village, jamais publié. » | « Le motif interne doit contenir au moins 3 caractères. » | `:130`, `:233-245` |
   | « Pour confirmer, saisissez le titre exact de l’événement : « {titre} » » | oui | doit être identique au titre (espaces de bord ignorés) | « Le texte saisi ne correspond pas. » | `:168-169`, `components/ui/ConfirmDialog.tsx:65`, `:106-114` |

   Boutons « Confirmer l’annulation » (grisé tant que tout n'est pas rempli) et « Garder l’événement » (`:164-170`).
3. **Ce que fait le système.** En une seule opération : avis public et motif interne enregistrés, statut Annulé,
   transferts en attente révoqués, un remboursement créé par paiement en ligne, billets gratuits et invitations
   annulés, billets payés au guichet laissés au remboursement par la partenaire, plus aucun billet valable
   (`M/20261106000003_lot8_paiement.sql:266-414`). Puis les remboursements partent vers SamirPay ; le message affiché est
   « Événement annulé. {n} remboursement(s) envoyé(s)[, {m} en attente ou à vérifier]. » — ex. « Événement annulé. 3
   remboursement(s) envoyé(s), 1 en attente ou à vérifier. » (`lib/events/event-cancellation.service.ts:111-159`,
   `components/events/EventCancelDialog.tsx:145`). L'avancement des remboursements et les espèces à rendre sont décrits
   dans `08-argent.md`. Les messages de changement et les rappels en attente sont annulés
   (`M/20261109000009_lot9bis_messages.sql:941-963`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Détenteurs et acheteurs d'origine (compte) | SMS, cloche, email, push | indispensable | file | `EVENT_CANCELLED` — SMS « Event Village : {titre, 30} du {date} est annulé. » + selon le cas « Remboursement automatique en cours. {lien}/tickets » (acheteur en ligne), « Remboursement à l'acheteur d'origine. {lien}/tickets » (billet reçu d'un autre), « Remboursement par l'organisateur. {lien}/tickets » (guichet), « Détails : {lien}/tickets » (gratuit, invitation) — ex. « Event Village : Concert Test du sam. 5 déc. à 20:00 est annulé. Remboursement automatique en cours. https://app.exemple.sn/tickets » (130 car., 1 segment) ; cloche « Événement annulé » / « « {titre} » du {date} est annulé. {avis public}. {Votre remboursement est en cours. / Le remboursement se fait auprès de l'organisateur. / Le remboursement va à l'acheteur d'origine du billet.} » |
   | Numéros sans compte (invitation non réclamée, acheteur au guichet, destinataire d'un transfert révoqué) | SMS, sans lien | indispensable | file | « Event Village : {titre, 30} du {date} est annulé. Remboursement par l'organisateur. » (guichet, ex. 97 car.) ou « … est annulé. Le billet qui vous était destiné n'est plus valable. » (ex. 116 car.) |
   | Partenaire (annulation par l'administration) | SMS, cloche, email | indispensable | file | `EVENT_CANCELLED_BY_ADMIN` — SMS « Event Village : {titre, 25} annulé par l'administration. Motif : {avis public, 35}. {lien}/partner/events » (ex. 140 car.) ; cloche « Événement annulé par l'administration » / « « {titre} » du {date} est annulé par l'administration. Motif : {avis public}. Les remboursements en ligne sont lancés : suivez-les dans l'onglet Clôture. » (jamais le motif interne) |
   | Admins `events.read` et SUPERADMIN (annulation par la partenaire) | cloche, email | indispensable | file | `ADMIN_EVENT_CANCELLED` : « Événement annulé par l'organisateur » / « « {titre} » de {société} est annulé par l'organisateur. Motif interne : {motif}. » |
   | Contrôleurs affectés | SMS, cloche, email | indispensable | file | `CONTROLLER_EVENT_CANCELLED` — SMS « Event Village : {titre, 30} du {date} est annulé. Votre affectation à l'entrée est retirée. » (ex. 105 car.) ; cloche « Contrôle annulé » |
   | Acheteurs remboursés | SMS, cloche, email, push | indispensable | au versement | `REFUND_PAID` (voir 08) |

   Preuves : `M/20261109000009_lot9bis_messages.sql:223-332`, `lib/notifications/catalog.ts:777-810`, `:1491-1531`.
5. **Ce que voient les autres rôles.** Fiche publique : encadré « Événement annulé » avec l'avis public (à défaut :
   « Cet événement n’aura pas lieu. Les billets payés en ligne sont remboursés automatiquement. ») et « Les billets payés
   en ligne sont remboursés automatiquement sur le compte Mobile Money utilisé pour l’achat, frais de service compris.
   Les billets réglés en espèces sont remboursés par l’organisateur. » (`app/api/events/[id]/route.ts:19-30`,
   `:158-174`). Fiche admin : encadré « Événement annulé » avec « Avis public : », « Motif interne : » et « Annulé le
   {date}. » (`app/admin/events/[id]/page.tsx:581-591`). Pilotage : avancement des remboursements et liste des espèces
   (`app/partner/events/[id]/page.tsx:252-253`).
6. **Refus.** Titre différent : « Le titre saisi ne correspond pas au titre de l'événement. » ; avis trop court :
   « L'avis public doit comporter au moins 10 caractères. » ; motif trop court : « Le motif interne doit comporter au
   moins 3 caractères. » ; déjà annulé : « Cet événement est déjà annulé. » ; autre statut : « Un événement « {statut} »
   ne peut pas être annulé. » (`M/20261106000003_lot8_paiement.sql:316-332`) ; requête incomplète : « Données invalides :
   avis public, motif interne et titre retapé sont obligatoires. » (`app/api/partner/events/[id]/cancel/route.ts:38-44`) ;
   panne : « Annulation impossible pour le moment. » (`:51-52`). Impact illisible : « Lecture de l’impact de l’annulation
   impossible. » ; événement déjà annulé : « Cet événement est déjà annulé : l’avancement des remboursements est affiché
   sur sa page. » (`components/events/EventCancelDialog.tsx:98-115`). Erreur d'envoi : encadré « L’annulation n’a pas
   abouti » (`:246-250`).
7. **Preuves et essai.** Recette : essais 44, 45, 46 (`docs/recette-billetterie.md:1064-1116`).

## 04.20 Terminer à la main (administration)

1. **Qui, où.** Admin `events.write` ou SUPERADMIN, fiche d'un événement Publié, bouton « Terminer ».
2. **Ce qu'il saisit.** Confirmation « Terminer l’événement ? » : « La vente est close. Le contrôle des entrées reste
   possible jusqu’à la fermeture de la fenêtre de scan. » (`app/admin/events/[id]/page.tsx:219-225`).
3. **Ce que fait le système.** Statut Terminé ; message « Événement terminé. ». La vente s'arrête (seul un Publié se
   vend) ; le contrôle reste ouvert jusqu'à fin + 6 h (`M/20261110000007_lot9ter_evenements.sql:138-143`).
4. **Messages envoyés.** Comme la fin automatique (04.21) : `EVENT_FINISHED` ou `SHIFT_OPEN_AT_END` à la partenaire ;
   rien aux détenteurs (`M/20261109000009_lot9bis_messages.sql:334-344`).
5. **Ce que voient les autres rôles.** Fiche publique « Événement terminé ».
6. **Refus.** Événement pas commencé : « Un événement qui n'a pas commencé ne se termine pas : suspendez-le ou
   annulez-le. » (`M/20261109000008_lot9bis_cycle.sql:345-348`). Le bouton est pourtant proposé avant le début (constat
   W4-06).
7. **Preuves.** Fichiers cités.

## 04.21 Fin automatique : passage à Terminé

1. **Qui, où.** Personne : la tâche planifiée `ev_events_finish` (toutes les 15 minutes, voir `12-taches-planifiees.md`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Chaque passage prend, par lots de 200 (10 lots au plus), les événements **Publiés** ou
   **Validés** dont la fin (04.0) est passée, et les passe à Terminé, acteur « Automatique », canal « Fin automatique »
   (`app/api/cron/events-finish/route.ts:17-33`, `M/20261110000007_lot9ter_evenements.sql:80-114`,
   `app/admin/events/[id]/page.tsx:146-157`). Un événement **Validé jamais publié** est marqué « terminé sans
   publication » avant le passage : il n'est jamais public ni contrôlable, même Terminé
   (`M/20261110000007_lot9ter_evenements.sql:35-37`, `:102-106`, `:134-139`), et la fiche admin n'a pas de lien « Page
   publique » (`app/admin/events/[id]/page.tsx:477`, `:559-563`). Retard possible : jusqu'à 15 minutes après la fin ;
   pendant ce temps la vente est déjà refusée (« Cet événement est terminé. », `M/20261106000001_lot8_canaux.sql:240-241`).
   Les messages de changement et les rappels en attente sont annulés (`M/20261109000009_lot9bis_messages.sql:941-963`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Partenaire (depuis Publié, aucune caisse ouverte) | cloche, email | indispensable | file | `EVENT_FINISHED` : « Événement terminé » / « « {titre} » est terminé. Le rapport de clôture est prêt dans l'onglet Clôture. » |
   | Partenaire (au moins une caisse ouverte, à la place du précédent) | SMS, cloche, push, email | indispensable | file | `SHIFT_OPEN_AT_END` — SMS « Event Village : {titre, 25} est terminé et 1 caisse reste ouverte. Fermez-la dans le pilotage : {lien}/partner/events » (ex. 134 car.) ou « … et {n} caisses restent ouvertes. Fermez-les dans le pilotage : … » (ex. 139 car.) ; cloche « Caisse encore ouverte » / « « {titre} » est terminé et 1 caisse reste ouverte. Fermez-la dans l'onglet Caisse du pilotage. » |
   | Partenaire, à la fermeture de la dernière caisse | cloche, email | indispensable | file | `CLOSING_REPORT_READY` : « Rapport de clôture prêt » / « Toutes les caisses de « {titre} » sont fermées : le rapport de clôture est prêt. » |
   | Partenaire, quand toutes les recettes en ligne sont disponibles (une fois, dans les 30 jours après la fin) | cloche, email | indispensable | contrôle du jour de l'envoyeur | `FUNDS_AVAILABLE` : « Recettes disponibles » / « Les recettes de « {titre} » sont disponibles sur votre solde : vous pouvez demander un retrait. » |
   | Validé jamais publié | — | — | — | **aucun message** |

   Preuves : `M/20261109000009_lot9bis_messages.sql:334-373`, `:1342-1364`, `lib/notifications/catalog.ts:1420-1437`,
   `:1620-1640` ; aucun message aux détenteurs à la fin.
5. **Ce que voient les autres rôles.** Fiche publique « Événement terminé » : « Cet événement a eu lieu. La billetterie
   est fermée. » ; « Mes billets » : « Événement terminé. » une fois le QR masqué (`M/20261109000008_lot9bis_cycle.sql:1814`).
   Une liste ouverte se recharge en direct (`app/partner/events/page.tsx:131-135`, `app/admin/events/page.tsx:165-171`).
6. **Refus.** Sans objet. Si la tâche ne tourne pas : l'événement reste affiché « Publié » ou « Validé », sans message
   de fin ; la vente est refusée quand même (voir 12).
7. **Preuves et essai.** Recette : essais 71 et 92 (`docs/recette-billetterie.md:1543-1558`, `:1956-1972`).

## 04.22 Suspension et réactivation d'une partenaire : effet sur ses événements

1. **Qui, où.** Administration, suspension ou réactivation d'une partenaire (écran et texte : `03-partenaire.md`).
2. **Ce qu'il saisit.** Voir 03.
3. **Ce que fait le système.** À la suspension, chacun de ses événements **Publiés** passe Suspendu, motif
   « Organisateur suspendu », rôle Administration ; ses Validés ne changent pas mais ne peuvent plus être publiés
   (`M/20261109000006_lot9bis_argent.sql:859-874`, `M/20261109000008_lot9bis_cycle.sql:300-304`). À la réactivation,
   chaque événement suspendu par cette cascade **et resté intact** (aucun autre changement de statut depuis) et dont la fin
   n'est pas passée redevient Publié, motif « Organisateur réactivé » ; les autres restent Suspendus (`:875-905`).
4. **Messages envoyés.** Pas d'avis par événement à la partenaire (elle reçoit celui de son compte) ; détenteurs et
   contrôleurs reçoivent les avis de 04.16 et 04.17 (`M/20261109000009_lot9bis_messages.sql:55-58`, `:171-221`).
5. **Ce que voient les autres rôles.** Comme 04.16 et 04.17.
6. **Refus.** Voir 03.
7. **Preuves et essai.** Recette : essai 55 (`docs/recette-billetterie.md:1256-1272`).

## 04.23 Rapport de clôture et export des participants

1. **Qui, où.** Partenaire (ou admin `events.read`, par « Ouvrir le pilotage », `app/admin/events/[id]/page.tsx:554-558`),
   pilotage `/partner/events/{id}`, onglet « Clôture » (`app/partner/events/[id]/page.tsx:51-61`, `:264`). Aussi :
   tableau de bord partenaire, colonne « Rapports », bouton « Clôture » qui ouvre la fenêtre « Rapport de clôture »,
   avec « Export CSV / Excel » et « Télécharger le PDF » (`app/partner/dashboard/page.tsx:371-386`, `:680`,
   `components/partner/ClosingReportModal.tsx:28-41`, `:148-185`). Le pilotage n'est pas proposé sur la carte d'un
   Brouillon ou d'un « En attente » (`components/partner/events-list/PartnerEventCard.tsx:46-47`, `:132-136`).
2. **Ce qu'il saisit.** Pour l'export : case « Inclure le téléphone et l’email des participants » (« Seulement pour
   l’une des finalités ci-dessous. L’export et sa finalité sont journalisés. ») ; si cochée, « Finalité de l’export » :
   « Prévenir les participants d’un changement urgent (horaire, lieu, annulation) » ou « Sécurité et accueil des
   participants le jour de l’événement » ; bouton « Exporter les participants » (`components/partner/pilotage/ClosingTab.tsx:21-24`,
   `:194-257`). Sans finalité : « Choisissez la finalité de l’export des contacts. » (`:234-238`).
3. **Ce que fait le système.**
   - **Rapport** (le même partout, `components/partner/pilotage/ClosingReportSummary.tsx:9-13`) : « Montant net
     organisateur » (« Ventes en ligne, remboursements déduits »), « Disponibilité des fonds » (date, ou « Aucune vente en
     ligne »), « Absents » (« Billets valides jamais scannés à l’entrée ») ; bloc « Rapport de clôture » : « Billets vendus
     (hors invitations) », « Invitations », « Capacité mise en vente », « Entrées (dont guichet) », « Refus au contrôle »,
     « Recettes en ligne », « Recettes en espèces », « Remboursé », « Frais de service payés par les acheteurs », « Déjà
     disponible / en attente » ; bloc « Entrées » (`:20-57`). Formules des montants : `08-argent.md`.
   - « Z de caisse » : une fiche par caisse (fonds, attendu, déclaré, écart, co-signature, détail) (`components/partner/pilotage/ClosingTab.tsx:40-82`,
     `:163-173`) ; voir 05.
   - « Absents » : le nombre en direct ; la liste nominative seulement après la fin (« La liste nominative est disponible
     après la fin de l’événement ; le nombre est tenu à jour en direct. ») (`components/partner/pilotage/ClosingTab.tsx:175-192`,
     `M/20261110000010_lot9ter_pilotage.sql:793-807`).
   - **Export** : fichier CSV (UTF-8, séparateur « ; ») nommé `participants-<titre>-<AAAA-MM-JJ>.csv`, colonnes « Nom »,
     « Catégorie », « Origine », « Statut du billet », « Heure d’entrée », « Zone », « Porte », et avec contacts
     « Téléphone », « E-mail » ; billets valables et utilisés, invitations comprises ; aucune donnée de paiement ni numéro
     de billet (`lib/events/pilotage.service.ts:193-219`, `M/20261110000010_lot9ter_pilotage.sql:1012-1043`). Chaque export
     est journalisé (qui, contacts, finalité, nombre de lignes) avant la remise du fichier
     (`M/20261110000010_lot9ter_pilotage.sql:1045-1047`). Message « Export téléchargé. Il est enregistré dans le journal des
     exports. » (`components/partner/pilotage/ClosingTab.tsx:136`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** L'administration voit le même onglet par le pilotage.
6. **Refus.** Finalité absente côté serveur : « Pour exporter le téléphone et l’email, choisissez une finalité :
   information urgente sur l’événement, ou sécurité et accueil. » ; admin sans `partners.read` qui demande les contacts :
   « Action non autorisée : votre compte n’a pas la permission « Consulter les partenaires et leurs contacts ». »
   (`M/20261110000010_lot9ter_pilotage.sql:983-1004`) ; réseau : « Connexion impossible. Vérifiez votre réseau, puis
   réessayez. » ; autre : encadré « L’export n’a pas abouti » (`components/partner/pilotage/ClosingTab.tsx:122-125`,
   `:242-246`). Rapport indisponible : « Clôture indisponible » (onglet), « Rapport de clôture indisponible » / « Le rapport
   n’a pas pu être préparé. Vérifiez votre connexion, puis réessayez. » (fenêtre) (`components/partner/pilotage/ClosingTab.tsx:153-155`,
   `components/partner/ClosingReportModal.tsx:189-195`).
7. **Preuves et essai.** Recette : essais 40 et 41 (`docs/recette-billetterie.md:993-1024`).
