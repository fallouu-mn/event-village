-- ============================================================================
-- EVENT VILLAGE — LOT 11a, migration 04 : réserver une table (une seule fonction en base, argent calculé en base)
-- ============================================================================
-- Trous T1, T2, T3, T5, T6 de l'état des lieux du 18/11 : la route prenait la première table venue (même trop petite
-- ou déjà prise), acceptait une réservation sans table, ne vérifiait ni la partenaire ni la capacité, fixait
-- l'acompte à 5 000 F par personne en dur, n'expirait rien, fixait le créneau à 2 h et ne contrôlait ni la date passée
-- ni les horaires.
--  1. table_notif_data(id), table_notify(type, réservation, destinataire, données) : avis du parcours (données en F
--     CFA, date et heure de Dakar), clé d'idempotence par type et réservation ;
--  2. table_client_refund_percent(début, instant, heures) : acompte rendu (100) si le client annule au moins N heures
--     avant l'heure, sinon rien (0) ;
--  3. venue_hours_set(p) : horaires d'un établissement, par sa partenaire seulement ; plages valides, sans
--     chevauchement le même jour ; journal ;
--  4. table_expire_hold(id) : attente de paiement échue, la table est rendue, avis au client ;
--     drapeau event_village.table_booking posé pour la transaction de l'appel seulement (set_config local) : il
--     n'est jamais remis à « off » au milieu d'une fonction, pour ne pas couper celle qui l'appelle ;
--  5. table_reserve(p) : service ouvert, compte actif, établissement actif et validé, partenaire VALIDE, pas son
--     propre établissement, date et heure à venir (au quart d'heure, 90 jours au plus), dans les horaires pour tout le
--     créneau, nombre de personnes 1 à 50, demandes en attente au plus tables.max_pending_per_client, table de cet
--     établissement et de la bonne capacité (choisie par le client, ou la plus petite qui convient, dans la zone
--     choisie), aucun chevauchement (verrou de l'établissement, puis contrainte d'exclusion), montants calculés en
--     base, confirmation automatique, demande à accepter ou attente du paiement de l'acompte ; journal et avis.
-- Toutes réservées au rôle de service (routes serveur). Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- Heure de Dakar = UTC toute l'année : les dates et heures saisies sont celles de Dakar.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.table_notif_data(p_reservation_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_strip_nulls(jsonb_build_object(
        'reservation_id', r.id,
        'venue_id', r.venue_id,
        'venue_name', v.name,
        'date', r.reservation_date,
        'time', to_char(r.reservation_time, 'HH24:MI'),
        'end_time', to_char(upper(r.slot), 'HH24:MI'),
        'guests', r.guest_count,
        'table_number', t.table_number,
        'deposit_amount', r.deposit_amount,
        'total_amount', r.total_amount,
        'paid_amount', r.paid_amount,
        'response_due_at', CASE WHEN r.booking_state = 'EN_ATTENTE_ACCEPTATION' THEN r.response_due_at END))
      FROM public.table_reservations r
      JOIN public.venues v ON v.id = r.venue_id
      LEFT JOIN public.restaurant_tables t ON t.id = r.table_id
     WHERE r.id = p_reservation_id;
$$;

