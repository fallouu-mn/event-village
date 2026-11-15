-- ============================================================================
-- EVENT VILLAGE — FINITION 1, compléments 10, 11 et 12 : plage du contrôle, droit de scanner par événement, la
-- partenaire scanne ses propres événements
-- ============================================================================
-- 10. Règle existante gardée (identique à la cible) : scan_window = début − access.scan_window_before_hours (6 h) → fin
--     retenue (event_end_at : fin saisie, sinon début + 6 h) + access.scan_window_after_hours (6 h) ; scan_event_problem
--     ferme tout de suite un événement ANNULE ou SUSPENDU. Appliquée par ticket_scan, ticket_manual_lookup,
--     ticket_cash_checkin, counter_sale, counter_sale_quote, shift_open, ticket_offline_window (codes hors ligne du
--     porteur), scan_states. Écart corrigé : ticket_guest_list_search (liste des invités) ne la regardait pas.
-- 11. controller_scanner_status : le menu « Scanner » suit les événements (contrôle ouvert ou ouvrant dans 24 h), pas le
--     rôle ; aucun rôle retiré à la fin d'un événement (rien ne change ici).
-- 12. La partenaire scanne ses propres événements sans s'inviter (scan_scanner_authorized le permettait déjà) :
--     « Toutes les portes » sur un événement à zones (scan_gate_context) et vente au guichet (counter_sale,
--     counter_sale_quote ; shift_open l'acceptait déjà par shift_can_handle_cash) ; fiche VALIDE exigée ; jamais
--     l'événement d'une autre partenaire (inchangé).
-- Recopies : chaque fonction reprend sa dernière définition, changements indiqués en ligne. Droits inchangés
-- (CREATE OR REPLACE) ; la fonction nouvelle est réservée au service_role.
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ticket_guest_list_search (recopie, 20261111000006_lot9quater_invites_zones.sql:222-318) : plage du contrôle (complément 10)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_guest_list_search(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_scanner uuid := public.try_uuid(p->>'scanner_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_digits text := regexp_replace(COALESCE(p->>'query', ''), '\D', '', 'g');
    v_kind text;
    v_suffix text;
    v_full text;
    v_max integer;
    v_scope text;
    v_quota jsonb;
    v_items jsonb;
    v_groups integer;
    v_tickets integer;
    v_truncated boolean;
    v_problem text;
    v_opens timestamptz;
BEGIN
    -- Étape 1 : forme ; aucun quota consommé
    IF v_scanner IS NULL OR v_event IS NULL
       OR COALESCE(p->'limits'->>'per_scanner_hour', '') !~ '^[0-9]{1,9}$' THEN
        RETURN jsonb_build_object('ok', false, 'http', 400, 'code', 'INVALID_INPUT');
    END IF;
    v_max := (p->'limits'->>'per_scanner_hour')::integer;
    IF v_digits ~ '^[0-9]{4}$' THEN
        v_kind := 'LAST4';
        v_suffix := v_digits;
    ELSIF v_digits ~ '^7[05678][0-9]{7}$' THEN
        v_kind := 'FULL';
        v_full := '+221' || v_digits;
    ELSIF v_digits ~ '^2217[05678][0-9]{7}$' THEN
        v_kind := 'FULL';
        v_full := '+' || v_digits;
    ELSE
        RETURN jsonb_build_object('ok', false, 'http', 400, 'code', 'INVALID_INPUT');
    END IF;

    -- Étape 2 : droit sur l'événement et périmètre de la saisie manuelle ; rien révélé, aucun quota
    v_scope := public.fin_setting_text('access.manual_entry_scope');
    IF NOT public.scan_scanner_authorized(v_scanner, v_event)
       OR (v_scope = 'ASSIGNED_CONTROLLER' AND NOT EXISTS (
               SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_scanner)) THEN
        RETURN jsonb_build_object('ok', false, 'http', 403, 'code', 'SCAN_FORBIDDEN');
    END IF;

    -- Finition 1 (complément 10) : hors de la plage du contrôle (scan_event_problem, même règle que le scan), aucune
    -- recherche ni aucun quota ; la route dit « Cet événement est terminé : le contrôle est fermé. » ou l'heure d'ouverture
    v_problem := public.scan_event_problem(v_event);
    IF v_problem IS NOT NULL THEN
        SELECT w.opens_at INTO v_opens FROM public.scan_window(v_event) w;
        RETURN jsonb_build_object('ok', false, 'http', 409, 'code', 'CONTROL_CLOSED', 'problem', v_problem, 'opens_at', v_opens);
    END IF;

    -- Étape 3 : quota par contrôleur et par heure (fenêtre fixe)
    v_quota := public.quota_reserve(jsonb_build_array(jsonb_build_object(
        'scope', 'guest_list_search', 'bucket', v_scanner::text, 'window_secs', 3600, 'max', v_max)));
    IF NOT COALESCE((v_quota->>'allowed')::boolean, false) THEN
        RETURN jsonb_build_object('ok', false, 'http', 429, 'code', 'GUEST_LIST_RATE_LIMITED',
                                  'retry_after_seconds', (v_quota->>'retry_after_seconds')::integer);
    END IF;

    -- Étape 4 : lecture sans verrou
    WITH inv AS (
        SELECT t.id, c.id AS category_id, c.name AS category, t.guest_name, x.to_phone_or_email AS phone
          FROM public.tickets t
          JOIN public.ticket_categories c ON c.id = t.category_id
          JOIN LATERAL (SELECT tr.to_phone_or_email FROM public.ticket_transfers tr
                         WHERE tr.ticket_id = t.id AND tr.from_user_id IS NULL AND tr.status::text IN ('PENDING', 'EXPIRED')
                         ORDER BY tr.created_at DESC, tr.id DESC
                         LIMIT 1) x ON TRUE
         WHERE t.event_id = v_event AND t.sale_channel = 'INVITATION' AND t.status::text = 'VALIDE' AND t.user_id IS NULL
           AND CASE WHEN v_kind = 'LAST4' THEN right(x.to_phone_or_email, 4) = v_suffix
                    ELSE x.to_phone_or_email = v_full END
           -- Lot 9 quater (E1 : AUD-13) : une invitation sans nom ne se trouve que par le numéro complet
           AND (v_kind = 'FULL' OR NULLIF(btrim(COALESCE(t.guest_name, '')), '') IS NOT NULL)
    ), grp AS (
        SELECT i.guest_name, i.category, count(*)::integer AS ticket_count, array_agg(i.id ORDER BY i.id) AS ids
          FROM inv i
         GROUP BY i.phone, i.category_id, i.category, i.guest_name
    ), ranked AS (
        SELECT g.guest_name, g.category, g.ticket_count, g.ids,
               row_number() OVER (ORDER BY lower(g.guest_name) NULLS LAST, g.category, g.ids[1]) AS rn
          FROM grp g
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('guest_name', r.guest_name, 'category', r.category,
                                                 'ticket_count', r.ticket_count, 'ticket_ids', to_jsonb(r.ids))
                              ORDER BY r.rn) FILTER (WHERE r.rn <= 10), '[]'::jsonb),
           (count(*) FILTER (WHERE r.rn <= 10))::integer,
           COALESCE(sum(r.ticket_count) FILTER (WHERE r.rn <= 10), 0)::integer,
           count(*) > 10
      INTO v_items, v_groups, v_tickets, v_truncated
      FROM ranked r;

    -- Étape 5 : audit, ni chiffres ni nom (x12)
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_scanner, 'CONTROLE', 'GUEST_LIST_SEARCH', 'events', v_event,
            jsonb_build_object('query_kind', v_kind, 'groups', v_groups, 'tickets', v_tickets, 'truncated', v_truncated));

    RETURN jsonb_build_object('ok', true, 'items', v_items, 'truncated', v_truncated);
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. scan_gate_context (recopie, 20261110000009_lot9ter_zones.sql:176-232) : « Toutes les portes » de la propriétaire (complément 12)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scan_gate_context(p_scanner uuid, p_event uuid, p_claimed uuid, p_claimed_given boolean)
RETURNS TABLE (configured boolean, gate_id uuid, gate_name text, zone_id uuid, zone_name text, zone_kind text, problem text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_assigned boolean;
    v_assigned_gate uuid;
    v_gate uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = p_event) THEN
        IF COALESCE(p_claimed_given, FALSE) AND p_claimed IS NOT NULL THEN
            RETURN QUERY SELECT FALSE, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::text, 'GATE_CHANGED'::text;
        ELSE
            RETURN QUERY SELECT FALSE, NULL::uuid, NULL::text, NULL::uuid, 'Entrée'::text, 'ENTREE'::text, NULL::text;
        END IF;
        RETURN;
    END IF;

    SELECT TRUE, ec.gate_id INTO v_assigned, v_assigned_gate
      FROM public.event_controllers ec
     WHERE ec.event_id = p_event AND ec.user_id = p_scanner;
    IF COALESCE(v_assigned, FALSE) THEN
        IF v_assigned_gate IS NULL THEN
            RETURN QUERY SELECT TRUE, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::text, 'GATE_REQUIRED'::text;
            RETURN;
        END IF;
        IF NOT COALESCE(p_claimed_given, FALSE) OR p_claimed IS DISTINCT FROM v_assigned_gate THEN
            RETURN QUERY SELECT TRUE, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::text, 'GATE_CHANGED'::text;
            RETURN;
        END IF;
        v_gate := v_assigned_gate;
    ELSE
        -- Finition 1 (complément 12) : la propriétaire de l'événement (fiche VALIDE), non affectée, qui n'a choisi aucune
        -- porte (« Toutes les portes » : porte envoyée vide) contrôle comme sur un événement sans zone (entrée unique).
        -- Les contrôleurs affectés et les admins gardent exactement la règle d'avant.
        IF COALESCE(p_claimed_given, FALSE) AND p_claimed IS NULL
           AND EXISTS (SELECT 1 FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
                        WHERE e.id = p_event AND pa.user_id = p_scanner AND pa.status::text = 'VALIDE') THEN
            RETURN QUERY SELECT FALSE, NULL::uuid, NULL::text, NULL::uuid, 'Entrée'::text, 'ENTREE'::text, NULL::text;
            RETURN;
        END IF;
        IF NOT COALESCE(p_claimed_given, FALSE) OR p_claimed IS NULL THEN
            RETURN QUERY SELECT TRUE, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::text, 'GATE_REQUIRED'::text;
            RETURN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.event_gates eg WHERE eg.id = p_claimed AND eg.event_id = p_event) THEN
            RETURN QUERY SELECT TRUE, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::text, 'GATE_INVALID'::text;
            RETURN;
        END IF;
        v_gate := p_claimed;
    END IF;

    RETURN QUERY
    SELECT TRUE, eg.id, eg.name, z.id, z.name, z.kind, NULL::text
      FROM public.event_gates eg
      JOIN public.event_zones z ON z.id = eg.zone_id
     WHERE eg.id = v_gate;
    IF NOT FOUND THEN
        -- Porte supprimée entre la lecture de l'affectation et celle de la porte : jamais un scan sans porte
        RETURN QUERY SELECT TRUE, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::text, 'GATE_INVALID'::text;
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. counter_sale (recopie, 20261110000009_lot9ter_zones.sql:1426-1643) : guichet de la propriétaire (complément 12)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.counter_sale(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner boolean;
    v_seller uuid := public.try_uuid(p->>'seller_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_items jsonb := p->'items';
    v_key text := NULLIF(btrim(COALESCE(p->>'idempotency_key', '')), '');
    v_phone text := NULLIF(btrim(COALESCE(p->>'buyer_phone', '')), '');
    v_store_key text;
    v_problems jsonb;
    v_channel jsonb;
    v_event_problem text;
    sh record;
    prev record;
    v_partner uuid;
    v_amount numeric := 0;
    v_payment uuid;
    v_tx text;
    v_item record;
    v_ticket uuid;
    v_scan uuid;
    v_ids uuid[] := ARRAY[]::uuid[];
    v_scans uuid[] := ARRAY[]::uuid[];
    v_rstatus text;
    v_rreason text;
    -- Lot 9 ter (9t.15) : porte du vendeur
    v_gate uuid;
    v_gate_zone uuid;
    v_gate_kind text;
    v_gate_problems jsonb;
    v_gate_message text;
BEGIN
    IF v_seller IS NULL OR v_event IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Vente incomplète : vendeur et événement requis.');
    END IF;
    IF v_key IS NULL OR v_key !~ '^[A-Za-z0-9_-]{8,100}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_KEY_REQUIRED', 'message', 'Clé d''idempotence obligatoire.');
    END IF;
    IF v_phone IS NOT NULL AND v_phone !~ '^7[05678][0-9]{7}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PHONE', 'message', 'Numéro de l''acheteur invalide.');
    END IF;
    v_store_key := 'COUNTER:' || v_seller::text || ':' || v_key;

    IF NOT public.fin_setting_bool('access.counter_sale_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'COUNTER_SALE_DISABLED', 'message', 'La vente au guichet est désactivée.');
    END IF;
    -- Finition 1 (complément 12) : la propriétaire de l'événement (fiche VALIDE) vend sans être affectée ni avoir de porte
    v_owner := EXISTS (SELECT 1 FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
                         WHERE e.id = v_event AND pa.user_id = v_seller AND pa.status::text = 'VALIDE');
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_seller AND u.status = 'ACTIF')
       OR (NOT v_owner AND NOT EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_seller)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_ASSIGNED', 'message', 'Vente réservée au contrôleur affecté à l''événement.');
    END IF;
    IF NOT v_owner AND NOT EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_seller AND ec.can_accept_cash) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_CASH_PERMISSION', 'message', 'Permission espèces requise.');
    END IF;

    -- Rejeu d'une vente déjà enregistrée (réponse identique, même si la caisse a été clôturée depuis)
    SELECT id, transaction_id, amount, shift_id, event_id INTO prev FROM public.payments WHERE idempotency_key = v_store_key;
    IF NOT FOUND THEN
        SELECT * INTO sh FROM public.controller_shifts
         WHERE controller_id = v_seller AND event_id = v_event AND status = 'OUVERT' FOR UPDATE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NO_OPEN_SHIFT', 'message', 'Ouvrez une caisse avant de vendre.');
        END IF;
        -- Deux appels simultanés avec la même clé : sérialisés par le verrou de la caisse
        SELECT id, transaction_id, amount, shift_id, event_id INTO prev FROM public.payments WHERE idempotency_key = v_store_key;
    END IF;
    IF prev.id IS NOT NULL THEN
        SELECT o.status, o.reason INTO v_rstatus, v_rreason
          FROM public.notification_outbox o WHERE o.idempotency_key = 'COUNTER_RECEIPT:' || prev.id::text || ':SMS';
        RETURN jsonb_build_object('ok', true, 'replayed', true, 'payment_id', prev.id, 'transaction_id', prev.transaction_id,
            'amount', prev.amount, 'shift_id', prev.shift_id, 'event_id', prev.event_id,
            'ticket_ids', COALESCE((SELECT jsonb_agg(t.id ORDER BY t.created_at, t.id) FROM public.tickets t WHERE t.payment_id = prev.id), '[]'::jsonb),
            'scan_ids', COALESCE((SELECT jsonb_agg(s.id ORDER BY s.created_at, s.id) FROM public.ticket_scans s
                                    JOIN public.tickets t ON t.id = s.ticket_id
                                   WHERE t.payment_id = prev.id AND s.accepted), '[]'::jsonb),
            'receipt_queued', v_rstatus IS NOT NULL AND v_rstatus NOT IN ('SKIPPED', 'CANCELLED'),
            'receipt_refusal', CASE WHEN v_rstatus = 'SKIPPED' THEN v_rreason END);
    END IF;

    v_event_problem := public.scan_event_problem(v_event);
    IF v_event_problem IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_CLOSED', 'result', v_event_problem,
                                  'message', 'Cet événement n''est pas ouvert à la vente au guichet.');
    END IF;
    IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ITEMS', 'message', 'Panier vide ou invalide.');
    END IF;
    PERFORM 1 FROM public.ticket_categories
     WHERE id IN (SELECT public.try_uuid(e->>'category_id') FROM jsonb_array_elements(v_items) e) ORDER BY id FOR UPDATE;
    -- Lot 8 (8.0) : canal contrôlé sous le verrou des catégories ; panier mixte refusé en entier
    v_channel := public.ticket_counter_channel_problems(v_event, v_items);
    IF jsonb_array_length(v_channel) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CATEGORY_NOT_SOLD_AT_COUNTER', 'problems', v_channel,
                                  'message', 'Une catégorie de ce panier n''est pas vendue au guichet.');
    END IF;
    -- Lot 9 ter (9t.15) : guichet = entrée ; porte du vendeur et règle des zones, rien d'écrit en cas de refus
    -- Finition 1 (complément 12) : la propriétaire vend « toutes les portes » (aucune règle de porte pour elle)
    IF EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = v_event) AND NOT v_owner THEN
        SELECT ec.gate_id INTO v_gate FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_seller;
        IF v_gate IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'GATE_REQUIRED',
                'message', 'Aucune porte ne vous est attribuée : demandez à l’organisateur de vous en attribuer une. Rien n’a été vendu.');
        END IF;
        SELECT z.id, z.kind INTO v_gate_zone, v_gate_kind
          FROM public.event_gates eg JOIN public.event_zones z ON z.id = eg.zone_id
         WHERE eg.id = v_gate;
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                   'category_id', c.id, 'category', c.name,
                   'zones', COALESCE((SELECT jsonb_agg(x.name ORDER BY x.position, lower(btrim(x.name)), x.id)
                                        FROM (SELECT z.name, z.position, z.id
                                                FROM public.event_zones z
                                                JOIN public.zone_categories zc ON zc.zone_id = z.id
                                               WHERE z.event_id = v_event AND z.kind = 'ENTREE' AND zc.category_id = c.id
                                               ORDER BY z.position, lower(btrim(z.name)), z.id
                                               LIMIT 2) x), '[]'::jsonb))
                   ORDER BY c.price, c.name, c.id), '[]'::jsonb)
          INTO v_gate_problems
          FROM public.ticket_categories c
         WHERE c.event_id = v_event
           AND c.id IN (SELECT public.try_uuid(e->>'category_id') FROM jsonb_array_elements(v_items) e)
           AND (v_gate_kind IS DISTINCT FROM 'ENTREE'
                OR NOT EXISTS (SELECT 1 FROM public.zone_categories zc WHERE zc.zone_id = v_gate_zone AND zc.category_id = c.id));
        IF v_gate_kind IS DISTINCT FROM 'ENTREE' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'CATEGORY_NOT_ADMITTED_AT_GATE', 'problems', v_gate_problems,
                'message', 'La vente au guichet se fait à une porte d’entrée : demandez à l’organisateur de changer votre porte.');
        END IF;
        IF jsonb_array_length(v_gate_problems) > 0 THEN
            IF jsonb_array_length(v_gate_problems) = 1 THEN
                v_gate_message := (v_gate_problems->0->>'category') || ' n’entre pas par cette porte'
                    || CASE jsonb_array_length(v_gate_problems->0->'zones')
                           WHEN 0 THEN '.'
                           WHEN 1 THEN ' : vendez-la à ' || (v_gate_problems->0->'zones'->>0) || '.'
                           ELSE ' : vendez-la à ' || (v_gate_problems->0->'zones'->>0) || ' ou ' || (v_gate_problems->0->'zones'->>1) || '.' END;
            ELSE
                SELECT 'Ces catégories n’entrent pas par cette porte : ' || string_agg(x.elem->>'category', ', ' ORDER BY x.ord) || '.'
                  INTO v_gate_message
                  FROM jsonb_array_elements(v_gate_problems) WITH ORDINALITY AS x(elem, ord);
            END IF;
            RETURN jsonb_build_object('ok', false, 'code', 'CATEGORY_NOT_ADMITTED_AT_GATE', 'problems', v_gate_problems,
                                      'message', v_gate_message);
        END IF;
    END IF;
    -- Contrôles de vente du lot 2, hors fenêtre de vente en ligne et canal en ligne (vente sur place)
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_problems
      FROM jsonb_array_elements(public.ticket_sale_problems(v_event, v_items)) x
     WHERE x->>'code' IN ('INVALID_ITEMS', 'EVENT_NOT_FOUND', 'CATEGORY_NOT_FOUND', 'INVALID_QUANTITY', 'CATEGORY_INACTIVE',
                          'MAX_PER_ORDER', 'INSUFFICIENT_STOCK');
    IF jsonb_array_length(v_problems) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SALE_CHECK_FAILED', 'problems', v_problems,
                                  'message', 'Vente impossible : vérifiez les catégories et les quantités.');
    END IF;
    SELECT COALESCE(sum(c.price * (e->>'quantity')::int), 0) INTO v_amount
      FROM jsonb_array_elements(v_items) e JOIN public.ticket_categories c ON c.id = (e->>'category_id')::uuid;
    SELECT partner_id INTO v_partner FROM public.events WHERE id = v_event;
    v_tx := 'TX-GUICHET-' || upper(replace(gen_random_uuid()::text, '-', ''));

    INSERT INTO public.payments (transaction_id, client_id, partner_id, event_id, payment_target, amount, currency, payment_method,
                                 is_platform_payment, offline_payment_method, aggregator, facial_amount, aggregator_fee, service_fee,
                                 gross_event_village_revenue, net_event_village_revenue, partner_payout_amount, status, paid_at,
                                 shift_id, payer_phone, idempotency_key, metadata)
    VALUES (v_tx, NULL, v_partner, v_event, 'TICKET', v_amount, 'XOF',
            'ESPECES', FALSE, 'ESPECES', NULL, v_amount, 0, 0, 0, 0, 0, 'SUCCESS', now(), sh.id,
            v_phone, v_store_key, jsonb_build_object('source', 'COUNTER_SALE', 'seller_id', v_seller))
    RETURNING id INTO v_payment;

    FOR v_item IN
        SELECT (e->>'category_id')::uuid AS category_id, (e->>'quantity')::int AS quantity, c.price
          FROM jsonb_array_elements(v_items) e JOIN public.ticket_categories c ON c.id = (e->>'category_id')::uuid
    LOOP
        UPDATE public.ticket_categories SET sold_quantity = sold_quantity + v_item.quantity WHERE id = v_item.category_id;
        FOR i IN 1 .. v_item.quantity LOOP
            INSERT INTO public.tickets (event_id, category_id, user_id, payment_id, ticket_number, price, qr_code, status,
                                        sale_channel, checked_in_at, checked_in_by)
            VALUES (v_event, v_item.category_id, NULL, v_payment,
                    'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
                    v_item.price, 'EV-QR-' || replace(gen_random_uuid()::text, '-', ''), 'UTILISE',
                    'COUNTER', now(), v_seller)
            RETURNING id INTO v_ticket;
            -- Entrée immédiate : scan accepté du vendeur (le trigger ticket_scans_enrich recopie catégorie,
            -- rôle CONTROLEUR et point d'entrée de l'affectation). Lot 9 ter : porte du vendeur (NULL sans zone),
            -- zone et point d'entrée de la porte posés par le même trigger.
            INSERT INTO public.ticket_scans (ticket_id, event_id, scanner_id, result, accepted, method, identity_verified,
                                             payload_hash, shift_id, amount_due, gate_id)
            VALUES (v_ticket, v_event, v_seller, 'valid', TRUE, 'COUNTER', FALSE, NULL, sh.id, v_item.price, v_gate)
            RETURNING id INTO v_scan;
            v_ids := v_ids || v_ticket;
            v_scans := v_scans || v_scan;
        END LOOP;
    END LOOP;
    UPDATE public.payments SET ticket_id = v_ids[1] WHERE id = v_payment;
    UPDATE public.controller_shifts SET expected_cash_total = expected_cash_total + v_amount, updated_at = now() WHERE id = sh.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_seller, 'CAISSE', 'COUNTER_SALE', 'payments', v_payment,
            jsonb_build_object('event_id', v_event, 'shift_id', sh.id, 'amount', v_amount, 'ticket_ids', to_jsonb(v_ids),
                               'scan_ids', to_jsonb(v_scans), 'buyer_phone_given', v_phone IS NOT NULL));

    -- Lot 6 (J1.3) : reçu SMS au numéro saisi, dans la transaction de la vente (aucun compte rattaché)
    IF v_phone IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'COUNTER_RECEIPT', 'key', 'COUNTER_RECEIPT:' || v_payment::text,
            'phone', '+221' || v_phone, 'event_id', v_event, 'shift_id', sh.id,
            'data', COALESCE(public.notif_event_data(v_event), '{}'::jsonb) || jsonb_build_object(
                'payment_id', v_payment, 'ticket_count', cardinality(v_ids), 'amount', v_amount,
                'reference', upper(left(v_payment::text, 8)))));
        SELECT o.status, o.reason INTO v_rstatus, v_rreason
          FROM public.notification_outbox o WHERE o.idempotency_key = 'COUNTER_RECEIPT:' || v_payment::text || ':SMS';
    END IF;

    RETURN jsonb_build_object('ok', true, 'replayed', false, 'payment_id', v_payment, 'transaction_id', v_tx,
                              'ticket_ids', to_jsonb(v_ids), 'scan_ids', to_jsonb(v_scans), 'amount', v_amount,
                              'shift_id', sh.id, 'event_id', v_event,
                              'receipt_queued', v_rstatus IS NOT NULL AND v_rstatus NOT IN ('SKIPPED', 'CANCELLED'),
                              'receipt_refusal', CASE WHEN v_rstatus = 'SKIPPED' THEN v_rreason END);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. counter_sale_quote (recopie, 20261106000001_lot8_canaux.sql:484-550) : guichet de la propriétaire (complément 12)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.counter_sale_quote(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner boolean;
    v_seller uuid := public.try_uuid(p->>'seller_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_items jsonb := p->'items';
    v_event_problem text;
    v_problems jsonb;
    v_channel jsonb;
    v_lines jsonb;
    v_total numeric;
BEGIN
    IF v_seller IS NULL OR v_event IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Devis incomplet : vendeur et événement requis.');
    END IF;
    IF NOT public.fin_setting_bool('access.counter_sale_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'COUNTER_SALE_DISABLED', 'message', 'La vente au guichet est désactivée.');
    END IF;
    -- Finition 1 (complément 12) : la propriétaire de l'événement (fiche VALIDE) vend sans être affectée ni avoir de porte
    v_owner := EXISTS (SELECT 1 FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
                         WHERE e.id = v_event AND pa.user_id = v_seller AND pa.status::text = 'VALIDE');
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_seller AND u.status = 'ACTIF')
       OR (NOT v_owner AND NOT EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_seller)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_ASSIGNED', 'message', 'Vente réservée au contrôleur affecté à l''événement.');
    END IF;
    IF NOT v_owner AND NOT EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_seller AND ec.can_accept_cash) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_CASH_PERMISSION', 'message', 'Permission espèces requise.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.controller_shifts sh
                    WHERE sh.controller_id = v_seller AND sh.event_id = v_event AND sh.status = 'OUVERT') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_OPEN_SHIFT', 'message', 'Ouvrez une caisse avant de vendre.');
    END IF;
    v_event_problem := public.scan_event_problem(v_event);
    IF v_event_problem IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_CLOSED', 'result', v_event_problem,
                                  'message', 'Cet événement n''est pas ouvert à la vente au guichet.');
    END IF;
    IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ITEMS', 'message', 'Panier vide ou invalide.');
    END IF;
    -- Lot 8 (8.0) : même refus que counter_sale, aucun total
    v_channel := public.ticket_counter_channel_problems(v_event, v_items);
    IF jsonb_array_length(v_channel) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CATEGORY_NOT_SOLD_AT_COUNTER', 'problems', v_channel,
                                  'message', 'Une catégorie de ce panier n''est pas vendue au guichet.');
    END IF;
    -- Contrôles de vente de counter_sale (lot 2, hors fenêtre de vente en ligne et canal en ligne)
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_problems
      FROM jsonb_array_elements(public.ticket_sale_problems(v_event, v_items)) x
     WHERE x->>'code' IN ('INVALID_ITEMS', 'EVENT_NOT_FOUND', 'CATEGORY_NOT_FOUND', 'INVALID_QUANTITY', 'CATEGORY_INACTIVE',
                          'MAX_PER_ORDER', 'INSUFFICIENT_STOCK');
    IF jsonb_array_length(v_problems) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ITEMS', 'problems', v_problems,
                                  'message', 'Vente impossible : vérifiez les catégories et les quantités.');
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('category_id', c.id, 'name', c.name, 'unit_price', c.price,
                                                 'quantity', (e.x->>'quantity')::integer,
                                                 'amount', c.price * (e.x->>'quantity')::integer) ORDER BY e.ord), '[]'::jsonb),
           COALESCE(sum(c.price * (e.x->>'quantity')::integer), 0)
      INTO v_lines, v_total
      FROM jsonb_array_elements(v_items) WITH ORDINALITY AS e(x, ord)
      JOIN public.ticket_categories c ON c.id = public.try_uuid(e.x->>'category_id');
    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'total', v_total, 'lines', v_lines);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. controller_scanner_status (nouvelle, complément 11) : p = { user_id } → { ok, scanner, open_now, next_opens_at }. scanner vrai si au moins un événement affecté (fiche VALIDE ou SUSPENDU, compte ACTIF) a son contrôle ouvert (scan_event_problem nul) ou ouvre dans les 24 h (publié). Rien n'est retiré ni désactivé à la fin d'un événement.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.controller_scanner_status(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := public.try_uuid(p->>'user_id');
    v_open integer;
    v_next timestamptz;
BEGIN
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', true, 'scanner', false, 'open_now', 0, 'next_opens_at', NULL);
    END IF;
    WITH a AS (
        SELECT e.id, e.status::text AS status, public.scan_event_problem(e.id) AS problem, w.opens_at
          FROM public.event_controllers ec
          JOIN public.events e ON e.id = ec.event_id
          JOIN public.partners pa ON pa.id = e.partner_id
          CROSS JOIN LATERAL public.scan_window(e.id) w
         WHERE ec.user_id = v_user AND pa.status::text IN ('VALIDE', 'SUSPENDU')
    )
    SELECT count(*) FILTER (WHERE a.problem IS NULL),
           min(a.opens_at) FILTER (WHERE a.problem = 'event_not_open' AND a.status = 'PUBLIE' AND a.opens_at > now())
      INTO v_open, v_next
      FROM a;
    RETURN jsonb_build_object('ok', true,
                              'scanner', v_open > 0 OR (v_next IS NOT NULL AND v_next <= now() + interval '24 hours'),
                              'open_now', v_open, 'next_opens_at', v_next);
END;
$$;

REVOKE ALL ON FUNCTION public.controller_scanner_status(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.controller_scanner_status(jsonb) TO service_role;
