-- ============================================================================
-- EVENT VILLAGE — LOT 9 TER : réglages de l'alerte de refus (9t.18) et aides pures du lot (ticket_origin,
-- scan_is_refusal) ; seule migration du lot qui recopie fin_setting_valid et finance_setting_set
-- (contrat 3.1 n° 02, 3.4 F3 à F6, 5.D D.0 ; arbitrage 21 ; décision K4)
-- ============================================================================
-- Rejouable : aucun BEGIN ni COMMIT ; INSERT … ON CONFLICT (key) DO NOTHING, CREATE OR REPLACE, privilèges
-- réappliqués. Aucun DDL hors fonctions.
--  1. Clés et valeurs par défaut, même mécanisme historisé que les autres access.* (lot 4) : valeur {"value": …},
--     validation fin_setting_valid, écriture finance_setting_set (SUPERADMIN actif seulement), historique par
--     trigger (trg_platform_settings_audit) :
--       - access.refusal_alert_threshold (10, entier de 3 à 500) : nombre de refus à une même porte, dans la durée
--         observée, qui déclenche l'alerte SCAN_REFUSALS_ALERT à l'organisateur (lu par la migration 10) ;
--       - access.refusal_alert_minutes (5, entier de 1 à 60) : durée observée ; au plus une alerte par porte et
--         par durée.
--  2. fin_setting_valid : base 20261109000001_lot9bis_reglages.sql:44-95, recopie intégrale à signature et retour
--     identiques (text, jsonb → boolean), IMMUTABLE conservé ; seul changement : deux branches WHEN de plus
--     (entiers bornés) avant le ELSE FALSE.
--  3. finance_setting_set : base 20261109000001_lot9bis_reglages.sql:100-138, recopie intégrale à signature et
--     retour identiques (text, jsonb, uuid, text → jsonb), VOLATILE conservé ; seul changement : liste blanche =
--     celle du lot 9 bis + les deux clés du lot 9 ter. Refus inchangés (UNKNOWN_KEY, FORBIDDEN hors SUPERADMIN
--     actif, INVALID_VALUE). Aucun trigger nouveau sur platform_settings.
--  4. ticket_origin (nouvelle) : règle R50 de pilotage_sales (20261109000008_lot9bis_cycle.sql:2423-2426), à
--     l'identique ; origine ONLINE, COUNTER, FREE ou INVITATION d'un billet, pour le badge du scan, le tableau des
--     entrées, la clôture et l'export (une seule règle). Appel du lot :
--     ticket_origin(tk.sale_channel, tk.price, pay.id IS NOT NULL AND NOT pay.is_platform_payment).
--  5. scan_is_refusal (nouvelle) : une ligne de ticket_scans est-elle un refus ; pour result non NULL et
--     zone_result NULL, égale à l'expression du lot 5 NOT accepted AND NOT (result = 'cash_required' AND
--     consumed_at IS NOT NULL) (20261102000005_lot5_pilotage.sql:252) ; wrong_zone et not_entered sont des refus,
--     zone_ok n'est ni une entrée ni un refus.
--  6. Privilèges des quatre fonctions : service_role seul.
-- Les deux clés sont sous access.% : aucune écriture REST possible (politique platform_settings_admin_write
-- retirée par 20261110000001_lot9ter_rls.sql) ; la route /api/admin/finance-settings les sert déjà (filtre
-- access.%).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Clés et valeurs par défaut
-- ----------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, description) VALUES
    ('access.refusal_alert_threshold', '{"value": 10}',
        'Nombre de refus à une même porte, dans la durée observée, qui déclenche une alerte à l''organisateur (entier de 3 à 500)'),
    ('access.refusal_alert_minutes', '{"value": 5}',
        'Durée observée pour l''alerte de refus à une porte, en minutes ; au plus une alerte par porte et par durée (entier de 1 à 60)')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Validation (reprise de 20261109000001_lot9bis_reglages.sql:44-95, plus les clés du lot 9 ter)
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
        WHEN 'access.refusal_alert_threshold' THEN n = trunc(n) AND n >= 3 AND n <= 500
        WHEN 'access.refusal_alert_minutes' THEN n = trunc(n) AND n >= 1 AND n <= 60
        ELSE FALSE END;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Écriture (reprise de 20261109000001_lot9bis_reglages.sql:100-138 ; liste blanche du lot 9 ter)
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
        'access.refusal_alert_threshold', 'access.refusal_alert_minutes') THEN
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
-- 4. Origine d'un billet (règle R50 de pilotage_sales, 20261109000008_lot9bis_cycle.sql:2423-2426)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_origin(p_channel text, p_price numeric, p_offline_paid boolean)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE WHEN p_channel = 'INVITATION' THEN 'INVITATION'
                WHEN COALESCE(p_offline_paid, FALSE) OR p_channel = 'COUNTER' THEN 'COUNTER'
                WHEN p_price = 0 THEN 'FREE'
                ELSE 'ONLINE' END
$$;

-- ----------------------------------------------------------------------------
-- 5. Refus d'une ligne de ticket_scans (règle unique des compteurs du lot)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scan_is_refusal(p_accepted boolean, p_result text, p_zone_result text, p_consumed_at timestamptz)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NOT p_accepted
       AND p_zone_result IS DISTINCT FROM 'zone_ok'
       AND NOT (p_result IS NOT DISTINCT FROM 'cash_required' AND p_consumed_at IS NOT NULL)
$$;

-- ----------------------------------------------------------------------------
-- 6. Privilèges : service_role uniquement
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.fin_setting_valid(text, jsonb)',
        'public.finance_setting_set(text, jsonb, uuid, text)',
        'public.ticket_origin(text, numeric, boolean)',
        'public.scan_is_refusal(boolean, text, text, timestamptz)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
