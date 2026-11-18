-- ============================================================================
-- EVENT VILLAGE — LOT 10a, correctifs de la contre-vérification (docs/audit-lot10a.md), migration 10 : T4
-- ============================================================================
-- T4 (moyenne) : hall_quote n'exigeait le paiement en une fois qu'à moins de halls.balance_due_days (7 jours) de la
-- date : une réservation faite à J-7 + quelques minutes proposait un acompte avec un solde dû 10 à 29 minutes plus
-- tard ; non payé à temps, la règle d'annulation s'appliquait (modérée 50 %, stricte 0 %). hall_payment_create
-- acceptait de même un acompte jusqu'à l'échéance (réservation relancée tard).
--  1. réglage halls.full_payment_margin_hours (24 h) : paiement en une fois exigé tant que l'échéance du solde tombe
--     dans moins de ce nombre d'heures ; entier de 1 à 168 ;
--  2. finance_setting_set : recopie de 20261122000001_l10a_reglages.sql:29-76 ; changement : clé ajoutée à la liste ;
--  3. fin_setting_valid : recopie de 20261122000001_l10a_reglages.sql:78-159 ; changement : bornes de la clé (identiques
--     à lib/settings/catalog.ts) ;
--  4. hall_quote : recopie de 20261122000003_l10a_reserver.sql:74-201 ; changement : paiement en une fois quand
--     l'échéance du solde (date − halls.balance_due_days) tombe dans moins de halls.full_payment_margin_hours ;
--  5. hall_payment_create : recopie de 20261122000009_l10a_cv_relance.sql:66-256 ; changement : acompte refusé
--     (FULL_PAYMENT_REQUIRED) dès que l'échéance du solde tombe dans moins de halls.full_payment_margin_hours (au lieu de
--     « échéance passée »), pour une attente comme pour une réservation relancée.
-- Rejouable : ON CONFLICT DO NOTHING, CREATE OR REPLACE (droits d'exécution conservés), REVOKE et GRANT idempotents.
-- ============================================================================

INSERT INTO public.platform_settings (key, value, description) VALUES
    ('halls.full_payment_margin_hours', '{"value": 24}', 'Salles : paiement en une fois exigé quand le solde serait dû dans moins de ce nombre d''heures')
ON CONFLICT (key) DO NOTHING;

-- Recopie de 20261122000001_l10a_reglages.sql:29-76 (elle-même recopie de 20261117000002_f3a_reserve.sql:101-143) ;
-- changement : clé halls.full_payment_margin_hours admise.
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
        'halls.full_payment_margin_hours') THEN
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

-- Recopie de 20261122000001_l10a_reglages.sql:78-159 (elle-même recopie de 20261117000002_f3a_reserve.sql:27-95) ;
-- changement : bornes de halls.full_payment_margin_hours.
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
        -- Correctifs de la contre-vérification du lot 10a (T4)
        WHEN 'halls.full_payment_margin_hours' THEN n = trunc(n) AND n >= 1 AND n <= 168
        ELSE FALSE END;
END;
$$;

