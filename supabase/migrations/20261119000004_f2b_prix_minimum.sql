-- Finition 2b (A, E-26) — prix minimum d'un billet payant refusé sous la BONNE catégorie. Constat (état des lieux du
-- 15/11, point 2) : vérifié seulement par le déclencheur trg_ticket_categories_min_price (P0001 PRICE_BELOW_MINIMUM,
-- minimum en DETAIL) ; à la création, l'insertion de toutes les catégories échouait au premier prix trop bas et le refus
-- portait le seul champ « price », sans dire de quelle catégorie il s'agissait.
-- ticket_category_normalize (recopie de 20261119000002_f2b_couleur_consigne.sql) : prix payant sous le minimum refusé
-- avant toute écriture, sous le chemin de la catégorie, minimum joint (le service en écrit le texte, séparateur des
-- milliers compris). event_create et ticket_category_create l'appellent déjà : rien d'autre ne change. Le déclencheur
-- reste en place (toute autre écriture d'un prix).
-- Sans BEGIN ni COMMIT, rejouable (CREATE OR REPLACE) ; aucune donnée écrite.

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
    v_min numeric;
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
    -- Finition 2b (A, E-26) : prix d'un billet payant sous le minimum (réglage finance.min_paid_price, lu par
    -- fin_setting_num : un réglage illisible fait échouer l'écriture) refusé ici, sous le chemin de la catégorie
    -- (ticket_categories.<i>.price à la création) ; le déclencheur trg_ticket_categories_min_price reste le dernier rempart
    IF v_price > 0 THEN
        v_min := public.fin_setting_num('finance.min_paid_price');
        IF v_price < v_min THEN
            RETURN public.event_edit_refusal('PRICE_BELOW_MINIMUM',
                format('Le prix d’un billet payant est d’au moins %s F CFA. Pour un billet gratuit, indiquez 0.', trim(to_char(v_min, 'FM9999999990'))),
                v_prefix || 'price', jsonb_build_object('minimum', v_min));
        END IF;
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

REVOKE ALL ON FUNCTION public.ticket_category_normalize(jsonb, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_category_normalize(jsonb, timestamptz, text) TO service_role;
