# EVENT VILLAGE — ARCHITECTURE TECHNIQUE

Version : 1.0
Référence fonctionnelle : Cahier des Charges V3.0 — Août 2026
Statut : Document de référence technique

---

# 1. OBJECTIF

Event Village est une plateforme digitale Web + Mobile permettant :

- découverte d'événements ;
- recherche de restaurants ;
- recherche de salles ;
- découverte de prestataires ;
- réservation ;
- ticketing ;
- réservation de tables ;
- commande de produits ;
- paiement ;
- livraison ;
- communication ;
- promotion ;
- parrainage ;
- statistiques ;
- administration.

Le principe fondamental est :

UN COMPTE → PLUSIEURS SERVICES

La plateforme doit être conçue comme une application unique,
modulaire et évolutive.

---

# 2. PRINCIPES D'ARCHITECTURE

## 2.1 Source de vérité

Le Cahier des Charges V3.0 constitue la référence fonctionnelle.

Aucun agent de développement ne doit inventer une règle métier
qui n'est pas définie dans le CDC ou dans les documents techniques
validés.

En cas d'ambiguïté :

1. identifier le problème ;
2. ne pas inventer une règle ;
3. documenter la question ;
4. demander validation.

---

# 3. STACK TECHNIQUE

## Frontend

- Next.js
- TypeScript
- Tailwind CSS
- Framer Motion
- PWA

## Backend

- Next.js Route Handlers
- Server Actions lorsque pertinent
- TypeScript

## Base de données

- Supabase
- PostgreSQL

## Authentification

- Supabase Auth
- OTP
- gestion des sessions

## Temps réel

- Supabase Realtime

## Paiement

- SamirPay API

## Stockage

- Supabase Storage

## Validation

- Zod

## Tests

- Vitest
- Playwright

---

# 4. ARCHITECTURE GLOBALE

                         EVENT VILLAGE
                              |
              +---------------+---------------+
              |               |               |
           CLIENT         PARTENAIRE      ADMINISTRATION
              |               |               |
              +---------------+---------------+
                              |
                         NEXT.JS PWA
                              |
                       NEXT.JS BACKEND
                              |
             +----------------+----------------+
             |                |                |
          Supabase         SamirPay       Services externes
          PostgreSQL       Payment        SMS / WhatsApp / Email
          Auth             Webhooks
          Realtime
          Storage

---

# 5. ARCHITECTURE PWA

Event Village sera développé comme une PWA responsive.

La même application doit pouvoir être utilisée :

- sur smartphone ;
- tablette ;
- ordinateur.

Le mobile n'est pas une application native séparée.

Le frontend doit être mobile-first.

## Objectifs PWA

- installation sur smartphone ;
- interface adaptée au mobile ;
- navigation fluide ;
- cache des ressources statiques ;
- possibilité d'afficher certaines données hors connexion
  lorsque cela est techniquement pertinent ;
- notifications Push lorsque l'infrastructure le permet.

Les opérations financières ne doivent jamais dépendre
d'un état local hors ligne.

---

# 6. STRUCTURE NEXT.JS

Structure recommandée :

app/
  (public)/
  (client)/
  (partner)/
  (admin)/
  api/

components/
  ui/
  client/
  partner/
  admin/
  shared/

lib/
  supabase/
  samirpay/
  payments/
  referrals/
  notifications/
  qr/
  validations/

hooks/
  use-realtime.ts
  use-orders.ts
  use-notifications.ts

supabase/
  migrations/
  functions/
  seed.sql

docs/
  CDC-V3.md
  architecture.md
  database.md
  payments.md
  realtime.md

agents/
  AGENTS.md
  agent-ui.md
  agent-database.md
  agent-backend.md
  agent-payment.md
  agent-realtime.md
  agent-pwa.md
  agent-security.md
  agent-testing.md

public/

---

# 7. MODULES MÉTIER

La plateforme est divisée en modules.

## Module 1 — Comptes

- inscription ;
- authentification ;
- OTP ;
- récupération ;
- profil ;
- préférences.

## Module 2 — Marketplace

- recherche ;
- catégories ;
- filtres ;
- découverte ;
- localisation ;
- pages professionnelles.

## Module 3 — Événements

- création ;
- publication ;
- programme ;
- informations pratiques ;
- services associés.

## Module 4 — Ticketing

