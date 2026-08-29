-- ============================================================================
-- EVENT VILLAGE — MIGRATION 0004 : INDEXES & TEMPS RÉEL (REALTIME)
-- ============================================================================
-- Description : Indexes optimisés pour les clés étrangères, recherches,
--               filtrages fréquents, idempotence et publication Realtime.
-- Référence : Cahier des Charges V3.0 & Directives Techniques
-- ============================================================================

-- ============================================================================
-- 1. INDEXES : USERS
-- ============================================================================
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_referral_status ON users(referral_status);
CREATE INDEX idx_users_status ON users(status);

-- ============================================================================
-- 2. INDEXES : PARTNERS & ACTIVITÉS
-- ============================================================================
CREATE INDEX idx_partners_user_id ON partners(user_id);
CREATE INDEX idx_partners_status ON partners(status);
CREATE INDEX idx_partners_subscription ON partners(subscription_plan_id);
CREATE INDEX idx_partner_activities_partner_id ON partner_activities(partner_id);
CREATE INDEX idx_partner_activities_type ON partner_activities(activity_type);

-- ============================================================================
-- 3. INDEXES : ÉVÉNEMENTS & TICKETING
-- ============================================================================
CREATE INDEX idx_events_partner_id ON events(partner_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_slug ON events(slug);
CREATE INDEX idx_ticket_categories_event_id ON ticket_categories(event_id);
CREATE INDEX idx_tickets_event_id ON tickets(event_id);
CREATE INDEX idx_tickets_category_id ON tickets(category_id);
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_order_id ON tickets(order_id);
CREATE INDEX idx_tickets_qr_code ON tickets(qr_code);
CREATE INDEX idx_tickets_status ON tickets(status);

-- ============================================================================
-- 4. INDEXES : SALLES & RÉSERVATIONS
-- ============================================================================
CREATE INDEX idx_halls_partner_id ON halls(partner_id);
CREATE INDEX idx_halls_active ON halls(is_active);
CREATE INDEX idx_hall_reservations_hall_id ON hall_reservations(hall_id);
CREATE INDEX idx_hall_reservations_client_id ON hall_reservations(client_id);
CREATE INDEX idx_hall_reservations_partner_id ON hall_reservations(partner_id);
CREATE INDEX idx_hall_reservations_dates ON hall_reservations(start_date, end_date);
CREATE INDEX idx_hall_reservations_status ON hall_reservations(status);

-- ============================================================================
-- 5. INDEXES : RESTAURANT & RÉSERVATION DE TABLES
-- ============================================================================
CREATE INDEX idx_restaurant_zones_partner_id ON restaurant_zones(partner_id);
CREATE INDEX idx_restaurant_tables_partner_id ON restaurant_tables(partner_id);
CREATE INDEX idx_restaurant_tables_zone_id ON restaurant_tables(zone_id);
CREATE INDEX idx_table_reservations_partner_id ON table_reservations(partner_id);
CREATE INDEX idx_table_reservations_table_id ON table_reservations(table_id);
CREATE INDEX idx_table_reservations_client_id ON table_reservations(client_id);
CREATE INDEX idx_table_reservations_date ON table_reservations(reservation_date);
CREATE INDEX idx_table_reservations_status ON table_reservations(status);

-- ============================================================================
-- 6. INDEXES : PRODUITS & COMMANDES
-- ============================================================================
CREATE INDEX idx_product_categories_partner_id ON product_categories(partner_id);
CREATE INDEX idx_products_partner_id ON products(partner_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_daily_special ON products(is_daily_special, daily_special_date);
CREATE INDEX idx_orders_client_id ON orders(client_id);
CREATE INDEX idx_orders_partner_id ON orders(partner_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- ============================================================================
-- 7. INDEXES : PAIEMENTS & REMBOURSEMENTS
-- ============================================================================
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX idx_payments_external_order_id ON payments(external_order_id);
CREATE INDEX idx_payments_external_transaction_id ON payments(external_transaction_id);
CREATE INDEX idx_payments_client_id ON payments(client_id);
CREATE INDEX idx_payments_partner_id ON payments(partner_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_ticket_id ON payments(ticket_id);
CREATE INDEX idx_payments_hall_res ON payments(hall_reservation_id);
CREATE INDEX idx_payments_table_res ON payments(table_reservation_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_idempotency_key ON payments(idempotency_key);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX idx_refunds_transaction_id ON refunds(refund_transaction_id);

-- ============================================================================
-- 8. INDEXES : PARRAINAGE & COMMISSIONS
-- ============================================================================
CREATE INDEX idx_referral_rel_sponsor_id ON referral_relationships(sponsor_id);
CREATE INDEX idx_referral_rel_referred_id ON referral_relationships(referred_id);
CREATE INDEX idx_referral_rel_active_expires ON referral_relationships(is_active, expires_at);
CREATE INDEX idx_referral_comm_sponsor_id ON referral_commissions(sponsor_id);
CREATE INDEX idx_referral_comm_referred_id ON referral_commissions(referred_id);
CREATE INDEX idx_referral_comm_payment_id ON referral_commissions(payment_id);
CREATE INDEX idx_referral_comm_status ON referral_commissions(status);
CREATE INDEX idx_referral_comm_idempotency ON referral_commissions(idempotency_key);
CREATE INDEX idx_referral_comm_created_at ON referral_commissions(created_at DESC);

-- ============================================================================
-- 9. INDEXES : RETRAITS, NOTIFICATIONS & AUDIT
-- ============================================================================
CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
CREATE INDEX idx_withdrawals_created_at ON withdrawals(created_at DESC);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_object ON audit_logs(object_type, object_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================================
-- 10. CONFIGURATION SUPABASE REALTIME
-- ============================================================================
-- Configuration REPLICA IDENTITY FULL pour que les filtres postgres_changes
-- reçoivent l'intégralité des colonnes lors des événements UPDATE / DELETE.
-- ============================================================================
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE payments REPLICA IDENTITY FULL;
ALTER TABLE tickets REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE hall_reservations REPLICA IDENTITY FULL;
ALTER TABLE table_reservations REPLICA IDENTITY FULL;

DO $$
BEGIN
    -- Ajout des tables à la publication Realtime Supabase si celle-ci existe
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
        ALTER PUBLICATION supabase_realtime ADD TABLE payments;
        ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
        ALTER PUBLICATION supabase_realtime ADD TABLE hall_reservations;
        ALTER PUBLICATION supabase_realtime ADD TABLE table_reservations;
    END IF;
END $$;

