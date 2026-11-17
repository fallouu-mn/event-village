# Direction visuelle — Event Village

> Design, phase 0 (branche `design-0/identite`, partie de `main` à `fdaa6c365`). **Aucun changement de
> l'application** : ce document, les jetons (`jetons.css`), les composants (`composants.css`), les logos (`logo/`)
> et les maquettes (`maquettes/`) servent de référence pour les lots qui suivront. La charte retenue
> (`docs/design/stitch/charte-faciloop.md`, commit `7a3b831a9` sur `lot9quinquies/authentification`) fait foi pour
> les couleurs ; les maquettes Stitch ne sont qu'une inspiration : aucun de leurs chiffres ni de leurs promesses
> (« #1 », « 45 000 festivaliers », « 0 % frais »…) n'est repris.

## 1. Principes

1. **Fluide** : rien ne saute pendant le chargement (place réservée, squelettes à la taille du contenu) ; une action
   répond à l'écran tout de suite, même si le serveur met plus longtemps.
2. **Rapide** : l'essentiel s'affiche en moins de 2,5 s sur un Android moyen en 4G (section 8).
3. **Clair** : une page, un but ; un seul grand bouton en dégradé par page ; la couleur ne porte jamais seule
   l'information (libellé ou icône en plus).
4. **Professionnel** : mêmes composants partout, mêmes mots pour les mêmes choses (glossaire), alignements nets.
5. **Français simple** : phrases courtes, verbes d'action sur les boutons (« Choisir mes billets »,
   « Rembourser 10 000 F CFA »), jamais de code technique.
6. **Aucune promesse fausse** : pas de classement, de nombre de clients, de note ni de « 0 % de frais » ; les frais
   s'affichent avant le paiement ; « Dernières places » seulement quand c'est vrai.

## 2. Couleurs et jetons

Source unique : `docs/design/jetons.css`. Noms de la charte (classes sémantiques `bg-background`,
`text-foreground`, `bg-card`, `border-border`, `bg-primary`…). Le thème suit le téléphone tant que la personne n'a
rien choisi.

| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `background` | `#FFFFFF` | `#121212` | fond de page |
| `foreground` | `#3A3A3A` | `#F2F2F2` | texte courant |
| `foreground-strong` | `#1A1A1A` | `#FFFFFF` | titres, montants |
| `card` | `#FFFFFF` | `#1A1A1A` | cartes, panneaux |
| `popover` | `#FFFFFF` | `#222222` | fenêtres, toasts, feuille glissante (avec ombre) |
| `muted` | `#F5F5F5` | `#262626` | puits, filtres, squelettes |
| `muted-foreground` | `#666666` | `#A6A6A6` | texte secondaire |
| `border` | `#E6E6E6` | `#333333` | séparations décoratives |
| `input` | `#858585` | `#7A7A7A` | bord des champs et des cases (≥ 3:1) |
| `ring` | `#C2410C` | `#FF8A3D` | anneau de focus |
| `primary` (A) | `#FF8A3D` | `#FF8A3D` | bouton principal, version A |
| `primary-foreground` (A) | `#1A1A1A` | `#1A1A1A` | texte du bouton A (le blanc y est interdit : 2,35:1) |
| `primary` (B) | `#C2410C` | `#C2410C` | bouton principal, version B (celle de l'application aujourd'hui) |
| `primary-foreground` (B) | `#FFFFFF` | `#FFFFFF` | texte du bouton B |
| `primary-text` | `#C2410C` | `#FF8A3D` | orange en texte, liens, onglet actif |
| `primary-soft` | `#FFF1E7` | `#2B1A10` | fond teinté (onglet actif, pastille d'icône) |
| `accent-text` | `#BE185D` | `#F472B6` | rose en texte (rare) |
| `gradient-from` → `gradient-to` | `#EA580C` → `#DB2777` | idem | grand bouton, un seul par page |
| `success`, `warning`, `danger`, `info` (+ `-soft`, `-text`, `-border`), `on-tone` | valeurs actuelles de `design-system/event-village/MASTER.md` | idem | états |

**Boutons.**
- **Version A** : orange vif `#FF8A3D`, texte `#1A1A1A`, survol `#FF7A21`.
- **Version B** : orange profond `#C2410C`, texte blanc, survol `#9A3412`.
- **Grand bouton** : dégradé `#EA580C` → `#DB2777`, texte blanc gras de 19 px, en pilule, ombre rose douce, **un seul
  par page** (l'action qui fait avancer : « Choisir mes billets », « Acheter (2) »). Son contraste (3,56:1 au pire
  point) n'est conforme que parce que le texte est gras et fait 19 px (« grand texte » du WCAG) : ne jamais l'écrire
  plus petit.

### Contrastes mesurés

Calculés par `node docs/design/outils/contraste.mjs`, qui lit `jetons.css` et réécrit ce tableau (WCAG 2.x ;
4,5:1 pour un texte, 3:1 pour un grand texte ou un élément d'interface). Le script s'arrête en erreur si un couple
obligatoire passe sous son seuil. Résultat : **96 couples, aucun sous le seuil**.

<!-- contraste:debut -->
| Couple | Thème, boutons | Texte | Fond | Contraste | Seuil | Conforme |
|---|---|---|---|---|---|---|
| Texte courant | clair A | `--foreground` #3A3A3A | `--background` #FFFFFF | **11,37:1** | 4,50:1 | oui |
| Texte courant | clair A | `--foreground` #3A3A3A | `--card` #FFFFFF | **11,37:1** | 4,50:1 | oui |
| Texte courant | clair A | `--foreground` #3A3A3A | `--muted` #F5F5F5 | **10,43:1** | 4,50:1 | oui |
| Texte courant | clair A | `--foreground` #3A3A3A | `--popover` #FFFFFF | **11,37:1** | 4,50:1 | oui |
| Titres, montants | clair A | `--foreground-strong` #1A1A1A | `--background` #FFFFFF | **17,40:1** | 4,50:1 | oui |
| Titres, montants | clair A | `--foreground-strong` #1A1A1A | `--card` #FFFFFF | **17,40:1** | 4,50:1 | oui |
| Titres, montants | clair A | `--foreground-strong` #1A1A1A | `--popover` #FFFFFF | **17,40:1** | 4,50:1 | oui |
| Texte secondaire | clair A | `--muted-foreground` #666666 | `--background` #FFFFFF | **5,74:1** | 4,50:1 | oui |
| Texte secondaire | clair A | `--muted-foreground` #666666 | `--card` #FFFFFF | **5,74:1** | 4,50:1 | oui |
| Texte secondaire | clair A | `--muted-foreground` #666666 | `--muted` #F5F5F5 | **5,27:1** | 4,50:1 | oui |
| Texte secondaire | clair A | `--muted-foreground` #666666 | `--popover` #FFFFFF | **5,74:1** | 4,50:1 | oui |
| Orange en texte, liens | clair A | `--primary-text` #C2410C | `--background` #FFFFFF | **5,18:1** | 4,50:1 | oui |
| Orange en texte, liens | clair A | `--primary-text` #C2410C | `--card` #FFFFFF | **5,18:1** | 4,50:1 | oui |
| Orange en texte, liens | clair A | `--primary-text` #C2410C | `--muted` #F5F5F5 | **4,75:1** | 4,50:1 | oui |
| Orange en texte, liens | clair A | `--primary-text` #C2410C | `--primary-soft` #FFF1E7 | **4,68:1** | 4,50:1 | oui |
| Rose en texte | clair A | `--accent-text` #BE185D | `--background` #FFFFFF | **6,04:1** | 4,50:1 | oui |
| Rose en texte | clair A | `--accent-text` #BE185D | `--card` #FFFFFF | **6,04:1** | 4,50:1 | oui |
| Succès (pastille, bandeau) | clair A | `--success-text` #166534 | `--success-soft` #F0FDF4 | **6,81:1** | 4,50:1 | oui |
| Attention | clair A | `--warning-text` #92400E | `--warning-soft` #FFFBEB | **6,84:1** | 4,50:1 | oui |
| Erreur | clair A | `--danger-text` #991B1B | `--danger-soft` #FEF2F2 | **7,60:1** | 4,50:1 | oui |
| Erreur | clair A | `--danger-text` #991B1B | `--background` #FFFFFF | **8,31:1** | 4,50:1 | oui |
| Erreur | clair A | `--danger-text` #991B1B | `--card` #FFFFFF | **8,31:1** | 4,50:1 | oui |
| Information | clair A | `--info-text` #075985 | `--info-soft` #F0F9FF | **7,09:1** | 4,50:1 | oui |
| Texte sur un ton plein | clair A | `--on-tone` #FFFFFF | `--success` #15803D | **5,02:1** | 4,50:1 | oui |
| Texte sur un ton plein | clair A | `--on-tone` #FFFFFF | `--warning` #B45309 | **5,02:1** | 4,50:1 | oui |
| Texte sur un ton plein | clair A | `--on-tone` #FFFFFF | `--danger` #B91C1C | **6,47:1** | 4,50:1 | oui |
| Texte sur un ton plein | clair A | `--on-tone` #FFFFFF | `--info` #0369A1 | **5,93:1** | 4,50:1 | oui |
| Texte du bouton principal | clair A | `--primary-foreground` #1A1A1A | `--primary` #FF8A3D | **7,42:1** | 4,50:1 | oui |
| Texte du bouton principal | clair A | `--primary-foreground` #1A1A1A | `--primary-hover` #FF7A21 | **6,68:1** | 4,50:1 | oui |
| Bouton Wave | clair A | `--on-op` #000000 | `--op-wave` #1DC8F2 | **10,60:1** | 4,50:1 | oui |
| Bouton Orange Money | clair A | `--on-op` #000000 | `--op-orange-money` #FF7900 | **7,99:1** | 4,50:1 | oui |
| Bord des champs | clair A | `--input` #858585 | `--background` #FFFFFF | **3,69:1** | 3,00:1 | oui |
| Bord des champs | clair A | `--input` #858585 | `--card` #FFFFFF | **3,69:1** | 3,00:1 | oui |
| Anneau de focus | clair A | `--ring` #C2410C | `--background` #FFFFFF | **5,18:1** | 3,00:1 | oui |
| Anneau de focus | clair A | `--ring` #C2410C | `--card` #FFFFFF | **5,18:1** | 3,00:1 | oui |
| Anneau de focus | clair A | `--ring` #C2410C | `--muted` #F5F5F5 | **4,75:1** | 3,00:1 | oui |
| Bord du bouton principal sur le fond | clair A | `--primary` #FF8A3D | `--background` #FFFFFF | **2,35:1** | — | peu visible : le texte identifie le bouton |
| Bord du bouton principal sur le fond | clair A | `--primary` #FF8A3D | `--card` #FFFFFF | **2,35:1** | — | peu visible : le texte identifie le bouton |
| Texte courant | sombre A | `--foreground` #F2F2F2 | `--background` #121212 | **16,73:1** | 4,50:1 | oui |
| Texte courant | sombre A | `--foreground` #F2F2F2 | `--card` #1A1A1A | **15,55:1** | 4,50:1 | oui |
| Texte courant | sombre A | `--foreground` #F2F2F2 | `--muted` #262626 | **13,52:1** | 4,50:1 | oui |
| Texte courant | sombre A | `--foreground` #F2F2F2 | `--popover` #222222 | **14,21:1** | 4,50:1 | oui |
| Titres, montants | sombre A | `--foreground-strong` #FFFFFF | `--background` #121212 | **18,73:1** | 4,50:1 | oui |
| Titres, montants | sombre A | `--foreground-strong` #FFFFFF | `--card` #1A1A1A | **17,40:1** | 4,50:1 | oui |
| Titres, montants | sombre A | `--foreground-strong` #FFFFFF | `--popover` #222222 | **15,91:1** | 4,50:1 | oui |
| Texte secondaire | sombre A | `--muted-foreground` #A6A6A6 | `--background` #121212 | **7,70:1** | 4,50:1 | oui |
| Texte secondaire | sombre A | `--muted-foreground` #A6A6A6 | `--card` #1A1A1A | **7,15:1** | 4,50:1 | oui |
| Texte secondaire | sombre A | `--muted-foreground` #A6A6A6 | `--muted` #262626 | **6,22:1** | 4,50:1 | oui |
| Texte secondaire | sombre A | `--muted-foreground` #A6A6A6 | `--popover` #222222 | **6,54:1** | 4,50:1 | oui |
| Orange en texte, liens | sombre A | `--primary-text` #FF8A3D | `--background` #121212 | **7,99:1** | 4,50:1 | oui |
| Orange en texte, liens | sombre A | `--primary-text` #FF8A3D | `--card` #1A1A1A | **7,42:1** | 4,50:1 | oui |
| Orange en texte, liens | sombre A | `--primary-text` #FF8A3D | `--muted` #262626 | **6,45:1** | 4,50:1 | oui |
| Orange en texte, liens | sombre A | `--primary-text` #FF8A3D | `--primary-soft` #2B1A10 | **7,12:1** | 4,50:1 | oui |
| Rose en texte | sombre A | `--accent-text` #F472B6 | `--background` #121212 | **7,07:1** | 4,50:1 | oui |
| Rose en texte | sombre A | `--accent-text` #F472B6 | `--card` #1A1A1A | **6,57:1** | 4,50:1 | oui |
| Succès (pastille, bandeau) | sombre A | `--success-text` #4ADE80 | `--success-soft` #0B2A17 | **8,88:1** | 4,50:1 | oui |
| Attention | sombre A | `--warning-text` #FBBF24 | `--warning-soft` #2B1D07 | **9,82:1** | 4,50:1 | oui |
| Erreur | sombre A | `--danger-text` #F87171 | `--danger-soft` #2D0F0F | **6,40:1** | 4,50:1 | oui |
| Erreur | sombre A | `--danger-text` #F87171 | `--background` #121212 | **6,77:1** | 4,50:1 | oui |
| Erreur | sombre A | `--danger-text` #F87171 | `--card` #1A1A1A | **6,29:1** | 4,50:1 | oui |
| Information | sombre A | `--info-text` #38BDF8 | `--info-soft` #0A2233 | **7,60:1** | 4,50:1 | oui |
| Texte sur un ton plein | sombre A | `--on-tone` #FFFFFF | `--success` #15803D | **5,02:1** | 4,50:1 | oui |
| Texte sur un ton plein | sombre A | `--on-tone` #FFFFFF | `--warning` #B45309 | **5,02:1** | 4,50:1 | oui |
| Texte sur un ton plein | sombre A | `--on-tone` #FFFFFF | `--danger` #B91C1C | **6,47:1** | 4,50:1 | oui |
| Texte sur un ton plein | sombre A | `--on-tone` #FFFFFF | `--info` #0369A1 | **5,93:1** | 4,50:1 | oui |
| Texte du bouton principal | sombre A | `--primary-foreground` #1A1A1A | `--primary` #FF8A3D | **7,42:1** | 4,50:1 | oui |
| Texte du bouton principal | sombre A | `--primary-foreground` #1A1A1A | `--primary-hover` #FF7A21 | **6,68:1** | 4,50:1 | oui |
| Bouton Wave | sombre A | `--on-op` #000000 | `--op-wave` #1DC8F2 | **10,60:1** | 4,50:1 | oui |
| Bouton Orange Money | sombre A | `--on-op` #000000 | `--op-orange-money` #FF7900 | **7,99:1** | 4,50:1 | oui |
| Bord des champs | sombre A | `--input` #7A7A7A | `--background` #121212 | **4,36:1** | 3,00:1 | oui |
| Bord des champs | sombre A | `--input` #7A7A7A | `--card` #1A1A1A | **4,05:1** | 3,00:1 | oui |
| Anneau de focus | sombre A | `--ring` #FF8A3D | `--background` #121212 | **7,99:1** | 3,00:1 | oui |
| Anneau de focus | sombre A | `--ring` #FF8A3D | `--card` #1A1A1A | **7,42:1** | 3,00:1 | oui |
| Anneau de focus | sombre A | `--ring` #FF8A3D | `--muted` #262626 | **6,45:1** | 3,00:1 | oui |
| Bord du bouton principal sur le fond | sombre A | `--primary` #FF8A3D | `--background` #121212 | **7,99:1** | — | visible |
| Bord du bouton principal sur le fond | sombre A | `--primary` #FF8A3D | `--card` #1A1A1A | **7,42:1** | — | visible |
| Orange en texte, liens | clair B | `--primary-text` #C2410C | `--background` #FFFFFF | **5,18:1** | 4,50:1 | oui |
| Orange en texte, liens | clair B | `--primary-text` #C2410C | `--card` #FFFFFF | **5,18:1** | 4,50:1 | oui |
| Orange en texte, liens | clair B | `--primary-text` #C2410C | `--muted` #F5F5F5 | **4,75:1** | 4,50:1 | oui |
| Orange en texte, liens | clair B | `--primary-text` #C2410C | `--primary-soft` #FFF1E7 | **4,68:1** | 4,50:1 | oui |
| Texte du bouton principal | clair B | `--primary-foreground` #FFFFFF | `--primary` #C2410C | **5,18:1** | 4,50:1 | oui |
| Texte du bouton principal | clair B | `--primary-foreground` #FFFFFF | `--primary-hover` #9A3412 | **7,31:1** | 4,50:1 | oui |
| Bord du bouton principal sur le fond | clair B | `--primary` #C2410C | `--background` #FFFFFF | **5,18:1** | — | visible |
| Bord du bouton principal sur le fond | clair B | `--primary` #C2410C | `--card` #FFFFFF | **5,18:1** | — | visible |
| Orange en texte, liens | sombre B | `--primary-text` #FF8A3D | `--background` #121212 | **7,99:1** | 4,50:1 | oui |
| Orange en texte, liens | sombre B | `--primary-text` #FF8A3D | `--card` #1A1A1A | **7,42:1** | 4,50:1 | oui |
| Orange en texte, liens | sombre B | `--primary-text` #FF8A3D | `--muted` #262626 | **6,45:1** | 4,50:1 | oui |
| Orange en texte, liens | sombre B | `--primary-text` #FF8A3D | `--primary-soft` #2B1A10 | **7,12:1** | 4,50:1 | oui |
| Texte du bouton principal | sombre B | `--primary-foreground` #FFFFFF | `--primary` #C2410C | **5,18:1** | 4,50:1 | oui |
| Texte du bouton principal | sombre B | `--primary-foreground` #FFFFFF | `--primary-hover` #9A3412 | **7,31:1** | 4,50:1 | oui |
| Bord du bouton principal sur le fond | sombre B | `--primary` #C2410C | `--background` #121212 | **3,62:1** | — | visible |
| Bord du bouton principal sur le fond | sombre B | `--primary` #C2410C | `--card` #1A1A1A | **3,36:1** | — | visible |
| Grand bouton en dégradé (blanc gras 19 px) | clair | `--gradient-foreground` #FFFFFF | dégradé #EA580C → #DB2777, pire point #EA580C | **3,56:1** | 3,00:1 | oui (grand texte) |
| Grand bouton en dégradé (blanc gras 19 px) | sombre | `--gradient-foreground` #FFFFFF | dégradé #EA580C → #DB2777, pire point #EA580C | **3,56:1** | 3,00:1 | oui (grand texte) |
| Blanc sur l'orange vif (interdit par la charte) | — | #FFFFFF | #FF8A3D | **2,35:1** | — | interdit |
| Orange vif en texte sur blanc (interdit) | — | #FF8A3D | #FFFFFF | **2,35:1** | — | interdit |
<!-- contraste:fin -->

## 3. Typographie, espacements, formes

**Police.** Plus Jakarta Sans, seule police chargée. C'est le fichier déjà auto-hébergé par l'application
(`app/fonts/plus-jakarta-sans-latin-wght-normal.woff2`, police variable de 200 à 800, sous-ensemble latin, 27 Ko).
Il couvre toutes les graisses : une deuxième police (titres, chiffres) coûterait 20 à 40 Ko de plus sans gain de
lisibilité, donc aucune. Les numéros de billet et les codes restent en police à chasse fixe du système (rien à
charger). Repli métrique d'Arial réglé sur la police (largeur ×1,035, hauteurs 1038 / −222 sur 1000) : rien ne
bouge quand elle arrive.

| Rôle | Taille | Graisse | Où |
|---|---|---|---|
| Accueil, ordinateur | 56 px / 1,1 | 800 | une fois par page |
| Titre de page | 30 px (téléphone), 40 px (ordinateur) | 800 | un `h1` par écran |
| Titre de section | 20 px, 24 px sur ordinateur | 700 | |
| Titre de carte | 18 px | 700 | |
| Texte courant, champs | 16 px / 1,5 | 400 | 16 px dans les champs : pas de zoom sur iPhone |
| Petit texte, boutons secondaires | 14 px | 500-600 | minimum pour un contenu ou un contrôle |
| Pastilles, heures | 12 px | 700 | seulement là |

Montants, heures et compteurs en chiffres de largeur fixe (`tabular-nums`), au format de `lib/format.ts`
(« 10 000 F CFA », espace insécable). Plus Jakarta Sans dessine un espace étroit : `word-spacing` est gardé
(application : 0,1 em ; maquettes : 0,04 em, à régler à l'implémentation).

**Espacements** : grille de 4 px (4, 8, 12, 16, 20, 24, 32, 40, 48, 64). Gouttière de page de 16 px sur téléphone,
24 px sur tablette, 32 px sur ordinateur ; largeur utile de 1 200 px au plus.

**Formes** : arrondi de **12 px** (cartes, champs, boutons) ; 8 px pour les pastilles ; 20 px pour le haut de la
feuille glissante et les grandes affiches ; pilule pour le grand bouton et les filtres. Cibles tactiles de 44 px au
moins.

**Ombres** : trois niveaux (`shadow-sm` pour soulever à peine, `shadow-md` au survol d'une carte, `shadow-lg` pour
les fenêtres, toasts et feuilles), plus l'ombre rose du grand bouton. En sombre, les ombres sont plus denses et la
séparation vient surtout des fonds (`card` sur `background`, `popover` au-dessus).

## 4. Animations

| Mouvement | Durée | Courbe |
|---|---|---|
| Survol, appui (couleur, léger enfoncement à 98 %) | 150 ms | `cubic-bezier(0.2, 0, 0, 1)` |
| Toast, menu, onglet qui arrive | 200 ms | `cubic-bezier(0.22, 1, 0.36, 1)` (décélère) |
| Fenêtre, feuille glissante | 250 ms | même courbe |
| Ce qui part | 150 ms | `cubic-bezier(0.4, 0, 1, 1)` (accélère, plus court que l'arrivée) |

On anime l'opacité et le déplacement, jamais la largeur ni la hauteur (sauf la feuille glissante, dont la hauteur
est son état). Aucune animation décorative en boucle. Si le téléphone demande de **réduire les animations**, plus
aucun déplacement ni reflet : les états changent d'un coup (règle déjà dans `app/globals.css`, reprise dans
`jetons.css`). Les animations décoratives actuelles d'`app/globals.css` (flottements, zoom lent de l'affiche,
dégradé qui défile sur le texte) sont à retirer.

## 5. Composants

Tous dans `composants.css`, visibles dans les maquettes. Chacun lit seulement les jetons.

| Composant | Règles |
|---|---|
| **Boutons** | Principal (A ou B), secondaire (bord, fond carte), discret, lien, danger, icône (44 × 44, libellé lu par les lecteurs d'écran), grand bouton en dégradé (un par page). Hauteur 44 px, 56 px pour le grand. Le texte dit l'action, et son montant quand il y en a un. |
| **Champs** | Libellé au-dessus, toujours visible ; aide en dessous ; erreur sous le champ avec une icône, reliée par `aria-describedby` ; bord `input` (≥ 3:1), focus `ring` ; 48 px de haut, texte de 16 px. |
| **Cartes d'événement** | Affiche 16/10 (place réservée), pastille de date, badge d'état (« Dernières places », « Gratuit »), titre, date, lieu, organisateur et « Dès 10 000 F CFA » sur une ligne. Toute la carte est le lien. |
| **Onglets** | Soulignés de 3 px en orange, défilants sur téléphone, état dans l'adresse (`?tab=`). |
| **Pastilles et filtres** | Badges de 12 px gras sur fond doux ; filtres en pilule de 40 px (zone de 44 px), état `aria-pressed`. |
| **Fenêtres** | Titre en question, conséquence en une phrase, bouton qui dit l'action (« Rembourser 10 000 F CFA »), bouton de retrait qui dit ce qu'on garde (« Garder le billet ») ; focus piégé, Échap ferme. |
| **Feuille glissante** | Trois états (repliée, à mi-hauteur, ouverte) ; poignée **et** bouton « Tout afficher » pour qui ne peut pas glisser (WCAG 2.5.7) ; haut arrondi de 20 px. |
| **Squelettes** | Même taille que le contenu attendu ; reflet léger, coupé si « réduire les animations ». |
| **États vides** | Pastille d'icône, une phrase qui dit pourquoi c'est vide, une action. |
| **Repères de carte** | Pastille avec le prix (« 10 000 F », « Gratuit »), pointe vers le lieu ; repère choisi en couleur principale ; zone tactile de 44 px ; point bleu « vous êtes ici » distinct. |
| **Toasts** | Voir section 6. |
| **Barre d'achat fixe** | Sur téléphone, dès l'ouverture de la fiche : « Billetterie / Dès … » et « Choisir mes billets » ; après un choix : le détail, le total et « Acheter (2) » (revue, E-02). |
| **Navigation** | En-tête collant (logo, recherche sur ordinateur, « Se connecter ») ; barre du bas sur téléphone, quatre entrées (Explorer, Carte, Mes billets, Profil). |

## 6. Retours des actions (règle pour toute l'application)

- **Réussite** : toast court qui se ferme seul (4 s, mis en pause au survol et au focus), en bas de l'écran sur
  téléphone (au-dessus de la barre du bas), en haut à droite sur ordinateur.
- **Erreur d'un champ** : sous le champ, jamais en toast ; le focus va au premier champ en erreur.
- **Erreur générale** (réseau, serveur) : toast qui **reste**, avec « Réessayer ».
- **Action importante** : confirmation avant, puis toast avec « Annuler » quand l'action se défait vraiment (6 s).
  Pas d'« Annuler » après un paiement, un versement ou un SMS parti : la confirmation avant suffit.
- **Un seul système** (`components/ui/Toast.tsx`, à étendre : action, durée selon le type), **trois toasts au plus**
  (aujourd'hui quatre), lisibles en clair et en sombre, annoncés (`status` pour une réussite, `alert` pour une
  erreur), **jamais de code technique**.

État actuel action par action : `retours-actions.md` (160 actions). Maquette : `maquettes/toasts.html`.

## 7. Plan page par page

| Espace | Page | Ce qui change |
|---|---|---|
| Public | Accueil | Événement à l'affiche avec le grand bouton ; recherche et filtres ; « Cette semaine » qui défile sur téléphone, en grille sur ordinateur ; aperçu de la carte ; bloc partenaire sans promesse chiffrée ; villes (maquette `accueil.html`). |
| Public | Explorer | Mêmes cartes, filtres en pilule, tri ; « Gratuit », « Dès … », « Complet en ligne » (revue, E-54). |
| Public | Carte | Fond de carte chargé seulement à l'ouverture ; repères-prix ; feuille glissante avec l'événement choisi et la liste ; panneau à gauche sur ordinateur (maquette `carte.html`). |
| Public | Fiche | Affiche, infos en trois lignes (date, lieu, billet hors ligne), programme, lieu, infos pratiques ; billetterie en colonne collante sur ordinateur ; barre d'achat fixe sur téléphone (maquette `fiche.html`). |
| Public | Achat, paiement | Fenêtre de paiement inchangée dans son fond (récapitulatif, opérateur non présélectionné) ; boutons Wave et Orange Money à leurs couleurs ; suivi et résultat sur les jetons ; bandeau de paiement en attente gardé jusqu'au statut final (E-55). |
| Client | Mes billets | Le jour J, le QR du prochain billet en premier (E-58) ; cartes de billet sur `card` ; transfert avec « Prévenir par WhatsApp ». |
| Client | Billet hors ligne | Inchangé dans son principe (QR d'emblée) ; fond `background`. |
| Client | Profil | Sections en cartes, préférences de notifications en interrupteurs, actions sensibles confirmées. |
| Organisatrice | Tableau de bord | Indicateurs en cartes (`KpiCard`), un seul bouton principal sans événement (E-83). |
| Organisatrice | Création | Étapes nommées, vérification avant envoi (finition 2b) ; grand bouton seulement sur « Envoyer pour validation ». |
| Organisatrice | Pilotage, équipe, finance | Mêmes onglets, cartes et tableaux ; « Recettes en ligne nettes » (E-64) ; écarts de caisse dits en mots (E-63). |
| Contrôleur | Scanner | Inchangé (voir ci-dessous) ; seuls l'accueil du contrôleur et la caisse prennent les jetons. |
| Administration | Toutes | Mêmes composants, densité plus forte (tableaux), confirmations qui disent qui est prévenu (finition 3b) ; pas de grand bouton en dégradé (rien à vendre). |

**Ce qui ne change pas** :
- les couleurs du résultat plein écran du scanner et des catégories au contrôle (`--scan-*`, mêmes valeurs en clair
  et en sombre, ≥ 7:1) ;
- le QR noir sur blanc ;
- les emails en clair (fond blanc, texte sombre, un bouton) ;
- le billet PDF (mise en page actuelle ; seul « FCFA » devient « F CFA », revue E-66) ;
- les couleurs des opérateurs de paiement.

## 8. Performance

- **Affichage principal en moins de 2,5 s** (LCP) sur un Android moyen en 4G ; **aucun saut de mise en page**
  (CLS < 0,1) : affiches en `aspect-ratio`, squelettes à la taille du contenu, repli métrique de la police.
- **Budgets JavaScript actuels gardés** (vérifiés par la CI) : la direction n'ajoute aucune bibliothèque, ni
  d'animation, ni de carrousel, ni de composants : CSS seulement.
- **Images optimisées** : affiches réencodées (déjà fait par la finition 2a) en AVIF ou WebP, tailles adaptées à
  l'écran, chargement différé hors du premier écran ; décors en SVG ou en dégradé CSS.
- **Carte chargée à la demande** : Leaflet et les tuiles seulement sur la page Carte ou au toucher d'un aperçu,
  jamais sur l'accueil (l'aperçu de l'accueil est un dessin statique).
- **Police** : un seul fichier de 27 Ko, `font-display: swap`, préchargé.
- Effets coûteux limités sur téléphone : flou d'arrière-plan seulement dans l'en-tête, pas d'ombres animées.

## 9. Points à trancher

1. **Boutons A ou B.**
   - A (orange vif, texte noir) suit la charte et contraste mieux pour le texte (7,42:1). Mais sur fond blanc le bouton
     se détache mal (2,35:1 contre le blanc, sans bord).
   - B (orange profond, texte blanc) est celui de l'application aujourd'hui : 5,18:1, bien visible sur fond clair.
   - Proposition : A en sombre, A ou B en clair selon votre œil sur les captures.
2. **Logo** : « Repère » recommandé (page `logo/index.html`) ; « Géew » peut servir de motif.
3. **Noms des jetons** : passer de `surface` / `fg` / `brand` (application) à `background` / `foreground` / `primary`
   (charte). Cela touche tous les écrans migrés et le test `design-systeme` : à faire en une fois, au premier lot
   d'interface.
4. **Mode sombre** : suivre le téléphone (proposé) ou imposer un thème ?
5. **Dégradé** : réservé au grand bouton (proposé), ou aussi aux affiches de secours et à l'icône ?
6. **Accueil** : un seul événement à l'affiche (proposé) ou un carrousel ? Un carrousel coûte du JavaScript et du
   temps d'affichage.

## 10. Fichiers

| Fichier | Rôle |
|---|---|
| `jetons.css` | jetons clair / sombre, boutons A / B, base |
| `composants.css`, `commun.js` | composants et bascules des maquettes (`?theme=clair` ou `sombre`, `&boutons=a` ou `b`), système de toasts |
| `logo/index.html`, `logo/svg/` | trois directions de logo (30 SVG) |
| `maquettes/accueil.html`, `fiche.html`, `carte.html`, `toasts.html` | maquettes autonomes, données fictives |
| `retours-actions.md` | inventaire des retours des 160 actions |
| `captures/` | logo et maquettes à 390 et 1 440 px, clair et sombre, boutons A et B |
| `outils/contraste.mjs` | mesure des contrastes (Node seul) |
| `outils/logos.mjs` | génération des SVG du logo (fontkit et wawoff2, voir l'en-tête du fichier) |
| `outils/captures.mjs` | captures (Playwright et sharp d'une copie installée du dépôt) |
