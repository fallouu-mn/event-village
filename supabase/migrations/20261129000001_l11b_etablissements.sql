-- ============================================================================
-- EVENT VILLAGE — LOT 11b, migration 01 : établissements (photos, envoi en validation, plan de salle, création)
-- ============================================================================
-- Écrans des tables (lot 11b) : un établissement se crée en une seule fois (fiche, photos, horaires, zones, tables),
-- part en validation à sa création comme une salle (lot 10b), et peut avoir un plan de salle facultatif.
--  1. venues.photos (12 au plus ; adresses vérifiées par le serveur : photos réencodées de la route de dépôt, dossier
--     venues/<partenaire>/), venues.submitted_at (date exacte d'envoi en validation), venues.floor_plan_enabled
--     (plan de salle montré au client) ;
--  2. plan de salle : restaurant_tables.plan_x, plan_y (position en % du plan, 0 à 100), plan_shape (RONDE, CARREE,
--     RECTANGLE), plan_rotation (0 à 345 par 15°) ; restaurant_zones.plan_x, plan_y, plan_w, plan_h (rectangle en %) ;
--  3. venues_validation_guard : recopie de 20261123000102_l11a_etablissements.sql:90-125 ; changements : un
--     établissement refusé puis modifié reste refusé jusqu'à son renvoi en validation (venue_submit), comme une salle
--     (20261126000002_l10b_salles.sql:214-241) ; submitted_at posé à la création, jamais écrit par une mise à jour ;
--  4. venue_create(p) : création en une transaction (fiche partenaire VALIDE, compte ACTIF) : fiche, photos, horaires
--     (venue_hours_set), zones et tables ; une photo, une plage d'ouverture et une table au moins ; tout refus annule
--     tout (exception P0001, aucun avis aux administrateurs) ;
--  5. venue_submit(p) : renvoi en validation d'un établissement refusé, par sa propriétaire (fiche VALIDE, compte
--     ACTIF) : nom, adresse et ville, une photo, une plage d'ouverture et une table active exigés ; les
--     administrateurs sont prévenus par trg_venues_submitted (inchangé) ;
--  6. venue_plan_set(p) : plan de salle (positions des tables et des zones, plan montré ou non), par la propriétaire
--     (fiche VALIDE, compte ACTIF), tables et zones de cet établissement seulement ; journal.
-- Toutes réservées au rôle de service (routes serveur). Rejouable : ADD COLUMN IF NOT EXISTS, DROP … IF EXISTS puis
-- ADD, CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Colonnes des établissements
-- ----------------------------------------------------------------------------
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS floor_plan_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.venues.photos IS
    'Lot 11b : photos de l''établissement (12 au plus), déposées par la route de dépôt (réencodées), dossier venues/<partenaire>/.';
COMMENT ON COLUMN public.venues.submitted_at IS
    'Lot 11b : date exacte du dernier envoi en validation (création ou renvoi par venue_submit).';
COMMENT ON COLUMN public.venues.floor_plan_enabled IS
    'Lot 11b : plan de salle montré au client (positions des tables posées par venue_plan_set).';

ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_photos_chk;
ALTER TABLE public.venues ADD CONSTRAINT venues_photos_chk CHECK (cardinality(photos) <= 12);

-- Établissements déjà en attente : date d'envoi = date de création (une fois)
UPDATE public.venues SET submitted_at = created_at
 WHERE submitted_at IS NULL AND validation_status = 'EN_ATTENTE_VALIDATION';

-- ----------------------------------------------------------------------------
-- 2. Plan de salle
-- ----------------------------------------------------------------------------
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS plan_x NUMERIC(5, 2);
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS plan_y NUMERIC(5, 2);
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS plan_shape TEXT NOT NULL DEFAULT 'CARREE';
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS plan_rotation SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE public.restaurant_tables DROP CONSTRAINT IF EXISTS restaurant_tables_plan_chk;
ALTER TABLE public.restaurant_tables ADD CONSTRAINT restaurant_tables_plan_chk CHECK (
    (plan_x IS NULL) = (plan_y IS NULL)
    AND (plan_x IS NULL OR (plan_x BETWEEN 0 AND 100 AND plan_y BETWEEN 0 AND 100))
    AND plan_shape IN ('RONDE', 'CARREE', 'RECTANGLE')
    AND plan_rotation BETWEEN 0 AND 345 AND plan_rotation % 15 = 0);

