-- ============================================================================
-- EVENT VILLAGE — LOT 11a, migration 05 : payer l'acompte d'une réservation de table
-- ============================================================================
-- Trous T3 et C1 de l'état des lieux du 18/11 : le montant du paiement était lu sur la ligne écrite par la route
-- (5 000 F par personne en dur) et la confirmation passait la réservation « payée, confirmée » par un chemin générique
-- sans aucun contrôle ; un échec de paiement l'annulait.
--  1. table_payment_create(p) : paiement PENDING créé en base, montant relu sur la réservation (acompte + frais, figés
--     à la création ; jamais fourni par la requête) ; rien à payer pour une réservation sans acompte ; un paiement en
--     attente à la fois par réservation ; 3 paiements en attente au plus par numéro payeur et par heure (règle des
--     billets) ; une attente échue reprend la table si elle est encore libre ;
--  2. table_payment_confirm(paiement, source) : confirmation sous verrou ; confirmée (confirmation automatique) ou
--     demande à accepter sous tables.response_minutes (sans dépasser l'heure) ; un paiement qui ne peut plus être
--     honoré (table reprise, réservation annulée ou déjà payée, heure passée, montant différent) est remboursé en
--     entier, comme un panier de billets ; avis et journal ;
--  3. fin_payout_available_at : recopie de 20261122000004_l10a_paiement.sql:359-387 ; recettes d'un établissement disponibles après la fin du créneau
--     + délai (comme les billets et les salles) ;
--  4. calculate_referral_commissions : recopie de 20261122000004_l10a_paiement.sql:390-485 ; commission d'une table disponible après la fin du créneau
--     + délai.
--  5. table_hold_refusal(réservation) (contre-vérification de la 10a, T2) : à la création du paiement et à sa
--     confirmation, la réservation repasse tous les contrôles de table_reserve (établissement, partenaire, table,
--     capacité, heure, horaires, table libre) : une attente échue n'est jamais relancée sans eux, et un paiement
--     confirmé pour un établissement suspendu entre-temps est remboursé en entier.
-- Un échec du paiement ne touche pas la réservation : la table reste tenue jusqu'à la fin de l'attente (15 minutes).
-- Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- ============================================================================

-- Contre-vérification de la 10a (T2), équivalent côté tables : une réservation qui reprend ou garde sa table au
-- moment du paiement repasse TOUS les contrôles de table_reserve (établissement actif et validé, partenaire VALIDE,
-- table active de l'établissement et de la bonne capacité, heure à venir, horaires pour tout le créneau, table libre).
-- Rend NULL si tout va bien, sinon le refus (code et message en français simple).
CREATE OR REPLACE FUNCTION public.table_hold_refusal(p_reservation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r record;
    v record;
    t record;
BEGIN
    SELECT * INTO r FROM public.table_reservations WHERE id = p_reservation_id;
    IF NOT FOUND OR r.venue_id IS NULL THEN
        RETURN jsonb_build_object('code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    SELECT ve.*, pa.status::text AS partner_status INTO v
      FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id WHERE ve.id = r.venue_id;
    IF NOT v.is_active OR v.partner_status <> 'VALIDE'
       OR (v.validation_status <> 'VALIDEE'
           AND (public.fin_setting_bool('tables.validation_required') OR v.validation_status IN ('REFUSEE', 'SUSPENDUE'))) THEN
        RETURN jsonb_build_object('code', 'VENUE_NOT_AVAILABLE', 'message', 'Cet établissement n’accepte pas de réservation pour le moment.');
    END IF;
    SELECT * INTO t FROM public.restaurant_tables WHERE id = r.table_id AND venue_id = r.venue_id AND is_active;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('code', 'TABLE_NOT_FOUND', 'message', 'Cette table n’existe pas dans cet établissement.');
    END IF;
    IF r.guest_count > t.capacity OR r.guest_count < t.min_capacity THEN
        RETURN jsonb_build_object('code', 'TABLE_TOO_SMALL', 'message', format('Cette table accueille de %s à %s personnes.', t.min_capacity, t.capacity));
    END IF;
    IF lower(r.slot) <= public.hall_dakar_now() THEN
        RETURN jsonb_build_object('code', 'RESERVATION_NOT_ACTIVE', 'message', 'Cette réservation ne peut plus être payée.');
    END IF;
    IF NOT public.venue_open_covers(r.venue_id, r.slot) THEN
        RETURN jsonb_build_object('code', 'OUTSIDE_HOURS', 'message', 'L’établissement n’est pas ouvert à cette heure-là. Choisissez une autre heure.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.table_reservations o
                WHERE o.table_id = r.table_id AND o.id <> r.id AND o.status::text IN ('EN_ATTENTE', 'CONFIRMEE') AND o.slot && r.slot) THEN
        RETURN jsonb_build_object('code', 'SLOT_TAKEN', 'message', 'Le délai pour payer est passé et la table a été réservée par quelqu’un d’autre.');
    END IF;
    RETURN NULL;
END;
$$;

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
    v_expires := now() + make_interval(mins => v_hold);
    BEGIN
        UPDATE public.table_reservations
           SET booking_state = 'EN_ATTENTE_PAIEMENT', payment_status = 'PENDING', hold_expires_at = v_expires, updated_at = now()
         WHERE id = r.id;
    EXCEPTION WHEN exclusion_violation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN', 'message', 'Le délai pour payer est passé et la table a été réservée par quelqu’un d’autre.');
    END;

    v_amount := r.total_amount;

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

CREATE OR REPLACE FUNCTION public.table_payment_confirm(p_payment_id uuid, p_source text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay      record;
    r          record;
    v_venue    uuid;
    v_blocking text;
    v_cashout  uuid;
    v_state    text;
    v_due      timestamptz;
BEGIN
    SELECT table_reservation_id INTO v_pay FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('result', 'NOT_FOUND');
    END IF;
    IF v_pay.table_reservation_id IS NOT NULL THEN
        SELECT venue_id INTO v_venue FROM public.table_reservations WHERE id = v_pay.table_reservation_id;
        IF v_venue IS NOT NULL THEN
            PERFORM public.table_venue_lock(v_venue);
        END IF;
    END IF;
    SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF v_pay.status::text = 'SUCCESS' THEN
        RETURN jsonb_build_object('result', 'ALREADY_CONFIRMED');
    END IF;
    IF v_pay.status::text IN ('REFUND_PENDING', 'REFUNDED', 'PARTIAL') THEN
        RETURN jsonb_build_object('result', 'REFUND_IN_PROGRESS', 'status', v_pay.status::text);
    END IF;
    IF v_pay.payment_target::text <> 'TABLE_RESERVATION' OR v_pay.table_reservation_id IS NULL THEN
        RETURN jsonb_build_object('result', 'NOT_TABLE');
    END IF;
    IF v_pay.status::text NOT IN ('PENDING', 'EXPIRED', 'CANCELLED', 'FAILED') THEN
        RETURN jsonb_build_object('result', 'NOT_CONFIRMABLE', 'status', v_pay.status::text);
    END IF;
    SELECT * INTO r FROM public.table_reservations WHERE id = v_pay.table_reservation_id FOR UPDATE;

    IF r.venue_id IS NULL OR r.total_amount <> v_pay.amount THEN
        v_blocking := 'montant différent de celui de la réservation';
    ELSIF r.paid_amount > 0 OR r.booking_state NOT IN ('EN_ATTENTE_PAIEMENT', 'EXPIREE') THEN
        v_blocking := CASE WHEN r.paid_amount > 0 THEN 'réservation déjà payée' ELSE 'réservation annulée' END;
    ELSE
        -- Tous les contrôles refaits (établissement, partenaire, table, capacité, heure, horaires, table libre)
        v_blocking := public.table_hold_refusal(r.id)->>'message';
    END IF;

    IF v_blocking IS NOT NULL THEN
        UPDATE public.payments
           SET status = 'REFUND_PENDING', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(),
               confirmed_source = p_source, metadata = metadata || jsonb_build_object('refund_reason', v_blocking)
         WHERE id = p_payment_id;
        v_cashout := public.refund_request(p_payment_id, 'Paiement de table impossible à honorer : ' || v_blocking, 'REFUND');
        PERFORM public.table_notify('TABLE_PAYMENT_REFUNDED', r.id, 'CLIENT',
            jsonb_build_object('payment_id', p_payment_id, 'amount', v_pay.amount, 'operator', v_pay.operator::text));
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
        VALUES (NULL, 'SYSTEM', 'TABLE_PAYMENT_REFUNDED', 'table_reservations', r.id,
                jsonb_build_object('payment_id', p_payment_id, 'amount', v_pay.amount, 'reason', v_blocking, 'source', p_source));
        RETURN jsonb_build_object('result', 'REFUND_REQUIRED', 'reason', v_blocking, 'cashout_id', v_cashout);
    END IF;

    UPDATE public.payments
       SET status = 'SUCCESS', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(), confirmed_source = p_source
     WHERE id = p_payment_id;

    IF r.confirmation_mode = 'MANUELLE' THEN
        v_state := 'EN_ATTENTE_ACCEPTATION';
        v_due := LEAST(now() + make_interval(mins => public.fin_setting_num('tables.response_minutes')::int),
                       lower(r.slot) AT TIME ZONE 'Africa/Dakar');
    ELSE
        v_state := 'CONFIRMEE';
    END IF;
    PERFORM set_config('event_village.table_booking', 'on', true);
    UPDATE public.table_reservations
       SET paid_amount = v_pay.amount, booking_state = v_state, payment_status = 'SUCCESS', is_platform_payment = TRUE,
           hold_expires_at = NULL, response_due_at = v_due,
           confirmed_at = CASE WHEN v_state = 'CONFIRMEE' THEN now() END, updated_at = now()
     WHERE id = r.id;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (NULL, 'SYSTEM', 'TABLE_PAYMENT_CONFIRMED', 'table_reservations', r.id,
            jsonb_build_object('booking_state', r.booking_state, 'paid_amount', r.paid_amount),
            jsonb_build_object('booking_state', v_state, 'paid_amount', v_pay.amount),
            jsonb_build_object('payment_id', p_payment_id, 'amount', v_pay.amount, 'source', p_source));

    IF v_state = 'CONFIRMEE' THEN
        PERFORM public.table_notify('TABLE_RESERVATION_CONFIRMED', r.id, 'CLIENT');
        PERFORM public.table_notify('TABLE_NEW_RESERVATION', r.id, 'OWNER');
    ELSE
        PERFORM public.table_notify('TABLE_REQUEST_SENT', r.id, 'CLIENT');
        PERFORM public.table_notify('TABLE_REQUEST_TO_ANSWER', r.id, 'OWNER');
    END IF;
    RETURN jsonb_build_object('result', 'CONFIRMED', 'reservation_id', r.id, 'booking_state', v_state, 'paid_amount', v_pay.amount);
END;
$$;

REVOKE ALL ON FUNCTION public.table_hold_refusal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.table_hold_refusal(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.table_payment_create(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_payment_confirm(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.table_payment_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_payment_confirm(uuid, text) TO service_role;


-- Recopie de 20261122000004_l10a_paiement.sql:359-387 ; changement : branche TABLE_RESERVATION (fin du créneau).
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
    SELECT id, payment_target::text AS payment_target, event_id, paid_at, payout_hold_enabled, payout_delay_hours, hall_reservation_id,
           table_reservation_id
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
    ELSIF p.payment_target = 'TABLE_RESERVATION' AND p.table_reservation_id IS NOT NULL THEN
        -- Lot 11a : recettes d'un établissement disponibles après la fin du créneau + délai
        SELECT upper(r.slot) AT TIME ZONE 'Africa/Dakar' INTO v_end FROM public.table_reservations r WHERE r.id = p.table_reservation_id;
    END IF;
    RETURN COALESCE(v_end, p.paid_at, now()) + make_interval(hours => v_delay);
END;
$$;

-- Recopie de 20261122000004_l10a_paiement.sql:390-485 ; changement : branche TABLE_RESERVATION (fin du créneau).
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
    ELSIF v_payment.payment_target::text = 'TABLE_RESERVATION' AND v_payment.table_reservation_id IS NOT NULL THEN
        -- Lot 11a (§82) : commission d'une réservation de table disponible après la fin du créneau + délai réglé
        v_available := GREATEST(now(), COALESCE((SELECT upper(r.slot) AT TIME ZONE 'Africa/Dakar' FROM public.table_reservations r
                                                  WHERE r.id = v_payment.table_reservation_id), now()))
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
