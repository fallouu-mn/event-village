-- ============================================================================
-- EVENT VILLAGE — LOT 10a, migration 04 : payer une réservation de salle (acompte puis solde, ou intégral)
-- ============================================================================
-- Trou S4 de l'état des lieux du 18/11 : le premier paiement demandait le SOLDE avant l'acompte et marquait toute la
-- réservation payée ; la confirmation passait par un chemin générique sans contrôle ; un échec du paiement du solde
-- annulait une réservation dont l'acompte était payé (releaseOther).
--  1. hall_payment_create(p) : paiement PENDING créé en base, montant relu sur la réservation (jamais fourni par le
--     corps de la requête) : acompte, solde ou intégral ; intégral seul après l'échéance du solde ; un paiement en
--     attente à la fois par réservation ; 3 paiements en attente au plus par numéro payeur et par heure (règle des
--     billets) ; une attente échue reprend la date si elle est encore libre ;
--  2. hall_payment_confirm(paiement, source) : confirmation sous verrou ; « payée » seulement quand le total est
--     encaissé ; un paiement qui ne peut plus être honoré (date reprise, réservation annulée ou déjà payée, montant
--     différent) est remboursé en entier, comme un panier de billets ; avis et journal ;
--  3. fin_payout_available_at : recopie de 20261101000004_lot3_grand_livre.sql:107-132 ; recettes d'une salle disponibles après la fin de la
--     réservation + délai (comme les billets) ;
--  4. calculate_referral_commissions : recopie de 20261111000005_lot9quater_argent.sql:862-952 ; commission d'une salle disponible après la fin
--     de la réservation + délai.
-- Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- ============================================================================

-- Données communes des avis d'une réservation de salle (montants en F CFA, dates de Dakar)
CREATE OR REPLACE FUNCTION public.hall_notif_data(p_reservation_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_strip_nulls(jsonb_build_object(
        'reservation_id', r.id,
        'hall_id', r.hall_id,
        'hall_name', h.name,
        'start_date', r.start_date,
        'end_date', r.end_date,
        'start_time', to_char(r.start_time, 'HH24:MI'),
        'end_time', CASE WHEN r.end_time IS NULL THEN NULL WHEN r.end_time = time '24:00' THEN '24:00' ELSE to_char(r.end_time, 'HH24:MI') END,
        'mode', r.booking_mode,
        'total_amount', r.total_amount,
        'paid_amount', r.paid_amount,
        'balance_amount', CASE WHEN r.booking_state = 'ACOMPTE_PAYE' THEN r.total_amount - r.paid_amount END,
        'balance_due_at', CASE WHEN r.booking_state = 'ACOMPTE_PAYE' THEN r.balance_due_at END,
        'cancellation_policy', r.cancellation_policy))
      FROM public.hall_reservations r JOIN public.halls h ON h.id = r.hall_id
     WHERE r.id = p_reservation_id;
$$;

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
                                    OR (r.balance_due_at IS NOT NULL AND now() >= r.balance_due_at)) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'FULL_PAYMENT_REQUIRED',
                'message', 'La date est proche : cette réservation se paie en une fois.');
        END IF;
        IF r.hold_expires_at IS NULL OR r.hold_expires_at <= now() THEN
            -- Attente échue : la date est reprise seulement si personne d'autre ne la tient
            IF EXISTS (SELECT 1 FROM public.hall_reservations o
                        WHERE o.hall_id = r.hall_id AND o.id <> r.id AND o.status::text IN ('EN_ATTENTE', 'CONFIRMEE') AND o.slot && r.slot) THEN
                UPDATE public.hall_reservations SET booking_state = 'EXPIREE', payment_status = 'CANCELLED', hold_expires_at = NULL, updated_at = now()
                 WHERE id = r.id;
                RETURN jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN', 'message', 'Le délai pour payer est passé et la date a été réservée par quelqu’un d’autre.');
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
                                    OR (r.balance_due_at IS NOT NULL AND now() >= r.balance_due_at)) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'FULL_PAYMENT_REQUIRED',
                'message', 'La date est proche : cette réservation se paie en une fois.');
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

