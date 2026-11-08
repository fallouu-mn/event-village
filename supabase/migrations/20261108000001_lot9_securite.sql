-- ============================================================================
-- Lot 9, tâche 9.3 (M1) : sécurité et fiabilité (contrat 3.2, 3.3, 5.4, AR4, L39, L42).
--
-- Recopies (dernière définition, signature identique, seuls changements indiqués devant chaque fonction) :
--   ticket_refund_request(uuid, uuid, text) : 20261101000005_lot3_remboursements.sql:85-191
--   event_update(jsonb)                     : 20261103000005_lot6_billetterie.sql:1339-1702
--   ticket_category_guard(uuid, uuid)       : 20261102000004_lot5_edition.sql:809-845
-- Sans BEGIN ni COMMIT, rejouable, aucune reprise de données.
-- ============================================================================


-- ============================================================================
-- PO3 — ticket_refund_request (recopie de 20261101000005_lot3_remboursements.sql:85-191)
-- Ordre unique des verrous (3.3) : paiement, catégorie, billet. Avant, le billet était pris puis la catégorie, et
-- event_cancel prend catégorie puis billet : interblocage sur un billet sans paiement (gratuit, invitation).
-- FOR NO KEY UPDATE, jamais FOR UPDATE (AR4) : ticket_scan tient le billet puis prend FOR KEY SHARE sur la catégorie
-- par ticket_scans.category_id, un FOR UPDATE pris avant le billet fermerait ce cycle.
-- Changements : category_id lu avec payment_id, v_category déclarée, verrou déplacé avant le billet, VOLATILE écrit.
-- ============================================================================
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
BEGIN
    SELECT payment_id, category_id INTO v_payment_id, v_category FROM public.tickets WHERE id = p_ticket_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_FOUND', 'message', 'Billet introuvable.');
    END IF;
    IF v_payment_id IS NOT NULL THEN
        SELECT * INTO p FROM public.payments WHERE id = v_payment_id FOR UPDATE;
    END IF;
    PERFORM 1 FROM public.ticket_categories WHERE id = v_category FOR NO KEY UPDATE;
    SELECT * INTO t FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    SELECT * INTO v_ref FROM public.refunds WHERE refund_transaction_id = v_key;
    IF FOUND THEN
        RETURN jsonb_build_object('ok', true, 'already', true,
            'mode', CASE WHEN v_ref.settlement = 'ORGANISATEUR' THEN 'ORGANISATEUR' ELSE 'CASHOUT' END,
            'refund_id', v_ref.id, 'cashout_id', v_ref.cashout_id, 'amount', v_ref.amount);
    END IF;
    IF t.status::text <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_REFUNDABLE', 'status', t.status::text,
                                  'message', format('Billet %s : remboursement impossible.', t.status));
    END IF;

    -- Billet gratuit ou invitation : annulé, rien à rembourser
    IF COALESCE(t.price, 0) = 0 THEN
        UPDATE public.tickets SET status = 'ANNULE' WHERE id = t.id;
        UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = t.category_id;
        RETURN jsonb_build_object('ok', true, 'mode', 'AUCUN', 'amount', 0);
    END IF;

    -- Billet payé hors plateforme (espèces) : à rembourser par l'organisateur, aucun cashout
    IF v_payment_id IS NOT NULL THEN
        v_platform := p.is_platform_payment;
    END IF;
    IF NOT COALESCE(v_platform, FALSE) THEN
        INSERT INTO public.refunds (payment_id, ticket_id, refund_transaction_id, amount, reason, status, settlement, processed_by, kind, facial_part)
        VALUES (v_payment_id, t.id, v_key, t.price, COALESCE(p_reason, 'Remboursement'), 'PENDING', 'ORGANISATEUR', p_actor, 'TICKET_REFUND', t.price)
        RETURNING id INTO v_refund;
        UPDATE public.tickets SET status = 'ANNULE' WHERE id = t.id;
        UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = t.category_id;
        RETURN jsonb_build_object('ok', true, 'mode', 'ORGANISATEUR', 'refund_id', v_refund, 'amount', t.price);
    END IF;

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

