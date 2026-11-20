-- ============================================================================
-- EVENT VILLAGE — FINITION 4, 3/5 : l'organisatrice prévenue de ses ventes
-- ============================================================================
-- Décision du client (19/11, point 2) :
--  - SMS « premier billet vendu » gardé (FIRST_TICKET_SOLD, inchangé) ;
--  - cloche (et push) des ventes groupée toutes les 15 minutes : NEW_ORDER par événement, la première vente depuis la
--    dernière cloche part tout de suite, les suivantes s'ajoutent à une seule cloche, due 15 minutes après la précédente ;
--  - SMS groupé au plus toutes les 30 minutes pendant les ventes (SALES_UPDATE_SMS : « 12 billets vendus depuis 14:00 pour
--    {titre} : 60 000 F CFA ») ; la vente qui déclenche le SMS « premier billet vendu » n'y est pas recomptée ;
--  - résumé du matin à 9:00 (PARTNER_DAILY_SUMMARY, sujet de préférence SALES_SUMMARY) : ventes, remboursements et entrées de
--    la veille (jour de Dakar), une fois par jour et par compte, mis en file par notification_daily_checks entre 9 h et 12 h ;
--  - « catégorie complète » et « événement complet » fusionnés quand les deux arrivent ensemble : un seul avis EVENT_SOLD_OUT
--    qui nomme la dernière catégorie ;
--  - avis groupé quand un client demande un remboursement (PARTNER_REFUND_REQUESTS, 15 minutes, sans nom ni numéro du client).
-- Et (point 4) : REFUND_REQUESTED dit qui a lancé le remboursement (by : CLIENT, ORGANIZER, ADMIN, CANCELLATION) ; SMS et
-- push quand ce n'est pas le client ; (point 5) : WITHDRAWAL_REJECTED et ADMIN_WITHDRAWAL_REJECTED distinguent le retrait
-- « constaté non versé » (cashouts.provider_status = 'NON_VERSE') du refus de l'opérateur (not_paid).
--
-- Fonctions nouvelles : notif_enqueue_grouped, notif_sale_recorded.
-- Recopies (dernière définition de main, seuls changements commentés « Finition 4 ») :
--   payment_confirm (20261111000005_lot9quater_argent.sql:156) : NEW_ORDER remplacé par notif_sale_recorded ;
--   notif_ticket_categories_sold_out (20261103000005_lot6_billetterie.sql:895) : fusion ;
--   notification_daily_checks (20261109000009_lot9bis_messages.sql:1243) : résumé du matin ;
--   notif_cashouts_notify (20261123000106_l11a_annulation.sql:497) : REFUND_REQUESTED, PARTNER_REFUND_REQUESTS, non versé.
-- Droits : fonctions nouvelles fermées (service_role seulement) ; recopies inchangées (CREATE OR REPLACE).
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Avis groupé par fenêtre (cloche des ventes, SMS des ventes, demandes de remboursement)
-- ----------------------------------------------------------------------------
-- p : type, user_id, event_id, scope (texte : la série groupée), window_minutes, data (données de la première ligne), add
-- (compteurs numériques ajoutés à la ligne en attente), not_before (facultatif), channels (facultatif), now (facultatif).
-- Une ligne en attente (PENDING) de la série reçoit les compteurs (canal par canal) : rien de nouveau n'est mis en file.
-- Sinon une nouvelle série part à max(maintenant, échéance de la précédente + fenêtre, not_before), avec since = maintenant.
-- Verrou consultatif par série : deux ventes simultanées ne créent jamais deux lignes en attente.
CREATE OR REPLACE FUNCTION public.notif_enqueue_grouped(p jsonb)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type    text := p->>'type';
    v_scope   text := NULLIF(btrim(COALESCE(p->>'scope', '')), '');
    v_window  integer := NULLIF(p->>'window_minutes', '')::integer;
    v_add     jsonb := COALESCE(p->'add', '{}'::jsonb);
    v_now     timestamptz := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    v_prefix  text;
    v_group   text;
    v_last    timestamptz;
    v_due     timestamptz;
