-- ============================================================================
-- EVENT VILLAGE — MIGRATION 0002 : FONCTIONS & TRIGGERS
-- ============================================================================
-- Description : Fonctions métier, triggers d'automatisation, calculs de commissions,
--               contrôle de tickets, détection de conflits et journal d'audit.
-- Référence : Cahier des Charges V3.0 & Directives Techniques
-- ============================================================================

-- ============================================================================
-- 1. FONCTION & TRIGGER : MISE À JOUR AUTOMATIQUE DE updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Application du trigger sur toutes les tables concernées
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_partners_updated_at BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_ticket_categories_updated_at BEFORE UPDATE ON ticket_categories FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_halls_updated_at BEFORE UPDATE ON halls FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_hall_reservations_updated_at BEFORE UPDATE ON hall_reservations FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_restaurant_zones_updated_at BEFORE UPDATE ON restaurant_zones FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_restaurant_tables_updated_at BEFORE UPDATE ON restaurant_tables FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_table_reservations_updated_at BEFORE UPDATE ON table_reservations FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_product_categories_updated_at BEFORE UPDATE ON product_categories FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_refunds_updated_at BEFORE UPDATE ON refunds FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_referral_config_updated_at BEFORE UPDATE ON referral_config FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_referral_commissions_updated_at BEFORE UPDATE ON referral_commissions FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_withdrawals_updated_at BEFORE UPDATE ON withdrawals FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- 2. SYNCHRONISATION AUTH SUPABASE -> PUBLIC.USERS
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_phone TEXT;
    v_first_name TEXT;
    v_last_name TEXT;
    v_role user_role := 'CLIENT';
    v_superadmin_phone TEXT := '773780756'; -- Numéro Superadministrateur initial
BEGIN
    -- Extraction des métadonnées fournies à l'inscription
    v_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '');
    v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', 'Utilisateur');
    v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', 'Event Village');

    -- Attribution automatique du rôle SUPERADMIN si le numéro correspond
    IF v_phone = v_superadmin_phone OR REPLACE(v_phone, '+221', '') = v_superadmin_phone THEN
        v_role := 'SUPERADMIN';
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
        NEW.email,
        v_role,
        'ACTIF',
        'STANDARD'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 3. CALCUL IDEMPOTENT DES COMMISSIONS DE PARRAINAGE (N1 & N2)
-- ============================================================================
-- Calcule les commissions N1 et N2 sur le REVENU NET EVENT VILLAGE ÉLIGIBLE
-- Ne s'applique pas sur le montant brut payé par le client.
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_referral_commissions(p_payment_id UUID)
RETURNS VOID AS $$
DECLARE
    v_payment RECORD;
    v_rel_n1 RECORD;
    v_rel_n2 RECORD;
    v_comm_n1_amount NUMERIC(12, 2);
    v_comm_n2_amount NUMERIC(12, 2);
    v_idempotency_n1 TEXT;
    v_idempotency_n2 TEXT;
BEGIN
    -- Récupération et vérification du paiement
    SELECT * INTO v_payment
    FROM payments
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paiement non trouvé : %', p_payment_id;
    END IF;

    -- Le parrainage ne s'applique que sur les paiements réussis et passant par la plateforme
    IF v_payment.status != 'SUCCESS' OR NOT v_payment.is_platform_payment THEN
        RETURN;
    END IF;

    -- Vérification qu'un revenu net éligible existe
    IF v_payment.net_event_village_revenue IS NULL OR v_payment.net_event_village_revenue <= 0 THEN
        RETURN;
    END IF;

    -- Recherche de la relation de parrainage N1 (Le payeur comme filleul)
    SELECT * INTO v_rel_n1
    FROM referral_relationships
    WHERE referred_id = v_payment.client_id
      AND is_active = TRUE
      AND expires_at >= now();

    IF FOUND THEN
        -- Calcul de la commission N1
        v_comm_n1_amount := ROUND((v_payment.net_event_village_revenue * (v_rel_n1.rate_n1_at_creation / 100.00)), 2);
        v_idempotency_n1 := 'COMM_N1_' || v_payment.id || '_' || v_rel_n1.sponsor_id;

        IF v_comm_n1_amount > 0 THEN
            INSERT INTO referral_commissions (
                sponsor_id,
                referred_id,
                generation,
                referral_type,
                payment_id,
                eligible_net_revenue,
                commission_rate,
                amount,
                status,
                idempotency_key,
                available_at
            ) VALUES (
                v_rel_n1.sponsor_id,
                v_payment.client_id,
                'N1',
                v_rel_n1.referral_type,
                v_payment.id,
                v_payment.net_event_village_revenue,
                v_rel_n1.rate_n1_at_creation,
                v_comm_n1_amount,
                'AVAILABLE',
                v_idempotency_n1,
                now()
            )
            ON CONFLICT (idempotency_key) DO NOTHING;
        END IF;

        -- Recherche de la relation de parrainage N2 (Le parrain du parrain N1)
        SELECT * INTO v_rel_n2
        FROM referral_relationships
        WHERE referred_id = v_rel_n1.sponsor_id
          AND is_active = TRUE
          AND expires_at >= now();

        IF FOUND THEN
            -- Calcul de la commission N2
            v_comm_n2_amount := ROUND((v_payment.net_event_village_revenue * (v_rel_n1.rate_n2_at_creation / 100.00)), 2);
            v_idempotency_n2 := 'COMM_N2_' || v_payment.id || '_' || v_rel_n2.sponsor_id;

            IF v_comm_n2_amount > 0 THEN
                INSERT INTO referral_commissions (
                    sponsor_id,
                    referred_id,
                    generation,
                    referral_type,
                    payment_id,
                    eligible_net_revenue,
                    commission_rate,
                    amount,
                    status,
                    idempotency_key,
                    available_at
                ) VALUES (
                    v_rel_n2.sponsor_id,
                    v_payment.client_id,
                    'N2',
                    v_rel_n1.referral_type,
                    v_payment.id,
                    v_payment.net_event_village_revenue,
                    v_rel_n1.rate_n2_at_creation,
                    v_comm_n2_amount,
                    'AVAILABLE',
                    v_idempotency_n2,
                    now()
                )
                ON CONFLICT (idempotency_key) DO NOTHING;
            END IF;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger automatique pour calculer les commissions lors du passage d'un paiement à SUCCESS
