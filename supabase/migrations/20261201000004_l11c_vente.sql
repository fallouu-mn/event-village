-- ============================================================================
-- EVENT VILLAGE — LOT 11c-a, migration 04 : vente d'une table d'un événement
-- ============================================================================
-- Une table se paie en entier, seule (un paiement = une table), par le moteur des billets : paiement de cible TICKET,
-- montants de finance_compute (prix de la table + frais de service finance.service_fee_rate, comme les billets ; aucune
-- commission), grand livre, parrainage, annulation de l'événement, suspension de l'organisatrice : inchangés.
--  1. Lectures pour les écrans (serveur seulement) : event_table_offer (types, tables et zones du plan, état LIBRE ou
--     PRISE, tables restantes, prix par personne, frais et total), event_table_quote (devis d'un type ou d'une table).
--  2. event_table_checkout : attente d'une table PRÉCISE (choisie sur le plan, ou la plus petite libre du type sans
--     plan) ; mêmes règles que les billets (clé d'idempotence, un paiement en attente par compte et par événement, 3
--     paiements en attente par numéro payeur et par heure) ; tables au plus par compte et par événement (réglage
--     event_tables.max_per_account) ; refus en mots simples (« Cette table vient d’être prise, choisissez-en une autre. »).
--     checkout_create_payment : recopie de 20261111000005_lot9quater_argent.sql:636-778 ; changement : un achat de table (clé
--     « table ») passe par event_table_checkout, sous les mêmes verrous ; un type de table n'est jamais un billet
--     (ticket_sale_problems le refuse déjà : CATEGORY_NOT_SOLD_ONLINE).
--  3. payment_confirm : recopie de 20261125000003_f4_ventes.sql:146-337 ; changements : tables des attentes verrouillées après
--     les catégories ; attente de table échue ou table déjà vendue = paiement remboursé en entier ; vente : une ligne
--     event_table_bookings et N billets reliés à la table (event_table_issue : prix et frais de la table répartis au
--     franc près sur les N billets) ; avis EVENT_TABLE_CONFIRMED (titulaire, tout de suite) et EVENT_TABLE_SOLD
--     (organisatrice, groupé, nuit reportée sauf événement à moins de 12 h) à la place de PURCHASE_CONFIRMED et des
--     avis de vente des billets.
--  4. « Ma table » (event_table_mine), liste de la porte (event_table_door_list : propriétaire, contrôleurs affectés,
--     administration habilitée au scan : prénom et initiale), badge du scanner (event_table_badge : « Table 12 · Carré
--     VIP »).
-- Réservées au rôle de service. Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Aides
-- ----------------------------------------------------------------------------
-- Nom affiché d'une personne : prénom et initiale du nom (« Awa D. »)
CREATE OR REPLACE FUNCTION public.event_table_person(p_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NULLIF(btrim(COALESCE(btrim(u.first_name), '') ||
                        CASE WHEN NULLIF(btrim(u.last_name), '') IS NULL THEN '' ELSE ' ' || upper(left(btrim(u.last_name), 1)) || '.' END), '')
      FROM public.users u WHERE u.id = p_user
$$;

-- État d'une table : VENDUE (vente active), EN_ATTENTE (attente de paiement non échue) ou LIBRE
CREATE OR REPLACE FUNCTION public.event_table_state(p_table uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE
        WHEN EXISTS (SELECT 1 FROM public.event_table_bookings b WHERE b.event_table_id = p_table AND b.status = 'ACTIVE') THEN 'VENDUE'
        WHEN EXISTS (SELECT 1 FROM public.stock_reservations s
                      WHERE s.event_table_id = p_table AND s.status = 'ACTIVE' AND s.expires_at > now()) THEN 'EN_ATTENTE'
        ELSE 'LIBRE' END
$$;

-- Refus de vente communs (service, événement, type) ; NULL si la vente est possible. p_type : type de table.
CREATE OR REPLACE FUNCTION public.event_table_sale_refusal(p_event uuid, p_type uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status text;
    c record;
BEGIN
    IF NOT public.fin_setting_bool('features.event_tables_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SERVICE_UNAVAILABLE', 'message', 'La vente de tables n’est pas encore ouverte sur Event Village.');
    END IF;
    SELECT e.status::text INTO v_status FROM public.events e WHERE e.id = p_event;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF v_status = 'ANNULE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_CANCELLED', 'message', 'Cet événement est annulé : ses tables ne sont plus en vente.');
    END IF;
    IF v_status = 'SUSPENDU' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_SUSPENDED', 'message', 'La vente de cet événement est suspendue pour le moment.');
    END IF;
    IF v_status = 'TERMINE' OR public.event_end_at(p_event) <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_PAST', 'message', 'Cet événement est terminé.');
    END IF;
    IF v_status <> 'PUBLIE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_PUBLISHED', 'message', 'Cet événement n’est pas ouvert à la vente.');
    END IF;
    IF p_type IS NULL THEN
        RETURN NULL;
    END IF;
    SELECT id, name, is_active, sale_start, sale_end, payment_mode INTO c
      FROM public.ticket_categories WHERE id = p_type AND event_id = p_event AND kind = 'TABLE';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TABLE_TYPE_NOT_FOUND', 'message', 'Ce type de table n’existe pas pour cet événement.');
    END IF;
    IF NOT c.is_active THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TABLE_TYPE_INACTIVE', 'message', format('Les tables « %s » ne sont plus en vente.', c.name));
    END IF;
    IF c.sale_start IS NOT NULL AND c.sale_start > now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SALE_NOT_STARTED', 'message', format('La vente des tables « %s » n’est pas encore ouverte.', c.name));
    END IF;
    IF c.sale_end IS NOT NULL AND c.sale_end <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SALE_CLOSED', 'message', format('La vente des tables « %s » est close.', c.name));
    END IF;
    IF c.payment_mode <> 'FULL' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PAYMENT_MODE_UNAVAILABLE', 'message', 'Ces tables ne se réservent pas encore en ligne.');
    END IF;
    RETURN NULL;
END;
$$;

-- Prix lisibles d'un type : prix de la table, prix par personne (arrondi au franc), frais et total (moteur unique)
CREATE OR REPLACE FUNCTION public.event_table_prices(p_type uuid, p_operator text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c record;
    v_b jsonb;
BEGIN
    SELECT id, price, seats_per_unit INTO c FROM public.ticket_categories WHERE id = p_type AND kind = 'TABLE';
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    v_b := public.finance_compute('TICKET', jsonb_build_array(jsonb_build_object('category_id', c.id, 'unit_price', c.price, 'quantity', 1)), p_operator);
    RETURN jsonb_build_object(
        'price', c.price, 'seats', c.seats_per_unit,
        'price_per_person', round(c.price / c.seats_per_unit), 'price_per_person_exact', mod(c.price, c.seats_per_unit) = 0,
        'service_fee', (v_b->>'service_fee')::numeric, 'service_fee_rate', (v_b->>'service_fee_rate')::numeric,
        'total', (v_b->>'total_amount')::numeric);
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. Lectures pour les écrans
-- ----------------------------------------------------------------------------
-- Offre d'un événement : { ok, open (vente possible), refusal, plan_enabled, types [...], tables [...], zones [...] }.
-- Le détail du plan (tables et zones) n'est rendu que si le plan est montré aux clients.
CREATE OR REPLACE FUNCTION public.event_table_offer(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event   uuid := public.try_uuid(p->>'event_id');
    v_refusal jsonb;
    v_plan    boolean;
    v_types   jsonb;
    v_tables  jsonb := '[]'::jsonb;
    v_zones   jsonb := '[]'::jsonb;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = v_event AND e.status::text IN ('PUBLIE', 'SUSPENDU', 'TERMINE', 'ANNULE')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF NOT public.fin_setting_bool('features.event_tables_enabled')
       OR NOT EXISTS (SELECT 1 FROM public.ticket_categories c WHERE c.event_id = v_event AND c.kind = 'TABLE' AND c.is_active) THEN
        RETURN jsonb_build_object('ok', true, 'open', false, 'types', '[]'::jsonb, 'tables', '[]'::jsonb, 'zones', '[]'::jsonb, 'plan_enabled', false);
    END IF;
    v_refusal := public.event_table_sale_refusal(v_event, NULL);
    SELECT COALESCE((SELECT pl.plan_enabled FROM public.event_table_plans pl WHERE pl.event_id = v_event), FALSE) INTO v_plan;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'included_text', c.included_text, 'onsite_note', c.onsite_note,
               'payment_mode', c.payment_mode, 'sale_start', c.sale_start, 'sale_end', c.sale_end,
               'scan_color', c.scan_color,
               'total_tables', c.total_quantity,
               'remaining_tables', (SELECT count(*) FROM public.event_tables t WHERE t.category_id = c.id AND public.event_table_state(t.id) = 'LIBRE'),
               'refusal', public.event_table_sale_refusal(v_event, c.id)) || public.event_table_prices(c.id, NULL)
             ORDER BY c.price DESC, c.name), '[]'::jsonb)
      INTO v_types
      FROM public.ticket_categories c WHERE c.event_id = v_event AND c.kind = 'TABLE' AND c.is_active;
    IF v_plan THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                   'id', t.id, 'number', t.number, 'type_id', t.category_id, 'zone_id', t.zone_id, 'x', t.plan_x, 'y', t.plan_y,
                   'shape', t.plan_shape, 'rotation', t.plan_rotation,
                   'state', CASE WHEN public.event_table_state(t.id) = 'LIBRE' THEN 'LIBRE' ELSE 'PRISE' END) ORDER BY t.number), '[]'::jsonb)
          INTO v_tables
          FROM public.event_tables t JOIN public.ticket_categories c ON c.id = t.category_id
         WHERE t.event_id = v_event AND c.is_active;
        SELECT COALESCE(jsonb_agg(jsonb_build_object('id', z.id, 'name', z.name, 'x', z.plan_x, 'y', z.plan_y, 'w', z.plan_w, 'h', z.plan_h)
                                  ORDER BY z.name), '[]'::jsonb)
          INTO v_zones
          FROM public.event_zones z WHERE z.event_id = v_event AND z.plan_x IS NOT NULL;
    END IF;
    RETURN jsonb_build_object('ok', true, 'open', v_refusal IS NULL, 'refusal', v_refusal, 'plan_enabled', v_plan,
                              'types', v_types, 'tables', v_tables, 'zones', v_zones,
                              'hold_minutes', public.fin_setting_num('finance.payment_hold_minutes'), 'read_at', now());