ALTER TABLE public.restaurant_zones ADD COLUMN IF NOT EXISTS plan_x NUMERIC(5, 2);
ALTER TABLE public.restaurant_zones ADD COLUMN IF NOT EXISTS plan_y NUMERIC(5, 2);
ALTER TABLE public.restaurant_zones ADD COLUMN IF NOT EXISTS plan_w NUMERIC(5, 2);
ALTER TABLE public.restaurant_zones ADD COLUMN IF NOT EXISTS plan_h NUMERIC(5, 2);
ALTER TABLE public.restaurant_zones DROP CONSTRAINT IF EXISTS restaurant_zones_plan_chk;
ALTER TABLE public.restaurant_zones ADD CONSTRAINT restaurant_zones_plan_chk CHECK (
    num_nulls(plan_x, plan_y, plan_w, plan_h) IN (0, 4)
    AND (plan_x IS NULL OR (plan_x BETWEEN 0 AND 100 AND plan_y BETWEEN 0 AND 100
                            AND plan_w BETWEEN 5 AND 100 AND plan_h BETWEEN 5 AND 100
                            AND plan_x + plan_w <= 100 AND plan_y + plan_h <= 100)));

-- ----------------------------------------------------------------------------
-- 3. Un établissement refusé puis modifié reste refusé jusqu'à son renvoi en validation
-- ----------------------------------------------------------------------------
-- Recopie de 20261123000102_l11a_etablissements.sql:90-125 ; changements : plus de retour automatique en attente
-- (renvoi par venue_submit, comme les salles) ; submitted_at posé à la création, gardé à la mise à jour.
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
        NEW.validation_status := CASE WHEN public.fin_setting_bool('tables.validation_required')
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
REVOKE ALL ON FUNCTION public.venues_validation_guard() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Propriétaire qui peut écrire : compte ACTIF et fiche partenaire VALIDE (NULL si oui, sinon le refus)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.venue_owner_refusal(p_actor uuid, p_venue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v record;
BEGIN
    SELECT ve.id, pa.user_id AS owner_id, pa.status::text AS partner_status INTO v
      FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id
     WHERE ve.id = p_venue_id;
    IF p_actor IS NULL OR p_venue_id IS NULL OR NOT FOUND OR v.owner_id IS DISTINCT FROM p_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_FOUND', 'message', 'Cet établissement n’existe pas ou n’est pas le vôtre.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;
    IF v.partner_status = 'SUSPENDU' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED',
            'message', 'Votre compte organisateur est suspendu : vos établissements et leurs réservations ne sont plus modifiables.');
    END IF;
    IF v.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_VALIDATED', 'message', 'Votre compte partenaire doit être validé avant cette action.');
    END IF;
    RETURN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Création en une transaction
-- ----------------------------------------------------------------------------
-- p : actor_id, kind, name, description, address, city, latitude, longitude, slot_minutes, deposit_per_person,
--     confirmation_mode, photos (adresses déjà vérifiées par le serveur), hours [{weekday, opens_at, closes_at}],
--     zones [{key, name}], tables [{number, capacity, min_capacity, zone_key}].
-- Tout refus lève P0001 (message en français simple, code dans HINT) : rien n'est créé, aucun avis n'est envoyé.
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

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'VENUE_CREATED', 'venues', v_id,
            jsonb_build_object('tables', v_count, 'zones', jsonb_array_length(COALESCE(p->'zones', '[]'::jsonb)), 'photos', cardinality(v_photos)));
    RETURN jsonb_build_object('ok', true, 'venue_id', v_id,
                              'validation_status', (SELECT validation_status FROM public.venues WHERE id = v_id));
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Renvoi en validation d'un établissement refusé
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
-- 6. Plan de salle
-- ----------------------------------------------------------------------------
-- p : actor_id, venue_id, enabled (plan montré au client), tables [{id, x, y, shape, rotation}] (x, y null : table
--     retirée du plan), zones [{id, x, y, w, h}] (tous null : zone retirée du plan).
CREATE OR REPLACE FUNCTION public.venue_plan_set(p jsonb)
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
    t          jsonb;
    z          jsonb;
    v_tables   integer := 0;
    v_zones    integer := 0;
    v_placed   integer;
