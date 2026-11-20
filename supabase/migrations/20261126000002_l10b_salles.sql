-- ============================================================================
-- EVENT VILLAGE — LOT 10b, migration 02 : salles (réglage, renvoi en validation, recherche, calendrier, annulation, recettes)
-- ============================================================================
-- Consigne du lot 10b (points 2 et 3) et décisions du client reportées du lot 10a :
--  1. réglage halls.max_pending_per_client (3) : réservations en attente de paiement au plus par client (au lieu de 3
--     écrit en dur) ; finance_setting_set : recopie de 20261124000001_d1cbis_restes.sql:91-143 ; fin_setting_valid :
--     recopie de 20261123000101_l11a_reglages.sql:85-177 ; changement : la clé et ses bornes (1 à 10, identiques à
--     lib/settings/catalog.ts) ; hall_client_pending_refusal : recopie de 20261122000011_l10a_cv_verrou_client.sql:18-40 ;
--     changement : limite lue dans le réglage ;
--  2. halls_validation_guard : recopie de 20261122000002_l10a_salles_schema.sql:70-101 ; changement : une salle refusée
--     puis modifiée reste refusée (plus de nouvel examen automatique) ; sa propriétaire la renvoie en validation ;
--  3. hall_submit(p) : renvoi en validation par la propriétaire (compte actif, partenaire VALIDE, salle refusée et
--     complète : nom, prix par jour, adresse et ville, une photo, position) ;
--  4. hall_search(p) : recherche publique (lieu, date et durée, invités, prix maximum, disponibilité) ;
--  5. hall_calendar(p) : dates et heures prises d'une salle publique, rien sur le client ;
--  6. hall_cancel_preview(p) : montant rendu au client s'il annule maintenant (même calcul que hall_refund_payment) ;
--  7. hall_partner_earnings(actor) : recettes des salles d'une partenaire, lues dans le grand livre.
-- Toutes réservées au rôle de service (routes serveur). Rejouable : ON CONFLICT DO NOTHING, CREATE OR REPLACE,
-- REVOKE et GRANT idempotents, CREATE INDEX IF NOT EXISTS.
-- ============================================================================

INSERT INTO public.platform_settings (key, value, description) VALUES
    ('halls.max_pending_per_client', '{"value": 3}', 'Salles : réservations en attente de paiement au plus par client')
ON CONFLICT (key) DO NOTHING;

-- Recopie de 20261124000001_d1cbis_restes.sql:91-143 ; changement : clé halls.max_pending_per_client admise.
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
        'halls.max_pending_per_client') THEN
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

-- Recopie de 20261123000101_l11a_reglages.sql:85-177 ; changement : bornes de halls.max_pending_per_client.
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
        ELSE FALSE END;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Limite des attentes par client, lue dans le réglage
-- ----------------------------------------------------------------------------
-- Recopie de 20261122000011_l10a_cv_verrou_client.sql:18-40 ; changement : limite halls.max_pending_per_client.
CREATE OR REPLACE FUNCTION public.hall_client_pending_refusal(p_client uuid, p_exclude uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pending integer;
    v_max     integer := public.fin_setting_num('halls.max_pending_per_client')::int;
BEGIN
    -- Correctifs de la contre-vérification du lot 10a (T5) : une réservation ou une reprise de date à la fois par client
    PERFORM pg_advisory_xact_lock(hashtextextended('hall_client_pending:' || COALESCE(p_client::text, ''), 0));
    SELECT count(*) INTO v_pending FROM public.hall_reservations
     WHERE client_id = p_client AND id IS DISTINCT FROM p_exclude
       AND booking_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at > now();
    IF v_pending >= v_max THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_PENDING',
            'message', CASE WHEN v_max = 1 THEN 'Vous avez déjà une réservation en attente de paiement. Payez-la ou attendez qu’elle se libère.'
                            ELSE format('Vous avez déjà %s réservations en attente de paiement. Payez-en une ou attendez qu’elle se libère.', v_max) END);
    END IF;
    RETURN NULL;
END;
$$;