END;
$$;

-- Devis : p { event_id, type_id, table_id (facultatif), operator (facultatif) }
CREATE OR REPLACE FUNCTION public.event_table_quote(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event   uuid := public.try_uuid(p->>'event_id');
    v_type    uuid := public.try_uuid(p->>'type_id');
    v_table   uuid := public.try_uuid(p->>'table_id');
    v_op      text := NULLIF(p->>'operator', '');
    v_refusal jsonb;
    c         record;
    t         record;
BEGIN
    IF v_op IS NOT NULL AND v_op NOT IN ('WAVE', 'ORANGE_MONEY') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'OPERATOR_REQUIRED', 'message', 'Choisissez Wave ou Orange Money.');
    END IF;
    v_refusal := public.event_table_sale_refusal(v_event, v_type);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;
    SELECT id, name, included_text, onsite_note INTO c FROM public.ticket_categories WHERE id = v_type;
    IF v_table IS NOT NULL THEN
        SELECT id, number INTO t FROM public.event_tables WHERE id = v_table AND category_id = v_type AND event_id = v_event;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TABLE_NOT_FOUND', 'message', 'Cette table n’existe pas pour cet événement.');
        END IF;
    END IF;
    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'type_id', c.id, 'name', c.name,
                              'included_text', c.included_text, 'onsite_note', c.onsite_note,
                              'table', CASE WHEN v_table IS NULL THEN NULL ELSE jsonb_build_object(
                                  'id', t.id, 'number', t.number,
                                  'state', CASE WHEN public.event_table_state(t.id) = 'LIBRE' THEN 'LIBRE' ELSE 'PRISE' END) END)
           || public.event_table_prices(c.id, v_op);
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Attente et paiement d'une table
-- ----------------------------------------------------------------------------
-- p : champs de checkout_create_payment (client_id, event_id, partner_id, operator, payer_phone, callback_token_hash,
-- client_idempotency_key, transaction_id, external_order_id, hold_minutes, metadata) + table { type_id, table_id }.
CREATE OR REPLACE FUNCTION public.event_table_checkout(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client    uuid := public.try_uuid(p->>'client_id');
    v_event     uuid := public.try_uuid(p->>'event_id');
    v_type      uuid := public.try_uuid(p->'table'->>'type_id');
    v_table_in  uuid := public.try_uuid(p->'table'->>'table_id');
    v_expires   timestamptz := now() + make_interval(mins => GREATEST(1, COALESCE((p->>'hold_minutes')::int, 15)));
    v_refusal   jsonb;
    v_existing  uuid;
    v_pending   uuid;
    v_payer_pending integer;
    v_max       integer;
    v_mine      integer;
    v_plan      boolean;
    c           record;
    v_table     record;
    v_breakdown jsonb;
    v_payment_id uuid;
BEGIN
    IF v_client IS NULL OR v_event IS NULL OR v_type IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Choix de table illisible : rechargez la page et réessayez.');
    END IF;
    IF NULLIF(p->>'operator', '') IS NULL THEN
        RAISE EXCEPTION 'event_table_checkout : opérateur obligatoire pour un paiement';
    END IF;
    -- 1. Verrous : le type (comme les catégories d'un panier), puis ses tables par identifiant croissant
    SELECT id, name, price, seats_per_unit, total_quantity, sold_quantity, held_quantity, event_id INTO c
      FROM public.ticket_categories WHERE id = v_type AND kind = 'TABLE' FOR UPDATE;
    IF NOT FOUND OR c.event_id IS DISTINCT FROM v_event THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TABLE_TYPE_NOT_FOUND', 'message', 'Ce type de table n’existe pas pour cet événement.');
    END IF;
    PERFORM 1 FROM public.event_tables WHERE category_id = v_type ORDER BY id FOR UPDATE;

    -- 2. Attentes échues de ce type : rendues avant le contrôle (comme le panier des billets)
    UPDATE public.stock_reservations
       SET status = 'EXPIRED', closed_at = now(), close_reason = 'EXPIRED'
     WHERE status = 'ACTIVE' AND expires_at <= now() AND category_id = v_type;

    -- 3. Double soumission (même clé d'idempotence fournie par le client)
    IF p->>'client_idempotency_key' IS NOT NULL THEN
        SELECT id INTO v_existing FROM public.payments
         WHERE client_id = v_client AND client_idempotency_key = p->>'client_idempotency_key';
        IF FOUND THEN
            RETURN jsonb_build_object('ok', false, 'duplicate', true, 'payment_id', v_existing);
        END IF;
    END IF;

    -- 4. Même règle que les billets : un seul paiement en attente par compte et par événement (même verrou consultatif)
    PERFORM pg_advisory_xact_lock(hashtext('checkout:' || v_client::text || ':' || v_event::text));
    SELECT id INTO v_pending FROM public.payments
     WHERE client_id = v_client AND event_id = v_event AND payment_target::text = 'TICKET' AND status::text = 'PENDING'
     ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PAYMENT_PENDING', 'payment_id', v_pending,
            'message', 'Un paiement est déjà en attente pour cet événement.');
    END IF;
    IF NULLIF(p->>'payer_phone', '') IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('checkout-payer:' || (p->>'payer_phone')));
        SELECT count(*) INTO v_payer_pending FROM public.payments
         WHERE payer_phone = p->>'payer_phone' AND status::text = 'PENDING' AND created_at > now() - interval '1 hour';
        IF v_payer_pending >= 3 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PAYER_PENDING_LIMIT',
                'message', 'Un paiement est déjà en attente pour ce numéro. Terminez-le ou attendez quelques minutes.');
        END IF;
    END IF;

    -- 5. Service, événement en vente, type en vente
    v_refusal := public.event_table_sale_refusal(v_event, v_type);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;

    -- 6. Tables au plus par compte et par événement (sous le verrou du compte et de l'événement)
    v_max := COALESCE(public.fin_setting_num('event_tables.max_per_account')::int, 2);
    SELECT count(*) INTO v_mine FROM public.event_table_bookings b
     WHERE b.event_id = v_event AND b.holder_id = v_client AND b.status = 'ACTIVE';
    IF v_mine >= v_max THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TABLE_LIMIT',
            'message', format('Vous avez déjà %s table%s pour cet événement : c’est le maximum par compte.', v_mine, CASE WHEN v_mine > 1 THEN 's' ELSE '' END));
    END IF;

    -- 7. La table : choisie sur le plan, sinon la plus petite libre du type
    SELECT COALESCE((SELECT pl.plan_enabled FROM public.event_table_plans pl WHERE pl.event_id = v_event), FALSE) INTO v_plan;
    IF v_table_in IS NOT NULL THEN
        IF NOT v_plan THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TABLE_CHOICE_UNAVAILABLE',
                'message', 'Le choix de la table n’est pas proposé pour cet événement : choisissez un type de table, son numéro vous sera donné.');
        END IF;
        SELECT id, number INTO v_table FROM public.event_tables WHERE id = v_table_in AND category_id = v_type AND event_id = v_event;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TABLE_NOT_FOUND', 'message', 'Cette table n’existe pas pour cet événement.');
        END IF;
        IF public.event_table_state(v_table.id) <> 'LIBRE' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TABLE_TAKEN', 'message', 'Cette table vient d’être prise, choisissez-en une autre.');
        END IF;
    ELSE
        SELECT t.id, t.number INTO v_table FROM public.event_tables t
         WHERE t.category_id = v_type AND t.event_id = v_event AND public.event_table_state(t.id) = 'LIBRE'
         ORDER BY t.number LIMIT 1;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TABLES_SOLD_OUT', 'message', format('Toutes les tables « %s » sont prises.', c.name));
        END IF;
    END IF;
    IF c.total_quantity - c.sold_quantity - c.held_quantity < 1 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TABLES_SOLD_OUT', 'message', format('Toutes les tables « %s » sont prises.', c.name));
    END IF;

    -- 8. Montants : moteur financier unique (aucun montant du corps n'est utilisé)
    v_breakdown := public.finance_compute('TICKET',
        jsonb_build_array(jsonb_build_object('category_id', c.id, 'unit_price', c.price, 'quantity', 1)), p->>'operator');

    -- 9. Paiement PENDING (mêmes colonnes que checkout_create_payment)
    INSERT INTO public.payments (
        transaction_id, external_order_id, client_id, partner_id, event_id, payment_target, amount, currency,
        is_platform_payment, aggregator, facial_amount, aggregator_fee, service_fee, gross_event_village_revenue,
        net_event_village_revenue, partner_payout_amount, service_fee_rate, aggregator_fee_rate,
        payout_delay_hours, payout_hold_enabled, status, idempotency_key, held_expires_at,
        operator, payer_phone, callback_token_hash, client_idempotency_key, metadata
    ) VALUES (
        p->>'transaction_id', p->>'external_order_id', v_client, NULLIF(p->>'partner_id', '')::uuid,
        v_event, 'TICKET',
        (v_breakdown->>'total_amount')::numeric, 'XOF', TRUE, 'SAMIRPAY',
        (v_breakdown->>'facial_amount')::numeric, (v_breakdown->>'aggregator_fee')::numeric,
        (v_breakdown->>'service_fee')::numeric, (v_breakdown->>'gross_event_village_revenue')::numeric,
        (v_breakdown->>'net_event_village_revenue')::numeric, (v_breakdown->>'partner_payout_amount')::numeric,
        (v_breakdown->>'service_fee_rate')::numeric, (v_breakdown->>'aggregator_fee_rate')::numeric,
        public.fin_setting_num('finance.payout_delay_hours')::int, public.fin_setting_bool('finance.payout_hold_enabled'),
        'PENDING', 'IDEMP-' || (p->>'external_order_id'), v_expires,
        NULLIF(p->>'operator', ''), NULLIF(p->>'payer_phone', ''), p->>'callback_token_hash', p->>'client_idempotency_key',
        COALESCE(p->'metadata', '{}'::jsonb) || jsonb_build_object('event_table', jsonb_build_object(
            'type_id', c.id, 'table_id', v_table.id, 'number', v_table.number, 'seats', c.seats_per_unit))
    )
    ON CONFLICT (client_id, client_idempotency_key) WHERE client_idempotency_key IS NOT NULL DO NOTHING
    RETURNING id INTO v_payment_id;
    IF v_payment_id IS NULL THEN
        SELECT id INTO v_existing FROM public.payments
         WHERE client_id = v_client AND client_idempotency_key = p->>'client_idempotency_key';
        RETURN jsonb_build_object('ok', false, 'duplicate', true, 'payment_id', v_existing);
    END IF;

    -- 10. Attente de la table précise (une unité du type ; index unique : une seule attente active par table)
    PERFORM set_config('event_village.event_tables', 'on', true);
    INSERT INTO public.stock_reservations (payment_id, category_id, quantity, unit_price, unit_service_fee, expires_at, event_table_id)
    SELECT v_payment_id, c.id, 1, (l->>'unit_price')::numeric, (l->>'unit_service_fee')::numeric, v_expires, v_table.id
      FROM jsonb_array_elements(v_breakdown->'lines') l;
    PERFORM set_config('event_village.event_tables', 'off', true);

    RETURN jsonb_build_object('ok', true, 'payment_id', v_payment_id, 'expires_at', v_expires,
                              'amount', (v_breakdown->>'total_amount')::numeric, 'breakdown', v_breakdown,
                              'table', jsonb_build_object('id', v_table.id, 'number', v_table.number, 'type_id', c.id,
                                                          'seats', c.seats_per_unit));
END;
$$;

-- Recopie de 20261111000005_lot9quater_argent.sql:636-778
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
    -- Lot 9 quater (C2, C6)
    v_payer_pending integer;
    v_free record;
BEGIN
    -- Lot 11c-a : achat d'une table d'un événement (une table par paiement), mêmes règles de compte et de payeur
    IF p ? 'table' THEN
        RETURN public.event_table_checkout(p);
    END IF;
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

    -- 3 bis. Lot 7 (D4) : un paiement de billets PENDING du même compte pour le même événement
    --        interdit d'en créer un second (autre clé, autre onglet, autre opérateur). Verrou consultatif
    --        du couple (compte, événement) : deux demandes simultanées sont sérialisées, la seconde voit le
    --        paiement validé par la première. Lot 9 bis (R47, B10) : la garde vaut jusqu'à ce que ce paiement
    --        soit confirmé, annulé, échoué ou expiré, même après l'échéance de sa réservation.
    PERFORM pg_advisory_xact_lock(hashtext('checkout:' || (p->>'client_id') || ':' || (p->>'event_id')));
    SELECT id INTO v_pending FROM public.payments
     WHERE client_id = (p->>'client_id')::uuid AND event_id = (p->>'event_id')::uuid
       AND payment_target::text = 'TICKET' AND status::text = 'PENDING'
     ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PAYMENT_PENDING', 'payment_id', v_pending,
            'message', 'Un paiement est déjà en attente pour cet événement.');
    END IF;

    -- 3 ter. Lot 9 quater (C2 : AUD-21, C3 : AUD-27) : au plus 3 paiements en attente par numéro payeur, tous comptes
    --        confondus, sur l'heure (verrou consultatif du numéro : deux demandes simultanées se suivent).
    IF NULLIF(p->>'payer_phone', '') IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('checkout-payer:' || (p->>'payer_phone')));
        SELECT count(*) INTO v_payer_pending FROM public.payments
         WHERE payer_phone = p->>'payer_phone' AND status::text = 'PENDING' AND created_at > now() - interval '1 hour';
        IF v_payer_pending >= 3 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PAYER_PENDING_LIMIT',
                'message', 'Un paiement est déjà en attente pour ce numéro. Terminez-le ou attendez quelques minutes.');
        END IF;
    END IF;

    -- 3 quater. Lot 9 quater (C6 : AUD-31, G-24) : dans un panier mixte aussi, les billets gratuits émis pour le compte
    --           (transférés compris) plus ceux demandés ne dépassent pas le maximum par commande de la catégorie.
    FOR v_free IN
        SELECT c.id, c.name, c.max_per_order, (e->>'quantity')::int AS quantity
          FROM jsonb_array_elements(v_items) e JOIN public.ticket_categories c ON c.id = (e->>'category_id')::uuid
         WHERE c.price = 0
    LOOP
        IF public.free_tickets_issued_count((p->>'client_id')::uuid, v_free.id) + v_free.quantity > v_free.max_per_order THEN
            RETURN jsonb_build_object('ok', false, 'problems', jsonb_build_array(jsonb_build_object(
                'category_id', v_free.id, 'code', 'FREE_LIMIT_REACHED',
                'message', format('Limite de %s billet(s) gratuit(s) « %s » par compte atteinte.', v_free.max_per_order, v_free.name))));
        END IF;
    END LOOP;

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

