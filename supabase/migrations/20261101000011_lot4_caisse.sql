-- ============================================================================
-- EVENT VILLAGE — LOT 4 : caisse, encaissement espèces, guichet, PIN régisseur (4.5 à 4.7)
-- ============================================================================
--  - controller_shifts : une seule caisse OUVERT par (contrôleur, événement) (index unique partiel) ;
--    event_id en ON DELETE RESTRICT ; plus d'écriture directe par un admin (lecture seule).
--  - tickets.order_id en ON DELETE RESTRICT ; payments.shift_id : paiement espèces rattaché à sa caisse.
--  - shift_open : contrôleur affecté avec la permission espèces, partenaire propriétaire ou admin.
--  - ticket_cash_checkin : encaissement d'un billet « à régler sur place » ET compostage, tout ou
--    rien : scan cash_required récent du même scanneur, commande réellement impayée, caisse ouverte
--    (tous les rôles), montant = prix facial du billet, paiement hors plateforme sans frais ni revenu
--    Event Village (fin_offline), commande et caisse mises à jour, journal.
--  - counter_sale : vente au guichet en espèces (contrôleur affecté, permission espèces, caisse
--    ouverte, contrôles de vente, stock sous verrou), sans écriture au grand livre.
--  - Retrait d'un contrôleur qui a une caisse ouverte : refusé par trigger, quel que soit le chemin
--    (affectation supprimée, rôle CONTROLEUR retiré).
--  - PIN régisseur : sel par événement (haché calculé avec REGISSEUR_PIN_KEY, hors base) ; les anciens
--    PIN (hachés avec une autre clé) sont supprimés et doivent être régénérés ; le haché n'est plus
--    recopié dans controller_shifts.
-- ============================================================================

-- ── Contraintes ─────────────────────────────────────────────────────────────
ALTER TABLE public.controller_shifts DROP CONSTRAINT IF EXISTS controller_shifts_event_id_fkey;
ALTER TABLE public.controller_shifts ADD CONSTRAINT controller_shifts_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_controller_shifts_one_open
    ON public.controller_shifts (controller_id, event_id) WHERE status = 'OUVERT';

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_order_id_fkey;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.controller_shifts(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_payments_shift ON public.payments (shift_id);

DROP POLICY IF EXISTS controller_shifts_admin_all ON public.controller_shifts;
CREATE POLICY controller_shifts_admin_select ON public.controller_shifts
    FOR SELECT USING (public.is_admin());

UPDATE public.controller_shifts SET regisseur_pin_used = NULL WHERE regisseur_pin_used IS NOT NULL;

ALTER TABLE public.event_regisseur_pins ADD COLUMN IF NOT EXISTS pin_salt TEXT;
DELETE FROM public.event_regisseur_pins WHERE pin_salt IS NULL;
ALTER TABLE public.event_regisseur_pins ALTER COLUMN pin_salt SET NOT NULL;

-- ── Ouverture de caisse ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.shift_can_handle_cash(p_user uuid, p_event uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user AND u.status = 'ACTIF')
       AND (EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = p_event AND ec.user_id = p_user AND ec.can_accept_cash)
         OR EXISTS (SELECT 1 FROM public.events e JOIN public.partners p ON p.id = e.partner_id WHERE e.id = p_event AND p.user_id = p_user)
         OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role IN ('ADMIN', 'SUPERADMIN')))
$$;

CREATE OR REPLACE FUNCTION public.shift_open(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := (p->>'user_id')::uuid;
    v_event uuid := (p->>'event_id')::uuid;
    v_float numeric := COALESCE((p->>'opening_float')::numeric, 0);
    v_partner uuid;
    v_status text;
    v_id uuid;
BEGIN
    SELECT partner_id, status::text INTO v_partner, v_status FROM public.events WHERE id = v_event;
    IF v_partner IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND'); END IF;
    IF v_status <> 'PUBLIE' THEN RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_OPEN', 'status', v_status); END IF;
    IF NOT public.shift_can_handle_cash(v_user, v_event) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CASH_FORBIDDEN', 'message', 'Encaissement réservé au contrôleur affecté avec la permission espèces, au partenaire propriétaire ou à un admin.');
    END IF;
    IF v_float < 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FLOAT'); END IF;
    INSERT INTO public.controller_shifts (controller_id, event_id, partner_id, opening_float_amount, status, opening_confirmed_by_pin)
    VALUES (v_user, v_event, v_partner, v_float, 'OUVERT', COALESCE((p->>'pin_verified')::boolean, FALSE))
    ON CONFLICT (controller_id, event_id) WHERE status = 'OUVERT' DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM public.controller_shifts WHERE controller_id = v_user AND event_id = v_event AND status = 'OUVERT';
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_ALREADY_OPEN', 'shift_id', v_id);
    END IF;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_user, 'CAISSE', 'SHIFT_OPENED', 'controller_shifts', v_id, jsonb_build_object('event_id', v_event, 'opening_float', v_float));
    RETURN jsonb_build_object('ok', true, 'shift_id', v_id);
