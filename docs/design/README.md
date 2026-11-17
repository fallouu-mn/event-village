# Design, phase 0 : identité, direction, maquettes

Aucun changement de l'application : uniquement des fichiers neufs sous `docs/design/`.

- `logo/index.html` : trois directions de logo (recommandation : « Repère »), en clair et en sombre, de 16 à
  512 px et en situation.
- `direction.md` : principes, jetons et contrastes mesurés, typographie, animations, composants, règle des retours
  des actions, plan page par page, performance, points à trancher.
- `maquettes/` : accueil, fiche d'un événement, carte, retours des actions. Pages autonomes, à ouvrir dans un
  navigateur depuis le dépôt ; bascules en bas à droite, ou dans l'adresse : `?theme=clair` ou `sombre`,
  `&boutons=a` ou `b`.
- `retours-actions.md` : les 160 actions de l'application, leur retour aujourd'hui et ce qu'il faudra.
- `captures/` : `{page}__{largeur}__{thème}__{boutons}.jpg`, 390 px (densité 2) et 1 440 px.

Aucun CDN, aucune image externe, aucune police chargée d'Internet : la police est celle de l'application
(`app/fonts/`). Données fictives : artistes, organisateurs et événements inventés.
