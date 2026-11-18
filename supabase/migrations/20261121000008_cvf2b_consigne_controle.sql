-- Correctifs de la contre-vérification de la finition 2b, 2c — consigne d'entrée : caractères de contrôle et contrôles
-- bidirectionnels refusés, comme les noms de zone et de porte ([[:cntrl:]]). Constat (docs/audit-finition-2b.md, 2c) :
-- « Entrée\u0007 VIP », « Bracelet \u001b[31mrouge… », « Porte\b\b\b B », « Zone\u007f A » et les contrôles
-- bidirectionnels (U+202E, U+2066 à U+2069, U+200F) étaient enregistrés par les six chemins ; la consigne s'affiche en
-- très grand sur l'écran du contrôleur, et un U+202E y inverse le texte affiché.
-- Règle (même liste que le schéma, lib/validations/event.ts) : la consigne reçue ne contient aucun caractère de contrôle
-- C0 (U+0001 à U+001F, tabulation et retour à la ligne compris), DEL ni C1 (U+007F à U+009F), aucune marque ni aucun
-- contrôle de sens d'écriture (U+061C, U+200E, U+200F, U+202A à U+202E, U+2066 à U+2069) ; refus INVALID_INPUT
-- « La consigne d’entrée contient un caractère invisible ou de contrôle : retirez-le. », sous le chemin de la consigne.
-- (U+0000 ne passe déjà pas : jsonb le refuse.)
--  1. ticket_category_normalize (recopie de 20261121000007_cvf2b_couleur_or.sql) : création de l'événement
--     (event_create) et nouvelle catégorie (ticket_category_create) ;
--  2. ticket_category_update (recopie de 20261121000007) : modification d'une catégorie.
-- La contrainte ticket_categories_entry_instruction_check (longueur) est inchangée.
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
    -- Finition 2b (A) : couleur (une des clés choisissables de la palette du scanner, ou rien : la base en pose une) et
    -- consigne (espaces ramenés à un seul, 60 caractères au plus, vide : aucune) ; mêmes textes que ticket_category_create
    -- (lot 9 ter). Contre-vérification 2b (2b) : OR n'est plus choisissable (confondable avec l'ambre « hors fenêtre »)
    IF p_cat ? 'scan_color' AND jsonb_typeof(p_cat->'scan_color') <> 'null' THEN
        IF jsonb_typeof(p_cat->'scan_color') <> 'string'
           OR (p_cat->>'scan_color') NOT IN ('BLANC', 'ARGENT', 'ROSE', 'TURQUOISE', 'BLEU', 'VIOLET', 'NOIR') THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une couleur dans la liste.', v_prefix || 'scan_color');
        END IF;
        v_color := p_cat->>'scan_color';
    END IF;
    IF p_cat ? 'entry_instruction' AND jsonb_typeof(p_cat->'entry_instruction') <> 'null' THEN
        IF jsonb_typeof(p_cat->'entry_instruction') <> 'string' THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'La consigne d’entrée ne dépasse pas 60 caractères.', v_prefix || 'entry_instruction');
        END IF;
        -- Contre-vérification 2b (2c) : caractères de contrôle et contrôles bidirectionnels refusés (texte reçu)
        IF (p_cat->>'entry_instruction') ~ '[\u0001-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]' THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'La consigne d’entrée contient un caractère invisible ou de contrôle : retirez-le.', v_prefix || 'entry_instruction');
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


-- 2. ticket_category_update
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

REVOKE ALL ON FUNCTION public.ticket_category_normalize(jsonb, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_category_normalize(jsonb, timestamptz, text) TO service_role;
REVOKE ALL ON FUNCTION public.ticket_category_update(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_category_update(jsonb) TO service_role;
