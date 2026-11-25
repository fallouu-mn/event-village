-- ============================================================================
-- EVENT VILLAGE — LOT 11c-a, migration 03 : configuration des tables d'un événement par l'organisatrice
-- ============================================================================
--  1. event_table_refusal : garde commune (service fermé, garde de la billetterie ticket_category_guard : fiche ou compte
--     suspendu, propriétaire, compte actif, événement terminé ou annulé, en attente de validation ; en plus : événement
--     SUSPENDU) ; event_seats_refusal : jauge en PLACES (Σ quotas des billets + Σ tables × places des types ≤ capacité,
--     capacité obligatoire dès qu'un type de table existe).
--  2. event_table_type_save (création avec ses N tables numérotées, ou modification), event_table_type_delete (sans
--     vente ni attente), event_tables_save (liste complète des tables, zones du plan, plan montré : tout ou rien, règles
--     de venue_plan_set recopiées : tout est vérifié avant la première écriture, écritures annulées ensemble au moindre
--     refus) ; prix et places figés dès la première vente ; table vendue ou en attente jamais supprimée, renumérotée
--     ni changée de type.
--  3. Jauge en places dans les chemins existants :
--     ticket_category_create : recopie de 20261119000002_f2b_couleur_consigne.sql:111-175 ;
--     ticket_category_update : recopie de 20261121000008_cvf2b_consigne_controle.sql:131-309 (un type de table s'y refuse : TABLE_TYPE) ;
--     event_update : recopie de 20261121000005_cvf2b_avis_en_cours_envoi.sql:324-821 (vendus, réservés et quotas comptés en places ; capacité
--     obligatoire dès qu'un type de table existe).
--  4. Signalement aux administrateurs : ADMIN_EVENT_TABLES_CHANGED (cloche, push, email, SMS ; type d'avis posé par la
--     migration 06) pour tout type ou toute table ajouté, modifié ou supprimé sur un événement VALIDE, PUBLIE ou
--     SUSPENDU, une fois par transaction ; les alertes des catégories de billets (ADMIN_EVENT_CHANGED) ne partent plus
--     pour un type de table (déclencheurs recréés avec WHEN kind = 'TICKET').
-- Réservées au rôle de service. Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Gardes communes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.event_table_refusal(p_event uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_guard jsonb;
BEGIN
    IF NOT public.fin_setting_bool('features.event_tables_enabled') THEN
        RETURN public.event_edit_refusal('SERVICE_UNAVAILABLE', 'La vente de tables n’est pas encore ouverte sur Event Village.');
    END IF;
    -- Fiche ou compte suspendu, propriétaire, compte actif, terminé ou annulé, en attente de validation ; verrou de
    -- l'événement puis de ses catégories
    v_guard := public.ticket_category_guard(p_event, p_actor);
    IF (v_guard->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_guard;
    END IF;
    IF EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event AND e.status::text = 'SUSPENDU') THEN
        RETURN public.event_edit_refusal('EVENT_SUSPENDED', 'Cet événement est suspendu : ses tables ne se modifient plus. Contactez le support.');
    END IF;
    RETURN NULL;
END;
$$;

-- Jauge en places, sur l'état en base (appelée après les écritures, dans le bloc annulé au moindre refus)
CREATE OR REPLACE FUNCTION private.event_seats_refusal(p_event uuid, p_field text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_capacity integer;
    v_seats integer;
    v_table_seats integer;
BEGIN
    SELECT capacity INTO v_capacity FROM public.events WHERE id = p_event;
    SELECT COALESCE(sum(c.total_quantity * c.seats_per_unit) FILTER (WHERE c.is_active), 0)::int,
           COALESCE(sum(c.total_quantity * c.seats_per_unit) FILTER (WHERE c.is_active AND c.kind = 'TABLE'), 0)::int
      INTO v_seats, v_table_seats
      FROM public.ticket_categories c WHERE c.event_id = p_event;
    IF v_capacity IS NULL THEN
        IF EXISTS (SELECT 1 FROM public.ticket_categories c WHERE c.event_id = p_event AND c.kind = 'TABLE') THEN
            RETURN public.event_edit_refusal('CAPACITY_REQUIRED',
                'Indiquez d’abord la capacité totale de l’événement : elle compte les places des billets et des tables.', p_field);
        END IF;
        RETURN NULL;
    END IF;
    IF v_seats > v_capacity THEN
        RETURN public.event_edit_refusal('QUOTA_ABOVE_CAPACITY',
            format('Les places mises en vente totaliseraient %s places (%s en billets, %s aux tables). Augmentez d’abord la capacité totale de l’événement (actuellement %s).',
                   v_seats, v_seats - v_table_seats, v_table_seats, v_capacity), p_field);
    END IF;
    RETURN NULL;
END;
$$;

-- Texte court reçu : sans caractère de contrôle ni contrôle de sens d'écriture (règle de la consigne d'entrée) ;
-- retours à la ligne admis seulement si p_lines > 1 (au plus p_lines lignes).
CREATE OR REPLACE FUNCTION private.event_table_text_ok(p_text text, p_max integer, p_lines integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT p_text IS NULL OR (
        char_length(p_text) BETWEEN 1 AND p_max
        AND regexp_replace(p_text, E'\n', '', 'g') !~ '[\u0001-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]'
        AND (p_lines > 1 OR position(E'\n' IN p_text) = 0)
        AND array_length(string_to_array(p_text, E'\n'), 1) <= p_lines)
$$;

-- ----------------------------------------------------------------------------
-- 2. Types de tables
-- ----------------------------------------------------------------------------
-- p : event_id, actor_id, type_id (absent : création), type { name, seats, price, included_text, onsite_note,
-- payment_mode, sale_start, sale_end, is_active, scan_color, entry_instruction }, count (création : 1 à 200 tables,
-- numérotées sur les plus petits numéros libres de l'événement).
CREATE OR REPLACE FUNCTION public.event_table_type_save(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event   uuid := public.try_uuid(p->>'event_id');
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_type_id uuid := public.try_uuid(p->>'type_id');
    v_in      jsonb := p->'type';
    v_refusal jsonb;
    v_key     text;
    c         public.ticket_categories%ROWTYPE;
    v_create  boolean := NOT (p ? 'type_id') OR p->'type_id' = 'null'::jsonb;
    n_name    text;
    n_seats   integer;
    n_price   numeric;
    n_incl    text;
    n_note    text;
    n_mode    text;
    n_start   timestamptz;
    n_end     timestamptz;
    n_active  boolean;
    n_color   text;
    n_instr   text;
    v_count   integer;
    v_min     numeric;
    v_id      uuid;
    v_fail    jsonb;
    v_row     jsonb;
BEGIN
    IF v_in IS NULL OR jsonb_typeof(v_in) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le type de table est illisible : rechargez la page et réessayez.');
    END IF;
    v_refusal := private.event_table_refusal(v_event, v_actor);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;
    SELECT k INTO v_key FROM jsonb_object_keys(v_in) AS k
     WHERE k <> ALL (ARRAY['name', 'seats', 'price', 'included_text', 'onsite_note', 'payment_mode', 'sale_start', 'sale_end',
                           'is_active', 'scan_color', 'entry_instruction'])
     ORDER BY k LIMIT 1;
    IF v_key IS NOT NULL THEN
        RETURN public.event_edit_refusal('FIELD_NOT_EDITABLE', 'Ce champ du type de table ne se modifie pas.', v_key);
    END IF;
    IF NOT v_create THEN
        SELECT * INTO c FROM public.ticket_categories WHERE id = v_type_id AND event_id = v_event AND kind = 'TABLE';
        IF NOT FOUND THEN
            RETURN public.event_edit_refusal('TABLE_TYPE_NOT_FOUND', 'Type de table introuvable pour cet événement.');
        END IF;
        n_name := c.name; n_seats := c.seats_per_unit; n_price := c.price; n_incl := c.included_text; n_note := c.onsite_note;
        n_mode := c.payment_mode; n_start := c.sale_start; n_end := c.sale_end; n_active := c.is_active;
        n_color := c.scan_color; n_instr := c.entry_instruction;
    ELSE
        n_mode := 'FULL'; n_active := TRUE;
    END IF;
    BEGIN
        IF v_in ? 'name' THEN n_name := btrim(v_in->>'name'); END IF;
        IF v_in ? 'seats' THEN n_seats := (v_in->>'seats')::integer; END IF;
        IF v_in ? 'price' THEN n_price := (v_in->>'price')::numeric; END IF;
        IF v_in ? 'included_text' THEN n_incl := NULLIF(btrim(COALESCE(v_in->>'included_text', '')), ''); END IF;
        IF v_in ? 'onsite_note' THEN n_note := NULLIF(btrim(COALESCE(v_in->>'onsite_note', '')), ''); END IF;
        IF v_in ? 'payment_mode' THEN n_mode := v_in->>'payment_mode'; END IF;
        IF v_in ? 'sale_start' THEN n_start := NULLIF(v_in->>'sale_start', '')::timestamptz; END IF;
        IF v_in ? 'sale_end' THEN n_end := NULLIF(v_in->>'sale_end', '')::timestamptz; END IF;
        IF v_in ? 'is_active' THEN n_active := (v_in->>'is_active')::boolean; END IF;
        IF v_in ? 'scan_color' THEN n_color := NULLIF(v_in->>'scan_color', ''); END IF;
        IF v_in ? 'entry_instruction' THEN n_instr := NULLIF(btrim(regexp_replace(COALESCE(v_in->>'entry_instruction', ''), '\s+', ' ', 'g')), ''); END IF;
        IF v_create THEN v_count := (p->>'count')::integer; END IF;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Une valeur du type de table est illisible.');
    END;
    IF n_name IS NULL OR char_length(n_name) < 1 OR char_length(n_name) > 60 OR NOT private.event_table_text_ok(n_name, 60, 1) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le nom du type de table compte de 1 à 60 caractères, sans caractère invisible.', 'name');
    END IF;
    IF n_seats IS NULL OR n_seats < 2 OR n_seats > 20 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Une table compte de 2 à 20 places.', 'seats');
    END IF;
    v_min := GREATEST(COALESCE(public.fin_setting_num('finance.min_paid_price'), 1), 1);
    IF n_price IS NULL OR n_price <> trunc(n_price) OR n_price < v_min OR n_price > 10000000 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT',
            format('Le prix de la table est un montant entier de %s à 10 000 000 F CFA.', v_min::bigint), 'price');
    END IF;
    IF NOT private.event_table_text_ok(n_incl, 200, 3) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Ce qui est compris tient en 3 lignes et 200 caractères, sans caractère invisible.', 'included_text');
    END IF;
    IF NOT private.event_table_text_ok(n_note, 120, 1) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le minimum sur place tient en une ligne de 120 caractères, sans caractère invisible.', 'onsite_note');
    END IF;
    IF n_mode IS DISTINCT FROM 'FULL' THEN
        RETURN public.event_edit_refusal('PAYMENT_MODE_UNAVAILABLE', 'Pour l’instant, une table se paie en entier à la réservation.', 'payment_mode');
    END IF;
    IF n_active IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Indiquez si ce type de table est en vente.', 'is_active');
    END IF;
    IF n_color IS NOT NULL AND n_color NOT IN ('BLANC', 'ARGENT', 'ROSE', 'TURQUOISE', 'BLEU', 'VIOLET', 'NOIR') THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une couleur dans la liste.', 'scan_color');
    END IF;
    IF NOT private.event_table_text_ok(n_instr, 60, 1) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La consigne d’entrée ne dépasse pas 60 caractères, sans caractère invisible.', 'entry_instruction');
    END IF;
    IF n_start IS NOT NULL AND n_end IS NOT NULL AND n_start >= n_end THEN
        RETURN public.event_edit_refusal('SALE_DATES_INVALID', 'La fin de vente doit être postérieure au début de vente.', 'sale_end');
    END IF;
    IF n_end IS NOT NULL AND n_end > public.event_end_at(v_event) THEN
        RETURN public.event_edit_refusal('SALE_END_AFTER_EVENT', 'La fin de vente ne peut pas dépasser la fin de l''événement.', 'sale_end');
    END IF;
    IF n_start IS NOT NULL AND n_start >= public.event_end_at(v_event) THEN
        RETURN public.event_edit_refusal('SALE_START_AFTER_EVENT', 'Le début de vente doit précéder la fin de l’événement.', 'sale_start');
    END IF;
    IF EXISTS (SELECT 1 FROM public.ticket_categories o
                WHERE o.event_id = v_event AND o.id IS DISTINCT FROM c.id AND lower(btrim(o.name)) = lower(n_name)) THEN
        RETURN public.event_edit_refusal('CATEGORY_NAME_TAKEN',
            format('« %s » existe déjà pour cet événement (billets ou tables) : choisissez un autre nom.', n_name), 'name');
    END IF;
    IF v_create THEN
        IF v_count IS NULL OR v_count < 1 OR v_count > 200 THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Indiquez de 1 à 200 tables de ce type.', 'count');
        END IF;
        IF (SELECT count(*) FROM public.event_tables t WHERE t.event_id = v_event) + v_count > 500 THEN
            RETURN public.event_edit_refusal('TOO_MANY_TABLES', 'Un événement compte au plus 500 tables.', 'count');
        END IF;
    ELSIF (n_price IS DISTINCT FROM c.price OR n_seats IS DISTINCT FROM c.seats_per_unit)
          AND (c.sold_quantity > 0 OR c.held_quantity > 0) THEN
        RETURN public.event_edit_refusal('PRICE_LOCKED_AFTER_SALES',
            'Le prix et le nombre de places de ce type de table sont figés : des tables sont vendues ou en cours de paiement. Créez un autre type pour un autre tarif.',
            CASE WHEN n_price IS DISTINCT FROM c.price THEN 'price' ELSE 'seats' END);
    END IF;

    BEGIN
        PERFORM set_config('event_village.event_tables', 'on', true);
        IF v_create THEN
            INSERT INTO public.ticket_categories (event_id, name, description, price, total_quantity, sold_quantity, max_per_order,
                                                  sale_start, sale_end, sale_online, sale_counter, is_active, scan_color,
                                                  entry_instruction, kind, seats_per_unit, included_text, onsite_note, payment_mode)
            VALUES (v_event, n_name, NULL, n_price, v_count, 0, 1, n_start, n_end, FALSE, FALSE, n_active, n_color, n_instr,
                    'TABLE', n_seats, n_incl, n_note, n_mode)
            RETURNING id INTO v_id;
            INSERT INTO public.event_tables (event_id, category_id, number)
            SELECT v_event, v_id, n.num
              FROM (SELECT g AS num FROM generate_series(1, 999) g
                     WHERE NOT EXISTS (SELECT 1 FROM public.event_tables t WHERE t.event_id = v_event AND t.number = g)
                     ORDER BY g LIMIT v_count) n;
        ELSE
            v_id := c.id;
            UPDATE public.ticket_categories
               SET name = n_name, price = n_price, seats_per_unit = n_seats, included_text = n_incl, onsite_note = n_note,
                   payment_mode = n_mode, sale_start = n_start, sale_end = n_end, is_active = n_active, scan_color = n_color,
                   entry_instruction = n_instr, updated_at = now()
             WHERE id = c.id;
        END IF;
        v_fail := private.event_seats_refusal(v_event, CASE WHEN v_create THEN 'count' ELSE 'seats' END);
        IF v_fail IS NOT NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'event_table_type_save : refus';
        END IF;
        PERFORM set_config('event_village.event_tables', 'off', true);
    EXCEPTION
        WHEN check_violation THEN
            PERFORM set_config('event_village.event_tables', 'off', true);
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Une valeur du type de table est hors des bornes.');
        WHEN raise_exception THEN
            PERFORM set_config('event_village.event_tables', 'off', true);
            IF v_fail IS NULL THEN
                RAISE;
            END IF;
            RETURN v_fail;
    END;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', CASE WHEN v_create THEN 'EVENT_TABLE_TYPE_CREATED' ELSE 'EVENT_TABLE_TYPE_UPDATED' END,
            'TICKET_CATEGORY', v_id,
            jsonb_build_object('event_id', v_event, 'name', n_name, 'seats', n_seats, 'price', n_price, 'count', v_count,
                               'old', CASE WHEN v_create THEN NULL ELSE jsonb_build_object('price', c.price, 'seats', c.seats_per_unit, 'is_active', c.is_active) END));
    SELECT to_jsonb(x) INTO v_row FROM public.ticket_categories x WHERE x.id = v_id;
    RETURN jsonb_build_object('ok', true, 'type', v_row,
                              'tables', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'number', t.number) ORDER BY t.number), '[]'::jsonb)
                                           FROM public.event_tables t WHERE t.category_id = v_id));
END;
$$;

-- p : event_id, actor_id, type_id. Sans vente ni attente : le type et ses tables sont supprimés.
CREATE OR REPLACE FUNCTION public.event_table_type_delete(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event   uuid := public.try_uuid(p->>'event_id');
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_type_id uuid := public.try_uuid(p->>'type_id');
    v_refusal jsonb;
    c         public.ticket_categories%ROWTYPE;
BEGIN
    v_refusal := private.event_table_refusal(v_event, v_actor);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;
    SELECT * INTO c FROM public.ticket_categories WHERE id = v_type_id AND event_id = v_event AND kind = 'TABLE';
    IF NOT FOUND THEN
        RETURN public.event_edit_refusal('TABLE_TYPE_NOT_FOUND', 'Type de table introuvable pour cet événement.');
    END IF;
    IF c.sold_quantity > 0 OR c.held_quantity > 0
       OR EXISTS (SELECT 1 FROM public.event_table_bookings b WHERE b.category_id = c.id)
       OR EXISTS (SELECT 1 FROM public.stock_reservations r WHERE r.category_id = c.id) THEN
        RETURN public.event_edit_refusal('CATEGORY_HAS_SALES',
            'Des tables de ce type ont été vendues ou sont en cours de paiement : arrêtez plutôt leur vente.');
    END IF;
    PERFORM set_config('event_village.event_tables', 'on', true);
    DELETE FROM public.event_tables WHERE category_id = c.id;
    DELETE FROM public.ticket_categories WHERE id = c.id;
    PERFORM set_config('event_village.event_tables', 'off', true);
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'EVENT_TABLE_TYPE_DELETED', 'TICKET_CATEGORY', c.id,
            jsonb_build_object('event_id', v_event, 'name', c.name));
    RETURN jsonb_build_object('ok', true, 'type_id', c.id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Tables et plan : liste complète, tout ou rien
-- ----------------------------------------------------------------------------
-- p : event_id, actor_id, plan_enabled, tables [{ id (absent : nouvelle), type_id, number, zone_id, x, y, shape,
-- rotation }] = TOUTES les tables de l'événement (une table absente de la liste est supprimée), zones [{ id, x, y, w, h }]
-- (rectangle d'une zone d'accès sur le plan ; x null : retirée du plan).
CREATE OR REPLACE FUNCTION public.event_tables_save(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event   uuid := public.try_uuid(p->>'event_id');
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_tables  jsonb := COALESCE(p->'tables', '[]'::jsonb);
    v_zones   jsonb := COALESCE(p->'zones', '[]'::jsonb);
    v_enabled boolean;
    v_refusal jsonb;
    v_fail    jsonb;
    t         jsonb;
    z         jsonb;
    r         record;
    v_id      uuid;
    v_count   integer;
BEGIN
    IF jsonb_typeof(v_tables) <> 'array' OR jsonb_typeof(v_zones) <> 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PLAN', 'message', 'Plan illisible : rechargez la page et réessayez.');
    END IF;
    IF jsonb_array_length(v_tables) > 500 OR jsonb_array_length(v_zones) > 50 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_TABLES', 'message', 'Un événement compte au plus 500 tables.');
    END IF;
    BEGIN
        v_enabled := COALESCE((p->>'plan_enabled')::boolean, FALSE);
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PLAN', 'message', 'Plan illisible : rechargez la page et réessayez.');
    END;
    v_refusal := private.event_table_refusal(v_event, v_actor);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;
    PERFORM 1 FROM public.event_tables WHERE event_id = v_event ORDER BY id FOR UPDATE;

    -- Tout est vérifié avant la première écriture
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_tables) e
                WHERE jsonb_typeof(e) <> 'object'
                   OR NOT EXISTS (SELECT 1 FROM public.ticket_categories c
                                   WHERE c.id = public.try_uuid(e->>'type_id') AND c.event_id = v_event AND c.kind = 'TABLE')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TABLE_TYPE_NOT_FOUND', 'message', 'Une table du plan a un type inconnu pour cet événement.');
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_tables) e
                WHERE e ? 'id' AND e->'id' <> 'null'::jsonb
                  AND NOT EXISTS (SELECT 1 FROM public.event_tables x WHERE x.id = public.try_uuid(e->>'id') AND x.event_id = v_event)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TABLE_NOT_FOUND', 'message', 'Une table du plan n’appartient pas à cet événement.');
    END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(v_tables) e WHERE e ? 'id' AND e->'id' <> 'null'::jsonb)
       <> (SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements(v_tables) e WHERE e ? 'id' AND e->'id' <> 'null'::jsonb) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PLAN', 'message', 'Une table apparaît deux fois dans le plan.');
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_tables) e
                WHERE COALESCE(e->>'number', '') !~ '^[0-9]{1,3}$' OR (e->>'number')::int NOT BETWEEN 1 AND 999) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_NUMBER', 'message', 'Le numéro d’une table va de 1 à 999.');
    END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(v_tables)) <> (SELECT count(DISTINCT (e->>'number')::int) FROM jsonb_array_elements(v_tables) e) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NUMBER_TAKEN', 'message', 'Deux tables portent le même numéro : changez l’un des deux.');
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_tables) e
                WHERE e ? 'zone_id' AND e->'zone_id' <> 'null'::jsonb
                  AND NOT EXISTS (SELECT 1 FROM public.event_zones ez WHERE ez.id = public.try_uuid(e->>'zone_id') AND ez.event_id = v_event)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ZONE_NOT_FOUND', 'message', 'Une zone du plan n’appartient pas à cet événement.');
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_zones) e
                WHERE jsonb_typeof(e) <> 'object'
                   OR NOT EXISTS (SELECT 1 FROM public.event_zones ez WHERE ez.id = public.try_uuid(e->>'id') AND ez.event_id = v_event)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ZONE_NOT_FOUND', 'message', 'Une zone du plan n’appartient pas à cet événement.');
    END IF;
    -- Table vendue ou en attente de paiement : jamais supprimée, renumérotée ni changée de type
    FOR r IN
        SELECT x.id, x.number, x.category_id, j.e AS input
          FROM public.event_tables x
          LEFT JOIN LATERAL (SELECT e FROM jsonb_array_elements(v_tables) e WHERE public.try_uuid(e->>'id') = x.id LIMIT 1) j ON TRUE
         WHERE x.event_id = v_event
           AND (EXISTS (SELECT 1 FROM public.event_table_bookings b WHERE b.event_table_id = x.id AND b.status = 'ACTIVE')
                OR EXISTS (SELECT 1 FROM public.stock_reservations s WHERE s.event_table_id = x.id AND s.status = 'ACTIVE'))
    LOOP
        IF r.input IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TABLE_SOLD', 'message',
                format('La table %s est vendue ou en cours de paiement : elle ne peut pas être retirée.', r.number));
        END IF;
        IF (r.input->>'number')::int <> r.number OR public.try_uuid(r.input->>'type_id') IS DISTINCT FROM r.category_id THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TABLE_SOLD', 'message',
                format('La table %s est vendue ou en cours de paiement : son numéro et son type ne changent plus.', r.number));
        END IF;
    END LOOP;
    IF v_enabled AND (jsonb_array_length(v_tables) = 0
                      OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_tables) e WHERE e->'x' IS NULL OR e->'x' = 'null'::jsonb)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PLAN', 'message', 'Placez toutes les tables sur le plan avant de le montrer aux clients.');
    END IF;

    BEGIN
        PERFORM set_config('event_village.event_tables', 'on', true);
        -- Numéros libérés d'abord (renumérotation croisée : 3 ↔ 5)
        DELETE FROM public.event_tables x
         WHERE x.event_id = v_event
           AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_tables) e WHERE public.try_uuid(e->>'id') = x.id);
        SET CONSTRAINTS public.event_tables_event_number_key DEFERRED;
        FOR t IN SELECT * FROM jsonb_array_elements(v_tables) LOOP
            v_id := public.try_uuid(t->>'id');
            IF v_id IS NULL THEN
                INSERT INTO public.event_tables (event_id, category_id, number, zone_id, plan_x, plan_y, plan_shape, plan_rotation)
                VALUES (v_event, public.try_uuid(t->>'type_id'), (t->>'number')::int, public.try_uuid(t->>'zone_id'),
                        NULLIF(t->>'x', '')::numeric, NULLIF(t->>'y', '')::numeric, COALESCE(NULLIF(t->>'shape', ''), 'RONDE'),
                        COALESCE(NULLIF(t->>'rotation', '')::smallint, 0));
            ELSE
                UPDATE public.event_tables
                   SET category_id = public.try_uuid(t->>'type_id'), number = (t->>'number')::int, zone_id = public.try_uuid(t->>'zone_id'),
                       plan_x = NULLIF(t->>'x', '')::numeric, plan_y = NULLIF(t->>'y', '')::numeric,
                       plan_shape = COALESCE(NULLIF(t->>'shape', ''), plan_shape),
                       plan_rotation = COALESCE(NULLIF(t->>'rotation', '')::smallint, plan_rotation), updated_at = now()
                 WHERE id = v_id AND event_id = v_event;
            END IF;
        END LOOP;
        FOR z IN SELECT * FROM jsonb_array_elements(v_zones) LOOP
            UPDATE public.event_zones
               SET plan_x = NULLIF(z->>'x', '')::numeric, plan_y = NULLIF(z->>'y', '')::numeric,
                   plan_w = NULLIF(z->>'w', '')::numeric, plan_h = NULLIF(z->>'h', '')::numeric
             WHERE id = public.try_uuid(z->>'id') AND event_id = v_event;
        END LOOP;
        -- Nombre de tables de chaque type (jamais sous vendues + en attente : une table vendue ne se retire pas)
        UPDATE public.ticket_categories c
           SET total_quantity = (SELECT count(*) FROM public.event_tables x WHERE x.category_id = c.id), updated_at = now()
         WHERE c.event_id = v_event AND c.kind = 'TABLE'
           AND c.total_quantity IS DISTINCT FROM (SELECT count(*) FROM public.event_tables x WHERE x.category_id = c.id);
        INSERT INTO public.event_table_plans (event_id, plan_enabled, updated_at)
        VALUES (v_event, v_enabled, now())
        ON CONFLICT (event_id) DO UPDATE SET plan_enabled = EXCLUDED.plan_enabled, updated_at = now();
        SET CONSTRAINTS public.event_tables_event_number_key IMMEDIATE;
        v_fail := private.event_seats_refusal(v_event, 'tables');
        IF v_fail IS NOT NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'event_tables_save : refus';
        END IF;
        PERFORM set_config('event_village.event_tables', 'off', true);
    EXCEPTION
        WHEN check_violation OR invalid_text_representation OR numeric_value_out_of_range THEN
            PERFORM set_config('event_village.event_tables', 'off', true);
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PLAN', 'message', 'Une position du plan est hors du cadre : replacez la table ou la zone dans le plan.');
        WHEN raise_exception THEN
            PERFORM set_config('event_village.event_tables', 'off', true);
            IF v_fail IS NULL THEN
                RAISE;
            END IF;
            RETURN v_fail;
    END;
    SELECT count(*) INTO v_count FROM public.event_tables WHERE event_id = v_event;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'EVENT_TABLES_SAVED', 'EVENT', v_event,
            jsonb_build_object('tables', v_count, 'zones', jsonb_array_length(v_zones), 'plan_enabled', v_enabled));
    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'tables', v_count, 'plan_enabled', v_enabled);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Jauge en places dans les chemins existants (recopies)