-- ----------------------------------------------------------------------------
-- 3. Une salle refusée puis modifiée reste refusée jusqu'à son renvoi en validation
-- ----------------------------------------------------------------------------
-- Recopie de 20261122000002_l10a_salles_schema.sql:70-101 ; changement : plus de retour automatique en attente.
CREATE OR REPLACE FUNCTION public.halls_validation_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Écriture par hall_validation_decide (drapeau de la transaction) : rien à corriger
    IF current_setting('event_village.hall_validation', true) = 'on' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
        NEW.validation_status := CASE WHEN public.fin_setting_bool('halls.validation_required')
                                      THEN 'EN_ATTENTE_VALIDATION' ELSE 'VALIDEE' END;
        NEW.validation_reason := NULL;
        NEW.validated_by := NULL;
        NEW.validated_at := CASE WHEN NEW.validation_status = 'VALIDEE' THEN now() END;
        RETURN NEW;
    END IF;
    -- Mise à jour par la partenaire ou par une route : statut et décision gardés. Lot 10b : une salle refusée puis
    -- modifiée reste refusée jusqu'à ce que sa propriétaire la renvoie en validation (hall_submit)
    NEW.validation_status := OLD.validation_status;
    NEW.validation_reason := OLD.validation_reason;
    NEW.validated_by := OLD.validated_by;
    NEW.validated_at := OLD.validated_at;
    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Renvoi en validation d'une salle refusée (par sa propriétaire)
-- ----------------------------------------------------------------------------
-- Une salle est envoyée en validation à sa création (trg_halls_validation_guard). Refusée, elle garde ce statut quand
-- la partenaire la modifie, jusqu'à ce qu'elle la renvoie ici : nom, prix par jour, adresse et ville, au moins une
-- photo et la position sur la carte sont exigés.
CREATE OR REPLACE FUNCTION public.hall_submit(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_hall_id uuid := public.try_uuid(p->>'hall_id');
    h         record;
    v_missing text[] := ARRAY[]::text[];
    v_new     text;
BEGIN
    SELECT hl.*, pa.status::text AS partner_status, pa.user_id AS owner_id INTO h
      FROM public.halls hl JOIN public.partners pa ON pa.id = hl.partner_id
     WHERE hl.id = v_hall_id FOR UPDATE OF hl;
    IF v_hall_id IS NULL OR v_actor IS NULL OR NOT FOUND OR h.owner_id IS DISTINCT FROM v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_FOUND', 'message', 'Salle introuvable.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;
    IF h.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_VALIDATED', 'message', 'Votre compte partenaire doit être validé avant d’envoyer une salle.');
    END IF;
    IF h.validation_status <> 'REFUSEE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION', 'message', CASE h.validation_status
            WHEN 'EN_ATTENTE_VALIDATION' THEN 'Cette salle attend déjà la validation d’Event Village.'
            WHEN 'VALIDEE' THEN 'Cette salle est déjà validée.'
            ELSE 'Cette salle est suspendue : seule l’équipe d’Event Village peut la réactiver.' END);
    END IF;
    IF NULLIF(btrim(h.name), '') IS NULL THEN v_missing := v_missing || 'le nom'::text; END IF;
    IF h.price_per_day IS NULL OR h.price_per_day < 1 THEN v_missing := v_missing || 'le prix par jour'::text; END IF;
    IF NULLIF(btrim(COALESCE(h.address, '')), '') IS NULL OR NULLIF(btrim(COALESCE(h.city, '')), '') IS NULL THEN
        v_missing := v_missing || 'l’adresse et la ville'::text;
    END IF;
    IF COALESCE(cardinality(h.images), 0) < 1 THEN v_missing := v_missing || 'une photo au moins'::text; END IF;
    IF h.latitude IS NULL THEN v_missing := v_missing || 'la position sur la carte'::text; END IF;
    IF cardinality(v_missing) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_INCOMPLETE',
            'message', 'Avant d’envoyer la salle, ajoutez ' || array_to_string(v_missing, ', ') || '.');
    END IF;
    v_new := CASE WHEN public.fin_setting_bool('halls.validation_required') THEN 'EN_ATTENTE_VALIDATION' ELSE 'VALIDEE' END;
    PERFORM set_config('event_village.hall_validation', 'on', true);
    UPDATE public.halls
       SET validation_status = v_new, validation_reason = NULL, validated_by = NULL,
           validated_at = CASE WHEN v_new = 'VALIDEE' THEN now() END, updated_at = now()
     WHERE id = h.id;
    PERFORM set_config('event_village.hall_validation', 'off', true);
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'HALL_SUBMITTED', 'halls', h.id,
            jsonb_build_object('validation_status', h.validation_status), jsonb_build_object('validation_status', v_new));
    RETURN jsonb_build_object('ok', true, 'hall_id', h.id, 'validation_status', v_new);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Recherche publique : lieu, date (et durée), capacité, prix, disponibilité ; tri : plus récentes (défaut) ou prix
