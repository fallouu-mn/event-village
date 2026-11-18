-- ============================================================================
-- EVENT VILLAGE — LOT 10a, correctifs de la contre-vérification (docs/audit-lot10a.md), migration 09 : T2
-- ============================================================================
-- T2 (moyenne) : hall_payment_create remettait une réservation échue (EXPIREE, ou attente échue) en attente si la date
-- était libre, sans refaire les contrôles de hall_quote et hall_reserve : salle suspendue ou désactivée, partenaire
-- suspendue, limite de 3 attentes du client. Un client relançait des dates sur une salle fermée par l'administration
-- et tenait plus de 3 dates sans payer.
--  1. hall_booking_refusal(salle) : les contrôles de disponibilité de hall_quote (20261122000003_l10a_reserver.sql:113-123),
--     en une fonction : salle existante et active, partenaire VALIDE, salle validée (ou validation non exigée et salle
--     ni refusée ni suspendue). NULL si la salle est ouverte à la réservation, sinon le refus (HALL_NOT_AVAILABLE) ;
--  2. hall_client_pending_refusal(client, réservation exclue) : la limite de hall_reserve (3 réservations en attente de
--     paiement qui tiennent une date), en une fonction ; NULL sous la limite, sinon le refus (TOO_MANY_PENDING) ;
--  3. hall_payment_create : recopie de 20261122000004_l10a_paiement.sql:47-216 ; changements : avant tout premier
--     paiement (acompte ou intégral) d'une réservation qui n'est pas encore payée, salle et partenaire contrôlées ; avant
--     de reprendre une date (attente échue ou réservation EXPIREE), limite de 3 attentes du client contrôlée (la
--     réservation relancée exclue). Aucun contrôle de ce genre pour le solde : la réservation est déjà confirmée.
-- Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hall_booking_refusal(p_hall_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    h record;
BEGIN
    SELECT hl.is_active, hl.validation_status, pa.status::text AS partner_status INTO h
      FROM public.halls hl JOIN public.partners pa ON pa.id = hl.partner_id
     WHERE hl.id = p_hall_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_FOUND', 'message', 'Cette salle n’existe pas ou n’est plus proposée.');
    END IF;
    IF NOT h.is_active OR h.partner_status <> 'VALIDE'
       OR (h.validation_status <> 'VALIDEE'
           AND (public.fin_setting_bool('halls.validation_required') OR h.validation_status IN ('REFUSEE', 'SUSPENDUE'))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_AVAILABLE', 'message', 'Cette salle n’est pas ouverte à la réservation pour le moment.');
    END IF;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.hall_client_pending_refusal(p_client uuid, p_exclude uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pending integer;
BEGIN
    SELECT count(*) INTO v_pending FROM public.hall_reservations
     WHERE client_id = p_client AND id IS DISTINCT FROM p_exclude
       AND booking_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at > now();
    IF v_pending >= 3 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_PENDING',
            'message', 'Vous avez déjà 3 réservations en attente de paiement. Payez-en une ou attendez qu’elle se libère.');
    END IF;
    RETURN NULL;
END;
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
    v_refusal  jsonb;
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
                                    OR (r.balance_due_at IS NOT NULL AND now() >= r.balance_due_at)) THEN
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

REVOKE ALL ON FUNCTION public.hall_booking_refusal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hall_client_pending_refusal(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hall_payment_create(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hall_booking_refusal(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.hall_client_pending_refusal(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.hall_payment_create(jsonb) TO service_role;
