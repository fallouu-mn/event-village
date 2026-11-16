-- ============================================================================
-- EVENT VILLAGE — Finition 2a, 1a (sécurité) : fiche partenaire SUSPENDU = événements en lecture seule pour elle
-- ============================================================================
-- Quel que soit le statut de l'événement, la partenaire dont la fiche est SUSPENDU ne modifie plus l'événement, ses
-- billets, ses zones, ses invitations, ses remboursements, ni ne fait de transition : refus PARTNER_SUSPENDED « Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support. »
-- (la route ajoute le contact du support). L'admin muni de events.write garde ses actions ; les contrôleurs gardent le
-- scan (règle A9, inchangée) ; la partenaire garde la lecture.
-- Aides partner_owner_suspended et partner_actor_suspended ; contrôle en tête des fonctions d'écriture (recopies, seul
-- ajout : ce contrôle). ticket_category_guard couvre ticket_category_create, _update, _delete et event_zones_save.
-- Écritures directes : suppression d'un brouillon (déclencheur) ; code du régisseur par event_regisseur_pin_store, toute
-- autre écriture refusée (déclencheur). Aucune donnée modifiée. Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Aides : propriétaire d'un événement dont la fiche est SUSPENDU, sans être admin events.write
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_owner_suspended(p_event uuid, p_actor uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p_actor IS NOT NULL AND p_event IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
                    WHERE e.id = p_event AND pa.user_id = p_actor AND pa.status::text = 'SUSPENDU')
       AND NOT COALESCE(public.admin_can(p_actor, 'events.write'), FALSE)
$$;

-- Compte dont la fiche partenaire est SUSPENDU, sans être admin events.write (création d'un événement)
CREATE OR REPLACE FUNCTION public.partner_actor_suspended(p_actor uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p_actor IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.partners pa WHERE pa.user_id = p_actor AND pa.status::text = 'SUSPENDU')
       AND NOT COALESCE(public.admin_can(p_actor, 'events.write'), FALSE)
$$;

-- ----------------------------------------------------------------------------
-- 2. Écritures directes : suppression d'un brouillon et code du régisseur
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.events_suspended_owner_delete_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.partners pa WHERE pa.id = OLD.partner_id AND pa.status::text = 'SUSPENDU') THEN
        RAISE EXCEPTION USING ERRCODE = 'PS403', MESSAGE = 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.', HINT = 'PARTNER_SUSPENDED';
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_suspended_owner_delete ON public.events;
CREATE TRIGGER trg_events_suspended_owner_delete
    BEFORE DELETE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.events_suspended_owner_delete_guard();

-- Code du régisseur : écrit par event_regisseur_pin_store (auteur contrôlé, admin compris) ; toute autre écriture pour
-- l'événement d'une fiche SUSPENDU est refusée
CREATE OR REPLACE FUNCTION public.regisseur_pin_suspended_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF current_setting('event_village.pin_write_checked', true) IS DISTINCT FROM 'on'
       AND EXISTS (SELECT 1 FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
                    WHERE e.id = NEW.event_id AND pa.status::text = 'SUSPENDU') THEN
        RAISE EXCEPTION USING ERRCODE = 'PS403', MESSAGE = 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.', HINT = 'PARTNER_SUSPENDED';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_regisseur_pins_suspended ON public.event_regisseur_pins;
CREATE TRIGGER trg_event_regisseur_pins_suspended
    BEFORE INSERT OR UPDATE ON public.event_regisseur_pins
    FOR EACH ROW
    EXECUTE FUNCTION public.regisseur_pin_suspended_guard();