-- Vente : une ligne event_table_bookings et N billets reliés (appelée par payment_confirm, sous ses verrous).
-- Prix et frais de la table répartis au franc près : les premiers billets portent le reste de la division.
CREATE OR REPLACE FUNCTION public.event_table_issue(p_payment uuid, p_reservation uuid, p_holder uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r         record;
    v_booking uuid;
    v_ids     uuid[];
BEGIN
    SELECT s.id, s.category_id, s.unit_price, s.unit_service_fee, s.event_table_id, c.event_id, c.seats_per_unit, t.number
      INTO r
      FROM public.stock_reservations s
      JOIN public.ticket_categories c ON c.id = s.category_id
      JOIN public.event_tables t ON t.id = s.event_table_id
     WHERE s.id = p_reservation AND s.payment_id = p_payment;
    IF NOT FOUND OR p_holder IS NULL THEN
        RAISE EXCEPTION 'event_table_issue : attente % du paiement % introuvable ou sans titulaire', p_reservation, p_payment;
    END IF;
    PERFORM set_config('event_village.event_tables', 'on', true);
    INSERT INTO public.event_table_bookings (event_id, event_table_id, category_id, payment_id, holder_id, seats, table_number)
    VALUES (r.event_id, r.event_table_id, r.category_id, p_payment, p_holder, r.seats_per_unit, r.number)
    RETURNING id INTO v_booking;
    PERFORM set_config('event_village.event_tables', 'off', true);
    PERFORM set_config('event_village.event_table_sale', 'on', true);
    WITH ins AS (
        INSERT INTO public.tickets (event_id, category_id, user_id, payment_id, ticket_number, price, service_fee, qr_code, status,
                                    event_table_booking_id)
        SELECT r.event_id, r.category_id, p_holder, p_payment,
               'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
               floor(r.unit_price / r.seats_per_unit) + CASE WHEN g <= r.unit_price - floor(r.unit_price / r.seats_per_unit) * r.seats_per_unit THEN 1 ELSE 0 END,
               floor(r.unit_service_fee / r.seats_per_unit)
                   + CASE WHEN g <= r.unit_service_fee - floor(r.unit_service_fee / r.seats_per_unit) * r.seats_per_unit THEN 1 ELSE 0 END,
               'EV-QR-' || replace(gen_random_uuid()::text, '-', ''),
               'VALIDE', v_booking
          FROM generate_series(1, r.seats_per_unit) g
        RETURNING id
    )
    SELECT array_agg(id) INTO v_ids FROM ins;
    PERFORM set_config('event_village.event_table_sale', 'off', true);
    RETURN jsonb_build_object('booking_id', v_booking, 'ticket_ids', to_jsonb(v_ids));
END;
$$;

-- Avis d'une vente : titulaire (tout de suite) et organisatrice (groupé : une cloche et un SMS par série de 30 minutes)
CREATE OR REPLACE FUNCTION public.event_table_sold_notify(p_booking uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    b       record;
    v_payer text;
    v_owner uuid;
    v_data  jsonb;
BEGIN
    SELECT bk.*, c.name AS type_name, pay.amount, pay.service_fee, pay.facial_amount, pay.payer_phone, z.name AS zone_name
      INTO b
      FROM public.event_table_bookings bk
      JOIN public.ticket_categories c ON c.id = bk.category_id
      JOIN public.payments pay ON pay.id = bk.payment_id
      JOIN public.event_tables t ON t.id = bk.event_table_id
      LEFT JOIN public.event_zones z ON z.id = t.zone_id
     WHERE bk.id = p_booking;
    IF NOT FOUND THEN
        RETURN;
    END IF;
    v_data := COALESCE(public.notif_event_data(b.event_id), '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'booking_id', b.id, 'table_number', b.table_number, 'seats', b.seats, 'table_type', b.type_name, 'zone', b.zone_name));
    v_payer := CASE WHEN b.payer_phone ~ '^[0-9]{9}$' THEN '+221' || b.payer_phone END;
    PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
        'type', 'EVENT_TABLE_CONFIRMED', 'key', 'EVENT_TABLE_CONFIRMED:' || b.payment_id::text,
        'user_id', b.holder_id, 'phone', v_payer, 'event_id', b.event_id,
        'data', v_data || jsonb_build_object('payment_id', b.payment_id, 'total', b.amount, 'service_fee', COALESCE(b.service_fee, 0)))));
    SELECT pa.user_id INTO v_owner FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id WHERE e.id = b.event_id;
    IF v_owner IS NOT NULL THEN
        PERFORM public.notif_enqueue_grouped(jsonb_build_object(
            'type', 'EVENT_TABLE_SOLD', 'scope', b.event_id::text || ':' || v_owner::text, 'window_minutes', 30,
            'user_id', v_owner, 'event_id', b.event_id,
            'data', COALESCE(public.notif_event_data(b.event_id), '{}'::jsonb),
            'add', jsonb_build_object('table_count', 1, 'seat_count', b.seats,
                                      'total', COALESCE(b.facial_amount, b.amount - COALESCE(b.service_fee, 0)))));
    END IF;
