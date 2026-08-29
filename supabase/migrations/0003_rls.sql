-- ============================================================================
-- EVENT VILLAGE — MIGRATION 0003 : ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Description : Activation globale de RLS et définition des politiques
--               de sécurité d'accès aux données pour tous les profils.
-- Référence : Cahier des Charges V3.0 & Directives Techniques
-- ============================================================================

-- ============================================================================
-- 1. FONCTIONS UTILITAIRES DE SÉCURITÉ
-- ============================================================================

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role AS $$
    SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(auth_user_role() = 'SUPERADMIN', FALSE);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(auth_user_role() IN ('ADMIN', 'SUPERADMIN'), FALSE);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_controller()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(auth_user_role() IN ('CONTROLEUR', 'ADMIN', 'SUPERADMIN'), FALSE);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_partner_owner(p_partner_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM partners
        WHERE id = p_partner_id
          AND user_id = auth.uid()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 2. ACTIVATION DE RLS SUR TOUTES LES TABLES
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE halls ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. POLITIQUES : USERS
-- ============================================================================

CREATE POLICY "users_select_policy" ON users
    FOR SELECT USING (
        id = auth.uid()
        OR is_admin()
        OR is_controller()
        OR EXISTS (SELECT 1 FROM partners WHERE user_id = users.id AND status = 'VALIDE')
    );

CREATE POLICY "users_update_own" ON users
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        -- Empêche l'utilisateur d'élever lui-même ses privilèges
        AND role = (SELECT role FROM users WHERE id = auth.uid())
        AND referral_status = (SELECT referral_status FROM users WHERE id = auth.uid())
    );

CREATE POLICY "users_admin_manage" ON users
    FOR ALL USING (is_admin());

-- ============================================================================
-- 4. POLITIQUES : SUBSCRIPTION_PLANS
-- ============================================================================

CREATE POLICY "subscription_plans_read_active" ON subscription_plans
    FOR SELECT USING (is_active = TRUE OR is_admin());

CREATE POLICY "subscription_plans_admin_manage" ON subscription_plans
    FOR ALL USING (is_admin());

-- ============================================================================
-- 5. POLITIQUES : PARTNERS & PARTNER_ACTIVITIES
-- ============================================================================

CREATE POLICY "partners_read_public" ON partners
    FOR SELECT USING (status = 'VALIDE' OR user_id = auth.uid() OR is_admin());

CREATE POLICY "partners_insert_auth" ON partners
    FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY "partners_update_owner" ON partners
    FOR UPDATE USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "partners_delete_superadmin" ON partners
    FOR DELETE USING (is_superadmin());

CREATE POLICY "partner_activities_read" ON partner_activities
    FOR SELECT USING (
        is_active = TRUE
        OR is_partner_owner(partner_id)
        OR is_admin()
    );

CREATE POLICY "partner_activities_manage" ON partner_activities
    FOR ALL USING (is_partner_owner(partner_id) OR is_admin());

-- ============================================================================
-- 6. POLITIQUES : EVENTS & TICKETING
-- ============================================================================

CREATE POLICY "events_read_public" ON events
    FOR SELECT USING (status = 'PUBLIE' OR is_partner_owner(partner_id) OR is_admin());

CREATE POLICY "events_partner_manage" ON events
    FOR ALL USING (is_partner_owner(partner_id) OR is_admin());

CREATE POLICY "ticket_categories_read_public" ON ticket_categories
    FOR SELECT USING (
        is_active = TRUE
        OR EXISTS (SELECT 1 FROM events WHERE events.id = ticket_categories.event_id AND is_partner_owner(events.partner_id))
        OR is_admin()
    );

CREATE POLICY "ticket_categories_partner_manage" ON ticket_categories
    FOR ALL USING (
        EXISTS (SELECT 1 FROM events WHERE events.id = ticket_categories.event_id AND is_partner_owner(events.partner_id))
        OR is_admin()
    );

CREATE POLICY "tickets_read" ON tickets
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM events WHERE events.id = tickets.event_id AND is_partner_owner(events.partner_id))
        OR is_controller()
    );

CREATE POLICY "tickets_insert_auth" ON tickets
    FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY "tickets_update_controller" ON tickets
    FOR UPDATE USING (is_controller() OR is_admin());

-- ============================================================================
-- 7. POLITIQUES : RÉSERVATION DE SALLES (HALLS)
-- ============================================================================

CREATE POLICY "halls_read_public" ON halls
    FOR SELECT USING (is_active = TRUE OR is_partner_owner(partner_id) OR is_admin());

CREATE POLICY "halls_partner_manage" ON halls
    FOR ALL USING (is_partner_owner(partner_id) OR is_admin());

CREATE POLICY "hall_reservations_read" ON hall_reservations
    FOR SELECT USING (
        client_id = auth.uid()
        OR is_partner_owner(partner_id)
        OR is_admin()
    );

CREATE POLICY "hall_reservations_insert" ON hall_reservations
    FOR INSERT WITH CHECK (client_id = auth.uid() OR is_admin());

CREATE POLICY "hall_reservations_update" ON hall_reservations
    FOR UPDATE USING (
        client_id = auth.uid()
        OR is_partner_owner(partner_id)
        OR is_admin()
    );

-- ============================================================================
-- 8. POLITIQUES : RESTAURANT & RÉSERVATION DE TABLES
-- ============================================================================

CREATE POLICY "restaurant_zones_read" ON restaurant_zones
    FOR SELECT USING (is_active = TRUE OR is_partner_owner(partner_id) OR is_admin());

