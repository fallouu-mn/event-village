-- Finition 2b (A, E-22) — couleur au contrôle et consigne d'entrée saisissables dès la création de l'événement, et sur
-- une catégorie nouvelle en modification. Constat (état des lieux du 15/11, point 2) : seulement sur une catégorie déjà
-- enregistrée ; ticket_category_normalize refusait les deux clés (liste fermée) et l'insertion de event_create ne les
-- avait pas.
--  1. ticket_category_normalize (recopie de 20261106000001_lot8_canaux.sql) : accepte scan_color (une des 8 clés de la
--     palette du scanner, ou null) et entry_instruction (espaces ramenés à un seul, 60 caractères au plus) avec les
--     textes de ticket_category_create, sous le chemin de la catégorie (ticket_categories.<i>.scan_color à la création) ;
--  2. ticket_category_create (recopie de 20261110000011_lot9ter_stock.sql) : couleur et consigne contrôlées par la
--     normalisation commune (avant : retirées puis contrôlées à part, mêmes textes et mêmes chemins) ;
--  3. event_create (recopie de 20261116000003_f2a_carte.sql) : catégories insérées une par une, dans l'ordre reçu, avec
--     couleur et consigne.
-- Sans BEGIN ni COMMIT, rejouable (CREATE OR REPLACE) ; aucune donnée écrite.

-- 1. ticket_category_normalize
CREATE OR REPLACE FUNCTION public.ticket_category_normalize(p_cat jsonb, p_event_end timestamptz, p_prefix text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prefix text := COALESCE(p_prefix, '');
    v_key text;
    v_name text;
    v_desc text;
    v_price numeric;
    v_total integer;
    v_max integer;
    v_start timestamptz;
    v_end timestamptz;
    v_online boolean;
    v_counter boolean;
    v_active boolean;
    v_color text;
    v_instr text;
BEGIN
    IF p_cat IS NULL OR jsonb_typeof(p_cat) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Catégorie de billets illisible.', NULLIF(rtrim(v_prefix, '.'), ''));
    END IF;
    SELECT k INTO v_key FROM jsonb_object_keys(p_cat) AS k
     WHERE k <> ALL (ARRAY['name', 'description', 'price', 'total_quantity', 'max_per_order', 'sale_start', 'sale_end', 'sale_online', 'sale_counter', 'is_visible', 'is_active',
                           -- Finition 2b (A) : couleur au contrôle et consigne d'entrée, dès la création
                           'scan_color', 'entry_instruction'])
     ORDER BY k LIMIT 1;
    IF v_key IS NOT NULL THEN
        RETURN public.event_edit_refusal('FIELD_NOT_EDITABLE', 'Ce champ de la catégorie de billets n''est pas accepté.', v_prefix || v_key);
    END IF;
    BEGIN
        v_name := btrim(p_cat->>'name');
        v_desc := NULLIF(btrim(COALESCE(p_cat->>'description', '')), '');
        v_price := (p_cat->>'price')::numeric;
        v_total := (p_cat->>'total_quantity')::integer;
        v_max := COALESCE((p_cat->>'max_per_order')::integer, 10);
        v_start := NULLIF(p_cat->>'sale_start', '')::timestamptz;
        v_end := NULLIF(p_cat->>'sale_end', '')::timestamptz;
        v_online := COALESCE((p_cat->>'sale_online')::boolean, (p_cat->>'is_visible')::boolean, true);
        v_counter := COALESCE((p_cat->>'sale_counter')::boolean, true);
        v_active := COALESCE((p_cat->>'is_active')::boolean, true);
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Une valeur de la catégorie de billets est illisible.', NULLIF(rtrim(v_prefix, '.'), ''));
    END;
    IF v_name IS NULL OR char_length(v_name) < 1 OR char_length(v_name) > 60 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le nom de la catégorie compte de 1 à 60 caractères.', v_prefix || 'name');
    END IF;
    IF v_desc IS NOT NULL AND char_length(v_desc) > 300 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La description de la catégorie ne dépasse pas 300 caractères.', v_prefix || 'description');
    END IF;
    IF v_price IS NULL OR v_price < 0 OR v_price > 10000000 OR v_price <> trunc(v_price) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le prix est un montant entier de 0 à 10 000 000 F CFA.', v_prefix || 'price');
    END IF;
    IF v_total IS NULL OR v_total < 1 OR v_total > 100000 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le quota est un nombre entier de 1 à 100 000 billets.', v_prefix || 'total_quantity');
    END IF;
    IF v_max < 1 OR v_max > 50 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le maximum par commande est un nombre entier de 1 à 50.', v_prefix || 'max_per_order');
    END IF;
    IF v_start IS NOT NULL AND v_end IS NOT NULL AND v_start >= v_end THEN
        RETURN public.event_edit_refusal('SALE_DATES_INVALID', 'La fin de vente doit être postérieure au début de vente.', v_prefix || 'sale_end');
    END IF;
    IF v_end IS NOT NULL AND p_event_end IS NOT NULL AND v_end > p_event_end THEN
        RETURN public.event_edit_refusal('SALE_END_AFTER_EVENT', 'La fin de vente ne peut pas dépasser la fin de l''événement.', v_prefix || 'sale_end');
    END IF;
    -- Finition 2b (A) : couleur (une des 8 clés de la palette du scanner, ou rien : la base en pose une) et consigne
    -- (espaces ramenés à un seul, 60 caractères au plus, vide : aucune) ; mêmes textes que ticket_category_create (lot 9 ter)
    IF p_cat ? 'scan_color' AND jsonb_typeof(p_cat->'scan_color') <> 'null' THEN
        IF jsonb_typeof(p_cat->'scan_color') <> 'string'
           OR (p_cat->>'scan_color') NOT IN ('BLANC', 'OR', 'ARGENT', 'ROSE', 'TURQUOISE', 'BLEU', 'VIOLET', 'NOIR') THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une couleur dans la liste.', v_prefix || 'scan_color');
        END IF;
        v_color := p_cat->>'scan_color';
    END IF;
    IF p_cat ? 'entry_instruction' AND jsonb_typeof(p_cat->'entry_instruction') <> 'null' THEN
        IF jsonb_typeof(p_cat->'entry_instruction') <> 'string' THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'La consigne d’entrée ne dépasse pas 60 caractères.', v_prefix || 'entry_instruction');
        END IF;
        v_instr := NULLIF(btrim(regexp_replace(p_cat->>'entry_instruction', '\s+', ' ', 'g')), '');
        IF char_length(v_instr) > 60 THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'La consigne d’entrée ne dépasse pas 60 caractères.', v_prefix || 'entry_instruction');
        END IF;
    END IF;
    RETURN jsonb_build_object('ok', true, 'name', v_name, 'description', v_desc, 'price', v_price, 'total_quantity', v_total,
                              'max_per_order', v_max, 'sale_start', v_start, 'sale_end', v_end,
                              'sale_online', v_online, 'sale_counter', v_counter, 'is_active', v_active,
                              'scan_color', v_color, 'entry_instruction', v_instr);
