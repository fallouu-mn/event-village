-- ============================================================================
-- EVENT VILLAGE — LOT 2 : billets gratuits (2.6)
-- ============================================================================
-- free_tickets_claim : panier entièrement gratuit et claim-free ; contrôles partagés et limite par
-- compte et par catégorie (max_per_order, billets déjà détenus compris), dans une transaction.
-- Ordre de verrouillage partout : paiement, puis catégories par identifiant croissant.
-- ============================================================================

-- ── Billets gratuits seuls (claim-free, panier entièrement gratuit) ─────────
-- p_items : [{ category_id, quantity }] ; limite par compte et par catégorie = max_per_order.
CREATE OR REPLACE FUNCTION public.free_tickets_claim(p_user_id uuid, p_event_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
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
            INSERT INTO public.tickets (event_id, category_id, user_id, ticket_number, price, qr_code, status)
            SELECT v_cat.event_id, v_item.category_id, p_user_id,
                   'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
                   0, 'EV-QR-' || replace(gen_random_uuid()::text, '-', ''), 'VALIDE'
              FROM generate_series(1, v_item.quantity)
            RETURNING id
        )
        SELECT array_agg(id) INTO v_new FROM ins;
        v_ticket_ids := v_ticket_ids || v_new;
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'ticket_ids', to_jsonb(v_ticket_ids));
EXCEPTION WHEN SQLSTATE 'EV409' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FREE_LIMIT_REACHED', 'message', SQLERRM);
END;
$$;

-- Privilèges : service_role uniquement
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.free_tickets_claim(uuid, uuid, jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
