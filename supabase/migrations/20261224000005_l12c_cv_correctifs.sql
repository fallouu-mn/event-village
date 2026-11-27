-- ============================================================================
-- EVENT VILLAGE — LOT 12c, migration 05 : correctifs de la contre-vérification (docs/audit-lot12c.md) et avis ajoutés
-- ============================================================================
-- Fonctions NOUVELLES (les fonctions déjà recopiées par le lot sont corrigées en place dans 20261224000001 à …04, jamais
-- appliquées : une seule définition par fonction dans le lot, règle S1).
--  T3 revue des produits existants : private.order_review_backfill_candidates (produits non archivés, ni réglementés
--     ni refusés, dont le texte — nom, description, catégorie, suppléments — contient un mot de la liste que
--     l'administration n'a pas déjà autorisé), private.order_review_backfill (appelée à chaque changement de la liste
--     par order_review_keywords_set), private.order_review_batch_done (un seul avis groupé à l'administration,
--     ADMIN_PRODUCTS_REVIEW_BATCH, et une ligne de journal PRODUCT_REVIEW_BACKFILL lue par la page) ; la migration revoit
--     une fois les produits déjà enregistrés (instruction plus bas). La revue ne fait que poser « à vérifier ».
--  T3 bouton de l'administration : order_product_review_request (droit partners.validate, motif) met n'importe quel
--     produit « à vérifier » (une marque qu'aucune liste ne reconnaît), avec avis à la partenaire.
--  T5 catégories : order_category_save (création et renommage par la base) ; un nom avec un mot de la liste met tous
--     les produits non archivés de la catégorie « à vérifier ».
--  T1 surlignage servi par le serveur : order_review_marks(texte) rend les plages des mots trouvés, calculées avec la
--     même fonction de pliage (private.order_text_fold) et les deux mêmes lectures que private.order_review_words.
--  T6 produit archivé : order_daily_portions_set (recopie, ci-dessous) refuse ses portions ; elle sert aussi la
--     rupture en un geste (sold_out : portions ramenées à ce qui est déjà vendu).
--  T4 lecture REST : SELECT des colonnes review_state, review_words, review_requested_at, review_note,
--     review_cleared_words, archived_at retiré à anon et authenticated (droits par colonne ; les autres colonnes restent
--     lisibles selon la règle de lignes products_read, propriété du lot 12b). Le propriétaire et l'administration lisent
--     ces colonnes par les routes serveur (rôle de service).
--  Avis ajoutés (point 7 de la consigne, P1 à P7 de l'audit) : ORDER_CODE_LOCKED (client, code bloqué après les essais),
--     ORDER_RESPONSE_REMINDER (partenaire, moins de 5 minutes pour répondre), ORDER_PREP_REMINDER (partenaire, commande
--     pour plus tard à lancer), ORDER_READY_COURIER (livreur, commande prête), PRODUCT_DECISION_SMS (partenaire, SMS de
--     la décision ; envoyé par order_product_regulation_decide), ADMIN_ORDER_REFUND_BLOCKED (administration
--     refunds.manage, SMS d'un remboursement de commande bloqué, échoué ou incertain), ORDER_SCHEDULED_REMINDER (client,
--     1 h avant une commande prévue un autre jour), ADMIN_PRODUCTS_REVIEW_BATCH (administration, revue groupée).
--     Déclencheurs : orders (code bloqué, commande prête), cashouts (remboursement bloqué) ; order_reminders (appelée par
--     /api/cron/orders après order_tick) pour P2, P3, P7. Aucune fonction d'envoi recopiée.
-- Sans BEGIN ni COMMIT ; rejouable : CREATE OR REPLACE, DROP TRIGGER IF EXISTS puis CREATE, ON CONFLICT, revue idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Revue des produits existants (T3)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.order_review_backfill_candidates()
RETURNS TABLE (product_id uuid, words text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT x.id, x.words
      FROM (SELECT pr.id, pr.review_cleared_words, private.order_product_words(pr.id) AS words
              FROM public.products pr
             WHERE pr.archived_at IS NULL AND pr.review_state IS NULL
               AND NOT pr.is_regulated AND COALESCE(pr.regulated_admin, FALSE) = FALSE) x
     WHERE EXISTS (SELECT 1 FROM unnest(x.words) w WHERE NOT (w = ANY (COALESCE(x.review_cleared_words, ARRAY[]::text[]))));
$$;

-- Un seul avis groupé aux administrateurs (partners.validate) et une ligne de journal (lue par la page)
CREATE OR REPLACE FUNCTION private.order_review_batch_done(p_count integer, p_origin text, p_actor uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF COALESCE(p_count, 0) <= 0 THEN
        RETURN 0;
    END IF;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (p_actor, CASE WHEN p_actor IS NULL THEN 'SYSTEM' WHEN p_origin = 'CATEGORIE' THEN 'PARTENAIRE' ELSE 'SUPERADMIN' END,
            'PRODUCT_REVIEW_BACKFILL', 'products', NULL,
            jsonb_build_object('count', p_count, 'origin', p_origin));
    PERFORM public.notif_enqueue_admins(jsonb_build_object(
        'type', 'ADMIN_PRODUCTS_REVIEW_BATCH',
        'ref', p_origin || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'),
        'data', jsonb_build_object('count', p_count, 'origin', p_origin)));
    RETURN p_count;
END;
$$;

CREATE OR REPLACE FUNCTION private.order_review_backfill(p_origin text, p_actor uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_n integer;
BEGIN
    PERFORM set_config('event_village.product_write', 'on', true);
    WITH flagged AS (
        UPDATE public.products p
           SET review_state = 'A_VERIFIER', review_words = c.words, review_requested_at = now(), updated_at = now()
          FROM private.order_review_backfill_candidates() c
         WHERE p.id = c.product_id
        RETURNING p.id)
    SELECT count(*)::int INTO v_n FROM flagged;
    PERFORM set_config('event_village.product_write', 'off', true);
    RETURN private.order_review_batch_done(v_n, p_origin, p_actor);
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Mettre un produit « à vérifier » (administration, T3)
-- ----------------------------------------------------------------------------
-- p : actor_id, product_id, reason
CREATE OR REPLACE FUNCTION public.order_product_review_request(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_product uuid := public.try_uuid(p->>'product_id');
    v_reason  text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'reason', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    pr        record;
    v_owner   uuid;
    v_words   text[];
BEGIN
    IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
       OR NOT (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
               OR public.has_admin_permission(v_actor, 'partners.validate')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit de vérifier les produits.');
    END IF;
    IF v_reason IS NULL OR length(v_reason) < 3 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif : il est envoyé à la partenaire.');
    END IF;
    SELECT * INTO pr FROM public.products WHERE id = v_product FOR UPDATE;
    IF v_product IS NULL OR NOT FOUND OR pr.archived_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_NOT_FOUND', 'message', 'Produit introuvable.');
    END IF;
    IF pr.review_state IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_IN_REVIEW', 'message', 'Ce produit est déjà en vérification.');
    END IF;
    v_words := private.order_product_words(pr.id);
    PERFORM set_config('event_village.product_write', 'on', true);
    UPDATE public.products
       SET review_state = 'A_VERIFIER', review_words = CASE WHEN cardinality(v_words) > 0 THEN v_words END,
           review_requested_at = now(), review_note = v_reason, updated_at = now()
     WHERE id = pr.id;
    PERFORM set_config('event_village.product_write', 'off', true);
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, CASE WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN') THEN 'SUPERADMIN' ELSE 'ADMIN' END,
            'PRODUCT_REVIEW_REQUESTED', 'products', pr.id, jsonb_build_object('reason', v_reason, 'product_name', pr.name));
    SELECT pa.user_id INTO v_owner FROM public.partners pa WHERE pa.id = pr.partner_id;
    IF v_owner IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'PRODUCT_REVIEW_DECIDED',
            'key', 'PRODUCT_REVIEW_DECIDED:' || pr.id::text || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'),
            'user_id', v_owner, 'actor_id', v_actor,
            'data', jsonb_build_object('product_id', pr.id, 'product_name', pr.name, 'decision', 'A_VERIFIER', 'reason', v_reason)));
    END IF;
    RETURN jsonb_build_object('ok', true, 'product_id', pr.id, 'review_state', 'A_VERIFIER');
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Catégories (T5)
-- ----------------------------------------------------------------------------
-- p : actor_id, category_id (vide = création), name. Rend { ok, category, flagged }.
CREATE OR REPLACE FUNCTION public.order_category_save(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_category uuid := public.try_uuid(NULLIF(p->>'category_id', ''));
    v_name     text := NULLIF(btrim(regexp_replace(regexp_replace(COALESCE(p->>'name', ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g')), '');
    v_owner    jsonb;
    v_partner  uuid;
    c          public.product_categories%ROWTYPE;
    v_same     record;
    v_row      record;
    v_n        integer := 0;
BEGIN
    v_owner := private.order_catalog_owner(v_actor);
    IF NOT (v_owner->>'ok')::boolean THEN
        RETURN v_owner;
    END IF;
    v_partner := (v_owner->>'partner_id')::uuid;
    IF v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 60 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_CATEGORY', 'message', 'Le nom de la catégorie compte de 2 à 60 caractères.');
    END IF;
    IF v_category IS NOT NULL OR NULLIF(p->>'category_id', '') IS NOT NULL THEN
        SELECT * INTO c FROM public.product_categories WHERE id = v_category AND partner_id = v_partner FOR UPDATE;
        IF v_category IS NULL OR NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'CATEGORY_NOT_FOUND', 'message', 'Catégorie de produit introuvable.');
        END IF;
    END IF;
    SELECT id, name INTO v_same FROM public.product_categories
     WHERE partner_id = v_partner AND lower(btrim(name)) = lower(v_name) AND id IS DISTINCT FROM v_category LIMIT 1;
    IF FOUND THEN
        IF v_category IS NULL THEN
            RETURN jsonb_build_object('ok', true, 'category', jsonb_build_object('id', v_same.id, 'name', v_same.name), 'existing', true, 'flagged', 0);
        END IF;
        RETURN jsonb_build_object('ok', false, 'code', 'CATEGORY_EXISTS', 'message', 'Une catégorie porte déjà ce nom.');
    END IF;
    IF v_category IS NULL THEN
        IF (SELECT count(*) FROM public.product_categories WHERE partner_id = v_partner) >= 50 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_CATEGORIES', 'message', '50 catégories au plus.');
        END IF;
        INSERT INTO public.product_categories (partner_id, name, sort_order)
        VALUES (v_partner, v_name, (SELECT count(*) FROM public.product_categories WHERE partner_id = v_partner))
        RETURNING id, name INTO v_row;
    ELSE
        UPDATE public.product_categories SET name = v_name, updated_at = now() WHERE id = c.id RETURNING id, name INTO v_row;
        -- Renommage avec un mot de la liste : tous les produits non archivés de la catégorie passent « à vérifier »
        IF v_name IS DISTINCT FROM c.name AND cardinality(private.order_review_words(v_name)) > 0 THEN
            PERFORM set_config('event_village.product_write', 'on', true);
            WITH flagged AS (
                UPDATE public.products pr
                   SET review_state = 'A_VERIFIER', review_words = private.order_product_words(pr.id), review_requested_at = now(), updated_at = now()
                 WHERE pr.category_id = c.id AND pr.archived_at IS NULL AND pr.review_state IS NULL
                RETURNING pr.id)
            SELECT count(*)::int INTO v_n FROM flagged;
            PERFORM set_config('event_village.product_write', 'off', true);
            PERFORM private.order_review_batch_done(v_n, 'CATEGORIE', NULL);
        END IF;
    END IF;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (v_actor, 'PARTENAIRE', CASE WHEN v_category IS NULL THEN 'PRODUCT_CATEGORY_CREATED' ELSE 'PRODUCT_CATEGORY_RENAMED' END,
            'product_categories', v_row.id, CASE WHEN v_category IS NOT NULL THEN jsonb_build_object('name', c.name) END,
            jsonb_build_object('name', v_row.name, 'flagged', v_n));
    RETURN jsonb_build_object('ok', true, 'category', jsonb_build_object('id', v_row.id, 'name', v_row.name), 'flagged', v_n);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Surlignage servi par le serveur (T1)
-- ----------------------------------------------------------------------------
-- Plages [début, fin[ (en caractères du texte d'origine, à partir de 0) des mots de la liste trouvés, avec la même
-- fonction de pliage, caractère par caractère, et les deux mêmes lectures (mots ; lettres isolées recollées).
CREATE OR REPLACE FUNCTION public.order_review_marks(p_text text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_chars  text[] := regexp_split_to_array(COALESCE(left(p_text, 4000), ''), '');
    v_fold   text := '';
    v_map    integer[] := ARRAY[]::integer[];
    v_jtext  text := '';
    v_jmap   integer[] := ARRAY[]::integer[];
    v_runs   text := '';
    v_runmap integer[] := ARRAY[]::integer[];
    v_out    jsonb := '[]'::jsonb;
    i        integer;
    j        integer;
    f        text;
    k        record;
    v_key    text;
    v_pat    text;
    v_pos    integer;
    v_s      integer;
    v_e      integer;
    v_tok    text := '';
    v_tokpos integer;
BEGIN
    IF p_text IS NULL OR p_text = '' THEN
        RETURN '[]'::jsonb;
    END IF;
    -- Texte plié caractère par caractère, avec la place de chaque caractère plié dans le texte d'origine
    FOR i IN 1..COALESCE(array_length(v_chars, 1), 0) LOOP
        f := regexp_replace(private.order_text_fold(v_chars[i]), '[^a-z0-9''-]', ' ', 'g');
        FOR j IN 1..length(f) LOOP
            v_fold := v_fold || substr(f, j, 1);
            v_map := v_map || (i - 1);
        END LOOP;
    END LOOP;
    -- Lettres isolées recollées : chaque suite d'au moins deux mots d'une seule lettre ou d'un seul chiffre
    v_fold := v_fold || ' ';
    v_map := v_map || COALESCE(v_map[array_length(v_map, 1)], 0);
    FOR i IN 1..length(v_fold) LOOP
        IF substr(v_fold, i, 1) ~ '[a-z0-9]' THEN
            IF v_tok = '' THEN v_tokpos := i; END IF;
            v_tok := v_tok || substr(v_fold, i, 1);
        ELSE
            IF length(v_tok) = 1 THEN
                v_runs := v_runs || v_tok;
                v_runmap := v_runmap || v_map[v_tokpos];
            ELSIF v_tok <> '' THEN
                IF length(v_runs) >= 2 THEN
                    v_jtext := v_jtext || ' ' || v_runs;
                    v_jmap := v_jmap || (-1) || v_runmap;
                END IF;
                v_runs := '';
                v_runmap := ARRAY[]::integer[];
            END IF;
            v_tok := '';
        END IF;
    END LOOP;
    IF length(v_runs) >= 2 THEN
        v_jtext := v_jtext || ' ' || v_runs;
        v_jmap := v_jmap || (-1) || v_runmap;
    END IF;
    v_jtext := v_jtext || ' ';
    v_jmap := v_jmap || (-1);
    FOR k IN SELECT x.word
               FROM public.platform_settings s
               CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(s.value->'value') = 'array' THEN s.value->'value' ELSE '[]'::jsonb END) AS x(word)
              WHERE s.key = 'orders.review_keywords' LOOP
        v_key := btrim(private.order_text_fold(k.word));
        CONTINUE WHEN v_key !~ '^[a-z0-9][a-z0-9 ''-]*$';
        -- Mots tels quels
        v_pat := '(^|[^a-z0-9])(' || v_key || '(s|x)?)($|[^a-z0-9])';
        v_pos := 1;
        LOOP
            v_s := regexp_instr(v_fold, v_pat, v_pos, 1, 0, '', 2);
            EXIT WHEN v_s = 0;
            v_e := regexp_instr(v_fold, v_pat, v_pos, 1, 1, '', 2);
            v_out := v_out || jsonb_build_array(jsonb_build_array(v_map[v_s], v_map[v_e - 1] + 1));
            v_pos := v_e;
        END LOOP;
        -- Lettres isolées recollées
        v_pat := '(^|[^a-z0-9])(' || regexp_replace(v_key, '[^a-z0-9]', '', 'g') || '(s|x)?)($|[^a-z0-9])';
        v_pos := 1;
        LOOP
            v_s := regexp_instr(v_jtext, v_pat, v_pos, 1, 0, '', 2);
            EXIT WHEN v_s = 0;
            v_e := regexp_instr(v_jtext, v_pat, v_pos, 1, 1, '', 2);
            v_out := v_out || jsonb_build_array(jsonb_build_array(v_jmap[v_s], v_jmap[v_e - 1] + 1));
            v_pos := v_e;
        END LOOP;
    END LOOP;
    RETURN v_out;
END;
$$;

-- Plusieurs textes d'un coup (file de l'administration : un appel pour toute la page)
CREATE OR REPLACE FUNCTION public.order_review_marks_many(p_texts text[])
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(jsonb_agg(public.order_review_marks(t.v) ORDER BY t.n), '[]'::jsonb)
      FROM unnest(COALESCE(p_texts[1:600], ARRAY[]::text[])) WITH ORDINALITY AS t(v, n);
$$;

-- ----------------------------------------------------------------------------
-- 5. Portions du plat du jour (T6, rupture en un geste)
-- ----------------------------------------------------------------------------
-- Recopie de 20261130000002_l12a_catalogue.sql:318-369 (dernière définition ; aucune autre migration ne la redéfinit) ;
-- changements (lignes ajoutées seulement) : produit archivé refusé (PRODUCT_ARCHIVED) ; p.sold_out = true ramène les
-- portions du jour à ce qui est déjà vendu (« Plus de … » depuis « Ma journée »).
CREATE OR REPLACE FUNCTION public.order_daily_portions_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_product  uuid := public.try_uuid(p->>'product_id');
    v_portions integer;
    v_day      date := public.hall_dakar_now()::date;
    pr         record;
    v_sold     integer;
    v_sold_out boolean := jsonb_typeof(p->'sold_out') = 'boolean' AND (p->>'sold_out')::boolean;
BEGIN
    BEGIN
        v_portions := (p->>'portions')::int;
    EXCEPTION WHEN others THEN
        v_portions := NULL;
    END;
    -- Lot 12c : rupture en un geste (« Plus de … ») : portions ramenées à ce qui est déjà vendu (calculé sous le verrou)
    IF v_sold_out THEN
        v_portions := 0;
    END IF;
    IF v_portions IS NULL OR v_portions NOT BETWEEN 0 AND 10000 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PORTIONS', 'message', 'Indiquez un nombre de portions entre 0 et 10 000.');
    END IF;
    SELECT pd.*, pa.user_id AS owner_id, pa.status::text AS partner_status INTO pr
      FROM public.products pd JOIN public.partners pa ON pa.id = pd.partner_id WHERE pd.id = v_product;
    IF v_product IS NULL OR NOT FOUND OR v_actor IS NULL OR pr.owner_id <> v_actor
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_NOT_FOUND', 'message', 'Ce produit n’existe pas ou n’est pas le vôtre.');
    END IF;
    IF pr.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_VALIDATED', 'message', 'Votre fiche doit être validée pour modifier la vente.');
    END IF;
    IF NOT pr.is_daily_special THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_DAILY_SPECIAL', 'message', 'Ce produit n’est pas un plat du jour.');
    END IF;
    -- Lot 12c (contre-vérification T6) : un produit archivé ne change plus
    IF pr.archived_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_ARCHIVED', 'message', 'Ce produit est archivé : il ne se modifie plus.');
    END IF;
    -- Même verrou que la vente d'une portion
    PERFORM pg_advisory_xact_lock(hashtextextended('order_portions:' || v_product::text || ':' || v_day::text, 0));
    SELECT sold INTO v_sold FROM public.product_daily_portions WHERE product_id = v_product AND day = v_day;
    IF v_sold_out THEN
        v_portions := COALESCE(v_sold, 0);
    END IF;
    IF COALESCE(v_sold, 0) > v_portions THEN
        RETURN jsonb_build_object('ok', false, 'code', 'BELOW_SOLD',
            'message', format('%s portions sont déjà vendues aujourd’hui : indiquez au moins %s.', v_sold, v_sold));
    END IF;
    PERFORM set_config('event_village.order_flow', 'on', true);
    INSERT INTO public.product_daily_portions (product_id, day, portions, sold)
    VALUES (v_product, v_day, v_portions, 0)
    ON CONFLICT (product_id, day) DO UPDATE SET portions = EXCLUDED.portions, updated_at = now();
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'PRODUCT_DAILY_PORTIONS_SET', 'products', v_product,
            jsonb_build_object('day', v_day, 'portions', v_portions, 'sold', COALESCE(v_sold, 0)));
    RETURN jsonb_build_object('ok', true, 'product_id', v_product, 'day', v_day, 'portions', v_portions, 'sold', COALESCE(v_sold, 0));
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Avis ajoutés (point 7) : types, déclencheurs, rappels
-- ----------------------------------------------------------------------------
-- Règle de nuit (finition 4, notification_types.night_policy) : SEND = tout de suite, la nuit aussi ; DEFER = SMS et push
-- préparés la nuit reportés à la fin de la plage. Code bloqué, délai de réponse, préparation, commande prête et rappel
-- d'une commande prévue concernent une commande en cours ou à venir dans l'heure : tout de suite. Décision sur un
-- produit, remboursement bloqué, revue groupée : reportés.
INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission, night_policy) VALUES
    ('ORDER_CODE_LOCKED',           'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL,                'SEND'),
    ('ORDER_RESPONSE_REMINDER',     'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'BLOCK', FALSE, NULL,                'SEND'),
    ('ORDER_PREP_REMINDER',         'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'BLOCK', FALSE, NULL,                'SEND'),
    ('ORDER_READY_COURIER',         'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL,                'SEND'),
    ('ORDER_SCHEDULED_REMINDER',    'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL,                'SEND'),
    ('PRODUCT_DECISION_SMS',        'ESSENTIAL', NULL, ARRAY['SMS'],                         'PARTNER', 'ALLOW', FALSE, NULL,                'DEFER'),
    ('ADMIN_ORDER_REFUND_BLOCKED',  'ESSENTIAL', NULL, ARRAY['SMS'],                         'ADMIN',   'BLOCK', FALSE, 'refunds.manage',    'DEFER'),
    ('ADMIN_PRODUCTS_REVIEW_BATCH', 'ESSENTIAL', NULL, ARRAY['IN_APP','EMAIL'],              'ADMIN',   'BLOCK', FALSE, 'partners.validate', 'DEFER')
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission,
    night_policy = EXCLUDED.night_policy;

-- P1 code bloqué (client) et P4 commande prête (livreur) : déclencheur sur la commande (aucune fonction d'étape recopiée)
CREATE OR REPLACE FUNCTION private.order_extra_notify()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max integer := public.fin_setting_num('orders.code_max_attempts')::int;
BEGIN
    IF NEW.venue_id IS NULL OR NEW.order_state IS NULL THEN
        RETURN NULL;
    END IF;
    IF NEW.code_attempts >= v_max AND OLD.code_attempts < v_max AND NEW.code_hash IS NOT NULL THEN
        PERFORM public.order_notify('ORDER_CODE_LOCKED', NEW.id, 'CLIENT', '{}'::jsonb,
                                    to_char(COALESCE(NEW.code_issued_at, now()), 'YYYYMMDDHH24MISSUS'));
    END IF;
    IF NEW.order_state = 'PRETE' AND OLD.order_state IS DISTINCT FROM 'PRETE' AND NEW.delivery_mode::text = 'LIVRAISON'
       AND NEW.courier_user_id IS NOT NULL THEN
        PERFORM public.order_notify('ORDER_READY_COURIER', NEW.id, 'COURIER', '{}'::jsonb, NEW.courier_user_id::text);
    END IF;
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_orders_extra_notify ON public.orders;
CREATE TRIGGER trg_orders_extra_notify
    AFTER UPDATE OF code_attempts, order_state ON public.orders
    FOR EACH ROW EXECUTE FUNCTION private.order_extra_notify();

-- P6 remboursement d'une commande bloqué, échoué ou incertain : SMS aux administrateurs refunds.manage (la cloche, le
-- téléphone et l'email partent déjà par ADMIN_REFUND_TO_RETRY et ADMIN_CASHOUT_UNCERTAIN)
CREATE OR REPLACE FUNCTION private.order_refund_blocked_notify()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_number text;
    v_state  text;
BEGIN
    IF NEW.kind <> 'REFUND' OR NEW.payment_id IS NULL THEN
        RETURN NULL;
    END IF;
    v_state := CASE
        WHEN NEW.status = 'ECHOUE' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'ECHOUE') THEN 'ECHOUE'
        WHEN NEW.status = 'INCERTAIN' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'INCERTAIN') THEN 'INCERTAIN'
        WHEN NEW.status = 'A_ENVOYER' AND NEW.blocked_reason IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.blocked_reason IS NULL) THEN 'BLOQUE'
    END;
    IF v_state IS NULL THEN
        RETURN NULL;
    END IF;
    SELECT o.order_number INTO v_number
      FROM public.payments p JOIN public.orders o ON o.id = p.order_id
     WHERE p.id = NEW.payment_id AND o.venue_id IS NOT NULL;
    IF v_number IS NULL THEN
        RETURN NULL;
    END IF;
    PERFORM public.notif_enqueue_admins(jsonb_build_object(
        'type', 'ADMIN_ORDER_REFUND_BLOCKED',
        'ref', NEW.id::text || ':' || COALESCE(NEW.attempt_count, 0)::text || ':' || v_state,
        'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'order_number', v_number, 'cashout_status', v_state)));
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_cashouts_order_refund_blocked ON public.cashouts;
CREATE TRIGGER trg_cashouts_order_refund_blocked
    AFTER INSERT OR UPDATE OF status, blocked_reason ON public.cashouts
    FOR EACH ROW EXECUTE FUNCTION private.order_refund_blocked_notify();

-- P2, P3, P7 : rappels (appelée par /api/cron/orders après order_tick ; idempotente : un avis par commande et par rappel)
-- p : now (facultatif, tests)
CREATE OR REPLACE FUNCTION public.order_reminders(p jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now  timestamptz := COALESCE(public.try_timestamptz(p->>'now'), now());
    r      record;
    v_resp integer := 0;
    v_prep integer := 0;
    v_soon integer := 0;
BEGIN
    -- P2 : commande reçue, moins de 5 minutes pour répondre (partenaire)
    FOR r IN SELECT o.id FROM public.orders o
              WHERE o.venue_id IS NOT NULL AND o.order_state = 'RECUE'
                AND o.response_due_at > v_now AND o.response_due_at <= v_now + interval '5 minutes' LOOP
        v_resp := v_resp + public.order_notify('ORDER_RESPONSE_REMINDER', r.id, 'OWNER', '{}'::jsonb, 'reponse');
    END LOOP;
    -- P3 : commande pour plus tard, acceptée plus d'une heure avant l'heure prévue : lancer la préparation (partenaire)
    FOR r IN SELECT o.id FROM public.orders o
              WHERE o.venue_id IS NOT NULL AND o.order_state = 'ACCEPTEE' AND NOT o.asap
                AND o.scheduled_for > v_now
                AND o.scheduled_for - make_interval(mins => COALESCE(o.prep_minutes, 30)) <= v_now
                AND o.scheduled_for >= o.accepted_at + interval '1 hour' LOOP
        v_prep := v_prep + public.order_notify('ORDER_PREP_REMINDER', r.id, 'OWNER', '{}'::jsonb, 'preparation');
    END LOOP;
    -- P7 : commande prévue un autre jour que sa transmission, 1 heure avant (client)
    FOR r IN SELECT o.id FROM public.orders o
              WHERE o.venue_id IS NOT NULL AND NOT o.asap AND o.closed_at IS NULL AND o.received_at IS NOT NULL
                AND o.order_state IN ('RECUE', 'ACCEPTEE', 'EN_PREPARATION', 'PRETE')
                AND (o.scheduled_for AT TIME ZONE 'Africa/Dakar')::date <> (o.received_at AT TIME ZONE 'Africa/Dakar')::date
                AND o.scheduled_for > v_now AND o.scheduled_for <= v_now + interval '1 hour' LOOP
        v_soon := v_soon + public.order_notify('ORDER_SCHEDULED_REMINDER', r.id, 'CLIENT', '{}'::jsonb, 'une-heure');
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'response_reminders', v_resp, 'prep_reminders', v_prep, 'scheduled_reminders', v_soon);
END;
$$;

-- Date lue dans un texte, ou NULL (paramètre « now » des tests)
CREATE OR REPLACE FUNCTION public.try_timestamptz(p_value text)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
    RETURN NULLIF(p_value, '')::timestamptz;
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Lecture REST des produits (T4) : droits par colonne
-- ----------------------------------------------------------------------------
-- Un droit SELECT sur la table l'emporte sur un retrait par colonne : le droit de table est retiré, puis rendu colonne par
-- colonne, sauf les colonnes de la vérification et de l'archivage. La règle de lignes products_read (lot 12b) ne change
-- pas. Une colonne ajoutée plus tard à products n'est pas lisible par la REST tant qu'un lot ne la donne pas.
DO $$
DECLARE
    v_cols text;
BEGIN
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO v_cols
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'products'
       AND column_name NOT IN ('review_state', 'review_words', 'review_requested_at', 'review_note', 'review_cleared_words', 'archived_at');
    EXECUTE 'REVOKE SELECT ON public.products FROM anon, authenticated';
    EXECUTE format('GRANT SELECT (%s) ON public.products TO anon, authenticated', v_cols);
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Droits
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION private.order_review_backfill_candidates() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_review_batch_done(integer, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_review_backfill(text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_extra_notify() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_refund_blocked_notify() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.order_product_review_request(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_category_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_review_marks(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_review_marks_many(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_daily_portions_set(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_reminders(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.try_timestamptz(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_product_review_request(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_category_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_review_marks(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_review_marks_many(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_daily_portions_set(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_reminders(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.try_timestamptz(text) TO service_role;

-- ----------------------------------------------------------------------------
-- 9. Revue, une fois, des produits déjà enregistrés (T3) : « à vérifier » posé sur les produits non archivés, ni
--    réglementés ni refusés, dont le texte contient un mot de la liste ; un avis groupé à l'administration. Rejouable
--    (un produit déjà « à vérifier » n'est pas repris).
-- ----------------------------------------------------------------------------
SELECT set_config('event_village.product_write', 'on', true);
WITH flagged AS (
    UPDATE public.products p
       SET review_state = 'A_VERIFIER', review_words = c.words, review_requested_at = now(), updated_at = now()
      FROM private.order_review_backfill_candidates() c
     WHERE p.id = c.product_id
    RETURNING p.id)
SELECT private.order_review_batch_done((SELECT count(*)::int FROM flagged), 'MIGRATION', NULL);
SELECT set_config('event_village.product_write', 'off', true);