-- p : { event_id, actor_id, pin_hash, pin_salt }. Propriété vérifiée par le serveur avant (ShiftService) ; ici : fiche
-- SUSPENDU refusée, puis enregistrement (le code en clair n'arrive jamais en base).
CREATE OR REPLACE FUNCTION public.event_regisseur_pin_store(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_hash text := NULLIF(btrim(COALESCE(p->>'pin_hash', '')), '');
    v_salt text := NULLIF(btrim(COALESCE(p->>'pin_salt', '')), '');
    v_previous boolean;
BEGIN
    IF v_event IS NULL OR v_actor IS NULL OR v_hash IS NULL OR v_salt IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Code incomplet.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = v_event) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF public.partner_owner_suspended(v_event, v_actor) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    v_previous := EXISTS (SELECT 1 FROM public.event_regisseur_pins r WHERE r.event_id = v_event);
    PERFORM set_config('event_village.pin_write_checked', 'on', true);
    INSERT INTO public.event_regisseur_pins (event_id, pin_hash, pin_salt, updated_at)
    VALUES (v_event, v_hash, v_salt, now())
    ON CONFLICT (event_id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash, pin_salt = EXCLUDED.pin_salt, updated_at = now();
    PERFORM set_config('event_village.pin_write_checked', 'off', true);
    RETURN jsonb_build_object('ok', true, 'regenerated', v_previous);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Recopies des fonctions d'écriture, contrôle de la fiche en tête
-- ----------------------------------------------------------------------------
-- 3.1 ticket_category_guard (recopie de 20261108000001_lot9_securite.sql)
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
    -- Finition 2a (1a) : fiche SUSPENDU, événements en lecture seule pour la partenaire (l'admin events.write garde ses actions)
    IF public.partner_owner_suspended(p_event, p_actor) THEN
        RETURN public.event_edit_refusal('PARTNER_SUSPENDED', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
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

-- 3.2 event_create (recopie de 20261109000008_lot9bis_cycle.sql)
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
    IF v_lat IS NOT NULL AND (v_lat < -90 OR v_lat > 90) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La latitude est comprise entre -90 et 90.', 'latitude');
    END IF;
    IF v_lng IS NOT NULL AND (v_lng < -180 OR v_lng > 180) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La longitude est comprise entre -180 et 180.', 'longitude');
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

    INSERT INTO public.ticket_categories (event_id, name, description, price, total_quantity, sold_quantity, max_per_order,
                                          sale_start, sale_end, sale_online, sale_counter, is_active)
    SELECT v_event_id, c->>'name', c->>'description', (c->>'price')::numeric, (c->>'total_quantity')::integer, 0,
           (c->>'max_per_order')::integer, (c->>'sale_start')::timestamptz, (c->>'sale_end')::timestamptz,
           (c->>'sale_online')::boolean, (c->>'sale_counter')::boolean, (c->>'is_active')::boolean
      FROM jsonb_array_elements(v_normalized) AS c;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'EVENT_CREATED', 'EVENT', v_event_id,
            jsonb_build_object('categories', jsonb_array_length(v_normalized)));

    SELECT to_jsonb(ev) INTO v_row FROM public.events ev WHERE ev.id = v_event_id;
    RETURN jsonb_build_object('ok', true, 'event_id', v_event_id, 'event', v_row);
END;
$$;

-- 3.3 event_update (recopie de 20261109000009_lot9bis_messages.sql)
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
    v_old_start timestamptz;
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
    v_phones integer := 0;
    v_sms_queued integer := 0;
    v_version integer;
    v_row jsonb;
    v_holder uuid;
    v_nkey text;
    v_data jsonb;
    v_hdata jsonb;
    v_drop text[] := ARRAY['migrated_from'];
    v_pending_id uuid;
    v_pending_data jsonb;
    v_urgent boolean := false;
    v_due timestamptz;
    v_ch text;
    n record;
BEGIN
    -- Finition 2a (1a) : fiche SUSPENDU, événements en lecture seule pour la partenaire (l'admin events.write garde ses actions)
    IF public.partner_owner_suspended(public.try_uuid(p->>'event_id'), public.try_uuid(p->>'actor_id')) THEN
        RETURN public.event_edit_refusal('PARTNER_SUSPENDED', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
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
    v_old_start := (e.start_date + e.start_time) AT TIME ZONE 'Africa/Dakar';
    IF v_start_changed AND v_new_start <= now() THEN
        RETURN public.event_edit_refusal('EVENT_START_PAST', 'Le nouveau début de l''événement doit être dans le futur (heure de Dakar).', 'start_date');
    END IF;
    -- Lot 9 bis (R16, B47, X7) : fin par event_end_from_v2 (M08), même règle que event_end_at (sans fin : début + 6 h)
    v_old_end := public.event_end_from_v2(e.start_date, e.start_time, e.end_date, e.end_time);
    v_new_end := public.event_end_from_v2(n_start_date, n_start_time, n_end_date, n_end_time);
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
        -- Lot 9 bis (R94, B61) : un début de vente précède toujours la fin de l'événement
        SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'sale_start', c.sale_start) ORDER BY c.name, c.id)
          INTO v_late
          FROM public.ticket_categories c
         WHERE c.event_id = v_event AND c.sale_start IS NOT NULL AND c.sale_start >= v_new_end;
        IF v_late IS NOT NULL THEN
            RETURN public.event_edit_refusal('SALE_START_AFTER_EVENT', 'Le début de vente doit précéder la fin de l’événement.',
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

    -- Lot 9 bis (R32, B23) : changement de début journalisé ; le droit au remboursement d'un report se mesure depuis
    -- le début en vigueur à l'achat (ticket_postponement_refund_open, M06). Ordre : events NKU → catégories →
    -- event_start_changes (clé étrangère vers l'événement déjà tenu) → boîte d'envoi.
    IF v_start_changed THEN
        INSERT INTO public.event_start_changes (event_id, old_start_at, new_start_at, actor_id)
        VALUES (v_event, v_old_start, v_new_start, v_actor);
    END IF;

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
        -- Données du modèle EVENT_CHANGED (valeurs d'après la modification, nouvelles valeurs des champs changés)
        v_data := jsonb_strip_nulls(jsonb_build_object(
            'event_id', v_event, 'title', n_title, 'start_at', v_new_start, 'location', n_location, 'city', n_city,
            'changed_fields', to_jsonb(v_changed),
            'new_start_at', CASE WHEN v_start_changed THEN v_new_start END,
            'new_end_at', CASE WHEN 'end_date' = ANY (v_changed) OR 'end_time' = ANY (v_changed) THEN v_new_end END,
            'new_location', CASE WHEN 'location' = ANY (v_changed) THEN n_location END,
            'new_address', CASE WHEN 'address' = ANY (v_changed) THEN NULLIF(btrim(COALESCE(n_practical->>'address', '')), '') END,
            'new_city', CASE WHEN 'city' = ANY (v_changed) THEN n_city END,
            'old_title', CASE WHEN 'title' = ANY (v_changed) THEN e.title END,
            -- Lot 9 bis (R80) : adresse retirée (variante « adresse retirée, lieu … » du SMS)
            'address_cleared', CASE WHEN 'address' = ANY (v_changed)
                                         AND NULLIF(btrim(COALESCE(n_practical->>'address', '')), '') IS NULL THEN true END));
        -- Lot 9 bis (R80) : à la fusion, une adresse changée de nouveau remplace l'ancienne (posée ou retirée)
        v_drop := ARRAY['migrated_from']
                  || CASE WHEN 'address' = ANY (v_changed) THEN ARRAY['new_address', 'address_cleared'] ELSE ARRAY[]::text[] END;
        -- Lot 9 bis (B71) : SMS dû dans 10 minutes, tout de suite si l'ancien ou le nouveau début est à moins d'une heure
        v_urgent := v_old_start < now() + interval '1 hour' OR v_new_start < now() + interval '1 hour';
        v_due := CASE WHEN v_urgent THEN now() ELSE now() + interval '10 minutes' END;
    END IF;
    IF v_notified > 0 THEN
        FOREACH v_holder IN ARRAY v_holders LOOP
            v_nkey := 'EVENT_CHANGED:' || v_event::text || ':' || v_holder::text || ':v' || v_version::text;
            -- Lot 9 bis (R32, B23) : report qui ouvre le remboursement d'un billet du porteur (règle de M06, lue après
            -- l'écriture du nouveau début et de event_start_changes) → variante « report » du modèle
            v_hdata := v_data || CASE WHEN EXISTS (SELECT 1 FROM public.tickets t
                                                    WHERE t.event_id = v_event AND t.user_id = v_holder
                                                      AND public.ticket_postponement_refund_open(t.id))
                                      THEN jsonb_build_object('refund_open', true) ELSE '{}'::jsonb END;
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                'data', v_hdata, 'channels', jsonb_build_array('IN_APP', 'PUSH')));

            -- SMS regroupé : la ligne en attente du porteur pour cet événement reçoit l'union des champs ; lot 9 bis
            -- (R26, B71) : fenêtre fixe de 10 minutes depuis le premier changement, jamais prolongée, ramenée à
            -- maintenant si un début est à moins d'une heure.
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
                   SET template_data = (v_pending_data - v_drop - 'refund_open') || v_hdata || jsonb_build_object('changed_fields', (
                           SELECT COALESCE(jsonb_agg(f ORDER BY f), '[]'::jsonb)
                             FROM (SELECT jsonb_array_elements_text(COALESCE(v_pending_data->'changed_fields', '[]'::jsonb)) AS f
                                   UNION
                                   SELECT unnest(v_changed)) x)),
                       due_at = CASE WHEN v_urgent THEN LEAST(due_at, now()) ELSE due_at END,
                       next_attempt_at = CASE WHEN v_urgent THEN LEAST(next_attempt_at, now()) ELSE next_attempt_at END
                 WHERE id = v_pending_id;
                IF v_sms THEN
                    v_sms_queued := v_sms_queued + 1;
                END IF;
            END IF;
            IF v_sms AND v_pending_id IS NULL THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                    'data', v_hdata, 'channels', jsonb_build_array('SMS'), 'due_at', v_due));
                IF EXISTS (SELECT 1 FROM public.notification_outbox o
                            WHERE o.idempotency_key = v_nkey || ':SMS' AND o.status = 'PENDING') THEN
                    v_sms_queued := v_sms_queued + 1;
                END IF;
            ELSIF NOT v_sms THEN
                -- Titre seul : aucun SMS, trace SKIPPED (le SMS déjà en attente porte le nouveau titre)
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                    'data', v_hdata, 'channels', jsonb_build_array('SMS'),
                    'skip', jsonb_build_object('SMS', 'TITLE_ONLY')));
            END IF;

            -- Lot 9 bis (G.49, B97, B71) : email du changement au compte, dû à 10 minutes et fusionné comme le SMS
            -- (index uq_outbox_event_change_pending_email) ; titre seul : fusion seulement, aucune ligne nouvelle.
            v_pending_id := NULL;
            SELECT o.id, o.template_data INTO v_pending_id, v_pending_data
              FROM public.notification_outbox o
             WHERE o.event_id = v_event AND o.recipient_user_id = v_holder
               AND o.type = 'EVENT_CHANGED' AND o.channel = 'EMAIL' AND o.status = 'PENDING'
             ORDER BY o.created_at, o.id
             LIMIT 1
               FOR UPDATE;
            IF v_pending_id IS NOT NULL THEN
                UPDATE public.notification_outbox
                   SET template_data = (v_pending_data - v_drop - 'refund_open') || v_hdata || jsonb_build_object('changed_fields', (
                           SELECT COALESCE(jsonb_agg(f ORDER BY f), '[]'::jsonb)
                             FROM (SELECT jsonb_array_elements_text(COALESCE(v_pending_data->'changed_fields', '[]'::jsonb)) AS f
                                   UNION
                                   SELECT unnest(v_changed)) x)),
                       due_at = CASE WHEN v_urgent THEN LEAST(due_at, now()) ELSE due_at END,
                       next_attempt_at = CASE WHEN v_urgent THEN LEAST(next_attempt_at, now()) ELSE next_attempt_at END
                 WHERE id = v_pending_id;
            ELSIF v_sms THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                    'data', v_hdata, 'channels', jsonb_build_array('EMAIL'), 'due_at', v_due));
            END IF;
        END LOOP;
    END IF;

    -- Lot 9 bis (R12, B69) : numéros sans compte (invitations non réclamées, acheteurs au guichet), mêmes statuts de
    -- billet que les porteurs ; un SMS par numéro, fusionné par numéro ; numéros des porteurs prévenus retirés.
    IF cardinality(v_changed) > 0 THEN
        FOR n IN
            SELECT x.phone, (array_agg(x.ticket_id ORDER BY x.ticket_id))[1] AS ticket_id
              FROM (SELECT tr.to_phone_or_email AS phone, t.id AS ticket_id
                      FROM public.ticket_transfers tr
                      JOIN public.tickets t ON t.id = tr.ticket_id
                     WHERE t.event_id = v_event AND tr.status::text = 'PENDING' AND tr.from_user_id IS NULL
                       AND t.user_id IS NULL AND t.status::text = 'VALIDE'
                    UNION ALL
                    SELECT '+221' || py.payer_phone, t.id
                      FROM public.tickets t
                      JOIN public.payments py ON py.id = t.payment_id
                     WHERE t.event_id = v_event AND t.sale_channel::text = 'COUNTER' AND NOT py.is_platform_payment
                       AND py.payer_phone ~ '^7[05678][0-9]{7}$'
                       AND (t.status::text = 'VALIDE'
                            OR (t.status::text = 'UTILISE' AND n_end_date IS NOT NULL AND n_end_date > n_start_date))) x
             WHERE x.phone ~ '^\+221[0-9]{9}$'
               AND NOT EXISTS (SELECT 1 FROM public.users u
                                WHERE u.id = ANY (COALESCE(v_holders, ARRAY[]::uuid[])) AND u.phone IN (x.phone, substr(x.phone, 2)))
             GROUP BY x.phone
             ORDER BY x.phone
        LOOP
            v_phones := v_phones + 1;
            v_pending_id := NULL;
            SELECT o.id, o.template_data INTO v_pending_id, v_pending_data
              FROM public.notification_outbox o
             WHERE o.event_id = v_event AND o.recipient_phone = n.phone AND o.recipient_user_id IS NULL
               AND o.type = 'EVENT_CHANGED' AND o.channel = 'SMS' AND o.status = 'PENDING'
             ORDER BY o.created_at, o.id
             LIMIT 1
               FOR UPDATE;
            IF v_pending_id IS NOT NULL THEN
                UPDATE public.notification_outbox
                   SET template_data = (v_pending_data - v_drop) || v_data || jsonb_build_object(
                           'recipient_kind', 'PHONE', 'ticket_id', n.ticket_id, 'changed_fields', (
                           SELECT COALESCE(jsonb_agg(f ORDER BY f), '[]'::jsonb)
                             FROM (SELECT jsonb_array_elements_text(COALESCE(v_pending_data->'changed_fields', '[]'::jsonb)) AS f
                                   UNION
                                   SELECT unnest(v_changed)) x)),
                       due_at = CASE WHEN v_urgent THEN LEAST(due_at, now()) ELSE due_at END,
                       next_attempt_at = CASE WHEN v_urgent THEN LEAST(next_attempt_at, now()) ELSE next_attempt_at END
                 WHERE id = v_pending_id;
                IF v_sms THEN
                    v_sms_queued := v_sms_queued + 1;
                END IF;
            ELSIF v_sms THEN
                v_nkey := 'EVENT_CHANGED:' || v_event::text || ':t' || n.ticket_id::text || ':v' || v_version::text;
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'phone', n.phone, 'event_id', v_event,
                    'data', v_data || jsonb_build_object('recipient_kind', 'PHONE', 'ticket_id', n.ticket_id),
                    'channels', jsonb_build_array('SMS'), 'due_at', v_due));
                IF EXISTS (SELECT 1 FROM public.notification_outbox o
                            WHERE o.idempotency_key = v_nkey || ':SMS' AND o.status = 'PENDING') THEN
                    v_sms_queued := v_sms_queued + 1;
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- Lot 9 bis (R33, B72) : contrôleurs affectés (affectations acceptées) prévenus d'un changement de date ou de lieu :
    -- in-app tout de suite ; SMS et email dus dans 10 minutes, fusionnés comme EVENT_CHANGED (ligne en attente du
    -- contrôleur, index uq_outbox_controller_change_pending_sms pour le SMS) ; titre seul : fusion seulement.
    IF cardinality(v_changed) > 0 THEN
        FOR n IN
            SELECT ec.user_id FROM public.event_controllers ec WHERE ec.event_id = v_event ORDER BY ec.user_id
        LOOP
            v_nkey := 'CONTROLLER_EVENT_CHANGED:' || v_event::text || ':' || n.user_id::text || ':v' || v_version::text;
            IF v_sms THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'CONTROLLER_EVENT_CHANGED', 'key', v_nkey, 'user_id', n.user_id, 'event_id', v_event,
                    'data', v_data, 'channels', jsonb_build_array('IN_APP')));
            END IF;
            FOREACH v_ch IN ARRAY ARRAY['SMS', 'EMAIL'] LOOP
                v_pending_id := NULL;
                SELECT o.id, o.template_data INTO v_pending_id, v_pending_data
                  FROM public.notification_outbox o
                 WHERE o.event_id = v_event AND o.recipient_user_id = n.user_id
                   AND o.type = 'CONTROLLER_EVENT_CHANGED' AND o.channel = v_ch AND o.status = 'PENDING'
                 ORDER BY o.created_at, o.id
                 LIMIT 1
                   FOR UPDATE;
                IF v_pending_id IS NOT NULL THEN
                    UPDATE public.notification_outbox
                       SET template_data = (v_pending_data - v_drop) || v_data || jsonb_build_object('changed_fields', (
                               SELECT COALESCE(jsonb_agg(f ORDER BY f), '[]'::jsonb)
                                 FROM (SELECT jsonb_array_elements_text(COALESCE(v_pending_data->'changed_fields', '[]'::jsonb)) AS f
                                       UNION
                                       SELECT unnest(v_changed)) x)),
                           due_at = CASE WHEN v_urgent THEN LEAST(due_at, now()) ELSE due_at END,
                           next_attempt_at = CASE WHEN v_urgent THEN LEAST(next_attempt_at, now()) ELSE next_attempt_at END
                     WHERE id = v_pending_id;
                ELSIF v_sms THEN
                    PERFORM public.notif_enqueue(jsonb_build_object(
                        'type', 'CONTROLLER_EVENT_CHANGED', 'key', v_nkey, 'user_id', n.user_id, 'event_id', v_event,
                        'data', v_data, 'channels', jsonb_build_array(v_ch), 'due_at', v_due));
                END IF;
            END LOOP;
        END LOOP;
    END IF;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', CASE WHEN v_post THEN 'EVENT_LIVE_UPDATED' ELSE 'EVENT_UPDATED' END, 'EVENT', v_event,
            jsonb_build_object('status', e.status::text,
                               'fields', (SELECT COALESCE(jsonb_agg(k ORDER BY k), '[]'::jsonb) FROM jsonb_object_keys(v_patch) AS k),
                               'notified_fields', to_jsonb(v_changed), 'notified_holders', v_notified, 'notified_phones', v_phones,
                               'sms_queued', v_sms_queued, 'end_moved_later', v_new_end > v_old_end));

    SELECT to_jsonb(ev) INTO v_row FROM public.events ev WHERE ev.id = v_event;
    RETURN jsonb_build_object('ok', true, 'event', v_row, 'notified_holders', v_notified, 'notified_phones', v_phones,
                              'sms_queued', v_sms_queued, 'changed_fields', to_jsonb(v_changed));
