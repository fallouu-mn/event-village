-- ============================================================================
-- EVENT VILLAGE — MIGRATION 0001 : SCHEMA INITIAL
-- ============================================================================
-- Description : Création des extensions, enums, tables et contraintes métier.
-- Référence : Cahier des Charges V3.0 (Août 2026) & Architecture Technique V1.0
-- ============================================================================

-- Activation des extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TYPES ENUMÉRÉS (ENUMS)
-- ============================================================================

-- Rôles utilisateurs (IMPORTANT: AMBASSADEUR n'est PAS un rôle)
CREATE TYPE user_role AS ENUM (
    'CLIENT',
    'PARTENAIRE',
    'ADMIN',
    'CONTROLEUR',
    'SUPERADMIN'
);

-- Statut de parrainage de l'utilisateur
CREATE TYPE referral_status AS ENUM (
    'STANDARD',
    'AMBASSADEUR'
);

-- Statut du compte utilisateur
CREATE TYPE user_status AS ENUM (
    'ACTIF',
    'SUSPENDU',
    'EN_ATTENTE'
);

-- Statut de validation du partenaire
CREATE TYPE partner_status AS ENUM (
    'EN_ATTENTE',
    'VALIDE',
    'REJETE',
    'SUSPENDU'
);

-- Types d'activités possibles pour un partenaire (Multi-activités)
CREATE TYPE partner_activity_type AS ENUM (
    'RESTAURANT',
    'TRAITEUR',
    'SALLE',
    'ORGANISATEUR',
    'PRESTATAIRE',
    'PATISSERIE',
    'ETABLISSEMENT_ALIMENTAIRE',
    'AUTRE'
);

-- Statut d'un événement
CREATE TYPE event_status AS ENUM (
    'BROUILLON',
    'EN_ATTENTE',
    'VALIDE',
    'PUBLIE',
    'SUSPENDU',
    'TERMINE'
);

-- Statut d'un ticket de ticketing
CREATE TYPE ticket_status AS ENUM (
    'VALIDE',
    'UTILISE',
    'ANNULE',
    'REMBOURSE'
);

-- Statut général d'une réservation (salle / table)
CREATE TYPE reservation_status AS ENUM (
    'EN_ATTENTE',
    'CONFIRMEE',
    'ANNULEE',
    'TERMINEE',
    'REJETEE'
);

-- Statut des paiements
CREATE TYPE payment_status_enum AS ENUM (
    'PENDING',
    'PARTIAL',
    'SUCCESS',
    'FAILED',
    'REFUNDED',
    'CANCELLED'
);

-- Moyen de paiement hors plateforme
CREATE TYPE offline_payment_method_enum AS ENUM (
    'ESPECES',
    'WAVE_DIRECT',
    'OM_DIRECT',
    'AUTRE'
);

-- Cible d'un paiement
CREATE TYPE payment_target_enum AS ENUM (
    'ORDER',
    'HALL_RESERVATION',
    'TABLE_RESERVATION',
    'TICKET',
    'SUBSCRIPTION',
    'OTHER'
);

-- Statut d'un produit
CREATE TYPE product_status AS ENUM (
    'DISPONIBLE',
    'INDISPONIBLE',
    'EPUISE',
    'SUSPENDU'
);

-- Type de règlement de commande
CREATE TYPE payment_type_enum AS ENUM (
    'INTEGRAL',
    'ACOMPTE',
    'DIFFERE'
);

-- Mode de livraison / remise de commande
CREATE TYPE delivery_mode_enum AS ENUM (
    'LIVRAISON',
    'RETRAIT',
    'SUR_PLACE'
);

-- Statut d'une commande
CREATE TYPE order_status_enum AS ENUM (
    'EN_ATTENTE',
    'CONFIRMEE',
    'EN_PREPARATION',
    'PRETE',
    'EN_LIVRAISON',
    'LIVREE',
    'ANNULEE',
    'REJETEE'
);

-- Type de relation de parrainage
CREATE TYPE referral_type_enum AS ENUM (
    'CLIENT_TO_CLIENT',
    'CLIENT_TO_PRESTATAIRE'
);

-- Génération de parrainage
CREATE TYPE referral_generation_enum AS ENUM (
    'N1',
    'N2'
);

-- Statut d'une commission de parrainage
CREATE TYPE commission_status_enum AS ENUM (
    'PENDING',
    'AVAILABLE',
    'PAID',
    'CANCELLED'
);

-- Moyen de retrait financier
CREATE TYPE withdrawal_method_enum AS ENUM (
    'MOBILE_MONEY',
    'BANK'
);

-- Statut d'un retrait
CREATE TYPE withdrawal_status_enum AS ENUM (
    'PENDING',
    'PROCESSING',
    'PAID',
    'REJECTED',
    'CANCELLED'
);

-- Canal de notification
CREATE TYPE notification_channel_enum AS ENUM (
    'SMS',
    'WHATSAPP',
    'EMAIL',
    'PUSH'
);

-- Statut de notification
CREATE TYPE notification_status_enum AS ENUM (
    'PENDING',
    'SENT',
    'DELIVERED',
    'FAILED',
    'READ'
);

-- Statut d'un remboursement
CREATE TYPE refund_status_enum AS ENUM (
    'PENDING',
    'PROCESSED',
    'FAILED'
);

-- ============================================================================
-- 2. UTILISATEURS & AUTHENTIFICATION
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    role user_role NOT NULL DEFAULT 'CLIENT',
    status user_status NOT NULL DEFAULT 'ACTIF',
    referral_status referral_status NOT NULL DEFAULT 'STANDARD',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE users IS 'Profils utilisateurs Event Village synchronisés avec Supabase Auth';
COMMENT ON COLUMN users.role IS 'Rôle technique et fonctionnel (CLIENT, PARTENAIRE, ADMIN, CONTROLEUR, SUPERADMIN)';
COMMENT ON COLUMN users.referral_status IS 'Statut de parrainage : STANDARD ou AMBASSADEUR (L''ambassadeur conserve role = CLIENT)';

-- ============================================================================
-- 3. PLANS DE SOUSCRIPTION & PARTENAIRES MULTI-ACTIVITÉS
-- ============================================================================

CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE, -- 'STARTER', 'BUSINESS', 'PREMIUM'
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    billing_period TEXT NOT NULL DEFAULT 'MONTHLY',
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    company_name TEXT NOT NULL,
    commercial_name TEXT,
    description TEXT,
    logo_url TEXT,
    cover_url TEXT,
    address TEXT,
    city TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    phone TEXT,
    email TEXT,
    id_card_url TEXT,
    business_doc_url TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status partner_status NOT NULL DEFAULT 'EN_ATTENTE',
    subscription_plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
    trial_started_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE partners IS 'Comptes partenaires Event Village (Un compte unique par organisation)';

-- Multi-activités du partenaire (Un compte Partenaire -> Plusieurs activités)
CREATE TABLE partner_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    activity_type partner_activity_type NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_partner_activity UNIQUE (partner_id, activity_type)
);

