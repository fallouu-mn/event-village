-- ============================================================================
-- EVENT VILLAGE — SEED DATA (DONNÉES INITIALES)
-- ============================================================================
-- Description : Données de référence, packs d'abonnement, configuration
--               des taux de parrainage selon le CDC V3.0.
-- ============================================================================

-- 1. PACKS D'ABONNEMENT PARTENAIRES (STARTER, BUSINESS, PREMIUM)
INSERT INTO subscription_plans (code, name, description, price, billing_period, features)
VALUES 
    (
        'STARTER',
        'Pack Starter',
        'Idéal pour démarrer et tester la plateforme Event Village.',
        0.00,
        'MONTHLY',
        '{"max_events": 2, "max_products": 10, "commission_rate": 10, "support": "STANDARD"}'::jsonb
    ),
    (
        'BUSINESS',
        'Pack Business',
        'Pour les restaurants, traiteurs et organisateurs réguliers.',
        25000.00,
        'MONTHLY',
        '{"max_events": 10, "max_products": 50, "commission_rate": 7, "support": "PRIORITY", "analytics": true}'::jsonb
    ),
    (
        'PREMIUM',
        'Pack Premium',
        'Pour les grandes salles, structures événementielles et partenaires majeurs.',
        50000.00,
        'MONTHLY',
        '{"max_events": -1, "max_products": -1, "commission_rate": 5, "support": "VIP", "analytics": true, "custom_branding": true}'::jsonb
    )
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    features = EXCLUDED.features;

-- 2. CONFIGURATION DES TAUX DE PARRAINAGE SELON LE CAHIER DES CHARGES V3.0
-- Client standard -> Client : N1 = 5%, N2 = 2%, Durée = 12 mois
-- Client standard -> Prestataire : N1 = 7%, N2 = 2%, Durée = 24 mois
-- Ambassadeur -> Client : N1 = 7%, N2 = 2%, Durée = 24 mois
-- Ambassadeur -> Prestataire : N1 = 10%, N2 = 3%, Durée = 36 mois

INSERT INTO referral_config (sponsor_status, referral_type, rate_n1, rate_n2, duration_months, is_active)
VALUES
    ('STANDARD', 'CLIENT_TO_CLIENT', 5.00, 2.00, 12, TRUE),
    ('STANDARD', 'CLIENT_TO_PRESTATAIRE', 7.00, 2.00, 24, TRUE),
    ('AMBASSADEUR', 'CLIENT_TO_CLIENT', 7.00, 2.00, 24, TRUE),
    ('AMBASSADEUR', 'CLIENT_TO_PRESTATAIRE', 10.00, 3.00, 36, TRUE)
ON CONFLICT (sponsor_status, referral_type) DO UPDATE SET
    rate_n1 = EXCLUDED.rate_n1,
    rate_n2 = EXCLUDED.rate_n2,
    duration_months = EXCLUDED.duration_months,
    is_active = EXCLUDED.is_active;

-- Note : Le compte Superadministrateur (numéro initial : 773780756)
-- est initialisé automatiquement avec role = 'SUPERADMIN' lors de sa
-- première connexion / inscription via le trigger handle_new_user().
