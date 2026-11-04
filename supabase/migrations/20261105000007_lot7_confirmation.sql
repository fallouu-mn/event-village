-- ============================================================================
-- EVENT VILLAGE — LOT 7, TÂCHE 7.9 : confirmation d'achat claire (contrat 19.3, décisions D87 à D91)
-- ============================================================================
-- Les confirmations portent, figés à l'émission dans la transaction métier (D87), le détail que l'email
-- affiche : l'envoyeur rend depuis template_data seul, sans lecture de base au rendu (invariant (o)).
--  1. notif_ticket_lines(uuid[]) : nombre de billets, catégories et quantités (ordre du nom), 10 premiers
--     numéros (ordre catégorie, numéro ; D89). Ordre binaire (COLLATE "C"), indépendant de la collation de
--     la base. Aucune donnée secrète : ni qr_code ni totp_secret ne sont lus.
--  2. payment_confirm (recopie intégrale de 20261103000005_lot6_billetterie.sql:444-583) : données de
--     PURCHASE_CONFIRMED complétées par notif_ticket_lines (ticket_count en vient, même valeur). NEW_ORDER
--     inchangé.
--  3. free_tickets_claim (recopie intégrale de 20261103000005_lot6_billetterie.sql:591-658) : données de
--     FREE_TICKETS_CONFIRMED complétées par notif_ticket_lines (ticket_count en vient, même valeur).
--  4. ticket_transfer_accept (recopie intégrale de sa version de 20261105000003_lot7_securite.sql:253-353,
--     verrou FOR SHARE de l'événement compris, D20, D97) : données de TRANSFER_RECEIVED complétées par le
--     NOUVEAU numéro du billet (renouvelé par ticket_transfer_claim) et le nom de sa catégorie (D88) ;
--     TRANSFER_CLAIMED_SENDER inchangé.
--  5. Registre : TRANSFER_RECEIVED reçoit le canal EMAIL (D91).
-- Rejouable : CREATE OR REPLACE, UPDATE gardé ; aucun BEGIN ni COMMIT. Dépend de 20261105000003.
-- Privilèges (règle 1A.3) : SECURITY DEFINER, search_path = public, volatilité explicite ; les quatre
-- fonctions réservées au service_role.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Détail des billets d'une confirmation (contrat 19.3.1)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_ticket_lines(p_ticket_ids uuid[])
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH t AS (
        SELECT tk.ticket_number::text COLLATE "C" AS ticket_number, c.name::text COLLATE "C" AS category
          FROM public.tickets tk
          JOIN public.ticket_categories c ON c.id = tk.category_id
         WHERE tk.id = ANY (p_ticket_ids)
    )
    SELECT jsonb_build_object(
        'ticket_count', (SELECT count(*) FROM t),
        'categories', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', g.category, 'quantity', g.n) ORDER BY g.category)
                                  FROM (SELECT category, count(*) AS n FROM t GROUP BY category) g), '[]'::jsonb),
        'ticket_numbers', COALESCE((SELECT jsonb_agg(f.ticket_number ORDER BY f.category, f.ticket_number)
                                      FROM (SELECT ticket_number, category FROM t ORDER BY category, ticket_number LIMIT 10) f), '[]'::jsonb))
$$;
COMMENT ON FUNCTION public.notif_ticket_lines(uuid[]) IS
    'Lot 7 (7.9, D87, D89) : détail figé d''une confirmation — ticket_count, categories [{name, quantity}] dans l''ordre du nom, ticket_numbers (10 premiers, ordre catégorie puis numéro). Jamais de QR ni de secret.';


-- ============================================================================
-- 2. payment_confirm (recopie intégrale de 20261103000005_lot6_billetterie.sql:444-583)
-- Changement (7.9) : data de PURCHASE_CONFIRMED = v_data || notif_ticket_lines(v_ticket_ids) || paiement,
-- frais et total. Le reste à l'identique.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.payment_confirm(p_payment_id uuid, p_source text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay record;
    v_res record;
    v_cat record;
    v_blocking text;
    v_cashout uuid;
    v_count integer;
    v_ticket_ids uuid[] := ARRAY[]::uuid[];
    v_new uuid[];
    v_event uuid;
    v_owner uuid;
    v_payer text;
    v_data jsonb;
