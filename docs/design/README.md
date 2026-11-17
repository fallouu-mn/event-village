# Design, phase 0 : identité, direction, maquettes

Aucun changement de l'application : uniquement des fichiers neufs sous `docs/design/`.

- `logo/index.html` : logo retenu « Bras levés » et ses fichiers (favicon, icônes, image de partage), de 16 à
  512 px, en clair, en sombre et en situation ; repères de carte « Repère ».
- `direction.md` : principes, jetons et contrastes mesurés, typographie, animations, composants, règle des retours
  des actions, plan page par page, performance, décisions prises (section 9).
- `maquettes/` : accueil, fiche d'un événement, carte, retours des actions. Pages autonomes, à ouvrir dans un
  navigateur depuis le dépôt ; thème du système par défaut, bascule en bas à droite (mémorisée), ou `?theme=clair` ou `sombre`
  dans l'adresse.
- `retours-actions.md` : les 160 actions de l'application, leur retour aujourd'hui et ce qu'il faudra.
- `captures/` : `{page}__{largeur}__{thème}.jpg`, 390 px (densité 2) et 1 440 px ; boutons B en clair, A en sombre.

Aucun CDN, aucune image externe, aucune police chargée d'Internet : la police est celle de l'application
(`app/fonts/`). Données fictives : artistes, organisateurs et événements inventés.
