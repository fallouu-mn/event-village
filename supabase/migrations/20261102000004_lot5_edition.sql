-- ============================================================================
-- EVENT VILLAGE — LOT 5 : édition, validation serveur, services associés (5.5, 5.6, 5.9)
-- ============================================================================
-- Contrat : section F de scratchpad/lot5-design.md (F1 à F5).
--  - CHECK en base : prix d'une catégorie de billets entier (price = trunc(price)).
--  - Compartiment public-images créé par migration (plus de création à l'exécution par la route
--    de téléversement) ; affiches sous events/<partner_id>/.
--  - Reprise des données : programme typé { id, time HH:mm, kind, title, participant?, description?,
--    day? } (artistOrSpeaker → participant, heure invalide → ligne retirée, tri par jour puis heure,
--    50 lignes au plus) ; infos pratiques réduites aux cinq clés du formulaire (access → accessNotes,
--    contact → contactPhone) ; services associés forcés à la seule billetterie par défaut.
--  - RPC (service_role seul, `(p jsonb) RETURNS jsonb`, refus `{ ok:false, code, message, field? }`) :
--      event_create            événement BROUILLON et ses catégories dans une seule transaction ;
--      event_update            édition sous verrou, version attendue, règles par statut, champs
--                              libres / notifiés / verrouillés après ventes, file des notifications,
--                              recalcul de available_at des crédits VENTE (jamais avancé) ;
--      ticket_category_create, ticket_category_update, ticket_category_delete (F4) ;
--      event_change_notifications_claim / _mark : file des SMS de changement, vidée par le cron
--                              /api/cron/event-change-notifications.
--  - Table event_change_notifications : une ligne par porteur et par version de changement (les SMS
--    encore en attente d'un même porteur sont regroupés), service_role seul.
-- Ordre de verrouillage : événement, catégories (par identifiant), comme les migrations 01 à 03.
-- ============================================================================

-- ── Entiers : prix d'une catégorie de billets (F1) ──────────────────────────
ALTER TABLE public.ticket_categories DROP CONSTRAINT IF EXISTS chk_ticket_categories_price_integer;
ALTER TABLE public.ticket_categories
    ADD CONSTRAINT chk_ticket_categories_price_integer CHECK (price = trunc(price)) NOT VALID;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.ticket_categories WHERE price <> trunc(price)) THEN
        ALTER TABLE public.ticket_categories VALIDATE CONSTRAINT chk_ticket_categories_price_integer;
    ELSE
        RAISE NOTICE 'ticket_categories : prix décimaux existants, contrainte chk_ticket_categories_price_integer laissée NOT VALID (lignes nouvelles et modifiées contrôlées)';
    END IF;
END;
$$;