END;
$$;

-- 3.4 event_transition (recopie de 20261109000008_lot9bis_cycle.sql)
CREATE OR REPLACE FUNCTION public.event_transition(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_to_text text := p->>'to_status';
    v_to event_status;
    v_event uuid;
    v_actor uuid;
    v_reason text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    e record;
    a record;
    v_role text;
    v_reason_required boolean;
    v_role_missing boolean;
    v_missing jsonb := '[]'::jsonb;
    v_history uuid;
    v_owner uuid;
    v_partner_status text;
BEGIN
    -- Finition 2a (1a) : fiche SUSPENDU, événements en lecture seule pour la partenaire (l'admin events.write garde ses actions)
    IF public.partner_owner_suspended(public.try_uuid(p->>'event_id'), public.try_uuid(p->>'actor_id')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    IF v_to_text IS NULL OR NOT EXISTS (
        SELECT 1 FROM pg_enum WHERE enumtypid = 'public.event_status'::regtype AND enumlabel = v_to_text) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_STATUS', 'message', 'Statut demandé inconnu.');
    END IF;
    v_to := v_to_text::event_status;
    BEGIN
        v_event := (p->>'event_id')::uuid;
        v_actor := (p->>'actor_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END;
    IF v_event IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;

    SELECT id, partner_id, status, title, image_url, start_date, start_time INTO e
      FROM public.events WHERE id = v_event FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;

    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (a.is_owner OR a.is_staff) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'role_missing', true,
                                  'message', 'Vous n''êtes pas autorisé à changer le statut de cet événement.');
    END IF;
    IF NOT a.is_active THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n''est pas actif.');
    END IF;
    IF v_to = 'ANNULE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CANCELLATION_REQUIRED',
                                  'message', 'L''annulation passe par la procédure d''annulation, qui rembourse les acheteurs.');
    END IF;

    -- Règle de la table : le propriétaire agit comme partenaire, sinon l'admin comme admin
    IF a.is_owner THEN
        SELECT t.reason_required INTO v_reason_required FROM public.event_status_transitions t
         WHERE t.from_status = e.status AND t.to_status = v_to AND t.actor_kind = 'PARTENAIRE' AND t.channel = 'TRANSITION';
        IF FOUND THEN v_role := 'PARTENAIRE'; END IF;
    END IF;
    IF v_role IS NULL AND a.is_staff THEN
        SELECT t.reason_required INTO v_reason_required FROM public.event_status_transitions t
         WHERE t.from_status = e.status AND t.to_status = v_to AND t.actor_kind = 'ADMIN' AND t.channel = 'TRANSITION';
        IF FOUND THEN v_role := 'ADMIN'; END IF;
    END IF;
    IF v_role IS NULL THEN
        v_role_missing := EXISTS (SELECT 1 FROM public.event_status_transitions t
                                   WHERE t.from_status = e.status AND t.to_status = v_to AND t.channel <> 'CANCELLATION');
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'role_missing', v_role_missing,
            'message', CASE WHEN v_role_missing
                            THEN format('Votre rôle ne permet pas de passer cet événement de « %s » à « %s ».',
                                        public.event_status_label(e.status::text), public.event_status_label(v_to::text))
                            ELSE format('Un événement « %s » ne peut pas passer à « %s ».',
                                        public.event_status_label(e.status::text), public.event_status_label(v_to::text)) END);
    END IF;

    IF v_reason_required AND (v_reason IS NULL OR char_length(v_reason) < 3) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Un motif d''au moins 3 caractères est obligatoire.');
    END IF;

    -- Lot 9 bis (R5, B18) : l'événement d'une partenaire suspendue n'est remis en ligne par personne, admin compris,
    -- avant sa réactivation (statut de la partenaire lu sans verrou : aucune fonction ne prend events puis partners).
    SELECT pa.status::text INTO v_partner_status FROM public.partners pa WHERE pa.id = e.partner_id;
    IF v_to = 'PUBLIE' AND v_partner_status = 'SUSPENDU' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED',
                                  'message', 'Le partenaire est suspendu : son événement ne peut pas être remis en ligne avant sa réactivation.');
    END IF;
    -- Lot 9 bis (R7, B39) : soumission et publication réservées à une partenaire au dossier VALIDE
    IF v_to IN ('EN_ATTENTE', 'PUBLIE') AND v_partner_status IS DISTINCT FROM 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_VALIDATED',
                                  'message', 'Votre profil d’organisateur doit être validé avant de soumettre ou de publier un événement.');
    END IF;

    IF e.status = 'BROUILLON' AND v_to = 'EN_ATTENTE' THEN
        IF NULLIF(btrim(COALESCE(e.image_url, '')), '') IS NULL THEN
            v_missing := v_missing || jsonb_build_object('field', 'image_url', 'message', 'Ajoutez une affiche à l''événement.');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.ticket_categories c WHERE c.event_id = v_event AND c.is_active) THEN
            v_missing := v_missing || jsonb_build_object('field', 'ticket_categories', 'message', 'Ajoutez au moins une catégorie de billets active.');
        END IF;
        -- Lot 9 bis (R94) : dates contrôlées à la soumission (début passé, période de vente au-delà de la fin)
        IF ((e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar') <= now() THEN
            v_missing := v_missing || jsonb_build_object('field', 'start_date', 'message', 'La date de début est passée : changez-la avant de soumettre.');
        END IF;
        SELECT v_missing || COALESCE(jsonb_agg(jsonb_build_object(
                   'field', 'ticket_categories',
                   'message', format('La période de vente de « %s » dépasse la fin de l’événement.', c.name)) ORDER BY c.name, c.id), '[]'::jsonb)
          INTO v_missing
          FROM public.ticket_categories c
         WHERE c.event_id = v_event AND c.is_active
           AND ((c.sale_start IS NOT NULL AND c.sale_start >= public.event_end_at(v_event))
             OR (c.sale_end IS NOT NULL AND c.sale_end > public.event_end_at(v_event)));
        IF jsonb_array_length(v_missing) > 0 THEN
            -- Lot 9 bis (R34) : le message liste les manques, pour que tout écran l'affiche tel quel
            RETURN jsonb_build_object('ok', false, 'code', 'SUBMIT_INCOMPLETE', 'missing', v_missing,
                                      'message', 'L’événement est incomplet : '
                                                 || (SELECT string_agg(m->>'message', ' ' ORDER BY o) FROM jsonb_array_elements(v_missing) WITH ORDINALITY AS x(m, o)));
        END IF;
    END IF;
    IF v_to = 'PUBLIE' AND public.event_end_at(v_event) <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_ENDED', 'message', 'La fin de cet événement est passée : il ne peut plus être publié.');
    END IF;
    -- Lot 9 bis (R3) : un SUSPENDU ne se clôt qu'une fois sa fin passée ; avant, il se réactive ou s'annule.
    IF e.status = 'SUSPENDU' AND v_to = 'TERMINE' AND public.event_end_at(v_event) > now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ENDED',
                                  'message', 'L’événement n’est pas fini : réactivez-le ou annulez-le.');
    END IF;
    IF v_to = 'TERMINE' AND ((e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar') > now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_STARTED',
                                  'message', 'Un événement qui n''a pas commencé ne se termine pas : suspendez-le ou annulez-le.');
    END IF;

    v_history := public.event_status_apply(v_event, e.status, v_to, v_actor, v_role, v_reason, 'TRANSITION');

    -- Lot 6 : les avis (partenaire, porteurs, administrateurs) sont mis en file par le trigger
    -- trg_event_status_notify sur la ligne d'historique, dans cette même transaction.
    SELECT user_id INTO v_owner FROM public.partners WHERE id = e.partner_id;

    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'from', e.status::text, 'to', v_to::text,
                              'actor_role', v_role, 'reason', v_reason, 'history_id', v_history,
                              'title', e.title, 'partner_user_id', v_owner);
END;
$$;

-- 3.5 event_cancel (recopie de 20261106000003_lot8_paiement.sql)
CREATE OR REPLACE FUNCTION public.event_cancel(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid;
    v_actor uuid;
    v_notice text := btrim(COALESCE(p->>'public_notice', ''));
    v_internal text := btrim(COALESCE(p->>'internal_reason', ''));
    v_confirm text := btrim(COALESCE(p->>'confirm_title', ''));
    e record;
    a record;
    r record;
    v_role text;
    v_cancellation uuid;
    v_reason text;
    v_cashout uuid;
    v_cashouts uuid[] := ARRAY[]::uuid[];
    v_res jsonb;
    v_holders uuid[];
    v_notified integer;
BEGIN
    -- Finition 2a (1a) : fiche SUSPENDU, événements en lecture seule pour la partenaire (l'admin events.write garde ses actions)
    IF public.partner_owner_suspended(public.try_uuid(p->>'event_id'), public.try_uuid(p->>'actor_id')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    BEGIN
        v_event := (p->>'event_id')::uuid;
        v_actor := (p->>'actor_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END;
    SELECT id, partner_id, status, title INTO e FROM public.events WHERE id = v_event FOR NO KEY UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (a.is_owner OR a.is_staff) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'role_missing', true,
                                  'message', 'Seuls l''organisateur de l''événement et les administrateurs peuvent l''annuler.');
    END IF;
    IF NOT a.is_active THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n''est pas actif.');
    END IF;
    IF a.is_owner AND EXISTS (SELECT 1 FROM public.event_status_transitions t
                               WHERE t.from_status = e.status AND t.to_status = 'ANNULE' AND t.actor_kind = 'PARTENAIRE' AND t.channel = 'CANCELLATION') THEN
        v_role := 'PARTENAIRE';
    ELSIF a.is_staff AND EXISTS (SELECT 1 FROM public.event_status_transitions t
                                  WHERE t.from_status = e.status AND t.to_status = 'ANNULE' AND t.actor_kind = 'ADMIN' AND t.channel = 'CANCELLATION') THEN
        v_role := 'ADMIN';
    END IF;
    IF v_role IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED',
            'message', CASE WHEN e.status = 'ANNULE' THEN 'Cet événement est déjà annulé.'
                            ELSE format('Un événement « %s » ne peut pas être annulé.', public.event_status_label(e.status::text)) END);
    END IF;
    IF v_confirm IS DISTINCT FROM btrim(e.title) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TITLE_MISMATCH',
                                  'message', 'Le titre saisi ne correspond pas au titre de l''événement.');
    END IF;
    IF char_length(v_notice) < 10 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PUBLIC_NOTICE_REQUIRED',
                                  'message', 'L''avis public doit comporter au moins 10 caractères.');
    END IF;
    IF char_length(v_internal) < 3 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INTERNAL_REASON_REQUIRED',
                                  'message', 'Le motif interne doit comporter au moins 3 caractères.');
    END IF;

    -- Lot 8 (8.2 b) : paiements avant catégories (ordre unique, contrat 2.3)
    PERFORM 1 FROM public.payments pay
     WHERE pay.event_id = v_event
        OR pay.id IN (SELECT t.payment_id FROM public.tickets t WHERE t.event_id = v_event AND t.payment_id IS NOT NULL)
     ORDER BY pay.id FOR UPDATE OF pay;

    PERFORM 1 FROM public.ticket_categories WHERE event_id = v_event ORDER BY id FOR NO KEY UPDATE;

    -- Lot 7 (D20) : transferts en attente puis billets de l'événement verrouillés avant la lecture des
    -- porteurs (même ordre que ticket_transfer_initiate et ticket_transfer_claim : transfert, puis billet).
    PERFORM 1 FROM public.ticket_transfers x
     WHERE x.status::text = 'PENDING'
       AND x.ticket_id IN (SELECT t.id FROM public.tickets t WHERE t.event_id = v_event)
     ORDER BY x.id
       FOR UPDATE OF x;
    PERFORM 1 FROM public.tickets t WHERE t.event_id = v_event ORDER BY t.id FOR UPDATE OF t;

    SELECT array_agg(DISTINCT t.user_id) INTO v_holders FROM public.tickets t
     WHERE t.event_id = v_event AND t.user_id IS NOT NULL AND t.status::text IN ('VALIDE', 'UTILISE');

    -- Une ligne restée d'une annulation non aboutie (statut non annulé) est remplacée
    INSERT INTO public.event_cancellations (event_id, cancelled_by, internal_reason, public_notice, cancelled_at, updated_at)
    VALUES (v_event, v_actor, v_internal, v_notice, now(), now())
    ON CONFLICT (event_id) DO UPDATE
       SET cancelled_by = EXCLUDED.cancelled_by, internal_reason = EXCLUDED.internal_reason,
           public_notice = EXCLUDED.public_notice, cancelled_at = EXCLUDED.cancelled_at, updated_at = now()
    RETURNING id INTO v_cancellation;

    PERFORM public.event_status_apply(v_event, e.status, 'ANNULE', v_actor, v_role, NULL, 'CANCELLATION');

    -- Transferts en attente révoqués
    UPDATE public.ticket_transfers SET status = 'CANCELLED', cancelled_at = now()
     WHERE status::text = 'PENDING' AND ticket_id IN (SELECT id FROM public.tickets WHERE event_id = v_event);
    UPDATE public.tickets SET transfer_locked = FALSE WHERE event_id = v_event AND transfer_locked;

    v_reason := format('Annulation de l''événement « %s »', e.title);

    -- Paiements en ligne : le reste dû au client (refund_request, lot 3)
    FOR r IN
        SELECT pay.id FROM public.payments pay
         WHERE pay.is_platform_payment AND pay.payment_target::text = 'TICKET'
           AND pay.status::text IN ('SUCCESS', 'PARTIAL') AND pay.amount > 0
           AND (pay.event_id = v_event
                OR pay.id IN (SELECT t.payment_id FROM public.tickets t WHERE t.event_id = v_event AND t.payment_id IS NOT NULL))
         ORDER BY pay.id
           FOR UPDATE OF pay
    LOOP
        v_cashout := public.refund_request(r.id, v_reason, 'EVENT_CANCELLATION_REFUND');
        IF v_cashout IS NOT NULL THEN
            v_cashouts := array_append(v_cashouts, v_cashout);
        END IF;
    END LOOP;

    -- Billets encore valables : espèces → remboursement par l'organisateur, gratuits et invitations
    -- → annulés (ticket_refund_request, lot 3) ; billet « à régler sur place » jamais payé → annulé.
    FOR r IN
        SELECT t.id, t.payment_id, t.order_id, t.price, t.category_id FROM public.tickets t
         WHERE t.event_id = v_event AND t.status::text = 'VALIDE'
         ORDER BY t.id
    LOOP
        IF r.payment_id IS NULL AND r.order_id IS NOT NULL AND COALESCE(r.price, 0) > 0 THEN
            UPDATE public.tickets SET status = 'ANNULE', updated_at = now() WHERE id = r.id AND status::text = 'VALIDE';
            UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = r.category_id;
        ELSE
            v_res := public.ticket_refund_request(r.id, v_actor, v_reason);
            IF COALESCE((v_res->>'ok')::boolean, false) AND v_res->>'cashout_id' IS NOT NULL THEN
                v_cashouts := array_append(v_cashouts, (v_res->>'cashout_id')::uuid);
            END IF;
        END IF;
    END LOOP;
    -- Reste (paiement déjà en remboursement, etc.) : aucun billet ne reste VALIDE sur un événement annulé
    UPDATE public.tickets SET status = 'ANNULE', updated_at = now() WHERE event_id = v_event AND status::text = 'VALIDE';

    -- Lot 6 : avis EVENT_CANCELLED aux porteurs mis en file par trg_event_status_notify (ligne d'historique
    -- de l'annulation, même transaction, porteurs lus avant toute modification des billets).
    v_notified := COALESCE(cardinality(v_holders), 0);

    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'cancellation_id', v_cancellation, 'actor_role', v_role,
                              'cashout_ids', to_jsonb(v_cashouts), 'holders_notified', v_notified, 'title', e.title);