-- ----------------------------------------------------------------------------
-- Salles actives, validées, d'une partenaire VALIDE, avec un prix par jour (comme hall_quote). Avec une date : seules
-- les salles libres sur toute la période (aucune réservation qui tient la date : attente de paiement comprise).
CREATE OR REPLACE FUNCTION public.hall_search(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_q      text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'q', ''), '[[:cntrl:]]', ' ', 'g')), 80), '');
    v_city   text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'city', ''), '[[:cntrl:]]', ' ', 'g')), 80), '');
    v_date   date;
    v_days   integer;
    v_cap    integer;
    v_price  numeric;
    v_limit  integer;
    v_offset integer;
    v_slot   tsrange;
    v_like   text;
    v_total  integer;
    v_rows   jsonb;
    v_cities jsonb;
    v_sort   text := CASE WHEN p->>'sort' = 'price' THEN 'price' ELSE 'recent' END;
BEGIN
    BEGIN
        v_date := NULLIF(p->>'date', '')::date;
        v_days := COALESCE(NULLIF(p->>'days', '')::int, 1);
        v_cap := NULLIF(p->>'capacity', '')::int;
        v_price := NULLIF(p->>'price_max', '')::numeric;
        v_limit := COALESCE(NULLIF(p->>'limit', '')::int, 24);
        v_offset := COALESCE(NULLIF(p->>'offset', '')::int, 0);
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Un des filtres n’est pas valable : vérifiez la date, le nombre d’invités et le prix.');
    END;
    IF v_days < 1 OR v_days > 30 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'La durée va de 1 à 30 jours.');
    END IF;
    IF v_cap IS NOT NULL AND (v_cap < 1 OR v_cap > 100000) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Indiquez un nombre d’invités entre 1 et 100 000.');
    END IF;
    IF v_price IS NOT NULL AND (v_price < 1 OR v_price > 1000000000) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Indiquez un prix maximum d’au moins 1 F CFA.');
    END IF;
    v_limit := LEAST(GREATEST(v_limit, 1), 48);
    v_offset := LEAST(GREATEST(v_offset, 0), 10000);
    IF v_date IS NOT NULL THEN
        IF v_date < public.hall_dakar_now()::date THEN
            RETURN jsonb_build_object('ok', false, 'code', 'DATE_PASSED', 'message', 'Choisissez une date à venir.');
        END IF;
        IF v_date > public.hall_dakar_now()::date + 548 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'DATE_TOO_FAR', 'message', 'La date doit être dans les 18 mois à venir.');
        END IF;
        v_slot := public.hall_slot(v_date, v_date + (v_days - 1), NULL, NULL);
    END IF;
    v_like := CASE WHEN v_q IS NULL THEN NULL
                   ELSE '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%' END;

    WITH visible AS (
        SELECT hl.id, hl.name, hl.city, hl.address, hl.capacity, hl.price_per_day, hl.price_per_hour, hl.images,
               hl.latitude, hl.longitude, hl.amenities, hl.created_at,
               COALESCE(NULLIF(btrim(pa.commercial_name), ''), pa.company_name) AS partner_name
          FROM public.halls hl JOIN public.partners pa ON pa.id = hl.partner_id
         WHERE hl.is_active AND hl.validation_status = 'VALIDEE' AND pa.status::text = 'VALIDE'
           AND hl.price_per_day IS NOT NULL AND hl.price_per_day >= 1
    ), matching AS (
        SELECT v.* FROM visible v
         WHERE (v_like IS NULL OR v.name ILIKE v_like OR v.city ILIKE v_like OR v.address ILIKE v_like OR v.partner_name ILIKE v_like)
           AND (v_city IS NULL OR lower(btrim(v.city)) = lower(v_city))
           AND (v_cap IS NULL OR v.capacity >= v_cap)
           AND (v_price IS NULL OR v.price_per_day <= v_price)
           AND (v_slot IS NULL OR NOT EXISTS (
                   SELECT 1 FROM public.hall_reservations r
                    WHERE r.hall_id = v.id AND r.status IN ('EN_ATTENTE', 'CONFIRMEE') AND r.slot && v_slot))
    )
    SELECT (SELECT count(*) FROM matching),
           COALESCE((SELECT jsonb_agg(jsonb_build_object(
                        'id', m.id, 'name', m.name, 'city', m.city, 'address', m.address, 'capacity', m.capacity,
                        'price_per_day', m.price_per_day, 'price_per_hour', m.price_per_hour,
                        'photo', m.images[1], 'photo_count', COALESCE(cardinality(m.images), 0),
                        'latitude', m.latitude, 'longitude', m.longitude, 'partner_name', m.partner_name,
                        'amenities', COALESCE(m.amenities, '[]'::jsonb)) ORDER BY m.rank)
                      FROM (SELECT x.*, row_number() OVER (ORDER BY CASE WHEN v_sort = 'price' THEN x.price_per_day END, x.created_at DESC, x.id) AS rank
                              FROM matching x ORDER BY rank LIMIT v_limit OFFSET v_offset) m), '[]'::jsonb),
           COALESCE((SELECT jsonb_agg(c ORDER BY c) FROM (SELECT DISTINCT btrim(city) AS c FROM visible
                                                          WHERE NULLIF(btrim(city), '') IS NOT NULL) x), '[]'::jsonb)
      INTO v_total, v_rows, v_cities;
    RETURN jsonb_build_object('ok', true, 'total', v_total, 'halls', v_rows, 'cities', v_cities,
                              'limit', v_limit, 'offset', v_offset, 'sort', v_sort);
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Calendrier des disponibilités d'une salle publique (dates et heures prises, rien sur le client)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hall_calendar(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hall_id uuid := public.try_uuid(p->>'hall_id');
    v_from    date;
    v_to      date;
    v_today   date := public.hall_dakar_now()::date;
    v_busy    jsonb;