-- ----------------------------------------------------------------------------
-- Recopie de 20261119000002_f2b_couleur_consigne.sql:111-175
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
        -- Lot 11c-a : jauge en places (une table compte ses places)
        SELECT COALESCE(sum(c.total_quantity * c.seats_per_unit), 0)::int INTO v_sum
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

-- Recopie de 20261121000008_cvf2b_consigne_controle.sql:131-309
CREATE OR REPLACE FUNCTION public.ticket_category_update(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
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
    n_online boolean;
    n_counter boolean;
    n_active boolean;
    n_color text;
    n_instr text;
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
    -- Lot 11c-a : un type de table se modifie par event_table_type_save (places, prix de la table, ce qui est compris)
    IF c.kind = 'TABLE' THEN
        RETURN public.event_edit_refusal('TABLE_TYPE', 'Ce type de table se modifie depuis les tables de l’événement.');
    END IF;
    SELECT k INTO v_key FROM jsonb_object_keys(v_patch) AS k
     WHERE k <> ALL (ARRAY['name', 'description', 'price', 'total_quantity', 'max_per_order', 'sale_start', 'sale_end', 'sale_online', 'sale_counter', 'is_visible', 'is_active', 'scan_color', 'entry_instruction'])
     ORDER BY k LIMIT 1;
    IF v_key IS NOT NULL THEN
        RETURN public.event_edit_refusal('FIELD_NOT_EDITABLE', 'Ce champ de la catégorie de billets ne se modifie pas.', v_key);
    END IF;

    n_name := c.name; n_desc := c.description; n_price := c.price; n_total := c.total_quantity; n_max := c.max_per_order;
    n_start := c.sale_start; n_end := c.sale_end; n_online := c.sale_online; n_counter := c.sale_counter; n_active := c.is_active;
    n_color := c.scan_color; n_instr := c.entry_instruction;
    BEGIN
        IF v_patch ? 'name' THEN n_name := btrim(v_patch->>'name'); END IF;
        IF v_patch ? 'description' THEN n_desc := NULLIF(btrim(COALESCE(v_patch->>'description', '')), ''); END IF;
        IF v_patch ? 'price' THEN n_price := (v_patch->>'price')::numeric; END IF;
        IF v_patch ? 'total_quantity' THEN n_total := (v_patch->>'total_quantity')::integer; END IF;
        IF v_patch ? 'max_per_order' THEN n_max := (v_patch->>'max_per_order')::integer; END IF;
        IF v_patch ? 'sale_start' THEN n_start := NULLIF(v_patch->>'sale_start', '')::timestamptz; END IF;
        IF v_patch ? 'sale_end' THEN n_end := NULLIF(v_patch->>'sale_end', '')::timestamptz; END IF;
        IF v_patch ? 'is_visible' THEN n_online := (v_patch->>'is_visible')::boolean; END IF;
        IF v_patch ? 'sale_online' THEN n_online := (v_patch->>'sale_online')::boolean; END IF;
        IF v_patch ? 'sale_counter' THEN n_counter := (v_patch->>'sale_counter')::boolean; END IF;
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
    IF n_online IS NULL OR n_counter IS NULL OR n_active IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Indiquez oui ou non pour les canaux de vente et la mise en vente.',
                                         CASE WHEN n_online IS NULL THEN CASE WHEN v_patch ? 'sale_online' THEN 'sale_online' ELSE 'is_visible' END
                                              WHEN n_counter IS NULL THEN 'sale_counter' ELSE 'is_active' END);
    END IF;
    -- Lot 9 ter (9t.15) : couleur de la catégorie au scan (palette fermée) et consigne d'entrée (60 caractères au plus).
    -- Contre-vérification 2b (2b) : OR n'est plus choisissable (confondable avec l'ambre « hors fenêtre » du scanner)
    IF v_patch ? 'scan_color' THEN
        IF jsonb_typeof(v_patch->'scan_color') = 'null' THEN
            n_color := NULL;
        ELSIF jsonb_typeof(v_patch->'scan_color') = 'string'
              AND (v_patch->>'scan_color') IN ('BLANC', 'ARGENT', 'ROSE', 'TURQUOISE', 'BLEU', 'VIOLET', 'NOIR') THEN
            n_color := v_patch->>'scan_color';
        ELSE
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une couleur dans la liste.', 'scan_color');
        END IF;
    END IF;
    IF v_patch ? 'entry_instruction' THEN
        IF jsonb_typeof(v_patch->'entry_instruction') = 'null' THEN
            n_instr := NULL;
        ELSIF jsonb_typeof(v_patch->'entry_instruction') = 'string' THEN
            -- Contre-vérification 2b (2c) : caractères de contrôle et contrôles bidirectionnels refusés (texte reçu)
            IF (v_patch->>'entry_instruction') ~ '[\u0001-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]' THEN
                RETURN public.event_edit_refusal('INVALID_INPUT', 'La consigne d’entrée contient un caractère invisible ou de contrôle : retirez-le.', 'entry_instruction');
            END IF;
            n_instr := NULLIF(btrim(regexp_replace(v_patch->>'entry_instruction', '\s+', ' ', 'g')), '');
            IF char_length(n_instr) > 60 THEN
                RETURN public.event_edit_refusal('INVALID_INPUT', 'La consigne d’entrée ne dépasse pas 60 caractères.', 'entry_instruction');
            END IF;
        ELSE
            RETURN public.event_edit_refusal('INVALID_INPUT', 'La consigne d’entrée ne dépasse pas 60 caractères.', 'entry_instruction');
        END IF;
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
        -- Lot 11c-a : jauge en places (une table compte ses places)
        SELECT COALESCE(sum(o.total_quantity * o.seats_per_unit), 0)::int INTO v_sum
          FROM public.ticket_categories o WHERE o.event_id = v_event AND o.is_active AND o.id <> c.id;
        IF v_sum + n_total > v_capacity THEN
            RETURN public.event_edit_refusal('QUOTA_ABOVE_CAPACITY',
                format('Les quantités mises en vente des catégories actives totaliseraient %s places. Augmentez d’abord la capacité totale de l’événement (actuellement %s).',
                       v_sum + n_total, v_capacity),
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
    -- Lot 9 bis (R94) : un début de vente modifié précède la fin de l'événement
    IF v_patch ? 'sale_start' AND n_start IS NOT NULL AND n_start >= public.event_end_at(v_event) THEN
        RETURN public.event_edit_refusal('SALE_START_AFTER_EVENT', 'Le début de vente doit précéder la fin de l’événement.', 'sale_start');
    END IF;

    UPDATE public.ticket_categories
       SET name = n_name, description = n_desc, price = n_price, total_quantity = n_total, max_per_order = n_max,
           sale_start = n_start, sale_end = n_end, sale_online = n_online, sale_counter = n_counter, is_active = n_active,
           scan_color = n_color, entry_instruction = n_instr, updated_at = now()
     WHERE id = c.id;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'CATEGORY_UPDATED', 'TICKET_CATEGORY', c.id,
            jsonb_build_object('event_id', v_event,
                               'fields', (SELECT COALESCE(jsonb_agg(k ORDER BY k), '[]'::jsonb) FROM jsonb_object_keys(v_patch) AS k),
                               'old', jsonb_build_object('price', c.price, 'total_quantity', c.total_quantity, 'is_active', c.is_active, 'is_visible', c.is_visible, 'sale_online', c.sale_online, 'sale_counter', c.sale_counter),
                               'new', jsonb_build_object('price', n_price, 'total_quantity', n_total, 'is_active', n_active, 'is_visible', n_online, 'sale_online', n_online, 'sale_counter', n_counter)));

    SELECT to_jsonb(x) INTO v_row FROM public.ticket_categories x WHERE x.id = c.id;
    RETURN jsonb_build_object('ok', true, 'category', v_row);
