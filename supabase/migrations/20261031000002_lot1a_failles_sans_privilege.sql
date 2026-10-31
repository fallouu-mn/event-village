-- ============================================================================
-- EVENT VILLAGE — MIGRATION 20261031000002 : LOT 1A, FAILLES EXPLOITABLES SANS PRIVILÈGE
-- ============================================================================
-- Référence : docs/lot1a-rapport.md (constats R1 à R6 de docs/audit-evenementiel-cdc-v3.md).
-- Idempotente : peut être rejouée sans effet de bord. Le fichier
-- supabase/hotfix/2026-10-31-lot1a/02-hotfix.sql contient exactement ce corps entre BEGIN et COMMIT.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1A.1 — Inscription : plus aucune élévation de rôle (R1)
-- ----------------------------------------------------------------------------
-- Tout compte créé par GoTrue est CLIENT. Les métadonnées d'inscription (contrôlées par
-- l'utilisateur) ne fournissent plus ni rôle, ni téléphone, ni bootstrap SUPERADMIN.
-- Les rôles PARTENAIRE, CONTROLEUR, ADMIN et SUPERADMIN sont attribués par les routes
-- serveur (service_role) : /api/partner/register, /api/partner/team/invite,
-- /api/admin/users, scripts/bootstrap-superadmin.ts.
-- Téléphone : uniquement auth.users.phone, vide ramené à NULL (users.phone est UNIQUE).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_phone TEXT := NULLIF(TRIM(NEW.phone), '');
    v_email TEXT := NULLIF(TRIM(NEW.email), '');
BEGIN
    IF v_email IS NULL AND v_phone IS NOT NULL THEN
        v_email := REPLACE(v_phone, '+', '') || '@eventvillage.sn';
    END IF;

    INSERT INTO public.users (id, first_name, last_name, phone, email, role, status, referral_status)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''), 'Utilisateur'),
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''), 'Event Village'),
        v_phone,
        v_email,
        'CLIENT',
        'ACTIF',
        'STANDARD'
    )
    ON CONFLICT (id) DO UPDATE SET
        email      = EXCLUDED.email,
        updated_at = now();

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'CLIENT')
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN NEW;
END;
$$;