BEGIN
    BEGIN
        v_from := COALESCE(NULLIF(p->>'from', '')::date, v_today);
        v_to := COALESCE(NULLIF(p->>'to', '')::date, v_from + 41);
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATES', 'message', 'Période non valable.');
    END;
    IF v_to < v_from OR v_to - v_from > 92 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATES', 'message', 'Choisissez une période de 3 mois au plus.');
    END IF;
    IF v_hall_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.halls hl JOIN public.partners pa ON pa.id = hl.partner_id
         WHERE hl.id = v_hall_id AND hl.is_active AND hl.validation_status = 'VALIDEE' AND pa.status::text = 'VALIDE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_FOUND', 'message', 'Cette salle n’existe pas ou n’est plus proposée.');
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'start_date', r.start_date, 'end_date', r.end_date,
               'start_time', to_char(r.start_time, 'HH24:MI'),
               'end_time', CASE WHEN r.end_time IS NULL THEN NULL WHEN r.end_time = time '24:00' THEN '24:00' ELSE to_char(r.end_time, 'HH24:MI') END)
             ORDER BY lower(r.slot)), '[]'::jsonb)
      INTO v_busy
      FROM public.hall_reservations r
     WHERE r.hall_id = v_hall_id AND r.status IN ('EN_ATTENTE', 'CONFIRMEE')
       AND r.slot && tsrange(v_from + time '00:00', (v_to + 1) + time '00:00', '[)');
    RETURN jsonb_build_object('ok', true, 'hall_id', v_hall_id, 'from', v_from, 'to', v_to, 'today', v_today, 'busy', v_busy);
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Montant rendu au client s'il annule maintenant (affiché avant de confirmer ; même calcul que hall_refund_payment)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hall_cancel_preview(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_res_id uuid := public.try_uuid(p->>'reservation_id');
    v_client uuid := public.try_uuid(p->>'client_id');
    r        record;
    v_pct    numeric;
    v_amount numeric;
