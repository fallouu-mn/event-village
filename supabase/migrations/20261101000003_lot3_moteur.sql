-- ============================================================================
-- EVENT VILLAGE — LOT 3 : moteur financier unique (3.1)
-- ============================================================================
-- Un seul module calcule la répartition d'un paiement, à partir des taux lus dans les réglages
-- (fin_setting : aucune valeur de repli ; un taux à 0 est valide) :
--   frais de service = ceil(prix × taux / 100) PAR BILLET (FCFA supérieur), à la charge de l'acheteur ;
--   total client = facial + service ; agrégateur = round(total × taux de l'opérateur / 100, 2) ;
--   organisateur = facial ; revenu brut EV = service ; revenu net EV = round(service − agrégateur, 2).
--   Abonnement (payé à Event Village) : pas de frais de service, organisateur 0, brut = facial.
-- Arrondis : fin_round_up (frais de service, montants débités ou versés), fin_round_2 (calculs
-- internes), fin_round_down (versements de commissions). Seul endroit où ces règles existent.
-- checkout_create_payment calcule lui-même les montants (les montants du corps sont ignorés) et
-- recopie les taux sur le paiement (non-rétroactivité) ; payment_confirm recopie les frais de
-- service unitaires sur chaque billet (part remboursable d'un billet).
-- ============================================================================

-- ── Colonnes ────────────────────────────────────────────────────────────────
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS facial_amount NUMERIC(12,2);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS service_fee_rate NUMERIC(6,3);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS aggregator_fee_rate NUMERIC(6,3);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payout_delay_hours INTEGER;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payout_hold_enabled BOOLEAN;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refunded_net_revenue NUMERIC(12,2) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_payments_event ON public.payments (event_id);
UPDATE public.payments
   SET event_id = (metadata->>'event_id')::uuid
 WHERE event_id IS NULL
   AND metadata->>'event_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = (metadata->>'event_id')::uuid);
COMMENT ON COLUMN public.payments.facial_amount IS 'Lot 3 : somme des prix faciaux ; amount = facial_amount + service_fee';
COMMENT ON COLUMN public.payments.refunded_net_revenue IS 'Lot 3 : part du revenu net EV annulée par les remboursements ; revenu net effectif = net_event_village_revenue − refunded_net_revenue';

ALTER TABLE public.stock_reservations ADD COLUMN IF NOT EXISTS unit_service_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_service_fee >= 0);
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS service_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (service_fee >= 0);

-- ── Arrondis (règle unique) ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_round_up(x numeric) RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT ceil(x) $$;
CREATE OR REPLACE FUNCTION public.fin_round_2(x numeric) RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT round(x, 2) $$;
CREATE OR REPLACE FUNCTION public.fin_round_down(x numeric) RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT floor(x) $$;

-- ── Répartition ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finance_compute(p_target text, p_lines jsonb, p_operator text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_market boolean;
    v_rate numeric;
    v_agg_rate numeric;
    v_line record;
    v_unit_fee numeric;
    v_facial numeric := 0;
    v_service numeric := 0;
    v_total numeric;
    v_agg numeric;
    v_gross numeric;
    v_lines jsonb := '[]'::jsonb;
BEGIN
    IF p_target IS NULL OR p_target NOT IN ('TICKET', 'ORDER', 'HALL_RESERVATION', 'TABLE_RESERVATION', 'SUBSCRIPTION') THEN
        RAISE EXCEPTION 'finance_compute : cible % non prise en charge', p_target;
    END IF;
    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'finance_compute : aucune ligne';
    END IF;
    v_market := p_target <> 'SUBSCRIPTION';
    v_rate := CASE WHEN v_market THEN public.fin_setting_num('finance.service_fee_rate') ELSE 0 END;
    IF p_operator IS NOT NULL THEN
        IF p_operator NOT IN ('WAVE', 'ORANGE_MONEY') THEN
            RAISE EXCEPTION 'finance_compute : opérateur % inconnu', p_operator;
        END IF;
        v_agg_rate := public.fin_setting_num('finance.aggregator_fee_rate.' || p_operator);
    END IF;
    FOR v_line IN
        SELECT e->>'category_id' AS category_id, (e->>'unit_price')::numeric AS unit_price, (e->>'quantity')::int AS quantity
          FROM jsonb_array_elements(p_lines) e
    LOOP
        IF v_line.unit_price IS NULL OR v_line.unit_price < 0 OR v_line.quantity IS NULL OR v_line.quantity <= 0 THEN
            RAISE EXCEPTION 'finance_compute : ligne invalide (prix %, quantité %)', v_line.unit_price, v_line.quantity;
        END IF;
        v_unit_fee := public.fin_round_up(v_line.unit_price * v_rate / 100);
        v_facial := v_facial + v_line.unit_price * v_line.quantity;
        v_service := v_service + v_unit_fee * v_line.quantity;
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
            'category_id', v_line.category_id,
            'unit_price', v_line.unit_price,
            'quantity', v_line.quantity,
            'unit_service_fee', v_unit_fee,
            'line_facial', v_line.unit_price * v_line.quantity,
            'line_service_fee', v_unit_fee * v_line.quantity,
            'line_total', (v_line.unit_price + v_unit_fee) * v_line.quantity));
    END LOOP;
    v_total := v_facial + v_service;
    v_gross := CASE WHEN v_market THEN v_service ELSE v_facial END;
    IF v_agg_rate IS NOT NULL THEN
        v_agg := public.fin_round_2(v_total * v_agg_rate / 100);
    END IF;
    RETURN jsonb_build_object(
        'target', p_target,
        'operator', p_operator,
        'lines', v_lines,
        'facial_amount', v_facial,
        'service_fee', v_service,
        'total_amount', v_total,
        'service_fee_rate', v_rate,
        'aggregator_fee_rate', v_agg_rate,
        'aggregator_fee', v_agg,
        'partner_payout_amount', CASE WHEN v_market THEN v_facial ELSE 0 END,
        'gross_event_village_revenue', v_gross,
        'net_event_village_revenue', CASE WHEN v_agg IS NULL THEN NULL ELSE public.fin_round_2(v_gross - v_agg) END);