- catégories ;
- prix ;
- quantités ;
- vente ;
- paiement ;
- QR Code ;
- contrôle ;
- remboursement.

## Module 5 — Réservation de salles

- catalogue ;
- disponibilité ;
- calendrier ;
- réservation ;
- acompte ;
- moratoire ;
- paiement ;
- annulation.

## Module 6 — Réservation de tables

- restaurants ;
- zones ;
- tables ;
- capacité ;
- disponibilité ;
- réservation ;
- acompte ;
- paiement hors plateforme.

## Module 7 — Commande & Vente

- catalogue ;
- produits ;
- plat du jour ;
- panier ;
- commande ;
- paiement ;
- acompte ;
- paiement différé ;
- livraison ;
- retrait ;
- consommation sur place.

## Module 8 — Finance

- transactions ;
- frais ;
- revenus ;
- soldes ;
- remboursements ;
- retraits ;
- rapprochement.

## Module 9 — Parrainage

- parrainage Client ;
- parrainage Prestataire ;
- génération 1 ;
- génération 2 ;
- commissions ;
- Ambassadeurs ;
- anti-fraude ;
- retraits.

## Module 10 — Communication

- SMS ;
- WhatsApp ;
- Email ;
- Push ;
- segmentation ;
- campagnes.

## Module 11 — Monétisation

- Starter ;
- Business ;
- Premium ;
- période d'essai ;
- promotion ;
- mise en avant.

## Module 12 — Analytics

- statistiques Client ;
- statistiques Partenaire ;
- statistiques Commandes ;
- statistiques Événements ;
- Finance ;
- Parrainage ;
- ROI.

## Module 13 — Administration

- utilisateurs ;
- partenaires ;
- services ;
- finance ;
- parrainage ;
- ambassadeurs ;
- permissions ;
- journal d'activité.

---

# 8. RÔLES

Les rôles métier sont :

CLIENT
PARTENAIRE
ADMINISTRATEUR
CONTRÔLEUR
SUPERADMINISTRATEUR

IMPORTANT :

AMBASSADEUR N'EST PAS UN RÔLE.

Le système doit utiliser :

role = CLIENT

et :

referral_status =
  STANDARD
  ou
  AMBASSADEUR

---

# 9. PARTENAIRE MULTI-ACTIVITÉS

Un Partenaire possède un seul compte.

Un même Partenaire peut exercer plusieurs activités :

- restaurant ;
- traiteur ;
- salle ;
- organisateur ;
- prestataire ;
- pâtisserie ;
- établissement alimentaire ;
- autre activité autorisée.

Il ne faut donc pas créer un compte différent
pour chaque activité.

---

# 10. BASE DE DONNÉES

Le modèle de données doit couvrir au minimum :

## Utilisateurs

users

Champs principaux :

- id
- first_name
- last_name
- phone
- email
- role
- status
- referral_status
- created_at

---

## Partenaires

partners

- id
- user_id
- status
- trial_started_at
- trial_ends_at
- subscription_plan_id

---

## Activités partenaires

partner_activities

- id
- partner_id
- activity_type

---

## Événements

events

- id
- partner_id
- title
- description
- date
- time
- location
- image
- status

---

## Tickets

tickets

- id
- event_id
- category_id
- user_id
- price
- qr_code
- status

---

## Catégories de tickets

ticket_categories

- id
- event_id
- name
- price
- quantity
- sale_start
- sale_end

---

## Réservations

reservations

- id
- client_id
- partner_id
- type
- date
- time
- amount
- deposit
- balance
- payment_status
- status

---

## Produits

products

- id
- partner_id
- category_id
- name
- description
- price
- stock
- availability
- status

---

## Commandes

orders

- id
- client_id
- partner_id
- total
- paid_amount
- balance
- payment_status
- delivery_status
- order_status
- created_at

---

## Lignes de commande

order_items

- id
- order_id
- product_id
- quantity
- unit_price
- total

IMPORTANT :

Le prix d'une ligne de commande doit être conservé
au moment de la commande.

Une modification future du prix du produit
ne doit pas modifier une ancienne commande.

---

# 11. PAIEMENTS

Table principale :

payments

Elle doit conserver au minimum :

- id ;
- transaction_id ;
- order_id ;
- client_id ;
- partner_id ;
- amount ;
- payment_method ;
- aggregator ;
- aggregator_fee ;
- gross_event_village_revenue ;
- net_event_village_revenue ;
- status ;
- created_at ;
- updated_at.

