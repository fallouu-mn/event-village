# 🎨 EVENT VILLAGE — REFONTE FRONTEND PREMIUM COMPLÈTE
## Directive Design & Implémentation — Conforme CDC V3.0

---

# 🚨 DIRECTIVE PRINCIPALE

Le frontend actuel doit être considéré comme une base fonctionnelle mais PAS comme une version finale du produit.

L'objectif de cette phase est de réaliser une **REFONTE FRONTEND COMPLÈTE** d'Event Village.

Il ne s'agit PAS de corriger uniquement quelques composants existants.

Il faut reprendre l'expérience utilisateur, la hiérarchie visuelle, les layouts, les espacements, les composants et les responsive layouts afin d'obtenir une véritable application SaaS/Event Tech premium.

Le résultat final doit donner l'impression d'utiliser une **application professionnelle commercialisable**, et non une maquette Figma ou un prototype.

---

# 1. RÈGLE ABSOLUE : LE CDC EST LA SOURCE DE VÉRITÉ

Avant toute modification :

1. Lire intégralement le Cahier des Charges V3.0 présent dans le projet.
2. Identifier toutes les fonctionnalités demandées par le CDC.
3. Identifier tous les rôles :
   - CLIENT
   - PARTENAIRE
   - ADMIN
   - CONTROLEUR
   - SUPERADMIN
4. Identifier toutes les pages et tous les workflows.
5. Identifier les contraintes métier.
6. Identifier les règles de paiement.
7. Identifier le ticketing.
8. Identifier le système de réservation.
9. Identifier les commissions N1/N2.
10. Identifier les fonctionnalités B2C et B2B.

Aucune fonctionnalité du CDC ne doit être supprimée simplement parce qu'elle n'est pas actuellement visible dans le frontend.

Le CDC reste la référence fonctionnelle absolue.

---

# 2. OBJECTIF DESIGN

Le nouveau design doit s'inspirer de la logique visuelle du prototype Stitch fourni par le propriétaire du projet.

IMPORTANT :

Le prototype Stitch est une **INSPIRATION DE DIRECTION ARTISTIQUE**, pas un template à copier aveuglément.

Il faut reprendre notamment :

- grande image Hero
- informations clairement hiérarchisées
- boutons arrondis
- cartes élégantes
- informations événement regroupées
- CTA très visible
- navigation intuitive
- glassmorphism subtil
- profondeur visuelle
- espaces généreux
- typographie moderne
- interface premium
- transitions fluides

Mais tout doit être adapté à Event Village.

---

# 3. NOUVELLE IDENTITÉ VISUELLE

## Couleur principale

La couleur principale de la plateforme doit devenir :

### 🟠 Orange Event Village

Utiliser une palette autour de :

- Orange principal : #FF6B35
- Orange secondaire : #F97316
- Orange clair : #FFEDD5
- Orange très clair : #FFF7ED

Ne pas utiliser l'orange partout.

L'orange doit principalement servir pour :

- CTA
- boutons principaux
- états actifs
- icônes importantes
- badges
- éléments de progression
- highlights
- prix
- éléments interactifs

---

# 4. LIGHT MODE

Le Light Mode doit être le mode par défaut.

Direction :

- background général : blanc / gris extrêmement clair
- cartes : blanc
- textes : noir / gris foncé
- bordures : gris très léger
- orange pour les accents
- ombres très légères
- glassmorphism subtil

Exemple d'ambiance :

background:
#FFFFFF / #FAFAFA

cards:
#FFFFFF

text:
#111827

secondary text:
#6B7280

primary:
#FF6B35

---

# 5. DARK MODE

Ajouter un vrai Dark Mode.

Le Dark Mode ne doit pas simplement inverser les couleurs.

Il doit avoir sa propre hiérarchie visuelle.

Direction :

background:
#111111 / #151515

cards:
#1A1A1A / #202020

text:
#FFFFFF

secondary:
#A1A1AA

border:
rgba(255,255,255,0.08)

primary:
#FF6B35

Le dark mode doit conserver :

- contraste
- lisibilité
- profondeur
- hiérarchie
- CTA visibles
- glassmorphism subtil

Le choix du thème doit être persistant.

---

# 6. GLASSMORPHISM

Le glassmorphism doit être utilisé avec MODÉRATION.

