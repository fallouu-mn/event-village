# Diagnostic - Event Village Cancellation & Refund Module

## 1. Ce qui existe déjà

### Enums
- `event_status`: BROUILLON, EN_ATTENTE, VALIDE, PUBLIE, SUSPENDU, TERMINE (manque ANNULE)
- `ticket_status`: VALIDE, UTILISE, ANNULE, REMBOURSE
- `payment_status_enum`: PENDING, PARTIAL, SUCCESS, FAILED, REFUNDED, CANCELLED
- `refund_status_enum`: PENDING, PROCESSED, FAILED
- `ticket_transfer_status`: PENDING, CLAIMED, CANCELLED, EXPIRED

### Tables clés
- `events`: stocke les événements avec statut `event_status`
- `tickets`: stocke les billets avec statut `ticket_id` et lien vers événement
- `payments`: transactions financières, lié aux tickets via `ticket_id`
- `refunds`: remboursements de paiements, lié à `payment_id`
- `ticket_transfers`: transferts P2P de billets

### Services existants
- `EventService`: création d'événements, changement de statut, réservation de billets atomique
- `PaymentService`: 
  - `createPayment`: initialise un paiement
  - `handleSamirPayWebhook`: traite les webhooks de paiement réussis
  - `processRefund`: rembourse un paiement (marque immédiatement le remboursement comme PROCESSED)
- `SamirPayClient`: 
  - `initPayment`: démarre un paiement
  - `checkTransactionStatus`: vérifie le statut d'une transaction
  - `getSolde`: récupère le solde du compte marchand
  - `sendCashout`: envoie un transfert de fonds (Wave/Orange Money)

### Fonctionnalités manquantes
- Statut d'événement `ANNULE` dans l'enum `event_status`
- Table ou mécanisme pour suivre les annulations d'événements (motif, etc.)
- Fonction d'annulation atomique d'événement qui :
  1. Met à jour le statut de l'événement en ANNULE
  2. Met à jour les billets VALIDE en ANNULE (pour bloquer les scans)
  3. Annule les transferts P2P en attente (PENDING -> CANCELLED)
  4. Crée des ordres de remboursement pour chaque paiement associé à un billet
  5. Traite les remboursements via SamirPay cashout
  6. Met à jour le statut des billets en REMBOURSE après remboursement réussi
  7. Met à jour le statut des paiements en REFUNDED après remboursement réussi
- Gestion de l'idempotence pour éviter les double remboursements
- Notifications spécifiques à l'annulation et au remboursement
- Routes API pour l'annulation (partenaire/admin) et le retry de remboursement
- Interface utilisateur pour l'annulation d'événement et le suivi des remboursements

## 2. Ce qui manque

### Base de données
- Ajout de la valeur `ANNULE` à l'enum `event_status`
- (Optionnel) Table `event_cancellations` pour stocker les métadonnées d'annulation (motif interne, message public, etc.)
- Index sur les colonnes utilisées pour les requêtes d'annulation

### Backend
- Nouveau service `EventCancellationService` avec méthodes :
  - `cancelEvent`: annule atomiquement un événement
  - `processEventRefunds`: traite les remboursements d'un événement annulé
  - `retryFailedRefund`: retry un remboursement échoué