END;
$$;

-- ── Devis (prix lus en base) ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finance_quote(p_event_id uuid, p_items jsonb, p_operator text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lines jsonb;
    v_count int;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ITEMS', 'message', 'Panier vide.');
    END IF;
    SELECT jsonb_agg(jsonb_build_object('category_id', c.id, 'unit_price', c.price, 'quantity', (e->>'quantity')::int) ORDER BY ord), count(*)
      INTO v_lines, v_count
      FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(e, ord)
      JOIN public.ticket_categories c
        ON c.id::text = e->>'category_id' AND c.event_id = p_event_id
     WHERE (e->>'quantity') ~ '^[0-9]+$' AND (e->>'quantity')::int > 0;
    IF v_count IS DISTINCT FROM jsonb_array_length(p_items) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ITEMS', 'message', 'Catégorie inconnue pour cet événement ou quantité invalide.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'event_id', p_event_id) || public.finance_compute('TICKET', v_lines, p_operator);
END;
$$;

-- ── Hors plateforme (espèces, is_platform_payment = false) : répartition nulle ─
-- Ni frais de service, ni agrégateur, ni reversement par la plateforme, ni revenu Event Village.
CREATE OR REPLACE FUNCTION public.fin_offline()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT jsonb_build_object('service_fee', 0, 'aggregator_fee', 0, 'partner_payout_amount', 0,
                              'gross_event_village_revenue', 0, 'net_event_village_revenue', 0)
$$;

-- ── Checkout : montants calculés par le moteur, taux recopiés ───────────────
CREATE OR REPLACE FUNCTION public.checkout_create_payment(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_items jsonb := p->'items';
    v_problems jsonb;
    v_existing uuid;
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

-- ── Confirmation : frais de service unitaires recopiés sur chaque billet ─────
CREATE OR REPLACE FUNCTION public.payment_confirm(p_payment_id uuid, p_source text)
RETURNS jsonb
LANGUAGE plpgsql
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
BEGIN
    SELECT id, status::text AS status, client_id, payment_target::text AS payment_target
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

    -- Le panier peut-il être honoré en entier ? (réservation active, ou stock libre si elle a échu)
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
    END LOOP;

    UPDATE public.payments
       SET status = 'SUCCESS', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(),
           confirmed_source = p_source, ticket_id = v_ticket_ids[1]
     WHERE id = p_payment_id;

    RETURN jsonb_build_object('result', 'CONFIRMED', 'ticket_ids', to_jsonb(v_ticket_ids), 'ticket_count', COALESCE(array_length(v_ticket_ids, 1), 0));
END;
$$;

-- Privilèges : service_role uniquement
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.fin_round_up(numeric)',
        'public.fin_round_2(numeric)',
        'public.fin_round_down(numeric)',
        'public.finance_compute(text, jsonb, text)',
        'public.finance_quote(uuid, jsonb, text)',
        'public.fin_offline()',
        'public.checkout_create_payment(jsonb)',
        'public.payment_confirm(uuid, text)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
