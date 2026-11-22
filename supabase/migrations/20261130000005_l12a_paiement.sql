-- ============================================================================
-- EVENT VILLAGE — LOT 12a, migration 05 : payer une commande (création et confirmation en base, idempotentes)
-- ============================================================================
-- Trous de l'existant (rapport § 1) : le montant du paiement était lu sur la commande écrite par la route ; la
-- confirmation passait la commande « payée, confirmée » par un chemin générique (lib/payments/confirmation.service.ts),
-- sans verrou ni contrôle ; l'échec d'un paiement annulait la commande.
--  1. order_payable_refusal(commande) : établissement actif, validé, ouvert à la vente, partenaire VALIDE, aucun
--     produit devenu réglementé ; NULL si tout va bien ;
--  2. order_expire_hold(commande) : attente de paiement échue : commande close (« Non payée à temps »), stock et
--     portions rendus, avis au client ; sous le verrou de l'établissement ;
--  3. order_payment_create(p) : paiement PENDING créé en base, montant relu sur la commande (part payée au départ +
--     frais, ou solde + frais ; jamais fourni par la requête) ; un paiement en attente à la fois par commande ; 3 au
--     plus par numéro payeur et par heure (règle des billets) ; une attente échue n'est jamais relancée (commande
--     close : le client la refait, les produits ont été rendus) ;
--  4. order_payment_confirm(paiement, source) : sous le verrou de l'établissement puis du paiement ; une seule fois
--     (deuxième confirmation : ALREADY_CONFIRMED, aucun effet) ; un paiement qui ne peut plus être honoré (commande
--     close ou déjà payée, montant différent, établissement fermé, produit devenu réglementé) est remboursé en entier ;
--     la part payée au départ fait passer la commande à « Reçue » (réponse de la partenaire sous orders.response_minutes) ;
--  5. fin_payout_available_at : recopie de 20261123000105_l11a_paiement.sql:313-345 ; recettes d'une commande disponibles après l'heure
--     prévue de la remise + délai réglé ;
--  6. calculate_referral_commissions : recopie de 20261123000105_l11a_paiement.sql:348-448 ; commission de parrainage d'une commande
--     disponible après l'heure prévue de la remise + délai réglé.
-- Un échec du paiement ne touche pas la commande : ses produits restent tenus jusqu'à la fin de l'attente.
-- Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.order_payable_refusal(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v record;
    v_name text;
BEGIN
    SELECT ve.is_active, ve.validation_status, ve.orders_open, pa.status::text AS partner_status INTO v
      FROM public.orders o JOIN public.venues ve ON ve.id = o.venue_id JOIN public.partners pa ON pa.id = ve.partner_id
     WHERE o.id = p_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    IF NOT v.is_active OR v.validation_status <> 'VALIDEE' OR NOT v.orders_open OR v.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('code', 'VENUE_NOT_AVAILABLE', 'message', 'Cet établissement ne prend plus de commande pour le moment.');
    END IF;
    SELECT i.product_name INTO v_name FROM public.order_items i
     WHERE i.order_id = p_order_id AND public.product_regulated(i.product_id) LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object('code', 'REGULATED_PRODUCT',
            'message', format('« %s » est un produit réglementé : il ne se commande pas en ligne.', v_name));
    END IF;
    RETURN NULL;
END;
$$;

-- Contre-vérification (T2) : contrôle d'une commande EN COURS, au paiement du solde (création et confirmation), à
-- l'acceptation et à la remise : fiche de la partenaire suspendue, ou produit devenu réglementé. L'établissement fermé
-- aux nouvelles commandes (orders_open) n'empêche pas de finir une commande déjà acceptée.
CREATE OR REPLACE FUNCTION private.order_ongoing_refusal(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status text;
    v_name   text;
BEGIN
    SELECT pa.status::text INTO v_status FROM public.orders o JOIN public.partners pa ON pa.id = o.partner_id WHERE o.id = p_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    IF v_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('code', 'VENUE_NOT_AVAILABLE', 'message', 'Cet établissement ne prend plus de paiement pour le moment.');
    END IF;
    SELECT i.product_name INTO v_name FROM public.order_items i
     WHERE i.order_id = p_order_id AND public.product_regulated(i.product_id) LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object('code', 'REGULATED_PRODUCT',
            'message', format('« %s » est un produit réglementé : il ne se commande pas en ligne.', v_name));
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.order_ongoing_refusal(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.order_expire_hold(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    o record;
BEGIN
    SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND OR o.order_state <> 'EN_ATTENTE_PAIEMENT' OR o.hold_expires_at > now() OR o.paid_goods > 0 THEN
        RETURN FALSE;
    END IF;
    PERFORM set_config('event_village.order_flow', 'on', true);
    UPDATE public.orders
       SET order_state = 'EXPIREE', payment_status = 'CANCELLED', hold_expires_at = NULL, closed_at = now(), updated_at = now(),
           -- Contre-vérification (T1) : jamais transmise à la partenaire, coordonnées masquées tout de suite
           delivery_address = NULL, contact_phone = NULL, delivery_notes = NULL, delivery_latitude = NULL,
           delivery_longitude = NULL, contact_masked_at = COALESCE(contact_masked_at, now())
     WHERE id = o.id;
    PERFORM private.order_release_stock(o.id);
    PERFORM private.order_log_state(o.id, o.order_state, 'EXPIREE', NULL, 'SYSTEM', 'Non payée à temps');
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (NULL, 'SYSTEM', 'ORDER_HOLD_EXPIRED', 'orders', o.id,
            jsonb_build_object('order_state', o.order_state), jsonb_build_object('order_state', 'EXPIREE'));
    PERFORM public.order_notify('ORDER_CANCELLED', o.id, 'CLIENT', jsonb_build_object('origin', 'EXPIREE', 'refund_amount', 0));
    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.order_payment_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client   uuid := public.try_uuid(p->>'client_id');
    v_order_id uuid := public.try_uuid(p->>'order_id');
    v_part     text := upper(COALESCE(NULLIF(p->>'part', ''), 'PREMIER'));
    v_operator text := NULLIF(p->>'operator', '');
    r          record;
    v_pending  uuid;
    v_payer_pending integer;
    v_goods    numeric;
    v_fee      numeric;
    v_amount   numeric;
    v_agg_rate numeric;
    v_agg      numeric;
    v_comm     numeric;
    v_payment  uuid;
    v_expires  timestamptz;
    v_refusal  jsonb;
BEGIN
    IF NOT public.fin_setting_bool('features.orders_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SERVICE_CLOSED', 'message', 'Les commandes ne sont pas encore ouvertes.');
    END IF;
    IF v_part NOT IN ('PREMIER', 'SOLDE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PART', 'message', 'Choisissez de payer la commande ou son solde.');
    END IF;
    IF v_operator IS NULL OR v_operator NOT IN ('WAVE', 'ORANGE_MONEY') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'OPERATOR_REQUIRED', 'message', 'Choisissez Wave ou Orange Money.');
    END IF;
    IF v_client IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_client AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte ne permet pas de payer pour le moment.');
    END IF;
    SELECT venue_id INTO r FROM public.orders WHERE id = v_order_id AND client_id = v_client;
    IF v_order_id IS NULL OR NOT FOUND OR r.venue_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    PERFORM public.order_venue_lock(r.venue_id);
    SELECT * INTO r FROM public.orders WHERE id = v_order_id FOR UPDATE;

    SELECT id INTO v_pending FROM public.payments
     WHERE order_id = v_order_id AND status::text = 'PENDING' AND created_at > now() - interval '60 minutes'
     ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PAYMENT_PENDING', 'payment_id', v_pending,
            'message', 'Un paiement est déjà en cours pour cette commande. Terminez-le ou attendez quelques minutes.');
    END IF;

    IF v_part = 'PREMIER' THEN
        IF r.paid_goods > 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_PAID', 'message', 'Cette commande est déjà payée.');
        END IF;
        IF r.first_goods + r.first_fee <= 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NOTHING_TO_PAY', 'message', 'Cette commande se paie à la remise : rien à payer maintenant.');
        END IF;
        IF r.order_state = 'EN_ATTENTE_PAIEMENT' AND r.hold_expires_at <= now() THEN
            PERFORM public.order_expire_hold(r.id);
            RETURN jsonb_build_object('ok', false, 'code', 'ORDER_EXPIRED', 'message', 'Le délai pour payer est passé : refaites la commande.');
        END IF;
        IF r.order_state <> 'EN_ATTENTE_PAIEMENT' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_PAYABLE', 'message', 'Cette commande ne peut plus être payée.');
        END IF;
        v_refusal := public.order_payable_refusal(r.id);
        IF v_refusal IS NOT NULL THEN
            RETURN jsonb_build_object('ok', false) || v_refusal;
        END IF;
        v_goods := r.first_goods;
        v_fee := r.first_fee;
        v_expires := r.hold_expires_at;
    ELSE
        IF r.order_state NOT IN ('ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'BALANCE_NOT_PAYABLE',
                'message', 'Le solde se paie une fois la commande acceptée, jusqu’à sa remise.');
        END IF;
        IF r.onsite_amount IS NOT NULL OR r.goods_total - r.paid_goods <= 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_PAID', 'message', 'Cette commande est déjà payée.');
        END IF;
        v_refusal := private.order_ongoing_refusal(r.id);
        IF v_refusal IS NOT NULL THEN
            RETURN jsonb_build_object('ok', false) || v_refusal;
        END IF;
        v_goods := r.goods_total - r.paid_goods;
        v_fee := public.fin_round_up(v_goods * COALESCE(r.service_fee_rate, public.fin_setting_num('orders.service_fee_rate')) / 100);
        v_expires := now() + make_interval(mins => public.fin_setting_num('orders.hold_minutes')::int);
    END IF;
    v_amount := v_goods + v_fee;

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
    v_comm := public.fin_round_2(v_goods * COALESCE(r.commission_rate, 0) / 100);

    INSERT INTO public.payments (
        transaction_id, external_order_id, client_id, partner_id, order_id, payment_target, amount, currency,
        is_platform_payment, aggregator, facial_amount, aggregator_fee, service_fee, gross_event_village_revenue,
        net_event_village_revenue, partner_payout_amount, service_fee_rate, aggregator_fee_rate,
        payout_delay_hours, payout_hold_enabled, status, idempotency_key, held_expires_at,
        operator, payer_phone, callback_token_hash, metadata
    ) VALUES (
        p->>'transaction_id', p->>'external_order_id', v_client, r.partner_id, r.id, 'ORDER', v_amount, 'XOF',
        TRUE, 'SAMIRPAY', v_goods, v_agg, v_fee, v_fee + v_comm,
        public.fin_round_2(v_fee + v_comm - v_agg), v_goods - v_comm, COALESCE(r.service_fee_rate, 0), v_agg_rate,
        public.fin_setting_num('finance.payout_delay_hours')::int, public.fin_setting_bool('finance.payout_hold_enabled'),
        'PENDING', 'IDEMP-' || (p->>'external_order_id'), v_expires,
        v_operator, NULLIF(p->>'payer_phone', ''), p->>'callback_token_hash',
        jsonb_build_object('target_type', 'ORDER', 'target_id', r.id, 'order_id', r.id, 'part', v_part,
                           'commission_rate', COALESCE(r.commission_rate, 0), 'commission_amount', v_comm)
    )
    RETURNING id INTO v_payment;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_client, 'CLIENT', 'ORDER_PAYMENT_STARTED', 'orders', r.id,
            jsonb_build_object('payment_id', v_payment, 'amount', v_amount, 'part', v_part));

    RETURN jsonb_build_object('ok', true, 'payment_id', v_payment, 'amount', v_amount, 'goods_amount', v_goods,
                              'service_fee', v_fee, 'part', v_part, 'order_id', r.id, 'order_number', r.order_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.order_payment_confirm(p_payment_id uuid, p_source text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay      record;
    o          record;
    v_venue    uuid;
    v_part     text;
    v_blocking text;
    v_cashout  uuid;
    v_goods    numeric;
    v_due      timestamptz;
BEGIN
    SELECT order_id INTO v_pay FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('result', 'NOT_FOUND');
    END IF;
    IF v_pay.order_id IS NOT NULL THEN
        SELECT venue_id INTO v_venue FROM public.orders WHERE id = v_pay.order_id;
        IF v_venue IS NOT NULL THEN
            PERFORM public.order_venue_lock(v_venue);
        END IF;
    END IF;
    SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF v_pay.status::text = 'SUCCESS' THEN
        RETURN jsonb_build_object('result', 'ALREADY_CONFIRMED');
    END IF;
    IF v_pay.status::text IN ('REFUND_PENDING', 'REFUNDED', 'PARTIAL') THEN
        RETURN jsonb_build_object('result', 'REFUND_IN_PROGRESS', 'status', v_pay.status::text);
    END IF;
    IF v_pay.payment_target::text <> 'ORDER' OR v_pay.order_id IS NULL THEN
        RETURN jsonb_build_object('result', 'NOT_ORDER');
    END IF;
    IF v_pay.status::text NOT IN ('PENDING', 'EXPIRED', 'CANCELLED', 'FAILED') THEN
        RETURN jsonb_build_object('result', 'NOT_CONFIRMABLE', 'status', v_pay.status::text);
    END IF;
    SELECT * INTO o FROM public.orders WHERE id = v_pay.order_id FOR UPDATE;
    v_part := COALESCE(v_pay.metadata->>'part', 'PREMIER');
    v_goods := COALESCE(v_pay.facial_amount, 0);

    IF o.venue_id IS NULL THEN
        v_blocking := 'commande de l’ancien service, close';
    ELSIF v_part = 'PREMIER' THEN
        IF o.paid_goods > 0 THEN
            v_blocking := 'commande déjà payée';
        ELSIF o.order_state <> 'EN_ATTENTE_PAIEMENT' THEN
            v_blocking := CASE WHEN o.order_state = 'EXPIREE' THEN 'délai de paiement dépassé' ELSE 'commande annulée' END;
        ELSIF v_pay.amount <> o.first_goods + o.first_fee OR v_goods <> o.first_goods THEN
            v_blocking := 'montant différent de celui de la commande';
        ELSE
            v_blocking := public.order_payable_refusal(o.id)->>'message';
        END IF;
    ELSE
        IF o.order_state NOT IN ('ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE') THEN
            v_blocking := 'commande close';
        ELSIF o.onsite_amount IS NOT NULL OR o.goods_total - o.paid_goods <= 0 THEN
            v_blocking := 'solde déjà payé';
        ELSIF v_goods <> o.goods_total - o.paid_goods OR v_pay.amount <> v_goods + COALESCE(v_pay.service_fee, 0) THEN
            v_blocking := 'montant différent du solde';
        ELSE
            -- Contre-vérification (T2) : comme la première part, fiche suspendue ou produit devenu réglementé
            v_blocking := private.order_ongoing_refusal(o.id)->>'message';
        END IF;
    END IF;

    IF v_blocking IS NOT NULL THEN
        UPDATE public.payments
           SET status = 'REFUND_PENDING', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(),
               confirmed_source = p_source, metadata = metadata || jsonb_build_object('refund_reason', v_blocking)
         WHERE id = p_payment_id;
        v_cashout := public.refund_request(p_payment_id, 'Paiement de commande impossible à honorer : ' || v_blocking, 'REFUND');
        IF o.venue_id IS NOT NULL THEN
            PERFORM public.order_notify('ORDER_PAYMENT_REFUNDED', o.id, 'CLIENT',
                jsonb_build_object('payment_id', p_payment_id, 'amount', v_pay.amount, 'operator', v_pay.operator::text), p_payment_id::text);
        END IF;
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
        VALUES (NULL, 'SYSTEM', 'ORDER_PAYMENT_REFUNDED', 'orders', o.id,
                jsonb_build_object('payment_id', p_payment_id, 'amount', v_pay.amount, 'reason', v_blocking, 'source', p_source));
        RETURN jsonb_build_object('result', 'REFUND_REQUIRED', 'reason', v_blocking, 'cashout_id', v_cashout);
    END IF;

    UPDATE public.payments
       SET status = 'SUCCESS', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(), confirmed_source = p_source
     WHERE id = p_payment_id;

    PERFORM set_config('event_village.order_flow', 'on', true);
    IF v_part = 'PREMIER' THEN
        v_due := now() + make_interval(mins => public.fin_setting_num('orders.response_minutes')::int);
        UPDATE public.orders
           SET paid_goods = paid_goods + v_goods, paid_fees = paid_fees + COALESCE(v_pay.service_fee, 0),
               paid_amount = paid_goods + v_goods + paid_fees + COALESCE(v_pay.service_fee, 0),
               balance_amount = goods_total - (paid_goods + v_goods),
               payment_status = CASE WHEN goods_total - (paid_goods + v_goods) = 0 THEN 'SUCCESS' ELSE 'PARTIAL' END::public.payment_status_enum,
               order_state = 'RECUE', received_at = now(), response_due_at = v_due, hold_expires_at = NULL, updated_at = now()
         WHERE id = o.id;
        PERFORM private.order_log_state(o.id, o.order_state, 'RECUE', NULL, 'SYSTEM', 'Paiement reçu');
    ELSE
        UPDATE public.orders
           SET paid_goods = paid_goods + v_goods, paid_fees = paid_fees + COALESCE(v_pay.service_fee, 0),
               paid_amount = paid_goods + v_goods + paid_fees + COALESCE(v_pay.service_fee, 0),
               balance_amount = goods_total - (paid_goods + v_goods),
               payment_status = 'SUCCESS', updated_at = now()
         WHERE id = o.id;
    END IF;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (NULL, 'SYSTEM', 'ORDER_PAYMENT_CONFIRMED', 'orders', o.id,
            jsonb_build_object('order_state', o.order_state, 'paid_goods', o.paid_goods),
            jsonb_build_object('order_state', CASE WHEN v_part = 'PREMIER' THEN 'RECUE' ELSE o.order_state END, 'paid_goods', o.paid_goods + v_goods),
            jsonb_build_object('payment_id', p_payment_id, 'amount', v_pay.amount, 'part', v_part, 'source', p_source));

    IF v_part = 'PREMIER' THEN
        PERFORM public.order_notify('ORDER_RECEIVED', o.id, 'CLIENT');
        PERFORM public.order_notify('ORDER_NEW', o.id, 'OWNER');
    END IF;
    RETURN jsonb_build_object('result', 'CONFIRMED', 'order_id', o.id, 'part', v_part,
                              'order_state', CASE WHEN v_part = 'PREMIER' THEN 'RECUE' ELSE o.order_state END,
                              'paid_goods', o.paid_goods + v_goods);
END;
$$;

REVOKE ALL ON FUNCTION public.order_payable_refusal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_expire_hold(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_payment_create(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_payment_confirm(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_payable_refusal(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_expire_hold(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_payment_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_payment_confirm(uuid, text) TO service_role;


-- Recopie de 20261123000105_l11a_paiement.sql:313-345 ; changement : branche ORDER (heure prévue de la remise).
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
           table_reservation_id, order_id
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
    ELSIF p.payment_target = 'ORDER' AND p.order_id IS NOT NULL THEN
        -- Lot 12a : recettes d'une commande disponibles après l'heure prévue de la remise + délai (comme les billets
        -- après la fin de l'événement) ; une commande de billets (sans établissement) garde la règle d'origine
        SELECT o.scheduled_for INTO v_end FROM public.orders o WHERE o.id = p.order_id AND o.venue_id IS NOT NULL;
    END IF;
    RETURN COALESCE(v_end, p.paid_at, now()) + make_interval(hours => v_delay);
END;
$$;


-- Recopie de 20261123000105_l11a_paiement.sql:348-448 ; changement : branche ORDER (heure prévue de la remise).
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
    ELSIF v_payment.payment_target::text = 'ORDER' AND v_payment.order_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = v_payment.order_id AND o.venue_id IS NOT NULL) THEN
        -- Lot 12a : commission d'une commande disponible après l'heure prévue de la remise + délai réglé
        v_available := GREATEST(now(), COALESCE((SELECT o.scheduled_for FROM public.orders o WHERE o.id = v_payment.order_id), now()))
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

