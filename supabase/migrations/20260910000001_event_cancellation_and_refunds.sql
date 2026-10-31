-- ============================================================================
-- EVENT VILLAGE — MIGRATION 20260910 : EVENT CANCELLATION AND REFUNDS
-- ============================================================================
-- Description : Ajout du statut ANNULE aux événements et infrastructure pour
--               le remboursement des billets via Mobile Money (Wave/Orange Money)
-- Référence : Cahier des Charges V3.0 & Spécifications techniques d'annulation
-- ============================================================================

-- 1. Ajout du statut ANNULE à l'enum event_status
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ANNULE' AND enumtypid = 'event_status'::regtype) THEN
        ALTER TYPE event_status ADD VALUE 'ANNULE';
    END IF;
END $$;

-- 2. Table pour stocker les métadonnées d'annulation d'événement
CREATE TABLE IF NOT EXISTS public.event_cancellations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    cancelled_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    internal_reason TEXT NOT NULL,  -- Motif interne (admin/partner)
    public_notice TEXT,             -- Message affiché aux utilisateurs
    cancelled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_event_cancellations_event_id ON public.event_cancellations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_cancellations_cancelled_by ON public.event_cancellations(cancelled_by);
CREATE INDEX IF NOT EXISTS idx_event_cancellations_cancelled_at ON public.event_cancellations(cancelled_at);

-- 4. Politiques RLS pour event_cancellations
ALTER TABLE public.event_cancellations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_cancellations_select" ON public.event_cancellations;
CREATE POLICY "event_cancellations_select" ON public.event_cancellations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_cancellations.event_id
            AND events.partner_id = (
                SELECT partner_id FROM partners WHERE user_id = auth.uid()
            )
        )
        OR is_admin()
    );

DROP POLICY IF EXISTS "event_cancellations_insert" ON public.event_cancellations;
CREATE POLICY "event_cancellations_insert" ON public.event_cancellations
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_cancellations.event_id
            AND events.partner_id = (
                SELECT partner_id FROM partners WHERE user_id = auth.uid()
            )
        )
        OR is_admin()
    );

DROP POLICY IF EXISTS "event_cancellations_update" ON public.event_cancellations;
CREATE POLICY "event_cancellations_update" ON public.event_cancellations
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_cancellations.event_id
            AND events.partner_id = (
                SELECT partner_id FROM partners WHERE user_id = auth.uid()
            )
        )
        OR is_admin()
    );

DROP POLICY IF EXISTS "event_cancellations_delete" ON public.event_cancellations;
CREATE POLICY "event_cancellations_delete" ON public.event_cancellations
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_cancellations.event_id
            AND events.partner_id = (
                SELECT partner_id FROM partners WHERE user_id = auth.uid()
            )
        )
        OR is_admin()
    );

-- 5. Ajout de commentaires pour la documentation
COMMENT ON TABLE public.event_cancellations IS 'Table stockant les métadonnées d''annulation d''événement (motif interne, message public, etc.)';
COMMENT ON COLUMN public.event_cancellations.internal_reason IS 'Motif interne de l''annulation (visible uniquement par l''organisateur et les admins)';
COMMENT ON COLUMN public.event_cancellations.public_notice IS 'Message affiché publiquement lorsqu''un événement est annulé';

-- 6. Vérification que l'enum a bien été mise à jour
DO $$
DECLARE
    v_values TEXT;
BEGIN
    SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder)
    INTO v_values
    FROM pg_enum
    WHERE enumtypid = 'event_status'::regtype;

    RAISE NOTICE 'Event status enum values: %', v_values;
END $$;