REVOKE ALL ON FUNCTION public.ticket_refund_request(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_refund_request(uuid, uuid, text) TO service_role;


-- ============================================================================
-- PO4 — event_update (recopie de 20261103000005_lot6_billetterie.sql:1339-1702)
-- Ordre unique des verrous (3.3) : checkout_create_payment, free_tickets_claim et counter_sale tiennent une catégorie
-- puis prennent FOR KEY SHARE sur events par une clé étrangère. events en FOR UPDATE les bloquait et fermait le cycle
-- avec les catégories prises ensuite par event_update ; FOR NO KEY UPDATE ne bloque pas FOR KEY SHARE.
-- D20 tient : FOR SHARE (ticket_transfer_accept, ticket_offline_grant) reste en conflit avec NO KEY UPDATE.
-- Changement : le verrou de events, rien d'autre.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.event_update(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_patch jsonb := p->'patch';
    v_expected timestamptz;
    e public.events%ROWTYPE;
    a record;
    v_key text;
    v_forbidden text[] := ARRAY['status', 'services', 'gallery_urls', 'ticket_categories', 'slug', 'partner_id', 'is_featured',
                                'featured_until', 'id', 'created_at', 'updated_at'];
    v_allowed text[] := ARRAY['title', 'category', 'description', 'start_date', 'start_time', 'end_date', 'end_time', 'location',
                              'city', 'latitude', 'longitude', 'image_url', 'capacity', 'program', 'practical_info'];
    n_title text;
    n_category event_category;
    n_description text;
    n_start_date date;
    n_start_time time;
    n_end_date date;
    n_end_time time;
    n_location text;
    n_city text;
    n_lat double precision;
    n_lng double precision;
    n_image text;
    n_capacity integer;
    n_program jsonb;
    n_practical jsonb;
    v_post boolean;
    v_has_sales boolean;
    v_start_changed boolean;
    v_dates_changed boolean;
    v_new_start timestamptz;
    v_old_end timestamptz;
    v_new_end timestamptz;
    v_engaged integer;
    v_quota integer;
    v_late jsonb;
    v_late_names text;
    v_changed text[] := ARRAY[]::text[];
    v_labels text[] := ARRAY[]::text[];
    v_sms boolean := false;
    v_holders uuid[];
    v_notified integer := 0;
    v_sms_queued integer := 0;
    v_version integer;
    v_row jsonb;
    v_holder uuid;
    v_nkey text;
    v_data jsonb;
    v_pending_id uuid;
    v_pending_data jsonb;
BEGIN
    IF v_event IS NULL THEN
        RETURN public.event_edit_refusal('EVENT_NOT_FOUND', 'Événement introuvable.');
    END IF;
    IF v_patch IS NULL OR jsonb_typeof(v_patch) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les modifications de l''événement sont illisibles.');
    END IF;
    BEGIN
        v_expected := (p->>'expected_updated_at')::timestamptz;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
        v_expected := NULL;
    END;
    IF v_expected IS NULL THEN
        RETURN public.event_edit_refusal('EXPECTED_VERSION_REQUIRED', 'Version de l''événement manquante : rechargez la page puis recommencez.');
    END IF;

    SELECT * INTO e FROM public.events WHERE id = v_event FOR NO KEY UPDATE;
    IF NOT FOUND THEN
        RETURN public.event_edit_refusal('EVENT_NOT_FOUND', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT a.is_owner THEN
        IF a.is_staff THEN
            RETURN public.event_edit_refusal('ADMIN_CANNOT_EDIT', 'Seul l''organisateur modifie son événement ; l''administration agit par les changements de statut.');
        END IF;
        RETURN public.event_edit_refusal('EVENT_NOT_FOUND', 'Événement introuvable.');
    END IF;
    IF NOT a.is_active THEN
        RETURN public.event_edit_refusal('ACCOUNT_NOT_ACTIVE', 'Votre compte n''est pas actif.');
    END IF;

    SELECT k INTO v_key FROM jsonb_object_keys(v_patch) AS k
     WHERE k = ANY (v_forbidden) OR k <> ALL (v_allowed)
     ORDER BY k LIMIT 1;
    IF v_key IS NOT NULL THEN
        RETURN public.event_edit_refusal('FIELD_NOT_EDITABLE', 'Ce champ ne se modifie pas depuis le formulaire de l''événement.', v_key);
    END IF;

    IF e.status::text = 'EN_ATTENTE' THEN
        RETURN public.event_edit_refusal('WITHDRAW_TO_EDIT', 'L''événement est en cours de validation : retirez-le de la validation pour le modifier.');
    END IF;
    IF e.status::text IN ('TERMINE', 'ANNULE') THEN
        RETURN public.event_edit_refusal('EVENT_LOCKED', 'Un événement terminé ou annulé ne peut plus être modifié.');
    END IF;
    IF e.updated_at IS DISTINCT FROM v_expected THEN
        RETURN public.event_edit_refusal('EDIT_CONFLICT', 'L''événement a été modifié entre-temps : rechargez la page pour voir la dernière version.');
    END IF;
    v_post := e.status::text IN ('VALIDE', 'PUBLIE', 'SUSPENDU');

    -- Nouvelles valeurs (colonnes absentes du patch : inchangées)
    n_title := e.title; n_category := e.category; n_description := e.description;
    n_start_date := e.start_date; n_start_time := e.start_time; n_end_date := e.end_date; n_end_time := e.end_time;
    n_location := e.location; n_city := e.city; n_lat := e.latitude; n_lng := e.longitude; n_image := e.image_url;
    n_capacity := e.capacity; n_program := e.program; n_practical := e.practical_info;
    BEGIN
        IF v_patch ? 'title' THEN n_title := btrim(v_patch->>'title'); END IF;
        v_key := 'category';
        IF v_patch ? 'category' THEN n_category := (v_patch->>'category')::event_category; END IF;
        v_key := NULL;
        IF v_patch ? 'description' THEN n_description := NULLIF(btrim(COALESCE(v_patch->>'description', '')), ''); END IF;
        IF v_patch ? 'start_date' THEN n_start_date := (v_patch->>'start_date')::date; END IF;
        IF v_patch ? 'start_time' THEN n_start_time := (v_patch->>'start_time')::time; END IF;
        IF v_patch ? 'end_date' THEN n_end_date := NULLIF(v_patch->>'end_date', '')::date; END IF;
        IF v_patch ? 'end_time' THEN n_end_time := NULLIF(v_patch->>'end_time', '')::time; END IF;
        IF v_patch ? 'location' THEN n_location := btrim(v_patch->>'location'); END IF;
        IF v_patch ? 'city' THEN n_city := btrim(v_patch->>'city'); END IF;
        IF v_patch ? 'latitude' THEN n_lat := (v_patch->>'latitude')::double precision; END IF;
        IF v_patch ? 'longitude' THEN n_lng := (v_patch->>'longitude')::double precision; END IF;
        IF v_patch ? 'image_url' THEN n_image := NULLIF(btrim(COALESCE(v_patch->>'image_url', '')), ''); END IF;
        IF v_patch ? 'capacity' THEN n_capacity := (v_patch->>'capacity')::integer; END IF;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
        IF v_key = 'category' THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une catégorie d''événement dans la liste.', 'category');
        END IF;
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Une valeur modifiée est illisible.');
    END;
    IF v_patch ? 'program' THEN
        n_program := CASE jsonb_typeof(v_patch->'program') WHEN 'array' THEN v_patch->'program' WHEN 'null' THEN '[]'::jsonb END;
        IF n_program IS NULL OR jsonb_array_length(n_program) > 50 THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Le programme compte 50 lignes au plus.', 'program');
        END IF;
    END IF;
    IF v_patch ? 'practical_info' THEN
        n_practical := CASE jsonb_typeof(v_patch->'practical_info') WHEN 'object' THEN v_patch->'practical_info' WHEN 'null' THEN '{}'::jsonb END;
        IF n_practical IS NULL THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Les informations pratiques sont illisibles.', 'practical_info');
        END IF;
    END IF;
    -- Heure renvoyée par le formulaire en HH:mm : identique à la minute près = inchangée (R29)
    IF n_start_time IS NOT NULL AND e.start_time IS NOT NULL AND to_char(n_start_time, 'HH24:MI') = to_char(e.start_time, 'HH24:MI') THEN
        n_start_time := e.start_time;
    END IF;
    IF n_end_time IS NOT NULL AND e.end_time IS NOT NULL AND to_char(n_end_time, 'HH24:MI') = to_char(e.end_time, 'HH24:MI') THEN
        n_end_time := e.end_time;
    END IF;

    -- Défense : bornes de F1 (déjà contrôlées par le schéma partagé), sur les seuls champs envoyés
    IF v_patch ? 'title' AND (n_title IS NULL OR char_length(n_title) < 3 OR char_length(n_title) > 120) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le titre compte de 3 à 120 caractères.', 'title');
    END IF;
    IF v_patch ? 'category' AND n_category IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une catégorie d''événement dans la liste.', 'category');
    END IF;
    IF v_patch ? 'description' AND n_description IS NOT NULL AND char_length(n_description) > 5000 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La description ne dépasse pas 5 000 caractères.', 'description');
    END IF;
    IF v_patch ? 'location' AND (n_location IS NULL OR char_length(n_location) < 2 OR char_length(n_location) > 200) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le lieu compte de 2 à 200 caractères.', 'location');
    END IF;
    IF v_patch ? 'city' AND (n_city IS NULL OR char_length(n_city) < 2 OR char_length(n_city) > 80) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La ville compte de 2 à 80 caractères.', 'city');
    END IF;
    IF n_start_date IS NULL OR n_start_time IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La date et l''heure de début sont obligatoires.', 'start_date');
    END IF;
    IF n_lat IS NOT NULL AND (n_lat < -90 OR n_lat > 90) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La latitude est comprise entre -90 et 90.', 'latitude');
    END IF;
    IF n_lng IS NOT NULL AND (n_lng < -180 OR n_lng > 180) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La longitude est comprise entre -180 et 180.', 'longitude');
    END IF;
    IF n_capacity IS NOT NULL AND (n_capacity < 1 OR n_capacity > 100000) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La jauge est un nombre entier de 1 à 100 000.', 'capacity');
    END IF;
    IF n_image IS DISTINCT FROM e.image_url AND NOT public.event_poster_path_ok(n_image, e.partner_id) THEN
        RETURN public.event_edit_refusal('IMAGE_ORIGIN_INVALID', 'L''affiche doit être déposée depuis le formulaire de l''événement.', 'image_url');
    END IF;

    -- Dates (Africa/Dakar) : début dans le futur s'il change, fin après le début
    v_start_changed := n_start_date IS DISTINCT FROM e.start_date OR n_start_time IS DISTINCT FROM e.start_time;
    v_dates_changed := v_start_changed OR n_end_date IS DISTINCT FROM e.end_date OR n_end_time IS DISTINCT FROM e.end_time;
    IF n_end_time IS NOT NULL AND n_end_date IS NULL THEN
        RETURN public.event_edit_refusal('END_DATE_REQUIRED', 'Indiquez la date de fin pour l''heure de fin saisie.', 'end_date');
    END IF;
    v_new_start := (n_start_date + n_start_time) AT TIME ZONE 'Africa/Dakar';
    IF v_start_changed AND v_new_start <= now() THEN
        RETURN public.event_edit_refusal('EVENT_START_PAST', 'Le nouveau début de l''événement doit être dans le futur (heure de Dakar).', 'start_date');
    END IF;
    v_old_end := public.event_end_from(e.start_date, e.end_date, e.end_time);
    v_new_end := public.event_end_from(n_start_date, n_end_date, n_end_time);
    IF v_dates_changed AND n_end_date IS NOT NULL AND v_new_end <= v_new_start THEN
        RETURN public.event_edit_refusal('EVENT_END_BEFORE_START', 'La fin de l''événement doit être postérieure à son début.',
                                         CASE WHEN n_end_time IS NOT NULL THEN 'end_time' ELSE 'end_date' END);
    END IF;

    PERFORM 1 FROM public.ticket_categories WHERE event_id = v_event ORDER BY id FOR UPDATE;
    v_has_sales := public.event_has_sales(v_event);

    -- Verrouillés dès qu'il y a des ventes : catégorie d'événement, jauge supprimée ou sous vendus + réservés
    IF v_has_sales AND n_category IS DISTINCT FROM e.category THEN
        RETURN public.event_edit_refusal('LOCKED_AFTER_SALES', 'La catégorie de l''événement ne change plus : des billets ont été vendus ou réservés.', 'category');
    END IF;
    IF n_capacity IS DISTINCT FROM e.capacity THEN
        SELECT COALESCE(sum(c.sold_quantity + c.held_quantity), 0)::int,
               COALESCE(sum(c.total_quantity) FILTER (WHERE c.is_active), 0)::int
          INTO v_engaged, v_quota
          FROM public.ticket_categories c WHERE c.event_id = v_event;
        IF v_has_sales AND n_capacity IS NULL THEN
            RETURN public.event_edit_refusal('LOCKED_AFTER_SALES', 'La jauge ne peut plus être supprimée : des billets ont été vendus ou réservés.', 'capacity');
        END IF;
        IF v_has_sales AND n_capacity < v_engaged THEN
            RETURN public.event_edit_refusal('LOCKED_AFTER_SALES',
                format('La jauge ne peut pas descendre sous %s : billets vendus et paiements en cours compris.', v_engaged), 'capacity');
        END IF;
        IF n_capacity IS NOT NULL AND n_capacity < v_quota THEN
            RETURN public.event_edit_refusal('CAPACITY_BELOW_QUOTAS',
                format('La jauge ne peut pas descendre sous la somme des quotas des catégories actives (%s) : baissez d''abord les quotas.', v_quota), 'capacity');
        END IF;
    END IF;

    -- Une fin de vente ne dépasse jamais la fin de l'événement
    IF v_dates_changed THEN
        SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'sale_end', c.sale_end) ORDER BY c.name, c.id),
               string_agg(format('« %s »', c.name), ', ' ORDER BY c.name, c.id)
          INTO v_late, v_late_names
          FROM public.ticket_categories c
         WHERE c.event_id = v_event AND c.sale_end IS NOT NULL AND c.sale_end > v_new_end;
        IF v_late IS NOT NULL THEN
            RETURN public.event_edit_refusal('SALE_END_AFTER_EVENT',
                format('La fin de vente de %s dépasse la nouvelle fin de l''événement : avancez d''abord la fin de vente.', v_late_names),
                CASE WHEN v_patch ? 'end_time' THEN 'end_time' WHEN v_patch ? 'end_date' THEN 'end_date' ELSE 'start_date' END,
                jsonb_build_object('categories', v_late));
        END IF;
    END IF;

    -- Champs notifiés (après publication) : titre, dates et heures, lieu, ville, adresse
    IF v_post THEN
        IF n_title IS DISTINCT FROM e.title THEN
            v_changed := array_append(v_changed, 'title'); v_labels := array_append(v_labels, 'le titre');
        END IF;
        IF n_start_date IS DISTINCT FROM e.start_date OR n_end_date IS DISTINCT FROM e.end_date THEN
            IF n_start_date IS DISTINCT FROM e.start_date THEN v_changed := array_append(v_changed, 'start_date'); END IF;
            IF n_end_date IS DISTINCT FROM e.end_date THEN v_changed := array_append(v_changed, 'end_date'); END IF;
            v_labels := array_append(v_labels, 'la date');
        END IF;
        IF n_start_time IS DISTINCT FROM e.start_time OR n_end_time IS DISTINCT FROM e.end_time THEN
            IF n_start_time IS DISTINCT FROM e.start_time THEN v_changed := array_append(v_changed, 'start_time'); END IF;
            IF n_end_time IS DISTINCT FROM e.end_time THEN v_changed := array_append(v_changed, 'end_time'); END IF;
            v_labels := array_append(v_labels, 'l''horaire');
        END IF;
        IF n_location IS DISTINCT FROM e.location OR n_city IS DISTINCT FROM e.city
           OR NULLIF(btrim(COALESCE(n_practical->>'address', '')), '') IS DISTINCT FROM NULLIF(btrim(COALESCE(e.practical_info->>'address', '')), '') THEN
            IF n_location IS DISTINCT FROM e.location THEN v_changed := array_append(v_changed, 'location'); END IF;
            IF n_city IS DISTINCT FROM e.city THEN v_changed := array_append(v_changed, 'city'); END IF;
            IF NULLIF(btrim(COALESCE(n_practical->>'address', '')), '') IS DISTINCT FROM NULLIF(btrim(COALESCE(e.practical_info->>'address', '')), '') THEN
                v_changed := array_append(v_changed, 'address');
            END IF;
            v_labels := array_append(v_labels, 'le lieu');
        END IF;
        v_sms := EXISTS (SELECT 1 FROM unnest(v_changed) AS f WHERE f <> 'title');
    END IF;
    v_version := e.notify_version + CASE WHEN cardinality(v_changed) > 0 THEN 1 ELSE 0 END;

    UPDATE public.events
       SET title = n_title, category = n_category, description = n_description,
           start_date = n_start_date, start_time = n_start_time, end_date = n_end_date, end_time = n_end_time,
           location = n_location, city = n_city, latitude = n_lat, longitude = n_lng, image_url = n_image,
           capacity = n_capacity, program = n_program, practical_info = n_practical, notify_version = v_version,
           updated_at = now()
     WHERE id = v_event;

    -- Fonds : une fin qui recule repousse la disponibilité des crédits VENTE pas encore disponibles ; jamais d'avancement
    IF v_new_end > v_old_end THEN
        UPDATE public.finance_ledger l
           SET available_at = GREATEST(l.available_at, public.fin_payout_available_at(l.payment_id))
         WHERE l.entry_type = 'VENTE' AND l.available_at > now()
           AND l.payment_id IN (SELECT py.id FROM public.payments py WHERE py.event_id = v_event);
    END IF;

    -- Porteurs prévenus : billets VALIDE (et UTILISE pour un événement de plusieurs jours), comptes non supprimés
    IF cardinality(v_changed) > 0 THEN
        SELECT array_agg(DISTINCT t.user_id) INTO v_holders
          FROM public.tickets t JOIN public.users u ON u.id = t.user_id
         WHERE t.event_id = v_event AND t.user_id IS NOT NULL AND u.status::text <> 'SUPPRIME'
           AND (t.status::text = 'VALIDE'
                OR (t.status::text = 'UTILISE' AND n_end_date IS NOT NULL AND n_end_date > n_start_date));
        v_notified := COALESCE(cardinality(v_holders), 0);
    END IF;
    IF v_notified > 0 THEN
        -- Données du modèle EVENT_CHANGED (valeurs d'après la modification, nouvelles valeurs des champs changés)
        v_data := jsonb_strip_nulls(jsonb_build_object(
            'event_id', v_event, 'title', n_title, 'start_at', v_new_start, 'location', n_location, 'city', n_city,
            'changed_fields', to_jsonb(v_changed),
            'new_start_at', CASE WHEN v_start_changed THEN v_new_start END,
            'new_end_at', CASE WHEN 'end_date' = ANY (v_changed) OR 'end_time' = ANY (v_changed) THEN v_new_end END,
            'new_location', CASE WHEN 'location' = ANY (v_changed) THEN n_location END,
            'new_address', CASE WHEN 'address' = ANY (v_changed) THEN NULLIF(btrim(COALESCE(n_practical->>'address', '')), '') END,
            'new_city', CASE WHEN 'city' = ANY (v_changed) THEN n_city END,
            'old_title', CASE WHEN 'title' = ANY (v_changed) THEN e.title END));
        FOREACH v_holder IN ARRAY v_holders LOOP
            v_nkey := 'EVENT_CHANGED:' || v_event::text || ':' || v_holder::text || ':v' || v_version::text;
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                'data', v_data, 'channels', jsonb_build_array('IN_APP', 'PUSH')));

            -- SMS regroupé : la ligne en attente du porteur pour cet événement reçoit l'union des champs
            v_pending_id := NULL;
            SELECT o.id, o.template_data INTO v_pending_id, v_pending_data
              FROM public.notification_outbox o
             WHERE o.event_id = v_event AND o.recipient_user_id = v_holder
               AND o.type = 'EVENT_CHANGED' AND o.channel = 'SMS' AND o.status = 'PENDING'
             ORDER BY o.created_at, o.id
             LIMIT 1
               FOR UPDATE;
            IF v_pending_id IS NOT NULL THEN
                UPDATE public.notification_outbox
                   SET template_data = (v_pending_data - 'migrated_from') || v_data || jsonb_build_object('changed_fields', (
                           SELECT COALESCE(jsonb_agg(f ORDER BY f), '[]'::jsonb)
                             FROM (SELECT jsonb_array_elements_text(COALESCE(v_pending_data->'changed_fields', '[]'::jsonb)) AS f
                                   UNION
                                   SELECT unnest(v_changed)) x))
                 WHERE id = v_pending_id;
                IF v_sms THEN
                    v_sms_queued := v_sms_queued + 1;
                END IF;
            END IF;
            IF v_sms AND v_pending_id IS NULL THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                    'data', v_data, 'channels', jsonb_build_array('SMS')));
                IF EXISTS (SELECT 1 FROM public.notification_outbox o
                            WHERE o.idempotency_key = v_nkey || ':SMS' AND o.status = 'PENDING') THEN
                    v_sms_queued := v_sms_queued + 1;
                END IF;
            ELSIF NOT v_sms THEN
                -- Titre seul : aucun SMS, trace SKIPPED (le SMS déjà en attente porte le nouveau titre)
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                    'data', v_data, 'channels', jsonb_build_array('SMS'),
                    'skip', jsonb_build_object('SMS', 'TITLE_ONLY')));
            END IF;
        END LOOP;
    END IF;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', CASE WHEN v_post THEN 'EVENT_LIVE_UPDATED' ELSE 'EVENT_UPDATED' END, 'EVENT', v_event,
            jsonb_build_object('status', e.status::text,
                               'fields', (SELECT COALESCE(jsonb_agg(k ORDER BY k), '[]'::jsonb) FROM jsonb_object_keys(v_patch) AS k),
                               'notified_fields', to_jsonb(v_changed), 'notified_holders', v_notified, 'sms_queued', v_sms_queued,
                               'end_moved_later', v_new_end > v_old_end));

    SELECT to_jsonb(ev) INTO v_row FROM public.events ev WHERE ev.id = v_event;
    RETURN jsonb_build_object('ok', true, 'event', v_row, 'notified_holders', v_notified, 'sms_queued', v_sms_queued,
                              'changed_fields', to_jsonb(v_changed));