END;
$$;

-- Recopie de 20261125000003_f4_ventes.sql:146-337
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
    v_seen text;
    v_lock_event uuid;
    v_duplicate uuid;
    -- Lot 9 quater (C1 : AUD-20)
    v_dup_count integer;
    v_withheld numeric;
    -- Lot 11c-a : vente d'une table
    v_issue jsonb;
    v_table_booking uuid;
BEGIN
    -- Lot 8 (8.2 b) : événement d'abord (ordre unique, contrat 2.3)
    SELECT p.status::text, COALESCE(p.event_id,
             (SELECT c.event_id FROM public.stock_reservations r
                JOIN public.ticket_categories c ON c.id = r.category_id
               WHERE r.payment_id = p.id LIMIT 1))
      INTO v_seen, v_lock_event
      FROM public.payments p WHERE p.id = p_payment_id AND p.payment_target::text = 'TICKET';
    IF v_lock_event IS NOT NULL AND v_seen NOT IN ('SUCCESS', 'PARTIAL', 'REFUNDED', 'REFUND_PENDING') THEN
        PERFORM 1 FROM public.events WHERE id = v_lock_event FOR NO KEY UPDATE;
    END IF;

    SELECT id, status::text AS status, client_id, payment_target::text AS payment_target,
           amount, service_fee, facial_amount, payer_phone, aggregator_fee
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
    -- Lot 11c-a : tables précises des attentes, après les catégories (ordre de event_table_checkout)
    PERFORM 1 FROM public.event_tables
     WHERE id IN (SELECT event_table_id FROM public.stock_reservations WHERE payment_id = p_payment_id AND event_table_id IS NOT NULL)
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
        -- Lot 11c-a : table précise : attente échue = paiement tardif (remboursé en entier) ; table déjà vendue
        ELSIF v_res.event_table_id IS NOT NULL AND v_res.status <> 'ACTIVE' THEN
            v_blocking := format('attente de la table échue (%s)', v_res.name);
        ELSIF v_res.event_table_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.event_table_bookings b
                                                            WHERE b.event_table_id = v_res.event_table_id AND b.status = 'ACTIVE') THEN
            v_blocking := format('table déjà vendue (%s)', v_res.name);
        ELSIF v_res.status = 'ACTIVE' THEN
            CONTINUE;
        ELSIF v_res.status = 'CONVERTED' THEN
            v_blocking := format('réservation déjà convertie (%s)', v_res.name);
        ELSIF v_res.total_quantity - v_res.sold_quantity - v_res.held_quantity < v_res.quantity THEN
            v_blocking := format('plus de place « %s » après échéance de la réservation', v_res.name);
        END IF;
        EXIT WHEN v_blocking IS NOT NULL;
    END LOOP;

    -- Lot 8 (8.2 a) : second paiement réussi d'un même panier, sous le verrou de l'événement
    IF v_blocking IS NULL THEN
        v_duplicate := public.payment_duplicate_of(p_payment_id);
        IF v_duplicate IS NOT NULL THEN
            v_blocking := format('paiement en double du panier déjà réglé (%s)', v_duplicate);
        END IF;
    END IF;

    IF v_blocking IS NOT NULL THEN
        UPDATE public.stock_reservations SET status = 'RELEASED', closed_at = now(), close_reason = 'REFUND'
         WHERE payment_id = p_payment_id AND status = 'ACTIVE';
        UPDATE public.payments
           SET status = 'REFUND_PENDING', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(),
               confirmed_source = p_source,
               metadata = metadata || jsonb_build_object('refund_reason', v_blocking)
                          || CASE WHEN v_duplicate IS NULL THEN '{}'::jsonb
                                  ELSE jsonb_build_object('duplicate_of', v_duplicate) END
         WHERE id = p_payment_id;
        IF v_duplicate IS NULL THEN
            v_cashout := public.refund_request(p_payment_id, 'Panier impossible à honorer : ' || v_blocking, 'REFUND');
            RETURN jsonb_build_object('result', 'REFUND_REQUIRED', 'reason', v_blocking, 'cashout_id', v_cashout);
        END IF;
        -- Lot 9 quater (C1 : AUD-20) : au-delà de 2 paiements en double remboursés à ce compte sur 30 jours, le suivant est
        -- remboursé moins les frais SamirPay du paiement (payments.aggregator_fee) et signalé aux admins ; les deux
        -- premiers restent remboursés en entier, frais à la charge d'Event Village (décision du lot 8, L31).
        SELECT count(*) INTO v_dup_count
          FROM public.payments d
         WHERE d.client_id = v_pay.client_id AND d.id <> p_payment_id
           AND d.metadata ? 'duplicate_of'
           AND d.status::text IN ('REFUND_PENDING', 'REFUNDED', 'PARTIAL')
           AND COALESCE(d.paid_at, d.created_at) > now() - interval '30 days';
        v_withheld := 0;
        IF v_dup_count >= 2 THEN
            v_withheld := LEAST(GREATEST(COALESCE(v_pay.aggregator_fee, 0), 0), v_pay.amount);
            UPDATE public.payments
               SET metadata = metadata || jsonb_build_object('duplicate_fee_withheld', v_withheld, 'duplicate_rank', v_dup_count + 1)
             WHERE id = p_payment_id;
            v_cashout := public.refund_request_withheld(p_payment_id, 'Paiement en double du même panier (frais de l''opérateur retenus)', v_withheld);
        ELSE
            v_cashout := public.refund_request(p_payment_id, 'Paiement en double du même panier', 'REFUND');
        END IF;
        PERFORM public.notif_enqueue_admins(jsonb_build_object('type', 'ADMIN_DUPLICATE_PAYMENT', 'ref', p_payment_id, 'event_id', v_lock_event,
            'data', jsonb_build_object('payment_id', p_payment_id, 'duplicate_of', v_duplicate, 'amount', v_pay.amount,
                                       'duplicate_rank', v_dup_count + 1, 'withheld', v_withheld)));
        RETURN jsonb_build_object('result', 'REFUND_REQUIRED', 'reason', v_blocking, 'cashout_id', v_cashout, 'duplicate_of', v_duplicate);
    END IF;

    -- Conversion et émission (montants lus sur les réservations, jamais recalculés)
    FOR v_res IN SELECT * FROM public.stock_reservations WHERE payment_id = p_payment_id ORDER BY category_id LOOP
        -- held d'abord (trigger), puis sold : la contrainte sold + held <= total reste respectée
        UPDATE public.stock_reservations SET status = 'CONVERTED', closed_at = now(), close_reason = 'CONFIRMED' WHERE id = v_res.id;
        UPDATE public.ticket_categories SET sold_quantity = sold_quantity + v_res.quantity WHERE id = v_res.category_id;
        SELECT event_id INTO v_cat FROM public.ticket_categories WHERE id = v_res.category_id;
        -- Lot 11c-a : une table vendue = une vente et ses N billets reliés
        IF v_res.event_table_id IS NOT NULL THEN
            v_issue := public.event_table_issue(p_payment_id, v_res.id, v_pay.client_id);
            v_table_booking := (v_issue->>'booking_id')::uuid;
            SELECT array_agg(x::uuid) INTO v_new FROM jsonb_array_elements_text(v_issue->'ticket_ids') AS x;
        ELSE
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
        END IF;
        v_ticket_ids := v_ticket_ids || v_new;
        v_event := v_cat.event_id;
    END LOOP;

    UPDATE public.payments
       SET status = 'SUCCESS', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(),
           confirmed_source = p_source, ticket_id = v_ticket_ids[1]
     WHERE id = p_payment_id;

    -- Lot 11c-a : table vendue : avis de la table (titulaire tout de suite, organisatrice groupée) au lieu des avis des billets
    IF v_table_booking IS NOT NULL THEN
        PERFORM public.event_table_sold_notify(v_table_booking);
        RETURN jsonb_build_object('result', 'CONFIRMED', 'ticket_ids', to_jsonb(v_ticket_ids),
                                  'ticket_count', COALESCE(array_length(v_ticket_ids, 1), 0), 'event_table_booking_id', v_table_booking);
    END IF;

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
            -- Finition 4 (point 2) : cloche groupée toutes les 15 minutes, SMS groupé au plus toutes les 30 minutes
            PERFORM public.notif_sale_recorded(jsonb_build_object(
                'owner_id', v_owner, 'event_id', v_event,
                'payment_id', p_payment_id,
                'ticket_count', COALESCE(array_length(v_ticket_ids, 1), 0),
                'total', COALESCE(v_pay.facial_amount, v_pay.amount - COALESCE(v_pay.service_fee, 0))));
        END IF;
    END IF;

    RETURN jsonb_build_object('result', 'CONFIRMED', 'ticket_ids', to_jsonb(v_ticket_ids), 'ticket_count', COALESCE(array_length(v_ticket_ids, 1), 0));
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. « Ma table », liste de la porte, badge du scanner
-- ----------------------------------------------------------------------------
-- Places d'une vente : état de chaque billet pour le titulaire
CREATE OR REPLACE FUNCTION public.event_table_seats(p_booking uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(jsonb_agg(s.seat ORDER BY s.ticket_number), '[]'::jsonb)
      FROM (
        SELECT tk.ticket_number, jsonb_strip_nulls(jsonb_build_object(
                   'ticket_id', tk.id,
                   'state', CASE
                        WHEN tk.status::text = 'UTILISE' THEN 'ENTREE'
                        WHEN tk.status::text IN ('REMBOURSE', 'REMBOURSEMENT_EN_COURS') THEN 'REMBOURSEE'
                        WHEN tk.status::text = 'ANNULE' THEN 'ANNULEE'
                        WHEN tk.user_id IS DISTINCT FROM b.holder_id THEN 'ENVOYEE'
                        WHEN tr.id IS NOT NULL THEN 'EN_ATTENTE'
                        ELSE 'A_ENVOYER' END,
                   'mine', tk.user_id IS NOT DISTINCT FROM b.holder_id,
                   'guest', CASE WHEN tk.user_id IS DISTINCT FROM b.holder_id THEN public.event_table_person(tk.user_id) END,
                   'pending_to', CASE WHEN tr.id IS NOT NULL AND tk.user_id IS NOT DISTINCT FROM b.holder_id
                                      THEN '•• ' || right(regexp_replace(tr.to_phone_or_email, '[^0-9]', '', 'g'), 2) END,
                   'pending_until', CASE WHEN tr.id IS NOT NULL THEN tr.expires_at END)) AS seat
          FROM public.event_table_bookings b
          JOIN public.tickets tk ON tk.event_table_booking_id = b.id
          LEFT JOIN LATERAL (SELECT x.id, x.to_phone_or_email, x.expires_at FROM public.ticket_transfers x
                              WHERE x.ticket_id = tk.id AND x.status::text = 'PENDING' ORDER BY x.created_at DESC LIMIT 1) tr ON TRUE
         WHERE b.id = p_booking
      ) s
$$;

-- p : actor_id, booking_id (facultatif), event_id (facultatif). Ventes dont le compte est le titulaire.
CREATE OR REPLACE FUNCTION public.event_table_mine(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_booking uuid := public.try_uuid(p->>'booking_id');
    v_event   uuid := public.try_uuid(p->>'event_id');
    v_items   jsonb;
BEGIN
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Connectez-vous pour voir vos tables.');
    END IF;
    SELECT COALESCE(jsonb_agg(x.item ORDER BY x.start_at, x.table_number), '[]'::jsonb) INTO v_items
      FROM (
        SELECT public.event_start_at(b.event_id) AS start_at, b.table_number, jsonb_build_object(
                   'booking_id', b.id, 'status', b.status, 'table_number', b.table_number, 'seats', b.seats,
                   'type_id', b.category_id, 'type_name', c.name, 'zone', z.name, 'included_text', c.included_text,
                   'onsite_note', c.onsite_note, 'price', pay.facial_amount, 'service_fee', pay.service_fee, 'total', pay.amount,
                   'event', jsonb_build_object('id', e.id, 'title', e.title, 'status', e.status::text,
                                               'start_at', public.event_start_at(e.id), 'location', e.location),
                   'counts', (SELECT jsonb_build_object(
                                  'sent', count(*) FILTER (WHERE s->>'state' = 'ENVOYEE'),
                                  'pending', count(*) FILTER (WHERE s->>'state' = 'EN_ATTENTE'),
                                  'to_send', count(*) FILTER (WHERE s->>'state' = 'A_ENVOYER'),
                                  'entered', count(*) FILTER (WHERE s->>'state' = 'ENTREE'))
                                FROM jsonb_array_elements(public.event_table_seats(b.id)) s),
                   'seats_detail', public.event_table_seats(b.id),
                   'refund', public.event_table_postponement_window(b.id),
                   'share_path', '/events/' || e.id::text) AS item
          FROM public.event_table_bookings b
          JOIN public.ticket_categories c ON c.id = b.category_id
          JOIN public.events e ON e.id = b.event_id
          JOIN public.payments pay ON pay.id = b.payment_id
          JOIN public.event_tables t ON t.id = b.event_table_id
          LEFT JOIN public.event_zones z ON z.id = t.zone_id
         WHERE b.holder_id = v_actor
           AND (v_booking IS NULL OR b.id = v_booking)
           AND (v_event IS NULL OR b.event_id = v_event)
      ) x;
    IF v_booking IS NOT NULL AND jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Table introuvable.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;

-- p : event_id, actor_id. Propriétaire (fiche VALIDE), contrôleurs affectés, administration habilitée au scan.
CREATE OR REPLACE FUNCTION public.event_table_door_list(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_items jsonb;
BEGIN
    IF v_event IS NULL OR v_actor IS NULL OR NOT public.scan_scanner_authorized(v_actor, v_event) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Liste réservée à l’organisatrice et à son équipe de contrôle.');
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'table_number', b.table_number, 'type_name', c.name, 'zone', z.name, 'seats', b.seats,
               'holder', public.event_table_person(b.holder_id),
               'entered', (SELECT count(*) FROM public.tickets tk WHERE tk.event_table_booking_id = b.id AND tk.status::text = 'UTILISE'),
               'guests', (SELECT COALESCE(jsonb_agg(DISTINCT public.event_table_person(tk.user_id)) FILTER (WHERE public.event_table_person(tk.user_id) IS NOT NULL), '[]'::jsonb)
                            FROM public.tickets tk
                           WHERE tk.event_table_booking_id = b.id AND tk.user_id IS DISTINCT FROM b.holder_id
                             AND tk.status::text IN ('VALIDE', 'UTILISE')))
             ORDER BY b.table_number), '[]'::jsonb)
      INTO v_items
      FROM public.event_table_bookings b
      JOIN public.ticket_categories c ON c.id = b.category_id
      JOIN public.event_tables t ON t.id = b.event_table_id
      LEFT JOIN public.event_zones z ON z.id = t.zone_id
     WHERE b.event_id = v_event AND b.status = 'ACTIVE';
    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'items', v_items, 'read_at', now());
