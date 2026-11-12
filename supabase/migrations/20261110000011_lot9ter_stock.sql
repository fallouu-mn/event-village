-- ============================================================================
-- EVENT VILLAGE — LOT 9 TER : stock au public (contrat 3.1 n° 11, 3.4 F50 à F54, 5.D D.2.2)
-- ============================================================================
-- Rejouable : aucun BEGIN ni COMMIT ; ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS puis ADD (rien n'en dépend),
-- CREATE OR REPLACE (signature, volatilité et type de retour identiques), privilèges réappliqués ; la reprise finale
-- n'écrit une ligne que si sa valeur change (IS DISTINCT FROM dans les fonctions de synchronisation).
-- Ordre : DDL, fonctions, privilèges, puis reprise des données.
-- Tâches fusionnées, dans l'ordre de leurs commits (section 10) :
--  9t.19 (consigne 5, fix(9t.19)) — affichage du stock au public :
--   1. public_event_state.stock_level (AVAILABLE | LOW | SOLD_OUT | NULL) et public_event_state_stock_level_check :
--      tranche de l'événement sur ses catégories actives vendues en ligne, sans nombre de places. Lecture publique et
--      publication temps réel héritées de la table (20261102000006_lot5_temps_reel.sql:166-167, :563).
--   2. public_category_stock_sync (recopie F51, base 20261106000001_lot8_canaux.sql:1047-1111) : verrou du résumé
--      public de l'événement AVANT la lecture et l'écriture de la tranche (ED6 : le résumé avant toute tranche, sur
--      tous les chemins ; sans lui, un panier à deux catégories et la reprise du seuil pouvaient s'interbloquer).
--   3. public_event_state_sync (recopie F50, base 20261106000001_lot8_canaux.sql:1117-1180) : verrou du résumé en
--      première instruction (D-stk 3.4 : deux ventes simultanées de deux catégories ne laissent plus has_purchasable
--      vrai, la seconde attend la première et relit son état validé) ; min_price sur les seules catégories qui ont
--      encore des places ; stock_level calculé et écrit seulement s'il change.
--   4. low_stock_threshold_resync (recopie F52, base 20261102000006_lot5_temps_reel.sql:361-382) : recalcule, par
--      événement (ordre event_id), ses tranches (ordre category_id) puis son résumé ; trigger inchangé.
--   5. ticket_category_create (recopie F53, base 20261106000001_lot8_canaux.sql:835-890) et ticket_category_update
--      (recopie F54, base 20261109000008_lot9bis_cycle.sql:1835-1980) : texte du refus QUOTA_ABOVE_CAPACITY, qui dit
--      quoi faire (code, statut 409 et champ inchangés).
--   6. Reprise : par événement résumé (ordre event_id), ses tranches (ordre id) puis son résumé (X28, ED5).
--  9t.12 (consigne 0.8, R106 a, délégation fix(9t.12-SK) de S-E ; colonne de 20261110000007_lot9ter_evenements.sql) :
--   7. public_category_stock_sync et public_event_state_sync lisent events.ended_unpublished : un événement terminé
--      sans avoir été publié n'a ni tranche ni résumé public (ligne supprimée comme pour un statut non public, x7).
--  9t.15 (consigne 1, délégation fix(9t.15-SK) de S-Z ; colonnes de 20261110000009_lot9ter_zones.sql) :
--   8. ticket_category_create et ticket_category_update acceptent scan_color (une des 8 clés de la palette, ou null)
--      et entry_instruction (espaces ramenés à un seul, vide → null, 60 caractères au plus) ; refus INVALID_INPUT
--      avec le champ en cause. La création les lit à part (ticket_category_normalize refuse toute clé hors de sa
--      liste, rectification 10) et n'écrit jamais zone_categories (le trigger de 09 admet la catégorie, F34).
--      L'audit CATEGORY_CREATED porte la couleur, jamais la consigne ; CATEGORY_UPDATED est inchangé (fields).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- (1) DDL (9t.19) : public_event_state.stock_level
-- ----------------------------------------------------------------------------
ALTER TABLE public.public_event_state ADD COLUMN IF NOT EXISTS stock_level text;
ALTER TABLE public.public_event_state DROP CONSTRAINT IF EXISTS public_event_state_stock_level_check;
ALTER TABLE public.public_event_state ADD CONSTRAINT public_event_state_stock_level_check
    CHECK (stock_level IS NULL OR stock_level IN ('AVAILABLE', 'LOW', 'SOLD_OUT'));
COMMENT ON COLUMN public.public_event_state.stock_level IS
    'Lot 9 ter (consigne 5) : tranche de stock de l''événement sur ses catégories actives vendues en ligne (SOLD_OUT : plus aucune place ; LOW : toutes les catégories qui ont des places sont au seuil ou dessous ; AVAILABLE sinon ; NULL sans catégorie en ligne), sans les dates de vente. Aucun nombre de places.';


-- ============================================================================
-- (2) public_category_stock_sync (recopie F51 de 20261106000001_lot8_canaux.sql:1047-1111)
-- Changements : verrou du résumé public de l'événement avant toute lecture et écriture de la tranche (9t.19) ;
-- tranche supprimée pour un événement terminé sans publication (9t.12, ended_unpublished).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.public_category_stock_sync(p_category_id uuid, p_threshold integer DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid;
    v_total integer;
    v_sold integer;
    v_held integer;
    v_active boolean;
    v_online boolean;
    v_status text;
    v_unpublished boolean;
    v_threshold integer;
    v_remaining integer;
    v_availability text;
    v_hint integer;
BEGIN
    IF p_category_id IS NULL THEN RETURN; END IF;
    -- Lot 9 ter (9t.19, ED6) : le résumé de l'événement est verrouillé avant toute tranche de ses catégories.
    SELECT tc.event_id INTO v_event FROM public.ticket_categories tc WHERE tc.id = p_category_id;
    IF v_event IS NULL THEN
        SELECT s.event_id INTO v_event FROM public.public_category_stock s WHERE s.category_id = p_category_id;
    END IF;
    IF v_event IS NOT NULL THEN
        PERFORM 1 FROM public.public_event_state WHERE event_id = v_event FOR UPDATE;
    END IF;
    SELECT tc.event_id, tc.total_quantity, tc.sold_quantity, tc.held_quantity, tc.is_active, tc.sale_online, e.status::text,
           e.ended_unpublished
      INTO v_event, v_total, v_sold, v_held, v_active, v_online, v_status, v_unpublished
      FROM public.ticket_categories tc
      JOIN public.events e ON e.id = tc.event_id
     WHERE tc.id = p_category_id;
    IF NOT FOUND THEN
        DELETE FROM public.public_category_stock WHERE category_id = p_category_id;
        RETURN;
    END IF;
    -- Lot 9 ter (9t.12, R106 a) : un événement terminé sans publication n'est jamais public.
    IF NOT (COALESCE(v_active, FALSE) AND COALESCE(v_online, FALSE)
            AND v_status IN ('PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE') AND NOT COALESCE(v_unpublished, FALSE)) THEN
        DELETE FROM public.public_category_stock WHERE category_id = p_category_id;
        RETURN;
    END IF;

    v_threshold := COALESCE(p_threshold, public.low_stock_threshold());
    v_remaining := GREATEST(COALESCE(v_total, 0) - COALESCE(v_sold, 0) - COALESCE(v_held, 0), 0);
    IF v_remaining = 0 THEN
        v_availability := 'SOLD_OUT';
        v_hint := NULL;
    ELSIF v_remaining <= v_threshold THEN
        v_availability := 'LOW';
        v_hint := v_remaining;
    ELSE
        v_availability := 'AVAILABLE';
        v_hint := NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM public.public_category_stock s WHERE s.category_id = p_category_id) THEN
        UPDATE public.public_category_stock
           SET event_id = v_event, availability = v_availability, remaining_hint = v_hint, updated_at = now()
         WHERE category_id = p_category_id
           AND (event_id IS DISTINCT FROM v_event
                OR availability IS DISTINCT FROM v_availability
                OR remaining_hint IS DISTINCT FROM v_hint);
    ELSE
        INSERT INTO public.public_category_stock (category_id, event_id, availability, remaining_hint, updated_at)
        VALUES (p_category_id, v_event, v_availability, v_hint, now())
        ON CONFLICT (category_id) DO UPDATE
           SET event_id = EXCLUDED.event_id, availability = EXCLUDED.availability,
               remaining_hint = EXCLUDED.remaining_hint, updated_at = EXCLUDED.updated_at;
    END IF;
END;
$$;

-- ============================================================================
-- (3) public_event_state_sync (recopie F50 de 20261106000001_lot8_canaux.sql:1117-1180)
-- Changements : verrou du résumé en première instruction ; min_price sur les catégories qui ont encore des places ;
-- stock_level calculé, comparé et écrit avec les autres colonnes (9t.19) ; résumé supprimé pour un événement terminé
-- sans publication (9t.12, ended_unpublished).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.public_event_state_sync(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status text;
    v_unpublished boolean;
    v_title text;
    v_start_date date;
    v_start_time time;
    v_location text;
    v_city text;
    v_image text;
    v_start timestamptz;
    v_end timestamptz;
    v_min numeric;
    v_any boolean;
    v_has boolean;
    v_threshold integer;
    v_level text;
BEGIN
    IF p_event_id IS NULL THEN RETURN; END IF;
    -- Lot 9 ter (9t.19, D-stk 3.4) : une seule synchronisation à la fois par événement ; la suivante relit les
    -- catégories après la validation de la précédente (nouvel instantané à chaque instruction).
    PERFORM 1 FROM public.public_event_state WHERE event_id = p_event_id FOR UPDATE;
    SELECT e.status::text, e.ended_unpublished, e.title, e.start_date, e.start_time, e.location, e.city, e.image_url
      INTO v_status, v_unpublished, v_title, v_start_date, v_start_time, v_location, v_city, v_image
      FROM public.events e
     WHERE e.id = p_event_id;
    IF NOT FOUND THEN
        DELETE FROM public.public_event_state WHERE event_id = p_event_id;
        RETURN;
    END IF;
    -- Lot 9 ter (9t.12, R106 a) : un événement terminé sans publication n'est jamais public.
    IF v_status NOT IN ('PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE') OR COALESCE(v_unpublished, FALSE) THEN
        DELETE FROM public.public_event_state WHERE event_id = p_event_id;
        RETURN;
    END IF;

    v_start := CASE WHEN v_start_date IS NULL THEN NULL
                    ELSE (v_start_date + COALESCE(v_start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar' END;
    v_end := public.event_end_at(p_event_id);
    -- Lot 9 ter (9t.19) : « à partir de » sur les catégories qui ont encore des places ; tranche de l'événement.
    v_threshold := public.low_stock_threshold();
    SELECT min(x.price) FILTER (WHERE x.r > 0),
           COALESCE(bool_or(x.r > 0), FALSE),
           CASE WHEN count(*) = 0 THEN NULL
                WHEN NOT bool_or(x.r > 0) THEN 'SOLD_OUT'
                WHEN bool_and(x.r <= v_threshold) FILTER (WHERE x.r > 0) THEN 'LOW'
                ELSE 'AVAILABLE' END
      INTO v_min, v_any, v_level
      FROM (SELECT tc.price,
                   GREATEST(COALESCE(tc.total_quantity, 0) - COALESCE(tc.sold_quantity, 0) - COALESCE(tc.held_quantity, 0), 0) AS r
              FROM public.ticket_categories tc
             WHERE tc.event_id = p_event_id AND tc.is_active AND tc.sale_online) x;
    -- Achat possible d'après le statut et le stock ; les dates de vente et la fin sont évaluées par l'API.
    v_has := (v_status = 'PUBLIE') AND COALESCE(v_any, FALSE);

    IF EXISTS (SELECT 1 FROM public.public_event_state s WHERE s.event_id = p_event_id) THEN
        UPDATE public.public_event_state
           SET status = v_status, title = v_title, start_at = v_start, end_at = v_end, location = v_location,
               city = v_city, image_url = v_image, min_price = v_min, has_purchasable = v_has, stock_level = v_level,
               updated_at = now()
         WHERE event_id = p_event_id
           AND (status, title, start_at, end_at, location, city, image_url, min_price, has_purchasable, stock_level)
               IS DISTINCT FROM (v_status, v_title, v_start, v_end, v_location, v_city, v_image, v_min, v_has, v_level);
    ELSE
        INSERT INTO public.public_event_state
               (event_id, status, title, start_at, end_at, location, city, image_url, min_price, has_purchasable, stock_level, updated_at)
        VALUES (p_event_id, v_status, v_title, v_start, v_end, v_location, v_city, v_image, v_min, v_has, v_level, now())
        ON CONFLICT (event_id) DO UPDATE
           SET status = EXCLUDED.status, title = EXCLUDED.title, start_at = EXCLUDED.start_at, end_at = EXCLUDED.end_at,
               location = EXCLUDED.location, city = EXCLUDED.city, image_url = EXCLUDED.image_url,
               min_price = EXCLUDED.min_price, has_purchasable = EXCLUDED.has_purchasable,
               stock_level = EXCLUDED.stock_level, updated_at = EXCLUDED.updated_at;
    END IF;
END;
$$;

-- ============================================================================
-- (4) low_stock_threshold_resync (recopie F52 de 20261102000006_lot5_temps_reel.sql:361-382)
-- Changement : par événement (ordre event_id), ses tranches (ordre category_id) puis son résumé, dont stock_level
-- dépend aussi du seuil. Trigger trg_low_stock_threshold_resync (20261102000006:397-401) inchangé.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.low_stock_threshold_resync()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid;
    v_category uuid;
    v_threshold integer;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.value IS NOT DISTINCT FROM OLD.value THEN
            RETURN NULL;
        END IF;
    END IF;
    v_threshold := public.low_stock_threshold();
    FOR v_event IN SELECT x.event_id FROM (SELECT event_id FROM public.public_event_state
                                           UNION SELECT event_id FROM public.public_category_stock) x ORDER BY x.event_id LOOP
        FOR v_category IN SELECT s.category_id FROM public.public_category_stock s
                           WHERE s.event_id = v_event ORDER BY s.category_id LOOP
            PERFORM public.public_category_stock_sync(v_category, v_threshold);
        END LOOP;
        PERFORM public.public_event_state_sync(v_event);
    END LOOP;
    RETURN NULL;
END;
$$;

-- ============================================================================
-- (5) ticket_category_create (recopie F53 de 20261106000001_lot8_canaux.sql:835-890)
-- Changements : texte du refus QUOTA_ABOVE_CAPACITY (9t.19 ; code, champ et statut inchangés) ; scan_color et
-- entry_instruction lus à part, vérifiés, insérés, couleur à l'audit (9t.15).
-- p : { event_id, actor_id, category: { name, description?, price, total_quantity, max_per_order?, sale_start?,
--       sale_end?, sale_online?, sale_counter?, is_visible?, is_active?, scan_color?, entry_instruction? } }
--     → { ok, category }
-- ============================================================================
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
    -- Lot 9 ter (9t.15) : couleur et consigne lues à part, la normalisation refuse toute clé hors de sa liste.
    IF jsonb_typeof(v_cat) = 'object' THEN
        v_norm := public.ticket_category_normalize(v_cat - 'scan_color' - 'entry_instruction', public.event_end_at(v_event), '');
    ELSE
        v_norm := public.ticket_category_normalize(v_cat, public.event_end_at(v_event), '');
    END IF;
    IF (v_norm->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_norm;
    END IF;
    IF v_cat ? 'scan_color' AND jsonb_typeof(v_cat->'scan_color') <> 'null' THEN
        IF jsonb_typeof(v_cat->'scan_color') <> 'string'
           OR (v_cat->>'scan_color') NOT IN ('BLANC', 'OR', 'ARGENT', 'ROSE', 'TURQUOISE', 'BLEU', 'VIOLET', 'NOIR') THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une couleur dans la liste.', 'scan_color');
        END IF;
        v_color := v_cat->>'scan_color';
    END IF;
    IF v_cat ? 'entry_instruction' AND jsonb_typeof(v_cat->'entry_instruction') <> 'null' THEN
        IF jsonb_typeof(v_cat->'entry_instruction') <> 'string' THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'La consigne d’entrée ne dépasse pas 60 caractères.', 'entry_instruction');
        END IF;
        v_instr := NULLIF(btrim(regexp_replace(v_cat->>'entry_instruction', '\s+', ' ', 'g')), '');
        IF char_length(v_instr) > 60 THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'La consigne d’entrée ne dépasse pas 60 caractères.', 'entry_instruction');
        END IF;
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

-- ============================================================================
-- (6) ticket_category_update (recopie F54 de 20261109000008_lot9bis_cycle.sql:1835-1980)
-- Changements : texte du refus QUOTA_ABOVE_CAPACITY (9t.19 ; code, champ et statut inchangés) ; clés scan_color et
-- entry_instruction acceptées, vérifiées et écrites (9t.15) ; audit et retour inchangés.
-- ============================================================================
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
    IF v_patch ? 'scan_color' THEN
        IF jsonb_typeof(v_patch->'scan_color') = 'null' THEN
            n_color := NULL;
        ELSIF jsonb_typeof(v_patch->'scan_color') = 'string'
              AND (v_patch->>'scan_color') IN ('BLANC', 'OR', 'ARGENT', 'ROSE', 'TURQUOISE', 'BLEU', 'VIOLET', 'NOIR') THEN
            n_color := v_patch->>'scan_color';
        ELSE
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une couleur dans la liste.', 'scan_color');
        END IF;
    END IF;
    IF v_patch ? 'entry_instruction' THEN
        IF jsonb_typeof(v_patch->'entry_instruction') = 'null' THEN
            n_instr := NULL;
        ELSIF jsonb_typeof(v_patch->'entry_instruction') = 'string' THEN
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
        SELECT COALESCE(sum(o.total_quantity), 0)::int INTO v_sum
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


-- ----------------------------------------------------------------------------
-- (7) Privilèges : service_role seul (patron 20261106000001_lot8_canaux.sql:1302-1325) ; la fonction de trigger
--     garde EXECUTE pour service_role seul, comme à sa création (20261102000006_lot5_temps_reel.sql:591-604).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.public_category_stock_sync(uuid, integer)',
        'public.public_event_state_sync(uuid)',
        'public.low_stock_threshold_resync()',
        'public.ticket_category_create(jsonb)',
        'public.ticket_category_update(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;


-- ----------------------------------------------------------------------------
-- (8) Reprise (dernier bloc, X28, ED5) : par événement résumé public (ordre event_id), ses tranches (ordre id) puis
--     son résumé (stock_level posé, min_price recalculé). Rien n'est réécrit quand rien ne change.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_event uuid;
    v_category uuid;
BEGIN
    FOR v_event IN SELECT s.event_id FROM public.public_event_state s ORDER BY s.event_id LOOP
        FOR v_category IN SELECT tc.id FROM public.ticket_categories tc WHERE tc.event_id = v_event ORDER BY tc.id LOOP
            PERFORM public.public_category_stock_sync(v_category);
        END LOOP;
        PERFORM public.public_event_state_sync(v_event);
    END LOOP;
END;
$$;
