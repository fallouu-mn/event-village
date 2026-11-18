-- ============================================================================
-- EVENT VILLAGE — LOT 10a, migration 05 : annuler une réservation de salle, rembourser, délai de paiement dépassé
-- ============================================================================
-- Trous S5 et S6 de l'état des lieux du 18/11 : moratoire de 2 jours codé en dur, annulation après paiement sans aucun
-- remboursement (le moteur financier ignorait tout ce qui n'était pas un billet).
--  1. hall_refund_payment(paiement, part, motif) : remboursement d'une part de ce que le client a payé (frais compris)
--     par le moteur financier : remboursement et versement (Wave, Orange Money, chemin des billets), débit de la part
--     de la salle au grand livre, revenu d'Event Village corrigé, frais de l'opérateur (1,5 %) à la charge d'Event
--     Village (§78), commission de parrainage corrigée (fin_refund_apply, §82) ; idempotent (une fois par paiement) ;
--  2. hall_cancel_apply / hall_reservation_cancel(p) : annulation sous verrou par le client (règle figée sur la
--     réservation), par la salle ou par Event Village (remboursement total, motif obligatoire) ; journal et avis ;
--  3. hall_reservations_tick() (tâche /api/cron/moratoriums) : attentes de 15 minutes échues, solde non payé à
--     l'échéance (« Délai de paiement dépassé » : acompte traité selon la règle, évaluée à l'instant de l'échéance),
--     rappel du solde 3 jours avant l'échéance (J-10 par défaut) ; idempotente ;
--  4. notif_cashouts_notify : recopie de 20261111000005_lot9quater_argent.sql:356-628 ; le remboursement d'une salle n'envoie plus le texte des
--     billets (« aucun billet n'a pu être émis »).
-- Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- ============================================================================

-- Remboursement d'une part d'un paiement de salle (pourcentage de ce que le client a payé, frais compris)
CREATE OR REPLACE FUNCTION public.hall_refund_payment(p_payment_id uuid, p_percent numeric, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay     record;
    v_user    record;
    v_key     text := 'REFUND-HALL-' || p_payment_id::text;
    v_cashout uuid;
    v_refund  uuid;
    v_amount  numeric;
    v_comm    numeric;
    v_facial  numeric;
    v_service numeric;
    v_agg     numeric;
    v_blocked text;
BEGIN
    SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND OR v_pay.payment_target::text <> 'HALL_RESERVATION' THEN
        RAISE EXCEPTION 'hall_refund_payment : paiement de salle % introuvable', p_payment_id;
    END IF;
    SELECT id INTO v_cashout FROM public.cashouts WHERE idempotency_key = v_key;
    IF FOUND THEN
        RETURN v_cashout;
    END IF;
    IF p_percent IS NULL OR p_percent <= 0 OR v_pay.status::text <> 'SUCCESS' THEN
        RETURN NULL;
    END IF;
    IF p_percent > 100 THEN
        RAISE EXCEPTION 'hall_refund_payment : part % hors bornes', p_percent;
    END IF;
    v_amount := round(v_pay.amount * p_percent / 100);
    -- Part de la salle (prix moins commission) rendue par la salle ; le reste (frais de service et commission) par
    -- Event Village ; frais de l'opérateur (1,5 %) à la charge d'Event Village (§78)
    v_comm := COALESCE(NULLIF(v_pay.metadata->>'commission_amount', '')::numeric, 0);
    v_facial := LEAST(round((COALESCE(v_pay.facial_amount, 0) - v_comm) * p_percent / 100), v_amount);
    v_service := v_amount - v_facial;
    v_agg := public.fin_round_2(COALESCE(v_pay.aggregator_fee, 0) * p_percent / 100);
    SELECT first_name, last_name INTO v_user FROM public.users WHERE id = v_pay.client_id;
    v_blocked := CASE
        WHEN v_pay.operator IS NULL THEN 'OPERATOR_UNKNOWN'
        WHEN v_pay.payer_phone IS NULL THEN 'PHONE_UNKNOWN'
        WHEN NULLIF(btrim(v_user.first_name), '') IS NULL OR NULLIF(btrim(v_user.last_name), '') IS NULL THEN 'NAME_UNKNOWN'
        ELSE NULL END;
    INSERT INTO public.refunds (payment_id, refund_transaction_id, amount, reason, status, settlement, kind,
                                facial_part, service_part, aggregator_fee_share, aggregator_fee_bearer, net_revenue_reversal)
    VALUES (p_payment_id, v_key, v_amount, COALESCE(p_reason, 'Annulation d’une réservation de salle'), 'PENDING', 'PLATEFORME', 'REFUND',
            v_facial, v_service, v_agg, 'EVENT_VILLAGE', v_service)
    RETURNING id INTO v_refund;
    INSERT INTO public.cashouts (kind, idempotency_key, payment_id, refund_id, beneficiary_user_id, operator, phone_number,
                                 first_name, last_name, amount, blocked_reason)
    VALUES ('REFUND', v_key, p_payment_id, v_refund, v_pay.client_id, v_pay.operator, v_pay.payer_phone,
            NULLIF(btrim(v_user.first_name), ''), NULLIF(btrim(v_user.last_name), ''), v_amount, v_blocked)
    RETURNING id INTO v_cashout;
    UPDATE public.refunds SET cashout_id = v_cashout WHERE id = v_refund;
    PERFORM public.fin_refund_apply(v_refund);
    RETURN v_cashout;
END;
$$;

-- Annulation d'une réservation (client, salle ou Event Village), sous verrou ; remboursement de chaque paiement encaissé
CREATE OR REPLACE FUNCTION public.hall_cancel_apply(p_reservation_id uuid, p_origin text, p_actor uuid, p_reason text, p_percent numeric)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r         record;
    v_pay     record;
    v_cashout uuid;
    v_ids     uuid[] := ARRAY[]::uuid[];
    v_refund  numeric := 0;
    v_state   text;
    v_owner   uuid;
    v_data    jsonb;
    v_role    text;
BEGIN
    SELECT * INTO r FROM public.hall_reservations WHERE id = p_reservation_id FOR UPDATE;
    v_state := CASE p_origin WHEN 'CLIENT' THEN 'ANNULEE_CLIENT' WHEN 'SALLE' THEN 'ANNULEE_SALLE'
                             WHEN 'EVENT_VILLAGE' THEN 'ANNULEE_EV' WHEN 'DELAI' THEN 'DELAI_DEPASSE' END;
    FOR v_pay IN
        SELECT id FROM public.payments
         WHERE hall_reservation_id = r.id AND status::text = 'SUCCESS' ORDER BY paid_at, id
    LOOP
        v_cashout := public.hall_refund_payment(v_pay.id, p_percent, p_reason);
        IF v_cashout IS NOT NULL THEN
            v_ids := v_ids || v_cashout;
        END IF;
    END LOOP;
    SELECT COALESCE(sum(f.amount), 0) INTO v_refund
      FROM public.refunds f JOIN public.payments pp ON pp.id = f.payment_id
     WHERE pp.hall_reservation_id = r.id AND f.settlement = 'PLATEFORME';
    UPDATE public.hall_reservations
       SET booking_state = v_state, cancel_origin = p_origin, cancel_reason = p_reason, cancelled_at = now(),
           cancelled_by = p_actor, refund_percent = CASE WHEN r.paid_amount > 0 THEN p_percent END,
           refunded_amount = LEAST(v_refund, paid_amount), hold_expires_at = NULL,
           payment_status = CASE WHEN v_refund > 0 THEN 'REFUND_PENDING'
                                 WHEN r.paid_amount > 0 THEN r.payment_status::text
                                 ELSE 'CANCELLED' END::public.payment_status_enum,
           updated_at = now()
     WHERE id = r.id;
    v_role := CASE p_origin WHEN 'CLIENT' THEN 'CLIENT' WHEN 'SALLE' THEN 'PARTENAIRE' WHEN 'DELAI' THEN 'SYSTEM'
                   ELSE (CASE WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p_actor AND ur.role::text = 'SUPERADMIN')
                              THEN 'SUPERADMIN' ELSE 'ADMIN' END) END;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (p_actor, v_role, CASE WHEN p_origin = 'DELAI' THEN 'HALL_RESERVATION_DEADLINE_PASSED' ELSE 'HALL_RESERVATION_CANCELLED' END,
            'hall_reservations', r.id,
            jsonb_build_object('booking_state', r.booking_state, 'paid_amount', r.paid_amount),
            jsonb_build_object('booking_state', v_state, 'refunded_amount', v_refund, 'refund_percent', p_percent),
            jsonb_build_object('origin', p_origin, 'reason', p_reason, 'cashout_ids', to_jsonb(v_ids)));

    -- Avis : une réservation jamais payée (attente annulée par le client) n'en donne pas
    IF r.paid_amount > 0 THEN
        v_data := COALESCE(public.hall_notif_data(r.id), '{}'::jsonb)
                  || jsonb_strip_nulls(jsonb_build_object('origin', p_origin, 'refund_amount', v_refund, 'refund_percent', p_percent,
                                                          'paid_amount', r.paid_amount, 'reason', CASE WHEN p_origin IN ('SALLE', 'EVENT_VILLAGE') THEN p_reason END));
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', CASE WHEN p_origin = 'DELAI' THEN 'HALL_PAYMENT_DEADLINE_PASSED' ELSE 'HALL_RESERVATION_CANCELLED' END,
            'key', CASE WHEN p_origin = 'DELAI' THEN 'HALL_PAYMENT_DEADLINE_PASSED:' ELSE 'HALL_RESERVATION_CANCELLED:' END || r.id::text,
            'user_id', r.client_id, 'data', v_data));
        SELECT pa.user_id INTO v_owner FROM public.partners pa WHERE pa.id = r.partner_id;
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'HALL_RESERVATION_CANCELLED_PRO', 'key', 'HALL_RESERVATION_CANCELLED_PRO:' || r.id::text,
                'user_id', v_owner, 'data', v_data));
        END IF;
    END IF;
    RETURN jsonb_build_object('ok', true, 'reservation_id', r.id, 'booking_state', v_state,
                              'refund_percent', CASE WHEN r.paid_amount > 0 THEN p_percent ELSE 0 END,
                              'refund_amount', v_refund, 'cashout_ids', to_jsonb(v_ids));
