-- ============================================================================
-- EVENT VILLAGE — LOT CARTE B3, migration 01 : lieux tenus par des particuliers (zone approximative)
-- ============================================================================
-- Décision du client (21/11) : sur la carte et les pages publiques, un lieu de particulier n'est montré que par une
-- ZONE d'environ 300 m, jamais par son point exact ; l'adresse exacte n'est donnée qu'après une réservation confirmée,
-- et seulement à cette cliente (et à la partenaire et à l'administration).
-- Étape 0 du lot (docs/carte-b3-rapport.md) : rien ne distinguait un particulier ; l'adresse et la position exactes
-- d'une salle ou d'un établissement validé étaient lisibles par tous (REST, recherche, fiche, lien d'itinéraire).
--  1. halls.host_kind, venues.host_kind : PARTICULIER (défaut : protection par défaut, lieux existants compris) ou
--     PROFESSIONNEL (lieu commercial : point et adresse publics), choisi par la propriétaire ;
--  2. zone_latitude, zone_longitude : centre d'un cercle de 300 m qui CONTIENT le vrai point sans être centré dessus :
--     décalage tiré une fois (80 à 220 m, direction au hasard, tirage pris dans gen_random_uuid) et STOCKÉ ; tiré de
--     nouveau seulement quand la position change ; jamais écrit autrement (déclencheurs trg_halls_zone et
--     trg_venues_zone) : la même zone à chaque lecture, aucune moyenne de plusieurs lectures ne retrouve le point ;
--     zones des lieux existants remplies ici (écriture des seules colonnes de zone : statut, avis et décision gardés
--     par les gardes existantes) ;
--  3. REST : address, latitude, longitude (et la zone) retirées des colonnes lisibles par anon et authenticated, sur
--     halls et venues (aucun écran ne lit ces tables par le navigateur : les pages et les routes passent par le serveur) ;
--  4. hall_search : recopie de 20261126000002_l10b_salles.sql:312-400 ; changements : l'adresse d'un particulier
--     n'est jamais comparée au texte cherché ni rendue ; position rendue = centre de sa zone ; champ « exact » ;
--  5. venue_search : recopie de 20261129000002_l11b_fermetures_disponibilites.sql:470-576 ; mêmes changements.
-- Aucun BEGIN ni COMMIT ; rejouable (ADD COLUMN IF NOT EXISTS, DROP … IF EXISTS puis ADD, CREATE OR REPLACE,
-- remplissage limité aux zones vides, REVOKE puis GRANT).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Particulier ou professionnel
-- ----------------------------------------------------------------------------
ALTER TABLE public.halls ADD COLUMN IF NOT EXISTS host_kind TEXT NOT NULL DEFAULT 'PARTICULIER';
ALTER TABLE public.halls ADD COLUMN IF NOT EXISTS zone_latitude DOUBLE PRECISION;
ALTER TABLE public.halls ADD COLUMN IF NOT EXISTS zone_longitude DOUBLE PRECISION;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS host_kind TEXT NOT NULL DEFAULT 'PARTICULIER';
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS zone_latitude DOUBLE PRECISION;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS zone_longitude DOUBLE PRECISION;

ALTER TABLE public.halls DROP CONSTRAINT IF EXISTS halls_host_kind_chk;
ALTER TABLE public.halls ADD CONSTRAINT halls_host_kind_chk CHECK (host_kind IN ('PARTICULIER', 'PROFESSIONNEL'));
ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_host_kind_chk;
ALTER TABLE public.venues ADD CONSTRAINT venues_host_kind_chk CHECK (host_kind IN ('PARTICULIER', 'PROFESSIONNEL'));

COMMENT ON COLUMN public.halls.host_kind IS
    'Lot Carte B3 : PARTICULIER (défaut : zone de 300 m en public, adresse après réservation confirmée) ou PROFESSIONNEL (point et adresse publics).';
COMMENT ON COLUMN public.venues.host_kind IS
    'Lot Carte B3 : PARTICULIER (défaut : zone de 300 m en public, adresse après réservation confirmée) ou PROFESSIONNEL (point et adresse publics).';
COMMENT ON COLUMN public.halls.zone_latitude IS
    'Lot Carte B3 : centre de la zone publique (cercle de 300 m contenant le vrai point, décalage de 80 à 220 m tiré une fois) ; écrit par trg_halls_zone seulement.';
COMMENT ON COLUMN public.venues.zone_latitude IS
    'Lot Carte B3 : centre de la zone publique (cercle de 300 m contenant le vrai point, décalage de 80 à 220 m tiré une fois) ; écrit par trg_venues_zone seulement.';

-- ----------------------------------------------------------------------------
-- 2. Zone : décalage tiré une fois, stocké, jamais écrit autrement
-- ----------------------------------------------------------------------------
-- Centre d'une zone pour un point : décalage de 80 à 220 m dans une direction au hasard (le cercle de 300 m contient
-- donc toujours le point, à 80 m du bord au moins) ; arrondi à 5 décimales (environ 1 m).
CREATE OR REPLACE FUNCTION public.place_zone_center(p_lat double precision, p_lng double precision)
RETURNS double precision[]
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
    -- Tirage pris dans un identifiant aléatoire (gen_random_uuid, source sûre) : 8 chiffres avant la version, 8 après
    -- le variant
    v_hex  text := replace(gen_random_uuid()::text, '-', '');
    v_r1   double precision;
    v_r2   double precision;
    v_dist double precision;
    v_ang  double precision;
BEGIN
    IF p_lat IS NULL OR p_lng IS NULL THEN
        RETURN NULL;
    END IF;
    v_r1 := ('x' || substr(v_hex, 1, 8))::bit(32)::bigint / 4294967296.0;
    v_r2 := ('x' || substr(v_hex, 21, 8))::bit(32)::bigint / 4294967296.0;
    v_dist := 80 + v_r1 * 140;
    v_ang := v_r2 * 2 * pi();
    RETURN ARRAY[
        round((p_lat + v_dist * cos(v_ang) / 111320.0)::numeric, 5)::double precision,
        round((p_lng + v_dist * sin(v_ang) / (111320.0 * cos(radians(p_lat))))::numeric, 5)::double precision];
END;
$$;
REVOKE ALL ON FUNCTION public.place_zone_center(double precision, double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_zone_center(double precision, double precision) TO service_role;

-- Déclencheur commun aux salles et aux établissements : zone retirée sans position ; gardée si la position ne change
-- pas (toute autre écriture des colonnes de zone est annulée) ; tirée de nouveau si la position change.
CREATE OR REPLACE FUNCTION public.place_zone_fill()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
    v_zone double precision[];
BEGIN
    IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
        NEW.zone_latitude := NULL;
        NEW.zone_longitude := NULL;
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.latitude IS NOT DISTINCT FROM OLD.latitude AND NEW.longitude IS NOT DISTINCT FROM OLD.longitude
       AND OLD.zone_latitude IS NOT NULL AND OLD.zone_longitude IS NOT NULL THEN
        NEW.zone_latitude := OLD.zone_latitude;
        NEW.zone_longitude := OLD.zone_longitude;
        RETURN NEW;
    END IF;
    v_zone := public.place_zone_center(NEW.latitude, NEW.longitude);
    NEW.zone_latitude := v_zone[1];
    NEW.zone_longitude := v_zone[2];
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.place_zone_fill() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_halls_zone ON public.halls;
CREATE TRIGGER trg_halls_zone
    BEFORE INSERT OR UPDATE ON public.halls
    FOR EACH ROW EXECUTE FUNCTION public.place_zone_fill();
DROP TRIGGER IF EXISTS trg_venues_zone ON public.venues;
CREATE TRIGGER trg_venues_zone
    BEFORE INSERT OR UPDATE ON public.venues
    FOR EACH ROW EXECUTE FUNCTION public.place_zone_fill();

-- Lieux existants : zones remplies (le déclencheur tire chaque décalage ; rien d'autre n'est écrit)
UPDATE public.halls SET zone_latitude = NULL
 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND (zone_latitude IS NULL OR zone_longitude IS NULL);
UPDATE public.venues SET zone_latitude = NULL
 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND (zone_latitude IS NULL OR zone_longitude IS NULL);

ALTER TABLE public.halls DROP CONSTRAINT IF EXISTS halls_zone_chk;
ALTER TABLE public.halls ADD CONSTRAINT halls_zone_chk CHECK (
    (zone_latitude IS NULL) = (latitude IS NULL) AND (zone_longitude IS NULL) = (longitude IS NULL));
ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_zone_chk;
ALTER TABLE public.venues ADD CONSTRAINT venues_zone_chk CHECK (
    (zone_latitude IS NULL) = (latitude IS NULL) AND (zone_longitude IS NULL) = (longitude IS NULL));

-- ----------------------------------------------------------------------------
-- 3. REST : ni adresse ni position lisibles (le serveur choisit ce qui est public)
-- ----------------------------------------------------------------------------
REVOKE SELECT ON public.halls FROM anon, authenticated;
GRANT SELECT (id, partner_id, name, description, capacity, price_per_day, price_per_hour, deposit_percentage, city,
              amenities, images, is_active, created_at, updated_at, validation_status, validation_reason, validated_by,
              validated_at, deposit_mode, deposit_value, cancellation_policy, submitted_at, host_kind)
    ON public.halls TO anon, authenticated;
GRANT ALL ON public.halls TO service_role;

-- Reprise de 20261129000009_l11b_cv_lectures_etablissements.sql:54-58 sans address, latitude, longitude
REVOKE SELECT ON public.venues FROM anon, authenticated;
GRANT SELECT (id, partner_id, kind, name, description, city, photos, slot_minutes, deposit_per_person, confirmation_mode,
              floor_plan_enabled, is_active, validation_status, host_kind)
    ON public.venues TO anon, authenticated;
GRANT ALL ON public.venues TO service_role;

-- ----------------------------------------------------------------------------
-- 4. Recherche des salles : adresse d'un particulier jamais comparée ni rendue, zone à la place du point
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hall_search(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_q      text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'q', ''), '[[:cntrl:]]', ' ', 'g')), 80), '');
    v_city   text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'city', ''), '[[:cntrl:]]', ' ', 'g')), 80), '');
    v_date   date;
    v_days   integer;
    v_cap    integer;
    v_price  numeric;
    v_limit  integer;
    v_offset integer;
    v_slot   tsrange;
    v_like   text;
    v_total  integer;
    v_rows   jsonb;
    v_cities jsonb;
    v_sort   text := CASE WHEN p->>'sort' = 'price' THEN 'price' ELSE 'recent' END;