END;
$$;

-- Recopie de 20261121000005_cvf2b_avis_en_cours_envoi.sql:324-821
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
    v_refusal jsonb;
    -- Correctifs de la contre-vérification (T3, T4) : avis de lieu
    v_ann_lat double precision;
    v_ann_lng double precision;
    v_last_sent timestamptz;
    v_held_before text[];
    v_moved boolean := false;
    v_place text[];
    v_held text[] := ARRAY[]::text[];
    v_notify jsonb;
    v_place_at timestamptz;
    -- Finition 2b (D) : cadence des avis de lieu et de date ; heure réelle et nombre de SMS de l'avis
    v_hold_until timestamptz;
    v_notice_at timestamptz;
    v_notice_held boolean := false;
    v_notice_recipients integer := 0;
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
    -- Correctifs de la contre-vérification (T3, T4) : position annoncée, départ du dernier avis de lieu et retenue de
    -- l'événement, verrouillés jusqu'à la fin de la modification (l'envoyeur les met à jour au départ d'un avis)
    IF v_post THEN
        INSERT INTO public.event_place_notices (event_id) VALUES (v_event) ON CONFLICT (event_id) DO NOTHING;
        SELECT pn.announced_latitude, pn.announced_longitude, pn.last_sent_at, pn.held_fields
          INTO v_ann_lat, v_ann_lng, v_last_sent, v_held_before
          FROM public.event_place_notices pn
         WHERE pn.event_id = v_event
           FOR UPDATE;
        -- Contre-vérification 2b (4d) : un SMS d'avis en cours d'envoi (réservé par l'envoyeur, SENDING, marqué SENT
        -- seulement en fin de lot) compte comme parti à son heure de réservation
        v_last_sent := GREATEST(v_last_sent,
                                (SELECT max(o.claimed_at) FROM public.notification_outbox o
                                  WHERE o.event_id = v_event AND o.type = 'EVENT_CHANGED' AND o.channel = 'SMS'
                                    AND o.status = 'SENDING'));
        -- Aucune position annoncée (événement validé sans repère) : le repère actuel en tient lieu
        IF v_ann_lat IS NULL OR v_ann_lng IS NULL THEN
            v_ann_lat := e.latitude;
            v_ann_lng := e.longitude;
        END IF;
    END IF;

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
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez un type d''événement dans la liste.', 'category');
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
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez un type d''événement dans la liste.', 'category');
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
    -- Finition 2a (3) : position du lieu. Latitude et longitude voyagent ensemble, au Sénégal ; une fois l'événement
    -- validé, le repère se déplace mais ne se retire plus. Un événement ancien sans position reste modifiable tant que la
    -- modification ne touche pas la position.
    IF (v_patch ? 'latitude') <> (v_patch ? 'longitude') THEN
        RETURN public.event_edit_refusal('POSITION_INCOMPLETE', 'La position du lieu est incomplète : touchez la carte pour placer le repère.',
                                         CASE WHEN v_patch ? 'latitude' THEN 'longitude' ELSE 'latitude' END);
    END IF;
    IF v_patch ? 'latitude' THEN
        v_refusal := public.event_position_refusal(n_lat, n_lng);
        IF v_refusal IS NOT NULL THEN
            RETURN v_refusal;
        END IF;
        IF v_post AND n_lat IS NULL AND e.latitude IS NOT NULL THEN
            RETURN public.event_edit_refusal('POSITION_REQUIRED', 'Le repère du lieu ne peut plus être retiré après la validation : déplacez-le si le lieu change.', 'latitude');
        END IF;
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
        -- Lot 11c-a : la capacité compte les places des tables ; obligatoire dès qu'un type de table existe
        IF n_capacity IS NULL AND EXISTS (SELECT 1 FROM public.ticket_categories c WHERE c.event_id = v_event AND c.kind = 'TABLE') THEN
            RETURN public.event_edit_refusal('CAPACITY_REQUIRED', 'La capacité totale ne peut pas être retirée : l’événement vend des tables.', 'capacity');
        END IF;
        -- Lot 11c-a : vendus, réservés et quotas comptés en places (une table compte ses places)
        SELECT COALESCE(sum((c.sold_quantity + c.held_quantity) * c.seats_per_unit), 0)::int,
               COALESCE(sum(c.total_quantity * c.seats_per_unit) FILTER (WHERE c.is_active), 0)::int
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
        -- Finition 2a (3), correctifs de la contre-vérification (T3) : repère à plus de 200 m de la DERNIÈRE POSITION
        -- ANNONCÉE (et non du repère précédent : des petits pas ne contournent plus l'avis) = changement de lieu (mêmes
        -- avis aux détenteurs, mêmes règles d'envoi) ; en deçà, personne n'est prévenu
        v_moved := n_lat IS DISTINCT FROM e.latitude OR n_lng IS DISTINCT FROM e.longitude;
        IF v_moved AND v_ann_lat IS NOT NULL AND v_ann_lng IS NOT NULL AND n_lat IS NOT NULL AND n_lng IS NOT NULL
           AND public.geo_distance_m(v_ann_lat, v_ann_lng, n_lat, n_lng) > 200 THEN
            v_changed := array_append(v_changed, 'position');
            IF NOT ('le lieu' = ANY (v_labels)) THEN
                v_labels := array_append(v_labels, 'le lieu');
            END IF;
        END IF;
        -- Correctifs de la contre-vérification (T4) : repère revenu à moins de 200 m de la position annoncée → l'avis de
        -- lieu encore en attente (et la retenue) perd « position » ; une ligne qui n'a plus rien à dire est annulée
        IF v_moved AND v_ann_lat IS NOT NULL AND v_ann_lng IS NOT NULL AND n_lat IS NOT NULL AND n_lng IS NOT NULL
           AND public.geo_distance_m(v_ann_lat, v_ann_lng, n_lat, n_lng) <= 200 THEN
            PERFORM public.event_place_notice_revert(v_event);
            v_held_before := array_remove(v_held_before, 'position');
        END IF;
        -- Finition 2b (D, E-28) : cadence des avis par SMS de lieu ET de date : au plus un par détenteur et par événement par
        -- heure glissante (départ du dernier avis : event_place_notices.last_sent_at, posé par tout SMS EVENT_CHANGED de
        -- lieu ou de date). Un avis parti il y a moins d'une heure et aucun SMS en attente : les champs de lieu et de date
        -- sont retenus et partent ensemble à l'heure dite (event_place_notices_release, appelée par l'envoyeur) ; le titre
        -- part comme avant. À moins d'une heure du début (ancien ou nouveau) : jamais retenu, l'avis part tout de suite
        -- (event_change_notify plafonne alors à 2 SMS par détenteur depuis le début moins une heure). Une retenue dont
        -- l'heure est passée (pas encore libérée) est jointe à cet avis.
        -- Contre-vérification 2b (4d) : le départ du dernier avis compte les SMS en cours d'envoi (ci-dessus), et un avis
        -- parti ou en cours d'envoi depuis moins d'une heure retient même si d'autres SMS d'avis sont encore en attente
        -- (lot partiellement envoyé : les fusionner renvoyait un SMS 10 minutes après aux détenteurs déjà servis)
        v_urgent := v_old_start < now() + interval '1 hour' OR v_new_start < now() + interval '1 hour';
        v_place := ARRAY(SELECT f FROM unnest(v_changed) AS f
                          WHERE f IN ('location', 'city', 'address', 'position', 'start_date', 'start_time', 'end_date', 'end_time'));
        IF cardinality(v_place) > 0 THEN
            IF NOT v_urgent AND v_last_sent IS NOT NULL AND v_last_sent > now() - interval '1 hour' THEN
                v_held := v_place;
                v_changed := ARRAY(SELECT f FROM unnest(v_changed) AS f WHERE NOT f = ANY (v_place));
                -- Une retenue n'est jamais raccourcie (repoussée au départ d'un SMS réservé plus tôt : notif_place_notice_sent)
                UPDATE public.event_place_notices
                   SET held_fields = ARRAY(SELECT DISTINCT f FROM unnest(held_fields || v_place) AS f ORDER BY f),
                       held_until = GREATEST(held_until, v_last_sent + interval '1 hour'), updated_at = now()
                 WHERE event_id = v_event
                RETURNING held_until INTO v_hold_until;
                IF v_place && ARRAY['location', 'city', 'address', 'position']::text[] THEN
                    v_place_at := v_hold_until;
                END IF;
            ELSIF cardinality(COALESCE(v_held_before, ARRAY[]::text[])) > 0 THEN
                -- Retenue encore là (heure passée, pas encore libérée, ou début à moins d'une heure) : jointe à cet avis
                v_changed := v_changed || ARRAY(SELECT f FROM unnest(v_held_before) AS f WHERE NOT f = ANY (v_changed));
                UPDATE public.event_place_notices SET held_fields = '{}'::text[], held_until = NULL, updated_at = now()
                 WHERE event_id = v_event;
            END IF;
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

    -- Porteurs, numéros sans compte et contrôleurs prévenus : event_change_notify (correctifs de la contre-vérification,
    -- T3 et T4 : bloc déplacé de cette fonction, inchangé hormis l'avis de lieu regroupé dans l'application et en push)
    IF cardinality(v_changed) > 0 THEN
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
                                         AND NULLIF(btrim(COALESCE(n_practical->>'address', '')), '') IS NULL THEN true END,
            -- T3 : repère de cet avis ; il devient la position annoncée au départ du SMS
            'new_position', CASE WHEN 'position' = ANY (v_changed) THEN jsonb_build_object('latitude', n_lat, 'longitude', n_lng) END));
        -- Lot 9 bis (R80) : à la fusion, une adresse changée de nouveau remplace l'ancienne (posée ou retirée)
        v_drop := ARRAY['migrated_from']
                  || CASE WHEN 'address' = ANY (v_changed) THEN ARRAY['new_address', 'address_cleared'] ELSE ARRAY[]::text[] END;
        -- Lot 9 bis (B71) : SMS dû dans 10 minutes, tout de suite si l'ancien ou le nouveau début est à moins d'une heure
        v_urgent := v_old_start < now() + interval '1 hour' OR v_new_start < now() + interval '1 hour';
        v_due := CASE WHEN v_urgent THEN now() ELSE now() + interval '10 minutes' END;
        -- T4 : avis qui touche au lieu, regroupé : il part (application, push, SMS) à l'échéance de la fenêtre
        IF v_changed && ARRAY['location', 'city', 'address', 'position']::text[] THEN
            v_place_at := v_due;
        END IF;
        v_notify := public.event_change_notify(jsonb_build_object(
            'event_id', v_event, 'changed', to_jsonb(v_changed), 'data', v_data, 'drop', to_jsonb(v_drop),
            'urgent', v_urgent, 'due', v_due, 'key_suffix', 'v' || v_version::text,
            -- Finition 2b (D) : plafond de 2 SMS par détenteur dans la dernière heure avant le début
            'last_hour_from', CASE WHEN v_urgent THEN LEAST(v_old_start, v_new_start) - interval '1 hour' END,
            'multi_day', n_end_date IS NOT NULL AND n_end_date > n_start_date));
        v_notified := COALESCE((v_notify->>'notified_holders')::integer, 0);
        v_phones := COALESCE((v_notify->>'notified_phones')::integer, 0);
        v_sms_queued := COALESCE((v_notify->>'sms_queued')::integer, 0);
        -- Heure réelle de l'avis de lieu : celle de la fenêtre déjà ouverte s'il a été regroupé dans un avis en attente
        IF v_place_at IS NOT NULL THEN
            SELECT COALESCE(min(o.due_at), v_place_at) INTO v_place_at
              FROM public.notification_outbox o
             WHERE o.event_id = v_event AND o.type = 'EVENT_CHANGED' AND o.status = 'PENDING'
               AND o.template_data->'changed_fields' ?| ARRAY['location', 'city', 'address', 'position'];
        END IF;
    END IF;

    -- Finition 2b (D, E-28) : heure réelle de l'avis par SMS (fenêtre en cours, retenue d'une heure, ou tout de suite) et
    -- nombre de SMS (fenêtre « Prévenir » et bilan de l'enregistrement)
    IF cardinality(v_held) > 0 THEN
        v_notice_held := true;
        v_notice_at := v_hold_until;
        v_notice_recipients := public.event_notice_recipient_count(v_event, n_end_date IS NOT NULL AND n_end_date > n_start_date);
    ELSIF v_sms THEN
        SELECT min(o.due_at) INTO v_notice_at
          FROM public.notification_outbox o
         WHERE o.event_id = v_event AND o.type = 'EVENT_CHANGED' AND o.channel = 'SMS' AND o.status = 'PENDING';
        v_notice_recipients := v_sms_queued;
    END IF;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', CASE WHEN v_post THEN 'EVENT_LIVE_UPDATED' ELSE 'EVENT_UPDATED' END, 'EVENT', v_event,
            jsonb_build_object('status', e.status::text,
                               'fields', (SELECT COALESCE(jsonb_agg(k ORDER BY k), '[]'::jsonb) FROM jsonb_object_keys(v_patch) AS k),
                               'notified_fields', to_jsonb(v_changed), 'notified_holders', v_notified, 'notified_phones', v_phones,
                               'sms_queued', v_sms_queued, 'end_moved_later', v_new_end > v_old_end,
                               -- T4 : champs de lieu retenus par la cadence d'une heure (partent avec l'avis suivant)
                               'place_held', to_jsonb(v_held)));

    SELECT to_jsonb(ev) INTO v_row FROM public.events ev WHERE ev.id = v_event;
    RETURN jsonb_build_object('ok', true, 'event', v_row, 'notified_holders', v_notified, 'notified_phones', v_phones,
                              'sms_queued', v_sms_queued, 'changed_fields', to_jsonb(v_changed),
                              -- T4 : heure de l'avis de lieu (fenêtre de 10 minutes, ou fin de la retenue d'une heure)
                              'place_notice_at', v_place_at,
                              'place_notice_held', v_held && ARRAY['location', 'city', 'address', 'position']::text[],
                              -- Finition 2b (D) : avis par SMS (lieu ou date) : heure réelle, tout de suite, retenu, nombre de SMS
                              'sms_notice_at', v_notice_at,
                              'sms_notice_immediate', v_notice_at IS NOT NULL AND v_notice_at <= now(),
                              'sms_notice_held', v_notice_held,
                              'sms_recipients', v_notice_recipients);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Signalement aux administrateurs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_event_tables_admin_alert()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event   uuid;
    v_status  text;
    v_company text;
    v_row     jsonb;
