-- ============================================================================
-- EVENT VILLAGE — LOT 3 : statut de billet intermédiaire (3.4)
-- ============================================================================
-- REMBOURSEMENT_EN_COURS : billet dont le remboursement est demandé mais pas encore versé.
-- Il n'est plus valable à l'entrée (le contrôle n'accepte que VALIDE) et ne passe REMBOURSE
-- qu'une fois le versement confirmé. Valeur ajoutée seule (ALTER TYPE … ADD VALUE ne peut pas
-- être utilisée dans la même transaction que sa création).
-- ============================================================================

ALTER TYPE public.ticket_status ADD VALUE IF NOT EXISTS 'REMBOURSEMENT_EN_COURS';
