-- ============================================================================
-- EVENT VILLAGE — LOT 10a, migration 03 : réserver une salle (une seule fonction en base, argent calculé en base)
-- ============================================================================
-- Trous S1 à S3 de l'état des lieux du 18/11 : la route calculait le prix (0 F pour une salle sans prix à la journée),
-- remplaçait un acompte de 0 % par 30 % et ne vérifiait ni la salle ni son partenaire.
--  1. hall_cancel_terms(règle) : seuils de la règle d'annulation lus aux réglages, figés sur la réservation ;
--  2. hall_cancel_percent(seuils, début, instant) : part remboursée (100, partielle ou 0), « jusqu'à N jours avant »
--     = au moins N × 24 h avant le début ;
--  3. hall_quote(p) : prix, frais de service, total, acompte (pourcentage ou fixe, jamais 0, jamais plus que le prix),
--     paiement intégral exigé à moins de halls.balance_due_days du début, échéance du solde ; refus en français ;
--  4. hall_reserve(p) : service ouvert, compte actif, salle active et validée (si le réglage l'exige), partenaire
--     VALIDE, date à venir, 3 réservations non payées au plus par client, attentes échues libérées, aucun
--     chevauchement (verrou de la salle), montants de hall_quote, règle figée, journal ; la date est tenue
--     halls.hold_minutes (15 min) en attendant le paiement.
-- Toutes réservées au rôle de service (routes serveur). Rejouable : CREATE OR REPLACE, REVOKE idempotents.
-- Heure de Dakar = UTC toute l'année : les dates et heures saisies sont celles de Dakar.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hall_cancel_terms(p_policy text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partial numeric := public.fin_setting_num('halls.cancel_partial_percent');
BEGIN
    RETURN CASE p_policy
        WHEN 'SOUPLE' THEN jsonb_build_object('policy', 'SOUPLE', 'partial_percent', v_partial,
            'full_days', public.fin_setting_num('halls.cancel_souple_full_days'), 'partial_days', 0)
        WHEN 'MODEREE' THEN jsonb_build_object('policy', 'MODEREE', 'partial_percent', v_partial,
            'full_days', public.fin_setting_num('halls.cancel_moderee_full_days'),
            'partial_days', public.fin_setting_num('halls.cancel_moderee_partial_days'))
        WHEN 'STRICTE' THEN jsonb_build_object('policy', 'STRICTE', 'partial_percent', v_partial,
            'full_days', NULL, 'partial_days', public.fin_setting_num('halls.cancel_stricte_partial_days'))
        END;
END;
$$;

CREATE OR REPLACE FUNCTION public.hall_cancel_percent(p_terms jsonb, p_start timestamp, p_at timestamp)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    v_hours numeric := EXTRACT(EPOCH FROM (p_start - p_at)) / 3600;
BEGIN
    IF p_terms IS NULL THEN
        RETURN 0;
    END IF;
    IF v_hours < 0 THEN
        RETURN 0;
    END IF;
    IF (p_terms->>'full_days') IS NOT NULL AND v_hours >= (p_terms->>'full_days')::numeric * 24 THEN
        RETURN 100;
    END IF;
    IF (p_terms->>'partial_days') IS NOT NULL AND v_hours >= (p_terms->>'partial_days')::numeric * 24 THEN
        RETURN (p_terms->>'partial_percent')::numeric;
    END IF;
    RETURN 0;
END;
$$;

-- Début d'une réservation (heure de Dakar, sans fuseau) et « maintenant » à Dakar
CREATE OR REPLACE FUNCTION public.hall_dakar_now()
RETURNS timestamp
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT (now() AT TIME ZONE 'Africa/Dakar') $$;

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
    v_full := v_start - v_now < make_interval(days => v_due_days);
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

CREATE OR REPLACE FUNCTION public.hall_reserve(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client  uuid := public.try_uuid(p->>'client_id');
    v_hall_id uuid := public.try_uuid(p->>'hall_id');
    q         jsonb;
    v_hold    integer := public.fin_setting_num('halls.hold_minutes')::int;
    v_pending integer;
    v_id      uuid;
    v_expires timestamptz;
BEGIN
    IF NOT public.fin_setting_bool('features.halls_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SERVICE_CLOSED', 'message', 'La réservation de salles n’est pas encore ouverte.');
    END IF;
    IF v_client IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_client AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte ne permet pas de réserver pour le moment.');
    END IF;
    IF v_hall_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.halls WHERE id = v_hall_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_FOUND', 'message', 'Cette salle n’existe pas ou n’est plus proposée.');
    END IF;
    -- Une réservation à la fois par salle (même verrou que check_hall_availability), puis attentes échues libérées
    PERFORM pg_advisory_xact_lock(hashtextextended('hall_reservations:' || v_hall_id::text, 0));
    UPDATE public.hall_reservations
       SET booking_state = 'EXPIREE', payment_status = 'CANCELLED', hold_expires_at = NULL, updated_at = now()
     WHERE hall_id = v_hall_id AND booking_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at <= now();

    q := public.hall_quote(p);
    IF NOT (q->>'ok')::boolean THEN
        RETURN q;
    END IF;
    IF EXISTS (SELECT 1 FROM public.partners pa WHERE pa.id = (q->>'partner_id')::uuid AND pa.user_id = v_client) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'OWN_HALL', 'message', 'Vous ne pouvez pas réserver votre propre salle.');
    END IF;
    SELECT count(*) INTO v_pending FROM public.hall_reservations
     WHERE client_id = v_client AND booking_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at > now();
    IF v_pending >= 3 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_PENDING',
            'message', 'Vous avez déjà 3 réservations en attente de paiement. Payez-en une ou attendez qu’elle se libère.');
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.hall_reservations
         WHERE hall_id = v_hall_id AND status::text IN ('EN_ATTENTE', 'CONFIRMEE')
           AND slot && public.hall_slot((q->>'start_date')::date, (q->>'end_date')::date,
                                        NULLIF(q->>'start_time', '')::time, NULLIF(q->>'end_time', '')::time)
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN', 'message', 'Cette salle est déjà réservée pour cette période. Choisissez une autre date.');
    END IF;

    v_expires := now() + make_interval(mins => v_hold);
    BEGIN
        INSERT INTO public.hall_reservations (
            hall_id, client_id, partner_id, start_date, end_date, start_time, end_time,
            booking_state, booking_mode, units, unit_price, price_amount, service_fee_rate, service_fee_amount, commission_rate,
            total_amount, deposit_price, deposit_service_fee, deposit_amount, balance_amount,
            full_payment_required, balance_due_at, moratorium_date, hold_expires_at,
            cancellation_policy, cancellation_terms, payment_status, notes)
        VALUES (
            v_hall_id, v_client, (q->>'partner_id')::uuid, (q->>'start_date')::date, (q->>'end_date')::date,
            NULLIF(q->>'start_time', '')::time, NULLIF(q->>'end_time', '')::time,
            'EN_ATTENTE_PAIEMENT', q->>'mode', (q->>'units')::int, (q->>'unit_price')::numeric, (q->>'price_amount')::numeric,
            (q->>'service_fee_rate')::numeric, (q->>'service_fee_amount')::numeric, (q->>'commission_rate')::numeric,
            (q->>'total_amount')::numeric, (q->>'deposit_price')::numeric, (q->>'deposit_service_fee')::numeric,
            (q->>'deposit_amount')::numeric, (q->>'balance_amount')::numeric,
            (q->>'full_payment_required')::boolean, NULLIF(q->>'balance_due_at', '')::timestamptz,
            (NULLIF(q->>'balance_due_at', '')::timestamptz AT TIME ZONE 'Africa/Dakar')::date, v_expires,
            q->>'cancellation_policy', q->'cancellation_terms', 'PENDING',
            NULLIF(left(btrim(COALESCE(p->>'notes', '')), 500), ''))
        RETURNING id INTO v_id;
    EXCEPTION
        WHEN exclusion_violation OR raise_exception THEN
            RETURN jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN', 'message', 'Cette salle est déjà réservée pour cette période. Choisissez une autre date.');
    END;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value, metadata)
    VALUES (v_client, 'CLIENT', 'HALL_RESERVATION_CREATED', 'hall_reservations', v_id,
            jsonb_build_object('booking_state', 'EN_ATTENTE_PAIEMENT', 'total_amount', q->'total_amount', 'deposit_amount', q->'deposit_amount'),
            jsonb_build_object('hall_id', v_hall_id, 'start_date', q->'start_date', 'end_date', q->'end_date',
                               'mode', q->'mode', 'units', q->'units', 'cancellation_policy', q->'cancellation_policy'));

    RETURN q || jsonb_build_object('reservation_id', v_id, 'booking_state', 'EN_ATTENTE_PAIEMENT', 'hold_expires_at', v_expires);
END;
$$;

REVOKE ALL ON FUNCTION public.hall_cancel_terms(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hall_cancel_percent(jsonb, timestamp, timestamp) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hall_dakar_now() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hall_quote(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hall_reserve(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hall_cancel_terms(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hall_cancel_percent(jsonb, timestamp, timestamp) TO service_role;
GRANT EXECUTE ON FUNCTION public.hall_dakar_now() TO service_role;
GRANT EXECUTE ON FUNCTION public.hall_quote(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.hall_reserve(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.hall_slot(date, date, time, time) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hall_slot(date, date, time, time) TO service_role;

-- L'ancienne fonction, jamais appelée par l'application, calculait l'argent (100 000 F par défaut) : retirée
DROP FUNCTION IF EXISTS public.create_hall_reservation_atomic(uuid, uuid, date, date, time, time, text, date);
