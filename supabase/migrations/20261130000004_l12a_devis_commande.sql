-- ============================================================================
-- EVENT VILLAGE — LOT 12a, migration 04 : devis et création d'une commande (tout calculé et verrouillé en base)
-- ============================================================================
-- Trous de l'existant (rapport § 1) : total calculé par la route, produit d'une autre partenaire accepté, aucun produit
-- réglementé refusé, quantité négative ou nulle non refusée, aucun stock ni portion, aucun plafond.
--  1. aides : verrous (établissement, client, portions), données et envoi des avis (order_notif_data, order_notify :
--     jamais le code de remise, envoyé à part par la route), historique des états
--     (order_log_state), clôture du stock et des portions (order_release_stock) ;
--  2. order_quote_compute(p) : devis complet en base (établissement validé et ouvert à la vente, partenaire VALIDE,
--     mode de remise accepté, produits de cet établissement, disponibles, jamais réglementés, quantités 1 à 99,
--     suppléments du produit, stock, portions du jour, zone et minimum de commande, adresse et téléphone pour une
--     livraison, table ou zone pour une commande sur place, heure « au plus tôt » ou créneau dans les horaires,
--     mode de paiement accepté, plat du jour payé en entier) ; aucun montant n'est lu dans la requête ;
--  3. order_quote(p) : le devis seul (lecture, rien n'est tenu) ;
--  4. order_create(p) : sous le verrou de l'établissement puis du client : compte actif, pas sa propre partenaire,
--     plafond des commandes non payées (orders.max_unpaid_per_client), devis refait, stock et portions pris une seule
--     fois (verrous dans un ordre fixe), commande et lignes aux prix figés, historique ; en attente de paiement
--     (15 minutes) ou, payée à la remise, reçue et transmise à la partenaire.
-- Toutes réservées au rôle de service (routes serveur). Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- Heure de Dakar = UTC toute l'année.
-- ============================================================================

-- Contre-vérification (T7) : aides internes dans le schéma private (non exposé par l'API, hors de la règle 1A.3) ;
-- anciennes versions publiques retirées
DROP FUNCTION IF EXISTS public.order_log_state(uuid, text, text, uuid, text, text);
DROP FUNCTION IF EXISTS public.order_release_stock(uuid);

-- ----------------------------------------------------------------------------
-- 1. Aides
-- ----------------------------------------------------------------------------
-- Verrou d'un établissement : une écriture de commande à la fois (fin de transaction). Toujours pris AVANT celui du
-- client, puis des portions (ordre fixe : aucun interblocage)
CREATE OR REPLACE FUNCTION public.order_venue_lock(p_venue_id uuid)
RETURNS void
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$ SELECT pg_advisory_xact_lock(hashtextextended('orders:' || p_venue_id::text, 0)) $$;

CREATE OR REPLACE FUNCTION public.order_client_lock(p_client_id uuid)
RETURNS void
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$ SELECT pg_advisory_xact_lock(hashtextextended('order_client:' || p_client_id::text, 0)) $$;

-- Commande sous le verrou de son établissement ; NULL si introuvable (ou commande de billets)
CREATE OR REPLACE FUNCTION public.order_lock(p_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_venue uuid;
BEGIN
    SELECT venue_id INTO v_venue FROM public.orders WHERE id = p_order_id;
    IF v_venue IS NULL THEN
        RETURN NULL;
    END IF;
    PERFORM public.order_venue_lock(v_venue);
    RETURN v_venue;
END;
$$;

-- Données des avis d'une commande (montants en F CFA, heures en UTC = Dakar) ; jamais l'adresse ni le téléphone
CREATE OR REPLACE FUNCTION public.order_notif_data(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_strip_nulls(jsonb_build_object(
        'order_id', o.id,
        'order_number', o.order_number,
        'venue_id', o.venue_id,
        'venue_name', v.name,
        'mode', o.delivery_mode::text,
        'state', o.order_state,
        'items_count', (SELECT COALESCE(sum(i.quantity), 0) FROM public.order_items i WHERE i.order_id = o.id),
        'goods_total', o.goods_total,
        'paid_amount', o.paid_amount,
        'balance_due', o.goods_total - o.paid_goods - COALESCE(o.onsite_amount, 0),
        'payment_type', o.payment_type::text,
        'scheduled_for', o.scheduled_for,
        'estimated_at', o.estimated_at,
        'response_due_at', CASE WHEN o.order_state = 'RECUE' THEN o.response_due_at END,
        'zone_name', z.name,
        'onsite_label', COALESCE(t.table_number, o.onsite_label)))
      FROM public.orders o
      JOIN public.venues v ON v.id = o.venue_id
      LEFT JOIN public.order_delivery_zones z ON z.id = o.zone_id
      LEFT JOIN public.restaurant_tables t ON t.id = o.onsite_table_id
     WHERE o.id = p_order_id;
$$;

-- Avis d'une étape : au client ('CLIENT'), à la partenaire propriétaire ('OWNER') ou au livreur de la commande
-- ('COURIER') ; une fois par type, commande et destinataire (p_ref distingue un avis répété). p_channels : canaux voulus
-- (vide = tous ceux du registre) ; sert quand le SMS de l'étape est le code de remise, envoyé tout de suite par la route
-- (ORDER_HANDOVER_CODE). Le code n'entre jamais dans la boîte d'envoi (contrainte notification_outbox_no_secret_chk).
CREATE OR REPLACE FUNCTION public.order_notify(p_type text, p_order_id uuid, p_to text, p_extra jsonb DEFAULT '{}'::jsonb,
                                               p_ref text DEFAULT NULL, p_channels text[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid;
    v_req  jsonb;
BEGIN
    IF p_to = 'CLIENT' THEN
        SELECT o.client_id INTO v_user FROM public.orders o WHERE o.id = p_order_id;
    ELSIF p_to = 'COURIER' THEN
        SELECT o.courier_user_id INTO v_user FROM public.orders o WHERE o.id = p_order_id;
    ELSE
        SELECT pa.user_id INTO v_user FROM public.orders o JOIN public.partners pa ON pa.id = o.partner_id WHERE o.id = p_order_id;
    END IF;
    IF v_user IS NULL THEN
        RETURN 0;
    END IF;
    v_req := jsonb_build_object(
        'type', p_type, 'key', p_type || ':' || p_order_id::text || ':' || v_user::text || COALESCE(':' || p_ref, ''),
        'user_id', v_user,
        'data', COALESCE(public.order_notif_data(p_order_id), '{}'::jsonb) || jsonb_build_object('recipient_role', p_to)
                || COALESCE(p_extra, '{}'::jsonb));
    IF p_channels IS NOT NULL THEN
        v_req := v_req || jsonb_build_object('channels', to_jsonb(p_channels));
    END IF;
    RETURN COALESCE(public.notif_enqueue(v_req), 0);
END;
$$;

-- Historique d'un changement d'état (dans la transaction de la fonction qui le fait)
CREATE OR REPLACE FUNCTION private.order_log_state(p_order_id uuid, p_from text, p_to text, p_actor uuid, p_role text, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM set_config('event_village.order_flow', 'on', true);
    INSERT INTO public.order_state_history (order_id, from_state, to_state, actor_id, actor_role, note)
    VALUES (p_order_id, p_from, p_to, p_actor, p_role, NULLIF(left(COALESCE(p_note, ''), 300), ''));
END;
$$;

-- Stock et portions d'une commande rendus, une seule fois (stock_released_at) ; jamais après la remise
CREATE OR REPLACE FUNCTION private.order_release_stock(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    o  record;
    it record;
BEGIN
    SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND OR NOT o.stock_taken OR o.stock_released_at IS NOT NULL OR o.order_state = 'REMISE' THEN
        RETURN FALSE;
    END IF;
    PERFORM set_config('event_village.order_flow', 'on', true);
    -- Même ordre de verrous que la prise : portions par produit et jour, puis produits par identifiant
    FOR it IN SELECT product_id, portion_day, sum(quantity)::int AS qty FROM public.order_items
               WHERE order_id = o.id AND portion_day IS NOT NULL GROUP BY product_id, portion_day ORDER BY product_id, portion_day LOOP
        PERFORM pg_advisory_xact_lock(hashtextextended('order_portions:' || it.product_id::text || ':' || it.portion_day::text, 0));
        UPDATE public.product_daily_portions SET sold = GREATEST(sold - it.qty, 0), updated_at = now()
         WHERE product_id = it.product_id AND day = it.portion_day;
    END LOOP;
    FOR it IN SELECT i.product_id, sum(i.quantity)::int AS qty FROM public.order_items i
               WHERE i.order_id = o.id AND i.stock_managed GROUP BY i.product_id ORDER BY i.product_id LOOP
        UPDATE public.products
           SET stock_quantity = stock_quantity + it.qty,
               status = CASE WHEN status = 'EPUISE' THEN 'DISPONIBLE'::public.product_status ELSE status END,
               updated_at = now()
         WHERE id = it.product_id AND is_stock_managed AND stock_quantity IS NOT NULL;
    END LOOP;
    UPDATE public.orders SET stock_released_at = now(), updated_at = now() WHERE id = o.id;
    RETURN TRUE;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Devis
-- ----------------------------------------------------------------------------
-- Rend { ok: true, ... } avec les lignes et les montants, ou { ok: false, code, message } (français simple).
-- p : venue_id, mode (LIVRAISON | RETRAIT | SUR_PLACE), payment (INTEGRAL | ACOMPTE | DIFFERE), items
-- [{ product_id, quantity, option_ids[], notes }], zone_id, address, phone, onsite_table_id, onsite_label,
-- scheduled_for (« AAAA-MM-JJTHH:MM », heure de Dakar ; absent = au plus tôt).
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
        -- Décision du client : un produit réglementé (alcool, tabac) n'est jamais commandé, payé ni livré en ligne
        IF pr.is_regulated OR COALESCE(pr.regulated_admin, FALSE) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'REGULATED_PRODUCT', 'product_id', pr.id,
                'message', format('« %s » est un produit réglementé : il ne se commande pas en ligne. Achetez-le sur place.', pr.name));
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

-- ----------------------------------------------------------------------------
-- 3. Devis seul (rien n'est tenu)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_quote(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    q jsonb := public.order_quote_compute(p);
BEGIN
    IF (q->>'ok')::boolean THEN
        RETURN q - 'owner_id' - 'partner_id' - 'address' - 'phone';
    END IF;
    RETURN q;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Créer la commande
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client   uuid := public.try_uuid(p->>'client_id');
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    q          jsonb;
    l          jsonb;
    v_need     record;
    v_unpaid   integer;
    v_max      integer := public.fin_setting_num('orders.max_unpaid_per_client')::int;
    v_max_portions integer := public.fin_setting_num('orders.max_unpaid_portions')::int;
    v_held     integer;
    v_state    text;
    v_id       uuid;
    v_number   text;
    v_today    date := public.hall_dakar_now()::date;
    v_hold     timestamptz;
    v_due      timestamptz;
    v_rows     integer;
BEGIN
    IF NOT public.fin_setting_bool('features.orders_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SERVICE_CLOSED', 'message', 'Les commandes ne sont pas encore ouvertes.');
    END IF;
    IF v_client IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_client AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte ne permet pas de commander pour le moment.');
    END IF;
    IF v_venue_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.venues WHERE id = v_venue_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_FOUND', 'message', 'Cet établissement n’existe pas ou n’est plus proposé.');
    END IF;

    -- Verrous dans l'ordre fixe : établissement, puis client ; commandes non payées échues closes d'abord
    PERFORM public.order_venue_lock(v_venue_id);
    PERFORM public.order_client_lock(v_client);

    q := public.order_quote_compute(p);
    IF NOT (q->>'ok')::boolean THEN
        RETURN q;
    END IF;
    IF (q->>'owner_id')::uuid = v_client THEN
        RETURN jsonb_build_object('ok', false, 'code', 'OWN_VENUE', 'message', 'Vous ne pouvez pas commander dans votre propre établissement.');
    END IF;

    -- Plafond des commandes non payées : en attente de paiement (attente en cours), ou payables à la remise et pas
    -- encore remises
    SELECT count(*) INTO v_unpaid FROM public.orders
     WHERE client_id = v_client AND venue_id IS NOT NULL
       AND ((order_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at > now())
            OR (order_state IN ('RECUE', 'ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE') AND paid_goods = 0));
    IF v_unpaid >= v_max THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_UNPAID',
            'message', format('Vous avez déjà %s commandes non payées. Payez-en une ou attendez qu’elle se termine.', v_unpaid));
    END IF;

    -- Contre-vérification (T3) : portions d'un plat du jour tenues sans paiement, par client et par plat, au plus
    -- orders.max_unpaid_portions (commandes non payées comptées comme pour le plafond ci-dessus ; verrou du client tenu)
    FOR v_need IN SELECT (x->>'product_id')::uuid AS product_id, min(x->>'name') AS name, sum((x->>'quantity')::int)::int AS qty
                    FROM jsonb_array_elements(q->'lines') x WHERE (x->>'daily')::boolean GROUP BY 1 ORDER BY 1 LOOP
        SELECT COALESCE(sum(i.quantity), 0)::int INTO v_held
          FROM public.order_items i JOIN public.orders o ON o.id = i.order_id
         WHERE o.client_id = v_client AND o.venue_id IS NOT NULL AND i.product_id = v_need.product_id AND i.portion_day = v_today
           AND ((o.order_state = 'EN_ATTENTE_PAIEMENT' AND o.hold_expires_at > now())
                OR (o.order_state IN ('RECUE', 'ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE') AND o.paid_goods = 0));
        IF v_held + v_need.qty > v_max_portions THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_PORTIONS', 'product_id', v_need.product_id,
                'message', CASE WHEN v_held > 0
                    THEN format('Vous tenez déjà %s portions de « %s » sans les avoir payées : %s au plus. Payez votre commande en cours ou attendez qu’elle se termine.', v_held, v_need.name, v_max_portions)
                    ELSE format('Au plus %s portions de « %s » par commande non payée.', v_max_portions, v_need.name) END);
        END IF;
    END LOOP;

    PERFORM set_config('event_village.order_flow', 'on', true);

    -- Stock et portions pris une seule fois, dans un ordre fixe (portions par produit, puis produits par identifiant)
    FOR v_need IN SELECT (x->>'product_id')::uuid AS product_id, sum((x->>'quantity')::int)::int AS qty
                    FROM jsonb_array_elements(q->'lines') x WHERE (x->>'daily')::boolean GROUP BY 1 ORDER BY 1 LOOP
        PERFORM pg_advisory_xact_lock(hashtextextended('order_portions:' || v_need.product_id::text || ':' || v_today::text, 0));
        UPDATE public.product_daily_portions SET sold = sold + v_need.qty, updated_at = now()
         WHERE product_id = v_need.product_id AND day = v_today AND portions - sold >= v_need.qty;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows <> 1 THEN
            RAISE EXCEPTION USING ERRCODE = 'OR409', MESSAGE = 'NO_PORTIONS_LEFT';
        END IF;
    END LOOP;
    FOR v_need IN SELECT (x->>'product_id')::uuid AS product_id, sum((x->>'quantity')::int)::int AS qty
                    FROM jsonb_array_elements(q->'lines') x WHERE (x->>'stock_managed')::boolean GROUP BY 1 ORDER BY 1 LOOP
        UPDATE public.products
           SET stock_quantity = stock_quantity - v_need.qty,
               status = CASE WHEN stock_quantity - v_need.qty = 0 THEN 'EPUISE'::public.product_status ELSE status END,
               updated_at = now()
         WHERE id = v_need.product_id AND is_stock_managed AND stock_quantity >= v_need.qty AND status = 'DISPONIBLE';
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows <> 1 THEN
            RAISE EXCEPTION USING ERRCODE = 'OR409', MESSAGE = 'OUT_OF_STOCK';
        END IF;
    END LOOP;

    IF (q->>'to_pay_now')::numeric > 0 THEN
        v_state := 'EN_ATTENTE_PAIEMENT';
        v_hold := now() + make_interval(mins => public.fin_setting_num('orders.hold_minutes')::int);
    ELSE
        v_state := 'RECUE';
        v_due := now() + make_interval(mins => public.fin_setting_num('orders.response_minutes')::int);
    END IF;
    v_number := 'CMD-' || to_char(now() AT TIME ZONE 'Africa/Dakar', 'YYMMDD') || '-' || upper(encode(extensions.gen_random_bytes(3), 'hex'));

    INSERT INTO public.orders (
        order_number, client_id, partner_id, venue_id, order_state, delivery_mode, payment_type, zone_id,
        onsite_table_id, onsite_label, delivery_address, delivery_notes, contact_phone, asap, scheduled_for, estimated_at, prep_minutes,
        subtotal, items_amount, delivery_fee, goods_total, deposit_percent, first_goods, first_fee, service_fee_rate,
        commission_rate, service_fee, total_amount, paid_amount, balance_amount, paid_goods, paid_fees, payment_status,
        stock_taken, hold_expires_at, response_due_at, received_at)
    VALUES (
        v_number, v_client, (q->>'partner_id')::uuid, (q->>'venue_id')::uuid, v_state, (q->>'mode')::public.delivery_mode_enum,
        (q->>'payment')::public.payment_type_enum, (q->>'zone_id')::uuid,
        (q->>'onsite_table_id')::uuid, q->>'onsite_label', q->>'address', q->>'notes', q->>'phone',
        (q->>'asap')::boolean, (q->>'scheduled_for')::timestamptz, (q->>'scheduled_for')::timestamptz, (q->>'prep_minutes')::int,
        (q->>'items_amount')::numeric, (q->>'items_amount')::numeric, (q->>'delivery_fee')::numeric, (q->>'goods_total')::numeric,
        (q->>'deposit_percent')::int, (q->>'first_goods')::numeric, (q->>'first_fee')::numeric, (q->>'service_fee_rate')::numeric,
        public.fin_setting_num('orders.commission_rate'), (q->>'first_fee')::numeric,
        (q->>'goods_total')::numeric + (q->>'first_fee')::numeric, 0, (q->>'goods_total')::numeric, 0, 0, 'PENDING',
        TRUE, v_hold, v_due, CASE WHEN v_state = 'RECUE' THEN now() END)
    RETURNING id INTO v_id;

    FOR l IN SELECT * FROM jsonb_array_elements(q->'lines') LOOP
        INSERT INTO public.order_items (order_id, product_id, product_name, quantity, base_price, options, unit_price, total_price,
                                        notes, portion_day, stock_managed)
        VALUES (v_id, (l->>'product_id')::uuid, l->>'name', (l->>'quantity')::int, (l->>'base_price')::numeric, l->'options',
                (l->>'unit_price')::numeric, (l->>'total_price')::numeric, l->>'notes',
                CASE WHEN (l->>'daily')::boolean THEN v_today END, (l->>'stock_managed')::boolean);
    END LOOP;

    PERFORM private.order_log_state(v_id, NULL, v_state, v_client, 'CLIENT', 'Commande passée');
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value, metadata)
    VALUES (v_client, 'CLIENT', 'ORDER_CREATED', 'orders', v_id,
            jsonb_build_object('order_state', v_state, 'goods_total', q->'goods_total', 'to_pay_now', q->'to_pay_now'),
            jsonb_build_object('venue_id', q->'venue_id', 'mode', q->'mode', 'payment', q->'payment', 'lines', jsonb_array_length(q->'lines')));

    IF v_state = 'RECUE' THEN
        PERFORM public.order_notify('ORDER_RECEIVED', v_id, 'CLIENT');
        PERFORM public.order_notify('ORDER_NEW', v_id, 'OWNER');
    END IF;

    RETURN jsonb_build_object('ok', true, 'order_id', v_id, 'order_number', v_number, 'order_state', v_state,
                              'hold_expires_at', v_hold, 'response_due_at', v_due)
           || (q - 'ok' - 'owner_id' - 'partner_id' - 'address' - 'phone' - 'lines' - 'notes')
           || jsonb_build_object('lines', (SELECT jsonb_agg(x - 'stock_managed' - 'daily') FROM jsonb_array_elements(q->'lines') x));
EXCEPTION WHEN SQLSTATE 'OR409' THEN
    -- Stock ou portions pris entre le devis et la prise (impossible sous les verrous ; défense en profondeur)
    RETURN jsonb_build_object('ok', false, 'code', SQLERRM,
        'message', CASE SQLERRM WHEN 'NO_PORTIONS_LEFT' THEN 'Plus assez de portions du plat du jour.' ELSE 'Un produit du panier vient d’être épuisé.' END);
END;
$$;

REVOKE ALL ON FUNCTION public.order_venue_lock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_client_lock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_lock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_notif_data(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_notify(text, uuid, text, jsonb, text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.order_log_state(uuid, text, text, uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_release_stock(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.order_quote_compute(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_quote(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_create(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_venue_lock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_client_lock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_lock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_notif_data(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_notify(text, uuid, text, jsonb, text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_quote_compute(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_quote(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_create(jsonb) TO service_role;
