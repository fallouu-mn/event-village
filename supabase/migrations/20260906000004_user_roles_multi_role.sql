-- ============================================================================
-- EVENT VILLAGE — MIGRATION : MODÈLE MULTI-RÔLES (user_roles)
-- ============================================================================
-- OBJECTIF : Permettre à un utilisateur de détenir plusieurs rôles simultanés.
--   Ex: CLIENT + CONTROLEUR, PARTENAIRE + CONTROLEUR, etc.
--
-- STRATÉGIE :
--   1. Créer la table user_roles (source de vérité)
--   2. Migrer les données depuis users.role
--   3. Trigger de synchronisation vers auth.users.raw_user_meta_data.roles (JWT)
--   4. Adapter les fonctions RLS (auth_user_role → has_role)
--   5. Adapter validate_and_check_in_ticket
--   6. Adapter audit_log_changes
--   7. Conserver users.role en lecture seule (legacy, non supprimé)
-- ============================================================================

-- ============================================================================
-- 1. TABLE user_roles
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       user_role   NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_role UNIQUE (user_id, role)
);

COMMENT ON TABLE user_roles IS
    'Table multi-rôles : un utilisateur peut détenir plusieurs rôles simultanément (CLIENT + CONTROLEUR, etc.)';

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS : chaque utilisateur voit ses propres rôles, les admins voient tout
CREATE POLICY "user_roles_select_own" ON user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role IN ('ADMIN', 'SUPERADMIN')
    ));

-- Mutations via service_role uniquement (API routes)
CREATE POLICY "user_roles_admin_manage" ON user_roles
    FOR ALL USING (EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role IN ('ADMIN', 'SUPERADMIN')
    ));

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles (role);

-- Trigger updated_at
CREATE TRIGGER trg_user_roles_updated_at
    BEFORE UPDATE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- 2. MIGRATION DES DONNÉES : users.role → user_roles
-- ============================================================================

INSERT INTO user_roles (user_id, role)
SELECT id, role FROM users
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Vérification : chaque utilisateur doit avoir au moins un rôle
DO $$
DECLARE
    v_orphans INT;
BEGIN
    SELECT COUNT(*) INTO v_orphans
    FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id);

    IF v_orphans > 0 THEN
        RAISE WARNING '[MIGRATION] % utilisateurs sans rôle dans user_roles — insertion CLIENT par défaut', v_orphans;
        INSERT INTO user_roles (user_id, role)
        SELECT u.id, 'CLIENT'::user_role
        FROM users u
        WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END $$;

-- ============================================================================
-- 3. TRIGGER : Synchronisation user_roles → auth.users.raw_user_meta_data.roles
--    Le middleware Next.js lit UNIQUEMENT le JWT — pas de requête SQL à l'Edge.
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_user_roles_to_jwt()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_roles   TEXT[];
    v_current JSONB;
BEGIN
    -- Déterminer le user_id concerné
    IF TG_OP = 'DELETE' THEN
        v_user_id := OLD.user_id;
    ELSE
        v_user_id := NEW.user_id;
    END IF;

    -- Recalculer le tableau complet des rôles
    SELECT ARRAY_AGG(ur.role::text ORDER BY ur.role::text)
    INTO v_roles
    FROM user_roles ur
    WHERE ur.user_id = v_user_id;

    -- Fallback si aucun rôle
    IF v_roles IS NULL THEN
        v_roles := ARRAY['CLIENT'];
    END IF;

    -- Lire les metadata actuelles et merger le champ roles
    SELECT raw_user_meta_data INTO v_current
    FROM auth.users WHERE id = v_user_id;

    IF v_current IS NULL THEN
        v_current := '{}'::jsonb;
    END IF;

    -- Mettre à jour raw_user_meta_data avec le tableau roles
    -- ET conserver le champ legacy 'role' = premier rôle par priorité
    UPDATE auth.users
    SET raw_user_meta_data = v_current
        || jsonb_build_object('roles', to_jsonb(v_roles))
        || jsonb_build_object('role', v_roles[1])
    WHERE id = v_user_id;

    -- Synchroniser aussi users.role (legacy) avec le rôle prioritaire
    -- Priorité : SUPERADMIN > ADMIN > PARTENAIRE > CONTROLEUR > CLIENT
    UPDATE users SET role = (
        CASE
            WHEN 'SUPERADMIN' = ANY(v_roles) THEN 'SUPERADMIN'::user_role
            WHEN 'ADMIN'      = ANY(v_roles) THEN 'ADMIN'::user_role
            WHEN 'PARTENAIRE' = ANY(v_roles) THEN 'PARTENAIRE'::user_role
            WHEN 'CONTROLEUR' = ANY(v_roles) THEN 'CONTROLEUR'::user_role
            ELSE 'CLIENT'::user_role
        END
    ) WHERE id = v_user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_roles_to_jwt
    AFTER INSERT OR UPDATE OR DELETE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION sync_user_roles_to_jwt();