END;
$$;

-- 3.6 ticket_invitation_create (recopie de 20261111000006_lot9quater_invites_zones.sql)
CREATE OR REPLACE FUNCTION public.ticket_invitation_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_category uuid := public.try_uuid(p->>'category_id');
    v_phones text[];
    v_quantity integer;
    v_per_event integer;
    v_per_phone integer;
    -- Lot 9 quater (D2 : AUD-32) : numéros invités par compte et par jour
    v_per_account integer;
    v_total integer;
    v_status text;
    a record;
    v_role text;
    v_category_name text;
    v_problems jsonb;
    v_rules jsonb;
    v_quota jsonb;
    v_end timestamptz;
    v_data jsonb;
    v_phone text;
    v_account uuid;
    v_new uuid[];
    v_masked text[] := ARRAY[]::text[];
    v_names_given boolean := COALESCE(jsonb_typeof(p->'guest_names'), 'null') <> 'null';
    v_names text[];
    v_name text;
BEGIN
    -- Finition 2a (1a) : fiche SUSPENDU, événements en lecture seule pour la partenaire (l'admin events.write garde ses actions)
    IF public.partner_owner_suspended(public.try_uuid(p->>'event_id'), public.try_uuid(p->>'actor_id')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    -- Étape 1 : forme (le chemin normal passe d'abord par Zod)
    IF v_actor IS NULL OR v_event IS NULL OR v_category IS NULL
       OR jsonb_typeof(p->'phones') IS DISTINCT FROM 'array'
       OR COALESCE(p->>'quantity', '') !~ '^[1-4]$'
       OR COALESCE(p->'limits'->>'per_event_hour', '') !~ '^[0-9]{1,9}$'
       OR COALESCE(p->'limits'->>'per_phone_day', '') !~ '^[0-9]{1,9}$' THEN
        RETURN public.pilotage_refusal('INVALID_INPUT');
    END IF;
    v_phones := ARRAY(SELECT jsonb_array_elements_text(p->'phones'));
    IF cardinality(v_phones) NOT BETWEEN 1 AND 10
       OR EXISTS (SELECT 1 FROM unnest(v_phones) AS x WHERE x IS NULL OR x !~ '^\+2217[05678][0-9]{7}$')
       OR (SELECT count(DISTINCT x) FROM unnest(v_phones) AS x) <> cardinality(v_phones) THEN
        RETURN public.pilotage_refusal('INVALID_INPUT');
    END IF;
    -- Lot 9 ter (9t.17) : noms des invités, un par numéro, contrôlés avant tout verrou et tout quota
    IF v_names_given THEN
        IF jsonb_typeof(p->'guest_names') <> 'array'
           OR jsonb_array_length(p->'guest_names') <> cardinality(v_phones)
           OR EXISTS (SELECT 1 FROM jsonb_array_elements(p->'guest_names') AS g(value)
                       WHERE jsonb_typeof(g.value) NOT IN ('null', 'string')) THEN
            RETURN public.pilotage_refusal('INVALID_INPUT');
        END IF;
        v_names := ARRAY(SELECT NULLIF(btrim(g.value #>> '{}'), '')
                           FROM jsonb_array_elements(p->'guest_names') WITH ORDINALITY AS g(value, ord)
                          ORDER BY g.ord);
        IF EXISTS (SELECT 1 FROM unnest(v_names) AS n WHERE n IS NOT NULL AND (char_length(n) > 60 OR n ~ '[[:cntrl:]]')) THEN
            RETURN public.pilotage_refusal('INVALID_INPUT');
        END IF;
    ELSE
        v_names := array_fill(NULL::text, ARRAY[cardinality(v_phones)]);
    END IF;
    v_quantity := (p->>'quantity')::integer;
    v_per_event := (p->'limits'->>'per_event_hour')::integer;
    v_per_phone := (p->'limits'->>'per_phone_day')::integer;
    v_per_account := CASE WHEN COALESCE(p->'limits'->>'per_account_day', '') ~ '^[0-9]{1,9}$'
                          THEN (p->'limits'->>'per_account_day')::integer ELSE 50 END;
    v_total := cardinality(v_phones) * v_quantity;

    -- Étape 2 : événement verrouillé (FOR SHARE : event_cancel et event_update attendent)
    SELECT e.status::text INTO v_status FROM public.events e WHERE e.id = v_event FOR SHARE;
    IF NOT FOUND THEN
        RETURN public.pilotage_refusal('EVENT_NOT_FOUND');
    END IF;

    -- Étape 3 : droits
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    -- Reste S3 (R2, B30) : event_actor_profile n'appelle plus « staff » qu'un admin muni d'events.write ; un admin
    -- sans cette permission garde le refus 403 FORBIDDEN du lot 9 (invitations:190), jamais un 404.
    IF NOT (a.is_owner OR a.is_staff)
       AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
        RETURN public.pilotage_refusal('EVENT_NOT_FOUND');
    END IF;
    IF NOT a.is_active THEN
        RETURN public.pilotage_refusal('ACCOUNT_NOT_ACTIVE');
    END IF;
    IF NOT a.is_owner
       AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN')
       AND NOT EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = v_actor AND ap.permission = 'events.write') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit d’envoyer des invitations pour cet événement.');
    END IF;
    v_role := CASE WHEN a.is_owner THEN 'PARTENAIRE' ELSE 'ADMIN' END;

    -- Étape 4 : statut, lu sous le verrou
    IF v_status NOT IN ('PUBLIE', 'VALIDE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ACTIVE', 'message', 'Cet événement n’accepte pas d’invitations pour le moment.');
    END IF;

    -- Étape 5 : catégorie de cet événement ; absente, l'étape 6 rend CATEGORY_NOT_FOUND
    SELECT c.name INTO v_category_name FROM public.ticket_categories c
     WHERE c.id = v_category AND c.event_id = v_event FOR UPDATE;

    -- Étape 6 : contrôles de vente en liste blanche, toute catégorie étant admise quels que soient ses canaux
    SELECT COALESCE(jsonb_agg(s.problem ORDER BY s.ord), '[]'::jsonb) INTO v_problems
      FROM jsonb_array_elements(public.ticket_sale_problems(v_event,
               jsonb_build_array(jsonb_build_object('category_id', v_category, 'quantity', v_total)))) WITH ORDINALITY AS s(problem, ord)
     WHERE s.problem->>'code' IN ('INVALID_ITEMS', 'EVENT_NOT_FOUND', 'CATEGORY_NOT_FOUND', 'INVALID_QUANTITY',
                                  'CATEGORY_INACTIVE', 'EVENT_PAST', 'INSUFFICIENT_STOCK');
    IF jsonb_array_length(v_problems) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SALE_CHECK_FAILED', 'message', 'Ces invitations ne peuvent pas être envoyées.', 'problems', v_problems);
    END IF;

    -- Étape 7 : quotas, tout ou rien ; une règle événement et une règle numéro par numéro (L4)
    SELECT jsonb_agg(q.rule) INTO v_rules
      FROM (SELECT jsonb_build_object('scope', 'invitation_event', 'bucket', v_event::text, 'window_secs', 3600, 'max', v_per_event) AS rule
              FROM unnest(v_phones)
            UNION ALL
            SELECT jsonb_build_object('scope', 'invitation_phone', 'bucket', x, 'window_secs', 86400, 'max', v_per_phone)
              FROM unnest(v_phones) AS x
            UNION ALL
            -- Lot 9 quater (D2 : AUD-32) : une unité par numéro invité, sur le compte de l'auteur, par jour
            SELECT jsonb_build_object('scope', 'invitation_account', 'bucket', v_actor::text, 'window_secs', 86400, 'max', v_per_account)
              FROM unnest(v_phones)) q;
    v_quota := public.quota_reserve(v_rules);
    IF NOT COALESCE((v_quota->>'allowed')::boolean, false) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'QUOTA_EXCEEDED', 'message', 'Limite d’invitations atteinte. Réessayez plus tard.',
                                  'scope', v_quota->>'scope', 'retry_after_seconds', (v_quota->>'retry_after_seconds')::integer);
    END IF;

    -- Étape 8 : stock, puis billets numéro par numéro
    UPDATE public.ticket_categories SET sold_quantity = sold_quantity + v_total WHERE id = v_category;
    v_end := public.event_end_at(v_event);
    v_data := COALESCE(public.notif_event_data(v_event), '{}'::jsonb);

    -- Lot 9 ter (9t.17) : numéro et nom de même rang
    FOR i IN 1 .. cardinality(v_phones) LOOP
        v_phone := v_phones[i];
        v_name := v_names[i];
        SELECT u.id INTO v_account
          FROM public.users u
         WHERE u.phone = v_phone AND public.ticket_transfer_identity(v_phone, u.id) = 'MATCH'
         ORDER BY u.id
         LIMIT 1;

        WITH ins AS (
            INSERT INTO public.tickets (event_id, category_id, user_id, ticket_number, price, qr_code, status, sale_channel, transfer_locked, guest_name)
            SELECT v_event, v_category, v_account,
                   'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
                   0, 'EV-QR-' || replace(gen_random_uuid()::text, '-', ''), 'VALIDE', 'INVITATION', v_account IS NULL, v_name
              FROM generate_series(1, v_quantity)
            RETURNING id
        )
        SELECT array_agg(id ORDER BY id) INTO v_new FROM ins;

        IF v_account IS NULL THEN
            INSERT INTO public.ticket_transfers (ticket_id, from_user_id, to_phone_or_email, status, claim_token_hash, expires_at)
            SELECT x, NULL, v_phone, 'PENDING', NULL, v_end FROM unnest(v_new) AS x;
        END IF;

        -- Étape 9 : un SMS par numéro, sans actor_id ni user_id (AR15), hors quota par compte
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'INVITATION_RECEIVED', 'key', 'INVITATION_RECEIVED:' || v_new[1]::text,
            'phone', v_phone, 'event_id', v_event,
            'data', v_data || jsonb_build_object('ticket_count', v_quantity, 'ticket_id', v_new[1]),
            'channels', jsonb_build_array('SMS')));
        -- Lot 9 bis (R79, B78 ; G.49, B97) : billets attribués à un compte vérifié → in-app, push et email au compte,
        -- sans acteur
        IF v_account IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'INVITATION_RECEIVED', 'key', 'INVITATION_RECEIVED:' || v_new[1]::text,
                'user_id', v_account, 'event_id', v_event,
                'data', v_data || jsonb_build_object('ticket_count', v_quantity, 'ticket_id', v_new[1]),
                'channels', jsonb_build_array('IN_APP', 'PUSH', 'EMAIL')));
        END IF;

        v_masked := v_masked || ('+221***' || right(v_phone, 2));
    END LOOP;

    -- Étape 10 : audit, numéros masqués ; lot 9 ter (9t.17) : nombre de numéros nommés, jamais les noms
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, v_role, 'TICKET_INVITATIONS_SENT', 'events', v_event,
            jsonb_build_object('category_id', v_category, 'category', v_category_name, 'phone_count', cardinality(v_phones),
                               'ticket_count', v_total, 'quantity', v_quantity, 'phones_masked', to_jsonb(v_masked))
            || CASE WHEN v_names_given
                    THEN jsonb_build_object('named_count', (SELECT count(*) FROM unnest(v_names) AS n WHERE n IS NOT NULL)::integer)
                    ELSE '{}'::jsonb END);

    RETURN jsonb_build_object('ok', true, 'ticket_count', v_total, 'phone_count', cardinality(v_phones));
