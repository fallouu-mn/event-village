-- ============================================================================
-- EVENT VILLAGE — LOT CARTE B3, migration 01 : lieux publics, lecture par le serveur, position obligatoire
-- ============================================================================
-- Décisions du client du 25/11 (elles remplacent celle du 21/11 sur les particuliers) :
--  a. l'application est entièrement publique : toutes les salles et tous les établissements validés sont montrés à leur
--     position exacte, avec l'adresse et l'itinéraire sur leur fiche, pour tout le monde ; plus de zone de 300 m ni de
--     distinction particulier / professionnel (rien de cela n'est créé ici : la migration n'avait été appliquée nulle
--     part) ;
--  b. la position exacte est OBLIGATOIRE pour ce qui est publié : événement, salle, établissement. Ce qui est déjà
--     publié sans position reste en ligne (une réactivation n'est pas bloquée).
-- Contenu :
--  1. REST (faille F1 du lot, gardée) : address, latitude, longitude retirées des colonnes lisibles par anon et
--     authenticated, sur halls et venues ; tout passe par les routes du serveur, colonne par colonne (aucun écran ne lit
--     ces tables par le navigateur) ;
--  2. envoi en validation refusé sans position, avec « Placez votre lieu sur la carte avant d’envoyer. » : hall_submit et venue_submit (position seule
--     manquante : POSITION_REQUIRED ; sinon la liste des manques), venue_create (la création est l'envoi),
--     event_transition (brouillon → en attente : le refus de la finition 2a garde son code POSITION_REQUIRED, avec cette
--     phrase) ; une salle ou un établissement inséré sans position n'est jamais validé d'office (halls_validation_guard,
--     venues_validation_guard : il attend en validation) ;
--  3. validation par l'administration refusée sans position (POSITION_REQUIRED) : hall_validation_decide et
--     venue_validation_decide (VALIDER ; REACTIVER garde ce qui était déjà publié), event_transition (EN_ATTENTE → VALIDE).
-- Recopies (chaque fois la DERNIÈRE définition d'avant cette migration ; aucune ligne perdue :
-- tests/schema/migration-carte-b3-rejouable.test.ts) :
--   halls_validation_guard : recopie de 20261126000006_l10b_cv_envoi.sql:20-51
--   hall_submit : recopie de 20261126000006_l10b_cv_envoi.sql:54-110
--   venues_validation_guard : recopie de 20261129000001_l11b_etablissements.sql:77-112
--   venue_create : recopie de 20261129000001_l11b_etablissements.sql:155-256
--   venue_submit : recopie de 20261129000001_l11b_etablissements.sql:261-314
--   hall_validation_decide : recopie de 20261126000001_l10b_droit_validation.sql:20-93
--   venue_validation_decide : recopie de 20261126000001_l10b_droit_validation.sql:99-168
--   event_transition : recopie de 20261116000003_f2a_carte.sql:826-983
-- La session 11c-a (migrations 20261201…) recopie event_update, ticket_category_create et ticket_category_update :
-- aucune des trois n'est recopiée ici, et aucune des fonctions ci-dessus n'est touchée par la 11c-a.
-- Aucun BEGIN ni COMMIT ; rejouable (REVOKE puis GRANT, CREATE OR REPLACE ; droits des fonctions gardés).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. REST : ni adresse ni position lisibles directement (le serveur choisit ce qui sort)
-- ----------------------------------------------------------------------------
REVOKE SELECT ON public.halls FROM anon, authenticated;
GRANT SELECT (id, partner_id, name, description, capacity, price_per_day, price_per_hour, deposit_percentage, city,
              amenities, images, is_active, created_at, updated_at, validation_status, validation_reason, validated_by,
              validated_at, deposit_mode, deposit_value, cancellation_policy, submitted_at)
    ON public.halls TO anon, authenticated;
GRANT ALL ON public.halls TO service_role;

-- Reprise de 20261129000009_l11b_cv_lectures_etablissements.sql:54-58 sans address, latitude, longitude
REVOKE SELECT ON public.venues FROM anon, authenticated;
GRANT SELECT (id, partner_id, kind, name, description, city, photos, slot_minutes, deposit_per_person, confirmation_mode,
              floor_plan_enabled, is_active, validation_status)
    ON public.venues TO anon, authenticated;
GRANT ALL ON public.venues TO service_role;

-- ----------------------------------------------------------------------------
-- 2. Salle insérée sans position : jamais validée d’office
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.halls_validation_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Écriture par hall_validation_decide (drapeau de la transaction) : rien à corriger
    IF current_setting('event_village.hall_validation', true) = 'on' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
        -- Lot Carte B3 (décision du client du 25/11) : une salle sans position n'est jamais validée d'office ; elle
        -- attend en validation, et l'administration ne peut la valider qu'une fois la position placée
        NEW.validation_status := CASE WHEN public.fin_setting_bool('halls.validation_required') OR NEW.latitude IS NULL OR NEW.longitude IS NULL
                                      THEN 'EN_ATTENTE_VALIDATION' ELSE 'VALIDEE' END;
        NEW.validation_reason := NULL;
        NEW.validated_by := NULL;
        NEW.validated_at := CASE WHEN NEW.validation_status = 'VALIDEE' THEN now() END;
        -- Contre-vérification du lot 10b (point ouvert) : date exacte de l'envoi en validation
        NEW.submitted_at := CASE WHEN NEW.validation_status = 'EN_ATTENTE_VALIDATION' THEN now() END;
        RETURN NEW;
    END IF;
    -- Mise à jour par la partenaire ou par une route : statut et décision gardés. Lot 10b : une salle refusée puis
    -- modifiée reste refusée jusqu'à ce que sa propriétaire la renvoie en validation (hall_submit)
    NEW.validation_status := OLD.validation_status;
    NEW.validation_reason := OLD.validation_reason;
    NEW.validated_by := OLD.validated_by;
    NEW.validated_at := OLD.validated_at;
    NEW.submitted_at := OLD.submitted_at;
    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Renvoi d’une salle : refusé sans position
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hall_submit(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_hall_id uuid := public.try_uuid(p->>'hall_id');
    h         record;
    v_missing text[] := ARRAY[]::text[];
    v_new     text;
BEGIN
    SELECT hl.*, pa.status::text AS partner_status, pa.user_id AS owner_id INTO h
      FROM public.halls hl JOIN public.partners pa ON pa.id = hl.partner_id
     WHERE hl.id = v_hall_id FOR UPDATE OF hl;
    IF v_hall_id IS NULL OR v_actor IS NULL OR NOT FOUND OR h.owner_id IS DISTINCT FROM v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_FOUND', 'message', 'Salle introuvable.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;
    IF h.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_VALIDATED', 'message', 'Votre compte partenaire doit être validé avant d’envoyer une salle.');
    END IF;
    IF h.validation_status <> 'REFUSEE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION', 'message', CASE h.validation_status
            WHEN 'EN_ATTENTE_VALIDATION' THEN 'Cette salle attend déjà la validation d’Event Village.'
            WHEN 'VALIDEE' THEN 'Cette salle est déjà validée.'
            ELSE 'Cette salle est suspendue : seule l’équipe d’Event Village peut la réactiver.' END);
    END IF;
    IF NULLIF(btrim(h.name), '') IS NULL THEN v_missing := v_missing || 'le nom'::text; END IF;
    IF h.price_per_day IS NULL OR h.price_per_day < 1 THEN v_missing := v_missing || 'le prix par jour'::text; END IF;
    IF NULLIF(btrim(COALESCE(h.address, '')), '') IS NULL OR NULLIF(btrim(COALESCE(h.city, '')), '') IS NULL THEN
        v_missing := v_missing || 'l’adresse et la ville'::text;
    END IF;
    IF COALESCE(cardinality(h.images), 0) < 1 THEN v_missing := v_missing || 'une photo au moins'::text; END IF;
    IF h.latitude IS NULL THEN v_missing := v_missing || 'la position sur la carte'::text; END IF;
    -- Lot Carte B3 (décision du client du 25/11) : position seule manquante = refus simple
    IF cardinality(v_missing) = 1 AND (h.latitude IS NULL OR h.longitude IS NULL) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'POSITION_REQUIRED', 'message', 'Placez votre lieu sur la carte avant d’envoyer.');
    END IF;
    IF cardinality(v_missing) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_INCOMPLETE',
            'message', 'Avant d’envoyer la salle, ajoutez ' || array_to_string(v_missing, ', ') || '.');
    END IF;
    v_new := CASE WHEN public.fin_setting_bool('halls.validation_required') THEN 'EN_ATTENTE_VALIDATION' ELSE 'VALIDEE' END;
    PERFORM set_config('event_village.hall_validation', 'on', true);
    UPDATE public.halls
       SET validation_status = v_new, validation_reason = NULL, validated_by = NULL,
           validated_at = CASE WHEN v_new = 'VALIDEE' THEN now() END, updated_at = now(),
           submitted_at = CASE WHEN v_new = 'EN_ATTENTE_VALIDATION' THEN now() ELSE submitted_at END
     WHERE id = h.id;
    PERFORM set_config('event_village.hall_validation', 'off', true);
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'HALL_SUBMITTED', 'halls', h.id,
            jsonb_build_object('validation_status', h.validation_status), jsonb_build_object('validation_status', v_new));
    RETURN jsonb_build_object('ok', true, 'hall_id', h.id, 'validation_status', v_new);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Établissement inséré sans position : jamais validé d’office
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.venues_validation_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Écriture par venue_validation_decide (drapeau de la transaction) : rien à corriger
    IF current_setting('event_village.venue_validation', true) = 'on' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
        -- Lot Carte B3 (décision du client du 25/11) : un établissement sans position n'est jamais validé d'office
        NEW.validation_status := CASE WHEN public.fin_setting_bool('tables.validation_required') OR NEW.latitude IS NULL OR NEW.longitude IS NULL
                                      THEN 'EN_ATTENTE_VALIDATION' ELSE 'VALIDEE' END;
        NEW.validation_reason := NULL;
        NEW.validated_by := NULL;
        NEW.validated_at := CASE WHEN NEW.validation_status = 'VALIDEE' THEN now() END;
        -- Lot 11b : date exacte d'envoi en validation
        NEW.submitted_at := now();
        RETURN NEW;
    END IF;
    -- La partenaire d'un établissement ne change jamais (réservations, recettes)
    IF NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
        RAISE EXCEPTION 'Un établissement ne change pas de partenaire.';
    END IF;
    -- Mise à jour par la partenaire ou par une route : statut et décision gardés. Lot 11b : un établissement refusé
    -- puis modifié reste refusé jusqu'à ce que sa propriétaire le renvoie en validation (venue_submit)
    NEW.validation_status := OLD.validation_status;
    NEW.validation_reason := OLD.validation_reason;
    NEW.validated_by := OLD.validated_by;
    NEW.validated_at := OLD.validated_at;
    NEW.submitted_at := OLD.submitted_at;
    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Création d’un établissement (= envoi) : refusée sans position
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.venue_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_partner  record;
    v_id       uuid;
    v_hours    jsonb;
    z          jsonb;
    t          jsonb;
    v_zone_ids jsonb := '{}'::jsonb;
    v_zone_id  uuid;
    v_count    integer := 0;
    v_photos   text[];