-- ── Compartiment des affiches (F1) ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('public-images', 'public-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- ── Services associés : seule la billetterie (F5) ───────────────────────────
ALTER TABLE public.events
    ALTER COLUMN services SET DEFAULT '{"ticketing": true, "tableBooking": false, "communication": false}'::jsonb;

-- ── Reprise du programme et des infos pratiques (F1) ────────────────────────
CREATE OR REPLACE FUNCTION public.lot5_program_normalize(p_program jsonb, p_start date)
RETURNS jsonb
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
    SELECT COALESCE(jsonb_agg(k.item ORDER BY k.sort_day, k.sort_time, k.ord), '[]'::jsonb)
      FROM (
        SELECT l.ord, COALESCE(l.day, p_start) AS sort_day, l.t AS sort_time,
               jsonb_strip_nulls(jsonb_build_object(
                   'id', l.id, 'time', to_char(l.t, 'HH24:MI'), 'kind', l.kind, 'title', l.title,
                   'participant', l.participant, 'description', l.description, 'day', to_char(l.day, 'YYYY-MM-DD'))) AS item
          FROM (
            SELECT a.o AS ord,
                   CASE WHEN a.e->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                        THEN lower(a.e->>'id') ELSE gen_random_uuid()::text END AS id,
                   CASE WHEN btrim(COALESCE(a.e->>'time', '')) ~ '^([01]?[0-9]|2[0-3])[:hH][0-5][0-9](:[0-5][0-9])?$'
                        THEN make_time(split_part(regexp_replace(btrim(a.e->>'time'), '[hH]', ':'), ':', 1)::int,
                                       split_part(regexp_replace(btrim(a.e->>'time'), '[hH]', ':'), ':', 2)::int, 0) END AS t,
                   CASE WHEN a.e->>'kind' IN ('ARTISTE', 'INTERVENANT', 'ACTIVITE') THEN a.e->>'kind' ELSE 'ACTIVITE' END AS kind,
                   NULLIF(left(btrim(COALESCE(a.e->>'title', '')), 120), '') AS title,
                   NULLIF(left(btrim(COALESCE(a.e->>'participant', a.e->>'artistOrSpeaker', '')), 120), '') AS participant,
                   NULLIF(left(btrim(COALESCE(a.e->>'description', '')), 500), '') AS description,
                   CASE WHEN a.e->>'day' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN (a.e->>'day')::date END AS day
              FROM jsonb_array_elements(p_program) WITH ORDINALITY AS a(e, o)
             WHERE jsonb_typeof(a.e) = 'object'
          ) l
         WHERE l.t IS NOT NULL AND l.title IS NOT NULL
         ORDER BY COALESCE(l.day, p_start), l.t, l.ord
         LIMIT 50
      ) k
$$;

CREATE OR REPLACE FUNCTION public.lot5_practical_normalize(p_info jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT COALESCE(jsonb_object_agg(kv.k, to_jsonb(left(btrim(kv.v), 300))), '{}'::jsonb)
      FROM (VALUES
            ('address', p_info->>'address'),
            ('accessNotes', COALESCE(p_info->>'accessNotes', p_info->>'access')),
            ('parking', p_info->>'parking'),
            ('contactPhone', COALESCE(p_info->>'contactPhone', p_info->>'contact')),
            ('rules', p_info->>'rules')) AS kv(k, v)
     WHERE NULLIF(btrim(COALESCE(kv.v, '')), '') IS NOT NULL
$$;

UPDATE public.events
   SET program = public.lot5_program_normalize(program, start_date)
 WHERE program IS NOT NULL AND jsonb_typeof(program) = 'array';
UPDATE public.events
   SET program = '[]'::jsonb
 WHERE program IS NOT NULL AND jsonb_typeof(program) <> 'array';
UPDATE public.events
   SET practical_info = public.lot5_practical_normalize(practical_info)
 WHERE practical_info IS NOT NULL AND jsonb_typeof(practical_info) = 'object'
   AND practical_info IS DISTINCT FROM public.lot5_practical_normalize(practical_info);
UPDATE public.events
   SET practical_info = '{}'::jsonb
 WHERE practical_info IS NOT NULL AND jsonb_typeof(practical_info) <> 'object';

DROP FUNCTION public.lot5_program_normalize(jsonb, date);
DROP FUNCTION public.lot5_practical_normalize(jsonb);

-- ── File des notifications de changement (F3) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_change_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    version INTEGER NOT NULL CHECK (version > 0),
    changed_fields TEXT[] NOT NULL,
    sms_required BOOLEAN NOT NULL,
    sms_status TEXT NOT NULL CHECK (sms_status IN ('NOT_REQUIRED', 'PENDING', 'SENDING', 'SENT', 'REFUSED', 'FAILED', 'CANCELLED', 'SUPERSEDED')),
    sms_code TEXT,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT event_change_notifications_sms_coherent CHECK (sms_required OR sms_status = 'NOT_REQUIRED')
);
-- Un seul SMS en attente par porteur et par événement : les changements rapprochés sont regroupés.
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_change_notifications_pending
    ON public.event_change_notifications (event_id, user_id) WHERE sms_status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_event_change_notifications_due
    ON public.event_change_notifications (created_at) WHERE sms_status IN ('PENDING', 'SENDING');
CREATE INDEX IF NOT EXISTS idx_event_change_notifications_event
    ON public.event_change_notifications (event_id, version);
ALTER TABLE public.event_change_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.event_change_notifications FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.event_change_notifications TO service_role;
COMMENT ON TABLE public.event_change_notifications IS
    'Lot 5 (F3) : porteurs prévenus d''un changement de titre, de dates, d''heures ou de lieu. Notification dans l''application écrite tout de suite par event_update ; SMS envoyé par le cron event-change-notifications (part non OTP du plafond global). Service_role seul.';

-- ── Outils ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.event_edit_refusal(p_code text, p_message text, p_field text DEFAULT NULL, p_extra jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object('ok', false, 'code', p_code, 'message', p_message)
           || CASE WHEN p_field IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('field', p_field) END
           || COALESCE(p_extra, '{}'::jsonb)
$$;

-- Fin d'un événement à partir de ses colonnes (même règle que event_end_at, migration 03)
CREATE OR REPLACE FUNCTION public.event_end_from(p_start_date date, p_end_date date, p_end_time time)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT ((COALESCE(p_end_date, p_start_date) + COALESCE(CASE WHEN p_end_date IS NOT NULL THEN p_end_time END, time '23:59'))
            AT TIME ZONE 'Africa/Dakar')
$$;

-- Affiche : chemin public-images/events/<partner_id>/<fichier> (l'hôte du projet est contrôlé par le schéma partagé)
CREATE OR REPLACE FUNCTION public.event_poster_path_ok(p_url text, p_partner uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p_url IS NULL OR (
        position('..' in p_url) = 0
        AND p_url ~ ('^https?://[^?#]*/storage/v1/object/public/public-images/events/' || p_partner::text
                     || '/[A-Za-z0-9_-][A-Za-z0-9._-]{0,199}$'))
$$;

-- « Il y a des ventes » (F4) : un billet, quel que soit son statut, ou une réservation ACTIVE
CREATE OR REPLACE FUNCTION public.ticket_category_has_sales(p_category uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.tickets t WHERE t.category_id = p_category)
        OR EXISTS (SELECT 1 FROM public.stock_reservations r WHERE r.category_id = p_category AND r.status = 'ACTIVE')
$$;

CREATE OR REPLACE FUNCTION public.event_has_sales(p_event uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.tickets t WHERE t.event_id = p_event)
        OR EXISTS (SELECT 1 FROM public.stock_reservations r JOIN public.ticket_categories c ON c.id = r.category_id
                    WHERE c.event_id = p_event AND r.status = 'ACTIVE')
$$;

-- Catégorie de billets complète (création) : valeurs normalisées `{ ok:true, … }` ou refus, champ préfixé
CREATE OR REPLACE FUNCTION public.ticket_category_normalize(p_cat jsonb, p_event_end timestamptz, p_prefix text)
RETURNS jsonb
LANGUAGE plpgsql
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
    v_visible boolean;
    v_active boolean;
BEGIN
    IF p_cat IS NULL OR jsonb_typeof(p_cat) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Catégorie de billets illisible.', NULLIF(rtrim(v_prefix, '.'), ''));
    END IF;
    SELECT k INTO v_key FROM jsonb_object_keys(p_cat) AS k
     WHERE k <> ALL (ARRAY['name', 'description', 'price', 'total_quantity', 'max_per_order', 'sale_start', 'sale_end', 'is_visible', 'is_active'])
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
        v_visible := COALESCE((p_cat->>'is_visible')::boolean, true);
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
    RETURN jsonb_build_object('ok', true, 'name', v_name, 'description', v_desc, 'price', v_price, 'total_quantity', v_total,
                              'max_per_order', v_max, 'sale_start', v_start, 'sale_end', v_end,
                              'is_visible', v_visible, 'is_active', v_active);
END;
$$;

-- ── F2 : création d'un événement et de ses catégories ───────────────────────
-- p : { actor_id, event: { title, category, description?, start_date, start_time, end_date?, end_time?,
--       location, city, latitude?, longitude?, image_url?, capacity?, program?, practical_info? },
--       ticket_categories?: [ { name, description?, price, total_quantity, max_per_order?, sale_start?,
--       sale_end?, is_visible?, is_active? } ] }
-- Contrôles de forme faits en amont par lib/validations/event.ts ; ceux-ci les répètent en défense.
CREATE OR REPLACE FUNCTION public.event_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
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
    v_end := public.event_end_from(v_start_date, v_end_date, v_end_time);
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
                                          sale_start, sale_end, is_visible, is_active)
    SELECT v_event_id, c->>'name', c->>'description', (c->>'price')::numeric, (c->>'total_quantity')::integer, 0,
           (c->>'max_per_order')::integer, (c->>'sale_start')::timestamptz, (c->>'sale_end')::timestamptz,
           (c->>'is_visible')::boolean, (c->>'is_active')::boolean
      FROM jsonb_array_elements(v_normalized) AS c;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'EVENT_CREATED', 'EVENT', v_event_id,
            jsonb_build_object('categories', jsonb_array_length(v_normalized)));

    SELECT to_jsonb(ev) INTO v_row FROM public.events ev WHERE ev.id = v_event_id;
    RETURN jsonb_build_object('ok', true, 'event_id', v_event_id, 'event', v_row);
END;
$$;

-- ── F3 : édition d'un événement ─────────────────────────────────────────────
-- p : { event_id, actor_id, patch: { <colonnes> }, expected_updated_at }
-- → { ok, event, notified_holders, sms_queued, changed_fields }
CREATE OR REPLACE FUNCTION public.event_update(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
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
    v_content text;
    v_row jsonb;
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

    SELECT * INTO e FROM public.events WHERE id = v_event FOR UPDATE;
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

    UPDATE public.events
       SET title = n_title, category = n_category, description = n_description,
           start_date = n_start_date, start_time = n_start_time, end_date = n_end_date, end_time = n_end_time,
           location = n_location, city = n_city, latitude = n_lat, longitude = n_lng, image_url = n_image,
           capacity = n_capacity, program = n_program, practical_info = n_practical, updated_at = now()
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
        SELECT COALESCE(max(n.version), 0) + 1 INTO v_version FROM public.event_change_notifications n WHERE n.event_id = v_event;
        v_content := format('L''organisateur a modifié %s de « %s ». Nouvelles informations : le %s à %s, %s%s. Vos billets restent valables.',
                            array_to_string(v_labels, ', '), n_title, to_char(n_start_date, 'DD/MM/YYYY'), to_char(n_start_time, 'HH24:MI'),
                            n_location, COALESCE(', ' || NULLIF(n_city, ''), ''));
        INSERT INTO public.notifications (user_id, type, title, content, channel, status, sent_at, metadata)
        SELECT h, 'EVENT_CHANGE', 'Événement modifié', v_content, 'PUSH'::notification_channel_enum, 'SENT'::notification_status_enum, now(),
               jsonb_build_object('event_id', v_event, 'eventId', v_event, 'version', v_version,
                                  'changed_fields', to_jsonb(v_changed), 'actionUrl', '/events/' || v_event::text)
          FROM unnest(v_holders) AS h;
        IF v_sms THEN
            INSERT INTO public.event_change_notifications AS n (event_id, user_id, version, changed_fields, sms_required, sms_status)
            SELECT v_event, h, v_version, v_changed, true, 'PENDING' FROM unnest(v_holders) AS h
            ON CONFLICT (event_id, user_id) WHERE sms_status = 'PENDING' DO UPDATE
               SET version = EXCLUDED.version,
                   changed_fields = ARRAY(SELECT DISTINCT f FROM unnest(n.changed_fields || EXCLUDED.changed_fields) AS f ORDER BY f),
                   updated_at = now();
            v_sms_queued := v_notified;
        ELSE
            INSERT INTO public.event_change_notifications (event_id, user_id, version, changed_fields, sms_required, sms_status)
            SELECT v_event, h, v_version, v_changed, false, 'NOT_REQUIRED' FROM unnest(v_holders) AS h;
        END IF;
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

-- ── F4 : catégories de billets ──────────────────────────────────────────────
-- Événement verrouillé et contrôlé pour une écriture de catégorie : `{ ok:true }` ou refus
CREATE OR REPLACE FUNCTION public.ticket_category_guard(p_event uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
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
    SELECT status::text INTO v_status FROM public.events WHERE id = p_event FOR UPDATE;
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

-- p : { event_id, actor_id, category: { name, description?, price, total_quantity, max_per_order?, sale_start?,
--       sale_end?, is_visible?, is_active? } } → { ok, category }
CREATE OR REPLACE FUNCTION public.ticket_category_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
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
    v_norm := public.ticket_category_normalize(p->'category', public.event_end_at(v_event), '');
    IF (v_norm->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_norm;
    END IF;
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
                format('La somme des quotas des catégories actives (%s) dépasserait la jauge de l''événement (%s).',
                       v_sum + (v_norm->>'total_quantity')::int, v_capacity), 'total_quantity');
        END IF;
    END IF;

    INSERT INTO public.ticket_categories (event_id, name, description, price, total_quantity, sold_quantity, max_per_order,
                                          sale_start, sale_end, is_visible, is_active)
    VALUES (v_event, v_norm->>'name', v_norm->>'description', (v_norm->>'price')::numeric, (v_norm->>'total_quantity')::int, 0,
            (v_norm->>'max_per_order')::int, (v_norm->>'sale_start')::timestamptz, (v_norm->>'sale_end')::timestamptz,
            (v_norm->>'is_visible')::boolean, (v_norm->>'is_active')::boolean)
    RETURNING id INTO v_id;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'CATEGORY_CREATED', 'TICKET_CATEGORY', v_id,
            jsonb_build_object('event_id', v_event, 'name', v_norm->>'name', 'price', v_norm->'price', 'total_quantity', v_norm->'total_quantity'));

    SELECT to_jsonb(c) INTO v_row FROM public.ticket_categories c WHERE c.id = v_id;
    RETURN jsonb_build_object('ok', true, 'category', v_row);
END;
$$;

-- p : { event_id, category_id, actor_id, patch: { name?, description?, price?, total_quantity?, max_per_order?,
--       sale_start?, sale_end?, is_visible?, is_active? } } → { ok, category }
CREATE OR REPLACE FUNCTION public.ticket_category_update(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_category uuid := public.try_uuid(p->>'category_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_patch jsonb := p->'patch';
    v_guard jsonb;
    v_capacity integer;
    c public.ticket_categories%ROWTYPE;
    v_key text;
    n_name text;
    n_desc text;
    n_price numeric;
    n_total integer;
    n_max integer;
    n_start timestamptz;
    n_end timestamptz;
    n_visible boolean;
    n_active boolean;
    v_sum integer;
    v_row jsonb;
BEGIN
    IF v_patch IS NULL OR jsonb_typeof(v_patch) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les modifications de la catégorie sont illisibles.');
    END IF;
    v_guard := public.ticket_category_guard(v_event, v_actor);
    IF (v_guard->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_guard;
    END IF;
    SELECT * INTO c FROM public.ticket_categories WHERE id = v_category AND event_id = v_event;
    IF NOT FOUND THEN
        RETURN public.event_edit_refusal('CATEGORY_NOT_FOUND', 'Catégorie de billets introuvable pour cet événement.');
    END IF;
    SELECT k INTO v_key FROM jsonb_object_keys(v_patch) AS k
     WHERE k <> ALL (ARRAY['name', 'description', 'price', 'total_quantity', 'max_per_order', 'sale_start', 'sale_end', 'is_visible', 'is_active'])
     ORDER BY k LIMIT 1;
    IF v_key IS NOT NULL THEN
        RETURN public.event_edit_refusal('FIELD_NOT_EDITABLE', 'Ce champ de la catégorie de billets ne se modifie pas.', v_key);
    END IF;

    n_name := c.name; n_desc := c.description; n_price := c.price; n_total := c.total_quantity; n_max := c.max_per_order;
    n_start := c.sale_start; n_end := c.sale_end; n_visible := c.is_visible; n_active := c.is_active;
    BEGIN
        IF v_patch ? 'name' THEN n_name := btrim(v_patch->>'name'); END IF;
        IF v_patch ? 'description' THEN n_desc := NULLIF(btrim(COALESCE(v_patch->>'description', '')), ''); END IF;
        IF v_patch ? 'price' THEN n_price := (v_patch->>'price')::numeric; END IF;
        IF v_patch ? 'total_quantity' THEN n_total := (v_patch->>'total_quantity')::integer; END IF;
        IF v_patch ? 'max_per_order' THEN n_max := (v_patch->>'max_per_order')::integer; END IF;
        IF v_patch ? 'sale_start' THEN n_start := NULLIF(v_patch->>'sale_start', '')::timestamptz; END IF;
        IF v_patch ? 'sale_end' THEN n_end := NULLIF(v_patch->>'sale_end', '')::timestamptz; END IF;
        IF v_patch ? 'is_visible' THEN n_visible := (v_patch->>'is_visible')::boolean; END IF;
        IF v_patch ? 'is_active' THEN n_active := (v_patch->>'is_active')::boolean; END IF;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Une valeur modifiée de la catégorie est illisible.');
    END;
    IF n_name IS NULL OR char_length(n_name) < 1 OR char_length(n_name) > 60 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le nom de la catégorie compte de 1 à 60 caractères.', 'name');
    END IF;
    IF n_desc IS NOT NULL AND char_length(n_desc) > 300 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La description de la catégorie ne dépasse pas 300 caractères.', 'description');
    END IF;
    IF n_price IS NULL OR n_price < 0 OR n_price > 10000000 OR n_price <> trunc(n_price) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le prix est un montant entier de 0 à 10 000 000 F CFA.', 'price');
    END IF;
    IF n_total IS NULL OR n_total < 1 OR n_total > 100000 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le quota est un nombre entier de 1 à 100 000 billets.', 'total_quantity');
    END IF;
    IF n_max IS NULL OR n_max < 1 OR n_max > 50 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le maximum par commande est un nombre entier de 1 à 50.', 'max_per_order');
    END IF;
    IF n_visible IS NULL OR n_active IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Indiquez oui ou non pour la visibilité et la mise en vente.',
                                         CASE WHEN n_visible IS NULL THEN 'is_visible' ELSE 'is_active' END);
    END IF;

    -- Prix : modifiable seulement sans billet ni réservation en cours
    IF n_price <> c.price AND public.ticket_category_has_sales(c.id) THEN
        RETURN public.event_edit_refusal('PRICE_LOCKED_AFTER_SALES',
            'Le prix de cette catégorie est verrouillé : des billets ont été vendus ou réservés. Créez une nouvelle catégorie pour un autre tarif.', 'price');
    END IF;
    -- Quota : jamais sous les vendus, ni sous vendus + réservés (paiements en cours)
    IF n_total < c.sold_quantity THEN
        RETURN public.event_edit_refusal('QUOTA_BELOW_SOLD',
            format('Le quota ne peut pas descendre sous les %s billet(s) déjà vendus.', c.sold_quantity), 'total_quantity');
    END IF;
    IF n_total < c.sold_quantity + c.held_quantity THEN
        RETURN public.event_edit_refusal('QUOTA_BELOW_HELD',
            format('Le quota ne peut pas descendre sous %s : %s billet(s) vendus et %s en cours de paiement.',
                   c.sold_quantity + c.held_quantity, c.sold_quantity, c.held_quantity), 'total_quantity');
    END IF;
    -- Somme des quotas des catégories actives ≤ jauge (contrôlée quand le quota monte ou que la catégorie est activée)
    SELECT capacity INTO v_capacity FROM public.events WHERE id = v_event;
    IF v_capacity IS NOT NULL AND n_active AND (n_total > c.total_quantity OR NOT c.is_active) THEN
        SELECT COALESCE(sum(o.total_quantity), 0)::int INTO v_sum
          FROM public.ticket_categories o WHERE o.event_id = v_event AND o.is_active AND o.id <> c.id;
        IF v_sum + n_total > v_capacity THEN
            RETURN public.event_edit_refusal('QUOTA_ABOVE_CAPACITY',
                format('La somme des quotas des catégories actives (%s) dépasserait la jauge de l''événement (%s).', v_sum + n_total, v_capacity),
                'total_quantity');
        END IF;
    END IF;
    -- Nom unique dans l'événement, sans tenir compte de la casse
    IF lower(n_name) IS DISTINCT FROM lower(btrim(c.name)) AND EXISTS (
        SELECT 1 FROM public.ticket_categories o
         WHERE o.event_id = v_event AND o.id <> c.id AND lower(btrim(o.name)) = lower(n_name)) THEN
        RETURN public.event_edit_refusal('CATEGORY_NAME_TAKEN',
            format('Une catégorie « %s » existe déjà pour cet événement : choisissez un autre nom.', n_name), 'name');
    END IF;
    -- Dates de vente : début < fin ≤ fin de l'événement
    IF (v_patch ? 'sale_start' OR v_patch ? 'sale_end') AND n_start IS NOT NULL AND n_end IS NOT NULL AND n_start >= n_end THEN
        RETURN public.event_edit_refusal('SALE_DATES_INVALID', 'La fin de vente doit être postérieure au début de vente.', 'sale_end');
    END IF;
    IF v_patch ? 'sale_end' AND n_end IS NOT NULL AND n_end > public.event_end_at(v_event) THEN
        RETURN public.event_edit_refusal('SALE_END_AFTER_EVENT', 'La fin de vente ne peut pas dépasser la fin de l''événement.', 'sale_end');
    END IF;

    UPDATE public.ticket_categories
       SET name = n_name, description = n_desc, price = n_price, total_quantity = n_total, max_per_order = n_max,
           sale_start = n_start, sale_end = n_end, is_visible = n_visible, is_active = n_active, updated_at = now()
     WHERE id = c.id;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'CATEGORY_UPDATED', 'TICKET_CATEGORY', c.id,
            jsonb_build_object('event_id', v_event,
                               'fields', (SELECT COALESCE(jsonb_agg(k ORDER BY k), '[]'::jsonb) FROM jsonb_object_keys(v_patch) AS k),
                               'old', jsonb_build_object('price', c.price, 'total_quantity', c.total_quantity, 'is_active', c.is_active, 'is_visible', c.is_visible),
                               'new', jsonb_build_object('price', n_price, 'total_quantity', n_total, 'is_active', n_active, 'is_visible', n_visible)));

    SELECT to_jsonb(x) INTO v_row FROM public.ticket_categories x WHERE x.id = c.id;
    RETURN jsonb_build_object('ok', true, 'category', v_row);
END;
$$;

-- p : { event_id, category_id, actor_id } → { ok, category_id }
CREATE OR REPLACE FUNCTION public.ticket_category_delete(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_category uuid := public.try_uuid(p->>'category_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_guard jsonb;
    v_name text;
BEGIN
    v_guard := public.ticket_category_guard(v_event, v_actor);
    IF (v_guard->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_guard;
    END IF;
    SELECT name INTO v_name FROM public.ticket_categories WHERE id = v_category AND event_id = v_event;
    IF NOT FOUND THEN
        RETURN public.event_edit_refusal('CATEGORY_NOT_FOUND', 'Catégorie de billets introuvable pour cet événement.');
    END IF;
    -- Billet (tout statut), réservation (toute ligne : clé étrangère RESTRICT) ou passage au contrôle : suppression impossible
    IF EXISTS (SELECT 1 FROM public.tickets t WHERE t.category_id = v_category)
       OR EXISTS (SELECT 1 FROM public.stock_reservations r WHERE r.category_id = v_category)
       OR EXISTS (SELECT 1 FROM public.ticket_scans s WHERE s.category_id = v_category) THEN
        RETURN public.event_edit_refusal('CATEGORY_HAS_SALES',
            'Des billets de cette catégorie ont été vendus ou réservés : elle ne peut pas être supprimée. Désactivez-la pour arrêter sa vente.',
            NULL, jsonb_build_object('suggestion', 'DEACTIVATE'));
    END IF;
    DELETE FROM public.ticket_categories WHERE id = v_category AND event_id = v_event;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'CATEGORY_DELETED', 'TICKET_CATEGORY', v_category,
            jsonb_build_object('event_id', v_event, 'name', v_name));
    RETURN jsonb_build_object('ok', true, 'category_id', v_category);
END;
$$;

-- ── File des SMS de changement : prise et compte rendu (cron) ───────────────
-- p : { limit? } → { ok, items: [ { id, event_id, user_id, phone, changed_fields, title, start_date, start_time,
--       end_date, end_time, location, city, address, attempts } ] }. Les lignes prises passent à SENDING ;
-- une ligne restée SENDING plus de 15 minutes (envoi interrompu) est reprise.
CREATE OR REPLACE FUNCTION public.event_change_notifications_claim(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit integer;
    v_items jsonb;
BEGIN
    BEGIN
        v_limit := COALESCE((p->>'limit')::integer, 100);
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        v_limit := 100;
    END;
    v_limit := LEAST(GREATEST(v_limit, 1), 500);

    -- Plus rien à annoncer : événement clos ou retiré de la vente, porteur supprimé
    UPDATE public.event_change_notifications n
       SET sms_status = 'CANCELLED', sms_code = 'NO_LONGER_RELEVANT', updated_at = now()
     WHERE n.sms_status = 'PENDING'
       AND (EXISTS (SELECT 1 FROM public.events e WHERE e.id = n.event_id AND e.status::text NOT IN ('VALIDE', 'PUBLIE', 'SUSPENDU'))
            OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = n.user_id AND u.status::text = 'SUPPRIME'));

    WITH picked AS (
        SELECT n.id FROM public.event_change_notifications n
         WHERE (n.sms_status = 'PENDING' AND (n.next_attempt_at IS NULL OR n.next_attempt_at <= now()))
            OR (n.sms_status = 'SENDING' AND n.claimed_at < now() - interval '15 minutes')
         ORDER BY n.created_at, n.id
         LIMIT v_limit
         FOR UPDATE SKIP LOCKED
    ), claimed AS (
        UPDATE public.event_change_notifications n
           SET sms_status = 'SENDING', claimed_at = now(), attempts = n.attempts + 1, updated_at = now()
          FROM picked
         WHERE n.id = picked.id
        RETURNING n.id, n.event_id, n.user_id, n.changed_fields, n.attempts, n.created_at
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', c.id, 'event_id', c.event_id, 'user_id', c.user_id, 'phone', u.phone,
               'changed_fields', to_jsonb(c.changed_fields), 'attempts', c.attempts,
               'title', e.title, 'start_date', e.start_date, 'start_time', to_char(e.start_time, 'HH24:MI'),
               'end_date', e.end_date, 'end_time', to_char(e.end_time, 'HH24:MI'),
               'location', e.location, 'city', e.city, 'address', e.practical_info->>'address')
             ORDER BY c.created_at, c.id), '[]'::jsonb)
      INTO v_items
      FROM claimed c
      JOIN public.events e ON e.id = c.event_id
      JOIN public.users u ON u.id = c.user_id;
    RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;

-- p : { results: [ { id, outcome: SENT | RETRY | REFUSED | FAILED, code?, retry_after_seconds? } ] } → { ok, updated }
-- RETRY : nouvel essai plus tard (5 essais au plus, puis FAILED) ; une ligne plus récente en attente pour le même
-- porteur l'emporte (SUPERSEDED).
CREATE OR REPLACE FUNCTION public.event_change_notifications_mark(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r jsonb;
    v_id uuid;
    v_outcome text;
    v_code text;
    v_delay integer;
    n public.event_change_notifications%ROWTYPE;
    v_updated integer := 0;
BEGIN
    IF p->'results' IS NULL OR jsonb_typeof(p->'results') <> 'array' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Comptes rendus d''envoi illisibles.');
    END IF;
    FOR r IN SELECT x FROM jsonb_array_elements(p->'results') AS x LOOP
        v_id := public.try_uuid(r->>'id');
        v_outcome := r->>'outcome';
        v_code := left(NULLIF(r->>'code', ''), 80);
        IF v_id IS NULL OR v_outcome IS NULL OR v_outcome NOT IN ('SENT', 'RETRY', 'REFUSED', 'FAILED') THEN
            CONTINUE;
        END IF;
        SELECT * INTO n FROM public.event_change_notifications WHERE id = v_id AND sms_status = 'SENDING' FOR UPDATE;
        IF NOT FOUND THEN
            CONTINUE;
        END IF;
        IF v_outcome = 'SENT' THEN
            UPDATE public.event_change_notifications
               SET sms_status = 'SENT', sms_code = NULL, sent_at = now(), claimed_at = NULL, next_attempt_at = NULL, updated_at = now()
             WHERE id = v_id;
        ELSIF v_outcome = 'RETRY' AND n.attempts < 5 THEN
            IF EXISTS (SELECT 1 FROM public.event_change_notifications o
                        WHERE o.event_id = n.event_id AND o.user_id = n.user_id AND o.sms_status = 'PENDING' AND o.id <> n.id) THEN
                UPDATE public.event_change_notifications
                   SET sms_status = 'SUPERSEDED', sms_code = v_code, claimed_at = NULL, updated_at = now()
                 WHERE id = v_id;
            ELSE
                BEGIN
                    v_delay := COALESCE((r->>'retry_after_seconds')::integer, 900);
                EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
                    v_delay := 900;
                END;
                v_delay := LEAST(GREATEST(v_delay, 60), 172800);
                UPDATE public.event_change_notifications
                   SET sms_status = 'PENDING', sms_code = v_code, claimed_at = NULL,
                       next_attempt_at = now() + make_interval(secs => v_delay), updated_at = now()
                 WHERE id = v_id;
            END IF;
        ELSE
            UPDATE public.event_change_notifications
               SET sms_status = CASE WHEN v_outcome = 'REFUSED' THEN 'REFUSED' ELSE 'FAILED' END,
                   sms_code = v_code, claimed_at = NULL, next_attempt_at = NULL, updated_at = now()
             WHERE id = v_id;
        END IF;
        v_updated := v_updated + 1;
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'updated', v_updated);
END;
$$;

-- ── Droits : service_role seul ──────────────────────────────────────────────
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.event_edit_refusal(text, text, text, jsonb)',
        'public.event_end_from(date, date, time)',
        'public.event_poster_path_ok(text, uuid)',
        'public.ticket_category_has_sales(uuid)',
        'public.event_has_sales(uuid)',
        'public.ticket_category_normalize(jsonb, timestamptz, text)',
        'public.event_create(jsonb)',
        'public.event_update(jsonb)',
        'public.ticket_category_guard(uuid, uuid)',
        'public.ticket_category_create(jsonb)',
        'public.ticket_category_update(jsonb)',
        'public.ticket_category_delete(jsonb)',
        'public.event_change_notifications_claim(jsonb)',
        'public.event_change_notifications_mark(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