- Modification de `EventService` pour empêcher la modification/suppression d'événements ANNULE
- Mise à jour du scanner pour retourner une erreur explicite `EVENT_CANCELLED` pour les billets ANNULE
- Routes API :
  - `POST /api/partner/events/[id]/cancel` (avec vérification de propriété)
  - `POST /api/admin/events/[id]/cancel` (pour les superadmins)
  - `GET /api/partner/events/[id]/cancellation` (pour récupérer les détails d'annulation)
  - `POST /api/admin/refunds/[id]/retry` (superadmin uniquement)

### Frontend
- Modale d'annulation d'événement dans le dashboard partenaire
- Page de suivi des remboursements (dans l'espace partenaire ou admin)
- Mise à jour de la page "Mes Billets" pour afficher ANNULE/REMBOURSE
- Mise à jour de la page d'événement public pour afficher "ANNULATION OFFICIELLE"
- Composants UI réutilisables (badges, modals, etc.)

### Tests
- Suite de tests complète pour l'annulation et les remboursements
- Tests de concurrence (idempotence)
- Tests de sécurité (vérification des rôles)
- Tests de non-régression sur les fonctionnalités existantes

## 3. Risques de régression

- **Modification des enums** : Ajout de `ANNULE` à `event_status` nécessite une migration et peut affecter les requêtes qui filtrent sur les statuts d'événement.
- **Modification du statut des billets** : Le passage de VALIDE à ANNULE puis à REMBOURSE doit être compatible avec le scanner et le checkin atomique.
- **Modification du flux de remboursement** : Le service `PaymentService.processRefund` marque immédiatement les remboursements comme PROCESSED. Pour les remboursements Mobile Money, nous devons différer ce marquage jusqu'à la confirmation du cashout. Cela nécessite soit :
  - Une modification de `processRefund` pour supporter un mode asynchrone (risque de régression)
  - La création d'un nouveau flux de remboursement spécifique à l'annulation d'événement (plus sûr)
- **RLS et permissions** : Toute nouvelle fonction doit respecter les politiques de sécurité existantes.
- **Idempotence** : Un mauvais implémentation pourrait conduire à des double remboursements.

## 4. Fichiers à modifier

### Migrations
- `supabase/migrations/20260910_event_cancellation_and_refunds.sql`: Ajout de l'enum event_status.ANNULE et création de tables si nécessaire

### Backend (TypeScript)
- `lib/events/event.service.ts`: 
  - Ajouter la gestion du statut ANNULE (empêcher modifications après annulation)
  - Possiblement ajouter une méthode pour mettre à jour le statut des billets en lot
- `lib/payments/payment.service.ts`:
  - Éventuellement modifier `processRefund` pour supporter un statut PENDING initial (à faire avec précaution)
  - Ou créer une nouvelle méthode `processEventRefund` pour les remboursements d'annulation
- `lib/events/event-cancellation-service.ts` (nouveau fichier)
- `lib/notifications/cancellation-notifications.service.ts` (nouveau fichier, optionnel)
- `middleware.ts` : Ajouter éventuellement des vérifications de rôle pour les nouvelles routes
- `app/api/partner/events/[id]/cancel/route.ts` (nouveau)
- `app/api/admin/events/[id]/cancel/route.ts` (nouveau)
- `app/api/partner/events/[id]/cancellation/route.ts` (nouveau)
- `app/api/admin/refunds/[id]/retry/route.ts` (nouveau)

### Frontend
- `components/events/EventCancelModal.tsx` (nouveau)
- `components/events/EventCancellationStatus.tsx` (nouveau, pour l'affichage public)
- Mise à jour de `components/tickets/TicketCard.tsx` pour masquer QR/TOTP quand statut ANNULE/REMBOURSE
- Mise à jour de `app/api/controller/scan/route.ts` pour retourner une erreur EVENT_CANCELLED
- Pages dans `app/partner/events/[id]/` pour l'annulation et le suivi des remboursements

### Tests
- `tests/event-cancellation-and-refunds.test.ts` (nouveau fichier de tests d'intégration)
- Mise à jour éventuelle des tests existants si impacté par les changements

## 5. Fichiers à créer

- Supabase migration: `supabase/migrations/20260910_event_cancellation_and_refunds.sql`
- Service d'annulation: `lib/events/event-cancellation-service.ts`
- Service de notifications d'annulation: `lib/notifications/cancellation-notifications.service.ts` (optionnel)
- Routes API:
  - `app/api/partner/events/[id]/cancel/route.ts`
  - `app/api/admin/events/[id]/cancel/route.ts`
  - `app/api/partner/events/[id]/cancellation/route.ts`
  - `app/api/admin/refunds/[id]/retry/route.ts`
- Composants UI:
  - `components/events/EventCancelModal.tsx`
  - `components/events/EventCancellationStatus.tsx`
- Tests:
  - `tests/event-cancellation-and-refunds.test.ts`

## 6. Prochaine étape

Commencer par créer la migration de base de données pour ajouter le statut `ANNULE` à `event_status` et créer les tables de soutien nécessaires.