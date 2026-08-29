-- ============================================================================
-- EVENT VILLAGE — MIGRATION 0006 : SUPERADMIN BOOTSTRAP & SMART ROLE ASSIGNMENT
-- ============================================================================
-- Description : Élévation automatique des privilèges Superadmin pour le numéro racine
--               (+221770000000 / 770000000), sécurisation de handle_new_user et
--               mise à niveau immédiate des utilisateurs existants correspondants.
-- Référence : Cahier des Charges V3.0 (Août 2026)
-- ============================================================================

-- 1. FONCTION DE SYNCHRONISATION AVEC BOOTSTRAP SUPERADMIN STRICT
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_phone TEXT;
    v_first_name TEXT;
    v_last_name TEXT;
    v_role user_role := 'CLIENT';
    v_status user_status := 'ACTIF';
    v_referral_status referral_status := 'STANDARD';
    v_raw_role TEXT;
    v_clean_phone TEXT;
BEGIN
    -- Extraction et normalisation des informations d'inscription
    v_phone := NULLIF(TRIM(COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '')), '');
    v_first_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''), 'Utilisateur');
    v_last_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''), 'Event Village');
    v_raw_role := COALESCE(NEW.raw_user_meta_data->>'role', 'CLIENT');

    -- Nettoyage des chiffres du numéro de téléphone pour comparaison universelle
    IF v_phone IS NOT NULL THEN
        v_clean_phone := REGEXP_REPLACE(v_phone, '\D', '', 'g');
    ELSE
        v_clean_phone := '';
    END IF;

    -- Attribution du rôle demandé par défaut
    IF v_raw_role = 'PARTENAIRE' THEN
        v_role := 'PARTENAIRE';
        v_status := 'EN_ATTENTE'; -- Validation administrative requise
    ELSIF v_raw_role = 'CONTROLEUR' THEN
        v_role := 'CONTROLEUR';
    ELSE
        v_role := 'CLIENT';
        v_status := 'ACTIF';
    END IF;

    -- ========================================================================
    -- BOOTSTRAPPING SUPERADMIN RACINE (+221770000000 / 770000000 / 773780756)
    -- ========================================================================
    IF v_clean_phone = '221770000000' OR v_clean_phone = '00221770000000' OR v_clean_phone = '770000000'
       OR v_clean_phone = '221773780756' OR v_clean_phone = '00221773780756' OR v_clean_phone = '773780756' THEN
        v_role := 'SUPERADMIN';
        v_status := 'ACTIF';
        v_first_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''), 'Super');
        v_last_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''), 'Admin');
    END IF;

    -- Insertion ou mise à jour résiliente dans public.users
    BEGIN
        INSERT INTO public.users (
            id,
            first_name,
            last_name,
            phone,
            email,
            role,
            status,
            referral_status
        ) VALUES (
            NEW.id,
            v_first_name,
            v_last_name,
            v_phone,
            NEW.email,
            v_role,
            v_status,
            v_referral_status
        )
        ON CONFLICT (id) DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            email = COALESCE(EXCLUDED.email, users.email),
            phone = COALESCE(EXCLUDED.phone, users.phone),
            role = CASE 
                WHEN users.role = 'SUPERADMIN' THEN 'SUPERADMIN'
                ELSE EXCLUDED.role 
            END,
            status = CASE
                WHEN users.role = 'SUPERADMIN' THEN 'ACTIF'
                ELSE EXCLUDED.status
            END,
            updated_at = now();
    EXCEPTION 
        WHEN unique_violation THEN
            -- Mise à jour sans rupture en cas de conflit d'unicité
            UPDATE public.users SET
                first_name = v_first_name,
                last_name = v_last_name,
                email = COALESCE(NEW.email, users.email),
                role = CASE WHEN users.role = 'SUPERADMIN' THEN 'SUPERADMIN' ELSE v_role END,
                updated_at = now()
            WHERE id = NEW.id;
        WHEN OTHERS THEN
            RAISE WARNING 'handle_new_user bootstrap exception: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. MISE À JOUR IMMÉDIATE DES COMPTES SUPERADMIN EXISTANTS EN BASE
UPDATE public.users
SET 
    role = 'SUPERADMIN',
    status = 'ACTIF',
    updated_at = now()
WHERE 
    REGEXP_REPLACE(phone, '\D', '', 'g') IN ('221770000000', '00221770000000', '770000000', '221773780756', '00221773780756', '773780756');
