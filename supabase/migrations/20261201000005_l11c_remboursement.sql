-- ============================================================================
-- EVENT VILLAGE — LOT 11c-a, migration 05 : remboursement d'une table d'un événement
-- ============================================================================
-- Décision du client (25/11) : pas d'annulation par le client ; remboursement complet si la soirée est annulée
-- (event_cancel rembourse déjà tout paiement de cible TICKET de l'événement : rien à changer), ou reportée de plus de
-- 24 h (table entière, à la demande du titulaire, jusqu'au nouveau début ; refus si une place a déjà servi ; billets non
-- utilisés remboursés, transferts en attente annulés ; argent au compte qui a payé ; la table est de nouveau en vente).
--  1. ticket_refund_request : recopie de 20261116000001_f2a_fiche_suspendue.sql:1683-1959 ; changement : une place d'une table ne
--     se rembourse jamais seule (organisatrice, administration, porteur) : TABLE_SEAT_NOT_ALONE.
--  2. ticket_postponement_refund_open : recopie de 20261109000006_lot9bis_argent.sql:515-555 ; changement : faux pour
--     une place d'une table (« Mes billets » ne propose pas de rembourser une place seule).
--  3. event_table_postponement_window (règle du report, même calcul que ticket_postponement_refund_open, pour la vente
--     entière) et event_table_postponement_refund (demande du titulaire).
-- Réservées au rôle de service. Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

-- Recopie de 20261116000001_f2a_fiche_suspendue.sql:1683-1959
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
    -- Finition 2a (1a) : fiche SUSPENDU, événements en lecture seule pour la partenaire (l'admin events.write garde ses actions)
    -- alias tk : la fonction déclare une variable t (référence « t.event_id » ambiguë pour PL/pgSQL)
    IF public.partner_owner_suspended((SELECT tk.event_id FROM public.tickets tk WHERE tk.id = p_ticket_id), p_actor) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
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
    -- Lot 11c-a : une place d'une table ne se rembourse jamais seule (table entière au report, à la demande du
    -- titulaire : event_table_postponement_refund ; annulation de l'événement : paiement entier)
    IF t.event_table_booking_id IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TABLE_SEAT_NOT_ALONE', 'message', 'Cette place fait partie d’une table : seule la table entière se rembourse, à la demande de son titulaire.');
    END IF;

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

-- Recopie de 20261109000006_lot9bis_argent.sql:515-555
CREATE OR REPLACE FUNCTION public.ticket_postponement_refund_open(p_ticket uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r       record;
    v_start timestamptz;
    v_base  timestamptz;
BEGIN
    -- Lot 11c-a : une place d'une table ne se rembourse pas seule (event_table_postponement_window pour la table)
    IF EXISTS (SELECT 1 FROM public.tickets x WHERE x.id = p_ticket AND x.event_table_booking_id IS NOT NULL) THEN
        RETURN FALSE;
    END IF;
    SELECT t.id, t.status::text AS status, t.price, t.event_id, e.status::text AS event_status,
           pay.created_at AS bought_at, pay.is_platform_payment, pay.status::text AS pay_status,
           pay.payment_target::text AS target
      INTO r
      FROM public.tickets t
      JOIN public.events e ON e.id = t.event_id
      JOIN public.payments pay ON pay.id = t.payment_id
     WHERE t.id = p_ticket;
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    IF r.status <> 'VALIDE' OR COALESCE(r.price, 0) <= 0 OR NOT COALESCE(r.is_platform_payment, FALSE)
       OR r.pay_status NOT IN ('SUCCESS', 'PARTIAL') OR r.target <> 'TICKET'
       OR r.event_status NOT IN ('PUBLIE', 'SUSPENDU') THEN
        RETURN FALSE;
    END IF;
    v_start := public.event_start_at(r.event_id);
    IF v_start IS NULL OR now() >= v_start THEN
        RETURN FALSE;
    END IF;
    -- Début en vigueur à l'achat : ancien début du premier changement enregistré après l'achat
    SELECT c.old_start_at INTO v_base
      FROM public.event_start_changes c
     WHERE c.event_id = r.event_id AND c.changed_at > r.bought_at
     ORDER BY c.changed_at, c.id
     LIMIT 1;
    RETURN v_base IS NOT NULL AND v_start - v_base > interval '24 hours';
END;
$$;

-- Fenêtre de remboursement d'une table après un report : { open, until } (until : nouveau début de l'événement)
CREATE OR REPLACE FUNCTION private.event_table_postponement_window(p_booking uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r       record;
    v_start timestamptz;
    v_base  timestamptz;
BEGIN
    SELECT b.status, b.event_id, e.status::text AS event_status, pay.created_at AS bought_at, pay.is_platform_payment,
           pay.status::text AS pay_status, pay.payment_target::text AS target, pay.amount
      INTO r
      FROM public.event_table_bookings b
      JOIN public.events e ON e.id = b.event_id
      JOIN public.payments pay ON pay.id = b.payment_id
     WHERE b.id = p_booking;
    IF NOT FOUND OR r.status <> 'ACTIVE' OR NOT COALESCE(r.is_platform_payment, FALSE) OR COALESCE(r.amount, 0) <= 0
       OR r.pay_status NOT IN ('SUCCESS', 'PARTIAL') OR r.target <> 'TICKET' OR r.event_status NOT IN ('PUBLIE', 'SUSPENDU') THEN
        RETURN jsonb_build_object('open', false);
    END IF;
    v_start := public.event_start_at(r.event_id);
    IF v_start IS NULL OR now() >= v_start THEN
        RETURN jsonb_build_object('open', false);
    END IF;
    -- Début en vigueur à l'achat : ancien début du premier changement enregistré après l'achat
    SELECT c.old_start_at INTO v_base
      FROM public.event_start_changes c
     WHERE c.event_id = r.event_id AND c.changed_at > r.bought_at
     ORDER BY c.changed_at, c.id
     LIMIT 1;
    IF v_base IS NULL OR v_start - v_base <= interval '24 hours' THEN
        RETURN jsonb_build_object('open', false);
    END IF;
    RETURN jsonb_build_object('open', true, 'until', v_start, 'amount', r.amount);
END;
$$;

-- p : booking_id, actor_id (le titulaire). Rembourse la table entière (prix et frais) au compte qui a payé.
CREATE OR REPLACE FUNCTION public.event_table_postponement_refund(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking uuid := public.try_uuid(p->>'booking_id');
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    b         record;
    v_window  jsonb;
    v_cashout uuid;
    v_amount  numeric;
BEGIN
    SELECT * INTO b FROM public.event_table_bookings WHERE id = v_booking;
    IF NOT FOUND OR v_actor IS NULL OR b.holder_id IS DISTINCT FROM v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Table introuvable.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;
    -- Verrous : paiement, type, table, vente, transferts en attente puis billets (ordre de ticket_refund_request)
    PERFORM 1 FROM public.payments WHERE id = b.payment_id FOR UPDATE;
    PERFORM 1 FROM public.ticket_categories WHERE id = b.category_id FOR NO KEY UPDATE;
    PERFORM 1 FROM public.event_tables WHERE id = b.event_table_id FOR UPDATE;
    SELECT * INTO b FROM public.event_table_bookings WHERE id = v_booking FOR UPDATE;
    PERFORM 1 FROM public.ticket_transfers x
     WHERE x.status::text = 'PENDING' AND x.ticket_id IN (SELECT tk.id FROM public.tickets tk WHERE tk.event_table_booking_id = b.id)
     ORDER BY x.id
       FOR UPDATE OF x;
    PERFORM 1 FROM public.tickets WHERE event_table_booking_id = b.id ORDER BY id FOR UPDATE;

    IF b.status <> 'ACTIVE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_REFUNDED', 'message', 'Cette table est déjà remboursée.');
    END IF;
    v_window := private.event_table_postponement_window(b.id);
    IF NOT COALESCE((v_window->>'open')::boolean, FALSE) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'POSTPONEMENT_REFUND_CLOSED',
            'message', 'Le remboursement n’est possible que si l’événement a été reporté de plus de 24 h après votre achat, jusqu’au nouveau début.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.tickets tk WHERE tk.event_table_booking_id = b.id AND tk.status::text = 'UTILISE')
       OR EXISTS (SELECT 1 FROM public.ticket_scans s JOIN public.tickets tk ON tk.id = s.ticket_id
                   WHERE tk.event_table_booking_id = b.id AND s.result = 'valid') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TABLE_SEAT_USED',
            'message', 'Une place de cette table a déjà servi à l’entrée : la table ne peut plus être remboursée.');
    END IF;

    -- Transferts en attente annulés (la place revient au titulaire avant d'être remboursée)
    UPDATE public.ticket_transfers SET status = 'CANCELLED', cancelled_at = now()
     WHERE status::text = 'PENDING' AND ticket_id IN (SELECT tk.id FROM public.tickets tk WHERE tk.event_table_booking_id = b.id);
    UPDATE public.tickets SET transfer_locked = FALSE WHERE event_table_booking_id = b.id AND transfer_locked;

    -- Paiement entier remboursé au compte qui a payé ; billets non utilisés passés en remboursement (refund_request)
    v_cashout := public.refund_request(b.payment_id, 'Report de l’événement : table remboursée à la demande du titulaire', 'REFUND');
    SELECT amount INTO v_amount FROM public.refunds WHERE refund_transaction_id = 'REFUND-' || b.payment_id::text;

    -- La vente est close, la table de nouveau en vente
    PERFORM set_config('event_village.event_tables', 'on', true);
    UPDATE public.event_table_bookings SET status = 'REFUNDED', refunded_at = now(), refund_origin = 'POSTPONEMENT' WHERE id = b.id;
    PERFORM set_config('event_village.event_tables', 'off', true);
    UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0), updated_at = now() WHERE id = b.category_id;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'CLIENT', 'EVENT_TABLE_POSTPONEMENT_REFUND', 'EVENT_TABLE_BOOKING', b.id,
            jsonb_build_object('event_id', b.event_id, 'payment_id', b.payment_id, 'table_number', b.table_number,
                               'cashout_id', v_cashout, 'amount', v_amount));
    RETURN jsonb_build_object('ok', true, 'booking_id', b.id, 'cashout_id', v_cashout, 'amount', v_amount, 'to_original_buyer', true);
END;
$$;

REVOKE ALL ON FUNCTION private.event_table_postponement_window(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.event_table_postponement_refund(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_postponement_refund(jsonb) TO service_role;
