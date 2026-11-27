-- ============================================================================
-- EVENT VILLAGE — LOT 12c, migration 02 : zones de livraison et suppléments, écrits par la partenaire
-- ============================================================================
-- État des lieux du 26/11 (§ 3.3) : aucune route ni fonction n'écrivait order_delivery_zones ni product_options (les
-- tests les écrivaient avec le rôle de service). Décisions du client (26/11) : zones en liste de quartiers (nom, frais,
-- minimum), ordre choisi par la partenaire.
--  1. order_delivery_zone_set(p) : création ou modification d'une zone d'un établissement de la partenaire (compte
--     actif, fiche VALIDE), nom de 2 à 80 caractères, frais entiers de 0 à 100 000 F CFA, minimum entier de 0 à
--     10 000 000 F CFA, 50 zones au plus par établissement ; le prix d'une commande déjà passée ne change jamais (frais
--     figés sur la commande) ;
--  2. order_delivery_zone_remove(p) : zone jamais utilisée supprimée ; zone d'une commande ouverte désactivée (elle ne
--     s'efface pas) ; zone d'une commande terminée archivée (inactive, cachée : la clé étrangère garde l'historique) ;
--  3. order_delivery_zones_reorder(p) : ordre des zones d'un établissement (glisser-déposer de l'écran) ;
--  4. product_option_set(p) / product_option_remove(p) : supplément d'un produit de la partenaire (nom de 1 à 80
--     caractères, prix entier de 0 à 1 000 000 F CFA, 20 au plus par produit) ; le prix figé des lignes de commande ne
--     change jamais (copie dans order_items.options) ; un nom de supplément avec un mot de orders.review_keywords met le
--     produit « à vérifier » (même règle que le nom du produit : un supplément « bière » ne contourne pas la vérification).
-- Toutes au rôle de service seulement. Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- ============================================================================