END;
$$;

-- 3.7 ticket_invitation_cancel (recopie de 20261109000009_lot9bis_messages.sql)
CREATE OR REPLACE FUNCTION public.ticket_invitation_cancel(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_ticket uuid := public.try_uuid(p->>'ticket_id');
    a record;
    v_role text;
    v_ticket_event uuid;
    v_channel text;
    v_category uuid;
    v_status text;
    v_holder uuid;
    v_phone text;
BEGIN
    -- Finition 2a (1a) : fiche SUSPENDU, événements en lecture seule pour la partenaire (l'admin events.write garde ses actions)
    IF public.partner_owner_suspended(public.try_uuid(p->>'event_id'), public.try_uuid(p->>'actor_id')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    IF v_actor IS NULL OR v_event IS NULL OR v_ticket IS NULL THEN
        RETURN public.pilotage_refusal('INVALID_INPUT');
    END IF;

    PERFORM 1 FROM public.events e WHERE e.id = v_event FOR SHARE;
    IF NOT FOUND THEN
        RETURN public.pilotage_refusal('EVENT_NOT_FOUND');
    END IF;

    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    -- Reste S3 (R2, B30) : event_actor_profile n'appelle plus « staff » qu'un admin muni d'events.write ; un admin
    -- sans cette permission garde le refus 403 FORBIDDEN du lot 9 (invitations-annulation:261), jamais un 404.
    IF NOT (a.is_owner OR a.is_staff)
       AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
        RETURN public.pilotage_refusal('EVENT_NOT_FOUND');
    END IF;
    IF NOT a.is_active THEN
        RETURN public.pilotage_refusal('ACCOUNT_NOT_ACTIVE');
    END IF;
    IF NOT a.is_owner
       AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN')
       AND NOT EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = v_actor AND ap.permission = 'events.write') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit d’annuler les invitations de cet événement.');
    END IF;
    v_role := CASE WHEN a.is_owner THEN 'PARTENAIRE' ELSE 'ADMIN' END;

    -- Catégorie et événement d'un billet ne changent jamais : la lecture sans verrou suffit
    SELECT t.event_id, t.sale_channel, t.category_id INTO v_ticket_event, v_channel, v_category
      FROM public.tickets t WHERE t.id = v_ticket;
    IF NOT FOUND OR v_ticket_event <> v_event OR v_channel <> 'INVITATION' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;

    PERFORM 1 FROM public.ticket_categories c WHERE c.id = v_category FOR NO KEY UPDATE;
    PERFORM 1 FROM public.ticket_transfers x WHERE x.ticket_id = v_ticket AND x.status = 'PENDING' FOR UPDATE;
    SELECT t.status::text, t.user_id INTO v_status, v_holder FROM public.tickets t WHERE t.id = v_ticket FOR UPDATE;

    IF v_status = 'UTILISE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_ALREADY_USED', 'message', 'Ce billet a déjà été scanné : l’invitation ne peut plus être annulée.');
    END IF;
    IF v_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_CANCELLABLE', 'message', 'Cette invitation ne peut plus être annulée.');
    END IF;

    -- Lot 9 bis (R22) : invitation non réclamée, son numéro est lu avant la révocation du transfert
    IF v_holder IS NULL THEN
        SELECT x.to_phone_or_email INTO v_phone
          FROM public.ticket_transfers x
         WHERE x.ticket_id = v_ticket AND x.status = 'PENDING' AND x.to_phone_or_email ~ '^\+221[0-9]{9}$'
         ORDER BY x.created_at DESC, x.id
         LIMIT 1;
    END IF;

    UPDATE public.ticket_transfers SET status = 'CANCELLED', cancelled_at = now()
     WHERE ticket_id = v_ticket AND status = 'PENDING';
    UPDATE public.tickets SET status = 'ANNULE', transfer_locked = FALSE, updated_at = now() WHERE id = v_ticket;
    UPDATE public.ticket_categories SET sold_quantity = sold_quantity - 1 WHERE id = v_category;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, v_role, 'TICKET_INVITATION_CANCELLED', 'tickets', v_ticket,
            jsonb_build_object('event_id', v_event, 'category_id', v_category));

    -- Lot 9 bis (R22, B73) : avis au porteur, sinon au numéro de l'invitation (SMS seul, aucun compte)
    IF v_holder IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'TICKET_CANCELLED', 'key', 'TICKET_CANCELLED:' || v_ticket::text,
            'user_id', v_holder, 'event_id', v_event,
            'data', COALESCE(public.notif_event_data(v_event), '{}'::jsonb)
                    || jsonb_build_object('kind', 'INVITATION', 'ticket_id', v_ticket)));
    ELSIF v_phone IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'TICKET_CANCELLED', 'key', 'TICKET_CANCELLED:' || v_ticket::text,
            'phone', v_phone, 'event_id', v_event, 'channels', jsonb_build_array('SMS'),
            'data', COALESCE(public.notif_event_data(v_event), '{}'::jsonb)
                    || jsonb_build_object('kind', 'INVITATION', 'ticket_id', v_ticket)));
    END IF;

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3.8 ticket_invitation_guest_name_set (recopie de 20261110000008_lot9ter_invites.sql)
CREATE OR REPLACE FUNCTION public.ticket_invitation_guest_name_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_ticket uuid := public.try_uuid(p->>'ticket_id');
    v_name text;
    v_status text;
    a record;
    v_role text;
    t record;
    v_changed boolean;