-- ============================================================================
-- 4. INITIALISER raw_user_meta_data.roles pour tous les utilisateurs existants
-- ============================================================================

DO $$
DECLARE
    rec RECORD;
    v_roles TEXT[];
    v_current JSONB;
BEGIN
    FOR rec IN SELECT DISTINCT user_id FROM user_roles LOOP
        SELECT ARRAY_AGG(ur.role::text ORDER BY ur.role::text)
        INTO v_roles
        FROM user_roles ur
        WHERE ur.user_id = rec.user_id;

        IF v_roles IS NULL THEN
            v_roles := ARRAY['CLIENT'];
        END IF;

        SELECT raw_user_meta_data INTO v_current
        FROM auth.users WHERE id = rec.user_id;

        IF v_current IS NULL THEN
            v_current := '{}'::jsonb;
        END IF;

        UPDATE auth.users
        SET raw_user_meta_data = v_current
            || jsonb_build_object('roles', to_jsonb(v_roles))
            || jsonb_build_object('role', v_roles[1])
        WHERE id = rec.user_id;
    END LOOP;
END $$;

-- ============================================================================
-- 5. FONCTIONS RLS MULTI-RÔLES (remplacement de auth_user_role)
-- ============================================================================

-- Nouvelle fonction : vérifie si l'utilisateur connecté possède un rôle donné
CREATE OR REPLACE FUNCTION has_role(p_role user_role)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = p_role
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Réécriture de is_superadmin() sur user_roles
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(has_role('SUPERADMIN'), FALSE);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Réécriture de is_admin() sur user_roles
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(has_role('ADMIN') OR has_role('SUPERADMIN'), FALSE);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Réécriture de is_controller() sur user_roles
CREATE OR REPLACE FUNCTION is_controller()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(has_role('CONTROLEUR') OR has_role('ADMIN') OR has_role('SUPERADMIN'), FALSE);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Conserver auth_user_role() pour compatibilité legacy (retourne le rôle prioritaire)
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role AS $$
    SELECT CASE
        WHEN has_role('SUPERADMIN') THEN 'SUPERADMIN'::user_role
        WHEN has_role('ADMIN')      THEN 'ADMIN'::user_role
        WHEN has_role('PARTENAIRE') THEN 'PARTENAIRE'::user_role
        WHEN has_role('CONTROLEUR') THEN 'CONTROLEUR'::user_role
        ELSE 'CLIENT'::user_role
    END;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 6. MISE À JOUR DE validate_and_check_in_ticket — multi-rôle
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_and_check_in_ticket(
    p_qr_code TEXT,
    p_controller_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_ticket RECORD;
    v_event RECORD;
    v_partner_owner UUID;
    v_has_controller_role BOOLEAN;
BEGIN
    -- Vérification : l'utilisateur existe
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_controller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Contrôleur non trouvé');
    END IF;

    -- Vérification multi-rôle : possède CONTROLEUR, ADMIN ou SUPERADMIN
    SELECT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = p_controller_id
        AND role IN ('CONTROLEUR', 'ADMIN', 'SUPERADMIN')
    ) INTO v_has_controller_role;

    -- Recherche du ticket par son QR code unique
    SELECT * INTO v_ticket FROM tickets WHERE qr_code = p_qr_code;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ticket invalide ou inexistant');
    END IF;

    -- Récupération de l'événement associé
    SELECT * INTO v_event FROM events WHERE id = v_ticket.event_id;

    -- Récupération du propriétaire partenaire
    SELECT user_id INTO v_partner_owner FROM partners WHERE id = v_event.partner_id;

    -- Vérification des droits de contrôle
    IF NOT v_has_controller_role AND p_controller_id != v_partner_owner THEN
        RETURN jsonb_build_object('success', false, 'error', 'Non autorisé à contrôler cet événement');
    END IF;

    -- Vérification de l'état du ticket
    IF v_ticket.status = 'UTILISE' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Ticket DÉJÀ UTILISÉ',
            'checked_in_at', v_ticket.checked_in_at
        );
    ELSIF v_ticket.status = 'ANNULE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ce ticket a été ANNULÉ');
    ELSIF v_ticket.status = 'REMBOURSE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ce ticket a été REMBOURSÉ');
    ELSIF v_ticket.status != 'VALIDE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Statut de ticket invalide');
    END IF;

    -- Validation et enregistrement du compostage
    UPDATE tickets
    SET status = 'UTILISE',
        checked_in_at = now(),
        checked_in_by = p_controller_id,
        updated_at = now()
    WHERE id = v_ticket.id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Ticket validé avec succès',
        'ticket_id', v_ticket.id,
        'ticket_number', v_ticket.ticket_number,
        'event_title', v_event.title,
        'event_date', v_event.start_date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. MISE À JOUR DE audit_log_changes — multi-rôle
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role TEXT := 'SYSTEM';
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
    v_object_id UUID;
