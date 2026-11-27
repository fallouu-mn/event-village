-- ============================================================================
-- EVENT VILLAGE — LOT 12b, migration 03 : prix changé, double clic et rejeu (commande et paiement)
-- ============================================================================
-- Même règle que les tables d'un événement (contre-vérification du lot 11c-b, lib/event-tables/event-tables.server.ts
-- :140-153, :211-216, :254-262) : l'écran envoie le total qu'il affiche ; si la base calcule un autre montant, rien n'est
-- créé et le client voit le nouveau prix. Ici la comparaison est faite DANS la transaction de la base (aucune course
-- possible entre la comparaison et la création, aucune commande ni aucun paiement créé puis annulé).
--  1. orders.client_request_key : clé d'idempotence de la demande du client (8 à 128 caractères), unique par client ;
--     posée seulement par order_create_checked ;
--  2. order_create_checked(p) : enveloppe de order_create (aucune recopie) : verrous de l'établissement puis du client
--     (même ordre que order_create : aucun interblocage), demande déjà reçue avec la même clé → la même commande
--     (duplicate) ; sinon order_create dans un sous-bloc : si le total (expected_total) ou le montant à payer maintenant
--     (expected_to_pay) affichés ne correspondent plus au devis de la base, le sous-bloc est annulé (commande, lignes,
--     stock et portions rendus) et le refus ORDER_PRICE_CHANGED rend les nouveaux montants ;
--  3. order_payment_start(p) : enveloppe de order_payment_create (aucune recopie) : clé d'idempotence du paiement
--     (payments.client_idempotency_key, index unique existant uq_payments_client_idempotency) → même paiement
--     (duplicate) ; montant affiché (expected_amount) différent du montant de la base → sous-bloc annulé, aucun paiement
--     créé, refus ORDER_PRICE_CHANGED avec le nouveau montant. Contre-vérification du lot 12b (observation) : la clé est
--     liée à sa commande : la même clé envoyée pour une autre commande (ou déjà prise par un paiement de billets) est
--     refusée (IDEMPOTENCY_KEY_REUSED, message simple), jamais confondue avec le paiement d'une autre commande.
-- Toutes réservées au rôle de service (routes serveur). Rejouable : ADD COLUMN IF NOT EXISTS, index IF NOT EXISTS,
-- CREATE OR REPLACE, REVOKE et GRANT idempotents. Aucun BEGIN ni COMMIT.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Clé d'idempotence d'une commande
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_request_key TEXT;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_client_request_key_chk;
ALTER TABLE public.orders ADD CONSTRAINT orders_client_request_key_chk CHECK (
    client_request_key IS NULL OR char_length(client_request_key) BETWEEN 8 AND 128);
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_client_request_key
    ON public.orders (client_id, client_request_key) WHERE client_request_key IS NOT NULL;
COMMENT ON COLUMN public.orders.client_request_key IS
    'Lot 12b : clé d''idempotence de la demande de commande (en-tête Idempotency-Key), unique par client : un double clic ou un rejeu rend la même commande.';

-- Montant affiché lu dans la demande : nombre entier positif, sinon NULL (aucune comparaison)
CREATE OR REPLACE FUNCTION private.order_expected_amount(p_value jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT CASE WHEN jsonb_typeof(p_value) = 'number' AND (p_value #>> '{}')::numeric >= 0
                     AND (p_value #>> '{}')::numeric <= 100000000 AND (p_value #>> '{}')::numeric = trunc((p_value #>> '{}')::numeric)
                THEN (p_value #>> '{}')::numeric END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Créer une commande au prix affiché
-- ----------------------------------------------------------------------------
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
BEGIN
    IF v_key IS NOT NULL AND char_length(v_key) NOT BETWEEN 8 AND 128 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST_KEY', 'message', 'Demande illisible : rechargez la page et réessayez.');
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
-- 3. Lancer le paiement d'une commande au montant affiché
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_payment_start(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client   uuid := public.try_uuid(p->>'client_id');
    v_order    uuid := public.try_uuid(p->>'order_id');
    v_key      text := NULLIF(btrim(COALESCE(p->>'client_idempotency_key', '')), '');
    v_expected numeric := private.order_expected_amount(p->'expected_amount');
    v_existing uuid;
    v_existing_order uuid;
    v_amount   numeric;
    r          jsonb;
BEGIN
    IF v_key IS NOT NULL AND char_length(v_key) NOT BETWEEN 8 AND 128 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST_KEY', 'message', 'Demande illisible : rechargez la page et réessayez.');
    END IF;
    IF v_key IS NOT NULL AND v_client IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtextextended('order_payment_key:' || v_client::text || ':' || v_key, 0));
        SELECT id, order_id INTO v_existing, v_existing_order FROM public.payments WHERE client_id = v_client AND client_idempotency_key = v_key;
        IF FOUND THEN
            -- Clé liée à sa commande : jamais le paiement d'une autre commande (ni d'un achat de billets)
            IF v_existing_order IS DISTINCT FROM v_order THEN
                RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_KEY_REUSED',
                    'message', 'Cette demande de paiement ne correspond pas à cette commande : rechargez la page et réessayez.');
            END IF;
            RETURN jsonb_build_object('ok', true, 'duplicate', true, 'payment_id', v_existing);
        END IF;
    END IF;
    BEGIN
        r := public.order_payment_create(p);
        IF (r->>'ok')::boolean THEN
            IF v_expected IS NOT NULL AND (r->>'amount')::numeric <> v_expected THEN
                v_amount := (r->>'amount')::numeric;
                RAISE EXCEPTION USING ERRCODE = 'OR412', MESSAGE = 'ORDER_PRICE_CHANGED';
            END IF;
            IF v_key IS NOT NULL THEN
                UPDATE public.payments SET client_idempotency_key = v_key WHERE id = (r->>'payment_id')::uuid;
            END IF;
        END IF;
    EXCEPTION WHEN SQLSTATE 'OR412' THEN
        -- Sous-bloc annulé : aucun paiement, aucun journal
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_PRICE_CHANGED', 'amount', v_amount,
            'message', 'Le montant à payer a changé. Vérifiez avant de payer.');
    END;
    RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION private.order_expected_amount(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.order_create_checked(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_payment_start(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_create_checked(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_payment_start(jsonb) TO service_role;