CREATE POLICY "restaurant_zones_manage" ON restaurant_zones
    FOR ALL USING (is_partner_owner(partner_id) OR is_admin());

CREATE POLICY "restaurant_tables_read" ON restaurant_tables
    FOR SELECT USING (is_active = TRUE OR is_partner_owner(partner_id) OR is_admin());

CREATE POLICY "restaurant_tables_manage" ON restaurant_tables
    FOR ALL USING (is_partner_owner(partner_id) OR is_admin());

CREATE POLICY "table_reservations_read" ON table_reservations
    FOR SELECT USING (
        client_id = auth.uid()
        OR is_partner_owner(partner_id)
        OR is_admin()
    );

CREATE POLICY "table_reservations_insert" ON table_reservations
    FOR INSERT WITH CHECK (client_id = auth.uid() OR is_admin());

CREATE POLICY "table_reservations_update" ON table_reservations
    FOR UPDATE USING (
        client_id = auth.uid()
        OR is_partner_owner(partner_id)
        OR is_admin()
    );

-- ============================================================================
-- 9. POLITIQUES : PRODUITS, COMMANDES & LIGNES DE COMMANDE
-- ============================================================================

CREATE POLICY "product_categories_read" ON product_categories
    FOR SELECT USING (is_active = TRUE OR is_partner_owner(partner_id) OR is_admin());

CREATE POLICY "product_categories_manage" ON product_categories
    FOR ALL USING (is_partner_owner(partner_id) OR is_admin());

CREATE POLICY "products_read" ON products
    FOR SELECT USING (status = 'DISPONIBLE' OR is_partner_owner(partner_id) OR is_admin());

CREATE POLICY "products_manage" ON products
    FOR ALL USING (is_partner_owner(partner_id) OR is_admin());

CREATE POLICY "orders_read" ON orders
    FOR SELECT USING (
        client_id = auth.uid()
        OR is_partner_owner(partner_id)
        OR is_admin()
    );

CREATE POLICY "orders_insert" ON orders
    FOR INSERT WITH CHECK (client_id = auth.uid() OR is_admin());

CREATE POLICY "orders_update" ON orders
    FOR UPDATE USING (
        is_partner_owner(partner_id)
        OR is_admin()
    );

CREATE POLICY "order_items_read" ON order_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (orders.client_id = auth.uid() OR is_partner_owner(orders.partner_id) OR is_admin()))
    );

CREATE POLICY "order_items_insert" ON order_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.client_id = auth.uid())
        OR is_admin()
    );

-- ============================================================================
-- 10. POLITIQUES : PAIEMENTS & REMBOURSEMENTS
-- ============================================================================

CREATE POLICY "payments_read" ON payments
    FOR SELECT USING (
        client_id = auth.uid()
        OR (partner_id IS NOT NULL AND is_partner_owner(partner_id))
        OR is_admin()
    );

CREATE POLICY "payments_insert_auth" ON payments
    FOR INSERT WITH CHECK (client_id = auth.uid() OR is_admin());

CREATE POLICY "payments_admin_update" ON payments
    FOR UPDATE USING (is_admin());

CREATE POLICY "refunds_read" ON refunds
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM payments WHERE payments.id = refunds.payment_id AND (payments.client_id = auth.uid() OR (payments.partner_id IS NOT NULL AND is_partner_owner(payments.partner_id))))
        OR is_admin()
    );

CREATE POLICY "refunds_admin_manage" ON refunds
    FOR ALL USING (is_admin());

-- ============================================================================
-- 11. POLITIQUES : PARRAINAGE & COMMISSIONS
-- ============================================================================

CREATE POLICY "referral_config_read" ON referral_config
    FOR SELECT USING (is_active = TRUE OR is_admin());

CREATE POLICY "referral_config_admin_manage" ON referral_config
    FOR ALL USING (is_admin());

CREATE POLICY "referral_relationships_read" ON referral_relationships
    FOR SELECT USING (
        sponsor_id = auth.uid()
        OR referred_id = auth.uid()
        OR is_admin()
    );

CREATE POLICY "referral_relationships_insert" ON referral_relationships
    FOR INSERT WITH CHECK (referred_id = auth.uid() OR is_admin());

CREATE POLICY "referral_commissions_read" ON referral_commissions
    FOR SELECT USING (
        sponsor_id = auth.uid()
        OR is_admin()
    );

CREATE POLICY "referral_commissions_admin_manage" ON referral_commissions
    FOR ALL USING (is_admin());

-- ============================================================================
-- 12. POLITIQUES : RETRAITS
-- ============================================================================

CREATE POLICY "withdrawals_read" ON withdrawals
    FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "withdrawals_insert" ON withdrawals
    FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY "withdrawals_admin_manage" ON withdrawals
    FOR UPDATE USING (is_admin());

-- ============================================================================
-- 13. POLITIQUES : NOTIFICATIONS
-- ============================================================================

CREATE POLICY "notifications_read_own" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_admin" ON notifications
    FOR INSERT WITH CHECK (is_admin() OR user_id = auth.uid());

-- ============================================================================
-- 14. POLITIQUES : AUDIT LOGS
-- ============================================================================

CREATE POLICY "audit_logs_superadmin_read" ON audit_logs
    FOR SELECT USING (is_admin());

CREATE POLICY "audit_logs_insert_system" ON audit_logs
    FOR INSERT WITH CHECK (TRUE);