CREATE OR REPLACE FUNCTION trg_fn_payment_success_commissions()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'SUCCESS' AND (OLD.status IS NULL OR OLD.status != 'SUCCESS') THEN
        PERFORM calculate_referral_commissions(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_payment_success_referrals
    AFTER UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_payment_success_commissions();

-- ============================================================================
-- 4. CONTRÔLE ET VALIDATION CÔTÉ SERVEUR DU QR CODE TICKET
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_and_check_in_ticket(
    p_qr_code TEXT,
    p_controller_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_ticket RECORD;
    v_event RECORD;
    v_controller RECORD;
    v_partner_owner UUID;
BEGIN
    -- Vérification du rôle du contrôleur
    SELECT * INTO v_controller FROM users WHERE id = p_controller_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Contrôleur non trouvé');
    END IF;

    -- Recherche du ticket par son QR code unique
    SELECT * INTO v_ticket FROM tickets WHERE qr_code = p_qr_code;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ticket invalide ou inexistant');
    END IF;

    -- Récupération de l'événement associé
    SELECT * INTO v_event FROM events WHERE id = v_ticket.event_id;

    -- Récupération du propriétaire partenaire
    SELECT user_id INTO v_partner_owner FROM partners WHERE id = v_event.partner_id;

    -- Vérification des droits de contrôle (SUPERADMIN, ADMIN, CONTROLEUR ou le partenaire organisateur)
    IF v_controller.role NOT IN ('SUPERADMIN', 'ADMIN', 'CONTROLEUR') AND v_controller.id != v_partner_owner THEN
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
-- 5. PROTECTION CONTRE LES DOUBLES RÉSERVATIONS (SALLES & TABLES)
-- ============================================================================

-- Vérification de conflit pour les salles
CREATE OR REPLACE FUNCTION check_hall_availability()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM hall_reservations
        WHERE hall_id = NEW.hall_id
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND status IN ('EN_ATTENTE', 'CONFIRMEE')
          AND NOT (NEW.end_date < start_date OR NEW.start_date > end_date)
    ) THEN
        RAISE EXCEPTION 'La salle est déjà réservée pour cette période (dates conflictuelles)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_hall_conflict
    BEFORE INSERT OR UPDATE OF hall_id, start_date, end_date, status ON hall_reservations
    FOR EACH ROW
    WHEN (NEW.status IN ('EN_ATTENTE', 'CONFIRMEE'))
    EXECUTE FUNCTION check_hall_availability();

-- ============================================================================
-- 6. JOURNALISATION AUTOMATIQUE DANS L'AUDIT LOG
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
        SELECT role::text INTO v_user_role FROM users WHERE id = v_user_id;
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

-- Activation de l'audit sur les tables sensibles (Finances, Commissions, Retraits, Rôles)
CREATE TRIGGER trg_audit_payments AFTER INSERT OR UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
CREATE TRIGGER trg_audit_refunds AFTER INSERT OR UPDATE OR DELETE ON refunds FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
CREATE TRIGGER trg_audit_commissions AFTER INSERT OR UPDATE OR DELETE ON referral_commissions FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
CREATE TRIGGER trg_audit_withdrawals AFTER INSERT OR UPDATE OR DELETE ON withdrawals FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
CREATE TRIGGER trg_audit_referral_config AFTER INSERT OR UPDATE OR DELETE ON referral_config FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
CREATE TRIGGER trg_audit_users AFTER UPDATE OF role, status, referral_status ON users FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