END;
$$;

-- ── Encaissement d'un billet « à régler sur place » + compostage ────────────
CREATE OR REPLACE FUNCTION public.ticket_cash_checkin(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_scan_id uuid := (p->>'scan_id')::uuid;
    v_scanner uuid := (p->>'scanner_id')::uuid;
    v_event uuid := (p->>'event_id')::uuid;
    s record;
    t record;
    o record;
    sh record;
    v_problem text;
    v_amount numeric;
    v_payment uuid;
    v_partner uuid;
    v_accepted uuid;
BEGIN
    SELECT * INTO s FROM public.ticket_scans WHERE id = v_scan_id FOR UPDATE;
    IF NOT FOUND OR s.result <> 'cash_required' OR s.scanner_id <> v_scanner OR s.event_id IS DISTINCT FROM v_event THEN
        RETURN jsonb_build_object('result', 'invalid', 'code', 'CASH_SCAN_INVALID');
    END IF;
    IF s.consumed_at IS NOT NULL THEN
        RETURN jsonb_build_object('result', 'already_used', 'code', 'CASH_ALREADY_PROCESSED');
    END IF;
    IF s.created_at < now() - interval '5 minutes' THEN
        RETURN jsonb_build_object('result', 'cash_required', 'code', 'CASH_SCAN_EXPIRED');
    END IF;
    SELECT * INTO t FROM public.tickets WHERE id = s.ticket_id FOR UPDATE;
    IF t.status::text <> 'VALIDE' THEN
        RETURN jsonb_build_object('result', CASE t.status::text WHEN 'UTILISE' THEN 'already_used' WHEN 'ANNULE' THEN 'cancelled' ELSE 'refunded' END,
                                  'code', 'CASH_TICKET_STATUS');
    END IF;
    IF t.order_id IS NULL OR t.payment_id IS NOT NULL THEN
        RETURN jsonb_build_object('result', 'invalid', 'code', 'CASH_ALREADY_PAID');
    END IF;
    SELECT * INTO o FROM public.orders WHERE id = t.order_id FOR UPDATE;
    IF o.payment_status::text = 'SUCCESS' THEN
        RETURN jsonb_build_object('result', 'invalid', 'code', 'CASH_ALREADY_PAID');
    END IF;
    v_problem := public.scan_event_problem(v_event);
    IF v_problem IS NOT NULL THEN
        RETURN jsonb_build_object('result', v_problem, 'code', 'CASH_EVENT_CLOSED');
    END IF;
    IF NOT public.shift_can_handle_cash(v_scanner, v_event) THEN
        RETURN jsonb_build_object('result', 'cash_required', 'code', 'CASH_FORBIDDEN');
    END IF;
    SELECT * INTO sh FROM public.controller_shifts
     WHERE controller_id = v_scanner AND event_id = v_event AND status = 'OUVERT' FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('result', 'cash_required', 'code', 'CASH_NO_OPEN_SHIFT');
    END IF;

    v_amount := t.price;
    SELECT partner_id INTO v_partner FROM public.events WHERE id = v_event;
    INSERT INTO public.payments (transaction_id, client_id, partner_id, order_id, ticket_id, event_id, payment_target, amount, currency,
                                 payment_method, is_platform_payment, offline_payment_method, aggregator, facial_amount,
                                 aggregator_fee, service_fee, gross_event_village_revenue, net_event_village_revenue,
                                 partner_payout_amount, status, paid_at, shift_id, metadata)
    VALUES ('TX-CASH-' || upper(replace(gen_random_uuid()::text, '-', '')), t.user_id, v_partner, o.id, t.id, v_event, 'TICKET',
            v_amount, 'XOF', 'ESPECES', FALSE, 'ESPECES', NULL, v_amount, 0, 0, 0, 0, 0, 'SUCCESS', now(), sh.id,
            jsonb_build_object('source', 'CASH_CHECKIN', 'scan_id', s.id))
    RETURNING id INTO v_payment;

    UPDATE public.tickets
       SET payment_id = v_payment, status = 'UTILISE', checked_in_at = now(), checked_in_by = v_scanner, updated_at = now()
     WHERE id = t.id AND status = 'VALIDE';
    UPDATE public.orders
       SET paid_amount = paid_amount + v_amount,
           balance_amount = GREATEST(total_amount - (paid_amount + v_amount), 0),
           payment_status = CASE WHEN NOT EXISTS (
                   SELECT 1 FROM public.tickets x WHERE x.order_id = o.id AND x.payment_id IS NULL AND x.id <> t.id)
               THEN 'SUCCESS'::payment_status_enum ELSE 'PARTIAL'::payment_status_enum END,
           updated_at = now()
     WHERE id = o.id;
    UPDATE public.controller_shifts SET expected_cash_total = expected_cash_total + v_amount, updated_at = now() WHERE id = sh.id;
    UPDATE public.ticket_scans SET consumed_at = now() WHERE id = s.id;
    INSERT INTO public.ticket_scans (ticket_id, event_id, scanner_id, result, accepted, method, identity_verified, payload_hash, shift_id, amount_due)
    VALUES (t.id, v_event, v_scanner, 'valid', TRUE, s.method, s.identity_verified, s.payload_hash, sh.id, v_amount)
    RETURNING id INTO v_accepted;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_scanner, 'CAISSE', 'CASH_COLLECTED', 'payments', v_payment,
            jsonb_build_object('ticket_id', t.id, 'order_id', o.id, 'shift_id', sh.id, 'amount', v_amount, 'scan_id', v_accepted));
    RETURN jsonb_build_object('result', 'valid', 'amount', v_amount, 'payment_id', v_payment, 'scan_id', v_accepted, 'shift_id', sh.id);