BEGIN
    SELECT pa.id, pa.status::text AS status INTO v_partner FROM public.partners pa WHERE pa.user_id = v_actor;
    IF v_actor IS NULL OR NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', HINT = 'FORBIDDEN', MESSAGE = 'Espace réservé aux partenaires.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', HINT = 'ACCOUNT_NOT_ACTIVE', MESSAGE = 'Votre compte n’est pas actif.';
    END IF;
    IF v_partner.status <> 'VALIDE' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', HINT = 'PARTNER_NOT_VALIDATED',
            MESSAGE = 'Votre compte partenaire doit être validé avant de créer un établissement.';
    END IF;
    IF jsonb_typeof(p->'photos') <> 'array' OR jsonb_array_length(p->'photos') < 1 OR jsonb_array_length(p->'photos') > 12 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', HINT = 'VENUE_INCOMPLETE', MESSAGE = 'Ajoutez de 1 à 12 photos de l’établissement.';
    END IF;
    v_photos := ARRAY(SELECT jsonb_array_elements_text(p->'photos'));
    IF jsonb_typeof(p->'hours') <> 'array' OR jsonb_array_length(p->'hours') < 1 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', HINT = 'VENUE_INCOMPLETE', MESSAGE = 'Indiquez au moins une plage d’ouverture.';
    END IF;
    IF jsonb_typeof(p->'tables') <> 'array' OR jsonb_array_length(p->'tables') < 1 OR jsonb_array_length(p->'tables') > 200 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', HINT = 'VENUE_INCOMPLETE', MESSAGE = 'Ajoutez de 1 à 200 tables.';
    END IF;
    IF jsonb_typeof(COALESCE(p->'zones', '[]'::jsonb)) <> 'array' OR jsonb_array_length(COALESCE(p->'zones', '[]'::jsonb)) > 20 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', HINT = 'INVALID_FIELD', MESSAGE = '20 zones au plus.';
    END IF;

    BEGIN
        INSERT INTO public.venues (partner_id, kind, name, description, address, city, latitude, longitude, slot_minutes,
                                   deposit_per_person, confirmation_mode, photos, is_active)
        VALUES (v_partner.id, COALESCE(NULLIF(p->>'kind', ''), 'RESTAURANT'), btrim(COALESCE(p->>'name', '')),
                NULLIF(btrim(COALESCE(p->>'description', '')), ''), NULLIF(btrim(COALESCE(p->>'address', '')), ''),
                NULLIF(btrim(COALESCE(p->>'city', '')), ''), (p->>'latitude')::double precision, (p->>'longitude')::double precision,
                (p->>'slot_minutes')::integer, (p->>'deposit_per_person')::numeric, COALESCE(NULLIF(p->>'confirmation_mode', ''), 'AUTO'),
                v_photos, TRUE)
        RETURNING id INTO v_id;
    EXCEPTION WHEN check_violation OR invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', HINT = 'INVALID_FIELD', MESSAGE = 'Une valeur de la fiche est refusée : vérifiez le nom, la position, la durée du créneau et l’acompte.';
    END;
    IF NULLIF(btrim(COALESCE(p->>'address', '')), '') IS NULL OR NULLIF(btrim(COALESCE(p->>'city', '')), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', HINT = 'VENUE_INCOMPLETE', MESSAGE = 'Indiquez l’adresse et la ville de l’établissement.';
    END IF;

    v_hours := public.venue_hours_set(jsonb_build_object('actor_id', v_actor, 'venue_id', v_id, 'hours', p->'hours'));
    IF (v_hours->>'ok')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', HINT = COALESCE(v_hours->>'code', 'INVALID_HOURS'), MESSAGE = COALESCE(v_hours->>'message', 'Horaires refusés.');
    END IF;

    FOR z IN SELECT * FROM jsonb_array_elements(COALESCE(p->'zones', '[]'::jsonb)) LOOP
        IF NULLIF(btrim(COALESCE(z->>'name', '')), '') IS NULL OR length(btrim(z->>'name')) > 80 OR NULLIF(z->>'key', '') IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', HINT = 'INVALID_FIELD', MESSAGE = 'Chaque zone a un nom de 1 à 80 caractères.';
        END IF;
        INSERT INTO public.restaurant_zones (partner_id, venue_id, name, is_active)
        VALUES (v_partner.id, v_id, btrim(z->>'name'), TRUE) RETURNING id INTO v_zone_id;
        v_zone_ids := v_zone_ids || jsonb_build_object(z->>'key', v_zone_id);
    END LOOP;

    FOR t IN SELECT * FROM jsonb_array_elements(p->'tables') LOOP
        IF NULLIF(t->>'zone_key', '') IS NOT NULL AND NOT (v_zone_ids ? (t->>'zone_key')) THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', HINT = 'INVALID_FIELD', MESSAGE = 'Une table est rangée dans une zone inconnue.';
        END IF;
        BEGIN
            INSERT INTO public.restaurant_tables (partner_id, venue_id, zone_id, table_number, capacity, min_capacity, is_active)
            VALUES (v_partner.id, v_id, public.try_uuid(v_zone_ids->>(t->>'zone_key')), btrim(COALESCE(t->>'number', '')),
                    (t->>'capacity')::integer, COALESCE((t->>'min_capacity')::integer, 1), TRUE);
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION USING ERRCODE = 'P0001', HINT = 'INVALID_FIELD', MESSAGE = format('Deux tables portent le numéro « %s ».', btrim(COALESCE(t->>'number', '')));
            WHEN check_violation OR not_null_violation OR invalid_text_representation OR numeric_value_out_of_range THEN
                RAISE EXCEPTION USING ERRCODE = 'P0001', HINT = 'INVALID_FIELD',
                    MESSAGE = 'Chaque table a un numéro et une capacité de 1 à 50 personnes (minimum au plus égal à la capacité).';
        END;
        IF btrim(COALESCE(t->>'number', '')) = '' OR length(btrim(t->>'number')) > 20 THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', HINT = 'INVALID_FIELD', MESSAGE = 'Chaque table a un numéro de 1 à 20 caractères.';
        END IF;
        v_count := v_count + 1;
    END LOOP;

    -- Lot Carte B3 (décision du client du 25/11) : la création est l'envoi en validation ; jamais sans position
    -- (contrôlée en dernier : les autres refus gardent leur message ; l'exception annule toute la création)
    IF NULLIF(p->>'latitude', '') IS NULL OR NULLIF(p->>'longitude', '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', HINT = 'POSITION_REQUIRED', MESSAGE = 'Placez votre lieu sur la carte avant d’envoyer.';
    END IF;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'VENUE_CREATED', 'venues', v_id,
            jsonb_build_object('tables', v_count, 'zones', jsonb_array_length(COALESCE(p->'zones', '[]'::jsonb)), 'photos', cardinality(v_photos)));
    RETURN jsonb_build_object('ok', true, 'venue_id', v_id,
                              'validation_status', (SELECT validation_status FROM public.venues WHERE id = v_id));
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Renvoi d’un établissement : refusé sans position
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.venue_submit(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    v_refusal  jsonb;
    v          record;
    v_missing  text[] := ARRAY[]::text[];
    v_new      text;
BEGIN
    v_refusal := public.venue_owner_refusal(v_actor, v_venue_id);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;
    SELECT * INTO v FROM public.venues WHERE id = v_venue_id FOR UPDATE;
    IF v.validation_status <> 'REFUSEE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION', 'message', CASE v.validation_status
            WHEN 'EN_ATTENTE_VALIDATION' THEN 'Cet établissement attend déjà la validation d’Event Village.'
            WHEN 'VALIDEE' THEN 'Cet établissement est déjà validé.'
            ELSE 'Cet établissement est suspendu : seule l’équipe d’Event Village peut le réactiver.' END);
    END IF;
    IF NULLIF(btrim(v.name), '') IS NULL THEN v_missing := v_missing || 'le nom'::text; END IF;
    IF NULLIF(btrim(COALESCE(v.address, '')), '') IS NULL OR NULLIF(btrim(COALESCE(v.city, '')), '') IS NULL THEN
        v_missing := v_missing || 'l’adresse et la ville'::text;
    END IF;
    IF cardinality(v.photos) < 1 THEN v_missing := v_missing || 'une photo au moins'::text; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.venue_opening_hours h WHERE h.venue_id = v.id) THEN
        v_missing := v_missing || 'les horaires d’ouverture'::text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.restaurant_tables t WHERE t.venue_id = v.id AND t.is_active) THEN
        v_missing := v_missing || 'une table au moins'::text;
    END IF;
    -- Lot Carte B3 (décision du client du 25/11) : position obligatoire ; seule manquante = refus simple
    IF v.latitude IS NULL OR v.longitude IS NULL THEN
        IF cardinality(v_missing) = 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'POSITION_REQUIRED', 'message', 'Placez votre lieu sur la carte avant d’envoyer.');
        END IF;
        v_missing := v_missing || 'la position sur la carte'::text;
    END IF;
    IF cardinality(v_missing) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_INCOMPLETE',
            'message', 'Avant d’envoyer l’établissement, ajoutez ' || array_to_string(v_missing, ', ') || '.');
    END IF;
    v_new := CASE WHEN public.fin_setting_bool('tables.validation_required') THEN 'EN_ATTENTE_VALIDATION' ELSE 'VALIDEE' END;
    PERFORM set_config('event_village.venue_validation', 'on', true);
    UPDATE public.venues
       SET validation_status = v_new, validation_reason = NULL, validated_by = NULL,
           validated_at = CASE WHEN v_new = 'VALIDEE' THEN now() END, submitted_at = now(), updated_at = now()
     WHERE id = v.id;
    PERFORM set_config('event_village.venue_validation', 'off', true);
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'VENUE_SUBMITTED', 'venues', v.id,
            jsonb_build_object('validation_status', v.validation_status), jsonb_build_object('validation_status', v_new));
    RETURN jsonb_build_object('ok', true, 'venue_id', v.id, 'validation_status', v_new);
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Validation d’une salle : refusée sans position
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hall_validation_decide(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_hall_id  uuid := public.try_uuid(p->>'hall_id');
    v_decision text := upper(COALESCE(p->>'decision', ''));
    v_reason   text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'reason', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    h          record;
    v_new      text;
    v_role     text;
    v_owner    uuid;
BEGIN
    IF v_actor IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
       OR NOT (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
               OR public.admin_can(v_actor, 'halls.validate')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit de valider les salles.');
    END IF;
    IF v_decision NOT IN ('VALIDER', 'REFUSER', 'SUSPENDRE', 'REACTIVER') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DECISION', 'message', 'Choisissez de valider, refuser, suspendre ou réactiver la salle.');
    END IF;
    SELECT hl.*, pa.status::text AS partner_status, pa.user_id AS owner_id INTO h
      FROM public.halls hl JOIN public.partners pa ON pa.id = hl.partner_id
     WHERE hl.id = v_hall_id FOR UPDATE OF hl;
    IF v_hall_id IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_FOUND', 'message', 'Cette salle n’existe pas.');
    END IF;
    IF v_decision IN ('REFUSER', 'SUSPENDRE') AND (v_reason IS NULL OR length(v_reason) < 5) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif : il est envoyé à la partenaire.');
    END IF;
    v_new := CASE
        WHEN v_decision = 'VALIDER' AND h.validation_status = 'EN_ATTENTE_VALIDATION' THEN 'VALIDEE'
        WHEN v_decision = 'REFUSER' AND h.validation_status = 'EN_ATTENTE_VALIDATION' THEN 'REFUSEE'
        WHEN v_decision = 'SUSPENDRE' AND h.validation_status = 'VALIDEE' THEN 'SUSPENDUE'
        WHEN v_decision = 'REACTIVER' AND h.validation_status = 'SUSPENDUE' THEN 'VALIDEE'
        END;
    IF v_new IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION', 'message', 'Cette décision ne s’applique pas à la salle dans son état actuel.');
    END IF;
    IF v_new = 'VALIDEE' AND (h.price_per_day IS NULL OR h.price_per_day < 1) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PRICE_MISSING', 'message', 'La salle n’a pas de prix par jour : la partenaire doit le renseigner avant la validation.');
    END IF;
    -- Lot Carte B3 (décision du client du 25/11) : jamais validée sans position (une réactivation garde ce qui était
    -- déjà publié)
    IF v_decision = 'VALIDER' AND (h.latitude IS NULL OR h.longitude IS NULL) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'POSITION_REQUIRED', 'message', 'La salle n’a pas de position sur la carte : la partenaire doit la placer avant la validation.');
    END IF;
    IF v_new = 'VALIDEE' AND h.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_VALIDATED', 'message', 'Le compte de la partenaire n’est pas validé : validez-le d’abord.');
    END IF;

    PERFORM set_config('event_village.hall_validation', 'on', true);
    UPDATE public.halls
       SET validation_status = v_new, validation_reason = CASE WHEN v_new IN ('REFUSEE', 'SUSPENDUE') THEN v_reason END,
           validated_by = v_actor, validated_at = now(), updated_at = now()
     WHERE id = h.id;
    PERFORM set_config('event_village.hall_validation', 'off', true);

    v_role := CASE WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
                   THEN 'SUPERADMIN' ELSE 'ADMIN' END;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, v_role, 'HALL_VALIDATION_DECIDED', 'halls', h.id,
            jsonb_build_object('validation_status', h.validation_status),
            jsonb_build_object('validation_status', v_new),
            jsonb_build_object('decision', v_decision, 'reason', v_reason));
    IF h.owner_id IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'HALL_VALIDATION_DECIDED', 'key', 'HALL_VALIDATION_DECIDED:' || h.id::text || ':' || txid_current()::text,
            'user_id', h.owner_id,
            'data', jsonb_strip_nulls(jsonb_build_object('hall_id', h.id, 'hall_name', h.name, 'decision', v_decision, 'reason', v_reason))));
    END IF;
    RETURN jsonb_build_object('ok', true, 'hall_id', h.id, 'validation_status', v_new);
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Validation d’un établissement : refusée sans position
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.venue_validation_decide(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    v_decision text := upper(COALESCE(p->>'decision', ''));
    v_reason   text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'reason', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    v          record;
    v_new      text;
    v_role     text;
BEGIN
    IF v_actor IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
       OR NOT (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
               OR public.admin_can(v_actor, 'halls.validate')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit de valider les établissements.');
    END IF;
    IF v_decision NOT IN ('VALIDER', 'REFUSER', 'SUSPENDRE', 'REACTIVER') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DECISION', 'message', 'Choisissez de valider, refuser, suspendre ou réactiver l’établissement.');
    END IF;
    SELECT ve.*, pa.status::text AS partner_status, pa.user_id AS owner_id INTO v
      FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id
     WHERE ve.id = v_venue_id FOR UPDATE OF ve;
    IF v_venue_id IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_FOUND', 'message', 'Cet établissement n’existe pas.');
    END IF;
    IF v_decision IN ('REFUSER', 'SUSPENDRE') AND (v_reason IS NULL OR length(v_reason) < 5) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif : il est envoyé à la partenaire.');
    END IF;
    v_new := CASE
        WHEN v_decision = 'VALIDER' AND v.validation_status = 'EN_ATTENTE_VALIDATION' THEN 'VALIDEE'
        WHEN v_decision = 'REFUSER' AND v.validation_status = 'EN_ATTENTE_VALIDATION' THEN 'REFUSEE'
        WHEN v_decision = 'SUSPENDRE' AND v.validation_status = 'VALIDEE' THEN 'SUSPENDUE'
        WHEN v_decision = 'REACTIVER' AND v.validation_status = 'SUSPENDUE' THEN 'VALIDEE'
        END;
    IF v_new IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION', 'message', 'Cette décision ne s’applique pas à l’établissement dans son état actuel.');
    END IF;
    -- Lot Carte B3 (décision du client du 25/11) : jamais validé sans position (une réactivation garde ce qui était
    -- déjà publié)
    IF v_decision = 'VALIDER' AND (v.latitude IS NULL OR v.longitude IS NULL) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'POSITION_REQUIRED', 'message', 'L’établissement n’a pas de position sur la carte : la partenaire doit la placer avant la validation.');
    END IF;
    IF v_new = 'VALIDEE' AND v.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_VALIDATED', 'message', 'Le compte de la partenaire n’est pas validé : validez-le d’abord.');
    END IF;

    PERFORM set_config('event_village.venue_validation', 'on', true);
    UPDATE public.venues
       SET validation_status = v_new, validation_reason = CASE WHEN v_new IN ('REFUSEE', 'SUSPENDUE') THEN v_reason END,
           validated_by = v_actor, validated_at = now(), updated_at = now()
     WHERE id = v.id;
    PERFORM set_config('event_village.venue_validation', 'off', true);

    v_role := CASE WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
                   THEN 'SUPERADMIN' ELSE 'ADMIN' END;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, v_role, 'VENUE_VALIDATION_DECIDED', 'venues', v.id,
            jsonb_build_object('validation_status', v.validation_status),
            jsonb_build_object('validation_status', v_new),
            jsonb_build_object('decision', v_decision, 'reason', v_reason));
    IF v.owner_id IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'VENUE_VALIDATION_DECIDED', 'key', 'VENUE_VALIDATION_DECIDED:' || v.id::text || ':' || txid_current()::text,
            'user_id', v.owner_id,
            'data', jsonb_strip_nulls(jsonb_build_object('venue_id', v.id, 'venue_name', v.name, 'decision', v_decision, 'reason', v_reason))));
    END IF;
    RETURN jsonb_build_object('ok', true, 'venue_id', v.id, 'validation_status', v_new);
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. Événement : phrase simple à l’envoi, validation refusée sans position
-- ----------------------------------------------------------------------------
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

    SELECT id, partner_id, status, title, image_url, start_date, start_time, latitude, longitude INTO e
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
        -- Finition 2a (3) : position du lieu obligatoire pour soumettre (un brouillon s'en passe)
        IF e.latitude IS NULL OR e.longitude IS NULL THEN
            v_missing := v_missing || jsonb_build_object('field', 'latitude', 'message', 'Placez votre lieu sur la carte avant d’envoyer.');
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
            -- Finition 2a (3) : POSITION_REQUIRED quand la position est le seul manque
            RETURN jsonb_build_object('ok', false,
                                      'code', CASE WHEN jsonb_array_length(v_missing) = 1 AND v_missing->0->>'field' = 'latitude'
                                                   THEN 'POSITION_REQUIRED' ELSE 'SUBMIT_INCOMPLETE' END,
                                      'missing', v_missing,
                                      -- Lot Carte B3 (décision du client du 25/11) : position seule manquante = phrase simple
                                      'message', CASE WHEN jsonb_array_length(v_missing) = 1 AND v_missing->0->>'field' = 'latitude'
                                                      THEN 'Placez votre lieu sur la carte avant d’envoyer.'
                                                      ELSE 'L’événement est incomplet : '
                                                 || (SELECT string_agg(m->>'message', ' ' ORDER BY o) FROM jsonb_array_elements(v_missing) WITH ORDINALITY AS x(m, o)) END);
        END IF;
    END IF;
    -- Lot Carte B3 (décision du client du 25/11) : l'administration ne valide jamais un événement sans position
    IF e.status = 'EN_ATTENTE' AND v_to = 'VALIDE' AND (e.latitude IS NULL OR e.longitude IS NULL) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'POSITION_REQUIRED',
                                  'message', 'L’événement n’a pas de position sur la carte : l’organisatrice doit la placer avant la validation.');
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
