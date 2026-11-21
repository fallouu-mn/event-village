-- ============================================================================
-- EVENT VILLAGE — LOT 12a, migration 01 : réglages des commandes (clés orders.*)
-- ============================================================================
-- Décisions du client (18/11) : frais de service payés par le client 5 %, commission de la partenaire 0 % au lancement,
-- acompte de 30 % par défaut (réglable par la partenaire, établissement par établissement), commande non payée tenue
-- 15 minutes, réponse de la partenaire sous 15 minutes (sinon annulée, tout rendu), au plus 3 commandes non payées par
-- client, commande prête non retirée close sans remboursement 24 h après l'heure prévue (client prévenu 2 h avant),
-- adresse et téléphone du client masqués 7 jours après la remise, code de remise à 4 chiffres (5 essais, 3 nouveaux
-- codes au plus), préparation de 30 minutes par défaut.
--  1. valeurs par défaut (platform_settings, ON CONFLICT DO NOTHING : une valeur déjà réglée est gardée) ;
--  2. finance_setting_set : recopie de 20261126000002_l10b_salles.sql:27-81, clés orders.* ajoutées à la liste ;
--  3. fin_setting_valid : recopie de 20261126000002_l10b_salles.sql:84-178, bornes des clés orders.* (identiques à lib/settings/catalog.ts) ;
--  4. platform_settings_defaults : recopie de 20261123000101_l11a_reglages.sql:180-196, préfixe orders ajouté.
-- Rejouable : ON CONFLICT DO NOTHING, CREATE OR REPLACE (droits d'exécution conservés).
-- ============================================================================

INSERT INTO public.platform_settings (key, value, description) VALUES
    ('orders.service_fee_rate', '{"value": 5}', 'Commandes : frais de service payés par le client, en % du montant payé en ligne'),
    ('orders.commission_rate', '{"value": 0}', 'Commandes : commission d''Event Village sur la part de la partenaire, en %'),
    ('orders.deposit_default_percent', '{"value": 30}', 'Commandes : acompte par défaut, en % de la commande (réglable par établissement)'),
    ('orders.hold_minutes', '{"value": 15}', 'Commandes : durée pendant laquelle une commande non payée garde ses produits, en minutes'),
    ('orders.response_minutes', '{"value": 15}', 'Commandes : délai de réponse de la partenaire, en minutes ; sans réponse, la commande est annulée et remboursée'),
    ('orders.max_unpaid_per_client', '{"value": 3}', 'Commandes : nombre de commandes non payées au plus par client'),
    ('orders.invites_per_day', '{"value": 10}', 'Commandes : invitations de livreurs au plus par partenaire et par jour'),
    ('orders.max_unpaid_portions', '{"value": 10}', 'Commandes : portions d''un plat du jour tenues sans paiement au plus, par client et par plat'),
    ('orders.pickup_grace_hours', '{"value": 24}', 'Commandes : une commande prête non retirée est close sans remboursement ce nombre d''heures après l''heure prévue'),
    ('orders.pickup_warning_hours', '{"value": 2}', 'Commandes : le client est prévenu ce nombre d''heures avant la clôture d''une commande non retirée'),
    ('orders.contact_retention_days', '{"value": 7}', 'Commandes : adresse et téléphone du client masqués ce nombre de jours après la remise'),
    ('orders.code_max_attempts', '{"value": 5}', 'Commandes : essais au plus du code de remise'),
    ('orders.code_resend_max', '{"value": 3}', 'Commandes : nouveaux codes de remise au plus par commande'),
    ('orders.prep_minutes_default', '{"value": 30}', 'Commandes : durée de préparation par défaut, en minutes (réglable par établissement)')
ON CONFLICT (key) DO NOTHING;

-- Recopie de 20261126000002_l10b_salles.sql:27-81 ; changement : clés orders.* admises.
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
        'halls.cancel_moderee_full_days', 'halls.cancel_moderee_partial_days', 'halls.cancel_stricte_partial_days',
        -- Correctifs de la contre-vérification du lot 10a (T4)
        'halls.full_payment_margin_hours',
        -- Lot 11a : réservation de tables
        'tables.service_fee_rate', 'tables.commission_rate', 'tables.validation_required', 'tables.slot_minutes',
        'tables.hold_minutes', 'tables.response_minutes', 'tables.no_show_minutes', 'tables.cancel_free_hours',
        'tables.max_pending_per_client', 'tables.reminder_hours',
        -- Lot 10b : réservations de salle en attente de paiement au plus par client
        'halls.max_pending_per_client',
        -- Lot 12a : commandes
        'orders.service_fee_rate', 'orders.commission_rate', 'orders.deposit_default_percent', 'orders.hold_minutes',
        'orders.response_minutes', 'orders.max_unpaid_per_client', 'orders.max_unpaid_portions', 'orders.pickup_grace_hours',
        'orders.pickup_warning_hours', 'orders.invites_per_day',
        'orders.contact_retention_days', 'orders.code_max_attempts', 'orders.code_resend_max', 'orders.prep_minutes_default') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_KEY', 'message', 'Réglage inconnu.');
    END IF;
    IF p_actor IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_roles r JOIN public.users u ON u.id = r.user_id
         WHERE r.user_id = p_actor AND r.role = 'SUPERADMIN' AND u.status = 'ACTIF'
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Seul un super-administrateur actif peut modifier les réglages.');
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


