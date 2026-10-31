-- ============================================================================
-- EVENT VILLAGE — LOT 2 : contrôles avant tout débit (2.5)
-- ============================================================================
-- ticket_sale_problems : contrôles partagés par le checkout, /api/payments/create (billet), la
-- réservation (sous verrou) et les billets gratuits — catégorie active et visible, événement PUBLIE
-- et non passé, fenêtre de vente, max_per_order, stock moins réservations. Borne de max_per_order
-- alignée sur la validation Zod (1 à 50).
-- Ordre de verrouillage partout : paiement, puis catégories par identifiant croissant.
-- ============================================================================

-- ── ticket_categories : borne de max_per_order alignée sur la validation Zod (1 à 50) ─────
-- NOT VALID : les lignes existantes ne sont pas revalidées, toute écriture nouvelle l'est.
ALTER TABLE public.ticket_categories DROP CONSTRAINT IF EXISTS ticket_categories_max_per_order_range;
ALTER TABLE public.ticket_categories ADD CONSTRAINT ticket_categories_max_per_order_range CHECK (max_per_order BETWEEN 1 AND 50) NOT VALID;

-- ── Contrôles partagés avant débit ──────────────────────────────────────────
-- p_items : [{ "category_id": uuid, "quantity": int }]. Renvoie [] ou la liste des problèmes
-- [{ category_id, code, message }]. Aucune écriture, aucun verrou (l'appelant verrouille).
CREATE OR REPLACE FUNCTION public.ticket_sale_problems(p_event_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event record;
    v_item record;
    v_cat record;
    v_problems jsonb := '[]'::jsonb;
    v_end_date date;
    v_end_time time;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_array(jsonb_build_object('category_id', NULL, 'code', 'INVALID_ITEMS', 'message', 'Panier vide.'));
    END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(p_items)) <> (SELECT count(DISTINCT e->>'category_id') FROM jsonb_array_elements(p_items) e) THEN
        RETURN jsonb_build_array(jsonb_build_object('category_id', NULL, 'code', 'INVALID_ITEMS', 'message', 'Une catégorie apparaît plusieurs fois dans le panier.'));
    END IF;

    SELECT id, status, start_date, start_time, end_date, end_time INTO v_event FROM public.events WHERE id = p_event_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_array(jsonb_build_object('category_id', NULL, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.'));
    END IF;
    IF v_event.status::text <> 'PUBLIE' THEN
        v_problems := v_problems || jsonb_build_object('category_id', NULL, 'code', 'EVENT_NOT_PUBLISHED', 'message', 'Cet événement n''est pas ouvert à la vente.');
    END IF;
    v_end_date := COALESCE(v_event.end_date, v_event.start_date);
    v_end_time := COALESCE(v_event.end_time, v_event.start_time, time '23:59:59');
    IF v_end_date < current_date OR (v_end_date = current_date AND v_end_time <= localtime) THEN
        v_problems := v_problems || jsonb_build_object('category_id', NULL, 'code', 'EVENT_PAST', 'message', 'Cet événement est terminé.');
    END IF;

    FOR v_item IN
        SELECT (e->>'category_id')::uuid AS category_id, (e->>'quantity')::int AS quantity FROM jsonb_array_elements(p_items) e
    LOOP
        SELECT id, event_id, name, price, total_quantity, sold_quantity, held_quantity, is_active, is_visible, sale_start, sale_end, max_per_order
          INTO v_cat FROM public.ticket_categories WHERE id = v_item.category_id;
        IF NOT FOUND OR v_cat.event_id <> p_event_id THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_item.category_id, 'code', 'CATEGORY_NOT_FOUND', 'message', 'Catégorie introuvable pour cet événement.');
            CONTINUE;
        END IF;
        IF v_item.quantity IS NULL OR v_item.quantity < 1 THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'INVALID_QUANTITY', 'message', 'Quantité invalide.');
            CONTINUE;
        END IF;
        IF NOT v_cat.is_active THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'CATEGORY_INACTIVE', 'message', format('La catégorie « %s » n''est plus en vente.', v_cat.name));
        END IF;
        IF NOT v_cat.is_visible THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'CATEGORY_NOT_VISIBLE', 'message', format('La catégorie « %s » n''est pas proposée à la vente.', v_cat.name));
        END IF;
        IF v_cat.sale_start IS NOT NULL AND v_cat.sale_start > now() THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'SALE_NOT_STARTED', 'message', format('La vente de « %s » n''est pas encore ouverte.', v_cat.name));
        END IF;
        IF v_cat.sale_end IS NOT NULL AND v_cat.sale_end <= now() THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'SALE_CLOSED', 'message', format('La vente de « %s » est close.', v_cat.name));
        END IF;
        IF v_item.quantity > v_cat.max_per_order THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'MAX_PER_ORDER', 'message', format('Au plus %s billet(s) « %s » par commande.', v_cat.max_per_order, v_cat.name));
        END IF;
        IF v_cat.total_quantity - v_cat.sold_quantity - v_cat.held_quantity < v_item.quantity THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'INSUFFICIENT_STOCK', 'message', format('Plus assez de places « %s » disponibles.', v_cat.name));
        END IF;
    END LOOP;
    RETURN v_problems;
END;
$$;

-- Privilèges : service_role uniquement
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.ticket_sale_problems(uuid, jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
