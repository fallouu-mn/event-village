-- ============================================================================
-- EVENT VILLAGE — LOT 10b, migration 04 : correctifs de la contre-vérification (docs/audit-lot10b.md)
-- ============================================================================
--  T1 (moyenne) : hall_reservation_cancel, recopie de 20261122000005_l10a_annulation.sql:159-221 ; changement : l'origine SALLE exige
--     la fiche partenaire VALIDE (une fiche suspendue n'annule plus ; Event Village annule pour elle) ;
--  T3 (faible) : hall_quote, recopie de 20261122000010_l10a_cv_paiement_en_une_fois.sql:164-294, et hall_booking_refusal, recopie de
--     20261122000009_l10a_cv_relance.sql:20-43 ; changement : salle VALIDEE exigée quel que soit halls.validation_required ;
--  T4 (faible) et T4 bis (tables) : lecture publique d'une salle, d'un établissement, de ses zones et de ses tables
--     seulement si la partenaire est VALIDE (partner_listed, lisible par anon : ne rend qu'un booléen) ;
--  T5 (moyenne) et T5 bis (tables) : la salle et l'établissement ne lisent plus leurs réservations par la REST (le
--     client lit les siennes, l'administration avec le code) ; leurs écrans passent par les routes serveur ;
--  T6 (faible) : notif_admin_review_sms, recopie de 20261126000001_l10b_droit_validation.sql:174-274 ; changement : élément HALL_CHANGED
--     (salle validée modifiée, compté dans hall_changed_count) ; halls_notify_admins, recopie de 20261126000003_l10b_avis.sql:45-91 ;
--     changement : SMS groupé (reporté à la fin de la nuit) avec ADMIN_HALL_CHANGED ;
--  T7 (faible) : hall_reservations_tick, recopie de 20261126000003_l10b_avis.sql:202-311 ; changement : rappels du solde 3 jours puis
--     1 jour avant son échéance (au lieu de J-10 et J-8 de la date), quel que soit halls.balance_due_days.
-- Rejouable : CREATE OR REPLACE (droits conservés), DROP POLICY IF EXISTS puis CREATE, REVOKE et GRANT idempotents.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- T4 et T4 bis : partenaire VALIDE pour la lecture publique
-- ----------------------------------------------------------------------------
-- Booléen seul (la fiche partenaire reste illisible par anon) ; utilisé par les règles de lecture publique.
CREATE OR REPLACE FUNCTION public.partner_listed(p_partner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.partners pa WHERE pa.id = p_partner_id AND pa.status::text = 'VALIDE');
$$;
REVOKE ALL ON FUNCTION public.partner_listed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_listed(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "halls_read_public" ON public.halls;
CREATE POLICY "halls_read_public" ON public.halls
    FOR SELECT USING (
        (is_active = TRUE AND validation_status = 'VALIDEE' AND public.partner_listed(partner_id))
        OR public.is_partner_owner(partner_id)
        OR public.is_admin());

DROP POLICY IF EXISTS "venues_read" ON public.venues;
CREATE POLICY "venues_read" ON public.venues
    FOR SELECT USING (
        (is_active = TRUE AND validation_status = 'VALIDEE' AND public.partner_listed(partner_id))
        OR public.is_partner_owner(partner_id)
        OR public.is_admin());

DROP POLICY IF EXISTS "restaurant_zones_read" ON public.restaurant_zones;
CREATE POLICY "restaurant_zones_read" ON public.restaurant_zones
    FOR SELECT USING (
        (is_active = TRUE AND venue_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.venues v WHERE v.id = restaurant_zones.venue_id AND v.is_active AND v.validation_status = 'VALIDEE'
                                                     AND public.partner_listed(v.partner_id)))
        OR public.is_partner_owner(partner_id)
        OR public.is_admin());

DROP POLICY IF EXISTS "restaurant_tables_read" ON public.restaurant_tables;
CREATE POLICY "restaurant_tables_read" ON public.restaurant_tables
    FOR SELECT USING (
        (is_active = TRUE AND venue_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.venues v WHERE v.id = restaurant_tables.venue_id AND v.is_active AND v.validation_status = 'VALIDEE'
                                                     AND public.partner_listed(v.partner_id)))
        OR public.is_partner_owner(partner_id)
        OR public.is_admin());

-- ----------------------------------------------------------------------------
-- T5 et T5 bis : réservations lues par la REST : le client (les siennes), l'administration (code administrateur)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "hall_reservations_read" ON public.hall_reservations;
CREATE POLICY "hall_reservations_read" ON public.hall_reservations
    FOR SELECT USING (client_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "table_reservations_read" ON public.table_reservations;
CREATE POLICY "table_reservations_read" ON public.table_reservations
    FOR SELECT USING (client_id = auth.uid() OR public.is_admin());

-- ----------------------------------------------------------------------------
-- T1 : annulation par la salle, fiche VALIDE exigée
-- ----------------------------------------------------------------------------
-- Recopie de 20261122000005_l10a_annulation.sql:159-221 ; changement : refus PARTNER_SUSPENDED pour une fiche non VALIDE (origine SALLE).
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
    -- Contre-vérification du lot 10b (T1) : une fiche partenaire non VALIDE (suspendue) n'annule plus ; Event Village
    -- annule pour elle (motif, remboursement total)
    IF v_origin = 'SALLE' AND NOT EXISTS (SELECT 1 FROM public.partners pa WHERE pa.id = r.partner_id AND pa.status::text = 'VALIDE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED',
            'message', 'Votre compte organisateur est suspendu : l’annulation d’une réservation passe par Event Village. Contactez le support.');
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

-- ----------------------------------------------------------------------------
-- T3 : salle validée exigée pour le devis et pour tout paiement
-- ----------------------------------------------------------------------------
-- Recopie de 20261122000010_l10a_cv_paiement_en_une_fois.sql:164-294 ; changement : VALIDEE exigée quel que soit le réglage.
CREATE OR REPLACE FUNCTION public.hall_quote(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hall_id    uuid := public.try_uuid(p->>'hall_id');
    v_mode       text := upper(COALESCE(p->>'mode', 'JOUR'));
    v_units      integer;
    v_start_date date;
    v_start_time time;
    v_end_date   date;
    v_end_time   time;
    h            record;
    v_unit_price numeric;
    v_price      numeric;
    v_rate       numeric;
    v_fee        numeric;
    v_total      numeric;
    v_start      timestamp;
    v_now        timestamp := public.hall_dakar_now();
    v_due_days   integer := public.fin_setting_num('halls.balance_due_days')::int;
    v_margin     integer := public.fin_setting_num('halls.full_payment_margin_hours')::int;
    v_full       boolean;
    v_dep_price  numeric;
    v_dep_fee    numeric;
    v_pct        numeric;
BEGIN
    BEGIN
        v_units := (p->>'units')::int;
        v_start_date := (p->>'start_date')::date;
        v_start_time := NULLIF(p->>'start_time', '')::time;
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATES', 'message', 'La date ou l’heure choisie n’est pas valable.');
    END;
    IF v_hall_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_FOUND', 'message', 'Cette salle n’existe pas ou n’est plus proposée.');
    END IF;
    SELECT hl.*, pa.status::text AS partner_status INTO h
      FROM public.halls hl JOIN public.partners pa ON pa.id = hl.partner_id
     WHERE hl.id = v_hall_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_FOUND', 'message', 'Cette salle n’existe pas ou n’est plus proposée.');
    END IF;
    -- Contre-vérification du lot 10b (T3) : salle validée exigée, quel que soit halls.validation_required
    IF NOT h.is_active OR h.partner_status <> 'VALIDE' OR h.validation_status <> 'VALIDEE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_AVAILABLE', 'message', 'Cette salle n’est pas ouverte à la réservation pour le moment.');
    END IF;
    IF h.price_per_day IS NULL OR h.price_per_day < 1 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PRICE_MISSING', 'message', 'Cette salle n’a pas encore de prix : elle ne peut pas être réservée pour le moment.');
    END IF;
    IF v_start_date IS NULL OR v_units IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATES', 'message', 'Choisissez la date et la durée de la réservation.');
    END IF;
    IF v_mode = 'JOUR' THEN
        IF v_units < 1 OR v_units > 30 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DURATION', 'message', 'Une réservation à la journée dure de 1 à 30 jours.');
        END IF;
        v_unit_price := h.price_per_day;
        v_start_time := NULL;
        v_end_date := v_start_date + (v_units - 1);
        v_end_time := NULL;
        v_start := v_start_date + time '00:00';
    ELSIF v_mode = 'HEURE' THEN
        IF h.price_per_hour IS NULL OR h.price_per_hour < 1 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'HOURLY_NOT_OFFERED', 'message', 'Cette salle ne se loue pas à l’heure : choisissez une ou plusieurs journées.');
        END IF;
        IF v_start_time IS NULL OR EXTRACT(SECOND FROM v_start_time) <> 0
           OR EXTRACT(MINUTE FROM v_start_time) NOT IN (0, 30) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATES', 'message', 'Choisissez une heure de début à l’heure pile ou à la demie.');
        END IF;
        v_start := v_start_date + v_start_time;
        IF v_units < 1 OR v_units > 24 OR v_start + make_interval(hours => v_units) > (v_start_date + 1) + time '00:00' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DURATION', 'message', 'Une réservation à l’heure dure de 1 à 24 heures et se termine le même jour.');
        END IF;
        v_unit_price := h.price_per_hour;
        v_end_date := v_start_date;
        v_end_time := CASE WHEN v_start + make_interval(hours => v_units) = (v_start_date + 1) + time '00:00'
                           THEN time '24:00' ELSE (v_start + make_interval(hours => v_units))::time END;
    ELSE
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MODE', 'message', 'Choisissez une réservation à la journée ou à l’heure.');
    END IF;
    IF v_start <= v_now THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DATE_PASSED', 'message', 'Choisissez une date à venir.');
    END IF;
    IF v_start > v_now + interval '548 days' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DATE_TOO_FAR', 'message', 'La date doit être dans les 18 mois à venir.');
    END IF;

    v_price := v_unit_price * v_units;
    v_rate := public.fin_setting_num('halls.service_fee_rate');
    v_fee := public.fin_round_up(v_price * v_rate / 100);
    v_total := v_price + v_fee;
    -- Correctifs de la contre-vérification du lot 10a (T4) : paiement en une fois tant que l'échéance du solde
    -- (date − halls.balance_due_days) tombe dans moins de halls.full_payment_margin_hours
    v_full := v_start - v_now < make_interval(days => v_due_days) + make_interval(hours => v_margin);
    IF v_full THEN
        v_dep_price := v_price;
    ELSIF h.deposit_mode = 'MONTANT_FIXE' THEN
        v_dep_price := LEAST(h.deposit_value, v_price);
    ELSE
        v_pct := COALESCE(h.deposit_value, public.fin_setting_num('halls.deposit_default_percent'));
        v_dep_price := LEAST(GREATEST(public.fin_round_up(v_price * v_pct / 100), 1), v_price);
    END IF;
    v_dep_fee := LEAST(public.fin_round_up(v_dep_price * v_rate / 100), v_fee);
    -- Acompte égal au prix : la réservation se paie en une fois
    IF v_dep_price >= v_price THEN
        v_dep_price := v_price;
        v_dep_fee := v_fee;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'hall_id', h.id, 'partner_id', h.partner_id, 'hall_name', h.name,
        'mode', v_mode, 'units', v_units, 'unit_price', v_unit_price,
        'start_date', v_start_date, 'end_date', v_end_date, 'start_time', v_start_time, 'end_time', v_end_time,
        'start_at', v_start,
        'price_amount', v_price, 'service_fee_rate', v_rate, 'service_fee_amount', v_fee, 'total_amount', v_total,
        'commission_rate', public.fin_setting_num('halls.commission_rate'),
        'full_payment_required', v_full OR v_dep_price >= v_price,
        'deposit_price', v_dep_price, 'deposit_service_fee', v_dep_fee, 'deposit_amount', v_dep_price + v_dep_fee,
        'balance_amount', v_total - (v_dep_price + v_dep_fee),
        'balance_due_at', CASE WHEN v_full OR v_dep_price >= v_price THEN NULL
                               ELSE ((v_start - make_interval(days => v_due_days)) AT TIME ZONE 'Africa/Dakar') END,
        'cancellation_policy', h.cancellation_policy,
        'cancellation_terms', public.hall_cancel_terms(h.cancellation_policy));