-- Établissement de la partenaire du compte, ou refus
CREATE OR REPLACE FUNCTION private.order_zone_venue(p_actor uuid, p_venue uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner jsonb := private.order_catalog_owner(p_actor);
BEGIN
    IF NOT (v_owner->>'ok')::boolean THEN
        RETURN v_owner;
    END IF;
    IF p_venue IS NULL OR NOT EXISTS (SELECT 1 FROM public.venues ve WHERE ve.id = p_venue AND ve.partner_id = (v_owner->>'partner_id')::uuid) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_FOUND', 'message', 'Cet établissement n’existe pas ou n’est pas le vôtre.');
    END IF;
    RETURN v_owner;
END;
$$;

-- p : actor_id, venue_id, zone_id (vide = création), name, fee, min_order, is_active, sort_order
CREATE OR REPLACE FUNCTION public.order_delivery_zone_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_venue  uuid := public.try_uuid(p->>'venue_id');
    v_zone   uuid := public.try_uuid(NULLIF(p->>'zone_id', ''));
    v_check  jsonb;
    z        public.order_delivery_zones%ROWTYPE;
    v_row    public.order_delivery_zones%ROWTYPE;
    v_name   text;
    v_fee    numeric;
    v_min    numeric;
    v_active boolean;
    v_sort   integer;
BEGIN
    v_check := private.order_zone_venue(v_actor, v_venue);
    IF NOT (v_check->>'ok')::boolean THEN
        RETURN v_check;
    END IF;
    IF v_zone IS NOT NULL OR NULLIF(p->>'zone_id', '') IS NOT NULL THEN
        SELECT * INTO z FROM public.order_delivery_zones WHERE id = v_zone AND venue_id = v_venue AND archived_at IS NULL FOR UPDATE;
        IF v_zone IS NULL OR NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'ZONE_NOT_FOUND', 'message', 'Cette zone n’existe pas dans cet établissement.');
        END IF;
    END IF;
    BEGIN
        v_name := CASE WHEN p ? 'name' THEN NULLIF(btrim(regexp_replace(COALESCE(p->>'name', ''), '[[:cntrl:]]', ' ', 'g')), '') ELSE z.name END;
        v_fee := CASE WHEN p ? 'fee' THEN (p->>'fee')::numeric ELSE COALESCE(z.fee, 0) END;
        v_min := CASE WHEN p ? 'min_order' THEN (p->>'min_order')::numeric ELSE COALESCE(z.min_order, 0) END;
        v_active := CASE WHEN jsonb_typeof(p->'is_active') = 'boolean' THEN (p->>'is_active')::boolean ELSE COALESCE(z.is_active, TRUE) END;
        v_sort := CASE WHEN p ? 'sort_order' THEN (p->>'sort_order')::integer ELSE z.sort_order END;
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ZONE', 'message', 'Une valeur de la zone n’est pas valable.');
    END;
    IF v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 80 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ZONE', 'message', 'Le nom de la zone compte de 2 à 80 caractères (par exemple « Almadies »).');
    END IF;
    IF v_fee IS NULL OR v_fee <> trunc(v_fee) OR v_fee < 0 OR v_fee > 100000 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FEE', 'message', 'Les frais de livraison sont un nombre entier de F CFA, de 0 à 100 000.');
    END IF;
    IF v_min IS NULL OR v_min <> trunc(v_min) OR v_min < 0 OR v_min > 10000000 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MINIMUM', 'message', 'Le minimum de commande est un nombre entier de F CFA, de 0 à 10 000 000.');
    END IF;
    IF v_sort IS NOT NULL AND v_sort NOT BETWEEN 0 AND 1000 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ZONE', 'message', 'Une valeur de la zone n’est pas valable.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.order_delivery_zones x WHERE x.venue_id = v_venue AND x.archived_at IS NULL
                AND lower(btrim(x.name)) = lower(v_name) AND x.id IS DISTINCT FROM z.id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ZONE_EXISTS', 'message', 'Une zone porte déjà ce nom dans cet établissement.');
    END IF;
    IF z.id IS NULL THEN
        IF (SELECT count(*) FROM public.order_delivery_zones x WHERE x.venue_id = v_venue AND x.archived_at IS NULL) >= 50 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_ZONES', 'message', '50 zones au plus par établissement.');
        END IF;
        INSERT INTO public.order_delivery_zones (venue_id, name, fee, min_order, is_active, sort_order)
        VALUES (v_venue, v_name, v_fee, v_min, v_active,
                COALESCE(v_sort, (SELECT COALESCE(max(x.sort_order) + 1, 0) FROM public.order_delivery_zones x WHERE x.venue_id = v_venue AND x.archived_at IS NULL)))
        RETURNING * INTO v_row;
    ELSE
        UPDATE public.order_delivery_zones
           SET name = v_name, fee = v_fee, min_order = v_min, is_active = v_active, sort_order = COALESCE(v_sort, sort_order), updated_at = now()
         WHERE id = z.id
        RETURNING * INTO v_row;
    END IF;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (v_actor, 'PARTENAIRE', CASE WHEN z.id IS NULL THEN 'ORDER_ZONE_CREATED' ELSE 'ORDER_ZONE_UPDATED' END, 'order_delivery_zones', v_row.id,
            CASE WHEN z.id IS NOT NULL THEN jsonb_build_object('name', z.name, 'fee', z.fee, 'min_order', z.min_order, 'is_active', z.is_active) END,
            jsonb_build_object('name', v_row.name, 'fee', v_row.fee, 'min_order', v_row.min_order, 'is_active', v_row.is_active, 'venue_id', v_venue));
    RETURN jsonb_build_object('ok', true, 'zone', jsonb_build_object(
        'id', v_row.id, 'venue_id', v_row.venue_id, 'name', v_row.name, 'fee', v_row.fee, 'min_order', v_row.min_order,
        'is_active', v_row.is_active, 'sort_order', v_row.sort_order));
END;
$$;