---

# 12. DISTINCTION PAIEMENT PLATEFORME / HORS PLATEFORME

Deux catégories doivent être distinguées.

## Paiement Event Village

L'argent passe par la plateforme.

Le système comptabilise :

- transaction ;
- montant ;
- frais ;
- revenu Event Village ;
- revenu net ;
- commission éventuelle.

## Paiement hors plateforme

Exemples :

- espèces ;
- Wave direct ;
- Orange Money direct ;
- autre moyen.

Ces paiements doivent être enregistrés
lorsque nécessaire mais ne doivent pas alimenter
le solde financier Event Village.

---

# 13. ARCHITECTURE SAMIRPAY

Le navigateur ne doit JAMAIS appeler SamirPay
avec la clé secrète.

Architecture :

PWA
 |
 | demande paiement
 ↓
Next.js Backend
 |
 | X-API-KEY
 | X-SECRET-KEY
 ↓
SamirPay
 |
 ↓
Transaction
 |
 ↓
Webhook SamirPay
 |
 ↓
Next.js
 |
 ↓
PostgreSQL
 |
 ↓
Supabase Realtime
 |
 ↓
PWA

---

# 14. SECRETS SAMIRPAY

Les credentials doivent uniquement être disponibles
côté serveur.

INTERDIT :

NEXT_PUBLIC_SAMIR_SECRET_KEY

INTERDIT :

exposer X-SECRET-KEY dans le navigateur.

Les secrets doivent être stockés dans les variables
d'environnement serveur.

---

# 15. FLOW DE PAIEMENT

Le flow standard est :

1. Client sélectionne un service.
2. Frontend crée une demande de paiement.
3. Backend valide la demande.
4. Backend crée la transaction.
5. Backend appelle SamirPay.
6. SamirPay retourne les informations nécessaires.
7. Client effectue le paiement.
8. SamirPay traite la transaction.
9. SamirPay appelle le webhook.
10. Backend vérifie la transaction.
11. Backend met à jour la base.
12. Les règles financières sont exécutées.
13. Supabase Realtime informe le frontend.
14. L'interface affiche le nouvel état.

---

# 16. WEBHOOK SAMIRPAY

Endpoint :

POST /api/webhooks/samirpay

Le webhook doit :

1. recevoir l'événement ;
2. identifier la transaction ;
3. retrouver la commande ;
4. vérifier l'état ;
5. empêcher le double traitement ;
6. mettre à jour la transaction ;
7. mettre à jour l'objet métier concerné ;
8. déclencher les traitements financiers nécessaires ;
9. enregistrer l'opération ;
10. répondre correctement à SamirPay.

Le traitement doit être idempotent.

Un même webhook reçu plusieurs fois
ne doit jamais créer plusieurs paiements
ou plusieurs commissions.

---

# 17. ÉTATS DES PAIEMENTS

Utiliser des états explicites.

Exemple :

PENDING
SUCCESS
FAILED
CANCELLED
REFUNDED

Les transitions doivent être contrôlées côté serveur.

Le frontend ne doit jamais pouvoir déclarer :

payment.status = SUCCESS

---

# 18. TEMPS RÉEL

Event Village utilise Supabase Realtime.

Le temps réel doit être utilisé notamment pour :

- commandes ;
- disponibilité ;
- livraison ;
- paiements confirmés ;
- notifications ;
- certains tableaux de bord ;
- événements nécessitant une mise à jour dynamique.

Architecture :

PostgreSQL
    ↓
Supabase Realtime
    ↓
Client PWA

---

# 19. TEMPS RÉEL ET PAIEMENT

IMPORTANT :

Realtime n'est PAS la source de vérité du paiement.

La source de vérité est :

SamirPay
+
Backend
+
PostgreSQL

Realtime sert uniquement à transmettre
le changement d'état au frontend.

---

# 20. DISPONIBILITÉS

Les disponibilités doivent être contrôlées
côté serveur.

Exemples :

- salle ;
- table ;
- produit ;
- stock ;
- ticket.

Le frontend peut afficher une disponibilité,
mais ne doit jamais être considéré comme
la source de vérité.

---

# 21. CONCURRENCE

Les opérations sensibles doivent être protégées
contre les doubles réservations et les doubles achats.

Exemple :

Deux utilisateurs tentent de réserver
la même table simultanément.

