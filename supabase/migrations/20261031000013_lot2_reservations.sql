-- ============================================================================
-- EVENT VILLAGE — LOT 2 : réservation du stock en SQL (2.4)
-- ============================================================================
-- Avant : réservations faites en TypeScript par CAS applicatifs (try/catch vide, replis « colonne
-- absente », suppression du paiement par la fonction de réservation, double décrément de
-- held_quantity, aucune purge planifiée).
-- Après : stock_reservations (une ligne par paiement et catégorie) ; held_quantity maintenu par
-- trigger = somme des réservations ACTIVE (choix « trigger » plutôt que « dérivé » : la colonne
-- reste lue par l'interface temps réel et l'API publique ; la contrainte CHECK sold + held <= total
-- reste le garde-fou ultime). checkout_create_payment crée le paiement et réserve TOUT le panier
-- dans une transaction, tout ou rien ; payment_release rend le stock sur tout chemin d'échec ;
-- stock_reservations_expire purge les réservations échues (cron). Colonnes de payments : opérateur
-- et téléphone payeur (9 chiffres), empreinte du jeton de callback, clé d'idempotence du client.
-- Ordre de verrouillage partout : paiement, puis catégories par identifiant croissant.
-- ============================================================================

-- ── payments ────────────────────────────────────────────────────────────────
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS operator TEXT,
    ADD COLUMN IF NOT EXISTS payer_phone TEXT,
    ADD COLUMN IF NOT EXISTS callback_token_hash TEXT,
    ADD COLUMN IF NOT EXISTS client_idempotency_key TEXT,
    ADD COLUMN IF NOT EXISTS confirmed_source TEXT,
    ADD COLUMN IF NOT EXISTS provider_final BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMPTZ;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_operator_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_operator_check CHECK (operator IS NULL OR operator IN ('WAVE', 'ORANGE_MONEY'));
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payer_phone_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payer_phone_check CHECK (payer_phone IS NULL OR payer_phone ~ '^[0-9]{9}$');
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_callback_token_hash_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_callback_token_hash_check CHECK (callback_token_hash IS NULL OR callback_token_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_client_idempotency_key_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_client_idempotency_key_check CHECK (client_idempotency_key IS NULL OR char_length(client_idempotency_key) BETWEEN 8 AND 128);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_client_idempotency
    ON public.payments (client_id, client_idempotency_key) WHERE client_idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_external_transaction
    ON public.payments (external_transaction_id) WHERE external_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON public.payments (status, created_at);

-- ── stock_reservations ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
    category_id UUID NOT NULL REFERENCES public.ticket_categories(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CONVERTED', 'RELEASED', 'EXPIRED')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    close_reason TEXT,
    UNIQUE (payment_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_active_category ON public.stock_reservations (category_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_stock_reservations_active_expiry ON public.stock_reservations (expires_at) WHERE status = 'ACTIVE';

ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stock_reservations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.stock_reservations TO service_role;
COMMENT ON TABLE public.stock_reservations IS
    'Lot 2 : réservations de stock par paiement et catégorie. held_quantity = somme des lignes ACTIVE (trigger). Service_role uniquement.';

-- held_quantity suit exactement les réservations ACTIVE
CREATE OR REPLACE FUNCTION public.stock_reservations_sync_held()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old INTEGER := 0;
    v_new INTEGER := 0;
    v_category uuid;
BEGIN
    -- Branchement explicite par opération : NEW n'est jamais lu sur DELETE, ni OLD sur INSERT.
    IF TG_OP = 'INSERT' THEN
        v_category := NEW.category_id;
        IF NEW.status = 'ACTIVE' THEN v_new := NEW.quantity; END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.category_id <> NEW.category_id THEN
            RAISE EXCEPTION 'stock_reservations : changement de catégorie interdit';
        END IF;
        v_category := NEW.category_id;
        IF OLD.status = 'ACTIVE' THEN v_old := OLD.quantity; END IF;
        IF NEW.status = 'ACTIVE' THEN v_new := NEW.quantity; END IF;
    ELSE
        v_category := OLD.category_id;
        IF OLD.status = 'ACTIVE' THEN v_old := OLD.quantity; END IF;
    END IF;
    IF v_new - v_old <> 0 THEN
        UPDATE public.ticket_categories
           SET held_quantity = held_quantity + (v_new - v_old)
         WHERE id = v_category;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_reservations_sync_held ON public.stock_reservations;
CREATE TRIGGER trg_stock_reservations_sync_held
    AFTER INSERT OR UPDATE OF status, quantity OR DELETE ON public.stock_reservations
    FOR EACH ROW EXECUTE FUNCTION public.stock_reservations_sync_held();

-- ── Création du paiement et des réservations, tout ou rien ──────────────────
-- p : { client_id, event_id, partner_id, items:[{category_id, quantity, unit_price}], amount,
--       aggregator_fee, service_fee, gross_revenue, net_revenue, partner_payout, operator,
--       payer_phone, callback_token_hash, client_idempotency_key, transaction_id,
--       external_order_id, hold_minutes, metadata }
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

    -- 5. Paiement PENDING
    INSERT INTO public.payments (
        transaction_id, external_order_id, client_id, partner_id, payment_target, amount, currency,
        is_platform_payment, aggregator, aggregator_fee, service_fee, gross_event_village_revenue,
        net_event_village_revenue, partner_payout_amount, status, idempotency_key, held_expires_at,
        operator, payer_phone, callback_token_hash, client_idempotency_key, metadata
    ) VALUES (
        p->>'transaction_id', p->>'external_order_id', (p->>'client_id')::uuid, NULLIF(p->>'partner_id', '')::uuid, 'TICKET',
        (p->>'amount')::numeric, 'XOF', TRUE, 'SAMIRPAY', COALESCE((p->>'aggregator_fee')::numeric, 0),
        COALESCE((p->>'service_fee')::numeric, 0), COALESCE((p->>'gross_revenue')::numeric, 0),
        COALESCE((p->>'net_revenue')::numeric, 0), COALESCE((p->>'partner_payout')::numeric, 0), 'PENDING',
        'IDEMP-' || (p->>'external_order_id'), v_expires,
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

    -- 6. Réservations de tout le panier (le trigger incrémente held_quantity ; la contrainte
    --    sold + held <= total protège en dernier ressort)
    INSERT INTO public.stock_reservations (payment_id, category_id, quantity, unit_price, expires_at)
    SELECT v_payment_id, (e->>'category_id')::uuid, (e->>'quantity')::int, (e->>'unit_price')::numeric, v_expires
      FROM jsonb_array_elements(v_items) e;

    RETURN jsonb_build_object('ok', true, 'payment_id', v_payment_id, 'expires_at', v_expires);
END;
$$;

-- ── Échec, annulation ou expiration : libération des réservations ───────────
CREATE OR REPLACE FUNCTION public.payment_release(p_payment_id uuid, p_status text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status text;
    v_released integer;
BEGIN
    IF p_status NOT IN ('FAILED', 'CANCELLED', 'EXPIRED') THEN
        RAISE EXCEPTION 'payment_release : statut cible invalide %', p_status;
    END IF;
    SELECT status::text INTO v_status FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('changed', false, 'status', NULL);
    END IF;
    IF v_status <> 'PENDING' THEN
        RETURN jsonb_build_object('changed', false, 'status', v_status);
    END IF;
    PERFORM 1 FROM public.ticket_categories
     WHERE id IN (SELECT category_id FROM public.stock_reservations WHERE payment_id = p_payment_id)
     ORDER BY id FOR UPDATE;
    UPDATE public.payments
       SET status = p_status::public.payment_status_enum,
           provider_status = p_reason,
           provider_final = (p_status IN ('FAILED') OR (p_status = 'CANCELLED' AND p_reason LIKE 'PROVIDER_%'))
     WHERE id = p_payment_id;
    UPDATE public.stock_reservations
       SET status = CASE WHEN p_status = 'EXPIRED' THEN 'EXPIRED' ELSE 'RELEASED' END, closed_at = now(), close_reason = p_reason
     WHERE payment_id = p_payment_id AND status = 'ACTIVE';
    GET DIAGNOSTICS v_released = ROW_COUNT;
    RETURN jsonb_build_object('changed', true, 'status', p_status, 'released', v_released);
END;
$$;

-- ── Purge des réservations échues (cron) ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stock_reservations_expire()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    PERFORM 1 FROM public.ticket_categories
     WHERE id IN (SELECT DISTINCT category_id FROM public.stock_reservations WHERE status = 'ACTIVE' AND expires_at <= now())
     ORDER BY id FOR UPDATE;
    UPDATE public.stock_reservations
       SET status = 'EXPIRED', closed_at = now(), close_reason = 'EXPIRED'
     WHERE status = 'ACTIVE' AND expires_at <= now();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN jsonb_build_object('expired', v_count);
END;
$$;

-- Privilèges : service_role uniquement
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.stock_reservations_sync_held()',
        'public.checkout_create_payment(jsonb)',
        'public.payment_release(uuid, text, text)',
        'public.stock_reservations_expire()'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