END;
$$;


-- 2. ticket_category_create
CREATE OR REPLACE FUNCTION public.ticket_category_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_cat jsonb := p->'category';
    v_color text;
    v_instr text;
    v_guard jsonb;
    v_capacity integer;
    v_norm jsonb;
    v_sum integer;
    v_id uuid;
    v_row jsonb;
BEGIN
    v_guard := public.ticket_category_guard(v_event, v_actor);
    IF (v_guard->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_guard;
    END IF;
    SELECT capacity INTO v_capacity FROM public.events WHERE id = v_event;
    -- Finition 2b (A) : couleur et consigne contrôlées par la normalisation commune, comme à la création de l'événement
    -- (avant : retirées de la catégorie et contrôlées ici, mêmes textes et mêmes chemins)
    v_norm := public.ticket_category_normalize(v_cat, public.event_end_at(v_event), '');
    IF (v_norm->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_norm;
    END IF;
    v_color := v_norm->>'scan_color';
    v_instr := v_norm->>'entry_instruction';
    IF EXISTS (SELECT 1 FROM public.ticket_categories c
                WHERE c.event_id = v_event AND lower(btrim(c.name)) = lower(v_norm->>'name')) THEN
        RETURN public.event_edit_refusal('CATEGORY_NAME_TAKEN',
            format('Une catégorie « %s » existe déjà pour cet événement : choisissez un autre nom.', v_norm->>'name'), 'name');
    END IF;
    IF v_capacity IS NOT NULL AND (v_norm->>'is_active')::boolean THEN
        SELECT COALESCE(sum(c.total_quantity), 0)::int INTO v_sum
          FROM public.ticket_categories c WHERE c.event_id = v_event AND c.is_active;
        IF v_sum + (v_norm->>'total_quantity')::int > v_capacity THEN
            RETURN public.event_edit_refusal('QUOTA_ABOVE_CAPACITY',
                format('Les quantités mises en vente des catégories actives totaliseraient %s places. Augmentez d’abord la capacité totale de l’événement (actuellement %s).',
                       v_sum + (v_norm->>'total_quantity')::int, v_capacity), 'total_quantity');
        END IF;
    END IF;

    INSERT INTO public.ticket_categories (event_id, name, description, price, total_quantity, sold_quantity, max_per_order,
                                          sale_start, sale_end, sale_online, sale_counter, is_active, scan_color, entry_instruction)
    VALUES (v_event, v_norm->>'name', v_norm->>'description', (v_norm->>'price')::numeric, (v_norm->>'total_quantity')::int, 0,
            (v_norm->>'max_per_order')::int, (v_norm->>'sale_start')::timestamptz, (v_norm->>'sale_end')::timestamptz,
            (v_norm->>'sale_online')::boolean, (v_norm->>'sale_counter')::boolean, (v_norm->>'is_active')::boolean,
            v_color, v_instr)
    RETURNING id INTO v_id;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'CATEGORY_CREATED', 'TICKET_CATEGORY', v_id,
            jsonb_build_object('event_id', v_event, 'name', v_norm->>'name', 'price', v_norm->'price', 'total_quantity', v_norm->'total_quantity',
                               'scan_color', v_color));

    SELECT to_jsonb(c) INTO v_row FROM public.ticket_categories c WHERE c.id = v_id;
    RETURN jsonb_build_object('ok', true, 'category', v_row);
END;
$$;


-- 3. event_create
CREATE OR REPLACE FUNCTION public.event_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_ev jsonb := p->'event';
    v_cats jsonb := COALESCE(p->'ticket_categories', '[]'::jsonb);
    v_partner record;
    v_key text;
    v_title text;
    v_category event_category;
    v_description text;
    v_start_date date;
    v_start_time time;
    v_end_date date;
    v_end_time time;
    v_location text;
    v_city text;
    v_lat double precision;
    v_lng double precision;
    v_image text;
    v_capacity integer;
    v_program jsonb;
    v_practical jsonb;
    v_start timestamptz;
    v_end timestamptz;
    v_cat jsonb;
    v_norm jsonb;
    v_idx integer;
    v_names text[] := ARRAY[]::text[];
    v_normalized jsonb := '[]'::jsonb;
    v_active_sum integer := 0;
    v_slug text;
    v_event_id uuid;
    v_row jsonb;
    v_refusal jsonb;
BEGIN
    -- Finition 2a (1a) : fiche SUSPENDU, événements en lecture seule pour la partenaire (l'admin events.write garde ses actions)
    IF public.partner_actor_suspended(public.try_uuid(p->>'actor_id')) THEN
        RETURN public.event_edit_refusal('PARTNER_SUSPENDED', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    IF v_actor IS NULL THEN
        RETURN public.event_edit_refusal('PARTNER_NOT_FOUND', 'Seul un organisateur disposant d''un profil partenaire peut créer un événement.');
    END IF;
    SELECT pa.id, pa.status::text AS status, u.status::text AS user_status INTO v_partner
      FROM public.partners pa JOIN public.users u ON u.id = pa.user_id
     WHERE pa.user_id = v_actor;
    IF NOT FOUND THEN
        RETURN public.event_edit_refusal('PARTNER_NOT_FOUND', 'Seul un organisateur disposant d''un profil partenaire peut créer un événement.');
    END IF;
    IF v_partner.user_status <> 'ACTIF' THEN
        RETURN public.event_edit_refusal('ACCOUNT_NOT_ACTIVE', 'Votre compte n''est pas actif.');
    END IF;
    IF v_partner.status <> 'VALIDE' THEN
        RETURN public.event_edit_refusal('PARTNER_NOT_VALIDATED', 'Votre profil d''organisateur doit être validé avant de créer un événement.');
    END IF;

    IF v_ev IS NULL OR jsonb_typeof(v_ev) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les informations de l''événement sont illisibles.');
    END IF;
    IF jsonb_typeof(v_cats) <> 'array' OR jsonb_array_length(v_cats) > 50 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les catégories de billets sont illisibles (50 au plus).', 'ticket_categories');
    END IF;
    SELECT k INTO v_key FROM jsonb_object_keys(v_ev) AS k
     WHERE k <> ALL (ARRAY['title', 'category', 'description', 'start_date', 'start_time', 'end_date', 'end_time', 'location', 'city',
                           'latitude', 'longitude', 'image_url', 'capacity', 'program', 'practical_info'])
     ORDER BY k LIMIT 1;
    IF v_key IS NOT NULL THEN
        RETURN public.event_edit_refusal('FIELD_NOT_EDITABLE', 'Ce champ ne peut pas être fourni à la création d''un événement.', v_key);
    END IF;

    BEGIN
        v_title := btrim(v_ev->>'title');
        v_key := 'category';
        v_category := (v_ev->>'category')::event_category;
        v_key := NULL;
        v_description := NULLIF(btrim(COALESCE(v_ev->>'description', '')), '');
        v_start_date := (v_ev->>'start_date')::date;
        v_start_time := (v_ev->>'start_time')::time;
        v_end_date := NULLIF(v_ev->>'end_date', '')::date;
        v_end_time := NULLIF(v_ev->>'end_time', '')::time;
        v_location := btrim(v_ev->>'location');
        v_city := btrim(v_ev->>'city');
        v_lat := (v_ev->>'latitude')::double precision;
        v_lng := (v_ev->>'longitude')::double precision;
        v_image := NULLIF(btrim(COALESCE(v_ev->>'image_url', '')), '');
        v_capacity := (v_ev->>'capacity')::integer;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
        IF v_key = 'category' THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une catégorie d''événement dans la liste.', 'category');
        END IF;
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Une valeur de l''événement est illisible.');
    END;
    v_program := COALESCE(v_ev->'program', '[]'::jsonb);
    v_practical := COALESCE(v_ev->'practical_info', '{}'::jsonb);

    -- Finition 2a (3) : position du lieu, latitude et longitude ensemble ou aucune, au Sénégal (contrôlée en premier)
    v_refusal := public.event_position_refusal(v_lat, v_lng);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;

    IF v_title IS NULL OR char_length(v_title) < 3 OR char_length(v_title) > 120 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le titre compte de 3 à 120 caractères.', 'title');
    END IF;
    IF v_category IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une catégorie d''événement dans la liste.', 'category');
    END IF;
    IF v_description IS NOT NULL AND char_length(v_description) > 5000 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La description ne dépasse pas 5 000 caractères.', 'description');
    END IF;
    IF v_location IS NULL OR char_length(v_location) < 2 OR char_length(v_location) > 200 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le lieu compte de 2 à 200 caractères.', 'location');
    END IF;
    IF v_city IS NULL OR char_length(v_city) < 2 OR char_length(v_city) > 80 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La ville compte de 2 à 80 caractères.', 'city');
    END IF;
    IF v_capacity IS NOT NULL AND (v_capacity < 1 OR v_capacity > 100000) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La jauge est un nombre entier de 1 à 100 000.', 'capacity');
    END IF;
    IF NOT public.event_poster_path_ok(v_image, v_partner.id) THEN
        RETURN public.event_edit_refusal('IMAGE_ORIGIN_INVALID', 'L''affiche doit être déposée depuis le formulaire de l''événement.', 'image_url');
    END IF;
    IF jsonb_typeof(v_program) <> 'array' OR jsonb_array_length(v_program) > 50 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le programme compte 50 lignes au plus.', 'program');
    END IF;
    IF jsonb_typeof(v_practical) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les informations pratiques sont illisibles.', 'practical_info');
    END IF;

    IF v_end_time IS NOT NULL AND v_end_date IS NULL THEN
        RETURN public.event_edit_refusal('END_DATE_REQUIRED', 'Indiquez la date de fin pour l''heure de fin saisie.', 'end_date');
    END IF;
    v_start := (v_start_date + v_start_time) AT TIME ZONE 'Africa/Dakar';
    IF v_start <= now() THEN
        RETURN public.event_edit_refusal('EVENT_START_PAST', 'Le début de l''événement doit être dans le futur (heure de Dakar).', 'start_date');
    END IF;
    v_end := public.event_end_from_v2(v_start_date, v_start_time, v_end_date, v_end_time);
    IF v_end_date IS NOT NULL AND v_end <= v_start THEN
        RETURN public.event_edit_refusal('EVENT_END_BEFORE_START', 'La fin de l''événement doit être postérieure à son début.',
                                         CASE WHEN v_end_time IS NOT NULL THEN 'end_time' ELSE 'end_date' END);
    END IF;

    -- Catégories : toutes contrôlées avant la moindre écriture (tout ou rien)
    FOR v_cat, v_idx IN SELECT x.e, (x.o - 1)::int FROM jsonb_array_elements(v_cats) WITH ORDINALITY AS x(e, o) LOOP
        v_norm := public.ticket_category_normalize(v_cat, v_end, format('ticket_categories.%s.', v_idx));
        IF (v_norm->>'ok')::boolean IS NOT TRUE THEN
            RETURN v_norm;
        END IF;
        IF lower(v_norm->>'name') = ANY (v_names) THEN
            RETURN public.event_edit_refusal('CATEGORY_NAME_TAKEN',
                format('Deux catégories portent le nom « %s » : chaque nom doit être unique.', v_norm->>'name'),
                format('ticket_categories.%s.name', v_idx));
        END IF;
        v_names := array_append(v_names, lower(v_norm->>'name'));
        IF (v_norm->>'is_active')::boolean THEN
            v_active_sum := v_active_sum + (v_norm->>'total_quantity')::integer;
        END IF;
        v_normalized := v_normalized || jsonb_build_array(v_norm);
    END LOOP;
    IF v_capacity IS NOT NULL AND v_active_sum > v_capacity THEN
        RETURN public.event_edit_refusal('QUOTA_ABOVE_CAPACITY',
            format('La somme des quotas des catégories actives (%s) dépasse la jauge (%s).', v_active_sum, v_capacity), 'capacity');
    END IF;

    v_slug := btrim(regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'), '-');
    IF v_slug = '' THEN v_slug := 'evenement'; END IF;
    v_slug := left(v_slug, 60) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

    -- Statut forcé à BROUILLON par trg_events_force_draft, historique NULL → BROUILLON par trg_events_log_creation
    INSERT INTO public.events (partner_id, title, slug, category, description, start_date, start_time, end_date, end_time,
                               location, city, latitude, longitude, image_url, gallery_urls, capacity, program, practical_info, services)
    VALUES (v_partner.id, v_title, v_slug, v_category, v_description, v_start_date, v_start_time, v_end_date, v_end_time,
            v_location, v_city, v_lat, v_lng, v_image, '{}', v_capacity, v_program, v_practical,
            '{"ticketing": true, "tableBooking": false, "communication": false}'::jsonb)
    RETURNING id INTO v_event_id;

    -- Finition 2b (A) : catégories insérées une par une, dans l'ordre reçu, avec leur couleur au contrôle et leur consigne
    -- d'entrée (couleur absente : posée par la base)
    FOR v_cat IN SELECT x.e FROM jsonb_array_elements(v_normalized) WITH ORDINALITY AS x(e, o) ORDER BY x.o LOOP
        INSERT INTO public.ticket_categories (event_id, name, description, price, total_quantity, sold_quantity, max_per_order,
                                              sale_start, sale_end, sale_online, sale_counter, is_active, scan_color, entry_instruction)
        VALUES (v_event_id, v_cat->>'name', v_cat->>'description', (v_cat->>'price')::numeric, (v_cat->>'total_quantity')::integer, 0,
                (v_cat->>'max_per_order')::integer, (v_cat->>'sale_start')::timestamptz, (v_cat->>'sale_end')::timestamptz,
                (v_cat->>'sale_online')::boolean, (v_cat->>'sale_counter')::boolean, (v_cat->>'is_active')::boolean,
                v_cat->>'scan_color', v_cat->>'entry_instruction');
    END LOOP;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'EVENT_CREATED', 'EVENT', v_event_id,
            jsonb_build_object('categories', jsonb_array_length(v_normalized)));

    SELECT to_jsonb(ev) INTO v_row FROM public.events ev WHERE ev.id = v_event_id;
    RETURN jsonb_build_object('ok', true, 'event_id', v_event_id, 'event', v_row);
END;
$$;


DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.ticket_category_normalize(jsonb, timestamptz, text)',
        'public.ticket_category_create(jsonb)',
        'public.event_create(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