END;
$$;

-- ── Vente au guichet en espèces ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.counter_sale(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_seller uuid := (p->>'seller_id')::uuid;
    v_event uuid := (p->>'event_id')::uuid;
    v_items jsonb := p->'items';
    v_owner uuid := COALESCE(NULLIF(p->>'buyer_user_id', '')::uuid, (p->>'seller_id')::uuid);
    v_problems jsonb;
    v_event_problem text;
    sh record;
    v_partner uuid;
    v_amount numeric := 0;
    v_payment uuid;
    v_item record;
    v_ids uuid[] := ARRAY[]::uuid[];
    v_new uuid[];
BEGIN
    IF NOT public.fin_setting_bool('access.counter_sale_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'COUNTER_SALE_DISABLED', 'message', 'La vente au guichet est désactivée.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_seller AND u.status = 'ACTIF')
       OR NOT EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_seller) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_ASSIGNED', 'message', 'Vente réservée au contrôleur affecté à l''événement.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_seller AND ec.can_accept_cash) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_CASH_PERMISSION', 'message', 'Permission espèces requise.');
    END IF;
    SELECT * INTO sh FROM public.controller_shifts WHERE controller_id = v_seller AND event_id = v_event AND status = 'OUVERT' FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_OPEN_SHIFT', 'message', 'Ouvrez une caisse avant de vendre.');
    END IF;
    v_event_problem := public.scan_event_problem(v_event);
    IF v_event_problem IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_CLOSED', 'result', v_event_problem);
    END IF;
    IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ITEMS');
    END IF;
    PERFORM 1 FROM public.ticket_categories
     WHERE id IN (SELECT (e->>'category_id')::uuid FROM jsonb_array_elements(v_items) e) ORDER BY id FOR UPDATE;
    -- Contrôles de vente du lot 2, hors fenêtre de vente en ligne et visibilité (vente sur place)
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_problems
      FROM jsonb_array_elements(public.ticket_sale_problems(v_event, v_items)) x
     WHERE x->>'code' IN ('INVALID_ITEMS', 'EVENT_NOT_FOUND', 'CATEGORY_NOT_FOUND', 'INVALID_QUANTITY', 'CATEGORY_INACTIVE',
                          'MAX_PER_ORDER', 'INSUFFICIENT_STOCK');
    IF jsonb_array_length(v_problems) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SALE_CHECK_FAILED', 'problems', v_problems);
    END IF;
    SELECT COALESCE(sum(c.price * (e->>'quantity')::int), 0) INTO v_amount
      FROM jsonb_array_elements(v_items) e JOIN public.ticket_categories c ON c.id = (e->>'category_id')::uuid;
    SELECT partner_id INTO v_partner FROM public.events WHERE id = v_event;

    INSERT INTO public.payments (transaction_id, client_id, partner_id, event_id, payment_target, amount, currency, payment_method,
                                 is_platform_payment, offline_payment_method, aggregator, facial_amount, aggregator_fee, service_fee,
                                 gross_event_village_revenue, net_event_village_revenue, partner_payout_amount, status, paid_at,
                                 shift_id, metadata)
    VALUES ('TX-GUICHET-' || upper(replace(gen_random_uuid()::text, '-', '')), v_owner, v_partner, v_event, 'TICKET', v_amount, 'XOF',
            'ESPECES', FALSE, 'ESPECES', NULL, v_amount, 0, 0, 0, 0, 0, 'SUCCESS', now(), sh.id,
            jsonb_build_object('source', 'COUNTER_SALE', 'seller_id', v_seller))
    RETURNING id INTO v_payment;

    FOR v_item IN
        SELECT (e->>'category_id')::uuid AS category_id, (e->>'quantity')::int AS quantity, c.price
          FROM jsonb_array_elements(v_items) e JOIN public.ticket_categories c ON c.id = (e->>'category_id')::uuid
    LOOP
        UPDATE public.ticket_categories SET sold_quantity = sold_quantity + v_item.quantity WHERE id = v_item.category_id;
        WITH ins AS (
            INSERT INTO public.tickets (event_id, category_id, user_id, payment_id, ticket_number, price, qr_code, status)
            SELECT v_event, v_item.category_id, v_owner, v_payment,
                   'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
                   v_item.price, 'EV-QR-' || replace(gen_random_uuid()::text, '-', ''), 'VALIDE'
              FROM generate_series(1, v_item.quantity)
            RETURNING id
        )
        SELECT array_agg(id) INTO v_new FROM ins;
        v_ids := v_ids || v_new;
    END LOOP;
    UPDATE public.payments SET ticket_id = v_ids[1] WHERE id = v_payment;
    UPDATE public.controller_shifts SET expected_cash_total = expected_cash_total + v_amount, updated_at = now() WHERE id = sh.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_seller, 'CAISSE', 'COUNTER_SALE', 'payments', v_payment,
            jsonb_build_object('event_id', v_event, 'shift_id', sh.id, 'amount', v_amount, 'ticket_ids', to_jsonb(v_ids), 'owner_id', v_owner));
    RETURN jsonb_build_object('ok', true, 'payment_id', v_payment, 'ticket_ids', to_jsonb(v_ids), 'amount', v_amount,
                              'shift_id', sh.id, 'owner_id', v_owner);