END;
$$;

-- Recopie de 20261122000009_l10a_cv_relance.sql:20-43 ; changement : VALIDEE exigée quel que soit le réglage.
CREATE OR REPLACE FUNCTION public.hall_booking_refusal(p_hall_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    h record;
BEGIN
    SELECT hl.is_active, hl.validation_status, pa.status::text AS partner_status INTO h
      FROM public.halls hl JOIN public.partners pa ON pa.id = hl.partner_id
     WHERE hl.id = p_hall_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_FOUND', 'message', 'Cette salle n’existe pas ou n’est plus proposée.');
    END IF;
    -- Contre-vérification du lot 10b (T3) : salle validée exigée, quel que soit halls.validation_required
    IF NOT h.is_active OR h.partner_status <> 'VALIDE' OR h.validation_status <> 'VALIDEE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_AVAILABLE', 'message', 'Cette salle n’est pas ouverte à la réservation pour le moment.');
    END IF;
    RETURN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- T6 : SMS groupé pour une salle validée modifiée
-- ----------------------------------------------------------------------------
-- Recopie de 20261126000001_l10b_droit_validation.sql:174-274 ; changement : élément HALL_CHANGED (hall_changed_count).
CREATE OR REPLACE FUNCTION public.notif_admin_review_sms(p jsonb)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_kind    text := btrim(COALESCE(p->>'kind', ''));
    -- Lot 10b : salle envoyée en validation (HALL_SUBMITTED), comptée à part (hall_count), même droit que les établissements
    v_is_hall boolean := btrim(COALESCE(p->>'kind', '')) IN ('HALL_SUBMITTED', 'HALL_CHANGED');
    -- Contre-vérification du lot 10b (T6) : salle validée modifiée (HALL_CHANGED), comptée dans hall_changed_count
    v_changed boolean := btrim(COALESCE(p->>'kind', '')) = 'HALL_CHANGED';
    v_ref     text := NULLIF(btrim(COALESCE(p->>'ref', '')), '');
    v_company text := NULLIF(btrim(COALESCE(p->>'company', '')), '');
    v_now     timestamptz := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    v_perm    text;
    v_only    uuid[];
    v_admin   uuid;
    v_row     record;
    v_last    timestamptz;
    v_due     timestamptz;
    v_data    jsonb;
    v_refs    jsonb;
    v_touched integer := 0;
