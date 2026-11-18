-- ============================================================================
-- EVENT VILLAGE — LOT 11a, migration 06 : répondre, annuler, rembourser, absence, paiement sur place, tâche planifiée
-- ============================================================================
-- Trous C1, C2 et T4 de l'état des lieux du 18/11 : la partenaire écrivait n'importe quel statut (confirmée sans
-- paiement), une annulation ne remboursait rien et ne passait pas par le moteur financier, un paiement hors
-- plateforme était marqué « payé ».
--  1. table_refund_payment(paiement, part, motif) : remboursement d'une part de ce que le client a payé (frais compris)
--     par le moteur financier : remboursement et versement (Wave, Orange Money, chemin des billets), part de
--     l'établissement reprise au grand livre, revenu d'Event Village corrigé, frais de l'opérateur (1,5 %) à la charge
--     d'Event Village (§78), commission de parrainage corrigée (fin_refund_apply, §82) ; une fois par paiement ;
--  2. table_close_apply (interne) : fin d'une réservation sous verrou (annulée, refusée, sans réponse, absente),
--     remboursement de chaque paiement encaissé, journal, avis ;
--  3. table_reservation_cancel(p) : par le client (acompte rendu jusqu'à tables.cancel_free_hours avant l'heure, rien
--     ensuite), par l'établissement (motif obligatoire, tout rendu), par Event Village (droit des remboursements, ou
--     modération d'une demande jamais payée ; tout rendu) ;
--  4. table_reservation_respond(p) : l'établissement accepte (seulement une demande payée ou gratuite, dans le délai)
--     ou refuse (motif, tout rendu) ;
--  5. table_reservation_presence(p) : client arrivé (de 1 h avant l'heure à la fin du créneau) ou absent (après
--     l'heure : table libérée, acompte gardé par l'établissement) ;
--  6. table_onsite_payment_record(p) : paiement sur place déclaré par l'établissement, enregistré sur la réservation
--     seulement : jamais une ligne de paiement, jamais une écriture au grand livre (T4) ;
--  7. table_reservations_tick() (tâche /api/cron/tables, toutes les 5 minutes) : attentes de paiement échues,
--     demandes sans réponse (tout rendu), clients absents tables.no_show_minutes après l'heure, rappel
--     tables.reminder_hours avant ; idempotente ;
--  8. notif_cashouts_notify : recopie de 20261122000005_l10a_annulation.sql:294-569 ; le remboursement d'une table n'envoie pas le texte des billets
--     (« aucun billet n'a pu être émis ») : l'avis de la table l'annonce.
-- Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.table_refund_payment(p_payment_id uuid, p_percent numeric, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay     record;
    v_user    record;
    v_key     text := 'REFUND-TABLE-' || p_payment_id::text;
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
    IF NOT FOUND OR v_pay.payment_target::text <> 'TABLE_RESERVATION' THEN
        RAISE EXCEPTION 'table_refund_payment : paiement de table % introuvable', p_payment_id;
    END IF;
    SELECT id INTO v_cashout FROM public.cashouts WHERE idempotency_key = v_key;
    IF FOUND THEN
        RETURN v_cashout;
    END IF;
    IF p_percent IS NULL OR p_percent <= 0 OR v_pay.status::text <> 'SUCCESS' THEN
        RETURN NULL;
    END IF;
    IF p_percent > 100 THEN
        RAISE EXCEPTION 'table_refund_payment : part % hors bornes', p_percent;
    END IF;
    v_amount := round(v_pay.amount * p_percent / 100);
    -- Part de l'établissement (acompte moins commission) rendue par l'établissement ; le reste (frais de service et
    -- commission) par Event Village ; frais de l'opérateur (1,5 %) à la charge d'Event Village (§78)
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
    VALUES (p_payment_id, v_key, v_amount, COALESCE(p_reason, 'Annulation d’une réservation de table'), 'PENDING', 'PLATEFORME', 'REFUND',
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

-- Fin d'une réservation (l'appelant tient le verrou de l'établissement) : état final, remboursement de chaque
-- paiement encaissé (part p_percent), journal, avis au client et à l'établissement.
CREATE OR REPLACE FUNCTION public.table_close_apply(p_reservation_id uuid, p_state text, p_origin text, p_actor uuid,
                                                    p_reason text, p_percent numeric)
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
    v_role    text;
    v_extra   jsonb;
BEGIN
    SELECT * INTO r FROM public.table_reservations WHERE id = p_reservation_id FOR UPDATE;
    FOR v_pay IN
        SELECT id FROM public.payments
         WHERE table_reservation_id = r.id AND status::text = 'SUCCESS' ORDER BY paid_at, id
    LOOP
        v_cashout := public.table_refund_payment(v_pay.id, p_percent, p_reason);
        IF v_cashout IS NOT NULL THEN
            v_ids := v_ids || v_cashout;
        END IF;
    END LOOP;
    SELECT COALESCE(sum(f.amount), 0) INTO v_refund
      FROM public.refunds f JOIN public.payments pp ON pp.id = f.payment_id
     WHERE pp.table_reservation_id = r.id AND f.settlement = 'PLATEFORME' AND f.refund_transaction_id LIKE 'REFUND-TABLE-%';

    PERFORM set_config('event_village.table_booking', 'on', true);
    UPDATE public.table_reservations
       SET booking_state = p_state, cancel_origin = p_origin, cancel_reason = p_reason, cancelled_at = now(),
           cancelled_by = p_actor, refund_percent = CASE WHEN r.paid_amount > 0 THEN p_percent END,
           refunded_amount = LEAST(v_refund, paid_amount), hold_expires_at = NULL,
           absent_at = CASE WHEN p_state = 'ABSENT' THEN now() ELSE absent_at END,
           payment_status = CASE WHEN v_refund > 0 THEN 'REFUND_PENDING'
                                 WHEN r.paid_amount > 0 THEN r.payment_status::text
                                 ELSE 'CANCELLED' END::public.payment_status_enum,
           updated_at = now()
     WHERE id = r.id;

    v_role := CASE WHEN p_actor IS NULL THEN 'SYSTEM'
                   WHEN p_origin = 'CLIENT' THEN 'CLIENT'
                   WHEN p_origin = 'ETABLISSEMENT' OR p_state IN ('REFUSEE', 'ABSENT') THEN 'PARTENAIRE'
                   WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p_actor AND ur.role::text = 'SUPERADMIN') THEN 'SUPERADMIN'
                   ELSE 'ADMIN' END;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (p_actor, v_role,
            CASE p_state WHEN 'REFUSEE' THEN 'TABLE_REQUEST_REFUSED' WHEN 'SANS_REPONSE' THEN 'TABLE_REQUEST_EXPIRED'
                         WHEN 'ABSENT' THEN 'TABLE_NO_SHOW' ELSE 'TABLE_RESERVATION_CANCELLED' END,
            'table_reservations', r.id,
            jsonb_build_object('booking_state', r.booking_state, 'paid_amount', r.paid_amount),
            jsonb_build_object('booking_state', p_state, 'refunded_amount', v_refund, 'refund_percent', p_percent),
            jsonb_build_object('origin', p_origin, 'reason', p_reason, 'cashout_ids', to_jsonb(v_ids)));

    v_extra := jsonb_strip_nulls(jsonb_build_object(
        'origin', COALESCE(p_origin, p_state), 'refund_amount', v_refund, 'refund_percent', p_percent,
        'reason', CASE WHEN p_origin IN ('ETABLISSEMENT', 'EVENT_VILLAGE') OR p_state = 'REFUSEE' THEN p_reason END));
    IF p_state = 'REFUSEE' THEN
        PERFORM public.table_notify('TABLE_REQUEST_REFUSED', r.id, 'CLIENT', v_extra);
    ELSIF p_state = 'SANS_REPONSE' THEN
        PERFORM public.table_notify('TABLE_REQUEST_EXPIRED', r.id, 'CLIENT', v_extra);
        PERFORM public.table_notify('TABLE_RESERVATION_CANCELLED_PRO', r.id, 'OWNER', v_extra);
    ELSIF p_state = 'ABSENT' THEN
        PERFORM public.table_notify('TABLE_NO_SHOW', r.id, 'CLIENT', v_extra);
    ELSE
        PERFORM public.table_notify('TABLE_RESERVATION_CANCELLED', r.id, 'CLIENT', v_extra);
        IF p_origin <> 'ETABLISSEMENT' THEN
            PERFORM public.table_notify('TABLE_RESERVATION_CANCELLED_PRO', r.id, 'OWNER', v_extra);
        END IF;
    END IF;
    RETURN jsonb_build_object('ok', true, 'reservation_id', r.id, 'booking_state', p_state,
                              'refund_percent', CASE WHEN r.paid_amount > 0 THEN p_percent ELSE 0 END,
                              'refund_amount', v_refund, 'paid_amount', r.paid_amount, 'cashout_ids', to_jsonb(v_ids));
END;
$$;

-- Réservation sous verrou, avec la partenaire propriétaire ; NULL si introuvable
CREATE OR REPLACE FUNCTION public.table_lock_reservation(p_reservation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_venue uuid;
BEGIN
    SELECT venue_id INTO v_venue FROM public.table_reservations WHERE id = p_reservation_id;
    IF v_venue IS NULL THEN
        RETURN NULL;
    END IF;
    PERFORM public.table_venue_lock(v_venue);
    RETURN v_venue;
END;
$$;

CREATE OR REPLACE FUNCTION public.table_reservation_cancel(p jsonb)
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
    v_state  text;
BEGIN
    IF v_origin NOT IN ('CLIENT', 'ETABLISSEMENT', 'EVENT_VILLAGE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ORIGIN', 'message', 'Annulation refusée.');
    END IF;
    IF v_res_id IS NULL OR public.table_lock_reservation(v_res_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    SELECT tr.*, pa.user_id AS owner_id INTO r
      FROM public.table_reservations tr JOIN public.partners pa ON pa.id = tr.partner_id
     WHERE tr.id = v_res_id FOR UPDATE OF tr;

    -- Droits : le client sur la sienne, l'établissement sur celles de ses établissements, Event Village avec le droit
    -- des remboursements (ou la modération des services pour une demande jamais payée)
    IF v_origin = 'CLIENT' AND (v_actor IS NULL OR v_actor <> r.client_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    IF v_origin = 'ETABLISSEMENT' AND (v_actor IS NULL OR v_actor <> r.owner_id
        OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    IF v_origin = 'EVENT_VILLAGE' AND (v_actor IS NULL
        OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
        OR NOT (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
                OR public.has_admin_permission(v_actor, 'refunds.manage')
                OR (r.paid_amount = 0 AND r.booking_state IN ('EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_ACCEPTATION')
                    AND public.has_admin_permission(v_actor, 'events.write')))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit d’annuler cette réservation.');
    END IF;
    IF v_origin IN ('ETABLISSEMENT', 'EVENT_VILLAGE') AND (v_reason IS NULL OR length(v_reason) < 5) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif : il est envoyé au client.');
    END IF;
    IF r.booking_state NOT IN ('EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_ACCEPTATION', 'CONFIRMEE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_CANCELLABLE', 'message', 'Cette réservation est déjà annulée ou terminée.');
    END IF;
    IF v_origin IN ('CLIENT', 'ETABLISSEMENT') AND lower(r.slot) <= public.hall_dakar_now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_STARTED', 'message', 'L’heure de la réservation est passée : elle ne peut plus être annulée.');
    END IF;
    IF v_origin = 'EVENT_VILLAGE' AND upper(r.slot) <= public.hall_dakar_now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_ENDED', 'message', 'La réservation est terminée : elle ne peut plus être annulée.');
    END IF;

    v_pct := CASE WHEN v_origin = 'CLIENT'
                  THEN public.table_client_refund_percent(lower(r.slot), public.hall_dakar_now(), public.fin_setting_num('tables.cancel_free_hours'))
                  ELSE 100 END;
    v_state := CASE v_origin WHEN 'CLIENT' THEN 'ANNULEE_CLIENT' WHEN 'ETABLISSEMENT' THEN 'ANNULEE_ETABLISSEMENT' ELSE 'ANNULEE_EV' END;
    RETURN public.table_close_apply(r.id, v_state, v_origin, v_actor, COALESCE(v_reason, 'Annulation par le client'), v_pct)
           || jsonb_build_object('cancel_free_hours', public.fin_setting_num('tables.cancel_free_hours'));
END;
$$;

CREATE OR REPLACE FUNCTION public.table_reservation_respond(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_res_id uuid := public.try_uuid(p->>'reservation_id');
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_action text := upper(COALESCE(p->>'action', ''));
    v_reason text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'reason', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    r        record;
BEGIN
    IF v_action NOT IN ('ACCEPTER', 'REFUSER') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ACTION', 'message', 'Choisissez d’accepter ou de refuser la demande.');
    END IF;
    IF v_res_id IS NULL OR public.table_lock_reservation(v_res_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    SELECT tr.*, pa.user_id AS owner_id INTO r
      FROM public.table_reservations tr JOIN public.partners pa ON pa.id = tr.partner_id
     WHERE tr.id = v_res_id FOR UPDATE OF tr;
    IF v_actor IS NULL OR v_actor <> r.owner_id
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    IF r.booking_state = 'EN_ATTENTE_PAIEMENT' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_PAID', 'message', 'L’acompte n’est pas encore payé : la demande ne peut pas être acceptée.');
    END IF;
    IF r.booking_state <> 'EN_ATTENTE_ACCEPTATION' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_PENDING', 'message', 'Cette demande a déjà reçu une réponse.');
    END IF;
    IF r.response_due_at IS NOT NULL AND r.response_due_at <= now() THEN
        -- Délai dépassé : la demande est close tout de suite (comme le ferait la tâche planifiée)
        PERFORM public.table_close_apply(r.id, 'SANS_REPONSE', 'SANS_REPONSE', NULL, 'Pas de réponse de l’établissement à temps', 100);
        RETURN jsonb_build_object('ok', false, 'code', 'RESPONSE_TOO_LATE', 'message', 'Le délai de réponse est passé : la demande est annulée et le client remboursé.');
    END IF;
    IF v_action = 'REFUSER' THEN
        IF v_reason IS NULL OR length(v_reason) < 5 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif : il est envoyé au client.');
        END IF;
        RETURN public.table_close_apply(r.id, 'REFUSEE', NULL, v_actor, v_reason, 100);
    END IF;

    PERFORM set_config('event_village.table_booking', 'on', true);
    UPDATE public.table_reservations
       SET booking_state = 'CONFIRMEE', confirmed_at = now(), response_due_at = NULL, updated_at = now()
     WHERE id = r.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'TABLE_REQUEST_ACCEPTED', 'table_reservations', r.id,
            jsonb_build_object('booking_state', r.booking_state), jsonb_build_object('booking_state', 'CONFIRMEE'));
    PERFORM public.table_notify('TABLE_RESERVATION_CONFIRMED', r.id, 'CLIENT');
    RETURN jsonb_build_object('ok', true, 'reservation_id', r.id, 'booking_state', 'CONFIRMEE');
END;
$$;

CREATE OR REPLACE FUNCTION public.table_reservation_presence(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_res_id uuid := public.try_uuid(p->>'reservation_id');
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_action text := upper(COALESCE(p->>'action', ''));
    v_now    timestamp := public.hall_dakar_now();
    r        record;
BEGIN
    IF v_action NOT IN ('ARRIVEE', 'ABSENT') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ACTION', 'message', 'Indiquez si le client est arrivé ou absent.');
    END IF;
    IF v_res_id IS NULL OR public.table_lock_reservation(v_res_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    SELECT tr.*, pa.user_id AS owner_id INTO r
      FROM public.table_reservations tr JOIN public.partners pa ON pa.id = tr.partner_id
     WHERE tr.id = v_res_id FOR UPDATE OF tr;
    IF v_actor IS NULL OR v_actor <> r.owner_id
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    IF r.booking_state <> 'CONFIRMEE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_CONFIRMED', 'message', 'Seule une réservation confirmée peut être marquée ainsi.');
    END IF;
    IF (v_action = 'ARRIVEE' AND v_now < lower(r.slot) - interval '1 hour') OR (v_action = 'ABSENT' AND v_now < lower(r.slot)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_EARLY', 'message', 'Il est trop tôt : attendez l’heure de la réservation.');
    END IF;
    IF v_now >= upper(r.slot) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_LATE', 'message', 'Le créneau de cette réservation est terminé.');
    END IF;
    IF v_action = 'ABSENT' THEN
        RETURN public.table_close_apply(r.id, 'ABSENT', NULL, v_actor, 'Client absent', 0);
    END IF;
    PERFORM set_config('event_village.table_booking', 'on', true);
    UPDATE public.table_reservations SET booking_state = 'ARRIVEE', arrived_at = now(), updated_at = now() WHERE id = r.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'TABLE_GUEST_ARRIVED', 'table_reservations', r.id,
            jsonb_build_object('booking_state', r.booking_state), jsonb_build_object('booking_state', 'ARRIVEE'));
    RETURN jsonb_build_object('ok', true, 'reservation_id', r.id, 'booking_state', 'ARRIVEE');
END;
$$;

CREATE OR REPLACE FUNCTION public.table_onsite_payment_record(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_res_id uuid := public.try_uuid(p->>'reservation_id');
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_method text := upper(COALESCE(p->>'method', ''));
    v_amount numeric;
    r        record;
BEGIN
    BEGIN
        v_amount := (p->>'amount')::numeric;
    EXCEPTION WHEN others THEN
        v_amount := NULL;
    END;
    IF v_amount IS NULL OR v_amount < 1 OR v_amount > 10000000 OR v_amount <> trunc(v_amount) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT', 'message', 'Indiquez un montant en francs CFA, sans centimes, supérieur à 0.');
    END IF;
    IF v_method NOT IN ('ESPECES', 'WAVE_DIRECT', 'OM_DIRECT', 'AUTRE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_METHOD', 'message', 'Choisissez le moyen de paiement : espèces, Wave, Orange Money ou autre.');
    END IF;
    IF v_res_id IS NULL OR public.table_lock_reservation(v_res_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    SELECT tr.*, pa.user_id AS owner_id INTO r
      FROM public.table_reservations tr JOIN public.partners pa ON pa.id = tr.partner_id
     WHERE tr.id = v_res_id FOR UPDATE OF tr;
    IF v_actor IS NULL OR v_actor <> r.owner_id
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    IF r.booking_state NOT IN ('CONFIRMEE', 'ARRIVEE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_RECORDABLE', 'message', 'Le paiement sur place s’enregistre pour une réservation confirmée ou un client arrivé.');
    END IF;
    -- T4 : enregistré sur la réservation seulement ; ni ligne de paiement, ni grand livre, ni état de paiement changé
    PERFORM set_config('event_village.table_booking', 'on', true);
    UPDATE public.table_reservations
       SET onsite_amount = v_amount, offline_payment_method = v_method::public.offline_payment_method_enum,
           onsite_recorded_at = now(), onsite_recorded_by = v_actor, updated_at = now()
     WHERE id = r.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'TABLE_ONSITE_PAYMENT_RECORDED', 'table_reservations', r.id,
            jsonb_build_object('onsite_amount', r.onsite_amount, 'method', r.offline_payment_method),
            jsonb_build_object('onsite_amount', v_amount, 'method', v_method));
    RETURN jsonb_build_object('ok', true, 'reservation_id', r.id, 'onsite_amount', v_amount, 'method', v_method);
END;
$$;

-- Tâche planifiée (/api/cron/tables, toutes les 5 minutes). Idempotente : chaque passage ne traite que ce qui reste.
CREATE OR REPLACE FUNCTION public.table_reservations_tick()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_holds     integer := 0;
    v_unanswered integer := 0;
    v_no_shows  integer := 0;
    v_reminders integer := 0;
    v_ids       uuid[] := ARRAY[]::uuid[];
    v_now       timestamp := public.hall_dakar_now();
    v_grace     interval := public.fin_setting_num('tables.no_show_minutes') * interval '1 minute';
    v_remind    interval := public.fin_setting_num('tables.reminder_hours') * interval '1 hour';
    r           record;
    rr          record;
    v_res       jsonb;
BEGIN
    FOR r IN SELECT id, venue_id FROM public.table_reservations
              WHERE booking_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at <= now() ORDER BY hold_expires_at LOOP
        PERFORM public.table_venue_lock(r.venue_id);
        IF public.table_expire_hold(r.id) THEN
            v_holds := v_holds + 1;
        END IF;
    END LOOP;

    FOR r IN SELECT id, venue_id FROM public.table_reservations
              WHERE booking_state = 'EN_ATTENTE_ACCEPTATION' AND response_due_at <= now() ORDER BY response_due_at LOOP
        PERFORM public.table_venue_lock(r.venue_id);
        SELECT * INTO rr FROM public.table_reservations WHERE id = r.id FOR UPDATE;
        IF rr.booking_state <> 'EN_ATTENTE_ACCEPTATION' OR rr.response_due_at > now() THEN
            CONTINUE;
        END IF;
        v_res := public.table_close_apply(rr.id, 'SANS_REPONSE', 'SANS_REPONSE', NULL, 'Pas de réponse de l’établissement à temps', 100);
        v_ids := v_ids || ARRAY(SELECT jsonb_array_elements_text(v_res->'cashout_ids')::uuid);
        v_unanswered := v_unanswered + 1;
    END LOOP;

    FOR r IN SELECT id, venue_id FROM public.table_reservations
              WHERE booking_state = 'CONFIRMEE' AND lower(slot) + v_grace <= v_now ORDER BY lower(slot) LOOP
        PERFORM public.table_venue_lock(r.venue_id);
        SELECT * INTO rr FROM public.table_reservations WHERE id = r.id FOR UPDATE;
        IF rr.booking_state <> 'CONFIRMEE' OR lower(rr.slot) + v_grace > v_now THEN
            CONTINUE;
        END IF;
        PERFORM public.table_close_apply(rr.id, 'ABSENT', NULL, NULL, 'Client absent', 0);
        v_no_shows := v_no_shows + 1;
    END LOOP;

    FOR r IN SELECT id FROM public.table_reservations
              WHERE booking_state = 'CONFIRMEE' AND v_now >= lower(slot) - v_remind AND v_now < lower(slot) LOOP
        v_reminders := v_reminders + public.table_notify('TABLE_REMINDER', r.id, 'CLIENT');
    END LOOP;

    RETURN jsonb_build_object('expired_holds', v_holds, 'unanswered', v_unanswered, 'no_shows', v_no_shows,
                              'reminders', v_reminders, 'cashout_ids', to_jsonb(v_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.table_refund_payment(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_close_apply(uuid, text, text, uuid, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_lock_reservation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_reservation_cancel(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_reservation_respond(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_reservation_presence(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_onsite_payment_record(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_reservations_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.table_refund_payment(uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_close_apply(uuid, text, text, uuid, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_lock_reservation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_reservation_cancel(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_reservation_respond(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_reservation_presence(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_onsite_payment_record(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_reservations_tick() TO service_role;


-- Recopie de 20261122000005_l10a_annulation.sql:294-569 ; changement : aucun avis PAYMENT_REFUND_STARTED pour un paiement de table non plus.
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
    -- Lot 11a : de même pour le remboursement d'une réservation de table
    IF TG_OP = 'INSERT' AND NEW.kind = 'REFUND' AND (v_user IS NOT NULL OR v_phone IS NOT NULL)
       AND NOT EXISTS (SELECT 1 FROM public.payments hp WHERE hp.id = NEW.payment_id
                          AND hp.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION')) THEN
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