-- p : actor_id, zone_id
CREATE OR REPLACE FUNCTION public.order_delivery_zone_remove(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_zone  uuid := public.try_uuid(p->>'zone_id');
    v_owner jsonb;
    z       record;
BEGIN
    v_owner := private.order_catalog_owner(v_actor);
    IF NOT (v_owner->>'ok')::boolean THEN
        RETURN v_owner;
    END IF;
    SELECT x.* INTO z FROM public.order_delivery_zones x JOIN public.venues ve ON ve.id = x.venue_id
     WHERE x.id = v_zone AND ve.partner_id = (v_owner->>'partner_id')::uuid AND x.archived_at IS NULL
       FOR UPDATE OF x;
    IF v_zone IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ZONE_NOT_FOUND', 'message', 'Cette zone n’existe pas dans vos établissements.');
    END IF;
    -- Même verrou que les commandes de l'établissement : aucune commande ne la prend pendant qu'on la retire
    PERFORM public.order_venue_lock(z.venue_id);
    IF EXISTS (SELECT 1 FROM public.orders o WHERE o.zone_id = z.id AND o.closed_at IS NULL) THEN
        UPDATE public.order_delivery_zones SET is_active = FALSE, updated_at = now() WHERE id = z.id;
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
        VALUES (v_actor, 'PARTENAIRE', 'ORDER_ZONE_DEACTIVATED', 'order_delivery_zones', z.id,
                jsonb_build_object('is_active', z.is_active), jsonb_build_object('is_active', false));
        RETURN jsonb_build_object('ok', true, 'zone_id', z.id, 'outcome', 'DEACTIVATED',
            'message', 'Cette zone sert à une commande en cours : elle est désactivée (plus proposée aux clients) et pourra être retirée ensuite.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.orders o WHERE o.zone_id = z.id) THEN
        UPDATE public.order_delivery_zones SET is_active = FALSE, archived_at = now(), updated_at = now() WHERE id = z.id;
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value)
        VALUES (v_actor, 'PARTENAIRE', 'ORDER_ZONE_ARCHIVED', 'order_delivery_zones', z.id, jsonb_build_object('name', z.name, 'fee', z.fee));
        RETURN jsonb_build_object('ok', true, 'zone_id', z.id, 'outcome', 'ARCHIVED', 'message', 'Zone retirée.');
    END IF;
    DELETE FROM public.order_delivery_zones WHERE id = z.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value)
    VALUES (v_actor, 'PARTENAIRE', 'ORDER_ZONE_DELETED', 'order_delivery_zones', z.id, jsonb_build_object('name', z.name, 'fee', z.fee));
    RETURN jsonb_build_object('ok', true, 'zone_id', z.id, 'outcome', 'DELETED', 'message', 'Zone retirée.');
END;
$$;

