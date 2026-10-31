-- ============================================================================
-- EVENT VILLAGE — MIGRATION 20260907 : HOLD CART (RÉSERVATION TEMPORAIRE DE STOCK)
-- ============================================================================

-- 1. Ajout de la colonne held_quantity sur ticket_categories
ALTER TABLE public.ticket_categories
    ADD COLUMN IF NOT EXISTS held_quantity INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ticket_categories.held_quantity IS 'Quantité de billets temporairement réservés par des paiements en cours (TTL 10 min)';

-- 2. Mise à jour de la contrainte CHECK de dernier recours
ALTER TABLE public.ticket_categories
    DROP CONSTRAINT IF EXISTS chk_ticket_categories_quantities;

ALTER TABLE public.ticket_categories
    ADD CONSTRAINT chk_ticket_categories_quantities
    CHECK (sold_quantity >= 0 AND held_quantity >= 0 AND (sold_quantity + held_quantity) <= total_quantity);

-- 3. Ajout de la colonne held_expires_at sur payments
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS held_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.payments.held_expires_at IS 'Date d''expiration du hold temporaire de stock (généralement now() + 10 min)';

-- 4. Index d'optimisation pour le nettoyage des holds expirés
CREATE INDEX IF NOT EXISTS idx_payments_held_expiration
    ON public.payments(payment_target, status, held_expires_at)
    WHERE status = 'PENDING' AND payment_target = 'TICKET';
