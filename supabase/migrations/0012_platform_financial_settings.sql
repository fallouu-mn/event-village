-- Migration 0012 : Seed des paramètres financiers critiques dans platform_settings
-- Ces valeurs doivent exister pour que les API de calcul ne retournent pas d'erreur 500.
-- Modifiables uniquement via l'interface Superadmin, jamais en dur dans le code applicatif.

INSERT INTO public.platform_settings (key, value)
VALUES
    (
        'platform_commission_rate',
        '{"rate": 6.5, "description": "Taux de commission Event Village sur volume brut total (%)"}'::jsonb
    ),
    (
        'ticketing_fee_config',
        '{"service_fee_rate": 5.0, "aggregator_fee_rate": 1.5, "description": "Frais de service billetterie (acheteur) et frais agrégateur SamirPay"}'::jsonb
    ),
    (
        'order_commission_config',
        '{"commission_rate": 5.0, "description": "Commission EV sur commandes restauration/services (%)"}'::jsonb
    ),
    (
        'hall_fee_config',
        '{"aggregator_fee_rate": 1.5, "description": "Frais agrégateur SamirPay sur acomptes salles de fête (%)"}'::jsonb
    ),
    (
        'withdrawal_fee_config',
        '{"fee_rate": 1.0, "min_threshold": 5000, "description": "Frais de retrait (%) et seuil minimum (FCFA)"}'::jsonb
    )
ON CONFLICT (key) DO NOTHING;
