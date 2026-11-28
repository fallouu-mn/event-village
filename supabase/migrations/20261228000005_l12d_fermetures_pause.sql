-- ============================================================================
-- EVENT VILLAGE — LOT 12d, migration 05 : fermetures exceptionnelles, pause des commandes, allergènes et piment
-- ============================================================================
-- Relevé de l'existant (revérifié le 27/11 sur main f7bf7ad94) : le devis du 12c refuse une heure qui tombe dans une
-- fermeture (VENUE_CLOSED, 20261224000003) mais une commande déjà créée dont l'heure tombe dans une fermeture posée
-- ensuite pouvait encore être payée (order_payable_refusal ne regarde pas les fermetures : constat T2 bis du 12b) ; la
-- partenaire qui pose une fermeture ne voit pas les commandes déjà prévues dedans ; aucune pause des commandes ; aucun
-- allergène ni piment sur un produit.
--  1. order_payable_refusal : recopie de 20261130000005_l12a_paiement.sql:27-55 (dernière définition ; aucune autre
--     migration ne la redéfinit) ; changement (lignes ajoutées seulement) : paiement refusé (VENUE_CLOSED) quand l'heure
--     de la commande, préparation comprise, tombe dans une fermeture exceptionnelle (à la création du paiement comme à sa
--     confirmation : order_payment_create et order_payment_confirm l'appellent) ;
--  2. private.order_closure_hits(fermeture) : commandes transmises et ouvertes (reçue, acceptée, en préparation, prête)
--     de l'établissement dont l'heure, préparation comprise, touche la fermeture ;
--     order_closure_orders(p) : la partenaire propriétaire lit ces commandes (gardées ou non) ; order_closure_keep(p) :
--     « Garder » une commande (une fois) ; « Annuler et rembourser » passe par order_partner_action ANNULER (motif) ;
--     rien d'automatique ; déclencheur sur venue_closures : une fermeture posée avec des commandes prévues dedans prévient
--     la partenaire (cloche, notification du téléphone) ;
--  3. order_venue_pause(p) : « Plus de commandes pendant 15, 30 ou 60 minutes » (0 = reprendre tout de suite) ;
--     order_partner_pauses(p) : pause en cours de chaque établissement de la partenaire ;
--  4. private.order_pause_refusal(établissement) (aide NOUVELLE) et deux enveloppes recopiées : order_quote
--     (20261130000004_l12a_devis_commande.sql:461-476, devis des routes) et order_create_checked
--     (20261226000003_l12b_garde_prix.sql:52-104, création des routes) ; changement (lignes ajoutées seulement) : refus
--     ORDERS_PAUSED pendant la pause (« Ce restaurant fait une courte pause : il reprend les commandes à 13 h 30. »).
--     order_quote_compute n'est PAS recopiée : tests/audit/cv12c-3-statique.test.ts (S1) compare la recopie du 12c à la
--     dernière définition hors de son lot, qui serait alors celle du 12d (assertion d'audit intouchable) ;
--  5. order_venue_menu : recopie de 20261226000002_l12b_carte_des_plats.sql:44-192 (dernière définition) ; changements
--     (lignes ajoutées seulement) : fin de la pause en cours (ordering.paused_until, heure de Dakar) ; allergènes et
--     niveau de piment de chaque produit ;
--  6. order_product_details_set(p) : fonction NOUVELLE : la partenaire écrit les allergènes et le piment d'un de ses
--     produits (non archivé) ; aucune recopie d'order_product_save.
-- Fonctions publiques au seul rôle de service ; aides private à aucun rôle. Rejouable : CREATE OR REPLACE, DROP TRIGGER
-- IF EXISTS puis CREATE, REVOKE et GRANT idempotents. Aucun BEGIN ni COMMIT.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Paiement d'une commande (recopie de 20261130000005_l12a_paiement.sql:27-55)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_payable_refusal(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v record;
    v_name text;
    w record;
BEGIN
    SELECT ve.is_active, ve.validation_status, ve.orders_open, pa.status::text AS partner_status INTO v
      FROM public.orders o JOIN public.venues ve ON ve.id = o.venue_id JOIN public.partners pa ON pa.id = ve.partner_id
     WHERE o.id = p_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    IF NOT v.is_active OR v.validation_status <> 'VALIDEE' OR NOT v.orders_open OR v.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('code', 'VENUE_NOT_AVAILABLE', 'message', 'Cet établissement ne prend plus de commande pour le moment.');
    END IF;
    -- Lot 12d : heure de la commande dans une fermeture exceptionnelle (préparation comprise ; mêmes bornes que le devis
    -- du 12c, VENUE_CLOSED) : paiement refusé, à la création comme à la confirmation
    SELECT o.venue_id, o.scheduled_for, o.prep_minutes INTO w FROM public.orders o WHERE o.id = p_order_id;
    IF w.scheduled_for IS NOT NULL AND public.venue_closed_during(w.venue_id, tsrange(
            (w.scheduled_for AT TIME ZONE 'Africa/Dakar') - make_interval(mins => COALESCE(w.prep_minutes, 0)),
            (w.scheduled_for AT TIME ZONE 'Africa/Dakar') + interval '1 minute', '[)')) THEN
        RETURN jsonb_build_object('code', 'VENUE_CLOSED',
            'message', 'Ce restaurant est fermé à l’heure de votre commande : elle ne peut pas être payée. Refaites-la pour une autre heure.');
    END IF;
    SELECT i.product_name INTO v_name FROM public.order_items i
     WHERE i.order_id = p_order_id AND public.product_regulated(i.product_id) LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object('code', 'REGULATED_PRODUCT',
            'message', format('« %s » est un produit réglementé : il ne se commande pas en ligne.', v_name));
    END IF;
    RETURN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Commandes prévues pendant une fermeture exceptionnelle
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.order_closure_hits(p_closure_id uuid)
RETURNS TABLE (order_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT o.id
      FROM public.venue_closures c
      JOIN public.orders o ON o.venue_id = c.venue_id
     WHERE c.id = p_closure_id AND c.cancelled_at IS NULL
       AND o.received_at IS NOT NULL
       AND o.order_state IN ('RECUE', 'ACCEPTEE', 'EN_PREPARATION', 'PRETE')
       AND o.scheduled_for IS NOT NULL
       AND tsrange((o.scheduled_for AT TIME ZONE 'Africa/Dakar') - make_interval(mins => COALESCE(o.prep_minutes, 0)),
                   (o.scheduled_for AT TIME ZONE 'Africa/Dakar') + interval '1 minute', '[)') && c.period;
$$;

-- p : actor_id (partenaire propriétaire de l'établissement), closure_id. Rend { ok, closure, orders: [...] }.
CREATE OR REPLACE FUNCTION public.order_closure_orders(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_id     uuid := public.try_uuid(p->>'closure_id');
    c        record;
    v_orders jsonb;
BEGIN
    SELECT vc.*, ve.name AS venue_name, pa.user_id AS owner_id INTO c
      FROM public.venue_closures vc JOIN public.venues ve ON ve.id = vc.venue_id JOIN public.partners pa ON pa.id = ve.partner_id
     WHERE vc.id = v_id;
    IF v_id IS NULL OR NOT FOUND OR v_actor IS NULL OR c.owner_id IS DISTINCT FROM v_actor
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CLOSURE_NOT_FOUND', 'message', 'Fermeture introuvable.');
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', o.id, 'order_number', o.order_number, 'state', o.order_state, 'mode', o.delivery_mode::text,
               'scheduled_for', o.scheduled_for, 'goods_total', o.goods_total, 'paid', o.paid_goods + o.paid_fees,
               'items_count', (SELECT COALESCE(sum(i.quantity), 0) FROM public.order_items i WHERE i.order_id = o.id),
               'kept', EXISTS (SELECT 1 FROM public.order_closure_keeps k WHERE k.closure_id = c.id AND k.order_id = o.id)))
             ORDER BY o.scheduled_for, o.id), '[]'::jsonb)
      INTO v_orders
      FROM public.orders o WHERE o.id IN (SELECT h.order_id FROM private.order_closure_hits(c.id) h);
    RETURN jsonb_build_object('ok', true,
        'closure', jsonb_strip_nulls(jsonb_build_object('id', c.id, 'venue_id', c.venue_id, 'venue_name', c.venue_name,
                                                        'starts_at', to_char(c.starts_at, 'YYYY-MM-DD"T"HH24:MI'),
                                                        'ends_at', to_char(c.ends_at, 'YYYY-MM-DD"T"HH24:MI'),
                                                        'reason', c.reason, 'cancelled', c.cancelled_at IS NOT NULL)),
        'orders', v_orders);
END;
$$;

-- p : actor_id, closure_id, order_id : la partenaire garde la commande malgré la fermeture (une fois ; rien d'autre ne change)
CREATE OR REPLACE FUNCTION public.order_closure_keep(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_id     uuid := public.try_uuid(p->>'closure_id');
    v_order  uuid := public.try_uuid(p->>'order_id');
    c        record;
BEGIN
    SELECT vc.id, vc.venue_id, pa.user_id AS owner_id, pa.status::text AS partner_status INTO c
      FROM public.venue_closures vc JOIN public.venues ve ON ve.id = vc.venue_id JOIN public.partners pa ON pa.id = ve.partner_id
     WHERE vc.id = v_id;
    IF v_id IS NULL OR NOT FOUND OR v_actor IS NULL OR c.owner_id IS DISTINCT FROM v_actor
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CLOSURE_NOT_FOUND', 'message', 'Fermeture introuvable.');
    END IF;
    IF c.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre fiche est suspendue : vos commandes sont en lecture seule.');
    END IF;
    PERFORM public.order_venue_lock(c.venue_id);
    IF v_order IS NULL OR NOT EXISTS (SELECT 1 FROM private.order_closure_hits(c.id) h WHERE h.order_id = v_order) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Cette commande n’est plus prévue pendant la fermeture.');
    END IF;
    INSERT INTO public.order_closure_keeps (closure_id, order_id, kept_by) VALUES (c.id, v_order, v_actor)
    ON CONFLICT (closure_id, order_id) DO NOTHING;
    IF FOUND THEN
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
        VALUES (v_actor, 'PARTENAIRE', 'ORDER_KEPT_DURING_CLOSURE', 'orders', v_order, jsonb_build_object('closure_id', c.id));
    END IF;
    RETURN jsonb_build_object('ok', true, 'order_id', v_order, 'kept', true);
END;
$$;

-- Fermeture posée : la partenaire est prévenue quand des commandes sont déjà prévues dedans (cloche, notification)
CREATE OR REPLACE FUNCTION private.order_closure_notify()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
    v       record;
BEGIN
    IF NEW.cancelled_at IS NOT NULL THEN
        RETURN NEW;
    END IF;
    SELECT count(*) INTO v_count FROM private.order_closure_hits(NEW.id);
    IF v_count = 0 THEN
        RETURN NEW;
    END IF;
    SELECT ve.name, pa.user_id AS owner_id INTO v
      FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id WHERE ve.id = NEW.venue_id;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'ORDER_CLOSURE_ORDERS', 'key', 'ORDER_CLOSURE_ORDERS:' || NEW.id::text,
        'user_id', v.owner_id,
        'data', jsonb_build_object('venue_id', NEW.venue_id, 'venue_name', v.name, 'closure_id', NEW.id, 'count', v_count,
                                   'starts_at', to_char(NEW.starts_at, 'YYYY-MM-DD"T"HH24:MI'),
                                   'ends_at', to_char(NEW.ends_at, 'YYYY-MM-DD"T"HH24:MI'))));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venue_closures_order_notify ON public.venue_closures;
CREATE TRIGGER trg_venue_closures_order_notify
    AFTER INSERT ON public.venue_closures
    FOR EACH ROW EXECUTE FUNCTION private.order_closure_notify();

-- ----------------------------------------------------------------------------
-- 3. Pause des commandes
-- ----------------------------------------------------------------------------
-- p : actor_id (partenaire propriétaire), venue_id, minutes (15, 30 ou 60 ; 0 = reprendre tout de suite).
CREATE OR REPLACE FUNCTION public.order_venue_pause(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_venue   uuid := public.try_uuid(p->>'venue_id');
    v_minutes integer;
    v_owner   jsonb;
    v         record;
    v_until   timestamptz;
BEGIN
    v_owner := private.order_catalog_owner(v_actor);
    IF NOT (v_owner->>'ok')::boolean THEN
        RETURN v_owner;
    END IF;
    IF (p->>'minutes') IS NULL OR (p->>'minutes') !~ '^[0-9]{1,3}$' OR (p->>'minutes')::int NOT IN (0, 15, 30, 60) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MINUTES', 'message', 'Choisissez une pause de 15, 30 ou 60 minutes.');
    END IF;
    v_minutes := (p->>'minutes')::int;
    SELECT ve.id, ve.name, ve.orders_paused_until INTO v FROM public.venues ve
     WHERE ve.id = v_venue AND ve.partner_id = (v_owner->>'partner_id')::uuid FOR UPDATE;
    IF v_venue IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_FOUND', 'message', 'Cet établissement n’existe pas ou n’est pas le vôtre.');
    END IF;
    v_until := CASE WHEN v_minutes = 0 THEN NULL ELSE now() + make_interval(mins => v_minutes) END;
    UPDATE public.venues
       SET orders_paused_until = v_until, orders_paused_by = CASE WHEN v_minutes = 0 THEN NULL ELSE v_actor END,
           orders_pause_end_notified = (v_minutes = 0)
     WHERE id = v.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (v_actor, 'PARTENAIRE', CASE WHEN v_minutes = 0 THEN 'ORDERS_PAUSE_ENDED' ELSE 'ORDERS_PAUSED' END, 'venues', v.id,
            jsonb_build_object('orders_paused_until', v.orders_paused_until), jsonb_build_object('orders_paused_until', v_until));
    RETURN jsonb_build_object('ok', true, 'venue_id', v.id, 'paused_until', v_until);
END;
$$;

-- p : actor_id. Rend { ok, venues: [{ id, name, orders_open, paused_until }] } (pause en cours seulement).
CREATE OR REPLACE FUNCTION public.order_partner_pauses(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_list  jsonb;
BEGIN
    IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Réservé aux partenaires.');
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', ve.id, 'name', ve.name, 'orders_open', ve.orders_open,
               'paused_until', CASE WHEN ve.orders_paused_until > now() THEN ve.orders_paused_until END)) ORDER BY ve.name, ve.id), '[]'::jsonb)
      INTO v_list
      FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id
     WHERE pa.user_id = v_actor;
    RETURN jsonb_build_object('ok', true, 'venues', v_list);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Pause : refus du devis et de la création (aide nouvelle ; recopies de order_quote et order_create_checked)