BEGIN
    SELECT * INTO r FROM public.hall_reservations WHERE id = v_res_id;
    IF v_res_id IS NULL OR v_client IS NULL OR NOT FOUND OR r.client_id <> v_client THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    IF r.booking_state NOT IN ('EN_ATTENTE_PAIEMENT', 'ACOMPTE_PAYE', 'PAYEE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_CANCELLABLE', 'message', 'Cette réservation est déjà annulée ou terminée.');
    END IF;
    IF lower(r.slot) <= public.hall_dakar_now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_STARTED', 'message', 'La réservation a déjà commencé : elle ne peut plus être annulée ici. Contactez le support.');
    END IF;
    v_pct := public.hall_cancel_percent(r.cancellation_terms, lower(r.slot), public.hall_dakar_now());
    SELECT COALESCE(sum(round(py.amount * v_pct / 100)), 0) INTO v_amount
      FROM public.payments py
     WHERE py.hall_reservation_id = r.id AND py.status::text = 'SUCCESS';
    IF v_pct <= 0 THEN
        v_amount := 0;
    END IF;
    RETURN jsonb_build_object('ok', true, 'reservation_id', r.id, 'paid_amount', r.paid_amount,
                              'refund_percent', CASE WHEN r.paid_amount > 0 THEN v_pct ELSE 0 END,
                              'refund_amount', v_amount, 'kept_amount', r.paid_amount - v_amount);
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Recettes des salles d'une partenaire (grand livre : ventes moins remboursements, disponibilité datée)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hall_partner_earnings(p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner uuid;
    v_rows    jsonb;
    v_avail   numeric;
    v_coming  numeric;
BEGIN
    SELECT pa.id INTO v_partner FROM public.partners pa WHERE pa.user_id = p_actor;
    IF p_actor IS NULL OR v_partner IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Espace réservé aux partenaires.');
    END IF;
    WITH per AS (
        SELECT r.id, r.hall_id, h.name AS hall_name, r.start_date, r.end_date, r.start_time, r.end_time, r.booking_state,
               r.paid_amount, r.refunded_amount,
               COALESCE(sum(l.amount), 0) AS earned,
               COALESCE(sum(l.amount) FILTER (WHERE l.available_at <= now()), 0) AS available,
               max(l.available_at) FILTER (WHERE l.entry_type = 'VENTE') AS available_at
          FROM public.hall_reservations r
          JOIN public.halls h ON h.id = r.hall_id
          JOIN public.payments py ON py.hall_reservation_id = r.id
          JOIN public.finance_ledger l ON l.payment_id = py.id AND l.account_kind = 'ORGANISATEUR'
         WHERE r.partner_id = v_partner
         GROUP BY r.id, h.name
    ), latest AS (
        SELECT * FROM per ORDER BY start_date DESC, id LIMIT 200
    )
    SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object(
               'reservation_id', id, 'hall_id', hall_id, 'hall_name', hall_name, 'start_date', start_date, 'end_date', end_date,
               'start_time', to_char(start_time, 'HH24:MI'),
               'end_time', CASE WHEN end_time IS NULL THEN NULL WHEN end_time = time '24:00' THEN '24:00' ELSE to_char(end_time, 'HH24:MI') END,
               'booking_state', booking_state, 'paid_amount', paid_amount, 'refunded_amount', refunded_amount,
               'earned', earned, 'available_at', available_at, 'available', available_at IS NOT NULL AND available_at <= now())
             ORDER BY start_date DESC, id) FROM latest), '[]'::jsonb),
           (SELECT COALESCE(sum(available), 0) FROM per),
           (SELECT COALESCE(sum(earned - available), 0) FROM per)
      INTO v_rows, v_avail, v_coming;
    RETURN jsonb_build_object('ok', true, 'available_total', v_avail, 'upcoming_total', v_coming, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.hall_submit(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hall_search(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hall_calendar(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hall_cancel_preview(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hall_partner_earnings(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hall_submit(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.hall_search(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.hall_calendar(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.hall_cancel_preview(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.hall_partner_earnings(uuid) TO service_role;

-- Recherche par salle des réservations qui tiennent la date
CREATE INDEX IF NOT EXISTS idx_hall_reservations_hall_live ON public.hall_reservations (hall_id) WHERE status IN ('EN_ATTENTE', 'CONFIRMEE');
