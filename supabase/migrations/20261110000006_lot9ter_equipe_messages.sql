-- ============================================================================
-- EVENT VILLAGE — LOT 9 TER : équipe et messages (contrat 3.1 n° 06, 3.4 F11 à F16, B.2.2 ; S-M, vague S2)
-- ============================================================================
-- Rejouable : aucun BEGIN ni COMMIT ; CREATE OR REPLACE, privilèges réappliqués. Le registre des types émis ici est
-- posé par 20261110000004_lot9ter_registre.sql (avant tout émetteur, K3).
-- Tâches fusionnées, dans l'ordre de leurs commits (section 10) :
--  9t.2 (consigne 0.2, fix(9t.2)) — détenteur actuel d'un billet transféré prévenu du remboursement :
--   6. ticket_refund_request (recopie F15, base 20261109000006_lot9bis_argent.sql:945-1188) : hors annulation de
--      l'événement, un billet remboursé à l'acheteur d'origine (CASHOUT) ou par l'organisateur (ORGANISATEUR) dont le
--      porteur actuel n'est pas le payeur et qui a un transfert CLAIMED avec expéditeur (règle R13) met en file
--      TICKET_REFUNDED_HOLDER au porteur (clé TICKET_REFUNDED_HOLDER:<billet>, données ticket_id et category) ; le
--      porteur d'un billet payé en espèces reçoit ce texte à la place de TICKET_CANCELLED CASH (B-D2). Verrous,
--      refus, codes, audit TICKET_REFUND_REQUESTED, montants, retours et rejeu « already » inchangés.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 6. ticket_refund_request (recopie F15, base 20261109000006_lot9bis_argent.sql:945-1188) — tâche 9t.2.
--    Changements, et seulement eux : DECLARE + v_payer, v_holder_notice, v_cat_name ; décision v_holder_notice juste
--    avant le journal (lecture sans verrou des transferts CLAIMED, lignes terminales ; p lu seulement si le billet a
--    un paiement, aucun record non assigné) ; bloc R22 sauté quand v_holder_notice ; bloc TICKET_REFUNDED_HOLDER
--    juste après le bloc R22, avant la branche AUCUN.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_refund_request(p_ticket_id uuid, p_actor uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key text := 'REFUND-TKT-' || p_ticket_id::text;
    v_payment_id uuid;
    v_category uuid;
    p record;
    t record;
    v_ref record;
    v_user record;
    v_blocked text;
    v_refund uuid;
    v_cashout uuid;
    v_share numeric;
    v_prev_amount numeric;
    v_prev_agg numeric;
    v_agg_share numeric;
    v_bearer text;
    v_apply jsonb;
    v_platform boolean;
    v_ev record;
    v_is_owner boolean;
    v_is_staff boolean;
    v_is_holder boolean;
    v_active boolean;
    v_as text;
    v_ctx text;
    v_mode text;
    v_amount numeric;
    v_tr record;
    v_data jsonb;
    v_target uuid;
    v_inv_phone text;
    v_payer uuid;
    v_holder_notice boolean := FALSE;
    v_cat_name text;
BEGIN
    SELECT payment_id, category_id INTO v_payment_id, v_category FROM public.tickets WHERE id = p_ticket_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_FOUND', 'message', 'Billet introuvable.');
    END IF;
    IF v_payment_id IS NOT NULL THEN
        SELECT * INTO p FROM public.payments WHERE id = v_payment_id FOR UPDATE;
    END IF;
    PERFORM 1 FROM public.ticket_categories WHERE id = v_category FOR NO KEY UPDATE;
    -- Lot 9 bis (R61, 3.3) : transferts en attente du billet avant le billet (ordre de ticket_transfer_accept)
    PERFORM 1 FROM public.ticket_transfers x
     WHERE x.ticket_id = p_ticket_id AND x.status::text = 'PENDING'
     ORDER BY x.id
       FOR UPDATE OF x;
    SELECT * INTO t FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    -- Lot 9 bis (R11, B21) : qui agit, sur quel événement (lecture sans verrou, comme event_transition)
    SELECT e.id, e.status::text AS status, pa.user_id AS owner_id INTO v_ev
      FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = t.event_id;
    v_is_owner := p_actor IS NOT NULL AND v_ev.owner_id IS NOT DISTINCT FROM p_actor;
    v_is_staff := p_actor IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles r
                                                   WHERE r.user_id = p_actor AND r.role::text IN ('ADMIN', 'SUPERADMIN'));
    v_is_holder := p_actor IS NOT NULL AND t.user_id IS NOT DISTINCT FROM p_actor;
    v_active := EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_actor AND u.status::text = 'ACTIF');

    SELECT * INTO v_ref FROM public.refunds WHERE refund_transaction_id = v_key;
    IF FOUND AND (v_is_owner OR v_is_staff OR v_is_holder) THEN
        RETURN jsonb_build_object('ok', true, 'already', true,
            'mode', CASE WHEN v_ref.settlement = 'ORGANISATEUR' THEN 'ORGANISATEUR' ELSE 'CASHOUT' END,
            'refund_id', v_ref.id, 'cashout_id', v_ref.cashout_id, 'amount', v_ref.amount);
    END IF;

    IF v_ev.status = 'ANNULE' THEN
        -- Contexte d'annulation (event_cancel) : aucune règle de date, l'acteur a été contrôlé par event_cancel
        v_ctx := 'CANCELLATION';
        v_as := CASE WHEN v_is_owner THEN 'OWNER' WHEN v_is_staff THEN 'ADMIN' END;
    ELSIF NOT v_active THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    ELSIF public.admin_can(p_actor, 'refunds.manage') THEN
        v_ctx := 'DIRECT';
        v_as := 'ADMIN';
    ELSIF v_is_owner THEN
        IF now() > public.event_end_at(v_ev.id) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'REFUND_CLOSED_AFTER_EVENT',
                'message', 'L’événement est terminé : seul Event Village peut encore rembourser ce billet. Contactez le support.');
        END IF;
        v_ctx := 'DIRECT';
        v_as := 'OWNER';
    ELSIF v_is_holder THEN
        -- Lot 9 bis (R32, B23) : le porteur, seulement quand un report de plus de 24 h lui ouvre le droit
        IF NOT public.ticket_postponement_refund_open(t.id) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'POSTPONEMENT_REFUND_CLOSED',
                'message', 'Ce billet n’ouvre pas de remboursement : l’événement n’a pas été reporté de plus de 24 h, ou il a commencé.');
        END IF;
        v_ctx := 'POSTPONEMENT';
        v_as := 'HOLDER';
    END IF;
    IF v_as IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN',
                                  'message', 'Remboursement réservé à l’organisateur ou à un administrateur habilité.');
    END IF;

    IF t.status::text <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_REFUNDABLE', 'status', t.status::text,
                                  'message', format('Billet %s : remboursement impossible.', t.status));
    END IF;

    -- Branche du billet et refus du paiement, décidés avant toute écriture
    IF v_payment_id IS NOT NULL THEN
        v_platform := p.is_platform_payment;
    END IF;
    IF COALESCE(t.price, 0) = 0 THEN
        -- Billet gratuit ou invitation : annulé, rien à rembourser
        v_mode := 'AUCUN';
        v_amount := 0;
    ELSIF NOT COALESCE(v_platform, FALSE) THEN
        -- Billet payé hors plateforme (espèces) : à rembourser par l'organisateur, aucun cashout
        v_mode := 'ORGANISATEUR';
        v_amount := t.price;
    ELSE
        IF p.status::text NOT IN ('SUCCESS', 'PARTIAL') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PAYMENT_NOT_REFUNDABLE', 'status', p.status::text,
                                      'message', 'Le paiement de ce billet ne peut pas être remboursé.');
        END IF;
        -- Part du paiement correspondant au billet, jamais au-delà du reste à rembourser
        SELECT COALESCE(sum(amount), 0), COALESCE(sum(aggregator_fee_share), 0) INTO v_prev_amount, v_prev_agg
          FROM public.refunds WHERE payment_id = p.id AND settlement = 'PLATEFORME';
        v_share := LEAST(t.price + t.service_fee, p.amount - v_prev_amount);
        IF v_share <= 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_REFUNDED', 'message', 'Ce paiement est déjà entièrement remboursé.');
        END IF;
        v_mode := 'CASHOUT';
        v_amount := v_share;
    END IF;

    -- Lot 9 ter (9t.2, consigne 0.2, B-D4) : porteur actuel d'un billet transféré et accepté (transfert CLAIMED avec
    -- expéditeur), qui n'est pas le payeur (règle R13), d'un billet remboursé à l'acheteur d'origine ou par
    -- l'organisateur, hors annulation de l'événement (les porteurs y reçoivent EVENT_CANCELLED). Lecture des transferts
    -- CLAIMED sans verrou (lignes terminales) ; p n'est lu que si le billet a un paiement.
    IF v_payment_id IS NOT NULL THEN
        v_payer := p.client_id;
    END IF;
    v_holder_notice := v_ctx <> 'CANCELLATION' AND v_mode IN ('CASHOUT', 'ORGANISATEUR')
        AND t.user_id IS NOT NULL AND t.user_id IS DISTINCT FROM v_payer
        AND EXISTS (SELECT 1 FROM public.ticket_transfers x
                     WHERE x.ticket_id = t.id AND x.status::text = 'CLAIMED' AND x.from_user_id IS NOT NULL);

    -- Lot 9 bis (B45, contrat 6.3) : journal dans la transaction ; un échec du journal annule le remboursement
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (p_actor, CASE v_as WHEN 'OWNER' THEN 'PARTENAIRE' WHEN 'ADMIN' THEN 'ADMIN' ELSE 'CLIENT' END,
            'TICKET_REFUND_REQUESTED', 'tickets', t.id,
            jsonb_build_object('as', v_as, 'context', v_ctx, 'reason', COALESCE(p_reason, 'Remboursement'),
                               'mode', v_mode, 'amount', v_amount, 'event_id', t.event_id, 'payment_id', v_payment_id));

    -- Lot 9 bis (R61, B24, B53) : le transfert en attente est annulé dans la même transaction, le billet déverrouillé ;
    -- le destinataire d'un vrai transfert (avec expéditeur) est prévenu (TRANSFER_REVOKED : SMS au numéro, in-app,
    -- push et email au compte vérifié de ce numéro). event_cancel a déjà révoqué les siens (contexte d'annulation).
    FOR v_tr IN
        UPDATE public.ticket_transfers x
           SET status = 'CANCELLED', cancelled_at = now()
         WHERE x.ticket_id = t.id AND x.status::text = 'PENDING'
        RETURNING x.id, x.from_user_id, x.to_phone_or_email
    LOOP
        IF v_ctx <> 'CANCELLATION' AND v_tr.from_user_id IS NOT NULL AND v_tr.to_phone_or_email ~ '^\+221[0-9]{9}$' THEN
            v_data := COALESCE(public.notif_event_data(t.event_id), '{}'::jsonb)
                      || jsonb_build_object('transfer_id', v_tr.id, 'ticket_id', t.id);
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'TRANSFER_REVOKED', 'key', 'TRANSFER_REVOKED:' || v_tr.id::text,
                'phone', v_tr.to_phone_or_email, 'actor_id', p_actor, 'event_id', t.event_id,
                'data', v_data, 'channels', jsonb_build_array('SMS')));
            SELECT u.id INTO v_target
              FROM public.users u
             WHERE u.phone = v_tr.to_phone_or_email AND u.id IS DISTINCT FROM v_tr.from_user_id
               AND public.ticket_transfer_identity(v_tr.to_phone_or_email, u.id) = 'MATCH'
             ORDER BY u.id
             LIMIT 1;
            IF v_target IS NOT NULL THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'TRANSFER_REVOKED', 'key', 'TRANSFER_REVOKED:' || v_tr.id::text,
                    'user_id', v_target, 'actor_id', p_actor, 'event_id', t.event_id,
                    'data', v_data, 'channels', jsonb_build_array('IN_APP', 'PUSH', 'EMAIL')));
            END IF;
        END IF;
        -- Invitation encore à réclamer (aucun expéditeur) : son numéro reçoit TICKET_CANCELLED ci-dessous (R22)
        IF v_tr.from_user_id IS NULL AND v_tr.to_phone_or_email ~ '^\+221[0-9]{9}$' THEN
            v_inv_phone := v_tr.to_phone_or_email;
        END IF;
    END LOOP;
    IF t.transfer_locked THEN
        UPDATE public.tickets SET transfer_locked = FALSE, updated_at = now() WHERE id = t.id;
    END IF;

    -- Lot 9 bis (R22, B73, N18) : billet gratuit, invitation ou payé en espèces annulé hors annulation de
    -- l'événement → TICKET_CANCELLED au porteur (in-app, SMS, email du registre) ou au numéro de l'invitation
    -- non réclamée (SMS) ; en contexte d'annulation, les porteurs ont EVENT_CANCELLED (trigger, M09).
    -- Lot 9 ter (9t.2, B-D2) : sauf quand le porteur actuel reçoit TICKET_REFUNDED_HOLDER (billet en espèces transféré).
    IF v_ctx <> 'CANCELLATION' AND v_mode IN ('AUCUN', 'ORGANISATEUR') AND (t.user_id IS NOT NULL OR v_inv_phone IS NOT NULL) AND NOT v_holder_notice THEN
        v_data := COALESCE(public.notif_event_data(t.event_id), '{}'::jsonb)
                  || jsonb_build_object('ticket_id', t.id,
                                        'kind', CASE WHEN v_mode = 'ORGANISATEUR' THEN 'CASH'
                                                     WHEN t.sale_channel = 'INVITATION' THEN 'INVITATION'
                                                     ELSE 'FREE' END);
        IF t.user_id IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'TICKET_CANCELLED', 'key', 'TICKET_CANCELLED:' || t.id::text,
                'user_id', t.user_id, 'actor_id', p_actor, 'event_id', t.event_id, 'data', v_data));
        ELSE
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'TICKET_CANCELLED', 'key', 'TICKET_CANCELLED:' || t.id::text,
                'phone', v_inv_phone, 'event_id', t.event_id, 'data', v_data, 'channels', jsonb_build_array('SMS')));
        END IF;
    END IF;

    -- Lot 9 ter (9t.2, consigne 0.2, N1) : le porteur actuel est prévenu (SMS, cloche, push, email du registre) ;
    -- l'acheteur d'origine garde REFUND_REQUESTED (trigger des versements). Une seule série : le rejeu « already »
    -- sort plus haut, et la clé TICKET_REFUNDED_HOLDER:<billet> est unique par canal.
    IF v_holder_notice THEN
        SELECT c.name INTO v_cat_name FROM public.ticket_categories c WHERE c.id = t.category_id;
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'TICKET_REFUNDED_HOLDER', 'key', 'TICKET_REFUNDED_HOLDER:' || t.id::text,
            'user_id', t.user_id, 'actor_id', p_actor, 'event_id', t.event_id,
            'data', COALESCE(public.notif_event_data(t.event_id), '{}'::jsonb)
                    || jsonb_build_object('ticket_id', t.id, 'category', v_cat_name)));
    END IF;

    IF v_mode = 'AUCUN' THEN
        UPDATE public.tickets SET status = 'ANNULE' WHERE id = t.id;
        UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = t.category_id;
        RETURN jsonb_build_object('ok', true, 'mode', 'AUCUN', 'amount', 0);
    END IF;

    IF v_mode = 'ORGANISATEUR' THEN
        INSERT INTO public.refunds (payment_id, ticket_id, refund_transaction_id, amount, reason, status, settlement, processed_by, kind, facial_part)
        VALUES (v_payment_id, t.id, v_key, t.price, COALESCE(p_reason, 'Remboursement'), 'PENDING', 'ORGANISATEUR', p_actor, 'TICKET_REFUND', t.price)
        RETURNING id INTO v_refund;
        UPDATE public.tickets SET status = 'ANNULE' WHERE id = t.id;
        UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = t.category_id;
        RETURN jsonb_build_object('ok', true, 'mode', 'ORGANISATEUR', 'refund_id', v_refund, 'amount', t.price);
    END IF;

    v_agg_share := CASE WHEN v_prev_amount + v_share >= p.amount THEN p.aggregator_fee - v_prev_agg
                        ELSE public.fin_round_2(p.aggregator_fee * v_share / p.amount) END;
    v_bearer := public.fin_setting_text('finance.cancellation_aggregator_fee_bearer');

    SELECT first_name, last_name INTO v_user FROM public.users WHERE id = p.client_id;
    v_blocked := CASE
        WHEN p.operator IS NULL THEN 'OPERATOR_UNKNOWN'
        WHEN p.payer_phone IS NULL THEN 'PHONE_UNKNOWN'
        WHEN NULLIF(btrim(v_user.first_name), '') IS NULL OR NULLIF(btrim(v_user.last_name), '') IS NULL THEN 'NAME_UNKNOWN'
        ELSE NULL END;

    INSERT INTO public.refunds (payment_id, ticket_id, refund_transaction_id, amount, reason, status, settlement, processed_by,
                                kind, facial_part, service_part, aggregator_fee_share, aggregator_fee_bearer, net_revenue_reversal)
    VALUES (p.id, t.id, v_key, v_share, COALESCE(p_reason, 'Remboursement'), 'PENDING', 'PLATEFORME', p_actor,
            'TICKET_REFUND', t.price, t.service_fee, v_agg_share, v_bearer,
            CASE WHEN v_bearer = 'ORGANISATEUR' THEN t.service_fee - v_agg_share ELSE t.service_fee END)
    RETURNING id INTO v_refund;
    INSERT INTO public.cashouts (kind, idempotency_key, payment_id, refund_id, ticket_id, beneficiary_user_id, operator, phone_number,
                                 first_name, last_name, amount, blocked_reason)
    VALUES ('TICKET_REFUND', v_key, p.id, v_refund, t.id, p.client_id, p.operator, p.payer_phone,
            NULLIF(btrim(v_user.first_name), ''), NULLIF(btrim(v_user.last_name), ''), v_share, v_blocked)
    RETURNING id INTO v_cashout;
    UPDATE public.refunds SET cashout_id = v_cashout WHERE id = v_refund;
    UPDATE public.tickets SET status = 'REMBOURSEMENT_EN_COURS' WHERE id = t.id;
    UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = t.category_id;
    v_apply := public.fin_refund_apply(v_refund);
    RETURN jsonb_build_object('ok', true, 'mode', 'CASHOUT', 'refund_id', v_refund, 'cashout_id', v_cashout,
                              'amount', v_share, 'blocked_reason', v_blocked, 'debt', COALESCE(v_apply->'debt', '0'::jsonb));
END;
$$;


-- ----------------------------------------------------------------------------
-- 9. Privilèges : RPC au service_role seul
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.ticket_refund_request(uuid, uuid, text)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