BEGIN
    IF v_type IS NULL OR v_scope IS NULL OR v_window IS NULL OR v_window < 1 OR jsonb_typeof(v_add) <> 'object' THEN
        RAISE EXCEPTION USING ERRCODE = 'NT004', MESSAGE = 'Avis groupé : type, série, fenêtre ou compteurs absents.';
    END IF;
    v_prefix := v_type || ':' || v_scope || ':';
    PERFORM pg_advisory_xact_lock(hashtextextended('notif-group:' || v_prefix, 0));

    SELECT o.group_key INTO v_group
      FROM public.notification_outbox o
     WHERE o.type = v_type AND left(o.group_key, length(v_prefix)) = v_prefix AND o.status = 'PENDING'
     ORDER BY o.created_at DESC, o.id
     LIMIT 1;
    IF v_group IS NOT NULL THEN
        UPDATE public.notification_outbox o
           SET template_data = o.template_data || (
                   SELECT COALESCE(jsonb_object_agg(a.key,
                              to_jsonb(COALESCE(CASE WHEN o.template_data->>a.key ~ '^-?[0-9]+(\.[0-9]+)?$'
                                                     THEN (o.template_data->>a.key)::numeric END, 0) + a.value::numeric)), '{}'::jsonb)
                     FROM jsonb_each_text(v_add) AS a)
         WHERE o.group_key = v_group AND o.status = 'PENDING';
        RETURN 0;
    END IF;

    SELECT max(o.due_at) INTO v_last
      FROM public.notification_outbox o
     WHERE o.type = v_type AND left(o.group_key, length(v_prefix)) = v_prefix;
    v_due := GREATEST(v_now, COALESCE(v_last + make_interval(mins => v_window), v_now),
                      COALESCE(NULLIF(p->>'not_before', '')::timestamptz, v_now));
    RETURN public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
        'type', v_type,
        'key', v_prefix || gen_random_uuid()::text,
        'user_id', p->>'user_id',
        'event_id', p->>'event_id',
        'due_at', v_due,
        'now', p->>'now',
        'channels', p->'channels',
        'data', COALESCE(p->'data', '{}'::jsonb) || v_add || jsonb_build_object('since', v_now))));
END;
$$;
REVOKE ALL ON FUNCTION public.notif_enqueue_grouped(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notif_enqueue_grouped(jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. Vente en ligne confirmée : cloche groupée (15 min) et SMS groupé (30 min) à l'organisatrice
-- ----------------------------------------------------------------------------
-- p : owner_id, event_id, payment_id, ticket_count, total (valeur des billets hors frais de service).
CREATE OR REPLACE FUNCTION public.notif_sale_recorded(p jsonb)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner  uuid := NULLIF(p->>'owner_id', '')::uuid;
    v_event  uuid := NULLIF(p->>'event_id', '')::uuid;
    v_count  integer := COALESCE(NULLIF(p->>'ticket_count', '')::integer, 0);
    v_total  numeric := COALESCE(NULLIF(p->>'total', '')::numeric, 0);
    v_data   jsonb;
    v_first  timestamptz;
BEGIN
    IF v_owner IS NULL OR v_event IS NULL OR v_count < 1 THEN
        RETURN;
    END IF;
    v_data := COALESCE(public.notif_event_data(v_event), '{}'::jsonb) || jsonb_build_object('payment_id', p->>'payment_id');
    PERFORM public.notif_enqueue_grouped(jsonb_build_object(
        'type', 'NEW_ORDER', 'scope', v_event::text || ':' || v_owner::text, 'window_minutes', 15,
        'user_id', v_owner, 'event_id', v_event, 'data', v_data,
        'add', jsonb_build_object('ticket_count', v_count, 'total', v_total, 'order_count', 1)));
    -- SMS : la vente qui a déclenché « premier billet vendu » (même transaction : même now()) n'est pas recomptée ; le premier
    -- SMS groupé part au plus tôt 30 minutes après celui du premier billet.
    IF EXISTS (SELECT 1 FROM public.notification_outbox o
                WHERE o.group_key = 'FIRST_TICKET_SOLD:' || v_event::text AND o.created_at = now()) THEN
        RETURN;
    END IF;
    SELECT max(o.due_at) INTO v_first
      FROM public.notification_outbox o
     WHERE o.group_key = 'FIRST_TICKET_SOLD:' || v_event::text AND o.channel = 'SMS';
    PERFORM public.notif_enqueue_grouped(jsonb_strip_nulls(jsonb_build_object(
        'type', 'SALES_UPDATE_SMS', 'scope', v_event::text || ':' || v_owner::text, 'window_minutes', 30,
        'user_id', v_owner, 'event_id', v_event, 'data', v_data,
        'not_before', v_first + interval '30 minutes',
        'add', jsonb_build_object('ticket_count', v_count, 'total', v_total))));
END;
$$;
REVOKE ALL ON FUNCTION public.notif_sale_recorded(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notif_sale_recorded(jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- 3. Recopies
-- ----------------------------------------------------------------------------
-- Recopie : 20261111000005_lot9quater_argent.sql:156
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
        v_event := v_cat.event_id;
    END LOOP;

    UPDATE public.payments
       SET status = 'SUCCESS', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(),
           confirmed_source = p_source, ticket_id = v_ticket_ids[1]
     WHERE id = p_payment_id;

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


-- Recopie : 20261103000005_lot6_billetterie.sql:895
CREATE OR REPLACE FUNCTION public.notif_ticket_categories_sold_out()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner uuid;
    v_data jsonb;
    v_total bigint;
BEGIN
    SELECT pa.user_id INTO v_owner
      FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = NEW.event_id;
    IF v_owner IS NULL THEN
        RETURN NULL;
    END IF;
    v_data := COALESCE(public.notif_event_data(NEW.event_id), '{}'::jsonb);
    -- Finition 4 (point 2) : catégorie et événement complets ensemble → un seul avis « événement complet » qui nomme la
    -- dernière catégorie ; une catégorie complète encore en attente est remplacée à l'envoi (notification_outbox_claim).
    IF NOT EXISTS (SELECT 1 FROM public.ticket_categories c
                    WHERE c.event_id = NEW.event_id AND c.is_active AND c.sold_quantity < c.total_quantity) THEN
        SELECT COALESCE(sum(c.total_quantity), 0) INTO v_total
          FROM public.ticket_categories c WHERE c.event_id = NEW.event_id AND c.is_active;
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'EVENT_SOLD_OUT', 'key', 'EVENT_SOLD_OUT:' || NEW.event_id::text || ':' || v_total::text,
            'user_id', v_owner, 'event_id', NEW.event_id,
            'data', v_data || jsonb_build_object('category_id', NEW.id, 'category', NEW.name)));
    ELSE
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'CATEGORY_SOLD_OUT', 'key', 'CATEGORY_SOLD_OUT:' || NEW.id::text || ':' || NEW.total_quantity::text,
            'user_id', v_owner, 'event_id', NEW.event_id,
            'data', v_data || jsonb_build_object('category_id', NEW.id, 'category', NEW.name)));
    END IF;
    RETURN NULL;
