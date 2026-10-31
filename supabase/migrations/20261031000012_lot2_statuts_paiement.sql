-- ============================================================================
-- EVENT VILLAGE — LOT 2 : nouveaux statuts de paiement
-- ============================================================================
-- Fichier séparé : une valeur ajoutée à un enum n'est utilisable qu'après validation de la
-- transaction qui l'ajoute (la migration suivante s'en sert dans des fonctions et des index).
--  - EXPIRED : abandon local (réservation échue, SamirPay toujours PENDING) ; un succès tardif
--    chez SamirPay reste rattrapé par la réconciliation (émission ou remboursement) ;
--  - REFUND_PENDING : argent encaissé mais panier impossible à honorer (aucun billet émis,
--    remboursement en cours) ; REFUNDED une fois le cashout confirmé.
-- ============================================================================

ALTER TYPE public.payment_status_enum ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE public.payment_status_enum ADD VALUE IF NOT EXISTS 'REFUND_PENDING';