COMMENT ON TABLE partner_activities IS 'Activités exercées par le partenaire (restaurant, salle, traiteur, organisateur, etc.)';

-- ============================================================================
-- 4. ÉVÉNEMENTS & TICKETING
-- ============================================================================

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    description TEXT,
    program JSONB,
    practical_info JSONB,
    start_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_date DATE,
    end_time TIME,
    location TEXT NOT NULL,
    city TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    image_url TEXT,
    gallery_urls TEXT[] DEFAULT '{}',
    capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
    status event_status NOT NULL DEFAULT 'BROUILLON',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ticket_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    total_quantity INTEGER NOT NULL CHECK (total_quantity >= 0),
    sold_quantity INTEGER NOT NULL DEFAULT 0 CHECK (sold_quantity >= 0 AND sold_quantity <= total_quantity),
    sale_start TIMESTAMPTZ,
    sale_end TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table des commandes
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (delivery_fee >= 0),
    service_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (service_fee >= 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    balance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance_amount >= 0),
    payment_type payment_type_enum NOT NULL DEFAULT 'INTEGRAL',
    delivery_mode delivery_mode_enum NOT NULL,
    delivery_address TEXT,
    delivery_latitude DOUBLE PRECISION,
    delivery_longitude DOUBLE PRECISION,
    delivery_notes TEXT,
    order_status order_status_enum NOT NULL DEFAULT 'EN_ATTENTE',
    payment_status payment_status_enum NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    category_id UUID NOT NULL REFERENCES ticket_categories(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    ticket_number TEXT NOT NULL UNIQUE,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    qr_code TEXT NOT NULL UNIQUE,
    status ticket_status NOT NULL DEFAULT 'VALIDE',
    checked_in_at TIMESTAMPTZ,
    checked_in_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE tickets IS 'Tickets individuels avec QR code sécurisé unique et historique de contrôle';

-- ============================================================================
-- 5. RÉSERVATION DE SALLES
-- ============================================================================

CREATE TABLE halls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    price_per_day NUMERIC(12, 2) CHECK (price_per_day IS NULL OR price_per_day >= 0),
    price_per_hour NUMERIC(12, 2) CHECK (price_per_hour IS NULL OR price_per_hour >= 0),
    deposit_percentage NUMERIC(5, 2) NOT NULL DEFAULT 30.00 CHECK (deposit_percentage >= 0 AND deposit_percentage <= 100),
    address TEXT,
    city TEXT,
    amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
    images TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hall_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hall_id UUID NOT NULL REFERENCES halls(id) ON DELETE RESTRICT,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    deposit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (deposit_amount >= 0),
    balance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance_amount >= 0),
    moratorium_date DATE,
    payment_status payment_status_enum NOT NULL DEFAULT 'PENDING',
    status reservation_status NOT NULL DEFAULT 'EN_ATTENTE',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_hall_dates CHECK (end_date >= start_date)
);

