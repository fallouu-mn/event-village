-- ============================================================================
-- EVENT VILLAGE — MIGRATION : TRANSFERT SÉCURISÉ DE BILLET P2P (CHANTIER 2)
-- ============================================================================

-- 1. Enum du statut de transfert
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_transfer_status') THEN
        CREATE TYPE ticket_transfer_status AS ENUM (
            'PENDING',
            'CLAIMED',
            'CANCELLED',
            'EXPIRED'
        );
    END IF;
END $$;

-- 2. Colonnes sur la table tickets
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS transfer_locked BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS security_version INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_tickets_security_version'
    ) THEN
        ALTER TABLE public.tickets
        ADD CONSTRAINT chk_tickets_security_version CHECK (security_version >= 1);
    END IF;
END $$;

COMMENT ON COLUMN public.tickets.transfer_locked IS 'Indique si le billet est engagé dans un transfert PENDING actif';
COMMENT ON COLUMN public.tickets.security_version IS 'Numéro de version de sécurité incrémenté à chaque transfert pour révoquer l''ancien QR Code';

-- 3. Table ticket_transfers
CREATE TABLE IF NOT EXISTS public.ticket_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE RESTRICT,
    from_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    to_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    to_phone_or_email TEXT NOT NULL,
    status ticket_transfer_status NOT NULL DEFAULT 'PENDING',
    claim_token_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    claimed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    CONSTRAINT chk_ticket_transfers_dates CHECK (expires_at > created_at),
    CONSTRAINT chk_ticket_transfers_claimed CHECK (
        status != 'CLAIMED' OR (claimed_at IS NOT NULL AND to_user_id IS NOT NULL)
    ),
    CONSTRAINT chk_ticket_transfers_cancelled CHECK (
        status != 'CANCELLED' OR cancelled_at IS NOT NULL
    ),
    CONSTRAINT chk_ticket_transfers_expired CHECK (
        status != 'EXPIRED' OR expired_at IS NOT NULL
    )
);

COMMENT ON TABLE public.ticket_transfers IS 'Historique et suivi des transferts sécurisés de billets P2P';

-- 4. Contrainte UNIQUE PARTIELLE : Exactement 1 seul transfert PENDING par billet à la fois
CREATE UNIQUE INDEX IF NOT EXISTS uq_ticket_transfers_pending_per_ticket
    ON public.ticket_transfers (ticket_id)
    WHERE (status = 'PENDING');

-- 5. Index de recherche et performance
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_claim_token_hash
    ON public.ticket_transfers (claim_token_hash);

CREATE INDEX IF NOT EXISTS idx_ticket_transfers_from_user
    ON public.ticket_transfers (from_user_id);

CREATE INDEX IF NOT EXISTS idx_ticket_transfers_to_user
    ON public.ticket_transfers (to_user_id);

CREATE INDEX IF NOT EXISTS idx_ticket_transfers_ticket_id
    ON public.ticket_transfers (ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_transfers_pending_expires
    ON public.ticket_transfers (expires_at)
    WHERE (status = 'PENDING');

-- 6. Politiques RLS
ALTER TABLE public.ticket_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ticket_transfers_select" ON public.ticket_transfers;
CREATE POLICY "ticket_transfers_select" ON public.ticket_transfers
    FOR SELECT TO authenticated
    USING (
        from_user_id = auth.uid()
        OR to_user_id = auth.uid()
        OR is_admin()
    );

DROP POLICY IF EXISTS "ticket_transfers_insert" ON public.ticket_transfers;
CREATE POLICY "ticket_transfers_insert" ON public.ticket_transfers
    FOR INSERT TO authenticated
    WITH CHECK (
        from_user_id = auth.uid()
        OR is_admin()
    );

DROP POLICY IF EXISTS "ticket_transfers_update_admin" ON public.ticket_transfers;
CREATE POLICY "ticket_transfers_update_admin" ON public.ticket_transfers
    FOR UPDATE TO authenticated
    USING (is_admin());

DROP POLICY IF EXISTS "ticket_transfers_delete_admin" ON public.ticket_transfers;
CREATE POLICY "ticket_transfers_delete_admin" ON public.ticket_transfers
    FOR DELETE TO authenticated
    USING (is_admin());
