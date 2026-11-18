-- ============================================================================
-- EVENT VILLAGE — LOT 11a, correctifs de la contre-vérification (docs/audit-lot11a.md), migration 110 : T1
-- ============================================================================
-- T1 (moyenne) : table_payment_create remettait la réservation « En attente de paiement » avec une nouvelle échéance
-- de 15 min (UPDATE … hold_expires_at), PUIS contrôlait le plafond de 3 paiements en attente par numéro payeur et
-- rendait PAYER_PENDING_LIMIT sans lever d'erreur : la transaction était validée, une attente échue était reprise (ou
-- une attente en cours prolongée) sans aucun paiement. Un client qui laissait 3 acomptes en attente sur son numéro
-- tenait ensuite n'importe quelle table en rappelant le paiement toutes les 14 minutes.
--  1. table_payment_create : recopie de 20261123000105_l11a_paiement.sql:75-203 ; changement : le plafond du numéro
--     payeur (verrou et compte) est contrôlé AVANT de reprendre ou de prolonger l'attente, comme tous les autres refus ;
--     après lui, plus aucun refus ne laisse l'attente reprise ou prolongée (seul l'échec de la reprise, table prise
--     entre-temps, rend SLOT_TAKEN, et l'UPDATE est alors annulé par son bloc).
-- Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.table_payment_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client   uuid := public.try_uuid(p->>'client_id');
    v_res_id   uuid := public.try_uuid(p->>'reservation_id');
    v_operator text := NULLIF(p->>'operator', '');
    r          record;
    v_hold     integer := public.fin_setting_num('tables.hold_minutes')::int;
    v_pending  uuid;
    v_payer_pending integer;
    v_amount   numeric;
    v_agg_rate numeric;
    v_agg      numeric;
    v_comm     numeric;
    v_payment  uuid;
    v_expires  timestamptz;
    v_refusal  jsonb;