BEGIN
    SELECT id, status::text AS status, client_id, payment_target::text AS payment_target,
           amount, service_fee, facial_amount, payer_phone
      INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('result', 'NOT_FOUND');
    END IF;
    IF v_pay.status = 'SUCCESS' THEN
        SELECT count(*) INTO v_count FROM public.tickets WHERE payment_id = p_payment_id;
        RETURN jsonb_build_object('result', 'ALREADY_CONFIRMED', 'ticket_count', v_count);
    END IF;
    IF v_pay.status IN ('REFUND_PENDING', 'REFUNDED', 'PARTIAL') THEN
        RETURN jsonb_build_object('result', 'REFUND_IN_PROGRESS', 'status', v_pay.status);
    END IF;
    IF v_pay.payment_target <> 'TICKET' THEN
        RETURN jsonb_build_object('result', 'NOT_TICKET');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.stock_reservations WHERE payment_id = p_payment_id) THEN
        RETURN jsonb_build_object('result', 'NO_ITEMS');
    END IF;

    PERFORM 1 FROM public.ticket_categories
     WHERE id IN (SELECT category_id FROM public.stock_reservations WHERE payment_id = p_payment_id)
     ORDER BY id FOR UPDATE;

    -- Le panier peut-il être honoré en entier ? (événement en vente, réservation active, ou stock libre si elle a échu)
    FOR v_res IN
        SELECT r.*, c.total_quantity, c.sold_quantity, c.held_quantity, c.name, e.status::text AS event_status
          FROM public.stock_reservations r
          JOIN public.ticket_categories c ON c.id = r.category_id
          JOIN public.events e ON e.id = c.event_id
         WHERE r.payment_id = p_payment_id
         ORDER BY r.category_id
    LOOP
        IF v_res.event_status = 'ANNULE' THEN
            v_blocking := format('événement annulé (%s)', v_res.name);
        ELSIF v_res.event_status = 'SUSPENDU' THEN
            v_blocking := format('événement suspendu (%s)', v_res.name);
        ELSIF v_res.event_status = 'TERMINE' THEN
            v_blocking := format('événement terminé (%s)', v_res.name);
        ELSIF v_res.status = 'ACTIVE' THEN
            CONTINUE;
        ELSIF v_res.status = 'CONVERTED' THEN
            v_blocking := format('réservation déjà convertie (%s)', v_res.name);
        ELSIF v_res.total_quantity - v_res.sold_quantity - v_res.held_quantity < v_res.quantity THEN
            v_blocking := format('plus de place « %s » après échéance de la réservation', v_res.name);
        END IF;
        EXIT WHEN v_blocking IS NOT NULL;
    END LOOP;

    IF v_blocking IS NOT NULL THEN
        UPDATE public.stock_reservations SET status = 'RELEASED', closed_at = now(), close_reason = 'REFUND'
         WHERE payment_id = p_payment_id AND status = 'ACTIVE';
        UPDATE public.payments
           SET status = 'REFUND_PENDING', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(),
               confirmed_source = p_source,
               metadata = metadata || jsonb_build_object('refund_reason', v_blocking)
         WHERE id = p_payment_id;
        v_cashout := public.refund_request(p_payment_id, 'Panier impossible à honorer : ' || v_blocking, 'REFUND');
        RETURN jsonb_build_object('result', 'REFUND_REQUIRED', 'reason', v_blocking, 'cashout_id', v_cashout);
    END IF;

    -- Conversion et émission (montants lus sur les réservations, jamais recalculés)
    FOR v_res IN SELECT * FROM public.stock_reservations WHERE payment_id = p_payment_id ORDER BY category_id LOOP
        -- held d'abord (trigger), puis sold : la contrainte sold + held <= total reste respectée
        UPDATE public.stock_reservations SET status = 'CONVERTED', closed_at = now(), close_reason = 'CONFIRMED' WHERE id = v_res.id;
        UPDATE public.ticket_categories SET sold_quantity = sold_quantity + v_res.quantity WHERE id = v_res.category_id;
        SELECT event_id INTO v_cat FROM public.ticket_categories WHERE id = v_res.category_id;
        WITH ins AS (
            INSERT INTO public.tickets (event_id, category_id, user_id, payment_id, ticket_number, price, service_fee, qr_code, status)
            SELECT v_cat.event_id, v_res.category_id, v_pay.client_id, p_payment_id,
                   'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
                   v_res.unit_price,
                   v_res.unit_service_fee,
                   'EV-QR-' || replace(gen_random_uuid()::text, '-', ''),
                   'VALIDE'
              FROM generate_series(1, v_res.quantity)
            RETURNING id
        )
        SELECT array_agg(id) INTO v_new FROM ins;
        v_ticket_ids := v_ticket_ids || v_new;
        v_event := v_cat.event_id;
    END LOOP;

    UPDATE public.payments
       SET status = 'SUCCESS', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(),
           confirmed_source = p_source, ticket_id = v_ticket_ids[1]
     WHERE id = p_payment_id;

    -- Lot 6 (J1.1) : confirmation d'achat et nouvelle commande, dans la transaction de la confirmation
    IF v_event IS NOT NULL THEN
        v_payer := CASE WHEN v_pay.payer_phone ~ '^[0-9]{9}$' THEN '+221' || v_pay.payer_phone END;
        v_data := COALESCE(public.notif_event_data(v_event), '{}'::jsonb);
        IF v_pay.client_id IS NOT NULL OR v_payer IS NOT NULL THEN
            -- Lot 7 (7.9, D87) : catégories, quantités et 10 premiers numéros figés à l'émission
            -- (ticket_count vient de notif_ticket_lines : même valeur que la longueur de v_ticket_ids).
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'PURCHASE_CONFIRMED', 'key', 'PURCHASE_CONFIRMED:' || p_payment_id::text,
                'user_id', v_pay.client_id, 'phone', v_payer, 'event_id', v_event,
                'data', v_data || public.notif_ticket_lines(v_ticket_ids) || jsonb_build_object(
                    'payment_id', p_payment_id,
                    'service_fee', COALESCE(v_pay.service_fee, 0),
                    'total', v_pay.amount)));
        END IF;
        SELECT pa.user_id INTO v_owner
          FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
         WHERE e.id = v_event;
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'NEW_ORDER', 'key', 'NEW_ORDER:' || p_payment_id::text,
                'user_id', v_owner, 'event_id', v_event,
                'data', v_data || jsonb_build_object(
                    'payment_id', p_payment_id,
                    'ticket_count', COALESCE(array_length(v_ticket_ids, 1), 0),
                    'total', COALESCE(v_pay.facial_amount, v_pay.amount - COALESCE(v_pay.service_fee, 0)))));
        END IF;
    END IF;

    RETURN jsonb_build_object('result', 'CONFIRMED', 'ticket_ids', to_jsonb(v_ticket_ids), 'ticket_count', COALESCE(array_length(v_ticket_ids, 1), 0));
