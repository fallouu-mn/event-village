-- ============================================================================
-- EVENT VILLAGE — LOT 10a, migration 01 : réglages de la réservation de salles (clés halls.*)
-- ============================================================================
-- Décisions du client (consigne du lot 10a) : frais de service payés par le client 5 %, commission sur la salle 0 % au
-- lancement, acompte 30 % par défaut, solde dû 7 jours avant la date, réservation non payée tenue 15 minutes, validation
-- des salles par l'administration activée, trois règles d'annulation dont les seuils sont des réglages.
--  1. valeurs par défaut (platform_settings, ON CONFLICT DO NOTHING : une valeur déjà réglée est gardée) ;
--  2. finance_setting_set : recopie de 20261117000002_f3a_reserve.sql:101-143, clés halls.* ajoutées à la liste ;
--  4. platform_settings_defaults : recopie de 20261118000002_f3b_reglages.sql:10-26, clés halls.* comprises (valeur d'origine de
--     chaque réglage, lue par la page des réglages).
--  3. fin_setting_valid : recopie de 20261117000002_f3a_reserve.sql:27-95, bornes des clés halls.* (identiques à lib/settings/catalog.ts).
-- Rejouable : ON CONFLICT DO NOTHING, CREATE OR REPLACE (droits d'exécution conservés).
-- ============================================================================

INSERT INTO public.platform_settings (key, value, description) VALUES
    ('halls.service_fee_rate', '{"value": 5}', 'Salles : frais de service payés par le client, en % du prix de la salle'),
    ('halls.commission_rate', '{"value": 0}', 'Salles : commission d''Event Village sur le prix de la salle, en %'),
    ('halls.deposit_default_percent', '{"value": 30}', 'Salles : acompte par défaut, en % du prix de la salle'),
    ('halls.balance_due_days', '{"value": 7}', 'Salles : le solde est dû au plus tard ce nombre de jours avant la date'),
    ('halls.hold_minutes', '{"value": 15}', 'Salles : durée pendant laquelle une réservation non payée garde la date, en minutes'),
    ('halls.validation_required', '{"value": true}', 'Salles : une salle doit être validée par l''administration avant d''être visible'),
    ('halls.cancel_partial_percent', '{"value": 50}', 'Salles : part remboursée dans la tranche intermédiaire des règles d''annulation, en %'),
    ('halls.cancel_souple_full_days', '{"value": 7}', 'Salles, règle souple : remboursement total jusqu''à ce nombre de jours avant'),
    ('halls.cancel_moderee_full_days', '{"value": 30}', 'Salles, règle modérée : remboursement total jusqu''à ce nombre de jours avant'),
    ('halls.cancel_moderee_partial_days', '{"value": 7}', 'Salles, règle modérée : remboursement partiel jusqu''à ce nombre de jours avant'),
    ('halls.cancel_stricte_partial_days', '{"value": 30}', 'Salles, règle stricte : remboursement partiel jusqu''à ce nombre de jours avant')
ON CONFLICT (key) DO NOTHING;

-- Recopie de 20261117000002_f3a_reserve.sql:101-143 ; changement : clés halls.* admises.
CREATE OR REPLACE FUNCTION public.finance_setting_set(p_key text, p_value jsonb, p_actor uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb := p_value->'value';
BEGIN
    IF p_key IS NULL OR p_key NOT IN (
        'finance.service_fee_rate', 'finance.aggregator_fee_rate.WAVE', 'finance.aggregator_fee_rate.ORANGE_MONEY',
        'finance.cancellation_aggregator_fee_bearer', 'finance.payout_hold_enabled', 'finance.payout_delay_hours',
        'finance.withdrawal_fee_rate', 'finance.withdrawal_min_amount', 'finance.withdrawal_bank_enabled',
        'finance.referral_availability_days', 'access.manual_entry_scope', 'access.scan_window_before_hours',
        'access.scan_window_after_hours', 'access.counter_sale_enabled', 'access.low_stock_threshold',
        'notif.reminder_j1_enabled', 'notif.reminder_j1_hour', 'notif.reminder_h3_enabled', 'notif.reminder_h3_hours',
        'notif.j1_sms', 'notif.h3_sms', 'notif.sms_quiet_start', 'notif.sms_quiet_end',
        'notif.sms_optional_daily_cap', 'notif.free_ticket_reminder_sms',
        'features.halls_enabled', 'features.tables_enabled', 'features.orders_enabled',
        'finance.payment_hold_minutes', 'finance.min_paid_price', 'notif.sms_essential_daily_alert',
        'access.refusal_alert_threshold', 'access.refusal_alert_minutes',
        'support.whatsapp', 'support.phone', 'support.email',
        -- Finition 3a (2) : réserve de prudence
        'finance.safety_reserve_mode', 'finance.safety_reserve_amount',
        -- Lot 10a : réservation de salles
        'halls.service_fee_rate', 'halls.commission_rate', 'halls.deposit_default_percent', 'halls.balance_due_days',
        'halls.hold_minutes', 'halls.validation_required', 'halls.cancel_partial_percent', 'halls.cancel_souple_full_days',
        'halls.cancel_moderee_full_days', 'halls.cancel_moderee_partial_days', 'halls.cancel_stricte_partial_days') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_KEY', 'message', 'Réglage inconnu.');
    END IF;
    IF p_actor IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_roles r JOIN public.users u ON u.id = r.user_id
         WHERE r.user_id = p_actor AND r.role = 'SUPERADMIN' AND u.status = 'ACTIF'
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Seul un SUPERADMIN actif modifie les réglages de la plateforme.');
    END IF;
    IF NOT public.fin_setting_valid(p_key, v) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_VALUE', 'message', format('Valeur refusée pour %s : %s', p_key, COALESCE(v::text, 'absente')));
    END IF;
    PERFORM set_config('finance.change_reason', COALESCE(p_reason, ''), true);
    INSERT INTO public.platform_settings (key, value, updated_by, updated_at)
    VALUES (p_key, jsonb_build_object('value', v), p_actor, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
    RETURN jsonb_build_object('ok', true, 'key', p_key, 'value', v);
END;
$$;

-- Recopie de 20261117000002_f3a_reserve.sql:27-95 ; changement : halls.validation_required (booléen) et bornes des clés halls.*.
CREATE OR REPLACE FUNCTION public.fin_setting_valid(p_key text, v jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    n numeric;
BEGIN
    IF v IS NULL THEN RETURN FALSE; END IF;
    IF p_key IN ('finance.payout_hold_enabled', 'finance.withdrawal_bank_enabled', 'access.counter_sale_enabled',
                 'notif.reminder_j1_enabled', 'notif.reminder_h3_enabled',
                 'features.halls_enabled', 'features.tables_enabled', 'features.orders_enabled',
                 'halls.validation_required') THEN
        RETURN jsonb_typeof(v) = 'boolean';
    END IF;
    IF p_key = 'access.manual_entry_scope' THEN
        RETURN jsonb_typeof(v) = 'string' AND (v #>> '{}') IN ('ASSIGNED_CONTROLLER', 'STAFF');
    END IF;
    IF p_key = 'finance.cancellation_aggregator_fee_bearer' THEN
        RETURN jsonb_typeof(v) = 'string' AND (v #>> '{}') IN ('EVENT_VILLAGE', 'ORGANISATEUR');
    END IF;
    IF p_key IN ('notif.j1_sms', 'notif.h3_sms') THEN
        RETURN jsonb_typeof(v) = 'string' AND (v #>> '{}') IN ('ALWAYS', 'IF_NO_PUSH', 'NEVER');
    END IF;
    -- Lot 9 quinquies (B1 : AUTH-06) : contact du support ; chaîne vide = non renseigné.
    IF p_key IN ('support.whatsapp', 'support.phone') THEN
        RETURN jsonb_typeof(v) = 'string' AND ((v #>> '{}') = '' OR (v #>> '{}') ~ '^\+[1-9][0-9]{7,14}$');
    END IF;
    IF p_key = 'support.email' THEN
        RETURN jsonb_typeof(v) = 'string' AND ((v #>> '{}') = ''
            OR (length(v #>> '{}') <= 254 AND (v #>> '{}') ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
    END IF;
    IF p_key = 'notif.free_ticket_reminder_sms' THEN
        RETURN jsonb_typeof(v) = 'string' AND (v #>> '{}') IN ('NEVER', 'SAME_AS_PAID');
    END IF;
    -- Finition 3a (2) : réserve de prudence gardée sur le compte SamirPay, automatique (encaissements des 3 derniers jours)
    -- ou montant fixe (finance.safety_reserve_amount)
    IF p_key = 'finance.safety_reserve_mode' THEN
        RETURN jsonb_typeof(v) = 'string' AND (v #>> '{}') IN ('AUTO_3_DAYS', 'FIXED');
    END IF;
    IF jsonb_typeof(v) <> 'number' THEN RETURN FALSE; END IF;
    n := (v #>> '{}')::numeric;
    RETURN CASE p_key
        WHEN 'finance.service_fee_rate' THEN n >= 0 AND n <= 50
        WHEN 'finance.aggregator_fee_rate.WAVE' THEN n >= 0 AND n <= 10
        WHEN 'finance.aggregator_fee_rate.ORANGE_MONEY' THEN n >= 0 AND n <= 10
        WHEN 'finance.payout_delay_hours' THEN n = trunc(n) AND n >= 0 AND n <= 720
        WHEN 'finance.withdrawal_fee_rate' THEN n >= 0 AND n <= 10
        WHEN 'finance.withdrawal_min_amount' THEN n = trunc(n) AND n >= 0 AND n <= 10000000
        WHEN 'finance.referral_availability_days' THEN n = trunc(n) AND n >= 7 AND n <= 14
        WHEN 'access.scan_window_before_hours' THEN n = trunc(n) AND n >= 0 AND n <= 48
        WHEN 'access.scan_window_after_hours' THEN n = trunc(n) AND n >= 0 AND n <= 48
        WHEN 'access.low_stock_threshold' THEN n = trunc(n) AND n >= 1 AND n <= 1000
        WHEN 'notif.reminder_j1_hour' THEN n = trunc(n) AND n >= 6 AND n <= 20
        WHEN 'notif.reminder_h3_hours' THEN n = trunc(n) AND n >= 1 AND n <= 12
        WHEN 'notif.sms_quiet_start' THEN n = trunc(n) AND n >= 0 AND n <= 23
        WHEN 'notif.sms_quiet_end' THEN n = trunc(n) AND n >= 0 AND n <= 23
        WHEN 'notif.sms_optional_daily_cap' THEN n = trunc(n) AND n >= 0 AND n <= 1000000
        WHEN 'finance.payment_hold_minutes' THEN n = trunc(n) AND n >= 5 AND n <= 60
        WHEN 'finance.min_paid_price' THEN n = trunc(n) AND n >= 1 AND n <= 100000
        WHEN 'notif.sms_essential_daily_alert' THEN n = trunc(n) AND n >= 1 AND n <= 1000000
        WHEN 'access.refusal_alert_threshold' THEN n = trunc(n) AND n >= 3 AND n <= 500
        WHEN 'access.refusal_alert_minutes' THEN n = trunc(n) AND n >= 1 AND n <= 60
        -- Finition 3a (2) : montant fixe de la réserve de prudence, entier en F CFA
        WHEN 'finance.safety_reserve_amount' THEN n = trunc(n) AND n >= 0 AND n <= 1000000000
        -- Lot 10a : réservation de salles
        WHEN 'halls.service_fee_rate' THEN n >= 0 AND n <= 50
        WHEN 'halls.commission_rate' THEN n >= 0 AND n <= 50
        WHEN 'halls.deposit_default_percent' THEN n = trunc(n) AND n >= 1 AND n <= 100
        WHEN 'halls.balance_due_days' THEN n = trunc(n) AND n >= 1 AND n <= 60
        WHEN 'halls.hold_minutes' THEN n = trunc(n) AND n >= 5 AND n <= 60
        WHEN 'halls.cancel_partial_percent' THEN n = trunc(n) AND n >= 1 AND n <= 99
        WHEN 'halls.cancel_souple_full_days' THEN n = trunc(n) AND n >= 1 AND n <= 365
        WHEN 'halls.cancel_moderee_full_days' THEN n = trunc(n) AND n >= 1 AND n <= 365
        WHEN 'halls.cancel_moderee_partial_days' THEN n = trunc(n) AND n >= 1 AND n <= 365
        WHEN 'halls.cancel_stricte_partial_days' THEN n = trunc(n) AND n >= 1 AND n <= 365
        ELSE FALSE END;
END;
$$;

-- Recopie de 20261118000002_f3b_reglages.sql:10-26 ; changement : préfixe halls ajouté.
CREATE OR REPLACE FUNCTION public.platform_settings_defaults()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(jsonb_object_agg(s.key, COALESCE(
               (SELECT COALESCE(h.old_value, h.new_value)
                  FROM public.platform_settings_history h
                 WHERE h.key = s.key
                 ORDER BY h.changed_at, h.id
                 LIMIT 1),
               s.value) -> 'value'), '{}'::jsonb)
      FROM public.platform_settings s
     WHERE s.key ~ '^(finance|access|notif|features|support|halls)\.'
$$;