BEGIN
    -- Lecture par jsonb : event_tables n'a pas de colonne kind (un champ absent d'un enregistrement lève une erreur)
    v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
    v_event := public.try_uuid(v_row->>'event_id');
    IF TG_TABLE_NAME = 'ticket_categories' AND COALESCE(v_row->>'kind', '') <> 'TABLE' THEN
        RETURN NULL;
    END IF;
    SELECT e.status::text, pa.company_name INTO v_status, v_company
      FROM public.events e LEFT JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = v_event;
    IF v_status IS NULL OR v_status NOT IN ('VALIDE', 'PUBLIE', 'SUSPENDU') THEN
        RETURN NULL;
    END IF;
    PERFORM public.notif_enqueue_admins(jsonb_build_object(
        'type', 'ADMIN_EVENT_TABLES_CHANGED', 'ref', v_event::text || ':tx' || txid_current()::text, 'event_id', v_event,
        'data', COALESCE(public.notif_event_data(v_event), '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('company', v_company))));
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.notif_event_tables_admin_alert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_event_tables_admin_alert ON public.event_tables;
CREATE TRIGGER trg_event_tables_admin_alert
    AFTER INSERT OR DELETE OR UPDATE OF number, category_id ON public.event_tables
    FOR EACH ROW EXECUTE FUNCTION public.notif_event_tables_admin_alert();
DROP TRIGGER IF EXISTS trg_ticket_categories_tables_admin_alert ON public.ticket_categories;
CREATE TRIGGER trg_ticket_categories_tables_admin_alert
    AFTER INSERT OR DELETE OR UPDATE OF name, price, seats_per_unit, included_text, onsite_note, payment_mode, is_active, sale_start, sale_end
    ON public.ticket_categories
    FOR EACH ROW EXECUTE FUNCTION public.notif_event_tables_admin_alert();

-- Alertes des catégories de billets (lot 9 bis, lot 9 ter) : plus pour un type de table (signalé ci-dessus)
DROP TRIGGER IF EXISTS trg_ticket_categories_admin_alert ON public.ticket_categories;
CREATE TRIGGER trg_ticket_categories_admin_alert
    AFTER INSERT ON public.ticket_categories
    FOR EACH ROW
    WHEN (NEW.kind = 'TICKET')
    EXECUTE FUNCTION public.notif_ticket_categories_admin_alert();
DROP TRIGGER IF EXISTS trg_ticket_categories_admin_update_alert ON public.ticket_categories;
CREATE TRIGGER trg_ticket_categories_admin_update_alert
    AFTER UPDATE OF price, sale_online, sale_counter ON public.ticket_categories
    FOR EACH ROW
    WHEN (NEW.kind = 'TICKET' AND (OLD.price IS DISTINCT FROM NEW.price OR OLD.sale_online IS DISTINCT FROM NEW.sale_online OR OLD.sale_counter IS DISTINCT FROM NEW.sale_counter))
    EXECUTE FUNCTION public.notif_ticket_categories_admin_update_alert();

-- ----------------------------------------------------------------------------
-- Droits
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION private.event_table_refusal(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.event_seats_refusal(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.event_table_text_ok(text, integer, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.event_table_type_save(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_type_save(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_table_type_delete(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_type_delete(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_tables_save(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_tables_save(jsonb) TO service_role;
