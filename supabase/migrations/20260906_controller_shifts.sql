-- ============================================================================
-- EVENT VILLAGE — MIGRATION 20260906 : SESSIONS DE CAISSE (Z DE CAISSE)
-- Résolution Pre-Mortem §2.1 (Trou noir comptable) et §4.2 (Fenêtre temporelle de shift)
-- ============================================================================

-- 1. Ajout des colonnes PIN Régisseur sur la table events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS regisseur_pin_hash TEXT,
ADD COLUMN IF NOT EXISTS regisseur_pin_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.events.regisseur_pin_hash IS 'Hash cryptographique (HMAC-SHA256) du code PIN régisseur à 4-6 chiffres pour co-signature caisse.';
COMMENT ON COLUMN public.events.regisseur_pin_updated_at IS 'Date de dernière génération du PIN régisseur.';

-- 2. Création de la table controller_shifts
CREATE TABLE IF NOT EXISTS public.controller_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    controller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    opening_float_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    opening_confirmed_by_pin BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'OUVERT' CHECK (status IN ('OUVERT', 'CLOTURE', 'LITIGE')),
    expected_cash_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    declared_cash_total NUMERIC(12, 2) DEFAULT NULL,
    discrepancy_amount NUMERIC(12, 2) DEFAULT NULL,
    discrepancy_justification TEXT DEFAULT NULL,
    closed_at TIMESTAMPTZ DEFAULT NULL,
    closing_confirmed_by_pin BOOLEAN DEFAULT false,
    regisseur_pin_used TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indices de performance
CREATE INDEX IF NOT EXISTS idx_shifts_controller_event_status 
    ON public.controller_shifts(controller_id, event_id, status);

CREATE INDEX IF NOT EXISTS idx_shifts_event_status 
    ON public.controller_shifts(event_id, status);

CREATE INDEX IF NOT EXISTS idx_shifts_partner_status 
    ON public.controller_shifts(partner_id, status);

-- 4. Rattachement du shift_id sur orders (pour traçabilité comptable unitaire)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.controller_shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_shift_id 
    ON public.orders(shift_id);

-- 5. RLS (Row Level Security)
ALTER TABLE public.controller_shifts ENABLE ROW LEVEL SECURITY;

-- Les contrôleurs peuvent voir leurs propres shifts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'controller_shifts' AND policyname = 'controller_shifts_controller_select'
    ) THEN
        CREATE POLICY controller_shifts_controller_select ON public.controller_shifts
            FOR SELECT USING (auth.uid() = controller_id);
    END IF;
END $$;

-- Les partenaires peuvent voir tous les shifts de leurs événements
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'controller_shifts' AND policyname = 'controller_shifts_partner_select'
    ) THEN
        CREATE POLICY controller_shifts_partner_select ON public.controller_shifts
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.partners p
                    WHERE p.id = controller_shifts.partner_id AND p.user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- Admins et Superadmins ont un accès complet en lecture
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'controller_shifts' AND policyname = 'controller_shifts_admin_all'
    ) THEN
        CREATE POLICY controller_shifts_admin_all ON public.controller_shifts
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'SUPERADMIN')
                )
            );
    END IF;
END $$;