Le serveur doit garantir qu'une seule réservation
peut être confirmée.

La logique doit être appliquée au niveau
de PostgreSQL / transaction serveur.

---

# 22. PARRAINAGE

Le parrainage est intégré au compte Client.

Deux types :

INVITER UN CLIENT

INVITER UN PRESTATAIRE

Le système conserve la nature du lien.

---

# 23. RÈGLES DE PARRAINAGE

Client standard :

Client → Client

N1 = 5 %
N2 = 2 %
Durée = 12 mois

Client standard :

Client → Prestataire

N1 = 7 %
N2 = 2 %
Durée = 24 mois

Ambassadeur :

Client → Client

N1 = 7 %
N2 = 2 %
Durée = 24 mois

Ambassadeur :

Client → Prestataire

N1 = 10 %
N2 = 3 %
Durée = 36 mois

---

# 24. BASE DE CALCUL DU PARRAINAGE

Le parrainage est calculé sur :

REVENU NET EVENT VILLAGE ÉLIGIBLE

et NON sur le montant brut payé.

Flow :

Transaction
 ↓
Montant brut
 ↓
Frais agrégateur
 ↓
Revenu Event Village
 ↓
Revenu net éligible
 ↓
Commission N1
 ↓
Commission N2

---

# 25. COMMISSIONS

États :

PENDING
AVAILABLE
PAID
CANCELLED

Une commission doit conserver :

- parrain ;
- filleul ;
- génération ;
- transaction ;
- base de calcul ;
- taux ;
- montant ;
- statut ;
- date.

---

# 26. REMBOURSEMENTS

Lorsqu'une transaction est remboursée :

- transaction corrigée ;
- revenu Event Village corrigé ;
- commission corrigée ;
- historique conservé.

Une modification rétroactive
doit être interdite sans traçabilité.

---

# 27. HISTORISATION FINANCIÈRE

Les données financières importantes
ne doivent pas simplement être recalculées
à partir de données actuelles.

Le système doit conserver les valeurs
ayant servi à la transaction.

Exemple :

commission_rate_at_transaction

et non uniquement :

current_commission_rate

---

# 28. AUDIT LOG

Les opérations sensibles doivent être historisées.

Table :

audit_logs

Informations :

- user_id ;
- role ;
- action ;
- object_type ;
- object_id ;
- old_value ;
- new_value ;
- timestamp.

Les modifications financières,
permissions et paramètres de parrainage
doivent être traçables.

---

# 29. SÉCURITÉ

Principes :

- RLS Supabase ;
- permissions côté serveur ;
- validation Zod ;
- secrets côté serveur ;
- OTP pour opérations sensibles ;
- audit logs ;
- contrôle des permissions ;
- protection des API ;
- validation des webhooks ;
- protection contre les doubles transactions.

---

# 30. RLS

La sécurité ne doit pas dépendre uniquement
du frontend.

Exemple :

Un Client ne doit accéder
qu'à ses propres :

- commandes ;
- réservations ;
- tickets ;
- paiements ;
- commissions.

Un Partenaire ne doit accéder
qu'aux données liées à son organisation
et à ses activités autorisées.

Le Superadmin dispose des permissions
définies par le CDC.

---

# 31. QR CODES

Les tickets possèdent un QR Code unique.

Le QR doit être :

- unique ;
- sécurisé ;
- vérifiable ;
- historisé.

Le contrôle doit être effectué côté serveur.

Le frontend ne doit pas simplement considérer
un QR comme valide sans vérification backend.

---

# 32. NOTIFICATIONS

Canaux prévus :

- SMS ;
- WhatsApp ;
- Email ;
- Push.

Les notifications importantes doivent être
déclenchées à partir d'événements métier.

Exemple :

Commande confirmée
 ↓
Notification

Commande prête
 ↓
Notification

Paiement confirmé
 ↓
Notification

---

# 33. ARCHITECTURE DES SERVICES

Les règles métier importantes doivent être isolées
dans des services.

Exemple :

lib/
  payments/
    payment.service.ts

  referrals/
    referral.service.ts

  orders/
    order.service.ts

  reservations/
    reservation.service.ts

  tickets/
    ticket.service.ts

  notifications/
    notification.service.ts

Les Route Handlers doivent rester fins.

Ils ne doivent pas contenir toute la logique métier.

---

# 34. API

Les API doivent être organisées par domaine.

Exemple :