END;
$$;

-- ── Retrait d'un contrôleur qui a une caisse ouverte : refusé partout ───────
CREATE OR REPLACE FUNCTION public.controller_removal_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_TABLE_NAME = 'event_controllers' THEN
        IF EXISTS (SELECT 1 FROM public.controller_shifts
                    WHERE controller_id = OLD.user_id AND event_id = OLD.event_id AND status = 'OUVERT') THEN
            RAISE EXCEPTION 'CONTROLLER_HAS_OPEN_SHIFT : le contrôleur % a une caisse ouverte sur l''événement %', OLD.user_id, OLD.event_id
                USING ERRCODE = 'EV409';
        END IF;
    ELSIF OLD.role::text = 'CONTROLEUR' THEN
        IF EXISTS (SELECT 1 FROM public.controller_shifts WHERE controller_id = OLD.user_id AND status = 'OUVERT') THEN
            RAISE EXCEPTION 'CONTROLLER_HAS_OPEN_SHIFT : le contrôleur % a une caisse ouverte', OLD.user_id
                USING ERRCODE = 'EV409';
        END IF;
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_controllers_removal_guard ON public.event_controllers;
CREATE TRIGGER trg_event_controllers_removal_guard
    BEFORE DELETE ON public.event_controllers
    FOR EACH ROW EXECUTE FUNCTION public.controller_removal_guard();
DROP TRIGGER IF EXISTS trg_user_roles_controller_guard ON public.user_roles;
CREATE TRIGGER trg_user_roles_controller_guard
    BEFORE DELETE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.controller_removal_guard();

-- Privilèges : service_role uniquement
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.shift_can_handle_cash(uuid, uuid)',
        'public.shift_open(jsonb)',
        'public.ticket_cash_checkin(jsonb)',
        'public.counter_sale(jsonb)',
        'public.controller_removal_guard()'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
