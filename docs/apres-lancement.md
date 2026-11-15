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
