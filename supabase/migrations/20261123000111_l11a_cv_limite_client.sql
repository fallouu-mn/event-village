-- ============================================================================
-- EVENT VILLAGE — LOT 11a, correctifs de la contre-vérification (docs/audit-lot11a.md), migration 111 : T2
-- ============================================================================
-- T2 (moyenne) : la limite de table_reserve ne comptait que les demandes « En attente de paiement » et « En attente de
-- réponse ». Une réservation gratuite à confirmation automatique (réglage par défaut d'un établissement) était
-- confirmée tout de suite et jamais comptée : un seul compte tenait toutes les tables d'un établissement (6 sur 6) au
-- même créneau, sans rien risquer, et le client suivant recevait « Aucune table libre ».
--  1. table_client_unpaid_refusal(client, réservation exclue) : au plus tables.max_pending_per_client (3 par défaut)
--     réservations À VENIR NON PAYÉES par client : attente de paiement en cours, demande sans acompte payé en attente de
--     réponse, réservation gratuite confirmée dont l'heure n'est pas passée. Une demande dont l'acompte est payé n'est
--     plus comptée (de l'argent est engagé). NULL sous la limite, sinon le refus (TOO_MANY_PENDING ; message des
--     demandes en attente inchangé quand aucune gratuite confirmée n'est comptée) ;
--  2. table_client_slot_refusal(client, établissement, créneau, réservation exclue) : une seule table par client et
--     par créneau dans un même établissement (toute réservation qui tient une table, payée ou non) ; NULL si libre ;
--  3. table_reserve : recopie de 20261123000104_l11a_reserver.sql:186-384 ; changement : sous le verrou par client
--     (inchangé, après celui de l'établissement), une table par créneau dans l'établissement, puis la limite (1) au
--     lieu du seul compte des demandes en attente ;
--  4. table_payment_create : recopie de 20261123000110_l11a_cv_paiement_plafond.sql:16-146 ; changement : avant de
--     reprendre une attente échue, sous le même verrou par client, une table par créneau dans l'établissement et la
--     même limite (1), la réservation reprise exclue.
-- Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.table_client_unpaid_refusal(p_client uuid, p_exclude uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max     integer := public.fin_setting_num('tables.max_pending_per_client')::int;
    v_pending integer;
    v_free    integer;
BEGIN
    SELECT count(*) FILTER (WHERE booking_state <> 'CONFIRMEE'), count(*) FILTER (WHERE booking_state = 'CONFIRMEE')
      INTO v_pending, v_free
      FROM public.table_reservations
     WHERE client_id = p_client AND id IS DISTINCT FROM p_exclude AND paid_amount = 0
       AND ((booking_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at > now())
            OR booking_state = 'EN_ATTENTE_ACCEPTATION'
            OR (booking_state = 'CONFIRMEE' AND lower(slot) > public.hall_dakar_now()));
    IF v_pending + v_free < v_max THEN
        RETURN NULL;
    END IF;
    IF v_free = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_PENDING',
            'message', format('Vous avez déjà %s demandes en attente. Attendez une réponse ou annulez-en une.', v_pending));
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_PENDING',
        'message', format('Vous avez déjà %s réservations à venir sans acompte payé. Annulez-en une pour réserver une autre table.', v_pending + v_free));
END;
$$;

CREATE OR REPLACE FUNCTION public.table_client_slot_refusal(p_client uuid, p_venue_id uuid, p_slot tsrange, p_exclude uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object('ok', false, 'code', 'CLIENT_SLOT_TAKEN',
               'message', 'Vous avez déjà une table dans cet établissement à cette heure-là.')
     WHERE EXISTS (SELECT 1 FROM public.table_reservations o
                    WHERE o.client_id = p_client AND o.venue_id = p_venue_id AND o.id IS DISTINCT FROM p_exclude
                      AND o.status::text IN ('EN_ATTENTE', 'CONFIRMEE') AND o.slot && p_slot);
$$;

CREATE OR REPLACE FUNCTION public.table_reserve(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client   uuid := public.try_uuid(p->>'client_id');
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    v_table_id uuid := public.try_uuid(NULLIF(p->>'table_id', ''));
    v_zone_id  uuid := public.try_uuid(NULLIF(p->>'zone_id', ''));
    v_date     date;
    v_time     time;
    v_guests   integer;
    v          record;
    t          record;
    h          record;
    v_now      timestamp := public.hall_dakar_now();
    v_start    timestamp;
    v_slot_min integer;
    v_slot     tsrange;
    v_refusal  jsonb;
    v_deposit  numeric := 0;
    v_rate     numeric := public.fin_setting_num('tables.service_fee_rate');
    v_fee      numeric := 0;
    v_state    text;
    v_hold     timestamptz;
    v_due      timestamptz;
    v_id       uuid;
BEGIN
    IF NOT public.fin_setting_bool('features.tables_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SERVICE_CLOSED', 'message', 'La réservation de tables n’est pas encore ouverte.');
    END IF;
    IF v_client IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_client AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte ne permet pas de réserver pour le moment.');
    END IF;
    IF v_venue_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.venues WHERE id = v_venue_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_FOUND', 'message', 'Cet établissement n’existe pas ou n’est plus proposé.');
    END IF;
    BEGIN
        v_date := (p->>'date')::date;
        v_time := (p->>'time')::time;
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATE', 'message', 'La date ou l’heure choisie n’est pas valable.');
    END;
    IF v_date IS NULL OR v_time IS NULL OR v_time >= time '24:00' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATE', 'message', 'La date ou l’heure choisie n’est pas valable.');
    END IF;
    IF EXTRACT(SECOND FROM v_time) <> 0 OR EXTRACT(MINUTE FROM v_time)::int % 15 <> 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TIME', 'message', 'Choisissez une heure au quart d’heure près (par exemple 20:00, 20:15 ou 20:30).');
    END IF;
    BEGIN
        v_guests := (p->>'guests')::int;
    EXCEPTION WHEN others THEN
        v_guests := NULL;
    END;
    IF v_guests IS NULL OR v_guests < 1 OR v_guests > 50 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_GUESTS', 'message', 'Indiquez un nombre de personnes entre 1 et 50.');
    END IF;

    -- Une écriture à la fois par établissement, puis attentes de paiement échues rendues
    PERFORM public.table_venue_lock(v_venue_id);
    FOR h IN SELECT id FROM public.table_reservations
              WHERE venue_id = v_venue_id AND booking_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at <= now() LOOP
        PERFORM public.table_expire_hold(h.id);
    END LOOP;

    SELECT ve.*, pa.status::text AS partner_status, pa.user_id AS owner_id INTO v
      FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id
     WHERE ve.id = v_venue_id;
    IF NOT v.is_active OR v.partner_status <> 'VALIDE'
       OR (v.validation_status <> 'VALIDEE'
           AND (public.fin_setting_bool('tables.validation_required') OR v.validation_status IN ('REFUSEE', 'SUSPENDUE'))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_AVAILABLE', 'message', 'Cet établissement n’accepte pas de réservation pour le moment.');
    END IF;
    IF v.owner_id = v_client THEN
        RETURN jsonb_build_object('ok', false, 'code', 'OWN_VENUE', 'message', 'Vous ne pouvez pas réserver dans votre propre établissement.');
    END IF;

    v_start := v_date + v_time;
    IF v_start <= v_now THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DATE_PASSED', 'message', 'Choisissez une date et une heure à venir.');
    END IF;
    IF v_start > v_now + interval '90 days' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DATE_TOO_FAR', 'message', 'La date doit être dans les 90 jours à venir.');
    END IF;
    v_slot_min := COALESCE(v.slot_minutes, public.fin_setting_num('tables.slot_minutes')::int);
    v_slot := tsrange(v_start, v_start + v_slot_min * interval '1 minute', '[)');
    IF NOT public.venue_open_covers(v.id, v_slot) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'OUTSIDE_HOURS', 'message', 'L’établissement n’est pas ouvert à cette heure-là. Choisissez une autre heure.');
    END IF;

    -- Équivalent côté tables du trou T5 de la contre-vérification de la 10a : verrou par client (après celui de
    -- l'établissement, toujours dans cet ordre) avant de compter ses demandes : deux demandes simultanées du même client
    -- dans deux établissements ne passent pas toutes les deux
    PERFORM pg_advisory_xact_lock(hashtextextended('table_client:' || v_client::text, 0));
    -- Contre-vérification de la 11a (T2) : une seule table par client et par créneau dans cet établissement, puis au
    -- plus tables.max_pending_per_client réservations à venir non payées (gratuites confirmées comprises)
    v_refusal := COALESCE(public.table_client_slot_refusal(v_client, v.id, v_slot, NULL),
                          public.table_client_unpaid_refusal(v_client, NULL));
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;

    -- Zone et table : de cet établissement seulement
    IF v_zone_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.restaurant_zones z WHERE z.id = v_zone_id AND z.venue_id = v.id AND z.is_active) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ZONE_NOT_FOUND', 'message', 'Cette zone n’existe pas dans cet établissement.');
    END IF;
    IF v_table_id IS NOT NULL THEN
        SELECT * INTO t FROM public.restaurant_tables
         WHERE id = v_table_id AND venue_id = v.id AND is_active AND (v_zone_id IS NULL OR zone_id = v_zone_id);
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TABLE_NOT_FOUND', 'message', 'Cette table n’existe pas dans cet établissement.');
        END IF;
        IF v_guests > t.capacity OR v_guests < t.min_capacity THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TABLE_TOO_SMALL',
                'message', format('Cette table accueille de %s à %s personnes.', t.min_capacity, t.capacity));
        END IF;
        IF EXISTS (SELECT 1 FROM public.table_reservations o
                    WHERE o.table_id = t.id AND o.status::text IN ('EN_ATTENTE', 'CONFIRMEE') AND o.slot && v_slot) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN', 'message', 'Cette table est déjà réservée à cette heure-là. Choisissez une autre heure ou une autre table.');
        END IF;
    ELSE
        IF NOT EXISTS (SELECT 1 FROM public.restaurant_tables c
                        WHERE c.venue_id = v.id AND c.is_active AND (v_zone_id IS NULL OR c.zone_id = v_zone_id)
                          AND v_guests BETWEEN c.min_capacity AND c.capacity) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NO_TABLE_FITS',
                'message', format('Aucune table ne peut accueillir %s personnes. Contactez l’établissement.', v_guests));
        END IF;
        -- La plus petite table qui convient et qui est libre sur tout le créneau
        SELECT c.* INTO t FROM public.restaurant_tables c
         WHERE c.venue_id = v.id AND c.is_active AND (v_zone_id IS NULL OR c.zone_id = v_zone_id)
           AND v_guests BETWEEN c.min_capacity AND c.capacity
           AND NOT EXISTS (SELECT 1 FROM public.table_reservations o
                            WHERE o.table_id = c.id AND o.status::text IN ('EN_ATTENTE', 'CONFIRMEE') AND o.slot && v_slot)
         ORDER BY c.capacity, c.table_number, c.id
         LIMIT 1;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NO_TABLE_FREE', 'message', 'Aucune table libre à cette heure-là. Choisissez une autre heure.');
        END IF;
    END IF;

    -- Argent, figé à la création : acompte par personne × personnes, frais de service arrondis au franc supérieur
    IF v.deposit_per_person IS NOT NULL THEN
        v_deposit := v.deposit_per_person * v_guests;
        v_fee := public.fin_round_up(v_deposit * v_rate / 100);
    END IF;
    IF v_deposit > 0 THEN
        v_state := 'EN_ATTENTE_PAIEMENT';
        v_hold := now() + make_interval(mins => public.fin_setting_num('tables.hold_minutes')::int);
    ELSIF v.confirmation_mode = 'MANUELLE' THEN
        v_state := 'EN_ATTENTE_ACCEPTATION';
        v_due := LEAST(now() + make_interval(mins => public.fin_setting_num('tables.response_minutes')::int), v_start AT TIME ZONE 'Africa/Dakar');
    ELSE
        v_state := 'CONFIRMEE';
    END IF;

    PERFORM set_config('event_village.table_booking', 'on', true);
    BEGIN
        INSERT INTO public.table_reservations (
            partner_id, venue_id, table_id, zone_id, client_id, reservation_date, reservation_time, guest_count, slot_minutes,
            booking_state, confirmation_mode, deposit_per_person, deposit_amount, service_fee_rate, service_fee_amount, total_amount,
            commission_rate, is_platform_payment, payment_status, hold_expires_at, response_due_at, confirmed_at, special_requests)
        VALUES (
            v.partner_id, v.id, t.id, t.zone_id, v_client, v_date, v_time, v_guests, v_slot_min,
            v_state, v.confirmation_mode, v.deposit_per_person, v_deposit, CASE WHEN v_deposit > 0 THEN v_rate END, v_fee, v_deposit + v_fee,
            CASE WHEN v_deposit > 0 THEN public.fin_setting_num('tables.commission_rate') END, v_deposit > 0, 'PENDING',
            v_hold, v_due, CASE WHEN v_state = 'CONFIRMEE' THEN now() END,
            NULLIF(left(btrim(regexp_replace(COALESCE(p->>'notes', ''), '[[:cntrl:]]', ' ', 'g')), 500), ''))
        RETURNING id INTO v_id;
    EXCEPTION WHEN exclusion_violation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_TABLE_FREE', 'message', 'Aucune table libre à cette heure-là. Choisissez une autre heure.');
    END;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value, metadata)
    VALUES (v_client, 'CLIENT', 'TABLE_RESERVATION_CREATED', 'table_reservations', v_id,
            jsonb_build_object('booking_state', v_state, 'total_amount', v_deposit + v_fee, 'table_id', t.id),
            jsonb_build_object('venue_id', v.id, 'date', v_date, 'time', v_time, 'guests', v_guests, 'slot_minutes', v_slot_min));

    IF v_state = 'CONFIRMEE' THEN
        PERFORM public.table_notify('TABLE_RESERVATION_CONFIRMED', v_id, 'CLIENT');
        PERFORM public.table_notify('TABLE_NEW_RESERVATION', v_id, 'OWNER');
    ELSIF v_state = 'EN_ATTENTE_ACCEPTATION' THEN
        PERFORM public.table_notify('TABLE_REQUEST_SENT', v_id, 'CLIENT');
        PERFORM public.table_notify('TABLE_REQUEST_TO_ANSWER', v_id, 'OWNER');
    END IF;

    RETURN jsonb_build_object(
        'ok', true, 'reservation_id', v_id, 'booking_state', v_state,
        'venue_id', v.id, 'venue_name', v.name, 'table_id', t.id, 'table_number', t.table_number, 'zone_id', t.zone_id,
        'date', v_date, 'time', to_char(v_time, 'HH24:MI'), 'end_time', to_char(upper(v_slot), 'HH24:MI'), 'guests', v_guests,
        'deposit_amount', v_deposit, 'service_fee_amount', v_fee, 'total_amount', v_deposit + v_fee,
        'hold_expires_at', v_hold, 'response_due_at', v_due,
        'cancel_free_hours', public.fin_setting_num('tables.cancel_free_hours'));
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
    -- table_reserve ; équivalent côté tables des trous T2 et T5 de la contre-vérification de la 10a). Contre-vérification
    -- de la 11a (T2) : une seule table par client et par créneau dans l'établissement, et la même limite que
    -- table_reserve (réservations à venir non payées, gratuites confirmées comprises), la réservation reprise exclue
    IF r.booking_state = 'EXPIREE' OR r.hold_expires_at IS NULL OR r.hold_expires_at <= now() THEN
        PERFORM pg_advisory_xact_lock(hashtextextended('table_client:' || v_client::text, 0));
        v_refusal := COALESCE(public.table_client_slot_refusal(v_client, r.venue_id, r.slot, r.id),
                              public.table_client_unpaid_refusal(v_client, r.id));
        IF v_refusal IS NOT NULL THEN
            RETURN v_refusal;
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

REVOKE ALL ON FUNCTION public.table_client_unpaid_refusal(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_client_slot_refusal(uuid, uuid, tsrange, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_reserve(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_payment_create(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.table_client_unpaid_refusal(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_client_slot_refusal(uuid, uuid, tsrange, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_reserve(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_payment_create(jsonb) TO service_role;
