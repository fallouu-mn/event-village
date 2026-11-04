-- ============================================================================
-- EVENT VILLAGE — LOT 7 : parcours client, serveur (tâche 7.3 ; contrat M6, D4, D10)
-- ============================================================================
-- Idempotente : peut être rejouée sans effet de bord (aucun BEGIN ni COMMIT de transaction ;
-- CREATE OR REPLACE, DROP POLICY IF EXISTS).
--  1. checkout_create_payment : recopie intégrale de 20261101000003_lot3_moteur.sql (dernière définition,
--     aucune migration plus récente ne la recrée), avec un seul ajout entre l'étape 3 (double soumission par
--     la même clé d'idempotence) et l'étape 4 (contrôles partagés) : sous un verrou consultatif propre au
--     couple (compte, événement), un paiement de billets PENDING non échu du même compte pour le même
--     événement interdit d'en créer un second (D4). La réponse désigne le paiement en attente :
--     { ok:false, code:'PAYMENT_PENDING', payment_id, message }. La même clé rejouée garde le comportement
--     actuel (doublon → même paiement), parce que l'étape 3 passe avant. Les catégories sont verrouillées
--     avant le verrou consultatif (même ordre pour toutes les transactions : aucun interblocage nouveau).
--  2. D10 : suppression des politiques d'insertion REST hall_reservations_insert, table_reservations_insert,
--     orders_insert (0003_rls.sql:184,217,250). Toutes les écritures passent par des routes serveur en
--     service_role (/api/halls/reserve, /api/restaurants/reserve-table, /api/orders/create) ; aucune
--     insertion depuis le navigateur. La lecture et la mise à jour restent inchangées.
--  3. Privilèges de la fonction recréée : service_role seul.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Checkout : un seul paiement de billets en attente par compte et par événement
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_create_payment(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_items jsonb := p->'items';
    v_problems jsonb;
    v_existing uuid;
    v_pending uuid;
    v_payment_id uuid;
    v_expires timestamptz := now() + make_interval(mins => GREATEST(1, COALESCE((p->>'hold_minutes')::int, 15)));
    v_item record;
    v_price numeric;
    v_breakdown jsonb;
BEGIN
    -- 1. Verrou des catégories du panier, par identifiant croissant
    PERFORM 1 FROM public.ticket_categories
     WHERE id IN (SELECT (e->>'category_id')::uuid FROM jsonb_array_elements(v_items) e)
     ORDER BY id FOR UPDATE;

    -- 2. Réservations échues de ces catégories : rendues avant le contrôle
    UPDATE public.stock_reservations
       SET status = 'EXPIRED', closed_at = now(), close_reason = 'EXPIRED'
     WHERE status = 'ACTIVE' AND expires_at <= now()
       AND category_id IN (SELECT (e->>'category_id')::uuid FROM jsonb_array_elements(v_items) e);

    -- 3. Double soumission (même clé d'idempotence fournie par le client)
    IF p->>'client_idempotency_key' IS NOT NULL THEN
        SELECT id INTO v_existing FROM public.payments
         WHERE client_id = (p->>'client_id')::uuid AND client_idempotency_key = p->>'client_idempotency_key';
        IF FOUND THEN
            RETURN jsonb_build_object('ok', false, 'duplicate', true, 'payment_id', v_existing);
        END IF;
    END IF;

    -- 3 bis. Lot 7 (D4) : un paiement de billets PENDING non échu du même compte pour le même événement
    --        interdit d'en créer un second (autre clé, autre onglet, autre opérateur). Verrou consultatif
    --        du couple (compte, événement) : deux demandes simultanées sont sérialisées, la seconde voit le
    --        paiement validé par la première.
    PERFORM pg_advisory_xact_lock(hashtext('checkout:' || (p->>'client_id') || ':' || (p->>'event_id')));
    SELECT id INTO v_pending FROM public.payments
     WHERE client_id = (p->>'client_id')::uuid AND event_id = (p->>'event_id')::uuid
       AND payment_target::text = 'TICKET' AND status::text = 'PENDING' AND held_expires_at > now()
     ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PAYMENT_PENDING', 'payment_id', v_pending,
            'message', 'Un paiement est déjà en attente pour cet événement.');
    END IF;

    -- 4. Contrôles partagés, sous verrou
    v_problems := public.ticket_sale_problems((p->>'event_id')::uuid, v_items);
    IF jsonb_array_length(v_problems) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'problems', v_problems);
    END IF;
    FOR v_item IN SELECT (e->>'category_id')::uuid AS category_id, (e->>'unit_price')::numeric AS unit_price FROM jsonb_array_elements(v_items) e LOOP
        SELECT price INTO v_price FROM public.ticket_categories WHERE id = v_item.category_id;
        IF v_price IS DISTINCT FROM v_item.unit_price THEN
            RETURN jsonb_build_object('ok', false, 'problems', jsonb_build_array(jsonb_build_object('category_id', v_item.category_id, 'code', 'PRICE_CHANGED', 'message', 'Le prix a changé : rechargez la page.')));
        END IF;
    END LOOP;

    -- 5. Montants : moteur financier unique (aucun montant du corps n'est utilisé)
    IF NULLIF(p->>'operator', '') IS NULL THEN
        RAISE EXCEPTION 'checkout_create_payment : opérateur obligatoire pour un paiement';
    END IF;
    v_breakdown := public.finance_compute('TICKET',
        (SELECT jsonb_agg(jsonb_build_object('category_id', e->>'category_id', 'unit_price', c.price, 'quantity', (e->>'quantity')::int) ORDER BY ord)
           FROM jsonb_array_elements(v_items) WITH ORDINALITY AS t(e, ord)
           JOIN public.ticket_categories c ON c.id = (e->>'category_id')::uuid),
        p->>'operator');

    -- 6. Paiement PENDING, taux et délai de disponibilité recopiés
    INSERT INTO public.payments (
        transaction_id, external_order_id, client_id, partner_id, event_id, payment_target, amount, currency,
        is_platform_payment, aggregator, facial_amount, aggregator_fee, service_fee, gross_event_village_revenue,
        net_event_village_revenue, partner_payout_amount, service_fee_rate, aggregator_fee_rate,
        payout_delay_hours, payout_hold_enabled, status, idempotency_key, held_expires_at,
        operator, payer_phone, callback_token_hash, client_idempotency_key, metadata
    ) VALUES (
        p->>'transaction_id', p->>'external_order_id', (p->>'client_id')::uuid, NULLIF(p->>'partner_id', '')::uuid,
        (p->>'event_id')::uuid, 'TICKET',
        (v_breakdown->>'total_amount')::numeric, 'XOF', TRUE, 'SAMIRPAY',
        (v_breakdown->>'facial_amount')::numeric, (v_breakdown->>'aggregator_fee')::numeric,
        (v_breakdown->>'service_fee')::numeric, (v_breakdown->>'gross_event_village_revenue')::numeric,
        (v_breakdown->>'net_event_village_revenue')::numeric, (v_breakdown->>'partner_payout_amount')::numeric,
        (v_breakdown->>'service_fee_rate')::numeric, (v_breakdown->>'aggregator_fee_rate')::numeric,
        public.fin_setting_num('finance.payout_delay_hours')::int, public.fin_setting_bool('finance.payout_hold_enabled'),
        'PENDING', 'IDEMP-' || (p->>'external_order_id'), v_expires,
        NULLIF(p->>'operator', ''), NULLIF(p->>'payer_phone', ''), p->>'callback_token_hash', p->>'client_idempotency_key',
        COALESCE(p->'metadata', '{}'::jsonb)
    )
    ON CONFLICT (client_id, client_idempotency_key) WHERE client_idempotency_key IS NOT NULL DO NOTHING
    RETURNING id INTO v_payment_id;
    IF v_payment_id IS NULL THEN
        SELECT id INTO v_existing FROM public.payments
         WHERE client_id = (p->>'client_id')::uuid AND client_idempotency_key = p->>'client_idempotency_key';
        RETURN jsonb_build_object('ok', false, 'duplicate', true, 'payment_id', v_existing);
    END IF;

    -- 7. Réservations de tout le panier, frais de service unitaires compris (le trigger
    --    incrémente held_quantity ; la contrainte sold + held <= total protège en dernier ressort)
    INSERT INTO public.stock_reservations (payment_id, category_id, quantity, unit_price, unit_service_fee, expires_at)
    SELECT v_payment_id, (l->>'category_id')::uuid, (l->>'quantity')::int, (l->>'unit_price')::numeric,
           (l->>'unit_service_fee')::numeric, v_expires
      FROM jsonb_array_elements(v_breakdown->'lines') l;

    RETURN jsonb_build_object('ok', true, 'payment_id', v_payment_id, 'expires_at', v_expires,
                              'amount', (v_breakdown->>'total_amount')::numeric, 'breakdown', v_breakdown);
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. D10 : plus aucune insertion REST dans les réservations et commandes de services
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "hall_reservations_insert" ON public.hall_reservations;
DROP POLICY IF EXISTS "table_reservations_insert" ON public.table_reservations;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;

-- ----------------------------------------------------------------------------
-- 3. Privilèges : service_role uniquement
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.checkout_create_payment(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