-- Avis d'une étape : au client ('CLIENT') ou à la partenaire propriétaire ('OWNER') ; une fois par type et réservation
CREATE OR REPLACE FUNCTION public.table_notify(p_type text, p_reservation_id uuid, p_to text, p_extra jsonb DEFAULT '{}'::jsonb)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid;
BEGIN
    IF p_to = 'CLIENT' THEN
        SELECT r.client_id INTO v_user FROM public.table_reservations r WHERE r.id = p_reservation_id;
    ELSE
        SELECT pa.user_id INTO v_user
          FROM public.table_reservations r JOIN public.partners pa ON pa.id = r.partner_id
         WHERE r.id = p_reservation_id;
    END IF;
    IF v_user IS NULL THEN
        RETURN 0;
    END IF;
    RETURN COALESCE(public.notif_enqueue(jsonb_build_object(
        'type', p_type, 'key', p_type || ':' || p_reservation_id::text || ':' || v_user::text,
        'user_id', v_user,
        'data', COALESCE(public.table_notif_data(p_reservation_id), '{}'::jsonb) || COALESCE(p_extra, '{}'::jsonb))), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.table_client_refund_percent(p_start timestamp, p_at timestamp, p_free_hours numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT CASE WHEN p_start - p_at >= COALESCE(p_free_hours, 0) * interval '1 hour' THEN 100::numeric ELSE 0::numeric END;
$$;

-- Verrou d'un établissement : une écriture de réservation à la fois (fin de transaction)
CREATE OR REPLACE FUNCTION public.table_venue_lock(p_venue_id uuid)
RETURNS void
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$ SELECT pg_advisory_xact_lock(hashtextextended('table_reservations:' || p_venue_id::text, 0)) $$;

CREATE OR REPLACE FUNCTION public.venue_hours_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    v          record;
    h          jsonb;
    v_day      integer;
    v_open     time;
    v_close    time;
    v_rows     jsonb := '[]'::jsonb;
    v_old      jsonb;
BEGIN
    SELECT ve.*, pa.user_id AS owner_id INTO v
      FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id
     WHERE ve.id = v_venue_id FOR UPDATE OF ve;
    IF v_venue_id IS NULL OR NOT FOUND OR v_actor IS NULL OR v.owner_id <> v_actor
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_FOUND', 'message', 'Cet établissement n’existe pas ou n’est pas le vôtre.');
    END IF;
    IF jsonb_typeof(p->'hours') <> 'array' OR jsonb_array_length(p->'hours') > 28 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_HOURS', 'message', 'Indiquez les horaires jour par jour (4 plages au plus par jour).');
    END IF;
    FOR h IN SELECT * FROM jsonb_array_elements(p->'hours') LOOP
        BEGIN
            v_day := (h->>'weekday')::int;
            v_open := (h->>'opens_at')::time;
            v_close := (h->>'closes_at')::time;
        EXCEPTION WHEN others THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_HOURS', 'message', 'Une heure d’ouverture ou de fermeture n’est pas valable.');
        END;
        IF v_day IS NULL OR v_day NOT BETWEEN 1 AND 7 OR v_open IS NULL OR v_close IS NULL OR v_open >= time '24:00'
           OR v_open = v_close OR EXTRACT(SECOND FROM v_open) <> 0 OR EXTRACT(SECOND FROM v_close) <> 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_HOURS', 'message', 'Une plage d’ouverture n’est pas valable : choisissez le jour, puis une heure d’ouverture et de fermeture différentes.');
        END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_rows) o
                    WHERE (o->>'weekday')::int = v_day
                      AND public.venue_range(date '2001-01-01', (o->>'opens_at')::time, (o->>'closes_at')::time)
                          && public.venue_range(date '2001-01-01', v_open, v_close)) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'OVERLAPPING_HOURS', 'message', 'Deux plages du même jour se chevauchent : corrigez les horaires.');
        END IF;
        v_rows := v_rows || jsonb_build_object('weekday', v_day, 'opens_at', v_open, 'closes_at', v_close);
    END LOOP;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('weekday', weekday, 'opens_at', opens_at, 'closes_at', closes_at) ORDER BY weekday, opens_at), '[]'::jsonb)
      INTO v_old FROM public.venue_opening_hours WHERE venue_id = v.id;
    DELETE FROM public.venue_opening_hours WHERE venue_id = v.id;
    INSERT INTO public.venue_opening_hours (venue_id, weekday, opens_at, closes_at)
    SELECT v.id, (o->>'weekday')::smallint, (o->>'opens_at')::time, (o->>'closes_at')::time FROM jsonb_array_elements(v_rows) o;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'VENUE_HOURS_SET', 'venues', v.id, jsonb_build_object('hours', v_old), jsonb_build_object('hours', v_rows));
    RETURN jsonb_build_object('ok', true, 'venue_id', v.id, 'count', jsonb_array_length(v_rows));
END;
$$;

-- Attente de paiement échue : la table est rendue (« Non payée à temps »), avis au client. Sous le verrou de l'établissement.
CREATE OR REPLACE FUNCTION public.table_expire_hold(p_reservation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r record;
BEGIN
    SELECT * INTO r FROM public.table_reservations WHERE id = p_reservation_id FOR UPDATE;
    IF NOT FOUND OR r.booking_state <> 'EN_ATTENTE_PAIEMENT' OR r.hold_expires_at > now() OR r.paid_amount > 0 THEN
        RETURN FALSE;
    END IF;
    PERFORM set_config('event_village.table_booking', 'on', true);
    UPDATE public.table_reservations
       SET booking_state = 'EXPIREE', payment_status = 'CANCELLED', hold_expires_at = NULL, updated_at = now()
     WHERE id = r.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (NULL, 'SYSTEM', 'TABLE_HOLD_EXPIRED', 'table_reservations', r.id,
            jsonb_build_object('booking_state', r.booking_state), jsonb_build_object('booking_state', 'EXPIREE'));
    PERFORM public.table_notify('TABLE_HOLD_EXPIRED', r.id, 'CLIENT');
    RETURN TRUE;
END;
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
    v_pending  integer;
    v_max      integer := public.fin_setting_num('tables.max_pending_per_client')::int;
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
    SELECT count(*) INTO v_pending FROM public.table_reservations
     WHERE client_id = v_client
       AND ((booking_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at > now()) OR booking_state = 'EN_ATTENTE_ACCEPTATION');
    IF v_pending >= v_max THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_PENDING',
            'message', format('Vous avez déjà %s demandes en attente. Attendez une réponse ou annulez-en une.', v_pending));
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

REVOKE ALL ON FUNCTION public.table_notif_data(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_notify(text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_client_refund_percent(timestamp, timestamp, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_venue_lock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.venue_hours_set(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_expire_hold(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_reserve(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.table_notif_data(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_notify(text, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_client_refund_percent(timestamp, timestamp, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_venue_lock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_hours_set(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_expire_hold(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.table_reserve(jsonb) TO service_role;
