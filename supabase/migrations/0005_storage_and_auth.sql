-- ============================================================================
-- EVENT VILLAGE — MIGRATION 0005 : STORAGE POLICIES, AUTH & AUDIT LOG PARTENAIRES
-- ============================================================================
-- Description : Configuration du bucket privé partner_documents, des colonnes
--               de vérification et justificatifs, des politiques d'accès Storage,
--               de la table otp_codes et de la synchronisation résiliente Supabase Auth.
-- Référence : Cahier des Charges V3.0 (Août 2026)
-- ============================================================================

-- 1. AJOUT DES COLONNES SUR PARTNERS & USERS
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS id_card_url TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS business_doc_url TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Rendre le numéro de téléphone nullable dans public.users pour éviter les erreurs d'inscription GoTrue
ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL;

-- 2. CRÉATION DE LA TABLE DES CODES OTP MTARGET
CREATE TABLE IF NOT EXISTS public.otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON public.otp_codes(phone, verified, expires_at);

-- 3. CRÉATION DU BUCKET PRIVÉ POUR LES DOCUMENTS PARTENAIRES
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'partner_documents',
    'partner_documents',
    false, -- BUCKET PRIVÉ STRICT (Aucun accès public sans droits)
    10485760, -- Limite 10 MB par document
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- 4. POLITIQUES DE SÉCURITÉ STORAGE (RLS SUR storage.objects)

-- Dépôt : Un partenaire authentifié peut uniquement déposer dans son propre dossier (auth.uid())
DROP POLICY IF EXISTS "partner_documents_insert_own" ON storage.objects;
CREATE POLICY "partner_documents_insert_own" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'partner_documents'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Consultation : Le propriétaire ou un Administrateur/Superadministrateur peut consulter
DROP POLICY IF EXISTS "partner_documents_select_own_or_admin" ON storage.objects;
CREATE POLICY "partner_documents_select_own_or_admin" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'partner_documents'
        AND (
            (auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text)
            OR is_admin()
        )
    );

-- Modification : Le propriétaire ou un Administrateur
DROP POLICY IF EXISTS "partner_documents_update_own_or_admin" ON storage.objects;
CREATE POLICY "partner_documents_update_own_or_admin" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'partner_documents'
        AND (
            (auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text)
            OR is_admin()
        )
    );

-- Suppression : Le propriétaire ou un Administrateur
DROP POLICY IF EXISTS "partner_documents_delete_own_or_admin" ON storage.objects;
CREATE POLICY "partner_documents_delete_own_or_admin" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'partner_documents'
        AND (
            (auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text)
            OR is_admin()
        )
    );

-- 5. AUDIT LOG SUR LA TABLE PARTNERS (Validation, suspension, modification)
DROP TRIGGER IF EXISTS trg_audit_partners ON public.partners;
CREATE TRIGGER trg_audit_partners
    AFTER INSERT OR UPDATE OF status, subscription_plan_id, company_name, is_verified OR DELETE ON public.partners
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- 6. SYNCHRONISATION HAUTE RÉSILIENCE AUTH SUPABASE -> PUBLIC.USERS
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_phone TEXT;
    v_first_name TEXT;
    v_last_name TEXT;
    v_role user_role := 'CLIENT';
    v_status user_status := 'ACTIF';
    v_referral_status referral_status := 'STANDARD';
    v_superadmin_phone TEXT := '773780756';
    v_raw_role TEXT;
BEGIN
    v_phone := NULLIF(TRIM(COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '')), '');
    v_first_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''), 'Utilisateur');
    v_last_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''), 'Event Village');
    v_raw_role := COALESCE(NEW.raw_user_meta_data->>'role', 'CLIENT');

    -- Attribution du rôle demandé lors de l'onboarding
    IF v_raw_role = 'PARTENAIRE' THEN
        v_role := 'PARTENAIRE';
        v_status := 'EN_ATTENTE';
    ELSIF v_raw_role = 'CONTROLEUR' THEN
        v_role := 'CONTROLEUR';
    END IF;

    -- Attribution automatique du rôle SUPERADMIN si le numéro correspond au compte maître
    IF v_phone IS NOT NULL AND (v_phone = v_superadmin_phone OR REPLACE(v_phone, '+221', '') = v_superadmin_phone) THEN
        v_role := 'SUPERADMIN';
        v_status := 'ACTIF';
    END IF;

    -- Insertion ou mise à jour sécurisée avec capture d'erreurs pour ne jamais bloquer GoTrue
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
            updated_at = now();
    EXCEPTION 
        WHEN unique_violation THEN
            -- En cas de conflit d'unicité, mettre à jour sans faire échouer l'inscription
            UPDATE public.users SET
                first_name = v_first_name,
                last_name = v_last_name,
                email = COALESCE(NEW.email, users.email),
                updated_at = now()
            WHERE id = NEW.id;
        WHEN OTHERS THEN
            RAISE WARNING 'handle_new_user exception: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- S'assurer que le trigger est attaché sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