CREATE OR REPLACE FUNCTION public.hall_payment_confirm(p_payment_id uuid, p_source text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay      record;
    r          record;
    v_hall     uuid;
    v_part     text;
    v_expected numeric;
    v_blocking text;
    v_cashout  uuid;
    v_first    boolean;
    v_paid     numeric;
    v_state    text;
    v_owner    uuid;
    v_data     jsonb;
BEGIN
    SELECT hall_reservation_id INTO v_pay FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('result', 'NOT_FOUND');
    END IF;
    IF v_pay.hall_reservation_id IS NOT NULL THEN
        SELECT hall_id INTO v_hall FROM public.hall_reservations WHERE id = v_pay.hall_reservation_id;
        IF v_hall IS NOT NULL THEN
            PERFORM pg_advisory_xact_lock(hashtextextended('hall_reservations:' || v_hall::text, 0));
        END IF;
    END IF;
    SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF v_pay.status::text = 'SUCCESS' THEN
        RETURN jsonb_build_object('result', 'ALREADY_CONFIRMED');
    END IF;
    IF v_pay.status::text IN ('REFUND_PENDING', 'REFUNDED', 'PARTIAL') THEN
        RETURN jsonb_build_object('result', 'REFUND_IN_PROGRESS', 'status', v_pay.status::text);
    END IF;
    IF v_pay.payment_target::text <> 'HALL_RESERVATION' OR v_pay.hall_reservation_id IS NULL THEN
        RETURN jsonb_build_object('result', 'NOT_HALL');
    END IF;
    IF v_pay.status::text NOT IN ('PENDING', 'EXPIRED', 'CANCELLED', 'FAILED') THEN
        RETURN jsonb_build_object('result', 'NOT_CONFIRMABLE', 'status', v_pay.status::text);
    END IF;
    SELECT * INTO r FROM public.hall_reservations WHERE id = v_pay.hall_reservation_id FOR UPDATE;
    v_part := v_pay.metadata->>'part';
    v_expected := CASE v_part
        WHEN 'ACOMPTE' THEN r.deposit_amount
        WHEN 'INTEGRAL' THEN r.total_amount
        WHEN 'SOLDE' THEN r.total_amount - r.deposit_amount END;

    IF v_expected IS NULL OR v_expected <> v_pay.amount THEN
        v_blocking := 'montant différent de celui de la réservation';
    ELSIF v_part IN ('ACOMPTE', 'INTEGRAL') THEN
        IF r.paid_amount > 0 OR r.booking_state NOT IN ('EN_ATTENTE_PAIEMENT', 'EXPIREE') THEN
            v_blocking := CASE WHEN r.booking_state IN ('ACOMPTE_PAYE', 'PAYEE') THEN 'réservation déjà payée' ELSE 'réservation annulée' END;
        ELSIF lower(r.slot) <= public.hall_dakar_now() THEN
            v_blocking := 'date de la réservation passée';
        ELSIF (r.booking_state = 'EXPIREE' OR r.hold_expires_at IS NULL OR r.hold_expires_at <= now())
              AND EXISTS (SELECT 1 FROM public.hall_reservations o
                           WHERE o.hall_id = r.hall_id AND o.id <> r.id AND o.status::text IN ('EN_ATTENTE', 'CONFIRMEE') AND o.slot && r.slot) THEN
            v_blocking := 'date réservée par quelqu’un d’autre après le délai';
        END IF;
    ELSIF v_part = 'SOLDE' THEN
        IF r.booking_state <> 'ACOMPTE_PAYE' OR r.paid_amount + v_pay.amount <> r.total_amount THEN
            v_blocking := CASE WHEN r.booking_state = 'PAYEE' THEN 'réservation déjà payée' ELSE 'réservation annulée' END;
        END IF;
    ELSE
        v_blocking := 'nature du paiement inconnue';
    END IF;

    IF v_blocking IS NOT NULL THEN
        UPDATE public.payments
           SET status = 'REFUND_PENDING', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(),
               confirmed_source = p_source, metadata = metadata || jsonb_build_object('refund_reason', v_blocking)
         WHERE id = p_payment_id;
        v_cashout := public.refund_request(p_payment_id, 'Paiement de salle impossible à honorer : ' || v_blocking, 'REFUND');
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'HALL_PAYMENT_REFUNDED', 'key', 'HALL_PAYMENT_REFUNDED:' || p_payment_id::text,
            'user_id', v_pay.client_id,
            'data', COALESCE(public.hall_notif_data(r.id), '{}'::jsonb)
                    || jsonb_build_object('payment_id', p_payment_id, 'amount', v_pay.amount, 'operator', v_pay.operator::text)));
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
        VALUES (NULL, 'SYSTEM', 'HALL_PAYMENT_REFUNDED', 'hall_reservations', r.id,
                jsonb_build_object('payment_id', p_payment_id, 'amount', v_pay.amount, 'reason', v_blocking, 'source', p_source));
        RETURN jsonb_build_object('result', 'REFUND_REQUIRED', 'reason', v_blocking, 'cashout_id', v_cashout);
    END IF;

    UPDATE public.payments
       SET status = 'SUCCESS', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(), confirmed_source = p_source
     WHERE id = p_payment_id;

    v_first := r.confirmed_at IS NULL;
    v_paid := r.paid_amount + v_pay.amount;
    v_state := CASE WHEN v_paid >= r.total_amount THEN 'PAYEE' ELSE 'ACOMPTE_PAYE' END;
    UPDATE public.hall_reservations
       SET paid_amount = v_paid, booking_state = v_state,
           payment_status = CASE WHEN v_state = 'PAYEE' THEN 'SUCCESS' ELSE 'PARTIAL' END::public.payment_status_enum,
           hold_expires_at = NULL, confirmed_at = COALESCE(confirmed_at, now()), updated_at = now()
     WHERE id = r.id;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (NULL, 'SYSTEM', 'HALL_PAYMENT_CONFIRMED', 'hall_reservations', r.id,
            jsonb_build_object('booking_state', r.booking_state, 'paid_amount', r.paid_amount),
            jsonb_build_object('booking_state', v_state, 'paid_amount', v_paid),
            jsonb_build_object('payment_id', p_payment_id, 'part', v_part, 'amount', v_pay.amount, 'source', p_source));

    v_data := COALESCE(public.hall_notif_data(r.id), '{}'::jsonb) || jsonb_build_object('payment_id', p_payment_id, 'amount', v_pay.amount);
    SELECT pa.user_id INTO v_owner FROM public.partners pa WHERE pa.id = r.partner_id;
    IF v_first THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'HALL_RESERVATION_CONFIRMED', 'key', 'HALL_RESERVATION_CONFIRMED:' || r.id::text,
            'user_id', r.client_id, 'data', v_data));
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'HALL_RESERVATION_REQUESTED', 'key', 'HALL_RESERVATION_REQUESTED:' || r.id::text,
                'user_id', v_owner, 'data', v_data));
        END IF;
    ELSE
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'HALL_BALANCE_PAID', 'key', 'HALL_BALANCE_PAID:' || r.id::text || ':' || r.client_id::text,
            'user_id', r.client_id, 'data', v_data || jsonb_build_object('recipient_role', 'CLIENT')));
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'HALL_BALANCE_PAID', 'key', 'HALL_BALANCE_PAID:' || r.id::text || ':' || v_owner::text,
                'user_id', v_owner, 'data', v_data || jsonb_build_object('recipient_role', 'PARTNER')));
        END IF;
    END IF;
    RETURN jsonb_build_object('result', 'CONFIRMED', 'reservation_id', r.id, 'booking_state', v_state, 'paid_amount', v_paid);