BEGIN
    -- Finition 2a (1a) : fiche SUSPENDU, événements en lecture seule pour la partenaire (l'admin events.write garde ses actions)
    IF public.partner_owner_suspended(public.try_uuid(p->>'event_id'), public.try_uuid(p->>'actor_id')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    -- Étape 1 : forme (le chemin normal passe d'abord par Zod)
    IF v_actor IS NULL OR v_event IS NULL OR v_ticket IS NULL
       OR COALESCE(jsonb_typeof(p->'guest_name'), 'null') NOT IN ('null', 'string') THEN
        RETURN public.pilotage_refusal('INVALID_INPUT');
    END IF;
    v_name := NULLIF(btrim(p->>'guest_name'), '');
    IF v_name IS NOT NULL AND char_length(v_name) > 60 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'field', 'guest_name',
                                  'message', 'Le nom de l’invité ne doit pas dépasser 60 caractères.');
    END IF;
    IF v_name IS NOT NULL AND v_name ~ '[[:cntrl:]]' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'field', 'guest_name',
                                  'message', 'Le nom de l’invité contient un caractère non permis.');
    END IF;

    -- Étape 2 : événement verrouillé (FOR SHARE, comme ticket_invitation_create)
    SELECT e.status::text INTO v_status FROM public.events e WHERE e.id = v_event FOR SHARE;
    IF NOT FOUND THEN
        RETURN public.pilotage_refusal('EVENT_NOT_FOUND');
    END IF;

    -- Étape 3 : droits (bloc de ticket_invitation_create)
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (a.is_owner OR a.is_staff)
       AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
        RETURN public.pilotage_refusal('EVENT_NOT_FOUND');
    END IF;
    IF NOT a.is_active THEN
        RETURN public.pilotage_refusal('ACCOUNT_NOT_ACTIVE');
    END IF;
    IF NOT a.is_owner
       AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN')
       AND NOT EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = v_actor AND ap.permission = 'events.write') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit de modifier les invitations de cet événement.');
    END IF;
    v_role := CASE WHEN a.is_owner THEN 'PARTENAIRE' ELSE 'ADMIN' END;

    -- Étape 4 : billet d'invitation de cet événement, verrouillé (le compostage tient le même billet)
    SELECT tk.id, tk.status::text AS status INTO t
      FROM public.tickets tk
     WHERE tk.id = v_ticket AND tk.event_id = v_event AND tk.sale_channel = 'INVITATION'
       FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;

    -- Étape 5 : seule une invitation VALIDE se renomme
    IF t.status = 'UTILISE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_ALREADY_USED', 'message', 'Ce billet a déjà été utilisé : le nom ne peut plus être modifié.');
    END IF;
    IF t.status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_EDITABLE', 'message', 'Cette invitation ne peut plus être modifiée.');
    END IF;

    -- Étape 6 : nom seul (ni user_id ni status : trg_tickets_secret_guard n'est pas déclenché)
    UPDATE public.tickets SET guest_name = v_name, updated_at = now()
     WHERE id = v_ticket AND guest_name IS DISTINCT FROM v_name;
    v_changed := FOUND;

    -- Étape 7 : audit, jamais le nom (x12)
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, v_role, 'TICKET_INVITATION_GUEST_NAMED', 'tickets', v_ticket,
            jsonb_build_object('event_id', v_event, 'named', v_name IS NOT NULL, 'changed', v_changed));

    RETURN jsonb_build_object('ok', true, 'ticket_id', v_ticket, 'guest_name', v_name);
