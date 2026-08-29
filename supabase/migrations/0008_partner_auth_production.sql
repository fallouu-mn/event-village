-- ============================================================================
-- EVENT VILLAGE — MIGRATION 0008 : AUTHENTIFICATION PARTENAIRE & PRODUCTION
-- ============================================================================
-- Description : Colonnes de période d'essai, statut fondateur, motif de refus/suspension,
--               vérification de téléphone, fonction d'activation idempotente et rate limiting.
-- Référence : Cahier des Charges V3.0 (Août 2026)
-- ============================================================================

-- 1. EXTENSION DE LA TABLE PUBLIC.PARTNERS
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS is_founder BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. TABLE DU RATE LIMITING SERVEUR & ANTI-BRUTE FORCE
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL UNIQUE, -- IP ou Numéro de téléphone ou Email
    attempts INT NOT NULL DEFAULT 1,
    locked_until TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_ident ON public.auth_rate_limits(identifier, locked_until);

-- 3. FONCTION D'ACTIVATION IDEMPOTENTE DE LA PÉRIODE D'ESSAI PARTENAIRE (§7)
CREATE OR REPLACE FUNCTION public.activate_partner_trial(p_partner_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_partner RECORD;
    v_trial_days INT := 60;
    v_started_at TIMESTAMPTZ;
    v_ends_at TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_partner FROM public.partners WHERE id = p_partner_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Partenaire introuvable');
    END IF;

    -- Si la période d'essai a déjà été démarrée, on ne la recalcule PAS (IDEMPOTENCE STRICTE)
    IF v_partner.trial_started_at IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'is_new_activation', false,
            'trial_started_at', v_partner.trial_started_at,
            'trial_ends_at', v_partner.trial_ends_at,
            'status', v_partner.status
        );
    END IF;

    -- Durée : 90 jours si Founder, sinon 60 jours Standard
    IF v_partner.is_founder = TRUE THEN
        v_trial_days := 90;
    ELSE
        v_trial_days := 60;
    END IF;

    v_started_at := now();
    v_ends_at := now() + (v_trial_days || ' days')::INTERVAL;

    -- Mise à jour du partenaire et synchronisation de son compte utilisateur
    UPDATE public.partners
    SET 
        trial_started_at = v_started_at,
        trial_ends_at = v_ends_at,
        status = 'ACTIF',
        updated_at = now()
    WHERE id = p_partner_id;

    UPDATE public.users
    SET 
        status = 'ACTIF',
        updated_at = now()
    WHERE id = v_partner.user_id;

    -- Journal d'audit de la première activation
    INSERT INTO public.audit_logs (
        user_id,
        user_role,
        action,
        object_type,
        object_id,
        new_value,
        metadata
    ) VALUES (
        v_partner.user_id,
        'PARTENAIRE',
        'FIRST_ACTIVATION',
        'partners',
        p_partner_id,
        jsonb_build_object('trial_days', v_trial_days, 'trial_ends_at', v_ends_at),
        jsonb_build_object('is_founder', v_partner.is_founder)
    );

    RETURN jsonb_build_object(
        'success', true,
        'is_new_activation', true,
        'trial_days', v_trial_days,
        'trial_started_at', v_started_at,
        'trial_ends_at', v_ends_at,
        'status', 'ACTIF'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. POLITIQUES RLS SUR LA TABLE DES RATE LIMITS
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_rate_limits_admin_all" ON public.auth_rate_limits
    FOR ALL USING (is_admin());
