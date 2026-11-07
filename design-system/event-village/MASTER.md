# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/event-village/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Event Village
**Generated:** 2026-11-01 05:08:58
**Category:** Ticketing / Box Office
**Complété :** lot 5 (contrat Q, décisions de l'utilisateur du 31/10/2026). Les sections « Color Palette », « Typography » et « Component Specs » remplacent les propositions du générateur ; les autres sections sont celles générées par ui-ux-pro-max.

---

## Global Rules

### Color Palette

> **Décision de l'utilisateur (31/10/2026) : orange brûlé accessible.** La palette proposée par le
> générateur (bleu nuit et vert) est **écartée** : Event Village garde son identité orange. Les valeurs
> ci-dessous font foi ; elles vivent dans `app/globals.css` (`:root` et `.dark`, canaux « r g b ») et
> sont branchées dans `tailwind.config.ts` (`bg-surface`, `text-fg`, `bg-brand`, `text-on-brand`…).

| Token (classe Tailwind) | Clair | Sombre | Usage |
|---|---|---|---|
| `surface` | `#FFFFFF` | `#16161A` | cartes, panneaux, fond des écrans migrés |
| `surface-raised` | `#FFFFFF` | `#1D1D22` | modales, menus (avec ombre) |
| `surface-sunken` | `#F4F5F7` | `#0F0F11` | fond de page, puits, pistes, squelettes |
| `fg` | `#0F172A` | `#F4F4F5` | texte principal |
| `fg-muted` | `#475569` (7,58:1) | `#A1A1AA` (7,04:1) | texte secondaire |
| `border` | `#E4E4E7` | `#2E2E36` | séparateurs décoratifs |
| `border-strong` | `#71717A` (4,83:1) | `#71717A` | bord des champs (WCAG 1.4.11) |
| `ring` | `#C2410C` | `#FB923C` | anneau de focus |
| `scrim` | `#0F172A` | `#000000` | voile des modales (`bg-scrim/60`) |
| `brand` | `#C2410C` | `#C2410C` | fond des boutons primaires (texte blanc 5,18:1) |
| `brand-hover` | `#9A3412` | `#9A3412` | survol du primaire (7,31:1) |
| `on-brand` | `#FFFFFF` | `#FFFFFF` | texte sur `brand` |
| `brand-fg` | `#C2410C` (5,18:1) | `#FB923C` (7,97:1) | texte et liens couleur marque |
| `brand-bg` | `#FFF7ED` | `#2A160C` | fond teinté (onglet actif, pastille d'icône) |
| `brand-decor` | `#FF5722` | `#FF5722` | **décor seulement** : illustrations, halos, filets. Jamais sous du texte ni comme texte (3,2:1 avec le blanc) |
| `on-tone` | `#FFFFFF` | `#FFFFFF` | texte sur un ton plein |
| `success` / `-bg` / `-fg` / `-border` | `#15803D` / `#F0FDF4` / `#166534` / `#BBF7D0` | (plein inchangé) / `#0B2A17` / `#4ADE80` / `#14532D` | succès, publié |
| `warning` / `-bg` / `-fg` / `-border` | `#B45309` / `#FFFBEB` / `#92400E` / `#FDE68A` | (plein inchangé) / `#2B1D07` / `#FBBF24` / `#78350F` | attente ; suspension (`warning` plein) |
| `danger` / `-bg` / `-fg` / `-border` | `#B91C1C` / `#FEF2F2` / `#991B1B` / `#FECACA` | (plein inchangé) / `#2D0F0F` / `#F87171` / `#7F1D1D` | erreur, annulation |
| `info` / `-bg` / `-fg` / `-border` | `#0369A1` / `#F0F9FF` / `#075985` / `#BAE6FD` | (plein inchangé) / `#0A2233` / `#38BDF8` / `#0C4A6E` | validé, information |

- Rampe `brand-50` à `brand-900` (orange, teintes 15° à 34°, luminosité décroissante) : `#FFF7ED`,
  `#FFEDD5`, `#FED7AA`, `#FDBA74`, `#FB923C`, `#F97316`, `#EA580C`, `#C2410C`, `#9A3412`, `#7C2D12`.
  Préférer les tokens sémantiques ; la rampe sert aux illustrations et aux graphiques.
- Un ton plein (`bg-success`, `bg-warning`…) se lit avec `text-on-tone` ; un fond doux (`bg-success-bg`)
  avec `text-success-fg`. Contrastes vérifiés (WCAG 2.x) : tous ≥ 4,5:1, ≥ 6,8:1 pour `-fg` sur `-bg`.
- La couleur ne porte jamais seule l'information : libellé ou icône en plus (pastilles, bandeaux).
- L'ancien dégradé corail (`#FF6A3D` → `#FF3D68`) et `#FF5722` sous du texte blanc ne sont plus admis
  (contraste 2,9 à 3,4:1) : seulement en décor, via `brand-decor`.

#### Résultat plein écran du scanner (lot 7, tâche 7.2, D51)

Jetons `--scan-<x>-bg` / `--scan-<x>-fg` de `app/globals.css`, classes `bg-scan-<x>-bg` et
`text-scan-<x>-fg`. **Mêmes valeurs en clair et en sombre** (jamais redéfinis par `.dark`) ; texte
**≥ 7:1** sur son fond (WCAG AAA, calculé par `tests/parcours/scanner-interface.test.ts`). Seul
`components/scan/CombatFlashOverlay.tsx` les emploie pour le plein écran ; `scan-tech` sert aussi aux fonds
opaques posés sur l'image de la caméra.

| Catégorie | Résultats | Fond / texte | Contraste | Vibration (D50) |
|---|---|---|---|---|
| `accept` (accepte) | valid | `#4ADE80` / `#000000` | 12,05:1 | `[60]` |
| `used` (deja_utilise) | already_used | `#7C2D12` / `#FFFFFF` | 9,37:1 | `[120, 60, 120, 60, 120]` |
| `refuse` (refuse, evenement_annule) | invalid, cancelled, refunded, wrong_event, qr_expired, dynamic_qr_required, manual_entry_refused, payment_required ; event_cancelled, event_suspended (icône distincte) | `#7F1D1D` / `#FFFFFF` | 10,02:1 | `[120, 60, 120, 60, 120]` |
| `cash` (a_encaisser) | cash_required (attend une action) | `#1E3A8A` / `#FFFFFF` | 10,36:1 | `[250, 100, 250]` |
| `window` (hors_fenetre) | event_not_open, event_ended | `#FBBF24` / `#000000` | 12,58:1 | `[250, 100, 250]` |
| `tech` (technique) | rate_limited, network_error, server_error, hors ligne, délai dépassé | `#27272A` / `#FFFFFF` | 14,89:1 | aucune (D47) |

Règles du plein écran : icône ≥ 96 px, titre ≥ 40 px sur mobile, un seul `role="alert"`, jamais la couleur
seule (icône et titre propres à chaque catégorie) ; ni flou, ni ombre portée, ni zoom, ni rebond, ni texte
atténué ; aucun son. Retour automatique au scan : entrée validée selon le réglage de l'appareil (1 / 1,5 /
2 / 3 s, défaut 1,5 s), refus, hors fenêtre et incident 3 s ; encaissement : attend une action ; un toucher
ferme tout de suite. Thème sombre forcé sur `/controller/*` (D45).

#### Opérateurs de paiement (lot 7, D59)

| Jeton (classe Tailwind) | Valeur | Texte | Contraste |
|---|---|---|---|
| `op-wave` / `on-op-wave` (`bg-op-wave text-on-op-wave`) | `#1DC8F2` | `#000000` | 10,60:1 |
| `op-orange-money` / `on-op-orange-money` (`bg-op-orange-money text-on-op-orange-money`) | `#FF7900` | `#000000` | 7,99:1 |

Couleurs de marque des opérateurs, mêmes valeurs en clair et en sombre ; elles remplacent `bg-[#1DC8F2]`
et `bg-[#FF7900]`. Le nom de l'opérateur reste écrit sur le bouton (jamais la couleur seule).

### Typography

- **Police :** Plus Jakarta Sans, auto-hébergée (`--font-sans`, `app/layout.tsx`). Les polices proposées
  par le générateur (Inter / Playfair Display) sont écartées : pas de changement d'identité au lot 5.
- **Tailles :** 16 px pour les champs (pas de zoom iOS), 14 px minimum pour tout contenu et tout contrôle
  (`text-sm`), titres `text-2xl` / `text-3xl` (un seul `<h1>` par écran, `PageHeader`).
- **`text-caption` (12 px)** est la **seule** petite taille admise, et seulement dans les badges
  (`Badge`, `StatusBadge`) ou sur un élément `<time>`, `<small>`, `<figcaption>`, `<caption>`,
  `<legend>`, `<text>` (SVG). `text-xs` et `text-[N px]` < 14 px sont interdits dans les fichiers migrés.
- Chiffres : `tabular-nums` dans les indicateurs et les tableaux ; formats de `lib/format.ts`.
- **Police à chasse fixe (lot 8, tâche 8.2 q).** `font-mono` est réservé aux numéros de billets,
  références de transaction et de commande, et codes (OTP, PIN). Partout ailleurs, police normale.
  Montants, compteurs, comptes à rebours, heures et téléphones : `tabular-nums`. Exception : les blocs
  `<pre>` de JSON du journal d'audit. Aucune police à chasse fixe n'est embarquée : `font-mono` retombe
  sur la pile système, donc sur une police différente selon l'appareil. Le contrôle est dans
  `tests/parcours/design-systeme.test.ts` (`MONO_ALLOWED`, nombre exact par fichier).

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

> Les composants vivent dans `components/ui` ; le CSS d'exemple du générateur est remplacé par ces
> contrats. Tout écran migré les utilise au lieu de réécrire boutons, modales ou onglets.

| Composant | Règles |
|---|---|
| `Button` | `min-h-11` (44 px) à toutes les tailles, icône 44 × 44 ; primaire = fond plein `bg-brand text-on-brand`, survol `bg-brand-hover` ; plus de dégradé ; focus `ring-ring` visible ; `isLoading` → `aria-busy` |
| `LinkButton` | `next/link` stylé en bouton (classes de `buttonClasses`) ; remplace tout `<Link><Button>` |
| `IconButton` | `aria-label` obligatoire dans le type ; 44 × 44 ; icône `aria-hidden` |
| `Modal` | `role="dialog"`, `aria-modal`, `aria-labelledby`, focus initial, piège de focus, focus restitué, Escape (sauf `busy`), bouton Fermer 44 px toujours présent, verrou de défilement compté (modales imbriquées) |
| `ConfirmDialog` | sur `Modal` ; `children` (impact), `requireText` (retaper le titre, comparé après trim), `isLoading` bloque la fermeture |
| `ReasonDialog` | motif obligatoire d'au moins 3 caractères (`MIN_REASON_LENGTH`), `Textarea` étiqueté avec compteur |
| `StatusBadge` | `domain="event"` ; libellé, ton, description lus dans `EVENT_STATUS_META` (`lib/events/event-status.ts`) ; casse de phrase, jamais `uppercase` ; valeur inconnue → « Statut inconnu » |
| `KpiCard` / `KpiCardSkeleton` | `label`, `value` (déjà formatée), `hint`, `tone`, `icon`, `loading` ; aucun calcul dans le navigateur |
| `Tabs` (+ `TabPanel`, `useTabParam`) | `tablist` / `tab`, `aria-selected`, tabulation itinérante, flèches, Début / Fin, compteur ; défilement interne ; état dans `?tab=` |
| `Pagination` | `<nav aria-label>`, Précédent / « Page X sur Y » / Suivant, 44 px |
| `PageHeader` | `<h1>`, description, actions en `flex-wrap`, lien de retour |
| `Field`, `TextInput`, `Textarea`, `Select` | libellé lié (`htmlFor` / `id`), aide et erreur reliées par `aria-describedby`, `aria-invalid`, erreur sous le champ |
| `DataList` | tableau `hidden md:block`, cartes `md:hidden` ; jamais de `<table>` ailleurs |
| `StatusBanner` | `role="status"` (ou `alert`) ; bandeaux de la page publique, motif de refus ou de suspension |
| `LiveIndicator` | « En direct » / « Connexion… » / « Hors ligne » (discret), `aria-live="polite"`, avec `useRealtimeRefresh` |
| `EmptyState` / `ErrorState` | tokens ; `ErrorState` exige `onRetry` et affiche toujours « Réessayer » |

### Libellés et formats (contrat B)

- Statuts d'événement : `EVENT_STATUS_META` seulement. Brouillon (neutre), En attente de validation
  (avertissement), Validé (info), Publié (succès), Suspendu (avertissement fort), Terminé (atténué),
  Annulé (danger). Aucun enum dans le JSX.
- `lib/format.ts` : `formatDateTime` (« sam. 15 nov. 2026 à 20:00 », Africa/Dakar), `formatEventDateTime`,
  `formatFcfa` (« 5 000 F CFA »), `formatFcfaPrecise` (« 19,7 F CFA », rapprochements financiers seulement), `formatPercent` (« 42 % »), `formatInteger`. Valeur absente → « — ».
- `lib/scan/scan-result.ts` : `SCAN_REFUSAL_LABELS` (dont `forbidden`), `SCAN_METHOD_LABELS` (QR, Saisie
  manuelle, Guichet).

### Règles des fichiers migrés (test `tests/parcours/design-systeme.test.ts`)

Liste blanche : `tests/helpers/design-files.ts` (elle ne fait que grandir). Dans chaque fichier listé :
- aucune couleur codée en dur : ni `#hex`, ni `rgb()` / `hsl()`, ni palette Tailwind brute (`slate-`,
  `zinc-`, `gray-`, `orange-`…) ; uniquement les tokens ci-dessus ;
- aucun `text-xs` ni `text-[≤ 13 px]` ; `text-caption` dans les seuls cas listés en typographie ;
- aucun « § », aucun emoji, aucun enum de statut ni `{x.status}` affiché ;
- aucun `<Link>` ou `<a>` qui enveloppe un bouton (utiliser `LinkButton`) ;
- accessibilité et mobile : bouton icône avec `aria-label`, champ avec libellé lié, aucune modale écrite
  à la main (`fixed inset-0` hors `Modal`), aucune largeur fixe > 358 px, aucun `<table>` hors `DataList` ;
- une seule gouttière de page, réserve pour la barre du bas sur mobile ; `prefers-reduced-motion`
  respecté (règle globale dans `app/globals.css`, animations en `motion-safe:`).

---

## Style Guidelines

**Style:** Vibrant & Block-based

**Keywords:** Bold, energetic, playful, block layout, geometric shapes, high color contrast, duotone, modern, energetic

**Best For:** Startups, creative agencies, gaming, social media, youth-focused, entertainment, consumer

**Key Effects:** Large sections (48px+ gaps), animated patterns, bold hover (color shift), scroll-snap, large type (32px+), 200-300ms

### Page Pattern

**Pattern Name:** Event/Conference Landing

- **Conversion Strategy:** Early bird pricing with deadline. Social proof (past attendees). Speaker credibility. Multi-ticket discounts. Expose the exact deadline as text; pause decorative countdown motion offscreen/hidden and show a static final state under reduced motion.
- **CTA Placement:** Register CTA sticky + After speakers + Bottom
- **Section Order:** Hero (date/location/countdown) > Speakers grid > Agenda/schedule > Sponsors > Register CTA

---

## Anti-Patterns (Do NOT Use)

- Interdit : No seat-map feedback
- Interdit : hidden fees
- Interdit : weak mobile

### Additional Forbidden Patterns

- Interdit : **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- Interdit : **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- Interdit : **Layout-shifting hovers** — Avoid scale transforms that shift layout
- Interdit : **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- Interdit : **Instant state changes** — Always use transitions (150-300ms)
- Interdit : **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