Il ne faut surtout pas transformer toute l'application en verre transparent.

Utiliser le glass principalement pour :

- overlays Hero
- boutons flottants
- filtres
- certains panneaux
- navigation flottante
- modales
- éléments importants

Exemple :

background:
rgba(255,255,255,0.65)

backdrop-filter:
blur(16px)

border:
1px solid rgba(255,255,255,0.25)

Dans le dark mode :

background:
rgba(255,255,255,0.06)

---

# 7. RESPONSIVE — PRIORITÉ ABSOLUE

Le frontend doit être réellement responsive.

Il ne faut PAS simplement centrer une application mobile au milieu d'un écran desktop.

INTERDIT :

- max-width mobile permanent sur desktop
- application de 390px au milieu d'un écran 1920px
- énorme espace vide sur desktop
- navigation mobile affichée comme seule navigation desktop
- contenu illisible sur tablette
- cartes trop étroites
- layouts cassés

---

# 8. BREAKPOINTS

Prévoir au minimum :

### Mobile
320px+
375px
390px
430px

### Tablet
768px
1024px

### Desktop
1280px
1440px
1920px+

---

# 9. ARCHITECTURE RESPONSIVE

## Mobile

Navigation :

Bottom Navigation élégante.

Exemple :

Accueil
Explorer
Tickets
Commandes
Profil

Elle doit être :

- sticky/fixed
- safe-area compatible
- élégante
- compacte
- facilement utilisable au doigt

---

## Desktop

Créer une véritable interface desktop.

Navigation :

Sidebar ou Top Navigation selon la page.

Exemple :

Logo Event Village

Accueil
Explorer
Événements
Mes Tickets
Commandes
Favoris

----------------

Profil

Paramètres

Déconnexion

Le contenu doit exploiter correctement l'espace disponible.

---

# 10. PAGE ACCUEIL CLIENT

Créer une véritable Home Page Event Village.

Structure recommandée :

### Header

Logo Event Village

Recherche

Notifications

Profil

Theme toggle

---

### Hero

Grande section premium.

Exemple :

"Découvrez les meilleurs événements près de vous"

Sous-titre :

"Concerts, festivals, soirées, restaurants, salles et expériences."

CTA :

Explorer les événements

---

### Catégories

Cards :

Concert
Festival
Food
Soirée
Salle
Sport
Culture
Autres

---

### Événements populaires

Cards premium avec :

- image
- catégorie
- date
- lieu
- titre
- prix à partir de
- nombre de participants
- bouton / action

---

### Événements recommandés

Section personnalisée.

---

### Événements proches

Prévoir possibilité d'afficher :

- localisation
- distance
- événement

---

# 11. EXPLORER

Créer une vraie page d'exploration.

Fonctionnalités :

- recherche
- catégories
- filtres
- date
- localisation
- prix
- type d'événement
- tri

Desktop :

sidebar de filtres + grille.

Mobile :

bouton "Filtres" ouvrant une bottom sheet / modal.

---

# 12. PAGE DÉTAIL ÉVÉNEMENT

Cette page doit s'inspirer directement de la logique du prototype Stitch.

Structure :

## Hero

Grande image événement.

Bouton retour.

Bouton favori.

Bouton partager.

Overlay glass :

Organisateur

Titre événement

Catégorie

---

## Informations

Afficher :

📅 Date

🕐 Heure

📍 Localisation

👥 Participants / intéressés

---

## Description

Section :

"À propos de l'événement"

---

## Organisateur

Avatar

Nom

Profil

---

## Tarifs

Afficher clairement les différentes formules.

Exemple :

STANDARD

15 000 FCFA

VIP

35 000 FCFA

Chaque formule doit présenter :

- nom
- prix
- avantages
- disponibilité
- sélection

La sélection doit être extrêmement claire.

---

## CTA

CTA principal :

"Réserver maintenant"

ou

"Acheter mon billet"

Le CTA doit rester accessible.

---

# 13. PAIEMENT

Le frontend doit conserver intégralement la logique métier existante.

IMPORTANT :

Le frontend ne doit JAMAIS être autorisé à définir arbitrairement le montant.

Le backend reste la source de vérité.

Le frontend transmet uniquement les informations nécessaires :

- event
- ticket category
- targetId
- quantité si applicable