END;
$$;

REVOKE ALL ON FUNCTION public.hall_notif_data(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hall_payment_create(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hall_payment_confirm(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hall_notif_data(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.hall_payment_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.hall_payment_confirm(uuid, text) TO service_role;


-- Recopie de 20261101000004_lot3_grand_livre.sql:107-132 ; changement : branche HALL_RESERVATION (fin de la réservation).
CREATE OR REPLACE FUNCTION public.fin_payout_available_at(p_payment_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    p record;
    v_hold boolean;
    v_delay integer;
    v_end timestamptz;
BEGIN
    SELECT id, payment_target::text AS payment_target, event_id, paid_at, payout_hold_enabled, payout_delay_hours, hall_reservation_id
      INTO p FROM public.payments WHERE id = p_payment_id;
    v_hold := COALESCE(p.payout_hold_enabled, public.fin_setting_bool('finance.payout_hold_enabled'));
    v_delay := COALESCE(p.payout_delay_hours, public.fin_setting_num('finance.payout_delay_hours')::int);
    IF NOT v_hold THEN
        RETURN COALESCE(p.paid_at, now());
    END IF;
    IF p.payment_target = 'TICKET' AND p.event_id IS NOT NULL THEN
        v_end := public.fin_event_end(p.event_id);
    ELSIF p.payment_target = 'HALL_RESERVATION' AND p.hall_reservation_id IS NOT NULL THEN
        -- Lot 10a : recettes d'une salle disponibles après la fin de la réservation + délai, comme les billets
        SELECT upper(r.slot) AT TIME ZONE 'Africa/Dakar' INTO v_end FROM public.hall_reservations r WHERE r.id = p.hall_reservation_id;
    END IF;
    RETURN COALESCE(v_end, p.paid_at, now()) + make_interval(hours => v_delay);
END;
$$;

-- Recopie de 20261111000005_lot9quater_argent.sql:862-952 ; changement : branche HALL_RESERVATION (fin de la réservation).
CREATE OR REPLACE FUNCTION public.calculate_referral_commissions(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment record;
    v_rel_n1 record;
    v_rel_n2 record;
    v_available timestamptz;
    v_amount numeric;
    v_id uuid;
    v_calc numeric;
    v_budget numeric;
BEGIN
    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'calculate_referral_commissions : paiement % introuvable', p_payment_id;
    END IF;
    IF v_payment.status <> 'SUCCESS' OR NOT v_payment.is_platform_payment THEN
        RETURN;
    END IF;
    IF v_payment.net_event_village_revenue IS NULL OR v_payment.net_event_village_revenue <= 0 THEN
        RETURN;
    END IF;
    SELECT * INTO v_rel_n1 FROM public.referral_relationships
     WHERE referred_id = v_payment.client_id AND is_active = TRUE AND expires_at >= now();
    IF NOT FOUND THEN
        RETURN;
    END IF;
    -- Lot 9 bis (R106, B12) : commission d'un billet disponible après la fin de l'événement + délai réglé, jamais
    -- avant la confirmation + délai ; abonnement et paiement sans événement : règle inchangée.
    IF v_payment.payment_target::text = 'TICKET' AND v_payment.event_id IS NOT NULL THEN
        v_available := GREATEST(now(), public.fin_event_end(v_payment.event_id))
                       + make_interval(days => public.fin_setting_num('finance.referral_availability_days')::int);
    ELSIF v_payment.payment_target::text = 'HALL_RESERVATION' AND v_payment.hall_reservation_id IS NOT NULL THEN
        -- Lot 10a (§100) : commission d'une réservation de salle disponible après la fin de la réservation + délai réglé
        v_available := GREATEST(now(), COALESCE((SELECT upper(r.slot) AT TIME ZONE 'Africa/Dakar' FROM public.hall_reservations r
                                                  WHERE r.id = v_payment.hall_reservation_id), now()))
                       + make_interval(days => public.fin_setting_num('finance.referral_availability_days')::int);
    ELSE
        v_available := now() + make_interval(days => public.fin_setting_num('finance.referral_availability_days')::int);
    END IF;

    v_calc := public.fin_round_2(v_payment.net_event_village_revenue * v_rel_n1.rate_n1_at_creation / 100);
    v_amount := LEAST(v_calc, v_payment.net_event_village_revenue);
    -- Lot 9 quater (C5 : AUD-30) : aucune commission si le numéro payeur est celui du parrain ou un numéro qu'il a déjà
    -- utilisé pour payer (auto-parrainage par un second compte)
    IF public.referral_self_payer(v_rel_n1.sponsor_id, v_payment.payer_phone) THEN
        v_amount := 0;
    END IF;
    v_budget := v_payment.net_event_village_revenue - v_amount;
    IF v_amount > 0 THEN
        INSERT INTO public.referral_commissions (sponsor_id, referred_id, generation, referral_type, payment_id, eligible_net_revenue,
                                                 commission_rate, amount, status, idempotency_key, available_at, kind, uncapped_amount)
        VALUES (v_rel_n1.sponsor_id, v_payment.client_id, 'N1', v_rel_n1.referral_type, v_payment.id, v_payment.net_event_village_revenue,
                v_rel_n1.rate_n1_at_creation, v_amount, 'PENDING', 'COMM_N1_' || v_payment.id || '_' || v_rel_n1.sponsor_id, v_available, 'COMMISSION',
                CASE WHEN v_calc > v_amount THEN v_calc END)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id INTO v_id;
        IF v_id IS NOT NULL THEN
            PERFORM public.fin_ledger_credit(v_rel_n1.sponsor_id, 'PARRAINAGE', NULL, 'COMMISSION', v_amount, v_available,
                                             jsonb_build_object('payment_id', v_payment.id, 'commission_id', v_id, 'event_id', v_payment.event_id),
                                             'COMM-' || v_id::text, 'Commission de parrainage N1');
        END IF;
    END IF;

    SELECT * INTO v_rel_n2 FROM public.referral_relationships
     WHERE referred_id = v_rel_n1.sponsor_id AND is_active = TRUE AND expires_at >= now();
    IF NOT FOUND THEN
        RETURN;
    END IF;
    v_id := NULL;
    v_calc := public.fin_round_2(v_payment.net_event_village_revenue * v_rel_n1.rate_n2_at_creation / 100);
    v_amount := LEAST(v_calc, v_budget);
    IF public.referral_self_payer(v_rel_n2.sponsor_id, v_payment.payer_phone) THEN
        v_amount := 0;
    END IF;
    IF v_amount > 0 THEN
        INSERT INTO public.referral_commissions (sponsor_id, referred_id, generation, referral_type, payment_id, eligible_net_revenue,
                                                 commission_rate, amount, status, idempotency_key, available_at, kind, uncapped_amount)
        VALUES (v_rel_n2.sponsor_id, v_payment.client_id, 'N2', v_rel_n1.referral_type, v_payment.id, v_payment.net_event_village_revenue,
                v_rel_n1.rate_n2_at_creation, v_amount, 'PENDING', 'COMM_N2_' || v_payment.id || '_' || v_rel_n2.sponsor_id, v_available, 'COMMISSION',
                CASE WHEN v_calc > v_amount THEN v_calc END)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id INTO v_id;
        IF v_id IS NOT NULL THEN
            PERFORM public.fin_ledger_credit(v_rel_n2.sponsor_id, 'PARRAINAGE', NULL, 'COMMISSION', v_amount, v_available,
                                             jsonb_build_object('payment_id', v_payment.id, 'commission_id', v_id, 'event_id', v_payment.event_id),
                                             'COMM-' || v_id::text, 'Commission de parrainage N2');
        END IF;
    END IF;
END;
$$;
