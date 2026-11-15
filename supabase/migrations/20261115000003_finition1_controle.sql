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
    -- Finition 1 (complément 12) : la propriétaire sur un événement à zones : chaque catégorie vendue doit entrer par une
    -- porte d'entrée (sinon refus, rien d'écrit) ; l'entrée de chaque billet porte cette porte (invariant (x8))
    IF v_owner AND EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = v_event) THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object('category_id', c.id, 'category', c.name, 'zones', '[]'::jsonb)
                                  ORDER BY c.price, c.name, c.id), '[]'::jsonb)
          INTO v_gate_problems
          FROM public.ticket_categories c
         WHERE c.event_id = v_event
           AND c.id IN (SELECT public.try_uuid(e->>'category_id') FROM jsonb_array_elements(v_items) e)
           AND NOT EXISTS (SELECT 1 FROM public.event_gates eg JOIN public.event_zones z ON z.id = eg.zone_id
                             JOIN public.zone_categories zc ON zc.zone_id = z.id
                            WHERE z.event_id = v_event AND z.kind = 'ENTREE' AND zc.category_id = c.id);
        IF jsonb_array_length(v_gate_problems) > 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'CATEGORY_NOT_ADMITTED_AT_GATE', 'problems', v_gate_problems,
                'message', 'Aucune porte d’entrée ne laisse entrer cette catégorie : ajoutez-la à une zone qui a une porte. Rien n’a été vendu.');
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
            VALUES (v_ticket, v_event, v_seller, 'valid', TRUE, 'COUNTER', FALSE, NULL, sh.id, v_item.price,
                    COALESCE(v_gate, CASE WHEN v_owner THEN (
                        SELECT eg.id FROM public.event_gates eg JOIN public.event_zones z ON z.id = eg.zone_id
                          JOIN public.zone_categories zc ON zc.zone_id = z.id
                         WHERE z.event_id = v_event AND z.kind = 'ENTREE' AND zc.category_id = v_item.category_id
                         ORDER BY z.position, lower(btrim(z.name)), lower(btrim(eg.name)), eg.id LIMIT 1) END))
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
-- 2 bis. ticket_scan (recopie, 20261111000006_lot9quater_invites_zones.sql:324-706) : porte d’entrée retenue pour « Toutes les portes » (complément 12)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_scan(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_scanner uuid := (p->>'scanner_id')::uuid;
    v_event uuid := (p->>'event_id')::uuid;
    v_method text := COALESCE(p->>'method', 'QR');
    v_identity boolean := COALESCE((p->>'identity_verified')::boolean, FALSE);
    v_hash text := NULLIF(p->>'payload_hash', '');
    v_pre text := NULLIF(p->>'pre_result', '');
    v_key text := NULLIF(btrim(COALESCE(p->>'client_key', '')), '');
    -- Lot 8 (8.2 e) : lecture sans cast ; toute valeur non `false` compte comme un renvoi, jamais un compostage
    v_replay_only boolean := COALESCE(p->>'replay_only', 'false') <> 'false';
    v_version integer;
    v_ticket_id uuid;
    t record;
    s record;
    v_problem text;
    v_pay_status text;
    v_order_status text;
    v_scope text;
    v_scan uuid;
    v_info jsonb;
    v_reply jsonb;
    v_checked_at timestamptz;
    v_checked_by uuid;
    -- Lot 9 ter (9t.15) : porte annoncée, contexte de porte et verdict de zone
    v_gate_given boolean := p ? 'gate_id';
    v_claimed uuid := public.try_uuid(p->>'gate_id');
    -- Lot 9 quater (E2 : AUD-14) : passage précédent du billet à ce contrôle de zone
    v_zone_last timestamptz;
    v_zone_passes integer;
    g record;
    v_ag record;
    v_zone_result text;
    v_redirect jsonb;
    v_zone jsonb;
    v_gate jsonb;
    v_kind text;
    -- Lot 9 ter (9t.16) : porte du premier compostage
    v_checked_gate text;
    -- Lot 9 ter (9t.17) : transfert d'invitation clos par la liste des invités
    v_invite uuid;
BEGIN
    IF v_method NOT IN ('QR', 'MANUAL', 'GUEST_LIST') THEN
        RAISE EXCEPTION 'ticket_scan : méthode % inconnue', v_method;
    END IF;
    -- Clé d'idempotence : facultative pour la RPC (seed, appels internes), obligatoire pour la route
    IF v_key IS NOT NULL AND v_key !~ '^[A-Za-z0-9_-]{8,100}$' THEN
        RETURN jsonb_build_object('http', 400, 'code', 'IDEMPOTENCY_KEY_REQUIRED');
    END IF;
    -- Lot 8 (8.2 e) : un renvoi sans clé ne désigne aucune lecture, refus avant toute écriture
    IF v_replay_only AND v_key IS NULL THEN
        RETURN jsonb_build_object('http', 400, 'code', 'IDEMPOTENCY_KEY_REQUIRED');
    END IF;
    -- Version du secret présentée (QR seulement) ; absente ou illisible : NULL, refusée à l'étape 5 (D32)
    IF v_method = 'QR' AND COALESCE(p->>'secret_version', '') ~ '^[1-9][0-9]{0,8}$' THEN
        v_version := (p->>'secret_version')::integer;
    END IF;
    -- 0. Deux envois simultanés de la même clé par le même scanneur : sérialisés
    IF v_key IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('scan:' || COALESCE(v_scanner::text, '') || ':' || v_key));
    END IF;
    -- 1. Droit du scanneur sur l'événement, avant toute lecture du billet ou du code
    --    (refus journalisé sans la clé : il n'est pas rejouable et ne bloque pas une lecture ultérieure)
    IF v_scanner IS NULL OR v_event IS NULL OR NOT public.scan_scanner_authorized(v_scanner, v_event) THEN
        -- Lot 8 (L43) : un renvoi n'écrit rien, pas même `forbidden`
        IF NOT v_replay_only THEN
            PERFORM public.scan_log(NULL, v_event, v_scanner, 'forbidden', FALSE, v_method, v_identity, v_hash, NULL, v_version, NULL);
        END IF;
        RETURN jsonb_build_object('http', 403, 'code', 'SCAN_FORBIDDEN');
    END IF;
    -- 1 bis. Rejeu de la même lecture (réponse perdue, relance automatique) : verdict d'origine, aucune ligne
    IF v_key IS NOT NULL THEN
        -- Lot 8 (8.2 e) : un renvoi est propre à l'événement demandé
        SELECT * INTO s FROM public.ticket_scans
         WHERE scanner_id = v_scanner AND client_key = v_key
           AND (NOT v_replay_only OR event_id = v_event);
        IF FOUND THEN
            -- Lot 9 ter : une ligne de zone rend son verdict de zone (result NULL)
            v_reply := jsonb_build_object('result', COALESCE(s.result, s.zone_result), 'scan_id', s.id, 'replayed', TRUE,
                                          'consumed', s.consumed_at IS NOT NULL);
            IF s.amount_due IS NOT NULL THEN
                v_reply := v_reply || jsonb_build_object('amount_due', s.amount_due);
            END IF;
            -- Le billet n'est rendu que si la réponse d'origine le rendait (jamais pour un billet introuvable,
            -- d'un autre événement, ou une lecture refusée avant le billet). Lot 9 ter : COALESCE, sinon une ligne de
            -- zone (result NULL) perdrait son billet (NULL NOT IN … vaut NULL).
            IF s.ticket_id IS NOT NULL AND COALESCE(s.result, s.zone_result) NOT IN ('invalid', 'wrong_event', 'dynamic_qr_required', 'manual_entry_refused', 'forbidden') THEN
                SELECT tk.*, c.name AS category_name, c.scan_color, c.entry_instruction, u.first_name, u.last_name,
                       pay.id AS pay_id, pay.is_platform_payment AS pay_platform
                  INTO t
                  FROM public.tickets tk
                  JOIN public.ticket_categories c ON c.id = tk.category_id
                  LEFT JOIN public.users u ON u.id = tk.user_id
                  LEFT JOIN public.payments pay ON pay.id = tk.payment_id
                 WHERE tk.id = s.ticket_id;
                IF FOUND THEN
                    v_info := jsonb_build_object('id', t.id, 'ticket_number', t.ticket_number, 'category', t.category_name,
                                                 'holder', CASE WHEN t.user_id IS NULL AND t.sale_channel = 'INVITATION' THEN COALESCE(t.guest_name, 'Invité')
                                                                WHEN t.user_id IS NULL THEN 'Vente au guichet'
                                                                ELSE btrim(COALESCE(t.first_name, '') || ' ' || COALESCE(t.last_name, '')) END,
                                                 'price', t.price, 'is_manual_entry', s.method = 'MANUAL',
                                                 'checked_in_at', t.checked_in_at,
                                                 'checked_in_by_me', t.checked_in_by IS NOT DISTINCT FROM v_scanner,
                                                 'category_color', t.scan_color,
                                                 'origin', public.ticket_origin(t.sale_channel, t.price, t.pay_id IS NOT NULL AND NOT t.pay_platform),
                                                 'is_guest_list', s.method = 'GUEST_LIST');
                    -- Lot 9 ter (9t.16) : porte du compostage sur « déjà utilisé » et « accès autorisé » ; consigne sur
                    -- l'entrée validée seulement
                    IF COALESCE(s.result, s.zone_result) IN ('already_used', 'zone_ok') THEN
                        SELECT COALESCE(eg.name, NULLIF(btrim(a.entry_point), '')) INTO v_checked_gate
                          FROM public.ticket_scans a LEFT JOIN public.event_gates eg ON eg.id = a.gate_id
                         WHERE a.ticket_id = t.id AND a.accepted;
                        v_info := v_info || jsonb_build_object('checked_in_gate', v_checked_gate);
                    END IF;
                    IF s.result = 'valid' THEN
                        v_info := v_info || jsonb_build_object('entry_instruction', t.entry_instruction);
                    END IF;
                    -- Zone et porte de la ligne d'origine (zone NULL : zone implicite)
                    IF s.zone_id IS NULL THEN
                        v_zone := jsonb_build_object('id', NULL, 'name', 'Entrée', 'kind', 'ENTREE', 'implicit', TRUE);
                        v_kind := NULL;
                    ELSE
                        SELECT jsonb_build_object('id', z.id, 'name', z.name, 'kind', z.kind, 'implicit', FALSE), z.kind
                          INTO v_zone, v_kind
                          FROM public.event_zones z WHERE z.id = s.zone_id;
                    END IF;
                    SELECT jsonb_build_object('id', eg.id, 'name', eg.name) INTO v_gate
                      FROM public.event_gates eg WHERE eg.id = s.gate_id;
                    v_reply := v_reply || jsonb_build_object('ticket', v_info, 'zone', v_zone, 'gate', COALESCE(v_gate, 'null'::jsonb));
                    IF s.zone_result IN ('wrong_zone', 'not_entered') THEN
                        SELECT vz.redirect_zones INTO v_redirect
                          FROM public.scan_zone_verdict(s.event_id, s.zone_id, v_kind, t.category_id,
                                                        CASE WHEN s.zone_result = 'not_entered' OR v_kind = 'ENTREE' THEN 'VALIDE'
                                                             ELSE t.status::text END) vz;
                        v_reply := v_reply || jsonb_build_object('redirect_zones', COALESCE(v_redirect, '[]'::jsonb));
                    END IF;
                END IF;
            END IF;
            RETURN v_reply;
        END IF;
    END IF;
    -- 1 ter. Lot 8 (L42) : renvoi sans ligne pour cette clé, rien n'a été traité et rien ne l'est ici. Le
    --        spectateur n'est plus devant le contrôleur : les étapes 2 à 9 ne sont jamais atteintes.
    IF v_replay_only THEN
        RETURN jsonb_build_object('result', 'not_processed', 'replayed', FALSE, 'code', 'REPLAY_NOT_FOUND');
    END IF;
    -- 1 ter bis. Lot 9 ter (9t.15) : porte du scan. Un problème de porte n'écrit aucune ligne ni aucun audit et ne
    --            lit rien du billet : la même clé reste utilisable une fois la porte corrigée (C-D3, C-D4).
    SELECT * INTO g FROM public.scan_gate_context(v_scanner, v_event, v_claimed, v_gate_given);
    IF g.problem IS NOT NULL THEN
        RETURN jsonb_build_object('http', 409, 'code', g.problem);
    END IF;
    v_zone := jsonb_build_object('id', g.zone_id, 'name', g.zone_name, 'kind', g.zone_kind, 'implicit', NOT g.configured);
    v_gate := CASE WHEN g.gate_id IS NULL THEN 'null'::jsonb ELSE jsonb_build_object('id', g.gate_id, 'name', g.gate_name) END;
    -- 2. Refus décidé avant la base (payload qui n'est pas un QR dynamique)
    IF v_pre IS NOT NULL THEN
        v_scan := public.scan_log_at(NULL, v_event, v_scanner, v_pre, NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', v_pre, 'scan_id', v_scan);
    END IF;
    -- 3. Saisie manuelle : périmètre réglé et pièce d'identité vérifiée. Lot 9 ter (9t.17) : même garde pour la
    --    validation par la liste des invités, qui désigne le billet par son identifiant.
    IF v_method IN ('MANUAL', 'GUEST_LIST') THEN
        v_scope := public.fin_setting_text('access.manual_entry_scope');
        IF NOT v_identity
           OR (v_scope = 'ASSIGNED_CONTROLLER' AND NOT EXISTS (
                   SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_scanner)) THEN
            v_scan := public.scan_log_at(NULL, v_event, v_scanner, 'manual_entry_refused', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', 'manual_entry_refused', 'scan_id', v_scan);
        END IF;
        IF v_method = 'MANUAL' THEN
            SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = upper(btrim(p->>'ticket_number'));
        ELSE
            v_ticket_id := public.try_uuid(p->>'ticket_id');
        END IF;
    ELSE
        v_ticket_id := NULLIF(p->>'ticket_id', '')::uuid;
    END IF;
    -- 4. Billet de l'événement (aucune donnée sinon), sous verrou. Lot 9 ter (9t.16) : couleur et consigne de la
    --    catégorie, paiement (origine du billet) lus sans verrou de plus.
    SELECT tk.*, c.name AS category_name, c.scan_color, c.entry_instruction, u.first_name, u.last_name,
           pay.id AS pay_id, pay.is_platform_payment AS pay_platform
      INTO t
      FROM public.tickets tk
      JOIN public.ticket_categories c ON c.id = tk.category_id
      LEFT JOIN public.users u ON u.id = tk.user_id
      LEFT JOIN public.payments pay ON pay.id = tk.payment_id
     WHERE tk.id = v_ticket_id
       FOR UPDATE OF tk;
    IF NOT FOUND THEN
        v_scan := public.scan_log_at(NULL, v_event, v_scanner, 'invalid', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', 'invalid', 'scan_id', v_scan);
    END IF;
    IF t.event_id <> v_event THEN
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'wrong_event', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', 'wrong_event', 'scan_id', v_scan);
    END IF;
    -- Lot 9 ter (9t.17) : la liste des invités ne valide qu'une invitation ; un autre billet désigné par son
    -- identifiant est une requête forgée : ligne invalid sans ticket_id, réponse sans billet
    IF v_method = 'GUEST_LIST' AND t.sale_channel IS DISTINCT FROM 'INVITATION' THEN
        v_scan := public.scan_log_at(NULL, v_event, v_scanner, 'invalid', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', 'invalid', 'scan_id', v_scan);
    END IF;
    v_info := jsonb_build_object('id', t.id, 'ticket_number', t.ticket_number, 'category', t.category_name,
                                 'holder', CASE WHEN t.user_id IS NULL AND t.sale_channel = 'INVITATION' THEN COALESCE(t.guest_name, 'Invité')
                                                WHEN t.user_id IS NULL THEN 'Vente au guichet'
                                                ELSE btrim(COALESCE(t.first_name, '') || ' ' || COALESCE(t.last_name, '')) END, 'price', t.price,
                                 'is_manual_entry', v_method = 'MANUAL',
                                 'category_color', t.scan_color,
                                 'origin', public.ticket_origin(t.sale_channel, t.price, t.pay_id IS NOT NULL AND NOT t.pay_platform),
                                 'is_guest_list', v_method = 'GUEST_LIST');
    -- 5. Code dynamique (calculé hors base avec la clé maître) et version du secret, lus sous le verrou du
    --    billet : une rotation (transfert, annulation, remboursement, régénération) validée avant le verrou
    --    rend le code présenté périmé. Statut d'annulation contrôlé avant la version (D3).
    IF v_method = 'QR' AND (NOT COALESCE((p->>'totp_ok')::boolean, FALSE) OR v_version IS DISTINCT FROM t.security_version) THEN
        v_problem := CASE
            WHEN (SELECT e.status::text FROM public.events e WHERE e.id = v_event) = 'ANNULE' THEN 'event_cancelled'
            WHEN t.status::text = 'ANNULE' THEN 'cancelled'
            WHEN t.status::text IN ('REMBOURSE', 'REMBOURSEMENT_EN_COURS') THEN 'refunded'
            ELSE 'qr_expired' END;
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, v_problem, NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
    END IF;
    -- 6. Événement : statut et fenêtre
    v_problem := public.scan_event_problem(v_event);
    IF v_problem IS NOT NULL THEN
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, v_problem, NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
    END IF;
    -- Finition 1 (complément 12) : « Toutes les portes » de la propriétaire sur un événement à zones (scan_gate_context rend
    -- configured faux) : la porte retenue est la première porte d'entrée qui admet la catégorie du billet ; l'entrée porte
    -- cette porte et sa zone comme tout autre scan (invariant (x8)). Aucune porte d'entrée ne l'admet : GATE_REQUIRED,
    -- rien d'écrit. Contrôleurs et admins : inchangé (scan_gate_context ne rend configured faux que sans zone).
    IF NOT g.configured AND EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = v_event) THEN
        SELECT eg.id AS gate_id, eg.name AS gate_name, z.id AS zone_id, z.name AS zone_name INTO v_ag
          FROM public.event_gates eg
          JOIN public.event_zones z ON z.id = eg.zone_id
          JOIN public.zone_categories zc ON zc.zone_id = z.id
         WHERE z.event_id = v_event AND z.kind = 'ENTREE' AND zc.category_id = t.category_id
         ORDER BY z.position, lower(btrim(z.name)), lower(btrim(eg.name)), eg.id
         LIMIT 1;
        IF v_ag.gate_id IS NULL THEN
            RETURN jsonb_build_object('http', 409, 'code', 'GATE_REQUIRED');
        END IF;
        g.configured := TRUE;
        g.gate_id := v_ag.gate_id;
        g.gate_name := v_ag.gate_name;
        g.zone_id := v_ag.zone_id;
        g.zone_name := v_ag.zone_name;
        g.zone_kind := 'ENTREE';
        v_zone := jsonb_build_object('id', g.zone_id, 'name', g.zone_name, 'kind', g.zone_kind, 'implicit', FALSE);
        v_gate := jsonb_build_object('id', g.gate_id, 'name', g.gate_name);
    END IF;
    -- 7 bis-zone. Lot 9 ter (9t.15) : porte de CONTRÔLE. Refus rouges du billet d'abord (lignes et réponses de l'étape 7),
    --             puis verdict de zone ; jamais de compostage (ni 7 bis, ni 8, ni 9 : C-D5).
    IF g.zone_kind = 'CONTROLE' THEN
        v_problem := CASE t.status::text
            WHEN 'VALIDE' THEN NULL
            WHEN 'UTILISE' THEN NULL
            WHEN 'ANNULE' THEN 'cancelled'
            WHEN 'REMBOURSE' THEN 'refunded'
            WHEN 'REMBOURSEMENT_EN_COURS' THEN 'refunded'
            ELSE 'invalid' END;
        IF v_problem IS NOT NULL THEN
            v_scan := public.scan_log_at(t.id, v_event, v_scanner, v_problem, NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan,
                                      'ticket', v_info || jsonb_build_object('checked_in_at', t.checked_in_at,
                                                                             'checked_in_by_me', t.checked_in_by IS NOT DISTINCT FROM v_scanner),
                                      'zone', v_zone, 'gate', v_gate);
        END IF;
        SELECT vz.zone_result, vz.redirect_zones INTO v_zone_result, v_redirect
          FROM public.scan_zone_verdict(v_event, g.zone_id, 'CONTROLE', t.category_id, t.status::text) vz;
        IF v_zone_result IS NULL THEN
            RAISE EXCEPTION 'ticket_scan : verdict de zone absent pour le billet % (statut %)', t.id, t.status;
        END IF;
        IF v_zone_result = 'zone_ok' THEN
            -- Lot 9 quater (E2 : AUD-14) : billet déjà passé à ce contrôle de zone. Sans confirmation du contrôleur
            -- (p.confirm_zone_repeat), réponse « zone_already_passed » (écran orange « Déjà passé à {zone} à {heure} »),
            -- aucune ligne écrite ; confirmé (même personne, sortie aux toilettes), le passage est compté (ligne zone_ok).
            SELECT max(a.created_at), count(*)::integer INTO v_zone_last, v_zone_passes
              FROM public.ticket_scans a
             WHERE a.ticket_id = t.id AND a.zone_id = g.zone_id AND a.zone_result = 'zone_ok';
            IF v_zone_passes > 0 AND COALESCE(p->>'confirm_zone_repeat', 'false') <> 'true' THEN
                RETURN jsonb_build_object('result', 'zone_already_passed', 'scan_id', NULL, 'ticket', v_info,
                                          'zone', v_zone, 'gate', v_gate,
                                          'zone_last_pass_at', v_zone_last, 'zone_passes', v_zone_passes);
            END IF;
            -- Lot 9 ter (9t.16) : heure et porte de l'entrée (ligne acceptée, lue sous le verrou du billet)
            SELECT COALESCE(eg.name, NULLIF(btrim(a.entry_point), '')) INTO v_checked_gate
              FROM public.ticket_scans a LEFT JOIN public.event_gates eg ON eg.id = a.gate_id
             WHERE a.ticket_id = t.id AND a.accepted;
            v_scan := public.scan_log_at(t.id, v_event, v_scanner, NULL, v_zone_result, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', v_zone_result, 'scan_id', v_scan,
                                      'ticket', v_info || jsonb_build_object('checked_in_at', t.checked_in_at,
                                                                             'checked_in_by_me', t.checked_in_by IS NOT DISTINCT FROM v_scanner,
                                                                             'checked_in_gate', v_checked_gate),
                                      'zone', v_zone, 'gate', v_gate);
        END IF;
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, NULL, v_zone_result, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', v_zone_result, 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate,
                                  'redirect_zones', COALESCE(v_redirect, '[]'::jsonb));
    END IF;
    -- 7. Billet
    v_problem := CASE t.status::text
        WHEN 'VALIDE' THEN NULL
        WHEN 'UTILISE' THEN 'already_used'
        WHEN 'ANNULE' THEN 'cancelled'
        WHEN 'REMBOURSE' THEN 'refunded'
        WHEN 'REMBOURSEMENT_EN_COURS' THEN 'refunded'
        ELSE 'invalid' END;
    IF v_problem IS NOT NULL THEN
        v_info := v_info || jsonb_build_object('checked_in_at', t.checked_in_at,
                                               'checked_in_by_me', t.checked_in_by IS NOT DISTINCT FROM v_scanner);
        IF v_problem = 'already_used' THEN
            -- Lot 9 ter (9t.16) : « Déjà utilisé à {heure}, {porte} » (ligne acceptée, lue sous le verrou du billet)
            SELECT COALESCE(eg.name, NULLIF(btrim(a.entry_point), '')) INTO v_checked_gate
              FROM public.ticket_scans a LEFT JOIN public.event_gates eg ON eg.id = a.gate_id
             WHERE a.ticket_id = t.id AND a.accepted;
            v_info := v_info || jsonb_build_object('checked_in_gate', v_checked_gate);
        END IF;
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, v_problem, NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
    END IF;
    -- 7 bis. Lot 9 bis (R19, R44) : billet engagé dans un transfert encore en attente → refusé, rien de composté.
    --        Un transfert échu est d'abord expiré ; un transfert tenu par une acceptation est sauté (SKIP LOCKED,
    --        X27) et compte comme en attente. Conditions imbriquées : aucun court-circuit garanti sur AND.
    --        Lot 9 ter (9t.17) : par la liste des invités, le transfert d'invitation du billet (PENDING, ou EXPIRED à la
    --        fin de l'événement alors que le contrôle reste ouvert) est pris sans attente ; un autre transfert en attente
    --        (d'un porteur), ou l'invitation tenue par une acceptation en cours (sautée), refuse transfer_pending.
    IF v_method = 'GUEST_LIST' THEN
        PERFORM public.ticket_transfers_expire_due(t.id, TRUE);
        SELECT x.id INTO v_invite
          FROM public.ticket_transfers x
         WHERE x.ticket_id = t.id AND x.from_user_id IS NULL AND x.status::text IN ('PENDING', 'EXPIRED')
         ORDER BY x.created_at DESC, x.id DESC
         LIMIT 1
           FOR UPDATE SKIP LOCKED;
        IF EXISTS (SELECT 1 FROM public.ticket_transfers x
                    WHERE x.ticket_id = t.id AND x.status = 'PENDING' AND x.id IS DISTINCT FROM v_invite) THEN
            v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'transfer_pending', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', 'transfer_pending', 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
        END IF;
    ELSIF t.transfer_locked THEN
        IF public.ticket_transfers_expire_due(t.id, TRUE) THEN
            v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'transfer_pending', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', 'transfer_pending', 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
        END IF;
    END IF;
    -- 8. Paiement
    IF t.price > 0 THEN
        IF t.payment_id IS NOT NULL THEN
            SELECT status::text INTO v_pay_status FROM public.payments WHERE id = t.payment_id;
        END IF;
        IF v_pay_status IS NULL OR v_pay_status NOT IN ('SUCCESS', 'PARTIAL') THEN
            IF t.order_id IS NOT NULL THEN
                SELECT payment_status::text INTO v_order_status FROM public.orders WHERE id = t.order_id;
            END IF;
            IF v_order_status IS DISTINCT FROM 'SUCCESS' THEN
                v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'payment_required', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
                RETURN jsonb_build_object('result', 'payment_required', 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
            END IF;
        END IF;
    END IF;
    -- 8 bis. Lot 9 ter (9t.15) : porte d'ENTRÉE explicite qui n'admet pas la catégorie → mauvaise zone (orange), après
    --        les refus rouges (déjà utilisé, annulé, transfert, paiement : C-D6) ; rien composté.
    IF g.zone_id IS NOT NULL AND g.zone_kind = 'ENTREE' THEN
        SELECT vz.zone_result, vz.redirect_zones INTO v_zone_result, v_redirect
          FROM public.scan_zone_verdict(v_event, g.zone_id, 'ENTREE', t.category_id, 'VALIDE') vz;
        IF v_zone_result = 'wrong_zone' THEN
            v_scan := public.scan_log_at(t.id, v_event, v_scanner, NULL, 'wrong_zone', FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', 'wrong_zone', 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate,
                                      'redirect_zones', COALESCE(v_redirect, '[]'::jsonb));
        END IF;
    END IF;
    -- 9. Compostage (une seule ligne modifiée, sous verrou). Lot 9 ter (9t.17) : une invitation validée par la liste
    --    est déverrouillée et son transfert clos ADMITTED (claimed_at = now(), heure de la ligne GUEST_LIST) dans la même
    --    transaction ; aucun avis (billet sans porteur).
    UPDATE public.tickets SET status = 'UTILISE', checked_in_at = now(), checked_in_by = v_scanner,
                              transfer_locked = CASE WHEN v_invite IS NOT NULL THEN FALSE ELSE transfer_locked END,
                              updated_at = now()
     WHERE id = t.id AND status = 'VALIDE';
    IF NOT FOUND THEN
        SELECT checked_in_at, checked_in_by INTO v_checked_at, v_checked_by FROM public.tickets WHERE id = t.id;
        SELECT COALESCE(eg.name, NULLIF(btrim(a.entry_point), '')) INTO v_checked_gate
          FROM public.ticket_scans a LEFT JOIN public.event_gates eg ON eg.id = a.gate_id
         WHERE a.ticket_id = t.id AND a.accepted;
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'already_used', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', 'already_used', 'scan_id', v_scan,
                                  'ticket', v_info || jsonb_build_object('checked_in_at', v_checked_at,
                                                                         'checked_in_by_me', v_checked_by IS NOT DISTINCT FROM v_scanner,
                                                                         'checked_in_gate', v_checked_gate),
                                  'zone', v_zone, 'gate', v_gate);
    END IF;
    IF v_invite IS NOT NULL THEN
        UPDATE public.ticket_transfers SET status = 'ADMITTED', claimed_at = now() WHERE id = v_invite;
    END IF;
    v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'valid', NULL, TRUE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
    RETURN jsonb_build_object('result', 'valid', 'scan_id', v_scan,
                              'ticket', v_info || jsonb_build_object('checked_in_at', now(), 'checked_in_by_me', TRUE,
                                                                     'entry_instruction', t.entry_instruction),
                              'zone', v_zone, 'gate', v_gate);
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