Le backend récupère le prix réel depuis PostgreSQL.

---

# 14. MODALE SAMIRPAY

Créer une vraie modal de paiement premium.

Étapes :

1. Résumé commande
2. Formule choisie
3. Prix
4. Frais éventuels
5. Total
6. Paiement SamirPay
7. État Pending
8. Confirmation

États UI :

Loading

Pending

Success

Error

Cancelled

La modal doit être responsive.

---

# 15. PAGE TICKETS

Créer une vraie page :

"Mes billets"

Chaque ticket doit être présenté comme un billet premium.

Afficher :

- événement
- image
- date
- heure
- lieu
- catégorie
- numéro ticket
- QR Code
- statut

Statuts visuels :

VALIDE
UTILISE
ANNULE
REMBOURSE

Le design doit reprendre l'idée du ticket perforé du prototype existant, mais de manière plus professionnelle.

---

# 16. DÉTAIL DU TICKET

Créer une page ticket détaillée.

Hero événement.

Informations.

QR Code central.

Numéro du ticket.

Instructions d'entrée.

Possibilité :

Afficher QR

Afficher code-barres

Partager

---

# 17. COMMANDES

Créer :

"Mes commandes"

Tabs :

Événements

Tables

Salles

Selon les fonctionnalités prévues dans le CDC.

Afficher :

- commande
- date
- statut
- montant
- événement
- actions

---

# 18. RÉSERVATIONS TABLES / SALLES

Respecter exactement le CDC.

Créer des interfaces premium pour :

### Tables

- disponibilité
- date
- heure
- nombre de personnes
- prix
- réservation

### Salles

- disponibilité
- date
- heure
- capacité
- prix
- réservation

Ne jamais simuler une disponibilité qui doit venir du backend.

---

# 19. ESPACE PARTENAIRE

Le partenaire doit avoir une vraie application B2B.

Ce n'est PAS une simple page différente avec quelques cartes.

Créer :

### Dashboard

KPIs :

Chiffre d'affaires
Tickets vendus
Tickets utilisés
Commandes
Réservations
Événements

---

### Événements

Liste.

Créer événement.

Modifier.

Publier.

Statut.

---

### Commandes

Realtime.

Filtres.

Recherche.

Détails.

---

### Calendrier

Vue :

Mois

Semaine si nécessaire

Événements visibles.

---

# 20. SCANNER PARTENAIRE

Créer une interface professionnelle de contrôle d'entrée.

Fonctions :

Scanner QR.

Saisie manuelle.

Vérification.

États :

Ticket valide
Ticket déjà utilisé
Ticket annulé
Ticket inconnu

Après validation :

Afficher clairement :

✅ ACCÈS AUTORISÉ

ou

❌ ACCÈS REFUSÉ

Le changement de statut doit rester côté serveur.

---

# 21. ADMIN

Créer un vrai dashboard administratif.

Sections selon CDC :

- utilisateurs
- partenaires
- événements
- commandes
- tickets
- paiements
- réservations
- commissions
- notifications
- statistiques
- audit logs

---

# 22. SUPERADMIN

Respecter exactement les permissions du CDC.

Le Superadmin doit avoir accès aux fonctionnalités globales prévues.

Ne jamais contourner les permissions backend avec le frontend.

---

# 23. CONTRÔLEUR

Interface dédiée au contrôle.

Le contrôleur doit pouvoir :

- scanner
- vérifier
- consulter les informations autorisées
- valider l'entrée

Respecter strictement les permissions RLS/backend.

---

# 24. PARRAINAGE

Créer les interfaces nécessaires au système de parrainage.

Afficher si nécessaire :

- statut Ambassadeur
- lien/code de parrainage
- filleuls
- commissions
- historique

IMPORTANT :

AMBASSADEUR n'est PAS un rôle.

C'est un statut :

referral_status = AMBASSADEUR

Le calcul des commissions reste exclusivement côté backend.

---

# 25. NOTIFICATIONS

Créer un centre de notifications.

Afficher :

- paiement confirmé
- billet disponible
- réservation confirmée
- événement modifié
- etc.

Prévoir :

lu / non lu.

---

# 26. PROFIL

Créer une page Profil premium.

Sections :

Informations personnelles

Préférences

Notifications

Thème

Sécurité

Parrainage si applicable

Déconnexion

---