-- p : actor_id, venue_id, zone_ids (toutes les zones visibles de l'établissement, dans le nouvel ordre)
CREATE OR REPLACE FUNCTION public.order_delivery_zones_reorder(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_venue uuid := public.try_uuid(p->>'venue_id');
    v_check jsonb;
    v_ids   uuid[];
BEGIN
    v_check := private.order_zone_venue(v_actor, v_venue);
    IF NOT (v_check->>'ok')::boolean THEN
        RETURN v_check;
    END IF;
    BEGIN
        v_ids := CASE WHEN jsonb_typeof(p->'zone_ids') = 'array' THEN ARRAY(SELECT (x)::uuid FROM jsonb_array_elements_text(p->'zone_ids') x) END;
    EXCEPTION WHEN others THEN
        v_ids := NULL;
    END;
    IF v_ids IS NULL OR cardinality(v_ids) <> (SELECT count(DISTINCT x) FROM unnest(v_ids) x)
       OR cardinality(v_ids) <> (SELECT count(*) FROM public.order_delivery_zones z WHERE z.venue_id = v_venue AND z.archived_at IS NULL)
       OR EXISTS (SELECT 1 FROM unnest(v_ids) x WHERE NOT EXISTS (
                SELECT 1 FROM public.order_delivery_zones z WHERE z.id = x AND z.venue_id = v_venue AND z.archived_at IS NULL)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ORDER', 'message', 'L’ordre des zones n’est pas à jour : rechargez la page.');
    END IF;
    UPDATE public.order_delivery_zones z
       SET sort_order = x.ord - 1, updated_at = now()
      FROM unnest(v_ids) WITH ORDINALITY AS x(id, ord)
     WHERE z.id = x.id AND z.sort_order IS DISTINCT FROM x.ord - 1;
    RETURN jsonb_build_object('ok', true, 'venue_id', v_venue, 'zone_ids', to_jsonb(v_ids));
END;
$$;

-- p : actor_id, product_id, option_id (vide = création), name, price, is_active, sort_order
CREATE OR REPLACE FUNCTION public.product_option_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_product uuid := public.try_uuid(p->>'product_id');
    v_option  uuid := public.try_uuid(NULLIF(p->>'option_id', ''));
    v_owner   jsonb;
    pr        record;
    o         public.product_options%ROWTYPE;
    v_row     public.product_options%ROWTYPE;
    v_name    text;
    v_price   numeric;
    v_active  boolean;
    v_sort    integer;
    v_words   text[];
    v_review  boolean := FALSE;
BEGIN
    v_owner := private.order_catalog_owner(v_actor);
    IF NOT (v_owner->>'ok')::boolean THEN
        RETURN v_owner;
    END IF;
    SELECT * INTO pr FROM public.products WHERE id = v_product AND partner_id = (v_owner->>'partner_id')::uuid FOR UPDATE;
    IF v_product IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_NOT_FOUND', 'message', 'Ce produit n’existe pas ou n’est pas le vôtre.');
    END IF;
    IF pr.archived_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_ARCHIVED', 'message', 'Ce produit est archivé : il ne se modifie plus.');
    END IF;
    IF v_option IS NOT NULL OR NULLIF(p->>'option_id', '') IS NOT NULL THEN
        SELECT * INTO o FROM public.product_options WHERE id = v_option AND product_id = pr.id FOR UPDATE;
        IF v_option IS NULL OR NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'OPTION_NOT_FOUND', 'message', 'Ce supplément n’existe pas pour ce produit.');
        END IF;
    END IF;
    BEGIN
        v_name := CASE WHEN p ? 'name' THEN NULLIF(btrim(regexp_replace(COALESCE(p->>'name', ''), '[[:cntrl:]]', ' ', 'g')), '') ELSE o.name END;
        v_price := CASE WHEN p ? 'price' THEN (p->>'price')::numeric ELSE COALESCE(o.price_delta, 0) END;
        v_active := CASE WHEN jsonb_typeof(p->'is_active') = 'boolean' THEN (p->>'is_active')::boolean ELSE COALESCE(o.is_active, TRUE) END;
        v_sort := CASE WHEN p ? 'sort_order' THEN (p->>'sort_order')::integer ELSE o.sort_order END;
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_OPTION', 'message', 'Une valeur du supplément n’est pas valable.');
    END;
    IF v_name IS NULL OR length(v_name) > 80 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_OPTION', 'message', 'Le nom du supplément compte de 1 à 80 caractères.');
    END IF;
    IF v_price IS NULL OR v_price <> trunc(v_price) OR v_price < 0 OR v_price > 1000000 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_OPTION_PRICE', 'message', 'Le prix du supplément est un nombre entier de F CFA, de 0 à 1 000 000.');
    END IF;
    IF v_sort IS NOT NULL AND v_sort NOT BETWEEN 0 AND 1000 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_OPTION', 'message', 'Une valeur du supplément n’est pas valable.');
    END IF;
    IF o.id IS NULL AND (SELECT count(*) FROM public.product_options x WHERE x.product_id = pr.id) >= 20 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_OPTIONS', 'message', '20 suppléments au plus par produit.');
    END IF;
    IF o.id IS NULL THEN
        INSERT INTO public.product_options (product_id, name, price_delta, is_active, sort_order)
        VALUES (pr.id, v_name, v_price, v_active,
                COALESCE(v_sort, (SELECT COALESCE(max(x.sort_order) + 1, 0) FROM public.product_options x WHERE x.product_id = pr.id)))
        RETURNING * INTO v_row;
    ELSE
        UPDATE public.product_options
           SET name = v_name, price_delta = v_price, is_active = v_active, sort_order = COALESCE(v_sort, sort_order), updated_at = now()
         WHERE id = o.id
        RETURNING * INTO v_row;
    END IF;
    -- Un supplément au nom d'un mot de la liste met le produit « à vérifier » (jamais effacé ici). Contre-vérification :
    -- même règle de pliage que le reste (order_review_words), sur le nom du supplément
    IF o.id IS NULL OR v_name IS DISTINCT FROM o.name THEN
        v_words := private.order_review_words(v_name);
        v_review := cardinality(v_words) > 0;
    END IF;
    -- Contre-vérification (T2) : un supplément ajouté ou renommé sur un produit encore « à vérifier » lui donne une
    -- nouvelle version (une décision prise sur la version affichée avant est refusée)
    IF NOT v_review AND pr.review_state = 'A_VERIFIER' AND (o.id IS NULL OR v_name IS DISTINCT FROM o.name) THEN
        v_review := TRUE;
        v_words := ARRAY[]::text[];
    END IF;
    IF v_review THEN
        PERFORM set_config('event_village.product_write', 'on', true);
        UPDATE public.products
           SET review_state = 'A_VERIFIER',
               review_words = ARRAY(SELECT DISTINCT w FROM unnest(COALESCE(review_words, ARRAY[]::text[]) || v_words) w ORDER BY 1),
               review_requested_at = clock_timestamp(), updated_at = now()
         WHERE id = pr.id;
        PERFORM set_config('event_village.product_write', 'off', true);
    END IF;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, 'PARTENAIRE', CASE WHEN o.id IS NULL THEN 'PRODUCT_OPTION_CREATED' ELSE 'PRODUCT_OPTION_UPDATED' END, 'product_options', v_row.id,
            CASE WHEN o.id IS NOT NULL THEN jsonb_build_object('name', o.name, 'price_delta', o.price_delta, 'is_active', o.is_active) END,
            jsonb_build_object('name', v_row.name, 'price_delta', v_row.price_delta, 'is_active', v_row.is_active),
            jsonb_strip_nulls(jsonb_build_object('product_id', pr.id, 'review_words', CASE WHEN v_review THEN to_jsonb(v_words) END)));
    IF v_review THEN
        PERFORM private.order_product_review_notify(pr.id);
    END IF;
    RETURN jsonb_build_object('ok', true, 'review_requested', v_review, 'option', jsonb_build_object(
        'id', v_row.id, 'product_id', v_row.product_id, 'name', v_row.name, 'price', v_row.price_delta,
        'is_active', v_row.is_active, 'sort_order', v_row.sort_order));
END;
$$;

-- p : actor_id, option_id ; la ligne de commande garde sa copie (nom et prix figés)
CREATE OR REPLACE FUNCTION public.product_option_remove(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_option uuid := public.try_uuid(p->>'option_id');
    v_owner  jsonb;
    o        record;
BEGIN
    v_owner := private.order_catalog_owner(v_actor);
    IF NOT (v_owner->>'ok')::boolean THEN
        RETURN v_owner;
    END IF;
    SELECT x.*, pr.archived_at AS product_archived INTO o
      FROM public.product_options x JOIN public.products pr ON pr.id = x.product_id
     WHERE x.id = v_option AND pr.partner_id = (v_owner->>'partner_id')::uuid
       FOR UPDATE OF x;
    IF v_option IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'OPTION_NOT_FOUND', 'message', 'Ce supplément n’existe pas pour vos produits.');
    END IF;
    IF o.product_archived IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_ARCHIVED', 'message', 'Ce produit est archivé : il ne se modifie plus.');
    END IF;
    DELETE FROM public.product_options WHERE id = o.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'PRODUCT_OPTION_DELETED', 'product_options', o.id,
            jsonb_build_object('name', o.name, 'price_delta', o.price_delta), jsonb_build_object('product_id', o.product_id));
    RETURN jsonb_build_object('ok', true, 'option_id', o.id);
END;
$$;

REVOKE ALL ON FUNCTION private.order_zone_venue(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.order_delivery_zone_set(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_delivery_zone_remove(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_delivery_zones_reorder(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_option_set(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_option_remove(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_delivery_zone_set(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_delivery_zone_remove(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_delivery_zones_reorder(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_option_set(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_option_remove(jsonb) TO service_role;