END;
$$;


-- Recopie : 20261109000009_lot9bis_messages.sql:1243
CREATE OR REPLACE FUNCTION public.notification_daily_checks(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now       timestamptz;
    v_day       date;
    v_day_txt   text;
    v_start     timestamptz;
    v_count     integer;
    v_cap       integer;
    v_used      integer;
    v_threshold integer;
    v_prefix    text;
    v_first     uuid;
    v_n         integer;
    v_alerted   boolean := false;
    v_funds     integer := 0;
    v_essential integer;
    v_essential_threshold integer;
    v_essential_alerted boolean := false;
    f           record;
BEGIN
    v_now := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    IF v_now < now() - interval '1 minute' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_NOW',
            'message', 'Horloge refusée : une heure dans le passé n''est jamais acceptée.');
    END IF;
    v_day := (v_now AT TIME ZONE 'Africa/Dakar')::date;
    v_day_txt := to_char(v_day, 'YYYY-MM-DD');
    v_start := v_day::timestamp AT TIME ZONE 'Africa/Dakar';

    SELECT count(*)::integer INTO v_count
      FROM public.notification_outbox o
     WHERE o.channel = 'SMS' AND o.status IN ('SENT', 'UNCERTAIN')
       AND COALESCE(o.sent_at, o.finished_at) >= v_start
       AND COALESCE(o.sent_at, o.finished_at) < v_start + interval '1 day';

    v_cap := public.notif_setting_int('notif.sms_optional_daily_cap');
    v_used := public.notif_sms_optional_used(v_day);
    IF v_cap IS NOT NULL AND v_cap > 0 THEN
        v_threshold := ceil((v_cap * 8)::numeric / 10)::integer;
    END IF;

    IF v_threshold IS NOT NULL AND v_used >= v_threshold THEN
        PERFORM pg_advisory_xact_lock(hashtext('notif.sms_optional_80:' || v_day_txt));
        v_prefix := 'ADMIN_SMS_OPTIONAL_80:' || v_day_txt || ':';
        IF NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                        WHERE o.type = 'ADMIN_SMS_OPTIONAL_80'
                          AND left(o.idempotency_key, length(v_prefix)) = v_prefix) THEN
            v_n := public.notif_enqueue_admins(jsonb_build_object(
                'type', 'ADMIN_SMS_OPTIONAL_80', 'ref', v_day_txt,
                'data', jsonb_build_object('day', v_day_txt, 'used', v_used, 'cap', v_cap, 'threshold', v_threshold,
                                           'percent', (100 * v_used::bigint / v_cap)::integer),
                'now', v_now));
            IF v_n > 0 THEN
                SELECT o.id INTO v_first
                  FROM public.notification_outbox o
                 WHERE o.type = 'ADMIN_SMS_OPTIONAL_80' AND left(o.idempotency_key, length(v_prefix)) = v_prefix
                 ORDER BY o.created_at, o.id LIMIT 1;
                INSERT INTO public.admin_signals (kind, ref_id) VALUES ('SMS_OPTIONAL_80', v_first) ON CONFLICT DO NOTHING;
                v_alerted := true;
            END IF;
        END IF;
    END IF;

    -- Lot 9 bis (R31, B81) : SMS indispensables du jour (file et journaux synchrones ; réservés, envoyés ou incertains),
    -- alerte ADMIN_SMS_DAILY_THRESHOLD aux admins notifications.read et signal SMS_DAILY_THRESHOLD au seuil réglable
    -- notif.sms_essential_daily_alert, une seule fois par jour (verrou et préfixe de clé du jour).
    SELECT count(*)::integer INTO v_essential
      FROM public.notification_outbox o
     WHERE o.channel = 'SMS' AND o.family = 'ESSENTIAL' AND o.status IN ('SENDING', 'SENT', 'UNCERTAIN')
       AND COALESCE(o.claimed_at, o.sent_at, o.finished_at) >= v_start
       AND COALESCE(o.claimed_at, o.sent_at, o.finished_at) < v_start + interval '1 day';
    v_essential_threshold := public.notif_setting_int('notif.sms_essential_daily_alert');
    IF v_essential_threshold IS NOT NULL AND v_essential_threshold > 0 AND v_essential >= v_essential_threshold THEN
        PERFORM pg_advisory_xact_lock(hashtext('notif.sms_essential_daily_alert:' || v_day_txt));
        v_prefix := 'ADMIN_SMS_DAILY_THRESHOLD:' || v_day_txt || ':';
        IF NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                        WHERE o.type = 'ADMIN_SMS_DAILY_THRESHOLD'
                          AND left(o.idempotency_key, length(v_prefix)) = v_prefix) THEN
            v_n := public.notif_enqueue_admins(jsonb_build_object(
                'type', 'ADMIN_SMS_DAILY_THRESHOLD', 'ref', v_day_txt,
                'data', jsonb_build_object('day', v_day_txt, 'count', v_essential, 'threshold', v_essential_threshold),
                'now', v_now));
            IF v_n > 0 THEN
                SELECT o.id INTO v_first
                  FROM public.notification_outbox o
                 WHERE o.type = 'ADMIN_SMS_DAILY_THRESHOLD' AND left(o.idempotency_key, length(v_prefix)) = v_prefix
                 ORDER BY o.created_at, o.id LIMIT 1;
                INSERT INTO public.admin_signals (kind, ref_id) VALUES ('SMS_DAILY_THRESHOLD', v_first) ON CONFLICT DO NOTHING;
                v_essential_alerted := true;
            END IF;
        END IF;
    END IF;

    -- Lot 9 bis (R72, B77) : recettes disponibles d'un événement terminé, une fois par événement
    FOR f IN
        SELECT e.id, pa.user_id AS owner_id
          FROM public.events e
          JOIN public.partners pa ON pa.id = e.partner_id
         WHERE e.status::text = 'TERMINE' AND pa.user_id IS NOT NULL
           AND public.event_end_at(e.id) > v_now - interval '30 days'
           AND EXISTS (SELECT 1 FROM public.finance_ledger l
                        WHERE l.event_id = e.id AND l.owner_id = pa.user_id AND l.account_kind = 'ORGANISATEUR'
                          AND l.entry_type = 'VENTE')
           AND NOT EXISTS (SELECT 1 FROM public.finance_ledger l
                            WHERE l.event_id = e.id AND l.owner_id = pa.user_id AND l.account_kind = 'ORGANISATEUR'
                              AND l.entry_type = 'VENTE' AND l.available_at > v_now)
           AND NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                            WHERE o.idempotency_key = 'FUNDS_AVAILABLE:' || e.id::text || ':IN_APP')
         ORDER BY e.id
         LIMIT 100
    LOOP
        v_funds := v_funds + public.notif_enqueue(jsonb_build_object(
            'type', 'FUNDS_AVAILABLE', 'key', 'FUNDS_AVAILABLE:' || f.id::text,
            'user_id', f.owner_id, 'event_id', f.id,
            'data', COALESCE(public.notif_event_data(f.id), '{}'::jsonb), 'now', v_now));
    END LOOP;

    -- Finition 4 (point 2) : résumé du matin à 9:00 (heure de Dakar), une fois par jour et par compte, ventes (en ligne et au
    -- guichet, billets payants), remboursements et entrées de la veille ; mis en file entre 9 h et 12 h (reprise après une
    -- panne de l'envoyeur), au plus 200 comptes par passage (le passage suivant continue : clé du jour).
    IF extract(hour FROM (v_now AT TIME ZONE 'Africa/Dakar')) >= 9 AND extract(hour FROM (v_now AT TIME ZONE 'Africa/Dakar')) < 12 THEN
        FOR f IN
            WITH yday AS (
                SELECT v_start - interval '1 day' AS a, v_start AS b, to_char(v_day - 1, 'YYYY-MM-DD') AS day_txt
            ), sold AS (
                SELECT pa.user_id AS owner_id, t.event_id, count(*)::integer AS n, COALESCE(sum(t.price), 0) AS amount
                  FROM public.tickets t JOIN public.events e ON e.id = t.event_id JOIN public.partners pa ON pa.id = e.partner_id, yday
                 WHERE t.created_at >= yday.a AND t.created_at < yday.b
                   AND t.sale_channel IN ('ONLINE', 'COUNTER') AND COALESCE(t.price, 0) > 0
                 GROUP BY pa.user_id, t.event_id
            ), refunded AS (
                SELECT pa.user_id AS owner_id, t.event_id, count(*)::integer AS n, COALESCE(sum(COALESCE(NULLIF(r.facial_part, 0), t.price)), 0) AS amount
                  FROM public.refunds r JOIN public.tickets t ON t.id = r.ticket_id
                  JOIN public.events e ON e.id = t.event_id JOIN public.partners pa ON pa.id = e.partner_id, yday
                 WHERE r.created_at >= yday.a AND r.created_at < yday.b AND COALESCE(t.price, 0) > 0
                 GROUP BY pa.user_id, t.event_id
            ), entered AS (
                SELECT pa.user_id AS owner_id, sc.event_id, count(*)::integer AS n, 0::numeric AS amount
                  FROM public.ticket_scans sc JOIN public.events e ON e.id = sc.event_id JOIN public.partners pa ON pa.id = e.partner_id, yday
                 WHERE sc.accepted AND sc.created_at >= yday.a AND sc.created_at < yday.b
                 GROUP BY pa.user_id, sc.event_id
            ), activity AS (
                SELECT owner_id, event_id, n AS sold_n, amount AS sold_amount, 0 AS refund_n, 0::numeric AS refund_amount, 0 AS entry_n FROM sold
                UNION ALL SELECT owner_id, event_id, 0, 0, n, amount, 0 FROM refunded
                UNION ALL SELECT owner_id, event_id, 0, 0, 0, 0, n FROM entered
            )
            SELECT a.owner_id, (SELECT day_txt FROM yday) AS day_txt,
                   sum(a.sold_n)::integer AS sold_count, sum(a.sold_amount) AS sold_amount,
                   sum(a.refund_n)::integer AS refund_count, sum(a.refund_amount) AS refund_amount,
                   sum(a.entry_n)::integer AS entry_count, count(DISTINCT a.event_id)::integer AS event_count,
                   (array_agg(DISTINCT a.event_id))[1] AS one_event
              FROM activity a
             WHERE a.owner_id IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                                WHERE o.group_key = 'PARTNER_DAILY_SUMMARY:' || a.owner_id::text || ':' || (SELECT day_txt FROM yday))
             GROUP BY a.owner_id
             ORDER BY a.owner_id
             LIMIT 200
        LOOP
            v_n := public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                'type', 'PARTNER_DAILY_SUMMARY', 'key', 'PARTNER_DAILY_SUMMARY:' || f.owner_id::text || ':' || f.day_txt,
                'user_id', f.owner_id,
                'event_id', CASE WHEN f.event_count = 1 THEN f.one_event END,
                'data', (CASE WHEN f.event_count = 1 THEN COALESCE(public.notif_event_data(f.one_event), '{}'::jsonb) ELSE '{}'::jsonb END)
                        || jsonb_build_object('day', f.day_txt, 'sold_count', f.sold_count, 'sold_amount', f.sold_amount,
                                              'refund_count', f.refund_count, 'refund_amount', f.refund_amount,
                                              'entry_count', f.entry_count, 'event_count', f.event_count),
                'now', v_now)));
        END LOOP;
    END IF;

    RETURN jsonb_build_object('ok', true, 'day', v_day_txt, 'sms_today', v_count,
        'optional_today', v_used, 'optional_cap', v_cap, 'optional_threshold', v_threshold, 'alerted', v_alerted,
        'essential_today', v_essential, 'essential_threshold', v_essential_threshold, 'essential_alerted', v_essential_alerted,
        'funds_available', v_funds);