BEGIN
    BEGIN
        v_date := NULLIF(p->>'date', '')::date;
        v_days := COALESCE(NULLIF(p->>'days', '')::int, 1);
        v_cap := NULLIF(p->>'capacity', '')::int;
        v_price := NULLIF(p->>'price_max', '')::numeric;
        v_limit := COALESCE(NULLIF(p->>'limit', '')::int, 24);
        v_offset := COALESCE(NULLIF(p->>'offset', '')::int, 0);
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Un des filtres n’est pas valable : vérifiez la date, le nombre d’invités et le prix.');
    END;
    IF v_days < 1 OR v_days > 30 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'La durée va de 1 à 30 jours.');
    END IF;
    IF v_cap IS NOT NULL AND (v_cap < 1 OR v_cap > 100000) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Indiquez un nombre d’invités entre 1 et 100 000.');
    END IF;
    IF v_price IS NOT NULL AND (v_price < 1 OR v_price > 1000000000) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Indiquez un prix maximum d’au moins 1 F CFA.');
    END IF;
    v_limit := LEAST(GREATEST(v_limit, 1), 48);
    v_offset := LEAST(GREATEST(v_offset, 0), 10000);
    IF v_date IS NOT NULL THEN
        IF v_date < public.hall_dakar_now()::date THEN
            RETURN jsonb_build_object('ok', false, 'code', 'DATE_PASSED', 'message', 'Choisissez une date à venir.');
        END IF;
        IF v_date > public.hall_dakar_now()::date + 548 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'DATE_TOO_FAR', 'message', 'La date doit être dans les 18 mois à venir.');
        END IF;
        v_slot := public.hall_slot(v_date, v_date + (v_days - 1), NULL, NULL);
    END IF;
    v_like := CASE WHEN v_q IS NULL THEN NULL
                   ELSE '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%' END;

    WITH visible AS (
        SELECT hl.id, hl.name, hl.city, hl.address, hl.capacity, hl.price_per_day, hl.price_per_hour, hl.images,
               hl.latitude, hl.longitude, hl.amenities, hl.created_at,
               hl.host_kind, hl.zone_latitude, hl.zone_longitude,
               COALESCE(NULLIF(btrim(pa.commercial_name), ''), pa.company_name) AS partner_name
          FROM public.halls hl JOIN public.partners pa ON pa.id = hl.partner_id
         WHERE hl.is_active AND hl.validation_status = 'VALIDEE' AND pa.status::text = 'VALIDE'
           AND hl.price_per_day IS NOT NULL AND hl.price_per_day >= 1
    ), matching AS (
        SELECT v.* FROM visible v
         -- Lot Carte B3 : l'adresse d'un particulier n'est jamais comparée au texte cherché (sinon on la retrouve par essais)
         WHERE (v_like IS NULL OR v.name ILIKE v_like OR v.city ILIKE v_like
                OR (v.host_kind = 'PROFESSIONNEL' AND v.address ILIKE v_like) OR v.partner_name ILIKE v_like)
           AND (v_city IS NULL OR lower(btrim(v.city)) = lower(v_city))
           AND (v_cap IS NULL OR v.capacity >= v_cap)
           AND (v_price IS NULL OR v.price_per_day <= v_price)
           AND (v_slot IS NULL OR NOT EXISTS (
                   SELECT 1 FROM public.hall_reservations r
                    WHERE r.hall_id = v.id AND r.status IN ('EN_ATTENTE', 'CONFIRMEE') AND r.slot && v_slot))
    )
    SELECT (SELECT count(*) FROM matching),
           COALESCE((SELECT jsonb_agg(jsonb_build_object(
                        -- Lot Carte B3 : particulier = ni adresse ni point exact, centre de sa zone (fixe, stocké)
                        'id', m.id, 'name', m.name, 'city', m.city,
                        'address', CASE WHEN m.host_kind = 'PROFESSIONNEL' THEN m.address END, 'capacity', m.capacity,
                        'price_per_day', m.price_per_day, 'price_per_hour', m.price_per_hour,
                        'photo', m.images[1], 'photo_count', COALESCE(cardinality(m.images), 0),
                        'latitude', CASE WHEN m.host_kind = 'PROFESSIONNEL' THEN m.latitude ELSE m.zone_latitude END,
                        'longitude', CASE WHEN m.host_kind = 'PROFESSIONNEL' THEN m.longitude ELSE m.zone_longitude END,
                        'exact', m.host_kind = 'PROFESSIONNEL', 'partner_name', m.partner_name,
                        'amenities', COALESCE(m.amenities, '[]'::jsonb)) ORDER BY m.rank)
                      FROM (SELECT x.*, row_number() OVER (ORDER BY CASE WHEN v_sort = 'price' THEN x.price_per_day END, x.created_at DESC, x.id) AS rank
                              FROM matching x ORDER BY rank LIMIT v_limit OFFSET v_offset) m), '[]'::jsonb),
           COALESCE((SELECT jsonb_agg(c ORDER BY c) FROM (SELECT DISTINCT btrim(city) AS c FROM visible
                                                          WHERE NULLIF(btrim(city), '') IS NOT NULL) x), '[]'::jsonb)
      INTO v_total, v_rows, v_cities;
    RETURN jsonb_build_object('ok', true, 'total', v_total, 'halls', v_rows, 'cities', v_cities,
                              'limit', v_limit, 'offset', v_offset, 'sort', v_sort);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Recherche des établissements : mêmes règles
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.venue_search(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_q      text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'q', ''), '[[:cntrl:]]', ' ', 'g')), 80), '');
    v_city   text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'city', ''), '[[:cntrl:]]', ' ', 'g')), 80), '');
    v_kind   text := NULLIF(upper(COALESCE(p->>'kind', '')), '');
    v_date   date;
    v_time   time;
    v_guests integer;
    v_avail  boolean := COALESCE((p->>'available')::boolean, FALSE);
    v_limit  integer;
    v_offset integer;
    v_like   text;
    v_now    timestamp := public.hall_dakar_now();
    v_times  time[];
    v_total  integer;
    v_rows   jsonb;
    v_cities jsonb;