/api/auth
/api/events
/api/tickets
/api/reservations
/api/orders
/api/payments
/api/referrals
/api/notifications
/api/partners

Paiement externe :

/api/webhooks/samirpay

---

# 35. VALIDATION

Toutes les données provenant du client
doivent être validées côté serveur.

Utiliser Zod.

Exemple :

CreateOrderSchema
CreateReservationSchema
CreatePaymentSchema
CreateProductSchema

Le frontend peut également valider
pour améliorer l'expérience,
mais la validation serveur reste obligatoire.

---

# 36. PERFORMANCE

Principes :

- Server Components lorsque pertinent ;
- Client Components uniquement lorsque nécessaire ;
- chargement progressif ;
- images optimisées ;
- pagination ;
- indexes PostgreSQL ;
- requêtes ciblées ;
- éviter les requêtes inutiles ;
- cache lorsque pertinent ;
- Realtime uniquement sur les données nécessitant
  réellement une mise à jour temps réel.

Le glassmorphism et les animations
ne doivent pas dégrader les performances mobiles.

---

# 37. DESIGN

Direction artistique :


- glassmorphism ;
- interface premium ;
- animations fluides ;
- expérience intuitive.

Le glassmorphism doit être utilisé avec modération.

Priorités :

1. lisibilité ;
2. performance ;
3. accessibilité ;
4. navigation ;
5. esthétique.

Les dashboards contenant beaucoup de données
doivent privilégier la lisibilité plutôt que
les effets visuels.

---

# 38. MOBILE

L'expérience mobile est prioritaire.

Les écrans principaux doivent être conçus
pour smartphone avant desktop.

Le système doit fonctionner avec :

- navigation tactile ;
- boutons suffisamment grands ;
- formulaires adaptés ;
- listes optimisées ;
- chargement rapide ;
- faible consommation réseau.

---

# 39. TESTS

Les tests doivent couvrir :

## Fonctionnels

- inscription ;
- OTP ;
- recherche ;
- réservation ;
- commande ;
- ticket ;
- paiement.

## Paiement

- pending ;
- success ;
- failed ;
- refund ;
- webhook ;
- doublon webhook.

## Sécurité

- permissions ;
- RLS ;
- accès interdit ;
- secrets ;
- API.

## Métier

- commissions ;
- parrainage ;
- génération 1 ;
- génération 2 ;
- remboursement.

## E2E

Tester les parcours :

Client
 ↓
Découverte
 ↓
Réservation
 ↓
Paiement
 ↓
Confirmation

et :

Client
 ↓
Commande
 ↓
Paiement
 ↓
Préparation
 ↓
Livraison

---

# 40. DÉPLOIEMENT

Environnements :

DEVELOPMENT
 ↓
TEST
 ↓
PREPRODUCTION
 ↓
PRODUCTION

Les credentials Sandbox SamirPay
ne doivent jamais être utilisés en production.

Les credentials Production
ne doivent jamais être utilisés en développement.

---

# 41. VARIABLES D'ENVIRONNEMENT

Exemple :

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

SAMIRPAY_API_URL=
SAMIRPAY_API_KEY=
SAMIRPAY_SECRET_KEY=

Les secrets ne doivent jamais être préfixés
par NEXT_PUBLIC_.

---

# 42. RÈGLES POUR LES AGENTS ANTIGRAVITY

## Règle 1

Ne jamais modifier une règle métier du CDC
sans validation.

## Règle 2

Ne jamais exposer de secret.

## Règle 3

Ne jamais faire confiance au frontend
pour une opération financière.

## Règle 4

Ne jamais considérer Realtime
comme source de vérité.

## Règle 5

Ne jamais créer un rôle Ambassadeur.

## Règle 6

Ne jamais modifier rétroactivement
une commission déjà acquise.

## Règle 7

Toute opération financière doit être
idempotente.

## Règle 8

Toute donnée sensible doit être protégée
par les permissions et RLS appropriées.

## Règle 9

Un agent ne doit pas modifier le travail
d'un autre domaine sans vérifier son contrat.

## Règle 10

Avant toute modification importante :

- analyser le code existant ;
- identifier les dépendances ;
- modifier ;
- tester ;
- documenter.

---

# 43. ORDRE DE DÉVELOPPEMENT

Le développement doit respecter :