END;
$$;

-- Badge du scanner pour un billet d'une table : « Table 12 · Carré VIP » (zone, sinon type), places entrées
CREATE OR REPLACE FUNCTION public.event_table_badge(p_ticket uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
               'label', 'Table ' || b.table_number || ' · ' || COALESCE(z.name, c.name),
               'table_number', b.table_number, 'type_name', c.name, 'zone', z.name, 'seats', b.seats,
               'entered', (SELECT count(*) FROM public.tickets x WHERE x.event_table_booking_id = b.id AND x.status::text = 'UTILISE'))
      FROM public.tickets tk
      JOIN public.event_table_bookings b ON b.id = tk.event_table_booking_id
      JOIN public.ticket_categories c ON c.id = b.category_id
      JOIN public.event_tables t ON t.id = b.event_table_id
      LEFT JOIN public.event_zones z ON z.id = t.zone_id
     WHERE tk.id = p_ticket
$$;

-- ----------------------------------------------------------------------------
-- Droits : fonctions nouvelles réservées au rôle de service (recopies : droits conservés)
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.event_table_person(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_person(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.event_table_state(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_state(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.event_table_sale_refusal(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_sale_refusal(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.event_table_prices(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_prices(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.event_table_offer(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_offer(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_table_quote(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_quote(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_table_checkout(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_checkout(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_table_issue(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_issue(uuid, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.event_table_sold_notify(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_sold_notify(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.event_table_seats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_seats(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.event_table_mine(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_mine(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_table_door_list(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_door_list(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_table_badge(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_badge(uuid) TO service_role;