BEGIN
    IF v_user_id IS NOT NULL THEN
        -- Lire le rôle prioritaire depuis user_roles au lieu de users.role
        SELECT CASE
            WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_user_id AND role = 'SUPERADMIN') THEN 'SUPERADMIN'
            WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_user_id AND role = 'ADMIN')      THEN 'ADMIN'
            WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_user_id AND role = 'PARTENAIRE') THEN 'PARTENAIRE'
            WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_user_id AND role = 'CONTROLEUR') THEN 'CONTROLEUR'
            ELSE 'CLIENT'
        END INTO v_user_role;
    END IF;

    IF (TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
        v_object_id := OLD.id;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_object_id := NEW.id;
    ELSIF (TG_OP = 'INSERT') THEN
        v_new_data := to_jsonb(NEW);
        v_object_id := NEW.id;
    END IF;

    INSERT INTO audit_logs (
        user_id,
        user_role,
        action,
        object_type,
        object_id,
        old_value,
        new_value
    ) VALUES (
        v_user_id,
        v_user_role,
        TG_OP,
        TG_TABLE_NAME,
        v_object_id,
        v_old_data,
        v_new_data
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. MISE À JOUR DE handle_new_user — insérer dans user_roles
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
    v_phone      := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '');
    v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', 'Utilisateur');
    v_last_name  := COALESCE(NEW.raw_user_meta_data->>'last_name', 'Event Village');

    v_email := COALESCE(
        NEW.email,
        CASE
            WHEN v_phone <> '' THEN REPLACE(v_phone, '+', '') || '@eventvillage.sn'
            ELSE NULL
        END
    );

    IF v_phone = v_superadmin_phone OR REPLACE(v_phone, '+221', '') = v_superadmin_phone THEN
        v_role := 'SUPERADMIN';
    ELSE
        v_role_meta := NEW.raw_user_meta_data->>'role';
        IF v_role_meta IS NOT NULL THEN
            BEGIN
                v_role := v_role_meta::user_role;
            EXCEPTION WHEN invalid_text_representation THEN
                v_role := 'CLIENT';
            END;
        END IF;
    END IF;

    -- Insérer dans users (legacy role = le rôle principal demandé)
    INSERT INTO public.users (
        id, first_name, last_name, phone, email, role, status, referral_status
    ) VALUES (
        NEW.id, v_first_name, v_last_name, v_phone, v_email, v_role, 'ACTIF', 'STANDARD'
    )
    ON CONFLICT (id) DO UPDATE SET
        email      = EXCLUDED.email,
        updated_at = now();

    -- Insérer dans user_roles : toujours CLIENT + le rôle demandé si différent
    INSERT INTO user_roles (user_id, role) VALUES (NEW.id, 'CLIENT')
    ON CONFLICT (user_id, role) DO NOTHING;

    IF v_role != 'CLIENT' THEN
        INSERT INTO user_roles (user_id, role) VALUES (NEW.id, v_role)
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 9. POLITIQUE RLS users_update_own — adapter pour multi-rôle
--    L'ancienne politique empêchait la modification de users.role par l'utilisateur.
--    Maintenant users.role est synchronisé par le trigger, l'utilisateur ne doit
--    toujours pas pouvoir modifier son propre rôle legacy.
-- ============================================================================

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        AND role = (SELECT role FROM users WHERE id = auth.uid())
        AND referral_status = (SELECT referral_status FROM users WHERE id = auth.uid())
    );

-- ============================================================================
-- 10. AUDIT TRIGGER SUR user_roles
-- ============================================================================

CREATE TRIGGER trg_audit_user_roles
    AFTER INSERT OR UPDATE OR DELETE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