COMMENT ON TABLE hall_reservations IS 'Réservations de salles avec gestion de l''acompte, du solde et du moratoire';

-- ============================================================================
-- 6. RÉSERVATION DE TABLES (RESTAURANTS)
-- ============================================================================

CREATE TABLE restaurant_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES restaurant_zones(id) ON DELETE SET NULL,
    table_number TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    min_capacity INTEGER NOT NULL DEFAULT 1 CHECK (min_capacity > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_partner_table_number UNIQUE (partner_id, table_number)
);

CREATE TABLE table_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    zone_id UUID REFERENCES restaurant_zones(id) ON DELETE SET NULL,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    guest_count INTEGER NOT NULL CHECK (guest_count > 0),
    deposit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (deposit_amount >= 0),
    is_platform_payment BOOLEAN NOT NULL DEFAULT TRUE,
    offline_payment_method offline_payment_method_enum,
    payment_status payment_status_enum NOT NULL DEFAULT 'PENDING',
    status reservation_status NOT NULL DEFAULT 'EN_ATTENTE',
    special_requests TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE table_reservations IS 'Réservations de tables de restaurant avec distinction paiement plateforme / hors plateforme';

-- ============================================================================
-- 7. PRODUITS & COMMANDES (COMMANDE & VENTE)
-- ============================================================================

CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    is_daily_special BOOLEAN NOT NULL DEFAULT FALSE,
    daily_special_date DATE,
    stock_quantity INTEGER CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
    is_stock_managed BOOLEAN NOT NULL DEFAULT FALSE,
    status product_status NOT NULL DEFAULT 'DISPONIBLE',
    images TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL, -- Historisé au moment de la commande
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0), -- Prix unitaire fixé au moment de la commande
    total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE order_items IS 'Lignes de commande avec conservation impérative du prix et du nom du produit au moment de l''achat';