-- Recopie de 20261122000003_l10a_reserver.sql:74-201 ; changement : marge de halls.full_payment_margin_hours avant l'échéance du solde.
CREATE OR REPLACE FUNCTION public.hall_quote(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hall_id    uuid := public.try_uuid(p->>'hall_id');
    v_mode       text := upper(COALESCE(p->>'mode', 'JOUR'));
    v_units      integer;
    v_start_date date;
    v_start_time time;
    v_end_date   date;
    v_end_time   time;
    h            record;
    v_unit_price numeric;
    v_price      numeric;
    v_rate       numeric;
    v_fee        numeric;
    v_total      numeric;
    v_start      timestamp;
    v_now        timestamp := public.hall_dakar_now();
    v_due_days   integer := public.fin_setting_num('halls.balance_due_days')::int;
    v_margin     integer := public.fin_setting_num('halls.full_payment_margin_hours')::int;
    v_full       boolean;
    v_dep_price  numeric;
    v_dep_fee    numeric;
    v_pct        numeric;
BEGIN
    BEGIN
        v_units := (p->>'units')::int;
        v_start_date := (p->>'start_date')::date;
        v_start_time := NULLIF(p->>'start_time', '')::time;
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATES', 'message', 'La date ou l’heure choisie n’est pas valable.');
    END;
    IF v_hall_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_FOUND', 'message', 'Cette salle n’existe pas ou n’est plus proposée.');
    END IF;
    SELECT hl.*, pa.status::text AS partner_status INTO h
      FROM public.halls hl JOIN public.partners pa ON pa.id = hl.partner_id
     WHERE hl.id = v_hall_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_FOUND', 'message', 'Cette salle n’existe pas ou n’est plus proposée.');
    END IF;
    IF NOT h.is_active OR h.partner_status <> 'VALIDE'
       OR (h.validation_status <> 'VALIDEE'
           AND (public.fin_setting_bool('halls.validation_required') OR h.validation_status IN ('REFUSEE', 'SUSPENDUE'))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_AVAILABLE', 'message', 'Cette salle n’est pas ouverte à la réservation pour le moment.');
    END IF;
    IF h.price_per_day IS NULL OR h.price_per_day < 1 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PRICE_MISSING', 'message', 'Cette salle n’a pas encore de prix : elle ne peut pas être réservée pour le moment.');
    END IF;
    IF v_start_date IS NULL OR v_units IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATES', 'message', 'Choisissez la date et la durée de la réservation.');
    END IF;
    IF v_mode = 'JOUR' THEN
        IF v_units < 1 OR v_units > 30 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DURATION', 'message', 'Une réservation à la journée dure de 1 à 30 jours.');
        END IF;
        v_unit_price := h.price_per_day;
        v_start_time := NULL;
        v_end_date := v_start_date + (v_units - 1);
        v_end_time := NULL;
        v_start := v_start_date + time '00:00';
    ELSIF v_mode = 'HEURE' THEN
        IF h.price_per_hour IS NULL OR h.price_per_hour < 1 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'HOURLY_NOT_OFFERED', 'message', 'Cette salle ne se loue pas à l’heure : choisissez une ou plusieurs journées.');
        END IF;
        IF v_start_time IS NULL OR EXTRACT(SECOND FROM v_start_time) <> 0
           OR EXTRACT(MINUTE FROM v_start_time) NOT IN (0, 30) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATES', 'message', 'Choisissez une heure de début à l’heure pile ou à la demie.');
        END IF;
        v_start := v_start_date + v_start_time;
        IF v_units < 1 OR v_units > 24 OR v_start + make_interval(hours => v_units) > (v_start_date + 1) + time '00:00' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DURATION', 'message', 'Une réservation à l’heure dure de 1 à 24 heures et se termine le même jour.');
        END IF;
        v_unit_price := h.price_per_hour;
        v_end_date := v_start_date;
        v_end_time := CASE WHEN v_start + make_interval(hours => v_units) = (v_start_date + 1) + time '00:00'
                           THEN time '24:00' ELSE (v_start + make_interval(hours => v_units))::time END;
    ELSE
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MODE', 'message', 'Choisissez une réservation à la journée ou à l’heure.');
    END IF;
    IF v_start <= v_now THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DATE_PASSED', 'message', 'Choisissez une date à venir.');
    END IF;
    IF v_start > v_now + interval '548 days' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DATE_TOO_FAR', 'message', 'La date doit être dans les 18 mois à venir.');
    END IF;

    v_price := v_unit_price * v_units;
    v_rate := public.fin_setting_num('halls.service_fee_rate');
    v_fee := public.fin_round_up(v_price * v_rate / 100);
    v_total := v_price + v_fee;
    -- Correctifs de la contre-vérification du lot 10a (T4) : paiement en une fois tant que l'échéance du solde
    -- (date − halls.balance_due_days) tombe dans moins de halls.full_payment_margin_hours
    v_full := v_start - v_now < make_interval(days => v_due_days) + make_interval(hours => v_margin);
    IF v_full THEN
        v_dep_price := v_price;
    ELSIF h.deposit_mode = 'MONTANT_FIXE' THEN
        v_dep_price := LEAST(h.deposit_value, v_price);
    ELSE
        v_pct := COALESCE(h.deposit_value, public.fin_setting_num('halls.deposit_default_percent'));
        v_dep_price := LEAST(GREATEST(public.fin_round_up(v_price * v_pct / 100), 1), v_price);
    END IF;
    v_dep_fee := LEAST(public.fin_round_up(v_dep_price * v_rate / 100), v_fee);
    -- Acompte égal au prix : la réservation se paie en une fois
    IF v_dep_price >= v_price THEN
        v_dep_price := v_price;
        v_dep_fee := v_fee;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'hall_id', h.id, 'partner_id', h.partner_id, 'hall_name', h.name,
        'mode', v_mode, 'units', v_units, 'unit_price', v_unit_price,
        'start_date', v_start_date, 'end_date', v_end_date, 'start_time', v_start_time, 'end_time', v_end_time,
        'start_at', v_start,
        'price_amount', v_price, 'service_fee_rate', v_rate, 'service_fee_amount', v_fee, 'total_amount', v_total,
        'commission_rate', public.fin_setting_num('halls.commission_rate'),
        'full_payment_required', v_full OR v_dep_price >= v_price,
        'deposit_price', v_dep_price, 'deposit_service_fee', v_dep_fee, 'deposit_amount', v_dep_price + v_dep_fee,
        'balance_amount', v_total - (v_dep_price + v_dep_fee),
        'balance_due_at', CASE WHEN v_full OR v_dep_price >= v_price THEN NULL
                               ELSE ((v_start - make_interval(days => v_due_days)) AT TIME ZONE 'Africa/Dakar') END,
        'cancellation_policy', h.cancellation_policy,
        'cancellation_terms', public.hall_cancel_terms(h.cancellation_policy));