BEGIN
    v_refusal := public.venue_owner_refusal(v_actor, v_venue_id);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;
    IF jsonb_typeof(COALESCE(p->'tables', '[]'::jsonb)) <> 'array' OR jsonb_typeof(COALESCE(p->'zones', '[]'::jsonb)) <> 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PLAN', 'message', 'Plan illisible : rechargez la page et réessayez.');
    END IF;
    PERFORM 1 FROM public.venues WHERE id = v_venue_id FOR UPDATE;
    BEGIN
        FOR t IN SELECT * FROM jsonb_array_elements(COALESCE(p->'tables', '[]'::jsonb)) LOOP
            UPDATE public.restaurant_tables
               SET plan_x = (t->>'x')::numeric, plan_y = (t->>'y')::numeric,
                   plan_shape = COALESCE(NULLIF(t->>'shape', ''), plan_shape),
                   plan_rotation = COALESCE((t->>'rotation')::smallint, plan_rotation), updated_at = now()
             WHERE id = public.try_uuid(t->>'id') AND venue_id = v_venue_id;
            IF NOT FOUND THEN
                RETURN jsonb_build_object('ok', false, 'code', 'TABLE_NOT_FOUND', 'message', 'Une table du plan n’appartient pas à cet établissement.');
            END IF;
            v_tables := v_tables + 1;
        END LOOP;
        FOR z IN SELECT * FROM jsonb_array_elements(COALESCE(p->'zones', '[]'::jsonb)) LOOP
            UPDATE public.restaurant_zones
               SET plan_x = (z->>'x')::numeric, plan_y = (z->>'y')::numeric, plan_w = (z->>'w')::numeric, plan_h = (z->>'h')::numeric,
                   updated_at = now()
             WHERE id = public.try_uuid(z->>'id') AND venue_id = v_venue_id;
            IF NOT FOUND THEN
                RETURN jsonb_build_object('ok', false, 'code', 'ZONE_NOT_FOUND', 'message', 'Une zone du plan n’appartient pas à cet établissement.');
            END IF;
            v_zones := v_zones + 1;
        END LOOP;
    EXCEPTION WHEN check_violation OR invalid_text_representation OR numeric_value_out_of_range THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PLAN', 'message', 'Une position du plan est hors du cadre : replacez la table ou la zone dans le plan.');
    END;
    SELECT count(*) INTO v_placed FROM public.restaurant_tables WHERE venue_id = v_venue_id AND is_active AND plan_x IS NOT NULL;
    IF COALESCE((p->>'enabled')::boolean, FALSE) AND v_placed = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PLAN', 'message', 'Placez au moins une table sur le plan avant de le montrer aux clients.');
    END IF;
    UPDATE public.venues SET floor_plan_enabled = COALESCE((p->>'enabled')::boolean, FALSE), updated_at = now() WHERE id = v_venue_id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'VENUE_PLAN_SET', 'venues', v_venue_id,
            jsonb_build_object('tables', v_tables, 'zones', v_zones, 'enabled', COALESCE((p->>'enabled')::boolean, FALSE)));
    RETURN jsonb_build_object('ok', true, 'venue_id', v_venue_id, 'tables', v_tables, 'zones', v_zones, 'placed', v_placed,
                              'enabled', COALESCE((p->>'enabled')::boolean, FALSE));
END;
$$;

REVOKE ALL ON FUNCTION public.venue_owner_refusal(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.venue_create(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.venue_submit(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.venue_plan_set(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.venue_owner_refusal(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_submit(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_plan_set(jsonb) TO service_role;