END;
$$;


-- Recopie : 20261123000106_l11a_annulation.sql:497
CREATE OR REPLACE FUNCTION public.notif_cashouts_notify()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_refund        boolean := NEW.kind IN ('REFUND', 'EVENT_CANCELLATION_REFUND', 'TICKET_REFUND');
    v_status_new    boolean := TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status;
    v_blocked_new   boolean := NEW.status = 'A_ENVOYER' AND NEW.blocked_reason IS NOT NULL
                               AND (TG_OP = 'INSERT' OR OLD.blocked_reason IS NULL);
    -- Lot 9 bis (B1, B11) : retard de plus de 30 minutes posé par cashouts_flag_delayed
    v_delay_new     boolean := TG_OP = 'UPDATE' AND NEW.delay_flagged_at IS NOT NULL AND OLD.delay_flagged_at IS NULL;
    v_event         uuid;
    v_event_data    jsonb := '{}'::jsonb;
    v_partner_user  uuid;
    v_user          uuid;
    v_phone         text;
    v_account_kind  text;
    v_money         jsonb;
    v_day           text := to_char(timezone('Africa/Dakar', now()), 'YYYY-MM-DD');
    -- Lot 9 quater (C1) : frais de l'opérateur retenus sur le remboursement d'un doublon répété
    v_withheld      numeric;
    -- Lot 9 bis (B11) : un seul avis de retard par versement, mis en file en fin de fonction
    v_refund_delayed     boolean := false;
    v_withdrawal_delayed boolean := false;
    -- Lot 9 bis (R30, H1) : paiement remboursé, lu à la création d'un REFUND
    v_pay_amount    numeric;
    v_pay_operator  text;
    v_duplicate_of  text;
    -- Finition 4 : auteur d'un remboursement de billet ; retrait constaté non versé
    v_refund_as     text;
    v_refund_ctx    text;
    v_refund_by     text;
    v_refund_facial numeric;
    v_not_paid      boolean := NEW.provider_status IS NOT DISTINCT FROM 'NON_VERSE';