BEGIN
    -- Lot 10b : une salle suit le chemin d'un établissement (même droit), comptée à part
    IF v_is_hall THEN
        v_kind := 'VENUE_SUBMITTED';
    END IF;
    -- Lot 11a : établissement soumis à la validation (VENUE_SUBMITTED, droit partners.validate)
    IF v_kind NOT IN ('PARTNER_NEW', 'PARTNER_RESUBMITTED', 'EVENT_SUBMITTED', 'VENUE_SUBMITTED') THEN
        RAISE EXCEPTION USING ERRCODE = 'NT004', MESSAGE = format('Élément à valider inconnu : %s.', COALESCE(NULLIF(v_kind, ''), '(vide)'));
    END IF;
    IF v_ref IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'NT004', MESSAGE = 'Référence de l''élément à valider absente.';
    END IF;
    IF v_now < now() - interval '1 minute' THEN
        RAISE EXCEPTION USING ERRCODE = 'NT003', MESSAGE = 'Horloge refusée : une heure dans le passé n''est jamais acceptée.';
    END IF;
    v_perm := CASE WHEN v_kind = 'EVENT_SUBMITTED' THEN 'events.write' ELSE 'partners.validate' END;
    -- Lot 10b : établissements et salles prévenus aux administrateurs qui ont halls.validate
    IF v_kind = 'VENUE_SUBMITTED' THEN
        v_perm := 'halls.validate';
    END IF;
    IF jsonb_typeof(p->'only_admin_ids') = 'array' THEN
        v_only := ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(p->'only_admin_ids') AS x);
    END IF;

    FOR v_admin IN
        SELECT x.admin_id FROM public.notif_admin_recipients(v_perm) AS x(admin_id)
         WHERE v_only IS NULL OR x.admin_id = ANY (v_only)
         ORDER BY x.admin_id
    LOOP
        PERFORM pg_advisory_xact_lock(hashtext('notif.admin_review_sms:' || v_admin::text));

        SELECT o.id, o.template_data INTO v_row
          FROM public.notification_outbox o
         WHERE o.type = 'ADMIN_REVIEW_SMS' AND o.channel = 'SMS' AND o.recipient_user_id = v_admin AND o.status = 'PENDING'
         ORDER BY o.due_at, o.id
         LIMIT 1
           FOR UPDATE;

        IF FOUND THEN
            v_refs := COALESCE(v_row.template_data->'refs', '[]'::jsonb);
            IF NOT (v_refs ? v_ref) THEN
                v_data := jsonb_build_object(
                    'partner_count', COALESCE((v_row.template_data->>'partner_count')::integer, 0) + CASE WHEN v_kind IN ('PARTNER_NEW', 'PARTNER_RESUBMITTED') THEN 1 ELSE 0 END,
                    'venue_count', COALESCE((v_row.template_data->>'venue_count')::integer, 0) + CASE WHEN v_kind = 'VENUE_SUBMITTED' AND NOT v_is_hall THEN 1 ELSE 0 END,
                    'hall_count', COALESCE((v_row.template_data->>'hall_count')::integer, 0) + CASE WHEN v_is_hall AND NOT v_changed THEN 1 ELSE 0 END,
                    'hall_changed_count', COALESCE((v_row.template_data->>'hall_changed_count')::integer, 0) + CASE WHEN v_changed THEN 1 ELSE 0 END,
                    'event_count', COALESCE((v_row.template_data->>'event_count')::integer, 0) + CASE WHEN v_kind = 'EVENT_SUBMITTED' THEN 1 ELSE 0 END,
                    'refs', v_refs || to_jsonb(v_ref)
                );
                UPDATE public.notification_outbox SET template_data = v_data WHERE id = v_row.id;
            END IF;
        ELSE
            SELECT max(COALESCE(o.sent_at, o.claimed_at, o.finished_at)) INTO v_last
              FROM public.notification_outbox o
             WHERE o.type = 'ADMIN_REVIEW_SMS' AND o.channel = 'SMS' AND o.recipient_user_id = v_admin
               AND o.status IN ('SENDING', 'SENT', 'UNCERTAIN');
            v_due := public.notif_admin_review_due(GREATEST(v_now, COALESCE(v_last + interval '30 minutes', v_now)));
            v_data := jsonb_strip_nulls(jsonb_build_object(
                'partner_count', CASE WHEN v_kind IN ('PARTNER_NEW', 'PARTNER_RESUBMITTED') THEN 1 ELSE 0 END,
                'venue_count', CASE WHEN v_kind = 'VENUE_SUBMITTED' AND NOT v_is_hall THEN 1 ELSE 0 END,
                'hall_count', CASE WHEN v_is_hall AND NOT v_changed THEN 1 ELSE 0 END,
                'hall_changed_count', CASE WHEN v_changed THEN 1 ELSE 0 END,
                'event_count', CASE WHEN v_kind = 'EVENT_SUBMITTED' THEN 1 ELSE 0 END,
                'company', CASE WHEN v_kind = 'PARTNER_NEW' THEN COALESCE(v_company, 'Une structure') END,
                'refs', jsonb_build_array(v_ref)
            ));
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'ADMIN_REVIEW_SMS',
                'key', 'ADMIN_REVIEW_SMS:' || v_admin::text || ':' || gen_random_uuid()::text,
                'user_id', v_admin,
                'data', v_data,
                'due_at', v_due,
                'now', v_now
            ));
        END IF;
        v_touched := v_touched + 1;
    END LOOP;
    RETURN v_touched;
