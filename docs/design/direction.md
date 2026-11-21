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
`text-foreground`, `bg-card`, `border-border`, `bg-primary`…). Thème : celui du téléphone par défaut, choix « Clair » ou
« Sombre » mémorisé (section 9).

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
| `brand` | `#FF8A3D` | `#FF8A3D` | **orange vif, couleur de la marque** : accents, onglet actif, repères de carte, focus |
| `brand-foreground` | `#1A1A1A` | `#1A1A1A` | texte sur l'orange vif (le blanc y est interdit : 2,35:1) |
| `ring` (+ `ring-halo`) | `#FF8A3D` + liseré `#1A1A1A` | `#FF8A3D` | anneau de focus : orange de la marque, doublé d'un liseré sombre en clair (l'orange seul : 2,35:1 sur blanc) |
| `primary` | `#C2410C` (B) | `#FF8A3D` (A) | bouton principal : B en clair, A en sombre |
| `primary-hover` | `#9A3412` | `#FF7A21` | survol du bouton principal |
| `primary-foreground` | `#FFFFFF` | `#1A1A1A` | texte du bouton principal |
| `primary-text` | `#C2410C` | `#FF8A3D` | orange en texte, liens, onglet actif |
| `primary-soft` | `#FFF1E7` | `#2B1A10` | fond teinté (onglet actif, pastille d'icône) |
| `accent-text` | `#BE185D` | `#F472B6` | rose en texte (rare) |
| `gradient-from` → `gradient-to` | `#EA580C` → `#DB2777` | idem | grand bouton (un par page), logo, icône d'application ; jamais sur les affiches |
| `success`, `warning`, `danger`, `info` (+ `-soft`, `-text`, `-border`), `on-tone` | valeurs actuelles de `design-system/event-village/MASTER.md` | idem | états |

**Boutons** (décidé) :
- **Clair : version B**, orange profond `#C2410C`, texte blanc (5,18:1), survol `#9A3412`.
- **Sombre : version A**, orange vif `#FF8A3D`, texte `#1A1A1A` (7,42:1), survol `#FF7A21`.
- **Grand bouton** : dégradé `#EA580C` → `#DB2777`, texte blanc gras de 19 px, en pilule, ombre rose douce, **un seul
  par page** (l'action qui fait avancer : « Choisir mes billets », « Acheter (2) »). Son contraste (3,56:1 au pire
  point) n'est conforme que parce que le texte est gras et fait 19 px (« grand texte » du WCAG) : ne jamais l'écrire
  plus petit.

**Orange vif en mode clair.** C'est la couleur de la marque, mais jamais un texte ni un trait seul sur fond clair
(2,35:1) : l'onglet actif garde son libellé foncé et gras, le focus a son liseré sombre, le repère choisi porte son
texte `#1A1A1A` (7,42:1). L'orange en texte sur clair reste `#C2410C` (`primary-text`).

### Correspondance des jetons : application → charte (migration en une fois, phase 1)

| Aujourd'hui (`app/globals.css`, classe Tailwind) | Demain (charte) | Remarque |
|---|---|---|
| `surface-sunken` (`bg-surface-sunken`) | `background` pour le fond de page, `muted` pour un puits ou un squelette | selon l'usage, écran par écran |
| `surface` (`bg-surface`) | `card` | |
| `surface-raised` (`bg-surface-raised`) | `popover` | fenêtres, menus, toasts |
| `fg` (`text-fg`) | `foreground-strong` pour titres et montants, `foreground` pour le texte courant | `fg` vaut `#0F172A` ; `foreground` devient `#3A3A3A` |
| `fg-muted` (`text-fg-muted`) | `muted-foreground` | |
| `border` (`border-border`) | `border` | même nom, nouvelle valeur |
| `border-strong` (`border-border-strong`) | `input` | bord des champs |
| `ring` (`ring-ring`) | `ring` + `ring-halo` | focus en deux tons |
| `scrim` (`bg-scrim/60`) | `scrim` | opacité dans la valeur |
| `brand` (`bg-brand`) | `primary` | B en clair, A en sombre |
| `brand-hover` (`bg-brand-hover`) | `primary-hover` | |
| `on-brand` (`text-on-brand`) | `primary-foreground` | blanc en clair, `#1A1A1A` en sombre |
| `brand-fg` (`text-brand-fg`) | `primary-text` | |
| `brand-bg` (`bg-brand-bg`) | `primary-soft` | |
| `brand-decor` (`#FF5722`, décor) | `brand` (`#FF8A3D`) | accents, onglets, repères |
| `brand-50` … `brand-900` (rampe) | supprimée | seuls les jetons sémantiques restent |
| `success`, `-bg`, `-fg`, `-border` (idem `warning`, `danger`, `info`) | `success`, `-soft`, `-text`, `-border` | valeurs inchangées |
| `on-tone` | `on-tone` | inchangé |
| `op-wave`, `on-op-wave`, `op-orange-money`, `on-op-orange-money` | `op-wave`, `op-orange-money`, `on-op` | valeurs inchangées |
| `scan-*` (résultat du scanner, catégories) | `scan-*` | **inchangés** |
| anciennes variables (`--bg-main`, `--text-main`, `--brand-primary`, `--brand-gradient`, `.ev-btn-primary`, `.ev-gradient-text`…) | supprimées ; `gradient-from` / `gradient-to` pour le grand bouton | à retirer d'`app/globals.css` |

Le test `tests/parcours/design-systeme.test.ts` et la liste `tests/helpers/design-files.ts` changent dans le même lot.

### Contrastes mesurés

Calculés par `node docs/design/outils/contraste.mjs`, qui lit `jetons.css` et réécrit ce tableau (WCAG 2.x ;
4,5:1 pour un texte, 3:1 pour un grand texte ou un élément d'interface). Le script s'arrête en erreur si un couple
obligatoire passe sous son seuil. Résultat : **89 couples, aucun sous le seuil** (les lignes « — » sont mesurées pour information : l'orange de la marque n'y est jamais seul).

<!-- contraste:debut -->
| Couple | Thème | Texte | Fond | Contraste | Seuil | Conforme |
|---|---|---|---|---|---|---|
| Texte courant | clair | `--foreground` #3A3A3A | `--background` #FFFFFF | **11,37:1** | 4,50:1 | oui |
| Texte courant | clair | `--foreground` #3A3A3A | `--card` #FFFFFF | **11,37:1** | 4,50:1 | oui |
| Texte courant | clair | `--foreground` #3A3A3A | `--muted` #F5F5F5 | **10,43:1** | 4,50:1 | oui |
| Texte courant | clair | `--foreground` #3A3A3A | `--popover` #FFFFFF | **11,37:1** | 4,50:1 | oui |
| Titres, montants | clair | `--foreground-strong` #1A1A1A | `--background` #FFFFFF | **17,40:1** | 4,50:1 | oui |
| Titres, montants | clair | `--foreground-strong` #1A1A1A | `--card` #FFFFFF | **17,40:1** | 4,50:1 | oui |
| Titres, montants | clair | `--foreground-strong` #1A1A1A | `--popover` #FFFFFF | **17,40:1** | 4,50:1 | oui |
| Texte secondaire | clair | `--muted-foreground` #666666 | `--background` #FFFFFF | **5,74:1** | 4,50:1 | oui |
| Texte secondaire | clair | `--muted-foreground` #666666 | `--card` #FFFFFF | **5,74:1** | 4,50:1 | oui |
| Texte secondaire | clair | `--muted-foreground` #666666 | `--muted` #F5F5F5 | **5,27:1** | 4,50:1 | oui |
| Texte secondaire | clair | `--muted-foreground` #666666 | `--popover` #FFFFFF | **5,74:1** | 4,50:1 | oui |
| Orange foncé en texte, liens, bouton secondaire (design 1e) | clair | `--primary-text` #C2410C | `--background` #FFFFFF | **5,18:1** | 4,50:1 | oui |
| Orange foncé en texte, liens, bouton secondaire (design 1e) | clair | `--primary-text` #C2410C | `--card` #FFFFFF | **5,18:1** | 4,50:1 | oui |
| Orange foncé en texte, liens, bouton secondaire (design 1e) | clair | `--primary-text` #C2410C | `--muted` #F5F5F5 | **4,75:1** | 4,50:1 | oui |
| Orange foncé en texte, liens, bouton secondaire (design 1e) | clair | `--primary-text` #C2410C | `--popover` #FFFFFF | **5,18:1** | 4,50:1 | oui |
| Orange foncé en texte, liens, bouton secondaire (design 1e) | clair | `--primary-text` #C2410C | `--primary-soft` #FFF1E7 | **4,68:1** | 4,50:1 | oui |
| Rose en texte | clair | `--accent-text` #BE185D | `--background` #FFFFFF | **6,04:1** | 4,50:1 | oui |
| Rose en texte | clair | `--accent-text` #BE185D | `--card` #FFFFFF | **6,04:1** | 4,50:1 | oui |
| Succès (pastille, bandeau) | clair | `--success-text` #166534 | `--success-soft` #F0FDF4 | **6,81:1** | 4,50:1 | oui |
| Attention | clair | `--warning-text` #92400E | `--warning-soft` #FFFBEB | **6,84:1** | 4,50:1 | oui |
| Erreur | clair | `--danger-text` #991B1B | `--danger-soft` #FEF2F2 | **7,60:1** | 4,50:1 | oui |
| Erreur | clair | `--danger-text` #991B1B | `--background` #FFFFFF | **8,31:1** | 4,50:1 | oui |
| Erreur | clair | `--danger-text` #991B1B | `--card` #FFFFFF | **8,31:1** | 4,50:1 | oui |
| Information | clair | `--info-text` #075985 | `--info-soft` #F0F9FF | **7,09:1** | 4,50:1 | oui |
| Texte sur un ton plein | clair | `--on-tone` #FFFFFF | `--success` #15803D | **5,02:1** | 4,50:1 | oui |
| Texte sur un ton plein | clair | `--on-tone` #FFFFFF | `--warning` #B45309 | **5,02:1** | 4,50:1 | oui |
| Texte sur un ton plein | clair | `--on-tone` #FFFFFF | `--danger` #B91C1C | **6,47:1** | 4,50:1 | oui |
| Texte sur un ton plein | clair | `--on-tone` #FFFFFF | `--info` #0369A1 | **5,93:1** | 4,50:1 | oui |
| Texte des petits boutons sur orange (#1A1A1A) | clair | `--primary-foreground` #1A1A1A | `--primary` #F05A1A | **5,12:1** | 4,50:1 | oui |
| Texte des petits boutons sur orange (#1A1A1A) | clair | `--primary-foreground` #1A1A1A | `--primary-hover` #E8561A | **4,79:1** | 4,50:1 | oui |
| Bouton principal en grande taille (blanc gras ≥ 19 px, design 1e) | clair | `--primary-foreground-large` #FFFFFF | `--primary` #F05A1A | **3,40:1** | 3,00:1 | oui |
| Bouton principal en grande taille (blanc gras ≥ 19 px, design 1e) | clair | `--primary-foreground-large` #FFFFFF | `--primary-hover` #E8561A | **3,63:1** | 3,00:1 | oui |
| Bouton Wave | clair | `--on-op` #000000 | `--op-wave` #1DC8F2 | **10,60:1** | 4,50:1 | oui |
| Bouton Orange Money | clair | `--on-op` #000000 | `--op-orange-money` #FF7900 | **7,99:1** | 4,50:1 | oui |
| Bord des champs | clair | `--input` #858585 | `--background` #FFFFFF | **3,69:1** | 3,00:1 | oui |
| Bord des champs | clair | `--input` #858585 | `--card` #FFFFFF | **3,69:1** | 3,00:1 | oui |
| Texte sur l'orange de la marque (repère choisi, « À la une ») | clair | `--brand-foreground` #1A1A1A | `--brand` #F05A1A | **5,12:1** | 4,50:1 | oui |
| Anneau de focus : orange de la marque | clair | `--ring` #F05A1A | `--background` #FFFFFF | **3,40:1** | — | visible seul |
| Anneau de focus : orange de la marque | clair | `--ring` #F05A1A | `--card` #FFFFFF | **3,40:1** | — | visible seul |
| Anneau de focus : orange de la marque | clair | `--ring` #F05A1A | `--muted` #F5F5F5 | **3,12:1** | — | visible seul |
| Anneau de focus : liseré sombre (clair) | clair | `--ring-halo` #1A1A1A | `--background` #FFFFFF | **17,40:1** | 3,00:1 | oui |
| Anneau de focus : liseré sombre (clair) | clair | `--ring-halo` #1A1A1A | `--card` #FFFFFF | **17,40:1** | 3,00:1 | oui |
| Anneau de focus : liseré sombre (clair) | clair | `--ring-halo` #1A1A1A | `--muted` #F5F5F5 | **15,96:1** | 3,00:1 | oui |
| Onglet actif, accents : orange de la marque | clair | `--brand` #F05A1A | `--background` #FFFFFF | **3,40:1** | — | visible seul |
| Onglet actif, accents : orange de la marque | clair | `--brand` #F05A1A | `--card` #FFFFFF | **3,40:1** | — | visible seul |
| Bord du bouton principal sur le fond | clair | `--primary` #F05A1A | `--background` #FFFFFF | **3,40:1** | 3,00:1 | oui |
| Bord du bouton principal sur le fond | clair | `--primary` #F05A1A | `--card` #FFFFFF | **3,40:1** | 3,00:1 | oui |
| Texte courant | sombre | `--foreground` #F2F2F2 | `--background` #121212 | **16,73:1** | 4,50:1 | oui |
| Texte courant | sombre | `--foreground` #F2F2F2 | `--card` #1A1A1A | **15,55:1** | 4,50:1 | oui |
| Texte courant | sombre | `--foreground` #F2F2F2 | `--muted` #262626 | **13,52:1** | 4,50:1 | oui |
| Texte courant | sombre | `--foreground` #F2F2F2 | `--popover` #222222 | **14,21:1** | 4,50:1 | oui |
| Titres, montants | sombre | `--foreground-strong` #FFFFFF | `--background` #121212 | **18,73:1** | 4,50:1 | oui |
| Titres, montants | sombre | `--foreground-strong` #FFFFFF | `--card` #1A1A1A | **17,40:1** | 4,50:1 | oui |
| Titres, montants | sombre | `--foreground-strong` #FFFFFF | `--popover` #222222 | **15,91:1** | 4,50:1 | oui |
| Texte secondaire | sombre | `--muted-foreground` #A6A6A6 | `--background` #121212 | **7,70:1** | 4,50:1 | oui |
| Texte secondaire | sombre | `--muted-foreground` #A6A6A6 | `--card` #1A1A1A | **7,15:1** | 4,50:1 | oui |
| Texte secondaire | sombre | `--muted-foreground` #A6A6A6 | `--muted` #262626 | **6,22:1** | 4,50:1 | oui |
| Texte secondaire | sombre | `--muted-foreground` #A6A6A6 | `--popover` #222222 | **6,54:1** | 4,50:1 | oui |
| Orange foncé en texte, liens, bouton secondaire (design 1e) | sombre | `--primary-text` #FA7036 | `--background` #121212 | **6,63:1** | 4,50:1 | oui |
| Orange foncé en texte, liens, bouton secondaire (design 1e) | sombre | `--primary-text` #FA7036 | `--card` #1A1A1A | **6,16:1** | 4,50:1 | oui |
| Orange foncé en texte, liens, bouton secondaire (design 1e) | sombre | `--primary-text` #FA7036 | `--muted` #262626 | **5,36:1** | 4,50:1 | oui |
| Orange foncé en texte, liens, bouton secondaire (design 1e) | sombre | `--primary-text` #FA7036 | `--popover` #222222 | **5,63:1** | 4,50:1 | oui |
| Orange foncé en texte, liens, bouton secondaire (design 1e) | sombre | `--primary-text` #FA7036 | `--primary-soft` #2B1A10 | **5,91:1** | 4,50:1 | oui |
| Rose en texte | sombre | `--accent-text` #F472B6 | `--background` #121212 | **7,07:1** | 4,50:1 | oui |
| Rose en texte | sombre | `--accent-text` #F472B6 | `--card` #1A1A1A | **6,57:1** | 4,50:1 | oui |
| Succès (pastille, bandeau) | sombre | `--success-text` #4ADE80 | `--success-soft` #0B2A17 | **8,88:1** | 4,50:1 | oui |
| Attention | sombre | `--warning-text` #FBBF24 | `--warning-soft` #2B1D07 | **9,82:1** | 4,50:1 | oui |
| Erreur | sombre | `--danger-text` #F87171 | `--danger-soft` #2D0F0F | **6,40:1** | 4,50:1 | oui |
| Erreur | sombre | `--danger-text` #F87171 | `--background` #121212 | **6,77:1** | 4,50:1 | oui |
| Erreur | sombre | `--danger-text` #F87171 | `--card` #1A1A1A | **6,29:1** | 4,50:1 | oui |
| Information | sombre | `--info-text` #38BDF8 | `--info-soft` #0A2233 | **7,60:1** | 4,50:1 | oui |
| Texte sur un ton plein | sombre | `--on-tone` #FFFFFF | `--success` #15803D | **5,02:1** | 4,50:1 | oui |
| Texte sur un ton plein | sombre | `--on-tone` #FFFFFF | `--warning` #B45309 | **5,02:1** | 4,50:1 | oui |
| Texte sur un ton plein | sombre | `--on-tone` #FFFFFF | `--danger` #B91C1C | **6,47:1** | 4,50:1 | oui |
| Texte sur un ton plein | sombre | `--on-tone` #FFFFFF | `--info` #0369A1 | **5,93:1** | 4,50:1 | oui |
| Texte des petits boutons sur orange (#1A1A1A) | sombre | `--primary-foreground` #1A1A1A | `--primary` #F05A1A | **5,12:1** | 4,50:1 | oui |
| Texte des petits boutons sur orange (#1A1A1A) | sombre | `--primary-foreground` #1A1A1A | `--primary-hover` #E8561A | **4,79:1** | 4,50:1 | oui |
| Bouton principal en grande taille (blanc gras ≥ 19 px, design 1e) | sombre | `--primary-foreground-large` #FFFFFF | `--primary` #F05A1A | **3,40:1** | 3,00:1 | oui |
| Bouton principal en grande taille (blanc gras ≥ 19 px, design 1e) | sombre | `--primary-foreground-large` #FFFFFF | `--primary-hover` #E8561A | **3,63:1** | 3,00:1 | oui |
| Bouton Wave | sombre | `--on-op` #000000 | `--op-wave` #1DC8F2 | **10,60:1** | 4,50:1 | oui |
| Bouton Orange Money | sombre | `--on-op` #000000 | `--op-orange-money` #FF7900 | **7,99:1** | 4,50:1 | oui |
| Bord des champs | sombre | `--input` #7A7A7A | `--background` #121212 | **4,36:1** | 3,00:1 | oui |
| Bord des champs | sombre | `--input` #7A7A7A | `--card` #1A1A1A | **4,05:1** | 3,00:1 | oui |
| Texte sur l'orange de la marque (repère choisi, « À la une ») | sombre | `--brand-foreground` #1A1A1A | `--brand` #F05A1A | **5,12:1** | 4,50:1 | oui |
| Anneau de focus : orange de la marque | sombre | `--ring` #F05A1A | `--background` #121212 | **5,52:1** | — | visible seul |
| Anneau de focus : orange de la marque | sombre | `--ring` #F05A1A | `--card` #1A1A1A | **5,12:1** | — | visible seul |
| Anneau de focus : orange de la marque | sombre | `--ring` #F05A1A | `--muted` #262626 | **4,46:1** | — | visible seul |
| Onglet actif, accents : orange de la marque | sombre | `--brand` #F05A1A | `--background` #121212 | **5,52:1** | — | visible seul |
| Onglet actif, accents : orange de la marque | sombre | `--brand` #F05A1A | `--card` #1A1A1A | **5,12:1** | — | visible seul |
| Bord du bouton principal sur le fond | sombre | `--primary` #F05A1A | `--background` #121212 | **5,52:1** | 3,00:1 | oui |
| Bord du bouton principal sur le fond | sombre | `--primary` #F05A1A | `--card` #1A1A1A | **5,12:1** | 3,00:1 | oui |
| Grand bouton en dégradé (blanc gras 19 px) | clair | `--gradient-foreground` #FFFFFF | dégradé #F05A1A → #D9480F, pire point #F05A1A | **3,40:1** | 3,00:1 | oui (grand texte) |
| Grand bouton en dégradé (blanc gras 19 px) | sombre | `--gradient-foreground` #FFFFFF | dégradé #F05A1A → #D9480F, pire point #F05A1A | **3,40:1** | 3,00:1 | oui (grand texte) |
| Blanc en petit texte sur l'orange de la marque (interdit sous 19 px gras) | — | #FFFFFF | #F05A1A | **3,40:1** | — | interdit |
| Orange de la marque en petit texte sur blanc (interdit : orange foncé) | — | #F05A1A | #FFFFFF | **3,40:1** | — | interdit |
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
| **Boutons** | Principal (B en clair, A en sombre), secondaire (bord, fond carte), discret, lien, danger, icône (44 × 44, libellé lu par les lecteurs d'écran), grand bouton en dégradé (un par page). Hauteur 44 px, 56 px pour le grand. Le texte dit l'action, et son montant quand il y en a un. |
| **Champs** | Libellé au-dessus, toujours visible ; aide en dessous ; erreur sous le champ avec une icône, reliée par `aria-describedby` ; bord `input` (≥ 3:1), focus `ring` ; 48 px de haut, texte de 16 px. |
| **Cartes d'événement** | Affiche 16/10 (place réservée), pastille de date, badge d'état (« Dernières places », « Gratuit »), titre, date, lieu, organisateur et « Dès 10 000 F CFA » sur une ligne. Toute la carte est le lien. |
| **Onglets** | Soulignés de 3 px en orange, défilants sur téléphone, état dans l'adresse (`?tab=`). |
| **Pastilles et filtres** | Badges de 12 px gras sur fond doux ; filtres en pilule de 40 px (zone de 44 px), état `aria-pressed`. |
| **Fenêtres** | Titre en question, conséquence en une phrase, bouton qui dit l'action (« Rembourser 10 000 F CFA »), bouton de retrait qui dit ce qu'on garde (« Garder le billet ») ; focus piégé, Échap ferme. |
| **Feuille glissante** | Trois états (repliée, à mi-hauteur, ouverte) ; poignée **et** bouton « Tout afficher » pour qui ne peut pas glisser (WCAG 2.5.7) ; haut arrondi de 20 px. |
| **Squelettes** | Même taille que le contenu attendu ; reflet léger, coupé si « réduire les animations ». |
| **États vides** | Pastille d'icône, une phrase qui dit pourquoi c'est vide, une action. |
| **Repères de carte** | Forme « Repère » (ancienne direction de logo) : petit billet à encoches, talon perforé en orange, pointe vers le lieu. **Prix** (« 10 000 F », « Gratuit ») sur le fond du thème ; **choisi** et **« À la une »** sur l'orange de la marque, texte `#1A1A1A` ; **regroupement** : pile de billets avec le nombre (« 3 événements »), qui agrandit le plan. Zone tactile de 44 px ; point bleu « vous êtes ici » distinct (`logo/index.html`, `maquettes/carte.html`). |
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
| Public | Accueil | Rangée « À la une » qui défile au doigt en CSS seulement (`scroll-snap`, aucun JavaScript), première carte plus grande avec le grand bouton ; recherche et filtres ; « Cette semaine » en grille ; aperçu de la carte ; bloc partenaire sans promesse chiffrée ; villes (maquette `accueil.html`). |
| Public | Explorer | Mêmes cartes, filtres en pilule, tri ; « Gratuit », « Dès … », « Complet en ligne » (revue, E-54). |
| Public | Carte | Fond de carte chargé seulement à l'ouverture ; repères « Repère » (prix, À la une, regroupement) ; feuille glissante avec l'événement choisi et la liste ; panneau à gauche sur ordinateur (maquette `carte.html`). |
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

## 9. Décisions prises (17/11/2026)

1. **Logo : « Bras levés »**, finalisé (`logo/index.html`) : symbole (normal, et réduit pour 16 à 48 px), logo
   horizontal (couleur, encre, blanc), icône, favicon (`.ico` 16/32/48, PNG, SVG), icônes PWA 192 et 512 et
   « maskable », `apple-touch-icon` 180, image de partage 1200 × 630. Recherche d'antériorité à faire à l'OAPI avant
   tout dépôt.
2. **« Repère » devient le repère des événements sur la carte** (pas le logo) : prix, « À la une », regroupement.
3. **Boutons : B en clair, A en sombre** ; l'orange vif `#FF8A3D` est la couleur de la marque (accents, onglets,
   focus, repères).
4. **Jetons : noms de la charte** ; l'application migre en une fois à la phase 1 (table de la section 2).
5. **Thème : celui du système par défaut, choix mémorisé.** Même clé que l'application (`ev-theme` : `system`,
   `light`, `dark`). À la phase 1 : défaut `system` (aujourd'hui `light`, `components/providers/ThemeProvider.tsx:25`)
   et thème posé par un petit script avant l'affichage, pour éviter le flash du clair au sombre (aujourd'hui appliqué
   après le chargement).
6. **Dégradé : grand bouton, logo, icône d'application ; jamais sur les affiches** (affiches et affiches de secours en
   aplats).
7. **Accueil : rangée « À la une »** qui défile au doigt en CSS seulement, première carte plus grande
   (`maquettes/accueil.html`).

## 10. Fichiers

| Fichier | Rôle |
|---|---|
| `jetons.css` | jetons clair (boutons B) et sombre (boutons A), base |
| `composants.css`, `commun.js` | composants, thème des maquettes (système par défaut, choix mémorisé, `?theme=clair` ou `sombre` pour une capture), système de toasts |
| `logo/index.html`, `logo/svg/`, `logo/export/` | logo « Bras levés » (SVG, favicons, icônes PWA et Apple, image de partage) ; directions écartées dans `logo/svg/ecartees/` |
| `maquettes/accueil.html`, `fiche.html`, `carte.html`, `toasts.html` | maquettes autonomes, données fictives |
| `retours-actions.md` | inventaire des retours des 160 actions |
| `captures/` | logo et maquettes à 390 et 1 440 px, clair et sombre |
| `outils/contraste.mjs` | mesure des contrastes (Node seul) |
| `outils/logos.mjs` | génération des SVG et PNG du logo (fontkit, wawoff2, sharp ; voir l'en-tête du fichier) |
| `outils/captures.mjs` | captures (Playwright et sharp d'une copie installée du dépôt) |
