-- ============================================================================
-- EVENT VILLAGE — MIGRATION 0007 : SUPERADMIN SUITE COMPLÈTE (CDC V3.0)
-- ============================================================================
-- Description : Permissions granulaires des Admins, configuration plateforme,
--               campagnes de communication, audit inaltérable et sécurité.
-- ============================================================================

-- 1. TABLE DES PERMISSIONS GRANULAIRES DES ADMINISTRATEURS
CREATE TABLE IF NOT EXISTS public.admin_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    permission TEXT NOT NULL, -- e.g. 'users.read', 'users.write', 'partners.validate', etc.
    granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_admin_user_permission UNIQUE (user_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_admin_permissions_user ON public.admin_permissions(user_id);

-- 2. TABLE DES PARAMÈTRES & GRILLES TARIFAIRES DE LA PLATEFORME
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insertion des paramètres par défaut CDC V3.0
INSERT INTO public.platform_settings (key, value, description)
VALUES 
    ('subscription_packs', '{
        "starter": { "name": "Starter", "price": 0, "commission_rate": 8.0, "max_events": 2 },
        "business": { "name": "Business", "price": 25000, "commission_rate": 6.5, "max_events": 10 },
        "premium": { "name": "Premium", "price": 75000, "commission_rate": 5.0, "max_events": 999 }
    }'::jsonb, 'Grille tarifaire des packs partenaires B2B'),
    ('aggregator_fees', '{
        "WAVE": { "rate": 1.0, "fixed": 0 },
        "ORANGE_MONEY": { "rate": 1.5, "fixed": 0 },
        "FREE_MONEY": { "rate": 1.5, "fixed": 0 },
        "CARTE_BANCAIRE": { "rate": 2.5, "fixed": 100 }
    }'::jsonb, 'Frais facturés par les agrégateurs de paiement'),
    ('communication_tariffs', '{
        "SMS": { "cost": 8, "price": 15, "margin": 7 },
        "WHATSAPP": { "cost": 15, "price": 30, "margin": 15 },
        "EMAIL": { "cost": 1, "price": 3, "margin": 2 }
    }'::jsonb, 'Coûts de revient et tarifs de revente des canaux de communication'),
    ('withdrawal_rules', '{
        "min_amount": 5000,
        "fee_rate": 1.0,
        "auto_approval_threshold": 50000
    }'::jsonb, 'Règles et seuils pour les retraits de commissions et avoirs')
ON CONFLICT (key) DO NOTHING;

-- 3. TABLE DES CAMPAGNES DE COMMUNICATION & DIFFUSION
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    sender_profile TEXT NOT NULL DEFAULT 'Event Village Info', -- 'Event Village Info', 'Event Village Sénégal', 'Support Officiel'
    target_audience TEXT NOT NULL DEFAULT 'ALL_CLIENTS', -- 'ALL_CLIENTS', 'ALL_PARTNERS', 'AMBASSADORS', 'RESTAURANTS', 'ORGANISATEURS'
    channels TEXT[] NOT NULL DEFAULT '{"SMS"}',
    status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED'
    recipient_count INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. FONCTION DE VÉRIFICATION DES PERMISSIONS EN SQL
CREATE OR REPLACE FUNCTION public.has_admin_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_role user_role;
BEGIN
    SELECT role INTO v_role FROM public.users WHERE id = p_user_id;
    
    -- Le Superadmin possède TOUTES les permissions de plein droit
    IF v_role = 'SUPERADMIN' THEN
        RETURN TRUE;
    END IF;

    -- Un Admin ordinaire doit avoir la permission explicite
    IF v_role = 'ADMIN' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.admin_permissions
            WHERE user_id = p_user_id AND permission = p_permission
        );
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. POLITIQUES ROW LEVEL SECURITY (RLS)
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_permissions_superadmin_all" ON public.admin_permissions
    FOR ALL USING (is_superadmin());

CREATE POLICY "admin_permissions_admin_read_own" ON public.admin_permissions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "platform_settings_read" ON public.platform_settings
    FOR SELECT USING (TRUE);

CREATE POLICY "platform_settings_admin_write" ON public.platform_settings
    FOR ALL USING (is_admin());

CREATE POLICY "campaigns_admin_manage" ON public.campaigns
    FOR ALL USING (is_admin());