1. Cadrage / UX
2. Socle
3. Marketplace
4. Événements + Ticketing
5. Réservations
6. Commande & Vente
7. Finance
8. Communication
9. Parrainage
10. Monétisation
11. API / intégrations
12. Analytics
13. Tests
14. Pilote
15. Lancement

---

# 44. RÈGLE FINALE

La plateforme doit rester :

MODULAIRE
SÉCURISÉE
PERFORMANTE
TESTABLE
MAINTENABLE
ÉVOLUTIVE

L'architecture doit permettre d'ajouter
de nouveaux services sans réécrire
l'ensemble de l'application.

Le principe fondamental reste :

UN COMPTE → PLUSIEURS SERVICES

---

# CONFIGURATION — EVENT VILLAGE

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- Supabase Realtime
- PWA
- SamirPay API
- Webhooks
- Framer Motion

## Paiement — SamirPay

Event Village utilise SamirPay comme agrégateur de paiement.

Les credentials SamirPay sont exclusivement accessibles côté serveur.

Variables d'environnement obligatoires :

SAMIRPAY_API_URL=
SAMIRPAY_API_KEY=
SAMIRPAY_SECRET_KEY=

NE JAMAIS :
- exposer SAMIRPAY_SECRET_KEY au frontend
- utiliser NEXT_PUBLIC_SAMIRPAY_SECRET_KEY
- mettre une clé réelle dans le repository
- mettre une clé réelle dans agent.md
- mettre une clé réelle dans le code source

Le frontend PWA communique uniquement avec les Route Handlers/API du backend Next.js.

Architecture paiement :

Client PWA
    ↓
Next.js Route Handler
    ↓
SamirPay API
    ↓
SamirPay
    ↓
Webhook SamirPay
    ↓
Next.js Webhook Handler
    ↓
Supabase/PostgreSQL
    ↓
Supabase Realtime
    ↓
PWA

## Environnements

Développement :
SAMIRPAY_API_URL=https://sandbox.samirpay.com/samirpays

Production :
SAMIRPAY_API_URL=https://app.samirpay.com/samirpays

Ne jamais mélanger les credentials Sandbox et Production.

## Superadministrateur

Le numéro initial du Superadministrateur est :

773780756

Le rôle technique est :

SUPERADMIN

Ce numéro doit être configurable via :

SUPERADMIN_PHONE=

Ne jamais hardcoder ce numéro dans les composants frontend.

La création du Superadmin doit être réalisée côté serveur via un seed ou une procédure d'administration sécurisée.

## Sécurité

Toutes les opérations sensibles doivent être exécutées côté serveur :

- Paiements
- Vérification des paiements
- Remboursements
- Retraits
- Calcul des commissions
- Modification des taux de parrainage
- Création/modification des rôles
- Administration financière

Le frontend ne doit jamais être considéré comme source de vérité.

## Temps réel

Supabase Realtime sera utilisé pour les événements nécessitant une mise à jour temps réel :

- statut d'une commande
- statut d'une réservation
- statut d'un paiement
- disponibilité d'une salle
- disponibilité d'une table
- stock d'un produit
- notifications
- contrôle de ticket
- mises à jour du dashboard

La base PostgreSQL reste la source de vérité.

Le temps réel sert à propager les changements, pas à remplacer les validations backend.

## Webhooks

Les webhooks de paiement doivent être traités côté serveur.

Le webhook doit :

1. recevoir la notification SamirPay
2. identifier la transaction
3. retrouver la commande Event Village
4. vérifier l'état réel de la transaction
5. empêcher les doublons
6. mettre à jour la transaction
7. mettre à jour la commande/réservation/ticket
8. déclencher les traitements financiers nécessaires
9. publier le changement via Supabase Realtime

Le traitement doit être idempotent.

Un même webhook reçu plusieurs fois ne doit jamais créer deux paiements,
deux tickets ou deux commissions.

## Variables d'environnement

Toutes les variables sensibles doivent être dans `.env.local`
en développement et dans les variables d'environnement du serveur
en production.

Exemple :

SAMIRPAY_API_URL=
SAMIRPAY_API_KEY=
SAMIRPAY_SECRET_KEY=
SUPERADMIN_PHONE=

Ne jamais commit `.env.local`.

Le fichier `.env.example` peut contenir uniquement les noms :

SAMIRPAY_API_URL=
SAMIRPAY_API_KEY=
SAMIRPAY_SECRET_KEY=
SUPERADMIN_PHONE=


# FIN