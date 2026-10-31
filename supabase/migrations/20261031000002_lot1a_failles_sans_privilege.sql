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

-- ----------------------------------------------------------------------------
-- 1A.2 — otp_codes (R2) : RLS activée, aucune politique, aucun privilège pour anon / authenticated
-- ----------------------------------------------------------------------------
-- Toutes les lectures et écritures applicatives passent par le service_role (routes
-- /api/auth/*, /api/controller/setup, /api/partner/*, lib/security/sensitive-action.service.ts).
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'otp_codes' LOOP
        EXECUTE format('DROP POLICY %I ON public.otp_codes', r.policyname);
    END LOOP;
END $$;

REVOKE ALL ON TABLE public.otp_codes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.otp_codes TO service_role;

-- ----------------------------------------------------------------------------
-- 1A.3 — Fonctions du schéma public : droits EXECUTE minimaux (R3)
-- ----------------------------------------------------------------------------
-- Groupe a — aides utilisées par les politiques RLS : restent exécutables par anon ET
-- authenticated (les politiques sans clause TO s'évaluent aussi pour anon ; leur retirer
-- EXECUTE casserait toute lecture protégée). Lecture seule (STABLE), search_path fixé.
-- Groupe b — RPC métier : service_role uniquement.
-- Groupe c — fonctions de triggers : aucun EXECUTE pour les rôles API (le déclenchement
-- d'un trigger ne vérifie pas ce privilège).
-- Les fonctions appartenant à une extension ne sont pas modifiées.

-- Composte n'importe quel billet en se fiant à l'identifiant de contrôleur passé en paramètre ;
-- aucun appelant applicatif (grep : 0 occurrence hors migrations).
DROP FUNCTION IF EXISTS public.validate_and_check_in_ticket(text, uuid);

-- Fonctions d'exécution de SQL arbitraire : absentes des migrations, mais appelées sur le projet
-- de test (rpc/exec_sql). Supprimées si elles existent, quelle que soit leur signature.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname IN ('exec_sql', 'execute_sql', 'run_sql', 'exec')
           AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
    LOOP
        EXECUTE format('DROP FUNCTION %s', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    v_whitelist CONSTANT text[] := ARRAY['is_admin', 'is_superadmin', 'is_controller', 'has_role', 'is_partner_owner', 'auth_user_role'];
    r record;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig, p.proname, p.prosecdef, p.proconfig
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.prokind = 'f'
           AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
    LOOP
        IF r.proname = ANY (v_whitelist) THEN
            -- Groupe a
            EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', r.sig);
        ELSE
            -- Groupes b et c
            EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
            IF r.prosecdef AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(r.proconfig, ARRAY[]::text[])) c WHERE c LIKE 'search_path=%') THEN
                EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', r.sig);
            END IF;
        END IF;
    END LOOP;
END $$;

-- Fonctions futures : plus d'EXECUTE implicite. La forme globale retire le défaut PostgreSQL
-- (EXECUTE à PUBLIC) ; la forme par schéma retire les droits accordés par Supabase à anon et
-- authenticated. Une nouvelle aide RLS devra recevoir un GRANT explicite (et entrer dans la liste
-- blanche de tests/schema/fonctions-privileges.test.ts).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1A.4 — Écritures directes par l'API REST (R4, R6, R5 en partie)
-- ----------------------------------------------------------------------------
-- Billets, paiements et journal d'audit ne s'écrivent que côté serveur (service_role) ou par
-- les triggers SECURITY DEFINER (audit_log_changes). Grep : aucune écriture sur ces tables
-- depuis un client navigateur ou anon (voir rapport).
DROP POLICY IF EXISTS "tickets_insert_auth" ON public.tickets;          -- billet VALIDE forgeable par tout compte
DROP POLICY IF EXISTS "tickets_update_controller" ON public.tickets;    -- tout contrôleur modifiait tout billet
DROP POLICY IF EXISTS "payments_insert_auth" ON public.payments;        -- paiement SUCCESS forgeable par tout compte
DROP POLICY IF EXISTS "audit_logs_insert_system" ON public.audit_logs;  -- WITH CHECK (TRUE) : journal falsifiable

REVOKE INSERT, UPDATE, DELETE ON TABLE public.audit_logs FROM anon, authenticated;