END;
$$;

-- Recopie de 20261122000009_l10a_cv_relance.sql:66-256 ; changement : marge de halls.full_payment_margin_hours avant l'échéance du solde.
CREATE OR REPLACE FUNCTION public.hall_payment_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client   uuid := public.try_uuid(p->>'client_id');
    v_res_id   uuid := public.try_uuid(p->>'reservation_id');
    v_part     text := upper(COALESCE(p->>'part', ''));
    v_operator text := NULLIF(p->>'operator', '');
    r          record;
    v_hold     integer := public.fin_setting_num('halls.hold_minutes')::int;
    v_pending  uuid;
    v_payer_pending integer;
    v_facial   numeric;
    v_service  numeric;
    v_amount   numeric;
    v_agg_rate numeric;
    v_agg      numeric;
    v_comm     numeric;
    v_payment  uuid;
    v_expires  timestamptz;
    v_refusal  jsonb;
    v_margin   integer := public.fin_setting_num('halls.full_payment_margin_hours')::int;
BEGIN
    IF NOT public.fin_setting_bool('features.halls_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SERVICE_CLOSED', 'message', 'La réservation de salles n’est pas encore ouverte.');
    END IF;
    IF v_part NOT IN ('ACOMPTE', 'SOLDE', 'INTEGRAL') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PART', 'message', 'Choisissez de payer l’acompte, le solde ou la totalité.');
    END IF;
    IF v_operator IS NULL OR v_operator NOT IN ('WAVE', 'ORANGE_MONEY') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'OPERATOR_REQUIRED', 'message', 'Choisissez Wave ou Orange Money.');
    END IF;
    IF v_client IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_client AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte ne permet pas de payer pour le moment.');
    END IF;
    SELECT hall_id INTO r FROM public.hall_reservations WHERE id = v_res_id AND client_id = v_client;
    IF v_res_id IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    -- Même verrou que la réservation de la salle, puis la réservation elle-même
    PERFORM pg_advisory_xact_lock(hashtextextended('hall_reservations:' || r.hall_id::text, 0));
    SELECT * INTO r FROM public.hall_reservations WHERE id = v_res_id FOR UPDATE;
    IF r.price_amount IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_ACTIVE', 'message', 'Cette réservation ne peut plus être payée.');
    END IF;

    SELECT id INTO v_pending FROM public.payments
     WHERE hall_reservation_id = v_res_id AND status::text = 'PENDING' AND created_at > now() - interval '60 minutes'
     ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PAYMENT_PENDING', 'payment_id', v_pending,
            'message', 'Un paiement est déjà en cours pour cette réservation. Terminez-le ou attendez quelques minutes.');
    END IF;

    IF r.booking_state = 'PAYEE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_PAID', 'message', 'Cette réservation est déjà payée.');
    ELSIF r.booking_state = 'EN_ATTENTE_PAIEMENT' THEN
        IF v_part = 'SOLDE' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'DEPOSIT_FIRST', 'message', 'Payez d’abord l’acompte, ou la totalité.');
        END IF;
        IF v_part = 'ACOMPTE' AND (r.full_payment_required OR r.deposit_price >= r.price_amount
                                    -- Correctifs de la contre-vérification du lot 10a (T4) : solde dû dans moins de la marge
                                    OR (r.balance_due_at IS NOT NULL AND now() + make_interval(hours => v_margin) > r.balance_due_at)) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'FULL_PAYMENT_REQUIRED',
                'message', 'La date est proche : cette réservation se paie en une fois.');
        END IF;
        -- Correctifs de la contre-vérification du lot 10a (T2) : salle et partenaire toujours ouvertes à la réservation
        v_refusal := public.hall_booking_refusal(r.hall_id);
        IF v_refusal IS NOT NULL THEN
            RETURN v_refusal;
        END IF;
        IF r.hold_expires_at IS NULL OR r.hold_expires_at <= now() THEN
            -- Attente échue : la date est reprise seulement si personne d'autre ne la tient
            IF EXISTS (SELECT 1 FROM public.hall_reservations o
                        WHERE o.hall_id = r.hall_id AND o.id <> r.id AND o.status::text IN ('EN_ATTENTE', 'CONFIRMEE') AND o.slot && r.slot) THEN
                UPDATE public.hall_reservations SET booking_state = 'EXPIREE', payment_status = 'CANCELLED', hold_expires_at = NULL, updated_at = now()
                 WHERE id = r.id;
                RETURN jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN', 'message', 'Le délai pour payer est passé et la date a été réservée par quelqu’un d’autre.');
            END IF;
            -- Correctifs de la contre-vérification du lot 10a (T2) : reprendre la date compte dans la limite des attentes
            v_refusal := public.hall_client_pending_refusal(v_client, r.id);
            IF v_refusal IS NOT NULL THEN
                RETURN v_refusal;
            END IF;
        END IF;
        v_expires := now() + make_interval(mins => v_hold);
        UPDATE public.hall_reservations SET hold_expires_at = v_expires, updated_at = now() WHERE id = r.id;
    ELSIF r.booking_state = 'EXPIREE' THEN
        IF v_part = 'SOLDE' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'DEPOSIT_FIRST', 'message', 'Payez d’abord l’acompte, ou la totalité.');
        END IF;
        IF r.slot IS NULL OR lower(r.slot) <= public.hall_dakar_now() THEN
            RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_ACTIVE', 'message', 'Cette réservation ne peut plus être payée.');
        END IF;
        IF v_part = 'ACOMPTE' AND (r.full_payment_required OR r.deposit_price >= r.price_amount
                                    -- Correctifs de la contre-vérification du lot 10a (T4) : solde dû dans moins de la marge
                                    OR (r.balance_due_at IS NOT NULL AND now() + make_interval(hours => v_margin) > r.balance_due_at)) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'FULL_PAYMENT_REQUIRED',
                'message', 'La date est proche : cette réservation se paie en une fois.');
        END IF;
        -- Correctifs de la contre-vérification du lot 10a (T2) : avant de reprendre la date, mêmes contrôles qu'une
        -- nouvelle réservation : salle et partenaire ouvertes, limite des attentes du client
        v_refusal := public.hall_booking_refusal(r.hall_id);
        IF v_refusal IS NOT NULL THEN
            RETURN v_refusal;
        END IF;
        v_refusal := public.hall_client_pending_refusal(v_client, r.id);
        IF v_refusal IS NOT NULL THEN
            RETURN v_refusal;
        END IF;
        IF EXISTS (SELECT 1 FROM public.hall_reservations o
                    WHERE o.hall_id = r.hall_id AND o.id <> r.id AND o.status::text IN ('EN_ATTENTE', 'CONFIRMEE') AND o.slot && r.slot) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN', 'message', 'Le délai pour payer est passé et la date a été réservée par quelqu’un d’autre.');
        END IF;
        v_expires := now() + make_interval(mins => v_hold);
        BEGIN
            UPDATE public.hall_reservations
               SET booking_state = 'EN_ATTENTE_PAIEMENT', payment_status = 'PENDING', hold_expires_at = v_expires, updated_at = now()
             WHERE id = r.id;
        EXCEPTION WHEN exclusion_violation OR raise_exception THEN
            RETURN jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN', 'message', 'Le délai pour payer est passé et la date a été réservée par quelqu’un d’autre.');
        END;
    ELSIF r.booking_state = 'ACOMPTE_PAYE' THEN
        IF v_part <> 'SOLDE' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'BALANCE_ONLY', 'message', 'L’acompte est déjà payé : il reste le solde à régler.');
        END IF;
        IF r.balance_due_at IS NOT NULL AND now() > r.balance_due_at THEN
            RETURN jsonb_build_object('ok', false, 'code', 'BALANCE_DEADLINE_PASSED', 'message', 'Le délai pour payer le solde est dépassé.');
        END IF;
    ELSE
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_ACTIVE', 'message', 'Cette réservation ne peut plus être payée.');
    END IF;

    -- Montant relu sur la réservation (figé à sa création)
    IF v_part = 'ACOMPTE' THEN
        v_facial := r.deposit_price;
        v_service := r.deposit_service_fee;
    ELSIF v_part = 'INTEGRAL' THEN
        v_facial := r.price_amount;
        v_service := r.service_fee_amount;
    ELSE
        v_facial := r.price_amount - r.deposit_price;
        v_service := r.service_fee_amount - r.deposit_service_fee;
    END IF;
    v_amount := v_facial + v_service;
    IF v_amount <= 0 OR r.paid_amount + v_amount > r.total_amount THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOTHING_TO_PAY', 'message', 'Il n’y a rien à payer pour cette réservation.');
    END IF;

    -- Règle des billets : 3 paiements en attente au plus par numéro payeur et par heure
    IF NULLIF(p->>'payer_phone', '') IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('checkout-payer:' || (p->>'payer_phone')));
        SELECT count(*) INTO v_payer_pending FROM public.payments
         WHERE payer_phone = p->>'payer_phone' AND status::text = 'PENDING' AND created_at > now() - interval '1 hour';
        IF v_payer_pending >= 3 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PAYER_PENDING_LIMIT',
                'message', 'Un paiement est déjà en attente pour ce numéro. Terminez-le ou attendez quelques minutes.');
        END IF;
    END IF;

    v_agg_rate := public.fin_setting_num('finance.aggregator_fee_rate.' || v_operator);
    v_agg := public.fin_round_2(v_amount * v_agg_rate / 100);
    v_comm := public.fin_round_2(v_facial * COALESCE(r.commission_rate, 0) / 100);

    INSERT INTO public.payments (
        transaction_id, external_order_id, client_id, partner_id, hall_reservation_id, payment_target, amount, currency,
        is_platform_payment, aggregator, facial_amount, aggregator_fee, service_fee, gross_event_village_revenue,
        net_event_village_revenue, partner_payout_amount, service_fee_rate, aggregator_fee_rate,
        payout_delay_hours, payout_hold_enabled, status, idempotency_key, held_expires_at,
        operator, payer_phone, callback_token_hash, metadata
    ) VALUES (
        p->>'transaction_id', p->>'external_order_id', v_client, r.partner_id, r.id, 'HALL_RESERVATION', v_amount, 'XOF',
        TRUE, 'SAMIRPAY', v_facial, v_agg, v_service, v_service + v_comm,
        public.fin_round_2(v_service + v_comm - v_agg), v_facial - v_comm, r.service_fee_rate, v_agg_rate,
        public.fin_setting_num('finance.payout_delay_hours')::int, public.fin_setting_bool('finance.payout_hold_enabled'),
        'PENDING', 'IDEMP-' || (p->>'external_order_id'), COALESCE(v_expires, now() + make_interval(mins => v_hold)),
        v_operator, NULLIF(p->>'payer_phone', ''), p->>'callback_token_hash',
        jsonb_build_object('target_type', 'HALL_RESERVATION', 'target_id', r.id, 'reservation_id', r.id, 'part', v_part,
                           'commission_rate', COALESCE(r.commission_rate, 0), 'commission_amount', v_comm)
    )
    RETURNING id INTO v_payment;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_client, 'CLIENT', 'HALL_PAYMENT_STARTED', 'hall_reservations', r.id,
            jsonb_build_object('payment_id', v_payment, 'part', v_part, 'amount', v_amount));

    RETURN jsonb_build_object('ok', true, 'payment_id', v_payment, 'amount', v_amount, 'part', v_part,
                              'facial_amount', v_facial, 'service_fee', v_service, 'hall_id', r.hall_id);
END;
$$;

REVOKE ALL ON FUNCTION public.hall_quote(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hall_payment_create(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hall_quote(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.hall_payment_create(jsonb) TO service_role;