END;
$$;

-- Recopie de 20261126000003_l10b_avis.sql:45-91 ; changement : SMS groupé avec ADMIN_HALL_CHANGED.
CREATE OR REPLACE FUNCTION public.halls_notify_admins()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ref     text;
    v_changes text[] := ARRAY[]::text[];
BEGIN
    IF NEW.validation_status = 'EN_ATTENTE_VALIDATION'
       AND (TG_OP = 'INSERT' OR OLD.validation_status <> 'EN_ATTENTE_VALIDATION') THEN
        v_ref := NEW.id::text || ':' || txid_current()::text;
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_HALL_SUBMITTED', 'ref', v_ref,
            'data', jsonb_strip_nulls(jsonb_build_object('hall_id', NEW.id, 'hall_name', NEW.name, 'city', NEW.city,
                                                         'resubmitted', TG_OP = 'UPDATE'))));
        PERFORM public.notif_admin_review_sms(jsonb_build_object('kind', 'HALL_SUBMITTED', 'ref', v_ref));
        RETURN NULL;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.validation_status = 'VALIDEE' AND NEW.validation_status = 'VALIDEE' THEN
        IF NEW.name IS DISTINCT FROM OLD.name THEN
            v_changes := v_changes || 'NOM'::text;
        END IF;
        IF NEW.address IS DISTINCT FROM OLD.address OR NEW.city IS DISTINCT FROM OLD.city
           OR NEW.latitude IS DISTINCT FROM OLD.latitude OR NEW.longitude IS DISTINCT FROM OLD.longitude THEN
            v_changes := v_changes || 'ADRESSE'::text;
        END IF;
        IF NEW.price_per_day IS DISTINCT FROM OLD.price_per_day OR NEW.price_per_hour IS DISTINCT FROM OLD.price_per_hour
           OR NEW.deposit_mode IS DISTINCT FROM OLD.deposit_mode OR NEW.deposit_value IS DISTINCT FROM OLD.deposit_value THEN
            v_changes := v_changes || 'PRIX'::text;
        END IF;
        IF NEW.images IS DISTINCT FROM OLD.images THEN
            v_changes := v_changes || 'PHOTOS'::text;
        END IF;
        IF cardinality(v_changes) > 0 THEN
            -- Contre-vérification du lot 10b (T6) : SMS groupé aux administrateurs, reporté à la fin de la nuit
            PERFORM public.notif_admin_review_sms(jsonb_build_object('kind', 'HALL_CHANGED', 'ref', NEW.id::text || ':' || txid_current()::text));
            PERFORM public.notif_enqueue_admins(jsonb_build_object(
                'type', 'ADMIN_HALL_CHANGED', 'ref', NEW.id::text || ':' || txid_current()::text,
                'data', jsonb_strip_nulls(jsonb_build_object('hall_id', NEW.id, 'hall_name', NEW.name, 'previous_name',
                                                             CASE WHEN NEW.name IS DISTINCT FROM OLD.name THEN OLD.name END,
                                                             'city', NEW.city, 'changes', to_jsonb(v_changes)))));
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- T7 : rappels du solde calés sur son échéance
-- ----------------------------------------------------------------------------
-- Recopie de 20261126000003_l10b_avis.sql:202-311 ; changement : 3 jours puis 1 jour avant l'échéance.
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
    -- Lot 10b : rappels, veille et recettes envoyés hors de la nuit (réglages notif.sms_quiet_start / _end)
    v_day       boolean := NOT public.notif_in_quiet_hours(now(), public.fin_setting_num('notif.sms_quiet_start')::int,
                                                           public.fin_setting_num('notif.sms_quiet_end')::int);
    v_now_local timestamp := public.hall_dakar_now();
    v_step      text;
    v_eves      integer := 0;
    v_earnings  integer := 0;
    v_owner     uuid;
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

    -- Contre-vérification du lot 10b (T7) : rappel du solde 3 jours puis 1 jour avant son échéance (balance_due_at,
    -- calculée avec halls.balance_due_days), un de chaque, de jour ; avec l'échéance par défaut (J-7), J-10 puis J-8
    FOR r IN
        SELECT hr.id, hr.client_id, hr.balance_due_at AS due_at FROM public.hall_reservations hr
         WHERE v_day AND hr.booking_state = 'ACOMPTE_PAYE' AND hr.balance_due_at IS NOT NULL
           AND now() < hr.balance_due_at AND now() >= hr.balance_due_at - interval '3 days'
    LOOP
        v_step := CASE WHEN now() >= r.due_at - interval '1 day' THEN 'J1' ELSE 'J3' END;
        v_reminders := v_reminders + COALESCE(public.notif_enqueue(jsonb_build_object(
            'type', 'HALL_BALANCE_REMINDER', 'key', 'HALL_BALANCE_REMINDER:' || v_step || ':' || r.id::text,
            'user_id', r.client_id,
            'data', COALESCE(public.hall_notif_data(r.id), '{}'::jsonb) || jsonb_build_object('step', v_step))), 0);
    END LOOP;

    -- Lot 10b : rappel la veille de la date, au client et à la salle, de jour
    FOR r IN
        SELECT hr.id, hr.client_id, pa.user_id AS owner_id FROM public.hall_reservations hr
          JOIN public.partners pa ON pa.id = hr.partner_id
         WHERE v_day AND hr.booking_state = 'PAYEE' AND hr.start_date = v_now_local::date + 1
    LOOP
        v_eves := v_eves + COALESCE(public.notif_enqueue(jsonb_build_object(
            'type', 'HALL_EVE_REMINDER', 'key', 'HALL_EVE_REMINDER:' || r.id::text || ':' || r.client_id::text,
            'user_id', r.client_id,
            'data', COALESCE(public.hall_notif_data(r.id), '{}'::jsonb) || jsonb_build_object('recipient_role', 'CLIENT'))), 0);
        IF r.owner_id IS NOT NULL THEN
            v_eves := v_eves + COALESCE(public.notif_enqueue(jsonb_build_object(
                'type', 'HALL_EVE_REMINDER', 'key', 'HALL_EVE_REMINDER:' || r.id::text || ':' || r.owner_id::text,
                'user_id', r.owner_id,
                'data', COALESCE(public.hall_notif_data(r.id), '{}'::jsonb) || jsonb_build_object('recipient_role', 'PARTNER'))), 0);
        END IF;
    END LOOP;

    -- Lot 10b : recettes d'une réservation devenues disponibles (toutes ses ventes au grand livre le sont, depuis
    -- moins de 3 jours), une fois, de jour
    FOR r IN
        SELECT hr.id, pa.user_id AS owner_id, sum(l.amount) AS earned
          FROM public.hall_reservations hr
          JOIN public.partners pa ON pa.id = hr.partner_id
          JOIN public.payments py ON py.hall_reservation_id = hr.id
          JOIN public.finance_ledger l ON l.payment_id = py.id AND l.account_kind = 'ORGANISATEUR'
         WHERE v_day AND hr.end_date >= v_now_local::date - 30
         GROUP BY hr.id, pa.user_id
        HAVING sum(l.amount) > 0
           AND max(l.available_at) FILTER (WHERE l.entry_type = 'VENTE') <= now()
           AND max(l.available_at) FILTER (WHERE l.entry_type = 'VENTE') > now() - interval '3 days'
    LOOP
        v_owner := r.owner_id;
        IF v_owner IS NOT NULL THEN
            v_earnings := v_earnings + COALESCE(public.notif_enqueue(jsonb_build_object(
                'type', 'HALL_EARNINGS_AVAILABLE', 'key', 'HALL_EARNINGS_AVAILABLE:' || r.id::text,
                'user_id', v_owner,
                'data', COALESCE(public.hall_notif_data(r.id), '{}'::jsonb) || jsonb_build_object('earned', r.earned))), 0);
        END IF;
    END LOOP;

    RETURN jsonb_build_object('expired_holds', v_holds, 'deadline_passed', v_deadline, 'reminders', v_reminders,
                              'eve_reminders', v_eves, 'earnings_available', v_earnings,
                              'cashout_ids', to_jsonb(v_ids));
END;
$$;
