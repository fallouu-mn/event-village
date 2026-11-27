-- ============================================================================
-- EVENT VILLAGE — LOT 12c, migration 03 : devis d'une commande (produits archivés et « à vérifier »)
-- ============================================================================
-- order_quote_compute : recopie de 20261130000004_l12a_devis_commande.sql:196-456 (dernière définition ; aucune autre
-- migration ne la redéfinit) ; il teste la case « réglementé » en ligne, sans passer par product_regulated (état des
-- lieux du 26/11, § 3.4). Changements (lignes ajoutées seulement, aucune ligne retirée : test
-- tests/parcours/l12c-statique.test.ts) :
--  1. produit archivé (products.archived_at) : refusé comme un produit indisponible (PRODUCT_UNAVAILABLE) ;
--  2. produit « à vérifier » (products.review_state) : refusé (PRODUCT_UNDER_REVIEW), après la case « réglementé » ;
--  3. fermeture exceptionnelle de l'établissement (venue_closures, lot 11b ; ajout du 27/11, avant toute application) :
--     commande refusée (VENUE_CLOSED, « Ce restaurant est fermé à ce moment-là. Choisissez une autre heure. ») quand
--     une fermeture en cours touche la préparation : de maintenant à l'heure de remise pour « au plus tôt », de l'heure
--     prévue moins la préparation à l'heure prévue pour une heure choisie (venue_closed_during).
-- order_quote et order_create l'appellent : devis et création refusent donc les deux. Droits inchangés (CREATE OR
-- REPLACE les garde ; REVOKE et GRANT répétés, idempotents). Rejouable.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.order_quote_compute(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    v_mode     text := upper(COALESCE(p->>'mode', ''));
    v_pay      text := upper(COALESCE(NULLIF(p->>'payment', ''), 'INTEGRAL'));
    v          record;
    z          record;
    t          record;
    it         jsonb;
    pr         record;
    op         record;
    v_qty      integer;
    v_opt_ids  uuid[];
    v_opts     jsonb;
    v_opt_sum  numeric;
    v_unit     numeric;
    v_lines    jsonb := '[]'::jsonb;
    v_items    numeric := 0;
    v_fee_zone numeric := 0;
    v_goods    numeric;
    v_pct      integer;
    v_first    numeric;
    v_rate     numeric := public.fin_setting_num('orders.service_fee_rate');
    v_fee      numeric;
    v_now      timestamp := public.hall_dakar_now();
    v_prep     integer;
    v_asap     boolean;
    v_at       timestamp;
    v_today    date := public.hall_dakar_now()::date;
    v_daily    boolean := FALSE;
    v_need     record;
    v_left     integer;
    v_address  text;
    v_phone    text;
    v_label    text;
    v_table    uuid := public.try_uuid(NULLIF(p->>'onsite_table_id', ''));
    v_zone     uuid := public.try_uuid(NULLIF(p->>'zone_id', ''));
    v_zone_id  uuid;
    v_zone_nm  text;
BEGIN
    IF NOT public.fin_setting_bool('features.orders_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SERVICE_CLOSED', 'message', 'Les commandes ne sont pas encore ouvertes.');
    END IF;
    SELECT ve.*, pa.status::text AS partner_status, pa.user_id AS owner_id INTO v
      FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id WHERE ve.id = v_venue_id;
    IF v_venue_id IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_FOUND', 'message', 'Cet établissement n’existe pas ou n’est plus proposé.');
    END IF;
    IF NOT v.is_active OR v.validation_status <> 'VALIDEE' OR v.partner_status <> 'VALIDE' OR NOT v.orders_open THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_AVAILABLE', 'message', 'Cet établissement ne prend pas de commande pour le moment.');
    END IF;
    IF v_mode NOT IN ('LIVRAISON', 'RETRAIT', 'SUR_PLACE') OR NOT (v_mode = ANY (v.order_modes)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'MODE_NOT_AVAILABLE', 'message', 'Ce mode de remise n’est pas proposé par cet établissement.');
    END IF;
    IF v_pay NOT IN ('INTEGRAL', 'ACOMPTE', 'DIFFERE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PAYMENT', 'message', 'Choisissez de payer tout, un acompte ou à la remise.');
    END IF;
    IF v_pay = 'ACOMPTE' AND NOT v.order_deposit_allowed THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DEPOSIT_NOT_ALLOWED', 'message', 'Cet établissement ne propose pas l’acompte : payez la commande en entier.');
    END IF;
    IF v_pay = 'DIFFERE' AND NOT v.order_pay_on_handover THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PAY_ON_HANDOVER_NOT_ALLOWED', 'message', 'Cet établissement n’accepte pas le paiement à la remise : payez en ligne.');
    END IF;

    -- Lignes : produits de cet établissement, disponibles, jamais réglementés ; prix et suppléments relus en base
    IF jsonb_typeof(p->'items') <> 'array' OR jsonb_array_length(p->'items') < 1 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMPTY_CART', 'message', 'Votre panier est vide.');
    END IF;
    IF jsonb_array_length(p->'items') > 30 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CART_TOO_BIG', 'message', '30 lignes au plus par commande.');
    END IF;
    FOR it IN SELECT * FROM jsonb_array_elements(p->'items') LOOP
        BEGIN
            v_qty := (it->>'quantity')::int;
            v_opt_ids := CASE WHEN jsonb_typeof(it->'option_ids') = 'array'
                              THEN ARRAY(SELECT (x)::uuid FROM jsonb_array_elements_text(it->'option_ids') x) ELSE ARRAY[]::uuid[] END;
        EXCEPTION WHEN others THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ITEM', 'message', 'Une ligne du panier n’est pas valable.');
        END;
        IF v_qty IS NULL OR v_qty < 1 OR v_qty > 99 OR (it->>'quantity') !~ '^[0-9]+$' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_QUANTITY', 'message', 'Choisissez une quantité entre 1 et 99.');
        END IF;
        SELECT * INTO pr FROM public.products WHERE id = public.try_uuid(it->>'product_id');
        IF NOT FOUND OR pr.venue_id IS DISTINCT FROM v.id OR pr.partner_id <> v.partner_id THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_NOT_FOUND', 'message', 'Un produit du panier n’est pas proposé par cet établissement.');
        END IF;
        -- Lot 12c : produit archivé (retiré de la carte par la partenaire, gardé pour l'historique)
        IF pr.archived_at IS NOT NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_UNAVAILABLE', 'product_id', pr.id,
                'message', format('« %s » n’est plus disponible.', pr.name));
        END IF;
        -- Décision du client : un produit réglementé (alcool, tabac) n'est jamais commandé, payé ni livré en ligne
        IF pr.is_regulated OR COALESCE(pr.regulated_admin, FALSE) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'REGULATED_PRODUCT', 'product_id', pr.id,
                'message', format('« %s » est un produit réglementé : il ne se commande pas en ligne. Achetez-le sur place.', pr.name));
        END IF;
        -- Lot 12c : produit « à vérifier » (un mot de orders.review_keywords) : non vendable jusqu'à la décision de
        -- l'administration (product_regulated le dit aussi pour le paiement, l'acceptation et la remise)
        IF pr.review_state IS NOT NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_UNDER_REVIEW', 'product_id', pr.id,
                'message', format('« %s » est en cours de vérification par Event Village : il ne se commande pas encore en ligne.', pr.name));
        END IF;
        IF pr.status::text <> 'DISPONIBLE' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_UNAVAILABLE', 'product_id', pr.id,
                'message', format('« %s » n’est plus disponible.', pr.name));
        END IF;
        IF pr.price <> trunc(pr.price) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_UNAVAILABLE', 'product_id', pr.id,
                'message', format('« %s » n’est plus disponible.', pr.name));
        END IF;
        IF (SELECT count(*) FROM unnest(v_opt_ids) x) <> (SELECT count(DISTINCT x) FROM unnest(v_opt_ids) x)
           OR (SELECT count(*) FROM unnest(v_opt_ids) x) > 10 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_OPTION', 'message', 'Un supplément choisi n’est pas valable.');
        END IF;
        v_opts := '[]'::jsonb;
        v_opt_sum := 0;
        FOR op IN SELECT o.* FROM public.product_options o WHERE o.id = ANY (v_opt_ids) ORDER BY o.sort_order, o.id LOOP
            IF op.product_id <> pr.id OR NOT op.is_active THEN
                RETURN jsonb_build_object('ok', false, 'code', 'INVALID_OPTION', 'message', 'Un supplément choisi n’est pas valable.');
            END IF;
            v_opts := v_opts || jsonb_build_object('id', op.id, 'name', op.name, 'price', op.price_delta);
            v_opt_sum := v_opt_sum + op.price_delta;
        END LOOP;
        IF jsonb_array_length(v_opts) <> COALESCE(array_length(v_opt_ids, 1), 0) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_OPTION', 'message', 'Un supplément choisi n’est pas valable.');
        END IF;
        v_unit := pr.price + v_opt_sum;
        v_daily := v_daily OR pr.is_daily_special;
        v_lines := v_lines || jsonb_build_object(
            'product_id', pr.id, 'name', pr.name, 'quantity', v_qty, 'base_price', pr.price, 'options', v_opts,
            'unit_price', v_unit, 'total_price', v_unit * v_qty, 'daily', pr.is_daily_special,
            'stock_managed', pr.is_stock_managed AND pr.stock_quantity IS NOT NULL,
            'notes', NULLIF(left(btrim(regexp_replace(COALESCE(it->>'notes', ''), '[[:cntrl:]]', ' ', 'g')), 200), ''));
        v_items := v_items + v_unit * v_qty;
    END LOOP;
    IF v_items <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOTHING_TO_ORDER', 'message', 'Le montant de la commande doit être supérieur à 0.');
    END IF;

    -- Stock et portions du jour (relus ici ; pris sous verrou par order_create)
    FOR v_need IN SELECT (l->>'product_id')::uuid AS product_id, sum((l->>'quantity')::int)::int AS qty,
                         bool_or((l->>'daily')::boolean) AS daily, bool_or((l->>'stock_managed')::boolean) AS managed
                    FROM jsonb_array_elements(v_lines) l GROUP BY 1 ORDER BY 1 LOOP
        SELECT * INTO pr FROM public.products WHERE id = v_need.product_id;
        -- Contre-vérification (T3) : 99 au plus par produit sur toute la commande (le même produit peut revenir sur
        -- plusieurs lignes, avec d'autres suppléments)
        IF v_need.qty > 99 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_QUANTITY', 'product_id', pr.id,
                'message', format('Au plus 99 « %s » par commande.', pr.name));
        END IF;
        IF v_need.managed AND pr.stock_quantity < v_need.qty THEN
            RETURN jsonb_build_object('ok', false, 'code', 'OUT_OF_STOCK', 'product_id', pr.id,
                'message', CASE WHEN pr.stock_quantity <= 0 THEN format('« %s » est épuisé.', pr.name)
                                ELSE format('Il reste %s « %s ».', pr.stock_quantity, pr.name) END);
        END IF;
        IF v_need.daily THEN
            SELECT portions - sold INTO v_left FROM public.product_daily_portions WHERE product_id = pr.id AND day = v_today;
            IF COALESCE(v_left, 0) < v_need.qty THEN
                RETURN jsonb_build_object('ok', false, 'code', 'NO_PORTIONS_LEFT', 'product_id', pr.id,
                    'message', CASE WHEN COALESCE(v_left, 0) <= 0 THEN format('Plus de « %s » aujourd’hui.', pr.name)
                                    ELSE format('Il reste %s portions de « %s » aujourd’hui.', v_left, pr.name) END);
            END IF;
        END IF;
    END LOOP;

    -- Plat du jour : toujours payé en entier (décision du client)
    IF v_daily AND v_pay <> 'INTEGRAL' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DAILY_SPECIAL_FULL_PAYMENT', 'message', 'Le plat du jour se paie en entier, en ligne.');
    END IF;

    -- Mode de remise
    IF v_mode = 'LIVRAISON' THEN
        SELECT * INTO z FROM public.order_delivery_zones WHERE id = v_zone AND venue_id = v.id AND is_active;
        IF v_zone IS NULL OR NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'ZONE_NOT_FOUND', 'message', 'Choisissez une zone de livraison de cet établissement.');
        END IF;
        IF v_items < z.min_order THEN
            RETURN jsonb_build_object('ok', false, 'code', 'BELOW_MINIMUM', 'minimum', z.min_order,
                'message', format('Le minimum de commande pour la zone « %s » est de %s F CFA.', z.name,
                                  replace(to_char(z.min_order, 'FM999G999G999'), ',', ' ')));
        END IF;
        v_fee_zone := z.fee;
        v_zone_id := z.id;
        v_zone_nm := z.name;
        v_address := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'address', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
        IF v_address IS NULL OR length(v_address) < 5 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'ADDRESS_REQUIRED', 'message', 'Indiquez l’adresse de livraison (quartier, rue, repère).');
        END IF;
    END IF;
    v_phone := regexp_replace(COALESCE(p->>'phone', ''), '[^0-9+]', '', 'g');
    IF v_phone ~ '^(\+221|00221|221)?7[0-9]{8}$' THEN
        v_phone := '+221' || right(v_phone, 9);
    ELSIF v_phone = '' THEN
        v_phone := NULL;
    ELSE
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PHONE', 'message', 'Indiquez un numéro de mobile sénégalais (9 chiffres).');
    END IF;
    IF v_mode = 'LIVRAISON' AND v_phone IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PHONE_REQUIRED', 'message', 'Indiquez le numéro à appeler pour la livraison.');
    END IF;
    IF v_mode = 'SUR_PLACE' THEN
        v_label := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'onsite_label', ''), '[[:cntrl:]]', ' ', 'g')), 40), '');
        IF v_table IS NOT NULL THEN
            SELECT * INTO t FROM public.restaurant_tables WHERE id = v_table AND venue_id = v.id AND is_active;
            IF NOT FOUND THEN
                RETURN jsonb_build_object('ok', false, 'code', 'TABLE_NOT_FOUND', 'message', 'Cette table n’existe pas dans cet établissement.');
            END IF;
        ELSIF v_label IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'SPOT_REQUIRED', 'message', 'Indiquez votre table ou l’endroit où vous êtes.');
        END IF;
    ELSE
        v_table := NULL;
        v_label := NULL;
    END IF;

    -- Heure : au plus tôt (ouvert pendant toute la préparation) ou créneau au quart d'heure, dans les horaires, 7 jours au plus
    v_prep := COALESCE(v.order_prep_minutes, public.fin_setting_num('orders.prep_minutes_default')::int);
    v_asap := NULLIF(p->>'scheduled_for', '') IS NULL;
    IF v_asap THEN
        v_at := date_trunc('minute', v_now) + make_interval(mins => v_prep + 1);
        IF NOT public.venue_open_covers(v.id, tsrange(date_trunc('minute', v_now), v_at, '[)')) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'CLOSED_NOW', 'message', 'L’établissement est fermé en ce moment : choisissez une heure dans ses horaires.');
        END IF;
    ELSE
        BEGIN
            v_at := (p->>'scheduled_for')::timestamp;
        EXCEPTION WHEN others THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TIME', 'message', 'L’heure choisie n’est pas valable.');
        END;
        IF EXTRACT(SECOND FROM v_at) <> 0 OR EXTRACT(MINUTE FROM v_at)::int % 15 <> 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TIME', 'message', 'Choisissez une heure au quart d’heure près (par exemple 12:00, 12:15 ou 12:30).');
        END IF;
        IF v_at < v_now + make_interval(mins => v_prep) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TOO_SOON', 'message',
                format('La préparation prend %s minutes : choisissez une heure plus tardive, ou « au plus tôt ».', v_prep));
        END IF;
        IF v_at > v_now + interval '7 days' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TOO_FAR', 'message', 'Choisissez une heure dans les 7 jours à venir.');
        END IF;
        IF NOT public.venue_open_covers(v.id, tsrange(v_at, v_at + interval '1 minute', '[)')) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'OUTSIDE_HOURS', 'message', 'L’établissement n’est pas ouvert à cette heure-là. Choisissez une autre heure.');
        END IF;
    END IF;
    -- Fermeture exceptionnelle (venue_closures, lot 11b) pendant la préparation, pour « au plus tôt » comme pour une
    -- heure choisie : la cuisine est fermée, la commande ne peut pas être prête
    IF public.venue_closed_during(v.id, tsrange(
            CASE WHEN v_asap THEN date_trunc('minute', v_now) ELSE v_at - make_interval(mins => v_prep) END,
            v_at + interval '1 minute', '[)')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_CLOSED', 'message', 'Ce restaurant est fermé à ce moment-là. Choisissez une autre heure.');
    END IF;
    -- Plat du jour : pour aujourd'hui seulement ; il s'arrête seul à la fin du jour
    IF v_daily AND v_at::date <> v_today THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DAILY_SPECIAL_TODAY_ONLY', 'message', 'Le plat du jour se commande pour aujourd’hui seulement.');
    END IF;

    -- Argent (F CFA entiers) : articles + frais de zone ; part payée en ligne au départ ; frais de service arrondis
    -- au franc supérieur, sur ce qui est payé en ligne seulement
    v_goods := v_items + v_fee_zone;
    v_pct := CASE WHEN v_pay = 'ACOMPTE' THEN COALESCE(v.order_deposit_percent, public.fin_setting_num('orders.deposit_default_percent')::int) END;
    v_first := CASE v_pay WHEN 'INTEGRAL' THEN v_goods WHEN 'ACOMPTE' THEN public.fin_round_up(v_goods * v_pct / 100.0) ELSE 0 END;
    v_fee := public.fin_round_up(v_first * v_rate / 100);

    RETURN jsonb_build_object(
        'ok', true, 'venue_id', v.id, 'venue_name', v.name, 'partner_id', v.partner_id, 'owner_id', v.owner_id,
        'mode', v_mode, 'payment', v_pay, 'lines', v_lines, 'zone_id', v_zone_id, 'zone_name', v_zone_nm,
        'address', v_address, 'phone', v_phone, 'onsite_table_id', v_table, 'onsite_label', v_label,
        'asap', v_asap, 'scheduled_for', v_at AT TIME ZONE 'Africa/Dakar', 'prep_minutes', v_prep, 'daily', v_daily,
        'items_amount', v_items, 'delivery_fee', v_fee_zone, 'goods_total', v_goods, 'deposit_percent', v_pct,
        'first_goods', v_first, 'service_fee_rate', v_rate, 'first_fee', v_fee, 'to_pay_now', v_first + v_fee,
        'balance_due', v_goods - v_first,
        'notes', NULLIF(left(btrim(regexp_replace(COALESCE(p->>'notes', ''), '[[:cntrl:]]', ' ', 'g')), 300), ''));
END;
$$;

REVOKE ALL ON FUNCTION public.order_quote_compute(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_quote_compute(jsonb) TO service_role;
