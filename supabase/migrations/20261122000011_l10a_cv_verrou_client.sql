-- ============================================================================
-- EVENT VILLAGE — LOT 10a, correctifs de la contre-vérification (docs/audit-lot10a.md), migration 11 : T5
-- ============================================================================
-- T5 (faible) : le verrou de hall_reserve est par salle ; le compte des attentes du client n'était pas protégé :
-- 10 demandes simultanées sur 10 salles en laissaient passer 4 ou 5 (limite : 3).
--  1. hall_client_pending_refusal : recopie de 20261122000009_l10a_cv_relance.sql (limite de 3 attentes) ; changements :
--     verrou par client (pg_advisory_xact_lock sur client_id, gardé jusqu'à la fin de la transaction) AVANT de compter
--     ses attentes ; fonction VOLATILE (et non plus STABLE) : le compte est lu par une nouvelle requête après le verrou,
--     donc voit les attentes validées par la transaction qui le tenait (une fonction STABLE garde l'instantané pris
--     avant le verrou) ;
--  2. hall_reserve : recopie de 20261122000003_l10a_reserver.sql:203-289 ; changement : la limite des attentes passe
--     par hall_client_pending_refusal (verrou par client, en plus du verrou par salle) ; hall_payment_create (migration
--     20261122000010) l'appelle déjà avant de reprendre une date.
-- Ordre des verrous partout : salle, puis client, puis numéro payeur (aucun interblocage).
-- Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hall_client_pending_refusal(p_client uuid, p_exclude uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pending integer;
BEGIN
    -- Correctifs de la contre-vérification du lot 10a (T5) : une réservation ou une reprise de date à la fois par client
    PERFORM pg_advisory_xact_lock(hashtextextended('hall_client_pending:' || COALESCE(p_client::text, ''), 0));
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

-- Recopie de 20261122000003_l10a_reserver.sql:203-289 ; changement : limite des attentes sous verrou par client.
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
    v_refusal jsonb;
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
    -- Correctifs de la contre-vérification du lot 10a (T5) : attentes du client comptées sous verrou par client
    v_refusal := public.hall_client_pending_refusal(v_client, NULL);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
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

REVOKE ALL ON FUNCTION public.hall_client_pending_refusal(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hall_reserve(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hall_client_pending_refusal(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.hall_reserve(jsonb) TO service_role;