# 27. UX / MICRO-INTERACTIONS

Ajouter des animations subtiles :

- hover
- scale léger
- fade
- slide
- skeleton loading
- transitions
- feedback bouton
- toast
- états loading

NE PAS faire d'animations excessives.

L'application doit rester rapide et professionnelle.

---

# 28. LOADING STATES

Chaque page importante doit avoir :

- skeleton
- loading state
- empty state
- error state

INTERDIT :

écran blanc pendant le chargement.

---

# 29. EMPTY STATES

Créer de vrais empty states.

Exemple :

Aucun billet

"Aucun billet pour le moment."

CTA :

"Explorer les événements"

---

# 30. ERROR STATES

Créer des erreurs utilisateur propres.

Exemple :

"Une erreur est survenue."

Bouton :

Réessayer

Ne jamais afficher :

stack trace

erreur technique

secret

détails internes

---

# 31. ACCESSIBILITÉ

Respecter :

- contraste
- focus states
- navigation clavier
- aria-label
- boutons accessibles
- tailles tactiles correctes
- textes lisibles

---

# 32. PERFORMANCE

Ne pas sacrifier les performances pour le design.

Optimiser :

- images
- composants
- lazy loading
- bundle
- fonts
- animations

Utiliser les fonctionnalités Next.js correctement.

---

# 33. IMAGES

Les images d'événements doivent être :

- grandes
- bien cadrées
- optimisées
- responsive

Éviter les images étirées.

Utiliser correctement :

object-cover

aspect-ratio

Next/Image lorsque pertinent.

---

# 34. DESIGN SYSTEM

Créer des composants réutilisables.

Exemples :

Button

Card

EventCard

TicketCard

Badge

Modal

Drawer

Input

SearchBar

Tabs

Avatar

Toast

Skeleton

EmptyState

StatusBadge

GlassPanel

SectionHeader

BottomNav

Sidebar

---

# 35. TYPOGRAPHIE

Utiliser une typographie moderne et professionnelle.

Hiérarchie claire :

H1

H2

H3

body

caption

Les titres doivent être forts.

Le texte secondaire doit être lisible.

---

# 36. DESKTOP — RÈGLE IMPORTANTE

Tester impérativement sur :

1366x768

1440x900

1920x1080

L'application doit exploiter intelligemment l'espace.

Aucun écran ne doit ressembler à :

"une application mobile de 390px posée au centre d'un écran".

---

# 37. MOBILE

Tester impérativement :

320px

375px

390px

430px

Aucun :

overflow horizontal

bouton coupé

texte coupé

modal dépassant de l'écran

navigation inaccessible

---

# 38. TABLET

Tester :

768px

1024px

Le layout doit passer intelligemment entre mobile et desktop.

---

# 39. DARK MODE

Ajouter un toggle :

☀️ Light

🌙 Dark

Le choix doit être sauvegardé.

Respecter également le système :

prefers-color-scheme

---

# 40. CE QU'IL NE FAUT PAS FAIRE

❌ Ne pas supprimer les fonctionnalités du CDC.

❌ Ne pas remplacer le backend fonctionnel.

❌ Ne pas déplacer les secrets côté client.

❌ Ne pas mettre les clés SamirPay dans React.

❌ Ne pas permettre au frontend de choisir librement le montant.

❌ Ne pas contourner les RLS.

❌ Ne pas simuler des données là où les données doivent venir de Supabase.

❌ Ne pas créer uniquement des écrans statiques.

❌ Ne pas utiliser des placeholders à la place des fonctionnalités réelles.

❌ Ne pas créer une interface uniquement mobile.

❌ Ne pas considérer le prototype Stitch comme une copie exacte.

---

# 41. CE QUI DOIT ÊTRE CONSERVÉ

Les fonctionnalités backend déjà validées doivent être conservées :

- Supabase
- PostgreSQL
- RLS
- paiements SamirPay
- webhook
- idempotence
- tickets
- QR codes
- commissions
- Realtime
- réservations
- contrôle d'accès
- PWA

La refonte concerne principalement l'expérience frontend.

Si une modification backend est nécessaire pour connecter correctement une fonctionnalité frontend prévue dans le CDC, elle doit être signalée explicitement et testée.

---

# 42. AVANT DE CODER

Créer d'abord un audit interne :