-- ============================================================================
-- 8. PAIEMENTS & REMBOURSEMENTS (SAMIRPAY & HORS PLATEFORME)
-- ============================================================================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT NOT NULL UNIQUE, -- Identifiant unique de transaction interne Event Village
    external_order_id TEXT UNIQUE, -- Identifiant order_id transmis à SamirPay
    external_transaction_id TEXT, -- Identifiant transaction retourné par SamirPay
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    partner_id UUID REFERENCES partners(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    hall_reservation_id UUID REFERENCES hall_reservations(id) ON DELETE SET NULL,
    table_reservation_id UUID REFERENCES table_reservations(id) ON DELETE SET NULL,
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    subscription_plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
    payment_target payment_target_enum NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'XOF',
    payment_method TEXT, -- Wave, OM, Free Money, Carte, etc.
    is_platform_payment BOOLEAN NOT NULL DEFAULT TRUE, -- FALSE si paiement direct en espèces ou Wave direct
    offline_payment_method offline_payment_method_enum,
    aggregator TEXT DEFAULT 'SAMIRPAY',
    aggregator_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (aggregator_fee >= 0),
    service_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (service_fee >= 0),
    gross_event_village_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_event_village_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    partner_payout_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status payment_status_enum NOT NULL DEFAULT 'PENDING',
    provider_status TEXT,
    provider_response JSONB,
    idempotency_key TEXT UNIQUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE payments IS 'Table financière critique des transactions avec distinction claire plateforme / hors plateforme';

CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    refund_transaction_id TEXT NOT NULL UNIQUE,
    external_refund_id TEXT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    status refund_status_enum NOT NULL DEFAULT 'PENDING',
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 9. PARRAINAGE & COMMISSIONS MULTI-NIVEAUX (CDC V3)
-- ============================================================================

-- Configuration dynamique des taux de parrainage (modifiable par le Superadmin, historisée dans les transactions)
CREATE TABLE referral_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_status referral_status NOT NULL, -- STANDARD ou AMBASSADEUR
    referral_type referral_type_enum NOT NULL, -- CLIENT_TO_CLIENT ou CLIENT_TO_PRESTATAIRE
    rate_n1 NUMERIC(5, 2) NOT NULL CHECK (rate_n1 >= 0 AND rate_n1 <= 100),
    rate_n2 NUMERIC(5, 2) NOT NULL CHECK (rate_n2 >= 0 AND rate_n2 <= 100),
    duration_months INTEGER NOT NULL CHECK (duration_months > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_referral_config UNIQUE (sponsor_status, referral_type)
);

-- Relations de parrainage enregistrées
CREATE TABLE referral_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- Le parrain
    referred_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- Le filleul
    referral_type referral_type_enum NOT NULL,
    sponsor_status_at_creation referral_status NOT NULL, -- Historique du statut au moment du parrainage
    rate_n1_at_creation NUMERIC(5, 2) NOT NULL, -- Historisation des taux
    rate_n2_at_creation NUMERIC(5, 2) NOT NULL,
    duration_months INTEGER NOT NULL,
    start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_no_self_referral CHECK (sponsor_id != referred_id),
    CONSTRAINT uq_referred_user UNIQUE (referred_id) -- Un filleul ne peut avoir qu'un seul parrain direct
);

COMMENT ON TABLE referral_relationships IS 'Arbre de parrainage avec historisation des conditions et durée de validité (12, 24 ou 36 mois)';

-- Commissions générées sur les transactions éligibles
CREATE TABLE referral_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- Parrain bénéficiaire
    referred_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- Filleul ayant déclenché la transaction
    generation referral_generation_enum NOT NULL, -- N1 ou N2
    referral_type referral_type_enum NOT NULL,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    eligible_net_revenue NUMERIC(12, 2) NOT NULL CHECK (eligible_net_revenue >= 0), -- Base de calcul stricte : Revenu NET Event Village éligible
    commission_rate NUMERIC(5, 2) NOT NULL CHECK (commission_rate >= 0), -- Taux historisé
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0), -- Montant net de la commission
    status commission_status_enum NOT NULL DEFAULT 'PENDING',
    available_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    idempotency_key TEXT NOT NULL UNIQUE, -- Garantit qu'une commission n'est calculée qu'une seule fois
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE referral_commissions IS 'Commissions N1/N2 calculées exclusivement sur le Revenu Net Event Village éligible';

-- ============================================================================
-- 10. RETRAITS FINANCIERS (PARRAINS, AMBASSADEURS, PARTENAIRES)
-- ============================================================================

CREATE TABLE withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    gross_amount NUMERIC(12, 2) NOT NULL CHECK (gross_amount >= 5000.00), -- Seuil minimum 5000 FCFA
    fee_rate NUMERIC(5, 2) NOT NULL DEFAULT 1.00 CHECK (fee_rate >= 0), -- Frais de retrait (ex: 1%)
    fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (fee_amount >= 0),
    net_amount NUMERIC(12, 2) NOT NULL CHECK (net_amount > 0),
    withdrawal_method withdrawal_method_enum NOT NULL,
    payment_details JSONB NOT NULL, -- Numéro Wave/OM ou RIB bancaire
    external_reference TEXT,
    status withdrawal_status_enum NOT NULL DEFAULT 'PENDING',
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 11. NOTIFICATIONS
-- ============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'ORDER_STATUS', 'PAYMENT_SUCCESS', 'TICKET_CONFIRMATION', etc.
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    channel notification_channel_enum NOT NULL,
    status notification_status_enum NOT NULL DEFAULT 'PENDING',
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 12. AUDIT LOGS (TRAÇABILITÉ COMPLÈTE)
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_role TEXT,
    action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'FINANCIAL_OVERRIDE'
    object_type TEXT NOT NULL, -- 'payments', 'referral_commissions', 'orders', etc.
    object_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE audit_logs IS 'Journal d''audit inaltérable des opérations sensibles, financières et d''administration';