BEGIN
    BEGIN
        v_date := NULLIF(p->>'date', '')::date;
        v_time := NULLIF(p->>'time', '')::time;
        v_guests := COALESCE(NULLIF(p->>'guests', '')::int, 2);
        v_limit := COALESCE(NULLIF(p->>'limit', '')::int, 24);
        v_offset := COALESCE(NULLIF(p->>'offset', '')::int, 0);
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Un des filtres n’est pas valable : vérifiez la date, l’heure et le nombre de personnes.');
    END;
    IF v_guests < 1 OR v_guests > 50 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Indiquez un nombre de personnes entre 1 et 50.');
    END IF;
    IF v_kind IS NOT NULL AND v_kind NOT IN ('RESTAURANT', 'BAR', 'ESPACE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Choisissez restaurant, bar ou espace.');
    END IF;
    IF v_time IS NOT NULL AND (EXTRACT(MINUTE FROM v_time)::int % 15 <> 0 OR EXTRACT(SECOND FROM v_time) <> 0) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Choisissez une heure au quart d’heure près.');
    END IF;
    IF v_date IS NOT NULL THEN
        IF v_date < v_now::date THEN
            RETURN jsonb_build_object('ok', false, 'code', 'DATE_PASSED', 'message', 'Choisissez une date à venir.');
        END IF;
        IF v_date > v_now::date + 90 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'DATE_TOO_FAR', 'message', 'La date doit être dans les 90 jours à venir.');
        END IF;
        v_times := CASE WHEN v_time IS NULL
                        THEN ARRAY(SELECT gs::time FROM generate_series(timestamp '2001-01-01 12:00', timestamp '2001-01-01 22:00', interval '30 minutes') gs)
                        ELSE ARRAY(SELECT (timestamp '2001-01-01' + v_time + d * interval '30 minutes')::time
                                     FROM generate_series(-2, 2) d
                                    WHERE timestamp '2001-01-01' + v_time + d * interval '30 minutes' >= timestamp '2001-01-01'
                                      AND timestamp '2001-01-01' + v_time + d * interval '30 minutes' < timestamp '2001-01-02') END;
    END IF;
    v_limit := LEAST(GREATEST(v_limit, 1), 48);
    v_offset := LEAST(GREATEST(v_offset, 0), 10000);
    v_like := CASE WHEN v_q IS NULL THEN NULL
                   ELSE '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%' END;

    WITH visible AS (
        SELECT ve.id, ve.name, ve.kind, ve.city, ve.address, ve.photos, ve.latitude, ve.longitude, ve.deposit_per_person,
               ve.confirmation_mode, ve.created_at, ve.floor_plan_enabled,
               ve.host_kind, ve.zone_latitude, ve.zone_longitude,
               COALESCE(ve.slot_minutes, public.fin_setting_num('tables.slot_minutes')::int) AS slot_min,
               COALESCE(NULLIF(btrim(pa.commercial_name), ''), pa.company_name) AS partner_name
          FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id
         WHERE ve.is_active AND ve.validation_status = 'VALIDEE' AND pa.status::text = 'VALIDE'
    ), matching AS (
        SELECT vi.* FROM visible vi
         -- Lot Carte B3 : l'adresse d'un particulier n'est jamais comparée au texte cherché (sinon on la retrouve par essais)
         WHERE (v_like IS NULL OR vi.name ILIKE v_like OR vi.city ILIKE v_like
                OR (vi.host_kind = 'PROFESSIONNEL' AND vi.address ILIKE v_like) OR vi.partner_name ILIKE v_like)
           AND (v_city IS NULL OR lower(btrim(vi.city)) = lower(v_city))
           AND (v_kind IS NULL OR vi.kind = v_kind)
           AND EXISTS (SELECT 1 FROM public.restaurant_tables c WHERE c.venue_id = vi.id AND c.is_active
                          AND v_guests BETWEEN c.min_capacity AND c.capacity)
    ), slotted AS (
        SELECT m.*,
               CASE WHEN v_date IS NULL THEN '[]'::jsonb ELSE COALESCE((
                   SELECT jsonb_agg(jsonb_build_object('time', to_char(t, 'HH24:MI'),
                                                       'state', CASE WHEN v_date + t <= v_now THEN 'PASSE'
                                                                     WHEN public.table_free_count(m.id, tsrange(v_date + t, v_date + t + m.slot_min * interval '1 minute', '[)'), v_guests, NULL) > 0
                                                                     THEN 'LIBRE' ELSE 'COMPLET' END) ORDER BY t)
                     FROM unnest(v_times) AS t
                    WHERE public.venue_open_covers(m.id, tsrange(v_date + t, v_date + t + m.slot_min * interval '1 minute', '[)'))
                      AND NOT public.venue_closed_during(m.id, tsrange(v_date + t, v_date + t + m.slot_min * interval '1 minute', '[)'))), '[]'::jsonb) END AS slots
          FROM matching m
    ), filtered AS (
        SELECT s.*, EXISTS (SELECT 1 FROM jsonb_array_elements(s.slots) e WHERE e->>'state' = 'LIBRE') AS has_free
          FROM slotted s
         WHERE NOT v_avail OR v_date IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(s.slots) e WHERE e->>'state' = 'LIBRE')
    )
    SELECT (SELECT count(*) FROM filtered),
           COALESCE((SELECT jsonb_agg(jsonb_build_object(
                        -- Lot Carte B3 : particulier = ni adresse ni point exact, centre de sa zone (fixe, stocké)
                        'id', f.id, 'name', f.name, 'kind', f.kind, 'city', f.city,
                        'address', CASE WHEN f.host_kind = 'PROFESSIONNEL' THEN f.address END,
                        'photo', f.photos[1], 'photo_count', cardinality(f.photos),
                        'latitude', CASE WHEN f.host_kind = 'PROFESSIONNEL' THEN f.latitude ELSE f.zone_latitude END,
                        'longitude', CASE WHEN f.host_kind = 'PROFESSIONNEL' THEN f.longitude ELSE f.zone_longitude END,
                        'exact', f.host_kind = 'PROFESSIONNEL',
                        'deposit_per_person', f.deposit_per_person, 'confirmation_mode', f.confirmation_mode,
                        'slot_minutes', f.slot_min, 'partner_name', f.partner_name, 'floor_plan', f.floor_plan_enabled,
                        'slots', f.slots, 'has_free', f.has_free) ORDER BY f.rank)
                      FROM (SELECT x.*, row_number() OVER (ORDER BY x.has_free DESC, x.created_at DESC, x.id) AS rank
                              FROM filtered x ORDER BY rank LIMIT v_limit OFFSET v_offset) f), '[]'::jsonb),
           COALESCE((SELECT jsonb_agg(c ORDER BY c) FROM (SELECT DISTINCT btrim(city) AS c FROM visible
                                                          WHERE NULLIF(btrim(city), '') IS NOT NULL) y), '[]'::jsonb)
      INTO v_total, v_rows, v_cities;
    RETURN jsonb_build_object('ok', true, 'total', v_total, 'venues', v_rows, 'cities', v_cities, 'limit', v_limit, 'offset', v_offset,
                              'date', v_date, 'time', to_char(v_time, 'HH24:MI'), 'guests', v_guests);
END;
$$;

REVOKE ALL ON FUNCTION public.hall_search(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.venue_search(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hall_search(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_search(jsonb) TO service_role;