END;
$$;


-- ============================================================================
-- 3. free_tickets_claim (recopie intégrale de 20261103000005_lot6_billetterie.sql:591-658)
-- Changement (7.9) : data de FREE_TICKETS_CONFIRMED = données de l'événement || notif_ticket_lines(v_ticket_ids)
-- || ticket_id. Le reste à l'identique.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.free_tickets_claim(p_user_id uuid, p_event_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_problems jsonb;
    v_item record;
    v_cat record;
    v_already integer;
    v_ticket_ids uuid[] := ARRAY[]::uuid[];
    v_new uuid[];
    v_first uuid;
BEGIN
    PERFORM 1 FROM public.ticket_categories
     WHERE id IN (SELECT (e->>'category_id')::uuid FROM jsonb_array_elements(p_items) e)
     ORDER BY id FOR UPDATE;

    FOR v_item IN SELECT (e->>'category_id')::uuid AS category_id, (e->>'quantity')::int AS quantity FROM jsonb_array_elements(p_items) e LOOP
        SELECT id, price, max_per_order, name INTO v_cat FROM public.ticket_categories WHERE id = v_item.category_id;
        IF FOUND AND v_cat.price <> 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NOT_FREE', 'message', format('La catégorie « %s » est payante.', v_cat.name));
        END IF;
    END LOOP;

    v_problems := public.ticket_sale_problems(p_event_id, p_items);
    IF jsonb_array_length(v_problems) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SALE_CHECK_FAILED', 'problems', v_problems);
    END IF;

    FOR v_item IN SELECT (e->>'category_id')::uuid AS category_id, (e->>'quantity')::int AS quantity FROM jsonb_array_elements(p_items) e LOOP
        SELECT c.id, c.event_id, c.max_per_order, c.name INTO v_cat FROM public.ticket_categories c WHERE c.id = v_item.category_id;
        SELECT count(*) INTO v_already FROM public.tickets
         WHERE user_id = p_user_id AND category_id = v_item.category_id AND status IN ('VALIDE', 'UTILISE');
        IF v_already + v_item.quantity > v_cat.max_per_order THEN
            RAISE EXCEPTION USING ERRCODE = 'EV409', MESSAGE = format('Limite de %s billet(s) gratuit(s) « %s » par compte atteinte.', v_cat.max_per_order, v_cat.name);
        END IF;
        UPDATE public.ticket_categories SET sold_quantity = sold_quantity + v_item.quantity WHERE id = v_item.category_id;
        WITH ins AS (
            INSERT INTO public.tickets (event_id, category_id, user_id, ticket_number, price, qr_code, status, sale_channel)
            SELECT v_cat.event_id, v_item.category_id, p_user_id,
                   'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
                   0, 'EV-QR-' || replace(gen_random_uuid()::text, '-', ''), 'VALIDE', 'FREE'
              FROM generate_series(1, v_item.quantity)
            RETURNING id
        )
        SELECT array_agg(id) INTO v_new FROM ins;
        v_ticket_ids := v_ticket_ids || v_new;
    END LOOP;

    -- Lot 6 (J1.2) : confirmation des billets gratuits, dans la même transaction
    -- Plus petit identifiant (ordre de l'uuid = ordre binaire de sa forme texte, indépendant de la collation)
    SELECT x INTO v_first FROM unnest(v_ticket_ids) AS x ORDER BY x LIMIT 1;
    IF v_first IS NOT NULL AND p_user_id IS NOT NULL THEN
        -- Lot 7 (7.9, D87) : catégories, quantités et 10 premiers numéros figés à l'émission
        -- (ticket_count vient de notif_ticket_lines : même valeur que cardinality(v_ticket_ids)).
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'FREE_TICKETS_CONFIRMED', 'key', 'FREE_TICKETS_CONFIRMED:' || v_first::text,
            'user_id', p_user_id, 'actor_id', p_user_id, 'event_id', p_event_id,
            'data', COALESCE(public.notif_event_data(p_event_id), '{}'::jsonb)
                    || public.notif_ticket_lines(v_ticket_ids)
                    || jsonb_build_object('ticket_id', v_first)));
    END IF;

    RETURN jsonb_build_object('ok', true, 'ticket_ids', to_jsonb(v_ticket_ids));
