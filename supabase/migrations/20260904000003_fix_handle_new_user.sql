-- ============================================================================
-- HOTFIX : handle_new_user — lecture du rôle depuis raw_user_meta_data
-- CONTEXTE : le trigger ignorait user_metadata.role, forçant CLIENT pour
--            tous les utilisateurs créés via auth.admin.createUser,
--            y compris les contrôleurs invités. Ce patch lit le rôle
--            et l'applique si c'est un rôle valide (CONTROLEUR, PARTENAIRE).
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_phone          TEXT;
    v_first_name     TEXT;
    v_last_name      TEXT;
    v_email          TEXT;
    v_role           user_role := 'CLIENT';
    v_role_meta      TEXT;
    v_superadmin_phone TEXT := '773780756';
BEGIN
    -- Extraction des métadonnées fournies à l'inscription
    v_phone      := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '');
    v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', 'Utilisateur');
    v_last_name  := COALESCE(NEW.raw_user_meta_data->>'last_name', 'Event Village');

    -- Email : utiliser l'email auth ou générer l'email synthétique téléphone
    -- Format : 221XXXXXXXXX@eventvillage.sn (sans le +)
    v_email := COALESCE(
        NEW.email,
        CASE
            WHEN v_phone <> '' THEN REPLACE(v_phone, '+', '') || '@eventvillage.sn'
            ELSE NULL
        END
    );

    -- Attribution automatique du rôle SUPERADMIN si numéro désigné
    IF v_phone = v_superadmin_phone OR REPLACE(v_phone, '+221', '') = v_superadmin_phone THEN
        v_role := 'SUPERADMIN';
    ELSE
        -- Lire le rôle depuis raw_user_meta_data si présent et valide
        -- Permet aux appels admin.createUser({ user_metadata: { role: 'CONTROLEUR' } })
        -- de propager directement le bon rôle sans une UPDATE séparée
        v_role_meta := NEW.raw_user_meta_data->>'role';
        IF v_role_meta IS NOT NULL THEN
            BEGIN
                v_role := v_role_meta::user_role;
            EXCEPTION WHEN invalid_text_representation THEN
                v_role := 'CLIENT'; -- valeur inconnue → CLIENT par sécurité
            END;
        END IF;
    END IF;

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
        v_email,
        v_role,
        'ACTIF',
        'STANDARD'
    )
    ON CONFLICT (id) DO UPDATE SET
        email      = EXCLUDED.email,
        updated_at = now();
        -- Note: le rôle n'est PAS écrasé sur conflict pour préserver
        -- les promotions de rôle existantes (ex: CLIENT → PARTENAIRE déjà actif)

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recréer le trigger (la fonction est déjà attachée, mais on force le refresh)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