-- ----------------------------------------------------------------------------
-- Refus de la pause en cours (NULL sans pause, service fermé ou établissement inconnu : les autres contrôles répondent)
CREATE OR REPLACE FUNCTION private.order_pause_refusal(p_venue_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object('ok', false, 'code', 'ORDERS_PAUSED', 'paused_until', ve.orders_paused_until,
               'message', format('Ce restaurant fait une courte pause : il reprend les commandes à %s.',
                                 to_char(ve.orders_paused_until AT TIME ZONE 'Africa/Dakar', 'FMHH24 "h" MI')))
      FROM public.venues ve
     WHERE ve.id = p_venue_id AND ve.orders_paused_until > now() AND public.fin_setting_bool('features.orders_enabled');
$$;

-- Recopie de 20261130000004_l12a_devis_commande.sql:461-476
CREATE OR REPLACE FUNCTION public.order_quote(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    q jsonb := public.order_quote_compute(p);
    -- Lot 12d : pause des commandes posée par la partenaire : devis refusé jusqu'à la fin (automatique)
    v_pause jsonb := private.order_pause_refusal(public.try_uuid(p->>'venue_id'));
BEGIN
    IF v_pause IS NOT NULL THEN
        RETURN v_pause;
    END IF;
    IF (q->>'ok')::boolean THEN
        RETURN q - 'owner_id' - 'partner_id' - 'address' - 'phone';
    END IF;
    RETURN q;
END;
$$;

-- Recopie de 20261226000003_l12b_garde_prix.sql:52-104
CREATE OR REPLACE FUNCTION public.order_create_checked(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client   uuid := public.try_uuid(p->>'client_id');
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    v_key      text := NULLIF(btrim(COALESCE(p->>'client_request_key', '')), '');
    v_total    numeric := private.order_expected_amount(p->'expected_total');
    v_now      numeric := private.order_expected_amount(p->'expected_to_pay');
    v_existing uuid;
    r          jsonb;
    v_seen     jsonb;
    v_pause    jsonb;
BEGIN
    IF v_key IS NOT NULL AND char_length(v_key) NOT BETWEEN 8 AND 128 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST_KEY', 'message', 'Demande illisible : rechargez la page et réessayez.');
    END IF;
    -- Lot 12d : pause des commandes : commande refusée avant tout verrou ni écriture (même refus que le devis)
    v_pause := private.order_pause_refusal(v_venue_id);
    IF v_pause IS NOT NULL THEN
        RETURN v_pause;
    END IF;
    -- Mêmes verrous, dans le même ordre, que order_create (verrous de transaction, repris sans attente par order_create)
    IF v_venue_id IS NOT NULL AND v_client IS NOT NULL THEN
        PERFORM public.order_venue_lock(v_venue_id);
        PERFORM public.order_client_lock(v_client);
    END IF;
    IF v_key IS NOT NULL AND v_client IS NOT NULL THEN
        SELECT id INTO v_existing FROM public.orders WHERE client_id = v_client AND client_request_key = v_key;
        IF FOUND THEN
            RETURN jsonb_build_object('ok', true, 'duplicate', true, 'order_id', v_existing);
        END IF;
    END IF;
    BEGIN
        r := public.order_create(p);
        IF (r->>'ok')::boolean THEN
            IF (v_total IS NOT NULL AND (r->>'goods_total')::numeric + (r->>'first_fee')::numeric <> v_total)
               OR (v_now IS NOT NULL AND (r->>'to_pay_now')::numeric <> v_now) THEN
                v_seen := jsonb_build_object('total', (r->>'goods_total')::numeric + (r->>'first_fee')::numeric,
                                             'to_pay_now', (r->>'to_pay_now')::numeric, 'goods_total', (r->>'goods_total')::numeric);
                RAISE EXCEPTION USING ERRCODE = 'OR412', MESSAGE = 'ORDER_PRICE_CHANGED';
            END IF;
            IF v_key IS NOT NULL THEN
                PERFORM set_config('event_village.order_flow', 'on', true);
                UPDATE public.orders SET client_request_key = v_key WHERE id = (r->>'order_id')::uuid;
            END IF;
        END IF;
    EXCEPTION WHEN SQLSTATE 'OR412' THEN
        -- Sous-bloc annulé : ni commande, ni lignes, ni stock ou portions pris, ni journal, ni avis
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_PRICE_CHANGED',
            'message', 'Le prix de votre commande a changé. Vérifiez avant de payer.') || v_seen;
    END;
    RETURN r;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Carte des plats (recopie de 20261226000002_l12b_carte_des_plats.sql:44-192)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_venue_menu(p_venue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v          record;
    v_now      timestamp := date_trunc('minute', public.hall_dakar_now());
    v_today    date := public.hall_dakar_now()::date;
    v_prep     integer;
    v_windows  jsonb;
    v_asap     boolean;
    v_closed_until timestamp;
    v_paused   timestamptz;
    v_hours    jsonb;
    v_products jsonb;
    v_cats     jsonb;
    v_zones    jsonb;
    v_spots    jsonb;
BEGIN
    IF p_venue_id IS NULL OR NOT public.fin_setting_bool('features.orders_enabled') THEN
        RETURN NULL;
    END IF;
    SELECT ve.* INTO v
      FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id
     WHERE ve.id = p_venue_id AND ve.is_active AND ve.validation_status = 'VALIDEE' AND pa.status::text = 'VALIDE' AND ve.orders_open;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    v_prep := COALESCE(v.order_prep_minutes, public.fin_setting_num('orders.prep_minutes_default')::int);

    -- Horaires de la semaine (jour ISO, ouverture, fermeture « HH:MI », 24:00 possible)
    SELECT COALESCE(jsonb_agg(jsonb_build_array(h.weekday, to_char(h.opens_at, 'HH24:MI'),
                                                CASE WHEN h.closes_at = time '00:00' THEN '24:00' ELSE to_char(h.closes_at, 'HH24:MI') END)
                              ORDER BY h.weekday, h.opens_at), '[]'::jsonb)
      INTO v_hours
      FROM public.venue_opening_hours h WHERE h.venue_id = v.id;

    -- Fenêtres où une heure peut être choisie : horaires des 7 jours, moins les fermetures, de maintenant + préparation
    -- à 7 jours (même borne que order_quote_compute ; la base refait tous les contrôles au devis). Fermetures : le devis
    -- du 12c (20261224000003, VENUE_CLOSED) refuse une heure t quand une fermeture touche [t - préparation, t + 1 min) ;
    -- à la minute près, c'est t dans [début, fin + préparation) : chaque fermeture est retirée jusqu'à sa fin plus la
    -- préparation (fermeture jusqu'à 18 h, préparation 30 min : premier créneau 18 h 30)
    SELECT COALESCE(jsonb_agg(jsonb_build_array(to_char(lower(r), 'YYYY-MM-DD"T"HH24:MI'), to_char(upper(r), 'YYYY-MM-DD"T"HH24:MI'))
                              ORDER BY lower(r)), '[]'::jsonb)
      INTO v_windows
      FROM unnest((
            (SELECT range_agg(public.venue_range(g.day::date, h.opens_at, h.closes_at))
               FROM generate_series((v_today - 1)::timestamp, (v_today + 7)::timestamp, interval '1 day') AS g(day)
               JOIN public.venue_opening_hours h ON h.venue_id = v.id AND h.weekday = EXTRACT(ISODOW FROM g.day))
            - COALESCE((SELECT range_agg(tsrange(c.starts_at, c.ends_at + make_interval(mins => v_prep), '[)')) FROM public.venue_closures c
                         WHERE c.venue_id = v.id AND c.cancelled_at IS NULL AND c.ends_at + make_interval(mins => v_prep) > v_now), '{}'::tsmultirange))
           * tsmultirange(tsrange(v_now + make_interval(mins => v_prep), v_now + interval '7 days', '[)'))) AS r;

    -- « Tout de suite » : mêmes bornes que order_quote_compute (20261224000003) : ouvert de maintenant à l'heure de remise
    -- (maintenant + préparation + 1 min), aucune fermeture de maintenant à l'heure de remise + 1 min
    v_asap := public.venue_open_covers(v.id, tsrange(v_now, v_now + make_interval(mins => v_prep + 1), '[)'))
              AND NOT public.venue_closed_during(v.id, tsrange(v_now, v_now + make_interval(mins => v_prep + 2), '[)'));

    -- Fermeture exceptionnelle en cours (correctifs après contre-vérification, idée 9) : jusqu'à quand, fermetures qui se
    -- suivent réunies ; la carte l'annonce et propose le premier créneau (première fenêtre ci-dessus)
    SELECT upper(r) INTO v_closed_until
      FROM unnest(COALESCE((SELECT range_agg(c.period) FROM public.venue_closures c
                             WHERE c.venue_id = v.id AND c.cancelled_at IS NULL AND c.ends_at > v_now), '{}'::tsmultirange)) AS r
     WHERE r @> v_now
     LIMIT 1;

    -- Lot 12d : pause des commandes en cours (fin automatique) : la carte l'annonce (« reprend les commandes à 13 h 30 »)
    v_paused := CASE WHEN v.orders_paused_until > now() THEN v.orders_paused_until END;

    -- Produits de l'établissement (retirés exclus) : disponibilité calculée, jamais le stock exact
    SELECT COALESCE(jsonb_agg(x.item ORDER BY x.daily DESC, x.cat_order, x.cat_name, x.name, x.id), '[]'::jsonb)
      INTO v_products
      FROM (
        SELECT pr.id, pr.name, pr.is_daily_special AS daily,
               COALESCE(cat.sort_order, 2147483647) AS cat_order, COALESCE(cat.name, '') AS cat_name,
               jsonb_build_object(
                   'id', pr.id,
                   'name', pr.name,
                   'description', NULLIF(btrim(COALESCE(pr.description, '')), ''),
                   'price', pr.price,
                   'image', CASE WHEN cardinality(pr.images) > 0 AND NULLIF(btrim(pr.images[1]), '') IS NOT NULL THEN pr.images[1] END,
                   'category_id', cat.id,
                   'availability', CASE
                       WHEN pr.status::text <> 'DISPONIBLE' THEN pr.status::text
                       WHEN pr.is_stock_managed AND pr.stock_quantity IS NOT NULL AND pr.stock_quantity <= 0 THEN 'EPUISE'
                       WHEN pr.is_daily_special AND COALESCE(dp.portions - dp.sold, 0) <= 0 THEN 'EPUISE'
                       ELSE 'DISPONIBLE' END,
                   'regulated', pr.is_regulated OR COALESCE(pr.regulated_admin, FALSE),
                   'in_review', pr.review_state IS NOT NULL,
                   'orderable', pr.status::text = 'DISPONIBLE' AND pr.price = trunc(pr.price)
                       AND NOT public.product_regulated(pr.id)
                       AND NOT (pr.is_stock_managed AND pr.stock_quantity IS NOT NULL AND pr.stock_quantity <= 0)
                       AND NOT (pr.is_daily_special AND COALESCE(dp.portions - dp.sold, 0) <= 0),
                   'daily', pr.is_daily_special,
                   -- Lot 12d : allergènes (liste fermée) et niveau de piment (0 à 3, vide = non renseigné)
                   'allergens', to_jsonb(COALESCE(pr.allergens, ARRAY[]::text[])),
                   'spice_level', pr.spice_level,
                   'portions_left', CASE WHEN pr.is_daily_special THEN GREATEST(COALESCE(dp.portions - dp.sold, 0), 0) END,
                   'portions_total', CASE WHEN pr.is_daily_special THEN COALESCE(dp.portions, 0) END,
                   'options', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'price', o.price_delta)
                                                         ORDER BY o.sort_order, o.name, o.id), '[]'::jsonb)
                                 FROM public.product_options o WHERE o.product_id = pr.id AND o.is_active)
               ) AS item
          FROM public.products pr
          LEFT JOIN public.product_categories cat ON cat.id = pr.category_id AND cat.is_active AND cat.partner_id = pr.partner_id
          LEFT JOIN public.product_daily_portions dp ON dp.product_id = pr.id AND dp.day = v_today
         WHERE pr.venue_id = v.id AND pr.partner_id = v.partner_id
           AND pr.archived_at IS NULL
      ) x;

    -- Catégories qui ont au moins un produit dans la carte
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) ORDER BY c.sort_order, c.name, c.id), '[]'::jsonb)
      INTO v_cats
      FROM public.product_categories c
     WHERE c.is_active AND c.partner_id = v.partner_id
       AND EXISTS (SELECT 1 FROM public.products pr WHERE pr.category_id = c.id AND pr.venue_id = v.id AND pr.archived_at IS NULL);

    -- Zones de livraison actives (non retirées), si la livraison est proposée
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', z.id, 'name', z.name, 'fee', z.fee, 'min_order', z.min_order)
                              ORDER BY z.sort_order, z.name, z.id), '[]'::jsonb)
      INTO v_zones
      FROM public.order_delivery_zones z
     WHERE z.venue_id = v.id AND z.is_active AND z.archived_at IS NULL AND 'LIVRAISON' = ANY (v.order_modes);

    -- Tables actives, si la commande sur place est proposée (liste ; QR de table plus tard)
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'label', t.table_number, 'zone', rz.name)
                              ORDER BY rz.name NULLS FIRST, length(t.table_number), t.table_number, t.id), '[]'::jsonb)
      INTO v_spots
      FROM public.restaurant_tables t
      LEFT JOIN public.restaurant_zones rz ON rz.id = t.zone_id
     WHERE t.venue_id = v.id AND t.is_active AND 'SUR_PLACE' = ANY (v.order_modes);

    RETURN jsonb_build_object(
        'venue', jsonb_build_object('id', v.id, 'name', v.name, 'kind', v.kind, 'city', v.city, 'address', v.address,
                                    'description', NULLIF(btrim(COALESCE(v.description, '')), ''), 'photos', to_jsonb(COALESCE(v.photos, ARRAY[]::text[]))),
        'ordering', jsonb_build_object(
            'modes', to_jsonb(v.order_modes),
            'deposit_percent', CASE WHEN v.order_deposit_allowed
                                    THEN COALESCE(v.order_deposit_percent, public.fin_setting_num('orders.deposit_default_percent')::int) END,
            'pay_on_handover', v.order_pay_on_handover,
            'prep_minutes', v_prep,
            'service_fee_rate', public.fin_setting_num('orders.service_fee_rate'),
            'asap_available', v_asap,
            'closed_until', to_char(v_closed_until, 'YYYY-MM-DD"T"HH24:MI'),
            'paused_until', to_char(v_paused AT TIME ZONE 'Africa/Dakar', 'YYYY-MM-DD"T"HH24:MI'),
            'now', to_char(v_now, 'YYYY-MM-DD"T"HH24:MI'),
            'windows', v_windows),
        'hours', v_hours,
        'zones', v_zones,
        'spots', v_spots,
        'categories', v_cats,
        'products', v_products);
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Allergènes et piment d'un produit
-- ----------------------------------------------------------------------------
-- p : actor_id (partenaire), product_id, allergens (liste de codes), spice_level (0 à 3, ou null = non renseigné).
CREATE OR REPLACE FUNCTION public.order_product_details_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_product uuid := public.try_uuid(p->>'product_id');
    v_owner   jsonb;
    pr        record;
    v_list    text[];
    v_spice   smallint;
    v_allowed text[] := ARRAY['GLUTEN', 'CRUSTACES', 'OEUFS', 'POISSON', 'ARACHIDES', 'SOJA', 'LAIT', 'FRUITS_A_COQUE',
                              'CELERI', 'MOUTARDE', 'SESAME', 'SULFITES', 'LUPIN', 'MOLLUSQUES'];
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
    IF jsonb_typeof(p->'allergens') IS DISTINCT FROM 'array'
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(p->'allergens') x WHERE jsonb_typeof(x) <> 'string') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ALLERGENS', 'message', 'Choisissez les allergènes dans la liste.');
    END IF;
    SELECT COALESCE(array_agg(DISTINCT upper(x) ORDER BY upper(x)), ARRAY[]::text[]) INTO v_list
      FROM jsonb_array_elements_text(p->'allergens') x;
    IF NOT (v_list <@ v_allowed) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ALLERGENS', 'message', 'Choisissez les allergènes dans la liste.');
    END IF;
    IF jsonb_typeof(p->'spice_level') = 'null' OR NOT (p ? 'spice_level') THEN
        v_spice := NULL;
    ELSIF jsonb_typeof(p->'spice_level') = 'number' AND (p->>'spice_level') ~ '^[0-3]$' THEN
        v_spice := (p->>'spice_level')::smallint;
    ELSE
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_SPICE', 'message', 'Choisissez un niveau de piment de 0 à 3.');
    END IF;
    PERFORM set_config('event_village.product_write', 'on', true);
    UPDATE public.products SET allergens = v_list, spice_level = v_spice, updated_at = now() WHERE id = pr.id;
    PERFORM set_config('event_village.product_write', 'off', true);
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'PRODUCT_DETAILS_UPDATED', 'products', pr.id,
            jsonb_build_object('allergens', to_jsonb(pr.allergens), 'spice_level', pr.spice_level),
            jsonb_build_object('allergens', to_jsonb(v_list), 'spice_level', v_spice));
    RETURN jsonb_build_object('ok', true, 'product_id', pr.id, 'allergens', to_jsonb(v_list), 'spice_level', v_spice);
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Droits
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.order_payable_refusal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.order_closure_hits(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_closure_notify() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.order_closure_orders(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_closure_keep(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_venue_pause(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_partner_pauses(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.order_pause_refusal(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.order_quote(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_create_checked(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_venue_menu(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_product_details_set(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_payable_refusal(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_closure_orders(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_closure_keep(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_venue_pause(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_partner_pauses(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_quote(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_create_checked(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_venue_menu(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_product_details_set(jsonb) TO service_role;