END;
$$;

REVOKE ALL ON FUNCTION public.event_update(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_update(jsonb) TO service_role;


-- ============================================================================
-- PO4 — ticket_category_guard (recopie de 20261102000004_lot5_edition.sql:809-845)
-- Même règle : events en FOR NO KEY UPDATE, avant les catégories. La sérialisation des écritures de catégorie est
-- gardée (NO KEY UPDATE contre NO KEY UPDATE reste en conflit).
-- Changements : le verrou de events, VOLATILE écrit.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ticket_category_guard(p_event uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status text;
    a record;
BEGIN
    IF p_event IS NULL THEN
        RETURN public.event_edit_refusal('EVENT_NOT_FOUND', 'Événement introuvable.');
    END IF;
    SELECT status::text INTO v_status FROM public.events WHERE id = p_event FOR NO KEY UPDATE;
    IF NOT FOUND THEN
        RETURN public.event_edit_refusal('EVENT_NOT_FOUND', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(p_event, p_actor);
    IF NOT a.is_owner THEN
        IF a.is_staff THEN
            RETURN public.event_edit_refusal('ADMIN_CANNOT_EDIT', 'Seul l''organisateur modifie la billetterie de son événement.');
        END IF;
        RETURN public.event_edit_refusal('EVENT_NOT_FOUND', 'Événement introuvable.');
    END IF;
    IF NOT a.is_active THEN
        RETURN public.event_edit_refusal('ACCOUNT_NOT_ACTIVE', 'Votre compte n''est pas actif.');
    END IF;
    IF v_status IN ('TERMINE', 'ANNULE') THEN
        RETURN public.event_edit_refusal('EVENT_LOCKED', 'La billetterie d''un événement terminé ou annulé ne peut plus être modifiée.');
    END IF;
    IF v_status = 'EN_ATTENTE' THEN
        RETURN public.event_edit_refusal('WITHDRAW_TO_EDIT', 'L''événement est en cours de validation : retirez-le de la validation pour modifier sa billetterie.');
    END IF;
    PERFORM 1 FROM public.ticket_categories WHERE event_id = p_event ORDER BY id FOR UPDATE;
    RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_category_guard(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_category_guard(uuid, uuid) TO service_role;