BEGIN
    IF NOT public.fin_setting_bool('features.tables_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SERVICE_CLOSED', 'message', 'La réservation de tables n’est pas encore ouverte.');
    END IF;
    IF v_operator IS NULL OR v_operator NOT IN ('WAVE', 'ORANGE_MONEY') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'OPERATOR_REQUIRED', 'message', 'Choisissez Wave ou Orange Money.');
    END IF;
    IF v_client IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_client AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte ne permet pas de payer pour le moment.');
    END IF;
    SELECT venue_id INTO r FROM public.table_reservations WHERE id = v_res_id AND client_id = v_client;
    IF v_res_id IS NULL OR NOT FOUND OR r.venue_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    -- Même verrou que la réservation d'une table de l'établissement, puis la réservation elle-même
    PERFORM public.table_venue_lock(r.venue_id);
    SELECT * INTO r FROM public.table_reservations WHERE id = v_res_id FOR UPDATE;
    IF r.total_amount <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOTHING_TO_PAY', 'message', 'Cette réservation est sans acompte : il n’y a rien à payer.');
    END IF;
    IF r.paid_amount > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_PAID', 'message', 'L’acompte de cette réservation est déjà payé.');
    END IF;
    SELECT id INTO v_pending FROM public.payments
     WHERE table_reservation_id = v_res_id AND status::text = 'PENDING' AND created_at > now() - interval '60 minutes'
     ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PAYMENT_PENDING', 'payment_id', v_pending,
            'message', 'Un paiement est déjà en cours pour cette réservation. Terminez-le ou attendez quelques minutes.');
    END IF;
    IF r.booking_state NOT IN ('EN_ATTENTE_PAIEMENT', 'EXPIREE') OR lower(r.slot) <= public.hall_dakar_now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_ACTIVE', 'message', 'Cette réservation ne peut plus être payée.');
    END IF;

    PERFORM set_config('event_village.table_booking', 'on', true);
    -- Tous les contrôles de la réservation refaits (attente échue ou non) ; une attente échue refusée rend la table
    v_refusal := public.table_hold_refusal(r.id);
    IF v_refusal IS NOT NULL THEN
        IF r.booking_state = 'EN_ATTENTE_PAIEMENT' AND (r.hold_expires_at IS NULL OR r.hold_expires_at <= now()) THEN
            PERFORM public.table_expire_hold(r.id);
        END IF;
        RETURN jsonb_build_object('ok', false) || v_refusal;
    END IF;
    -- Attente échue reprise : elle compte de nouveau parmi les demandes en attente du client (verrou par client, comme
    -- table_reserve ; équivalent côté tables des trous T2 et T5 de la contre-vérification de la 10a)
    IF r.booking_state = 'EXPIREE' OR r.hold_expires_at IS NULL OR r.hold_expires_at <= now() THEN
        PERFORM pg_advisory_xact_lock(hashtextextended('table_client:' || v_client::text, 0));
        SELECT count(*) INTO v_payer_pending FROM public.table_reservations
         WHERE client_id = v_client AND id <> r.id
           AND ((booking_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at > now()) OR booking_state = 'EN_ATTENTE_ACCEPTATION');
        IF v_payer_pending >= public.fin_setting_num('tables.max_pending_per_client')::int THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_PENDING',
                'message', format('Vous avez déjà %s demandes en attente. Attendez une réponse ou annulez-en une.', v_payer_pending));
        END IF;
    END IF;
    -- Règle des billets : 3 paiements en attente au plus par numéro payeur et par heure. Contrôle de la
    -- contre-vérification (T1) : AVANT de reprendre ou de prolonger l'attente, comme tous les autres refus
    IF NULLIF(p->>'payer_phone', '') IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('checkout-payer:' || (p->>'payer_phone')));
        SELECT count(*) INTO v_payer_pending FROM public.payments
         WHERE payer_phone = p->>'payer_phone' AND status::text = 'PENDING' AND created_at > now() - interval '1 hour';
        IF v_payer_pending >= 3 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PAYER_PENDING_LIMIT',
                'message', 'Un paiement est déjà en attente pour ce numéro. Terminez-le ou attendez quelques minutes.');
        END IF;
    END IF;

    -- Plus aucun refus après ce point : l'attente n'est reprise ou prolongée que si le paiement est créé
    v_expires := now() + make_interval(mins => v_hold);
    BEGIN
        UPDATE public.table_reservations
           SET booking_state = 'EN_ATTENTE_PAIEMENT', payment_status = 'PENDING', hold_expires_at = v_expires, updated_at = now()
         WHERE id = r.id;
    EXCEPTION WHEN exclusion_violation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN', 'message', 'Le délai pour payer est passé et la table a été réservée par quelqu’un d’autre.');
    END;

    v_amount := r.total_amount;

    v_agg_rate := public.fin_setting_num('finance.aggregator_fee_rate.' || v_operator);
    v_agg := public.fin_round_2(v_amount * v_agg_rate / 100);
    v_comm := public.fin_round_2(r.deposit_amount * COALESCE(r.commission_rate, 0) / 100);

    INSERT INTO public.payments (
        transaction_id, external_order_id, client_id, partner_id, table_reservation_id, payment_target, amount, currency,
        is_platform_payment, aggregator, facial_amount, aggregator_fee, service_fee, gross_event_village_revenue,
        net_event_village_revenue, partner_payout_amount, service_fee_rate, aggregator_fee_rate,
        payout_delay_hours, payout_hold_enabled, status, idempotency_key, held_expires_at,
        operator, payer_phone, callback_token_hash, metadata
    ) VALUES (
        p->>'transaction_id', p->>'external_order_id', v_client, r.partner_id, r.id, 'TABLE_RESERVATION', v_amount, 'XOF',
        TRUE, 'SAMIRPAY', r.deposit_amount, v_agg, r.service_fee_amount, r.service_fee_amount + v_comm,
        public.fin_round_2(r.service_fee_amount + v_comm - v_agg), r.deposit_amount - v_comm, r.service_fee_rate, v_agg_rate,
        public.fin_setting_num('finance.payout_delay_hours')::int, public.fin_setting_bool('finance.payout_hold_enabled'),
        'PENDING', 'IDEMP-' || (p->>'external_order_id'), v_expires,
        v_operator, NULLIF(p->>'payer_phone', ''), p->>'callback_token_hash',
        jsonb_build_object('target_type', 'TABLE_RESERVATION', 'target_id', r.id, 'reservation_id', r.id, 'part', 'ACOMPTE',
                           'commission_rate', COALESCE(r.commission_rate, 0), 'commission_amount', v_comm)
    )
    RETURNING id INTO v_payment;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_client, 'CLIENT', 'TABLE_PAYMENT_STARTED', 'table_reservations', r.id,
            jsonb_build_object('payment_id', v_payment, 'amount', v_amount));

    RETURN jsonb_build_object('ok', true, 'payment_id', v_payment, 'amount', v_amount,
                              'deposit_amount', r.deposit_amount, 'service_fee', r.service_fee_amount, 'venue_id', r.venue_id);
END;
$$;

REVOKE ALL ON FUNCTION public.table_payment_create(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.table_payment_create(jsonb) TO service_role;