## A. Pages existantes

Lister toutes les pages existantes.

## B. Pages manquantes

Comparer avec le CDC.

## C. Composants existants

Identifier ceux qui peuvent être conservés.

## D. Composants à refaire

Identifier ceux qui doivent être redesignés.

## E. Fonctionnalités manquantes

Identifier ce qui existe dans le CDC mais pas dans le produit actuel.

## F. Problèmes responsive

Tester mobile/tablette/desktop.

---

# 43. PLAN D'IMPLÉMENTATION

Procéder dans cet ordre :

### Phase 1
Design system global.

### Phase 2
Layout global + navigation.

### Phase 3
Home / Explorer.

### Phase 4
Event Detail.

### Phase 5
Ticket / Commandes.

### Phase 6
Paiement.

### Phase 7
Partenaire.

### Phase 8
Scanner.

### Phase 9
Admin / Superadmin / Contrôleur.

### Phase 10
Profil / Notifications / Parrainage.

### Phase 11
Responsive.

### Phase 12
Dark mode.

### Phase 13
Animations / UX.

### Phase 14
QA complète.

---

# 44. CRITÈRES DE VALIDATION

La refonte sera considérée comme terminée uniquement si :

## Fonctionnel

- CDC entièrement couvert
- aucune fonctionnalité existante cassée
- paiement fonctionnel
- ticket fonctionnel
- QR fonctionnel
- scanner fonctionnel
- réservations fonctionnelles
- commissions fonctionnelles
- Realtime fonctionnel

## Design

- Light mode premium
- Dark mode premium
- Orange Event Village
- glassmorphism subtil
- hiérarchie visuelle claire
- design cohérent
- interface moderne

## Responsive

- 320px ✅
- 375px ✅
- 390px ✅
- 430px ✅
- 768px ✅
- 1024px ✅
- 1366px ✅
- 1440px ✅
- 1920px ✅

## Qualité

npm run lint

npm run typecheck

npm test

npm run build

Toutes les commandes doivent réussir.

---

# 45. RAPPORT FINAL OBLIGATOIRE

À la fin, générer un rapport :

## FRONTEND REDESIGN REPORT

### 1. Pages créées

### 2. Pages refaites

### 3. Pages supprimées

### 4. Fonctionnalités CDC couvertes

### 5. Fonctionnalités CDC encore manquantes

### 6. Backend modifié

### 7. Responsive testé

### 8. Light mode testé

### 9. Dark mode testé

### 10. Tests exécutés

### 11. Bugs trouvés

### 12. Bugs corrigés

### 13. Points restant à tester en production

---

# 🏆 OBJECTIF FINAL

Event Village doit donner cette impression :

"Je suis sur une vraie plateforme professionnelle de réservation et de billetterie événementielle."

Pas :

"Je regarde une maquette Figma."

Pas :

"Je regarde une application mobile centrée dans un écran desktop."

Pas :

"Je regarde un prototype."

Le résultat doit être :

PREMIUM
MODERNE
FLUIDE
RESPONSIVE
INTUITIF
PROFESSIONNEL
COHÉRENT
COMMERCIALISABLE

avec une identité :

🟠 EVENT VILLAGE

WHITE + ORANGE

+

🌙 DARK MODE

+

GLASSMORPHISM SUBTIL

+

UX PREMIUM

+

CDC V3.0 RESPECTÉ À 100 %

---

# 🚨 DERNIÈRE DIRECTIVE

NE PAS commencer par modifier uniquement la page d'accueil.

Commencer par analyser l'intégralité du CDC et l'architecture frontend existante.

Ensuite établir la liste :

1. ce qui est conforme
2. ce qui doit être redesigné
3. ce qui manque
4. ce qui doit être créé
5. ce qui doit être corrigé

Puis réaliser la refonte complète.

Le design Stitch fourni doit servir de référence pour la philosophie visuelle, particulièrement pour la page Event Detail, mais l'ensemble du produit doit avoir UNE SEULE identité visuelle cohérente.

Après implémentation, lancer une campagne complète de tests fonctionnels + responsive + build.

Aucune fonctionnalité du CDC ne doit être déclarée "terminée" uniquement parce qu'un écran existe.

Une fonctionnalité est terminée uniquement lorsqu'elle est :