END;
$$;

CREATE OR REPLACE FUNCTION public.hall_reservation_cancel(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_res_id uuid := public.try_uuid(p->>'reservation_id');
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_origin text := upper(COALESCE(p->>'origin', ''));
    v_reason text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'reason', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    r        record;
    v_pct    numeric;
BEGIN
    IF v_origin NOT IN ('CLIENT', 'SALLE', 'EVENT_VILLAGE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ORIGIN', 'message', 'Annulation refusée.');
    END IF;
    SELECT hall_id INTO r FROM public.hall_reservations WHERE id = v_res_id;
    IF v_res_id IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('hall_reservations:' || r.hall_id::text, 0));
    SELECT hr.*, pa.user_id AS owner_id INTO r
      FROM public.hall_reservations hr JOIN public.partners pa ON pa.id = hr.partner_id
     WHERE hr.id = v_res_id FOR UPDATE OF hr;

    -- Droits : le client sur la sienne, la salle sur celles de ses salles, Event Village avec le droit des remboursements
    IF v_origin = 'CLIENT' AND (v_actor IS NULL OR v_actor <> r.client_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    IF v_origin = 'SALLE' AND (v_actor IS NULL OR v_actor <> r.owner_id
        OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    -- Event Village : droit des remboursements ; une attente jamais payée (aucun argent) relève aussi de la
    -- modération des services (droit events.write, PATCH /api/admin/services)
    IF v_origin = 'EVENT_VILLAGE' AND (v_actor IS NULL
        OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
        OR NOT (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
                OR public.has_admin_permission(v_actor, 'refunds.manage')
                OR (r.paid_amount = 0 AND r.booking_state = 'EN_ATTENTE_PAIEMENT' AND public.has_admin_permission(v_actor, 'events.write')))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit d’annuler cette réservation.');
    END IF;
    IF v_origin IN ('SALLE', 'EVENT_VILLAGE') AND (v_reason IS NULL OR length(v_reason) < 5) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif de l’annulation : il est envoyé au client.');
    END IF;
    IF r.booking_state NOT IN ('EN_ATTENTE_PAIEMENT', 'ACOMPTE_PAYE', 'PAYEE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_CANCELLABLE', 'message', 'Cette réservation est déjà annulée ou terminée.');
    END IF;
    IF v_origin IN ('CLIENT', 'SALLE') AND lower(r.slot) <= public.hall_dakar_now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_STARTED', 'message', 'La réservation a déjà commencé : elle ne peut plus être annulée ici. Contactez le support.');
    END IF;
    IF v_origin = 'EVENT_VILLAGE' AND upper(r.slot) <= public.hall_dakar_now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_ENDED', 'message', 'La réservation est terminée : elle ne peut plus être annulée.');
    END IF;

    -- Part remboursée : règle figée sur la réservation pour le client, tout pour la salle et Event Village
    v_pct := CASE WHEN v_origin = 'CLIENT' THEN public.hall_cancel_percent(r.cancellation_terms, lower(r.slot), public.hall_dakar_now())
                  ELSE 100 END;
    RETURN public.hall_cancel_apply(r.id, v_origin, v_actor, COALESCE(v_reason, 'Annulation par le client'), v_pct);
END;
$$;

-- Tâche planifiée (/api/cron/moratoriums) : attentes de 15 minutes échues, délai de paiement du solde dépassé, rappel
-- du solde 3 jours avant son échéance. Idempotente : chaque passage ne traite que ce qui reste à traiter.
CREATE OR REPLACE FUNCTION public.hall_reservations_tick()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_holds     integer;
    v_deadline  integer := 0;
    v_reminders integer := 0;
    v_ids       uuid[] := ARRAY[]::uuid[];
    r           record;
    rr          record;
    v_res       jsonb;
    v_pct       numeric;
BEGIN
    UPDATE public.hall_reservations
       SET booking_state = 'EXPIREE', payment_status = 'CANCELLED', hold_expires_at = NULL, updated_at = now()
     WHERE booking_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at <= now();
    GET DIAGNOSTICS v_holds = ROW_COUNT;

    FOR r IN
        SELECT hr.id, hr.hall_id FROM public.hall_reservations hr
         WHERE hr.booking_state = 'ACOMPTE_PAYE' AND hr.balance_due_at < now()
           -- Un paiement du solde lancé avant l'échéance et encore valable est attendu
           AND NOT EXISTS (SELECT 1 FROM public.payments pp
                            WHERE pp.hall_reservation_id = hr.id AND pp.status::text = 'PENDING'
                              AND pp.created_at <= hr.balance_due_at AND pp.created_at > now() - interval '60 minutes')
         ORDER BY hr.balance_due_at
    LOOP
        PERFORM pg_advisory_xact_lock(hashtextextended('hall_reservations:' || r.hall_id::text, 0));
        SELECT * INTO rr FROM public.hall_reservations WHERE id = r.id FOR UPDATE;
        IF rr.booking_state <> 'ACOMPTE_PAYE' OR rr.balance_due_at >= now() THEN
            CONTINUE;
        END IF;
        -- Règle d'annulation appliquée à l'instant de l'échéance (résultat indépendant de l'heure du passage)
        v_pct := public.hall_cancel_percent(rr.cancellation_terms, lower(rr.slot), rr.balance_due_at AT TIME ZONE 'Africa/Dakar');
        v_res := public.hall_cancel_apply(rr.id, 'DELAI', NULL, 'Solde non payé avant l’échéance', v_pct);
        v_ids := v_ids || ARRAY(SELECT jsonb_array_elements_text(v_res->'cashout_ids')::uuid);
        v_deadline := v_deadline + 1;
    END LOOP;

    FOR r IN
        SELECT hr.id, hr.client_id FROM public.hall_reservations hr
         WHERE hr.booking_state = 'ACOMPTE_PAYE' AND hr.balance_due_at IS NOT NULL
           AND now() >= hr.balance_due_at - interval '3 days' AND now() < hr.balance_due_at
    LOOP
        v_reminders := v_reminders + COALESCE(public.notif_enqueue(jsonb_build_object(
            'type', 'HALL_BALANCE_REMINDER', 'key', 'HALL_BALANCE_REMINDER:' || r.id::text,
            'user_id', r.client_id, 'data', COALESCE(public.hall_notif_data(r.id), '{}'::jsonb))), 0);
    END LOOP;

    RETURN jsonb_build_object('expired_holds', v_holds, 'deadline_passed', v_deadline, 'reminders', v_reminders,
                              'cashout_ids', to_jsonb(v_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.hall_refund_payment(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hall_cancel_apply(uuid, text, uuid, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hall_reservation_cancel(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hall_reservations_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hall_refund_payment(uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hall_cancel_apply(uuid, text, uuid, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.hall_reservation_cancel(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.hall_reservations_tick() TO service_role;


-- Recopie de 20261111000005_lot9quater_argent.sql:356-628 ; changement : aucun avis PAYMENT_REFUND_STARTED pour un paiement de salle.
CREATE OR REPLACE FUNCTION public.notif_cashouts_notify()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_refund        boolean := NEW.kind IN ('REFUND', 'EVENT_CANCELLATION_REFUND', 'TICKET_REFUND');
    v_status_new    boolean := TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status;
    v_blocked_new   boolean := NEW.status = 'A_ENVOYER' AND NEW.blocked_reason IS NOT NULL
                               AND (TG_OP = 'INSERT' OR OLD.blocked_reason IS NULL);
    -- Lot 9 bis (B1, B11) : retard de plus de 30 minutes posé par cashouts_flag_delayed
    v_delay_new     boolean := TG_OP = 'UPDATE' AND NEW.delay_flagged_at IS NOT NULL AND OLD.delay_flagged_at IS NULL;
    v_event         uuid;
    v_event_data    jsonb := '{}'::jsonb;
    v_partner_user  uuid;
    v_user          uuid;
    v_phone         text;
    v_account_kind  text;
    v_money         jsonb;
    v_day           text := to_char(timezone('Africa/Dakar', now()), 'YYYY-MM-DD');
    -- Lot 9 quater (C1) : frais de l'opérateur retenus sur le remboursement d'un doublon répété
    v_withheld      numeric;
    -- Lot 9 bis (B11) : un seul avis de retard par versement, mis en file en fin de fonction
    v_refund_delayed     boolean := false;
    v_withdrawal_delayed boolean := false;
    -- Lot 9 bis (R30, H1) : paiement remboursé, lu à la création d'un REFUND
    v_pay_amount    numeric;
    v_pay_operator  text;
    v_duplicate_of  text;
BEGIN
    IF NOT (v_status_new OR v_blocked_new OR v_delay_new) THEN
        RETURN NEW;
    END IF;

    -- Bénéficiaire : le compte s'il existe encore ; numéro du compte résolu à l'envoi, sinon le numéro
    -- du versement (9 chiffres) pour le SMS.
    IF NEW.beneficiary_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.beneficiary_user_id) THEN
        v_user := NEW.beneficiary_user_id;
    END IF;
    IF (v_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user AND NULLIF(btrim(COALESCE(u.phone, '')), '') IS NOT NULL))
       AND NEW.phone_number ~ '^[0-9]{9}$' THEN
        v_phone := '+221' || NEW.phone_number;
    END IF;

    -- Événement d'un remboursement : celui du paiement, sinon celui du billet.
    IF v_refund THEN
        SELECT p.event_id INTO v_event FROM public.payments p WHERE p.id = NEW.payment_id;
        IF v_event IS NULL AND NEW.ticket_id IS NOT NULL THEN
            SELECT t.event_id INTO v_event FROM public.tickets t WHERE t.id = NEW.ticket_id;
        END IF;
        IF v_event IS NOT NULL THEN
            v_event_data := public.notif_pros_event_data(v_event);
            SELECT pa.user_id INTO v_partner_user
              FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
             WHERE e.id = v_event;
        END IF;
    ELSE
        SELECT w.account_kind INTO v_account_kind FROM public.withdrawals w WHERE w.id = NEW.withdrawal_id;
    END IF;

    v_money := jsonb_strip_nulls(jsonb_build_object(
        'cashout_id', NEW.id, 'amount', NEW.amount, 'operator', NEW.operator, 'account_kind', v_account_kind));

    -- 1. Demande de remboursement d'un billet (création du cashout)
    IF TG_OP = 'INSERT' AND NEW.kind = 'TICKET_REFUND' AND v_user IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'REFUND_REQUESTED',
            'key', 'REFUND_REQUESTED:' || NEW.id::text,
            'user_id', v_user,
            'event_id', v_event,
            'data', v_event_data || jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount)
        ));
    END IF;

    -- 1 bis. Lot 9 bis (R30, H1, B11) : paiement encaissé sans billet possible, ou en double du même panier
    --        (payments.metadata.duplicate_of), remboursé : le client est prévenu à la création, avant tout versement.
    -- Lot 10a : le remboursement d'une réservation de salle est annoncé par l'avis de la salle (annulation, délai
    -- dépassé, paiement arrivé trop tard), pas par le texte des billets
    IF TG_OP = 'INSERT' AND NEW.kind = 'REFUND' AND (v_user IS NOT NULL OR v_phone IS NOT NULL)
       AND NOT EXISTS (SELECT 1 FROM public.payments hp WHERE hp.id = NEW.payment_id AND hp.payment_target::text = 'HALL_RESERVATION') THEN
        SELECT p.amount, p.operator::text, NULLIF(p.metadata->>'duplicate_of', ''),
               NULLIF(p.metadata->>'duplicate_fee_withheld', '')::numeric
          INTO v_pay_amount, v_pay_operator, v_duplicate_of, v_withheld
          FROM public.payments p WHERE p.id = NEW.payment_id;
        PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
            'type', 'PAYMENT_REFUND_STARTED',
            'key', 'PAYMENT_REFUND_STARTED:' || NEW.id::text,
            'user_id', v_user,
            'phone', v_phone,
            'event_id', v_event,
            'data', v_event_data || jsonb_strip_nulls(jsonb_build_object(
                'cashout_id', NEW.id, 'payment_id', NEW.payment_id, 'amount', COALESCE(v_pay_amount, NEW.amount),
                'operator', COALESCE(NEW.operator::text, v_pay_operator), 'duplicate_of', v_duplicate_of,
                'withheld', CASE WHEN COALESCE(v_withheld, 0) > 0 THEN v_withheld END,
                'refund_amount', CASE WHEN COALESCE(v_withheld, 0) > 0 THEN NEW.amount END))
        )));
    END IF;

    -- 2. Remboursement bloqué (motif posé alors qu'il attend l'envoi)
    IF v_refund AND v_blocked_new THEN
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_REFUND_TO_RETRY',
            'ref', NEW.id::text || ':' || NEW.attempt_count::text || ':BLOQUE',
            'event_id', v_event,
            'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'cashout_status', 'BLOQUE',
                                       'blocked_reason', NEW.blocked_reason, 'kind', NEW.kind)
        ));
        INSERT INTO public.admin_signals (kind, ref_id) VALUES ('REFUND_TO_RETRY', NEW.id) ON CONFLICT DO NOTHING;
        IF NEW.kind = 'EVENT_CANCELLATION_REFUND' AND v_partner_user IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'CANCEL_REFUNDS_BLOCKED',
                'key', 'CANCEL_REFUNDS_BLOCKED:' || v_event::text || ':' || v_day,
                'user_id', v_partner_user,
                'event_id', v_event,
                'data', v_event_data
            ));
        END IF;
        -- Lot 9 bis (B11) : le bénéficiaire est prévenu du retard, sauf pour une opération simulée (jamais versée)
        IF NEW.blocked_reason <> 'SIMULATED' THEN
            v_refund_delayed := true;
        END IF;
    END IF;

    -- 2 bis. Lot 9 bis (R10, B5) : retrait bloqué (solde, limites du compte, nom manquant)
    IF NOT v_refund AND v_blocked_new AND NEW.blocked_reason <> 'SIMULATED' THEN
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_CASHOUT_TO_RESUME',
            'ref', NEW.id::text || ':' || NEW.attempt_count::text || ':BLOQUE',
            'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'kind', NEW.kind,
                                       'cause', 'BLOCKED', 'blocked_reason', NEW.blocked_reason)
        ));
        INSERT INTO public.admin_signals (kind, ref_id) VALUES ('REFUND_TO_RETRY', NEW.id) ON CONFLICT DO NOTHING;
        v_withdrawal_delayed := true;
    END IF;

    -- 2 ter. Lot 9 bis (R1, B1) : versement en retard de plus de 30 minutes, tous types
    IF v_delay_new THEN
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_CASHOUT_TO_RESUME',
            'ref', NEW.id::text || ':' || NEW.attempt_count::text || ':RETARD',
            'event_id', v_event,
            'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'kind', NEW.kind, 'cause', 'DELAYED')
        ));
        IF v_refund THEN
            v_refund_delayed := true;
        ELSE
            v_withdrawal_delayed := true;
        END IF;
    END IF;

    -- 3. Statut final ou incertain (mise à jour seulement)
    IF v_status_new AND TG_OP = 'UPDATE' THEN
        IF NEW.status = 'CONFIRME' THEN
            IF v_refund THEN
                IF v_user IS NOT NULL OR v_phone IS NOT NULL THEN
                    PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                        'type', 'REFUND_PAID',
                        'key', 'REFUND_PAID:' || NEW.id::text,
                        'user_id', v_user,
                        'phone', v_phone,
                        'event_id', v_event,
                        'data', v_event_data || v_money
                    )));
                END IF;
                IF NEW.kind = 'EVENT_CANCELLATION_REFUND' AND v_event IS NOT NULL AND v_partner_user IS NOT NULL THEN
                    -- Verrou par événement : deux confirmations concurrentes se voient (lecture après le verrou).
                    PERFORM pg_advisory_xact_lock(hashtextextended('notif-cancel-refunds:' || v_event::text, 0));
                    IF NOT EXISTS (
                        SELECT 1 FROM public.cashouts c JOIN public.payments p ON p.id = c.payment_id
                         WHERE p.event_id = v_event AND c.kind = 'EVENT_CANCELLATION_REFUND'
                           AND c.id <> NEW.id AND c.status <> 'CONFIRME'
                    ) THEN
                        PERFORM public.notif_enqueue(jsonb_build_object(
                            'type', 'CANCEL_REFUNDS_DONE',
                            'key', 'CANCEL_REFUNDS_DONE:' || v_event::text,
                            'user_id', v_partner_user,
                            'event_id', v_event,
                            'data', v_event_data
                        ));
                    END IF;
                END IF;
            ELSIF v_user IS NOT NULL OR v_phone IS NOT NULL THEN
                PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                    'type', 'WITHDRAWAL_PAID',
                    'key', 'WITHDRAWAL_PAID:' || NEW.id::text,
                    'user_id', v_user,
                    'phone', v_phone,
                    'data', v_money
                )));
            END IF;

        ELSIF NEW.status = 'ECHOUE' THEN
            IF v_refund THEN
                PERFORM public.notif_enqueue_admins(jsonb_build_object(
                    'type', 'ADMIN_REFUND_TO_RETRY',
                    'ref', NEW.id::text || ':' || NEW.attempt_count::text || ':ECHOUE',
                    'event_id', v_event,
                    'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'cashout_status', 'ECHOUE', 'kind', NEW.kind)
                ));
                INSERT INTO public.admin_signals (kind, ref_id) VALUES ('REFUND_TO_RETRY', NEW.id) ON CONFLICT DO NOTHING;
                IF NEW.kind = 'EVENT_CANCELLATION_REFUND' AND v_partner_user IS NOT NULL THEN
                    PERFORM public.notif_enqueue(jsonb_build_object(
                        'type', 'CANCEL_REFUNDS_BLOCKED',
                        'key', 'CANCEL_REFUNDS_BLOCKED:' || v_event::text || ':' || v_day,
                        'user_id', v_partner_user,
                        'event_id', v_event,
                        'data', v_event_data
                    ));
                END IF;
                v_refund_delayed := true;
            ELSE
                IF v_user IS NOT NULL OR v_phone IS NOT NULL THEN
                    PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                        'type', 'WITHDRAWAL_REJECTED',
                        'key', 'WITHDRAWAL_REJECTED:' || NEW.id::text,
                        'user_id', v_user,
                        'phone', v_phone,
                        'data', v_money
                    )));
                END IF;
                PERFORM public.notif_enqueue_admins(jsonb_build_object(
                    'type', 'ADMIN_WITHDRAWAL_REJECTED',
                    'ref', NEW.id::text,
                    'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount)
                ));
            END IF;

        ELSIF NEW.status = 'INCERTAIN' THEN
            IF NOT v_refund AND (v_user IS NOT NULL OR v_phone IS NOT NULL) THEN
                PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                    'type', 'WITHDRAWAL_UNCERTAIN',
                    'key', 'WITHDRAWAL_UNCERTAIN:' || NEW.id::text || ':' || NEW.attempt_count::text,
                    'user_id', v_user,
                    'phone', v_phone,
                    'data', v_money
                )));
            END IF;
            PERFORM public.notif_enqueue_admins(jsonb_build_object(
                'type', 'ADMIN_CASHOUT_UNCERTAIN',
                'ref', NEW.id::text || ':' || NEW.attempt_count::text,
                'event_id', v_event,
                'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'kind', NEW.kind)
            ));
            INSERT INTO public.admin_signals (kind, ref_id) VALUES ('CASHOUT_UNCERTAIN', NEW.id) ON CONFLICT DO NOTHING;
            IF v_refund THEN
                v_refund_delayed := true;
            END IF;
        END IF;
    END IF;

    -- 4. Lot 9 bis (B11, N1, N2) : avis de retard au bénéficiaire, un seul par versement (clé par versement)
    IF v_refund_delayed AND (v_user IS NOT NULL OR v_phone IS NOT NULL) THEN
        PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
            'type', 'REFUND_DELAYED',
            'key', 'REFUND_DELAYED:' || NEW.id::text,
            'user_id', v_user,
            'phone', v_phone,
            'event_id', v_event,
            'data', v_event_data || v_money
        )));
    END IF;
    IF v_withdrawal_delayed AND (v_user IS NOT NULL OR v_phone IS NOT NULL) THEN
        PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
            'type', 'WITHDRAWAL_DELAYED',
            'key', 'WITHDRAWAL_DELAYED:' || NEW.id::text,
            'user_id', v_user,
            'phone', v_phone,
            'data', v_money
        )));
    END IF;

    RETURN NEW;
END;
$$;
