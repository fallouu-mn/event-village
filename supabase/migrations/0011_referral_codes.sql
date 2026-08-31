-- ============================================================================
-- EVENT VILLAGE — MIGRATION 0011 : CODES DE PARRAINAGE & ANTI-FRAUDE
-- ============================================================================
-- Description : Colonne referral_code persistée sur users, génération automatique,
--               anti-chaîne circulaire, données initiales referral_config.
-- Référence : Cahier des Charges V3.0 — Chunk 6
-- ============================================================================

-- 1. AJOUT DE LA COLONNE referral_code SUR users
-- ============================================================================

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 2. FONCTION DE GÉNÉRATION DU CODE DE PARRAINAGE (EV-XXXXXX)
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_referral_code(p_user_id UUID, p_phone TEXT)
RETURNS TEXT AS $$
DECLARE
    v_clean_phone TEXT;
    v_code        TEXT;
    v_suffix      TEXT;
    v_counter     INTEGER := 0;
BEGIN
    v_clean_phone := REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g');

    -- Suffixe : 6 derniers chiffres du numéro, ou 6 premiers chars de l'UUID
    IF length(v_clean_phone) >= 6 THEN
        v_suffix := RIGHT(v_clean_phone, 6);
    ELSE
        v_suffix := UPPER(LEFT(REPLACE(p_user_id::text, '-', ''), 6));
    END IF;

    v_code := 'EV-' || v_suffix;

    -- Garantie d'unicité
    WHILE EXISTS (SELECT 1 FROM public.users WHERE referral_code = v_code) LOOP
        v_counter := v_counter + 1;
        v_code := 'EV-' || v_suffix || v_counter::text;
    END LOOP;

    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- 3. TRIGGER : AUTO-REMPLISSAGE DU referral_code À L'INSERTION
-- ============================================================================

CREATE OR REPLACE FUNCTION set_referral_code_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := generate_referral_code(NEW.id, COALESCE(NEW.phone, ''));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_set_referral_code ON public.users;
CREATE TRIGGER trg_users_set_referral_code
    BEFORE INSERT ON public.users
    FOR EACH ROW EXECUTE FUNCTION set_referral_code_on_insert();

-- 4. RÉTRO-REMPLISSAGE : TOUS LES UTILISATEURS EXISTANTS
-- ============================================================================

DO $$
DECLARE
    rec RECORD;
    v_code TEXT;
BEGIN
    FOR rec IN SELECT id, phone FROM public.users WHERE referral_code IS NULL LOOP
        v_code := generate_referral_code(rec.id, COALESCE(rec.phone, ''));
        UPDATE public.users SET referral_code = v_code WHERE id = rec.id;
    END LOOP;
END;
$$;

-- 5. TRIGGER ANTI-CHAÎNE CIRCULAIRE (parrainage A→B et B→A interdit)
-- ============================================================================

CREATE OR REPLACE FUNCTION check_no_circular_referral()
RETURNS TRIGGER AS $$
BEGIN
    -- Remonte la chaîne depuis le parrain (sponsor_id).
    -- Si le filleul (referred_id) y apparaît → boucle détectée.
    IF EXISTS (
        WITH RECURSIVE chain AS (
            SELECT rr.sponsor_id AS ancestor
            FROM referral_relationships rr
            WHERE rr.referred_id = NEW.sponsor_id
            UNION ALL
            SELECT rr.sponsor_id
            FROM referral_relationships rr
            JOIN chain c ON rr.referred_id = c.ancestor
        )
        SELECT 1 FROM chain WHERE ancestor = NEW.referred_id
    ) THEN
        RAISE EXCEPTION 'Parrainage circulaire interdit : % → %', NEW.sponsor_id, NEW.referred_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_circular_referral ON public.referral_relationships;
CREATE TRIGGER trg_check_circular_referral
    BEFORE INSERT ON public.referral_relationships
    FOR EACH ROW EXECUTE FUNCTION check_no_circular_referral();

-- 6. DONNÉES INITIALES : TAUX DE PARRAINAGE (CDC V3.0)
-- ============================================================================
-- STANDARD   CLIENT_TO_CLIENT : N1 = 4 %,  N2 = 1,5 % — durée 24 mois
-- AMBASSADEUR CLIENT_TO_CLIENT : N1 = 7 %,  N2 = 2 %   — durée 36 mois
-- ============================================================================

INSERT INTO public.referral_config (sponsor_status, referral_type, rate_n1, rate_n2, duration_months, is_active)
VALUES
    ('STANDARD',    'CLIENT_TO_CLIENT', 4.00, 1.50, 24, TRUE),
    ('AMBASSADEUR', 'CLIENT_TO_CLIENT', 7.00, 2.00, 36, TRUE)
ON CONFLICT ON CONSTRAINT uq_referral_config DO UPDATE
    SET rate_n1          = EXCLUDED.rate_n1,
        rate_n2          = EXCLUDED.rate_n2,
        duration_months  = EXCLUDED.duration_months,
        is_active        = EXCLUDED.is_active,
        updated_at       = now();

-- 7. INDEX POUR LOOKUP RAPIDE PAR CODE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users (referral_code);