EXCEPTION WHEN SQLSTATE 'EV409' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FREE_LIMIT_REACHED', 'message', SQLERRM);
END;
$$;


-- ============================================================================
-- 4. ticket_transfer_accept (recopie intégrale de sa version de 20261105000003_lot7_securite.sql:253-353)
-- Changement (7.9, D88) : data de TRANSFER_RECEIVED = data commune || NOUVEAU numéro du billet (rendu par
-- ticket_transfer_claim) || nom de sa catégorie. TRANSFER_CLAIMED_SENDER inchangé. Verrou FOR SHARE de
-- l'événement (D20) conservé.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ticket_transfer_accept(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transfer uuid := public.try_uuid(p->>'transfer_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    tr record;
    v_identity text;
    v_claim jsonb;
    v_ticket uuid;
    v_event uuid;
    v_event_status text;
    v_title text;
    v_data jsonb;
    v_claimed_at timestamptz;
BEGIN
    IF v_transfer IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande incomplète.');
    END IF;

    -- Lot 7 (D20) : l'événement du billet est verrouillé (FOR SHARE) avant le transfert. Le billet d'un
    -- transfert et l'événement d'un billet ne changent jamais : la lecture sans verrou suffit pour les trouver.
    SELECT x.ticket_id INTO v_ticket FROM public.ticket_transfers x WHERE x.id = v_transfer;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_FOUND', 'message', 'Ce transfert est introuvable.');
    END IF;
    SELECT t.event_id INTO v_event FROM public.tickets t WHERE t.id = v_ticket;
    SELECT ev.status::text INTO v_event_status FROM public.events ev WHERE ev.id = v_event FOR SHARE;

    SELECT * INTO tr FROM public.ticket_transfers WHERE id = v_transfer FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_FOUND', 'message', 'Ce transfert est introuvable.');
    END IF;
    v_identity := public.ticket_transfer_identity(tr.to_phone_or_email, v_actor);
    IF v_identity = 'PHONE_NOT_VERIFIED' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PHONE_NOT_VERIFIED', 'message', 'Confirmez d''abord votre numéro par un code SMS.');
    END IF;
    IF v_identity IS DISTINCT FROM 'MATCH' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_FOUND', 'message', 'Ce transfert est introuvable.');
    END IF;
    IF tr.status::text <> 'PENDING' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_PENDING', 'message', 'Ce transfert n''est plus en attente.');
    END IF;
    IF tr.expires_at <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_EXPIRED', 'message', 'Ce transfert a expiré (délai de 48 h dépassé).');
    END IF;
    IF tr.from_user_id = v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SELF_TRANSFER', 'message', 'Vous êtes déjà le propriétaire de ce billet.');
    END IF;
    -- Lot 7 (D20) : statut lu sous le verrou FOR SHARE pris plus haut. Contrôlé après l'identité (aucune
    -- fuite d'existence) et après l'état du transfert (un transfert révoqué par l'annulation reste
    -- TRANSFER_NOT_PENDING, comme au lot 6).
    IF v_event_status IS NULL OR v_event_status NOT IN ('PUBLIE', 'VALIDE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ACTIVE', 'message', 'Cet événement n''accepte plus de transfert.');
    END IF;

    v_claim := public.ticket_transfer_claim(tr.id, v_actor);
    IF NOT COALESCE((v_claim->>'ok')::boolean, false) THEN
        RETURN jsonb_build_object('ok', false, 'code', COALESCE(v_claim->>'code', 'TICKET_NOT_TRANSFERABLE'),
            'message', CASE v_claim->>'code'
                WHEN 'OWNER_CHANGED' THEN 'L''expéditeur n''est plus le propriétaire de ce billet.'
                WHEN 'TICKET_NOT_TRANSFERABLE' THEN 'Ce billet n''est plus transférable.'
                WHEN 'TRANSFER_NOT_PENDING' THEN 'Ce transfert n''est plus en attente.'
                WHEN 'TRANSFER_EXPIRED' THEN 'Ce transfert a expiré (délai de 48 h dépassé).'
                WHEN 'SELF_TRANSFER' THEN 'Vous êtes déjà le propriétaire de ce billet.'
                WHEN 'EVENT_NOT_ACTIVE' THEN 'Cet événement n''accepte plus de transfert.'
                ELSE 'Ce transfert est introuvable.' END);
    END IF;

    SELECT t.event_id, e.title INTO v_event, v_title
      FROM public.tickets t JOIN public.events e ON e.id = t.event_id
     WHERE t.id = tr.ticket_id;
    SELECT x.claimed_at INTO v_claimed_at FROM public.ticket_transfers x WHERE x.id = tr.id;

    v_data := COALESCE(public.notif_event_data(v_event), '{}'::jsonb)
              || jsonb_build_object('transfer_id', tr.id, 'ticket_id', tr.ticket_id);
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'TRANSFER_CLAIMED_SENDER', 'key', 'TRANSFER_CLAIMED_SENDER:' || tr.id::text,
        'user_id', tr.from_user_id, 'event_id', v_event, 'data', v_data));
    -- Lot 7 (7.9, D88) : nouveau numéro (le transfert le renouvelle) et catégorie du billet reçu, figés à
    -- l'émission ; champs absents plutôt que nuls.
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'TRANSFER_RECEIVED', 'key', 'TRANSFER_RECEIVED:' || tr.id::text,
        'user_id', v_actor, 'event_id', v_event,
        'data', v_data || jsonb_strip_nulls(jsonb_build_object(
            'ticket_number', v_claim->>'ticket_number',
            'category', (SELECT c.name FROM public.tickets t JOIN public.ticket_categories c ON c.id = t.category_id
                          WHERE t.id = tr.ticket_id)))));

    -- I4 : l'ancien porteur sans billet VALIDE de l'événement ne reçoit plus les rappels en attente.
    IF NOT EXISTS (SELECT 1 FROM public.tickets t
                    WHERE t.event_id = v_event AND t.user_id = tr.from_user_id AND t.status::text = 'VALIDE') THEN
        UPDATE public.notification_outbox
           SET status = 'CANCELLED', reason = 'NO_LONGER_HOLDER', finished_at = now()
         WHERE event_id = v_event AND recipient_user_id = tr.from_user_id AND status = 'PENDING'
           AND type IN ('REMINDER_J1', 'REMINDER_H3');
    END IF;

    RETURN jsonb_build_object('ok', true, 'transfer_id', tr.id, 'ticket_id', tr.ticket_id,
                              'ticket_number', v_claim->>'ticket_number', 'event_title', v_title,
                              'claimed_at', v_claimed_at);
END;
$$;


-- ----------------------------------------------------------------------------
-- 5. Registre : TRANSFER_RECEIVED reçoit l'email (D91 ; catalogue lib/notifications/catalog.ts, même commit).
--    Rejouable : sans effet une fois EMAIL présent.
-- ----------------------------------------------------------------------------
UPDATE public.notification_types
   SET channels = ARRAY['IN_APP', 'PUSH', 'EMAIL']
 WHERE type = 'TRANSFER_RECEIVED' AND NOT ('EMAIL' = ANY (channels));


-- ============================================================================
-- Privilèges : service_role uniquement (règle 1A.3)
-- ============================================================================
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.notif_ticket_lines(uuid[])',
        'public.payment_confirm(uuid, text)',
        'public.free_tickets_claim(uuid, uuid, jsonb)',
        'public.ticket_transfer_accept(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
