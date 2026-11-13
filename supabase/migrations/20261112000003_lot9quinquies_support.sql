-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUINQUIES : contact du support (B1 : AUTH-06 ; utilisé par A5 : T1)
-- ============================================================================
-- B1 (décision du chef de projet) : réglages SUPERADMIN « Numéro WhatsApp du support » (support.whatsapp), « Téléphone
--   du support » (support.phone), « Email du support » (support.email). Valeur texte, chaîne vide = non renseigné ;
--   numéro au format international (+221…), adresse de forme courante. npm run essai:check-reel en exige au moins un
--   avant une séance réelle. Lus côté serveur seulement (lib/support-contact.ts) : pas dans platform_settings_public.
-- Objets :
--   clés support.* (vides par défaut) ;
--   recopie : fin_setting_valid (20261110000002_lot9ter_reglages.sql:49-102), changement : validation des clés support.* ;
--   recopie : finance_setting_set (20261110000002_lot9ter_reglages.sql:107-146), changement : clés support.* admises.
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

INSERT INTO public.platform_settings (key, value, description) VALUES
    ('support.whatsapp', '{"value": ""}', 'Numéro WhatsApp du support, au format international (+221…) ; vide si aucun'),
    ('support.phone', '{"value": ""}', 'Téléphone du support, au format international (+221…) ; vide si aucun'),
    ('support.email', '{"value": ""}', 'Email du support ; vide si aucun')
ON CONFLICT (key) DO NOTHING;


-- ----------------------------------------------------------------------------
-- fin_setting_valid (recopie de 20261110000002_lot9ter_reglages.sql:49-102) ; changement : clés support.*
-- ----------------------------------------------------------------------------
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
                 'features.halls_enabled', 'features.tables_enabled', 'features.orders_enabled') THEN
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
        ELSE FALSE END;
END;
$$;


-- ----------------------------------------------------------------------------
-- finance_setting_set (recopie de 20261110000002_lot9ter_reglages.sql:107-146) ; changement : clés support.* admises
-- ----------------------------------------------------------------------------
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
        'support.whatsapp', 'support.phone', 'support.email') THEN
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