UI + logique + backend + sécurité + responsive + état loading + état erreur + état succès + testée.

# 🎨 43. IDENTITÉ VISUELLE & LOGO EVENT VILLAGE

La refonte doit également créer une véritable identité visuelle pour Event Village.

## Logo officiel

Créer un **logo original "Event Village"** spécialement conçu pour le projet.

Le logo doit être cohérent avec la nouvelle direction artistique :

- blanc
- orange Event Village
- glassmorphism subtil lorsque pertinent
- premium
- moderne
- événementiel
- dynamique
- facilement reconnaissable
- professionnel
- adapté à une plateforme de billetterie et de réservation

Le logo ne doit PAS ressembler à un logo générique généré automatiquement.

Il doit transmettre les notions suivantes :

- événement
- communauté
- découverte
- réservation
- expérience
- mouvement
- village / rassemblement

## Direction créative

Le symbole peut être construit autour d'une combinaison intelligente de concepts tels que :

- billet
- ticket
- localisation
- événement
- communauté
- "EV"
- mouvement / parcours
- point de rencontre

IMPORTANT :

Ne pas surcharger le logo.

Il doit rester identifiable même en petite taille.

---

## Variantes obligatoires

Créer au minimum :

### 1. Logo principal

Symbole + texte :

EVENT VILLAGE

Version destinée au header principal.

### 2. Logo compact

Symbole uniquement.

Utilisé pour :

- favicon
- PWA
- application mobile
- avatar
- petits espaces

### 3. Version Light

Adaptée aux fonds clairs.

### 4. Version Dark

Adaptée aux fonds sombres.

### 5. Version monochrome

Version blanche/noire permettant une utilisation flexible.

---

## Intégration

Le logo doit être intégré dans toute l'application.

Il doit remplacer les éventuels textes génériques actuellement utilisés comme logo.

Utiliser le logo dans :

- Header
- Sidebar desktop
- Login
- Register
- Home
- Dashboard partenaire
- Dashboard admin
- Superadmin
- Scanner
- PWA
- écran de chargement si pertinent
- favicon

---

## Fichiers

Créer une structure propre permettant de réutiliser le logo.

Exemple :

public/
  branding/
    event-village-logo.svg
    event-village-logo-dark.svg
    event-village-mark.svg
    event-village-mark-dark.svg
    event-village-logo-monochrome.svg

Adapter les noms si une meilleure organisation existe.

Privilégier le format SVG pour le logo afin de garantir une excellente qualité sur tous les écrans.

---

## Favicon & PWA

Le symbole Event Village doit également être utilisé pour :

- favicon
- apple touch icon si nécessaire
- icône PWA
- manifest.json

Prévoir les tailles nécessaires au fonctionnement correct de la PWA.

---

## Logo et responsive

Le logo doit s'adapter aux différentes tailles d'écran.

Desktop :

Symbole + "Event Village"

Tablet :

Symbole + texte selon l'espace disponible.

Mobile :

Symbole ou version compacte si nécessaire.

---

## Logo et Dark Mode

Le logo doit rester parfaitement lisible dans les deux thèmes.

Light :

logo adapté au fond clair.

Dark :

logo adapté au fond sombre.

L'orange Event Village doit rester le principal élément de reconnaissance.

---

## Règle importante

Le logo doit faire partie intégrante du design system.

Il ne faut pas simplement créer une image et la déposer dans le header.

Le logo doit être cohérent avec :

- couleurs
- boutons
- cartes
- icônes
- typographie
- illustrations
- animations
- Dark Mode
- PWA

L'ensemble doit donner une identité visuelle unique à Event Village.

---

# 🏆 CRITÈRE DE VALIDATION DU LOGO

Le logo sera considéré comme terminé uniquement si :

- Logo principal créé ✅
- Logo compact créé ✅
- Light Mode ✅
- Dark Mode ✅
- SVG ✅
- Favicon ✅
- PWA icon ✅
- Header desktop ✅
- Header mobile ✅
- Sidebar desktop ✅
- Pages d'authentification ✅
- Dashboards ✅
- Identité cohérente avec la nouvelle direction artistique ✅

Le logo doit être suffisamment professionnel pour être utilisé ultérieurement sur :

- site web
- application mobile
- réseaux sociaux
- supports marketing
- billets
- QR tickets
- affiches
- communications partenaires