-- Recopie de 20261126000002_l10b_salles.sql:84-178 ; changement : bornes des clés orders.*.
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
                 'halls.validation_required', 'tables.validation_required') THEN
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
        -- Correctifs de la contre-vérification du lot 10a (T4)
        WHEN 'halls.full_payment_margin_hours' THEN n = trunc(n) AND n >= 1 AND n <= 168
        -- Lot 11a : réservation de tables
        WHEN 'tables.service_fee_rate' THEN n >= 0 AND n <= 50
        WHEN 'tables.commission_rate' THEN n >= 0 AND n <= 50
        WHEN 'tables.slot_minutes' THEN n = trunc(n) AND n >= 30 AND n <= 360 AND mod(n, 15) = 0
        WHEN 'tables.hold_minutes' THEN n = trunc(n) AND n >= 5 AND n <= 60
        WHEN 'tables.response_minutes' THEN n = trunc(n) AND n >= 15 AND n <= 1440
        WHEN 'tables.no_show_minutes' THEN n = trunc(n) AND n >= 5 AND n <= 180
        WHEN 'tables.cancel_free_hours' THEN n = trunc(n) AND n >= 0 AND n <= 72
        WHEN 'tables.max_pending_per_client' THEN n = trunc(n) AND n >= 1 AND n <= 10
        WHEN 'tables.reminder_hours' THEN n = trunc(n) AND n >= 1 AND n <= 24
        -- Lot 10b : réservations de salle en attente de paiement au plus par client
        WHEN 'halls.max_pending_per_client' THEN n = trunc(n) AND n >= 1 AND n <= 10
        -- Lot 12a : commandes
        WHEN 'orders.service_fee_rate' THEN n >= 0 AND n <= 50
        WHEN 'orders.commission_rate' THEN n >= 0 AND n <= 50
        WHEN 'orders.deposit_default_percent' THEN n = trunc(n) AND n >= 10 AND n <= 90
        WHEN 'orders.hold_minutes' THEN n = trunc(n) AND n >= 5 AND n <= 60
        WHEN 'orders.response_minutes' THEN n = trunc(n) AND n >= 5 AND n <= 120
        WHEN 'orders.max_unpaid_per_client' THEN n = trunc(n) AND n >= 1 AND n <= 10
        WHEN 'orders.max_unpaid_portions' THEN n = trunc(n) AND n >= 1 AND n <= 99
        WHEN 'orders.invites_per_day' THEN n = trunc(n) AND n >= 1 AND n <= 50
        WHEN 'orders.pickup_grace_hours' THEN n = trunc(n) AND n >= 2 AND n <= 168
        WHEN 'orders.pickup_warning_hours' THEN n = trunc(n) AND n >= 1 AND n <= 24
        WHEN 'orders.contact_retention_days' THEN n = trunc(n) AND n >= 1 AND n <= 90
        WHEN 'orders.code_max_attempts' THEN n = trunc(n) AND n >= 3 AND n <= 10
        WHEN 'orders.code_resend_max' THEN n = trunc(n) AND n >= 1 AND n <= 10
        WHEN 'orders.prep_minutes_default' THEN n = trunc(n) AND n >= 10 AND n <= 240
        ELSE FALSE END;
END;
$$;


-- Recopie de 20261123000101_l11a_reglages.sql:180-196 ; changement : préfixe orders ajouté.
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
     WHERE s.key ~ '^(finance|access|notif|features|support|halls|tables|orders)\.'
$$;

