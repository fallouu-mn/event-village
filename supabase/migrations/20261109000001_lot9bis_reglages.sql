-- ============================================================================
-- EVENT VILLAGE — LOT 9 BIS : réglages SUPERADMIN du lot (tâches H2, H8, 38/R31 ; contrat M01, sections 3.1, 3.2, 12.1)
-- ============================================================================
-- Rejouable : aucun BEGIN ni COMMIT ; INSERT … ON CONFLICT (key) DO NOTHING, CREATE OR REPLACE, privilèges
-- réappliqués. Seule migration du lot qui recopie fin_setting_valid et finance_setting_set (contrat 3.2, A2) :
-- elle porte les trois clés nouvelles du lot 9 bis.
--  1. Clés et valeurs par défaut, même mécanisme historisé que finance.* (lot 3), access.* (lot 4), notif.* (lot 6)
--     et features.* (lot 7) : valeur {"value": …}, validation fin_setting_valid, écriture finance_setting_set
--     (SUPERADMIN actif seulement), historique par trigger (trg_platform_settings_audit) :
--       - finance.payment_hold_minutes (10, entier de 5 à 60) : durée de garde des places pendant un paiement,
--         remplace la variable PAYMENT_HOLD_MINUTES (H2, B103) ; lue par lib/payments/checkout.service.ts (S-H) ;
--       - finance.min_paid_price (100, entier de 1 à 100 000) : prix minimum d'un billet payant, appliqué par le
--         trigger trg_ticket_categories_min_price (M05, S-H) (H8, B107) ;
--       - notif.sms_essential_daily_alert (2 000, entier de 1 à 1 000 000) : seuil d'alerte des SMS indispensables
--         du jour, lu par notification_daily_checks (M09, S-D) ; clé distincte de notif.sms_daily_alert, retirée
--         au lot 7 et qui le reste (38/R31, B81).
--  2. fin_setting_valid : base 20261105000001_lot7_reglages.sql:50-98, recopie intégrale à signature et retour
--     identiques (text, jsonb → boolean), IMMUTABLE conservé ; seul changement : trois branches WHEN de plus
--     (entiers bornés, contrat 12.1) avant le ELSE FALSE.
--  3. finance_setting_set : base 20261105000001_lot7_reglages.sql:103-140, recopie intégrale à signature et retour
--     identiques (text, jsonb, uuid, text → jsonb), VOLATILE conservé ; seul changement : liste blanche = celle du
--     lot 7 + les trois clés du lot 9 bis. Refus inchangés (UNKNOWN_KEY, FORBIDDEN hors SUPERADMIN actif,
--     INVALID_VALUE).
--  4. Privilèges des deux fonctions réappliqués (service_role seul).
-- Non touchée : la politique platform_settings_admin_write ; les trois clés sont sous finance.% et notif.%, déjà
-- exclues de l'écriture REST d'un admin (20261105000001_lot7_reglages.sql:145-151).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Clés et valeurs par défaut
-- ----------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, description) VALUES
    ('finance.payment_hold_minutes', '{"value": 10}',
        'Durée de garde des places pendant un paiement, en minutes : au-delà, les places ne sont plus garanties (le paiement reste valable une heure) (entier de 5 à 60)'),
    ('finance.min_paid_price', '{"value": 100}',
        'Prix minimum d''un billet payant, en F CFA ; un billet gratuit reste à 0 (entier de 1 à 100 000)'),
    ('notif.sms_essential_daily_alert', '{"value": 2000}',
        'Seuil d''alerte des SMS indispensables du jour : au-delà, les administrateurs sont prévenus une fois par jour ; ces SMS ne sont jamais plafonnés (entier de 1 à 1 000 000)')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Validation (reprise de 20261105000001_lot7_reglages.sql:50-98, plus les clés du lot 9 bis)
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
        ELSE FALSE END;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Écriture (reprise de 20261105000001_lot7_reglages.sql:103-140 ; liste blanche du lot 9 bis)
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
        'finance.payment_hold_minutes', 'finance.min_paid_price', 'notif.sms_essential_daily_alert') THEN
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

-- ----------------------------------------------------------------------------
-- 4. Privilèges : service_role uniquement
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.fin_setting_valid(text, jsonb)',
        'public.finance_setting_set(text, jsonb, uuid, text)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