BEGIN
    IF NOT (v_status_new OR v_blocked_new OR v_delay_new) THEN
        RETURN NEW;
    END IF;

    -- Bénéficiaire : le compte s'il existe encore ; numéro du compte résolu à l'envoi, sinon le numéro
    -- du versement (9 chiffres) pour le SMS.
    IF NEW.beneficiary_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.beneficiary_user_id) THEN
        v_user := NEW.beneficiary_user_id;
    END IF;
    IF (v_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user AND NULLIF(btrim(COALESCE(u.phone, '')), '') IS NOT NULL))
       AND NEW.phone_number ~ '^[0-9]{9}$' THEN
        v_phone := '+221' || NEW.phone_number;
    END IF;

    -- Événement d'un remboursement : celui du paiement, sinon celui du billet.
    IF v_refund THEN
        SELECT p.event_id INTO v_event FROM public.payments p WHERE p.id = NEW.payment_id;
        IF v_event IS NULL AND NEW.ticket_id IS NOT NULL THEN
            SELECT t.event_id INTO v_event FROM public.tickets t WHERE t.id = NEW.ticket_id;
        END IF;
        IF v_event IS NOT NULL THEN
            v_event_data := public.notif_pros_event_data(v_event);
            SELECT pa.user_id INTO v_partner_user
              FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
             WHERE e.id = v_event;
        END IF;
    ELSE
        SELECT w.account_kind INTO v_account_kind FROM public.withdrawals w WHERE w.id = NEW.withdrawal_id;
    END IF;

    v_money := jsonb_strip_nulls(jsonb_build_object(
        'cashout_id', NEW.id, 'amount', NEW.amount, 'operator', NEW.operator, 'account_kind', v_account_kind));

    -- 1. Demande de remboursement d'un billet (création du cashout)
    -- Finition 4 (points 2 et 4) : qui a lancé le remboursement (journal TICKET_REFUND_REQUESTED de ticket_refund_request,
    -- même transaction) : le client (report de plus de 24 h), l'organisatrice, l'administration, ou l'annulation de
    -- l'événement. Lancé par quelqu'un d'autre que le client : SMS et push en plus (le client n'a rien demandé) ; lancé par
    -- le client : l'organisatrice reçoit un avis groupé toutes les 15 minutes, sans nom ni numéro du client.
    IF TG_OP = 'INSERT' AND NEW.kind = 'TICKET_REFUND' THEN
        SELECT a.metadata->>'as', a.metadata->>'context' INTO v_refund_as, v_refund_ctx
          FROM public.audit_logs a
         WHERE a.action = 'TICKET_REFUND_REQUESTED' AND a.object_type = 'tickets' AND a.object_id = NEW.ticket_id
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT 1;
        v_refund_by := CASE WHEN v_refund_ctx = 'CANCELLATION' THEN 'CANCELLATION'
                            WHEN v_refund_as = 'ADMIN' THEN 'ADMIN'
                            WHEN v_refund_as = 'OWNER' THEN 'ORGANIZER'
                            ELSE 'CLIENT' END;
        IF v_user IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'REFUND_REQUESTED',
                'key', 'REFUND_REQUESTED:' || NEW.id::text,
                'user_id', v_user,
                'event_id', v_event,
                'data', v_event_data || jsonb_strip_nulls(jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount,
                                                                             'operator', NEW.operator, 'by', v_refund_by)),
                'channels', CASE v_refund_by
                                WHEN 'CANCELLATION' THEN jsonb_build_array('IN_APP', 'EMAIL')
                                WHEN 'CLIENT' THEN jsonb_build_array('IN_APP', 'EMAIL', 'PUSH')
                                ELSE jsonb_build_array('IN_APP', 'SMS', 'EMAIL', 'PUSH') END
            ));
        END IF;
        IF v_refund_by = 'CLIENT' AND v_partner_user IS NOT NULL AND v_event IS NOT NULL THEN
            SELECT COALESCE(NULLIF(r.facial_part, 0), NEW.amount) INTO v_refund_facial FROM public.refunds r WHERE r.id = NEW.refund_id;
            PERFORM public.notif_enqueue_grouped(jsonb_build_object(
                'type', 'PARTNER_REFUND_REQUESTS', 'scope', v_event::text || ':' || v_partner_user::text, 'window_minutes', 15,
                'user_id', v_partner_user, 'event_id', v_event, 'data', v_event_data,
                'add', jsonb_build_object('ticket_count', 1, 'amount', COALESCE(v_refund_facial, NEW.amount))));
        END IF;
    END IF;

    -- 1 bis. Lot 9 bis (R30, H1, B11) : paiement encaissé sans billet possible, ou en double du même panier
    --        (payments.metadata.duplicate_of), remboursé : le client est prévenu à la création, avant tout versement.
    -- Lot 10a : le remboursement d'une réservation de salle est annoncé par l'avis de la salle (annulation, délai
    -- dépassé, paiement arrivé trop tard), pas par le texte des billets
    -- Lot 11a : de même pour le remboursement d'une réservation de table
    IF TG_OP = 'INSERT' AND NEW.kind = 'REFUND' AND (v_user IS NOT NULL OR v_phone IS NOT NULL)
       AND NOT EXISTS (SELECT 1 FROM public.payments hp WHERE hp.id = NEW.payment_id
                          AND hp.payment_target::text IN ('HALL_RESERVATION', 'TABLE_RESERVATION')) THEN
        SELECT p.amount, p.operator::text, NULLIF(p.metadata->>'duplicate_of', ''),
               NULLIF(p.metadata->>'duplicate_fee_withheld', '')::numeric
          INTO v_pay_amount, v_pay_operator, v_duplicate_of, v_withheld
          FROM public.payments p WHERE p.id = NEW.payment_id;
        PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
            'type', 'PAYMENT_REFUND_STARTED',
            'key', 'PAYMENT_REFUND_STARTED:' || NEW.id::text,
            'user_id', v_user,
            'phone', v_phone,
            'event_id', v_event,
            'data', v_event_data || jsonb_strip_nulls(jsonb_build_object(
                'cashout_id', NEW.id, 'payment_id', NEW.payment_id, 'amount', COALESCE(v_pay_amount, NEW.amount),
                'operator', COALESCE(NEW.operator::text, v_pay_operator), 'duplicate_of', v_duplicate_of,
                'withheld', CASE WHEN COALESCE(v_withheld, 0) > 0 THEN v_withheld END,
                'refund_amount', CASE WHEN COALESCE(v_withheld, 0) > 0 THEN NEW.amount END))
        )));
    END IF;

    -- 2. Remboursement bloqué (motif posé alors qu'il attend l'envoi)
    IF v_refund AND v_blocked_new THEN
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_REFUND_TO_RETRY',
            'ref', NEW.id::text || ':' || NEW.attempt_count::text || ':BLOQUE',
            'event_id', v_event,
            'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'cashout_status', 'BLOQUE',
                                       'blocked_reason', NEW.blocked_reason, 'kind', NEW.kind)
        ));
        INSERT INTO public.admin_signals (kind, ref_id) VALUES ('REFUND_TO_RETRY', NEW.id) ON CONFLICT DO NOTHING;
        IF NEW.kind = 'EVENT_CANCELLATION_REFUND' AND v_partner_user IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'CANCEL_REFUNDS_BLOCKED',
                'key', 'CANCEL_REFUNDS_BLOCKED:' || v_event::text || ':' || v_day,
                'user_id', v_partner_user,
                'event_id', v_event,
                'data', v_event_data
            ));
        END IF;
        -- Lot 9 bis (B11) : le bénéficiaire est prévenu du retard, sauf pour une opération simulée (jamais versée)
        IF NEW.blocked_reason <> 'SIMULATED' THEN
            v_refund_delayed := true;
        END IF;
    END IF;

    -- 2 bis. Lot 9 bis (R10, B5) : retrait bloqué (solde, limites du compte, nom manquant)
    IF NOT v_refund AND v_blocked_new AND NEW.blocked_reason <> 'SIMULATED' THEN
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_CASHOUT_TO_RESUME',
            'ref', NEW.id::text || ':' || NEW.attempt_count::text || ':BLOQUE',
            'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'kind', NEW.kind,
                                       'cause', 'BLOCKED', 'blocked_reason', NEW.blocked_reason)
        ));
        INSERT INTO public.admin_signals (kind, ref_id) VALUES ('REFUND_TO_RETRY', NEW.id) ON CONFLICT DO NOTHING;
        v_withdrawal_delayed := true;
    END IF;

    -- 2 ter. Lot 9 bis (R1, B1) : versement en retard de plus de 30 minutes, tous types
    IF v_delay_new THEN
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_CASHOUT_TO_RESUME',
            'ref', NEW.id::text || ':' || NEW.attempt_count::text || ':RETARD',
            'event_id', v_event,
            'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'kind', NEW.kind, 'cause', 'DELAYED')
        ));
        IF v_refund THEN
            v_refund_delayed := true;
        ELSE
            v_withdrawal_delayed := true;
        END IF;
    END IF;

    -- 3. Statut final ou incertain (mise à jour seulement)
    IF v_status_new AND TG_OP = 'UPDATE' THEN
        IF NEW.status = 'CONFIRME' THEN
            IF v_refund THEN
                IF v_user IS NOT NULL OR v_phone IS NOT NULL THEN
                    PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                        'type', 'REFUND_PAID',
                        'key', 'REFUND_PAID:' || NEW.id::text,
                        'user_id', v_user,
                        'phone', v_phone,
                        'event_id', v_event,
                        'data', v_event_data || v_money
                    )));
                END IF;
                IF NEW.kind = 'EVENT_CANCELLATION_REFUND' AND v_event IS NOT NULL AND v_partner_user IS NOT NULL THEN
                    -- Verrou par événement : deux confirmations concurrentes se voient (lecture après le verrou).
                    PERFORM pg_advisory_xact_lock(hashtextextended('notif-cancel-refunds:' || v_event::text, 0));
                    IF NOT EXISTS (
                        SELECT 1 FROM public.cashouts c JOIN public.payments p ON p.id = c.payment_id
                         WHERE p.event_id = v_event AND c.kind = 'EVENT_CANCELLATION_REFUND'
                           AND c.id <> NEW.id AND c.status <> 'CONFIRME'
                    ) THEN
                        PERFORM public.notif_enqueue(jsonb_build_object(
                            'type', 'CANCEL_REFUNDS_DONE',
                            'key', 'CANCEL_REFUNDS_DONE:' || v_event::text,
                            'user_id', v_partner_user,
                            'event_id', v_event,
                            'data', v_event_data
                        ));
                    END IF;
                END IF;
            ELSIF v_user IS NOT NULL OR v_phone IS NOT NULL THEN
                PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                    'type', 'WITHDRAWAL_PAID',
                    'key', 'WITHDRAWAL_PAID:' || NEW.id::text,
                    'user_id', v_user,
                    'phone', v_phone,
                    'data', v_money
                )));
            END IF;

        ELSIF NEW.status = 'ECHOUE' THEN
            IF v_refund THEN
                PERFORM public.notif_enqueue_admins(jsonb_build_object(
                    'type', 'ADMIN_REFUND_TO_RETRY',
                    'ref', NEW.id::text || ':' || NEW.attempt_count::text || ':ECHOUE',
                    'event_id', v_event,
                    'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'cashout_status', 'ECHOUE', 'kind', NEW.kind)
                ));
                INSERT INTO public.admin_signals (kind, ref_id) VALUES ('REFUND_TO_RETRY', NEW.id) ON CONFLICT DO NOTHING;
                IF NEW.kind = 'EVENT_CANCELLATION_REFUND' AND v_partner_user IS NOT NULL THEN
                    PERFORM public.notif_enqueue(jsonb_build_object(
                        'type', 'CANCEL_REFUNDS_BLOCKED',
                        'key', 'CANCEL_REFUNDS_BLOCKED:' || v_event::text || ':' || v_day,
                        'user_id', v_partner_user,
                        'event_id', v_event,
                        'data', v_event_data
                    ));
                END IF;
                v_refund_delayed := true;
            ELSE
                -- Finition 4 (point 5) : « constaté non versé » (provider_status NON_VERSE) n'est pas un refus de l'opérateur
                IF v_user IS NOT NULL OR v_phone IS NOT NULL THEN
                    PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                        'type', 'WITHDRAWAL_REJECTED',
                        'key', 'WITHDRAWAL_REJECTED:' || NEW.id::text,
                        'user_id', v_user,
                        'phone', v_phone,
                        'data', v_money || jsonb_build_object('not_paid', v_not_paid)
                    )));
                END IF;
                PERFORM public.notif_enqueue_admins(jsonb_build_object(
                    'type', 'ADMIN_WITHDRAWAL_REJECTED',
                    'ref', NEW.id::text,
                    'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'not_paid', v_not_paid)
                ));
            END IF;

        ELSIF NEW.status = 'INCERTAIN' THEN
            IF NOT v_refund AND (v_user IS NOT NULL OR v_phone IS NOT NULL) THEN
                PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                    'type', 'WITHDRAWAL_UNCERTAIN',
                    'key', 'WITHDRAWAL_UNCERTAIN:' || NEW.id::text || ':' || NEW.attempt_count::text,
                    'user_id', v_user,
                    'phone', v_phone,
                    'data', v_money
                )));
            END IF;
            PERFORM public.notif_enqueue_admins(jsonb_build_object(
                'type', 'ADMIN_CASHOUT_UNCERTAIN',
                'ref', NEW.id::text || ':' || NEW.attempt_count::text,
                'event_id', v_event,
                'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'kind', NEW.kind)
            ));
            INSERT INTO public.admin_signals (kind, ref_id) VALUES ('CASHOUT_UNCERTAIN', NEW.id) ON CONFLICT DO NOTHING;
            IF v_refund THEN
                v_refund_delayed := true;
            END IF;
        END IF;
    END IF;

    -- 4. Lot 9 bis (B11, N1, N2) : avis de retard au bénéficiaire, un seul par versement (clé par versement)
    IF v_refund_delayed AND (v_user IS NOT NULL OR v_phone IS NOT NULL) THEN
        PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
            'type', 'REFUND_DELAYED',
            'key', 'REFUND_DELAYED:' || NEW.id::text,
            'user_id', v_user,
            'phone', v_phone,
            'event_id', v_event,
            'data', v_event_data || v_money
        )));
    END IF;
    IF v_withdrawal_delayed AND (v_user IS NOT NULL OR v_phone IS NOT NULL) THEN
        PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
            'type', 'WITHDRAWAL_DELAYED',
            'key', 'WITHDRAWAL_DELAYED:' || NEW.id::text,
            'user_id', v_user,
            'phone', v_phone,
            'data', v_money
        )));
    END IF;

    RETURN NEW;
END;
$$;