END;
$$;

-- 3.9 event_cash_refund_mark (recopie de 20261109000006_lot9bis_argent.sql)
CREATE OR REPLACE FUNCTION public.event_cash_refund_mark(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event   uuid := public.try_uuid(p->>'event_id');
    v_payment uuid := public.try_uuid(p->>'payment_id');
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_note    text := NULLIF(btrim(COALESCE(p->>'note', '')), '');
    v_status  text;
    v_owner   uuid;
    v_amount  numeric;
    m         record;
BEGIN
    -- Finition 2a (1a) : fiche SUSPENDU, événements en lecture seule pour la partenaire (l'admin events.write garde ses actions)
    IF public.partner_owner_suspended(public.try_uuid(p->>'event_id'), public.try_uuid(p->>'actor_id')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    SELECT e.status::text, pa.user_id INTO v_status, v_owner
      FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = v_event;
    IF v_event IS NULL OR v_actor IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF v_owner IS DISTINCT FROM v_actor THEN
        IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN',
                                      'message', 'Seul l’organisateur de l’événement marque les espèces rendues.');
        END IF;
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;
    IF v_status <> 'ANNULE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_CANCELLED',
                                  'message', 'La liste des espèces à rembourser n’existe que pour un événement annulé.');
    END IF;
    SELECT pay.amount INTO v_amount
      FROM public.payments pay
     WHERE pay.id = v_payment AND pay.event_id = v_event AND NOT pay.is_platform_payment
       AND pay.payment_target::text = 'TICKET' AND pay.status::text = 'SUCCESS' AND pay.amount > 0;
    IF v_payment IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PAYMENT_NOT_FOUND', 'message', 'Vente introuvable dans la liste des espèces à rembourser.');
    END IF;
    IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'La note est limitée à 500 caractères.');
    END IF;

    SELECT * INTO m FROM public.event_cash_refund_marks WHERE payment_id = v_payment;
    IF NOT FOUND THEN
        BEGIN
            INSERT INTO public.event_cash_refund_marks (payment_id, event_id, marked_by, note)
            VALUES (v_payment, v_event, v_actor, v_note)
            RETURNING * INTO m;
            INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
            VALUES (v_actor, 'PARTENAIRE', 'CASH_REFUND_MARKED', 'payments', v_payment,
                    jsonb_build_object('event_id', v_event, 'payment_id', v_payment, 'amount', v_amount, 'note', v_note));
            RETURN jsonb_build_object('ok', true,
                'mark', jsonb_build_object('payment_id', m.payment_id, 'refunded_at', m.marked_at, 'refunded_by_id', m.marked_by,
                                           'refunded_by', (SELECT NULLIF(btrim(concat_ws(' ', u.first_name, u.last_name)), '')
                                                             FROM public.users u WHERE u.id = m.marked_by),
                                           'note', m.note));
        EXCEPTION WHEN unique_violation THEN
            -- Course sur la clé primaire : la marque concurrente fait foi (lue ci-dessous)
            SELECT * INTO m FROM public.event_cash_refund_marks WHERE payment_id = v_payment;
        END;
    END IF;
    RETURN jsonb_build_object('ok', true, 'code', 'ALREADY_MARKED',
        'message', 'Cette vente est déjà marquée remboursée.',
        'mark', jsonb_build_object('payment_id', m.payment_id, 'refunded_at', m.marked_at, 'refunded_by_id', m.marked_by,
                                   'refunded_by', (SELECT NULLIF(btrim(concat_ws(' ', u.first_name, u.last_name)), '')
                                                     FROM public.users u WHERE u.id = m.marked_by),
                                   'note', m.note));
END;
$$;

-- 3.10 ticket_refund_request (recopie de 20261110000006_lot9ter_equipe_messages.sql)
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

REVOKE ALL ON FUNCTION public.partner_owner_suspended(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.partner_owner_suspended(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.partner_actor_suspended(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.partner_actor_suspended(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.event_regisseur_pin_store(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_regisseur_pin_store(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.ticket_category_guard(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_category_guard(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.event_create(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_create(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_update(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_update(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_transition(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_transition(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_cancel(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_cancel(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.ticket_invitation_create(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_invitation_create(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.ticket_invitation_cancel(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_invitation_cancel(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.ticket_invitation_guest_name_set(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_invitation_guest_name_set(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_cash_refund_mark(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_cash_refund_mark(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.ticket_refund_request(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_refund_request(uuid, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.events_suspended_owner_delete_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.regisseur_pin_suspended_guard() FROM PUBLIC, anon, authenticated;
