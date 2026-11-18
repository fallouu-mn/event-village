-- ============================================================================
-- EVENT VILLAGE — LOT 10a, correctifs de la contre-vérification (docs/audit-lot10a.md), migration 08 : T3
-- ============================================================================
-- T3 (élevée) : un acompte lancé avant l'échéance du solde et confirmé après était encaissé (ACOMPTE_PAYE), le solde
-- était ensuite refusé (BALANCE_DEADLINE_PASSED) et la tâche annulait d'office (« Délai de paiement dépassé ») en
-- appliquant la règle à l'échéance : en règle stricte, 126 000 F perdus pour le client.
--  1. hall_payment_confirm : recopie de 20261122000004_l10a_paiement.sql:218-348 ; changement : un paiement confirmé
--     APRÈS l'échéance du solde qui ne paie pas toute la réservation (un acompte, ou tout paiement qui laisserait un
--     solde) est remboursé en entier, comme un paiement impossible à honorer (statut REFUND_PENDING, refund_request,
--     avis HALL_PAYMENT_REFUNDED, journal), jamais encaissé. Un paiement qui complète le total (solde lancé avant
--     l'échéance, attendu par la tâche ; paiement intégral) reste encaissé : la réservation est payée.
-- Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- ============================================================================

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
    -- Correctifs de la contre-vérification du lot 10a (T3) : confirmé après l'échéance du solde sans payer toute la
    -- réservation (un acompte) : rendu en entier. Encaissé, il serait perdu au passage suivant de la tâche (« Délai de
    -- paiement dépassé », règle d'annulation appliquée à l'échéance). Un paiement qui complète le total reste encaissé.
    IF v_blocking IS NULL AND r.balance_due_at IS NOT NULL AND now() > r.balance_due_at
       AND r.paid_amount + v_pay.amount < r.total_amount THEN
        v_blocking := 'échéance du solde passée avant la confirmation du paiement';
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

REVOKE ALL ON FUNCTION public.hall_payment_confirm(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hall_payment_confirm(uuid, text) TO service_role;
