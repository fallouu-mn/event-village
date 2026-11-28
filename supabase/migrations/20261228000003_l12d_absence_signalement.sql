-- ============================================================================
-- EVENT VILLAGE — LOT 12d, migration 03 : client absent, décision de l'équipe, signalements, tâche de surveillance
-- ============================================================================
-- Décisions du client (26-27/11) :
--  - client absent : le livreur (ou la partenaire qui livre elle-même) touche « Client absent » après deux appels ; la
--    commande attend 30 minutes un nouvel essai (la remise contre le code reste possible), puis passe à la décision de
--    l'équipe Event Village (rembourser tout, une part, ou rien, avec motif) ; rien d'automatique sur l'argent ;
--  - « Signaler un problème » : le client, après le début de la préparation ; l'équipe et l'établissement sont prévenus ;
--    aucun remboursement automatique.
--  1. aides private.order_admin_allowed(compte, droits) et private.order_admin_role(compte) : compte ACTIF, super-
--     administrateur ou administrateur avec l'un des droits (admin_can du lot 9 bis : user_roles et admin_permissions,
--     jamais users.role) ;
--  2. order_delivery_step(p) : APPEL (appel du client compté, un appel compte s'il suit le précédent d'au moins
--     30 secondes) et ABSENT (deux appels au moins, une fois par commande) ; livreur de la commande (membre ACTIF) ou
--     partenaire propriétaire ; commande à livrer, en route ; avis au client (4 canaux) et à l'établissement ;
--  3. order_watch_tick() (tâche /api/cron/orders, après order_tick et order_reminders ; idempotente) : attente de
--     30 minutes échue → décision de l'équipe (administrateurs refunds.manage prévenus, livreur prié de rapporter la
--     commande) ; pause des commandes finie → l'établissement prévenu (cloche, notification du téléphone) ;
--  4. order_absence_decide(p) : décision de l'équipe (droit refunds.manage ou super-administrateur), aperçu du montant
--     rendu (preview) puis décision confirmée avec le montant écrit (expected_amount : refus AMOUNT_CHANGED s'il a
--     changé) ; une seule fois sous concurrence (verrou de l'établissement, absence déjà décidée refusée) ; commande close
--     « non retirée » (produits préparés : rien rendu au stock) par order_close_apply avec l'avis ABSENT ;
--  5. order_close_apply : recopie de 20261130000006_l12a_etapes.sql:121-206 (dernière définition ; aucune autre
--     migration ne la redéfinit) ; changement (lignes ajoutées seulement) : avis propres d'une décision sur une absence
--     (p_notice = 'ABSENT') : client ORDER_ABSENCE_DECIDED, partenaire ORDER_ABSENCE_DECIDED_PRO ;
--  6. order_issue_report(p) (client) et order_issue_close(p) (équipe, refunds.manage) : un seul signalement ouvert par
--     commande (index unique partiel), 3 au plus par commande ; administrateurs prévenus une fois par heure au plus
--     (avis regroupé), établissement prévenu à chaque signalement ; client prévenu quand l'équipe a traité.
-- Fonctions publiques au seul rôle de service ; aides private à aucun rôle. Rejouable : CREATE OR REPLACE, REVOKE et
-- GRANT idempotents. Aucun BEGIN ni COMMIT.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Droits de l'administration
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.order_admin_allowed(p_actor uuid, p_perms text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    -- Règle 1B.8 (lot 9 bis) : user_roles et admin_permissions par admin_can, jamais users.role
    SELECT p_actor IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_actor AND u.status::text = 'ACTIF')
       AND EXISTS (SELECT 1 FROM unnest(p_perms) x WHERE public.admin_can(p_actor, x));
$$;

CREATE OR REPLACE FUNCTION private.order_admin_role(p_actor uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p_actor AND ur.role::text = 'SUPERADMIN')
                THEN 'SUPERADMIN' ELSE 'ADMIN' END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Appel du client et client absent
-- ----------------------------------------------------------------------------
-- p : order_id, actor_id, as (COURIER | PARTNER), action (APPEL | ABSENT). Rend { ok, calls, counted } ou { ok, wait_until }.
CREATE OR REPLACE FUNCTION public.order_delivery_step(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id uuid := public.try_uuid(p->>'order_id');
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_as       text := upper(COALESCE(p->>'as', ''));
    v_action   text := upper(COALESCE(p->>'action', ''));
    v_wait     interval := interval '30 minutes';
    o          record;
    v_role     text;
    v_until    timestamptz;
BEGIN
    IF v_action NOT IN ('APPEL', 'ABSENT') OR v_as NOT IN ('COURIER', 'PARTNER') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ACTION', 'message', 'Action inconnue.');
    END IF;
    IF v_order_id IS NULL OR public.order_lock(v_order_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    SELECT od.*, pa.user_id AS owner_id, pa.status::text AS partner_status INTO o
      FROM public.orders od JOIN public.partners pa ON pa.id = od.partner_id
     WHERE od.id = v_order_id FOR UPDATE OF od;
    IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    -- Le livreur de cette commande, membre ACTIF de l'équipe ; ou la partenaire propriétaire (elle livre elle-même)
    IF v_as = 'COURIER' AND (o.courier_user_id IS DISTINCT FROM v_actor
        OR NOT EXISTS (SELECT 1 FROM public.partner_couriers c WHERE c.partner_id = o.partner_id AND c.user_id = v_actor AND c.status = 'ACTIVE')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    IF v_as = 'PARTNER' AND (o.owner_id IS DISTINCT FROM v_actor OR o.received_at IS NULL) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    IF o.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'L’établissement est suspendu : ses commandes sont en lecture seule.');
    END IF;
    IF o.delivery_mode::text <> 'LIVRAISON' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_DELIVERY', 'message', 'Cette commande n’est pas à livrer.');
    END IF;
    IF o.order_state <> 'EN_ROUTE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_EN_ROUTE', 'message', 'Le client s’appelle pendant la livraison, une fois parti.');
    END IF;
    v_role := CASE v_as WHEN 'COURIER' THEN 'LIVREUR' ELSE 'PARTENAIRE' END;

    IF v_action = 'APPEL' THEN
        -- Deux touches rapprochées ne font pas deux appels : un appel compte 30 secondes au moins après le précédent
        IF o.last_call_at IS NOT NULL AND o.last_call_at > now() - interval '30 seconds' OR o.delivery_calls >= 50 THEN
            RETURN jsonb_build_object('ok', true, 'order_id', o.id, 'calls', o.delivery_calls, 'counted', false);
        END IF;
        PERFORM set_config('event_village.order_flow', 'on', true);
        UPDATE public.orders SET delivery_calls = delivery_calls + 1, last_call_at = now(), updated_at = now() WHERE id = o.id;
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
        VALUES (v_actor, v_role, 'ORDER_CLIENT_CALLED', 'orders', o.id, jsonb_build_object('calls', o.delivery_calls + 1));
        RETURN jsonb_build_object('ok', true, 'order_id', o.id, 'calls', o.delivery_calls + 1, 'counted', true);
    END IF;

    -- ABSENT
    IF o.absent_reported_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_ABSENT', 'message', 'Le client est déjà signalé absent.');
    END IF;
    IF o.delivery_calls < 2 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CALLS_REQUIRED', 'calls', o.delivery_calls,
            'message', 'Appelez le client deux fois avant de le signaler absent.');
    END IF;
    v_until := now() + v_wait;
    PERFORM set_config('event_village.order_flow', 'on', true);
    UPDATE public.orders SET absent_reported_at = now(), absent_wait_until = v_until, updated_at = now() WHERE id = o.id;
    PERFORM private.order_log_state(o.id, 'EN_ROUTE', 'EN_ROUTE', v_actor, v_role,
        format('Client absent après %s appels : attente jusqu’à %s', o.delivery_calls, to_char(v_until AT TIME ZONE 'Africa/Dakar', 'HH24:MI')));
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value)
    VALUES (v_actor, v_role, 'ORDER_CLIENT_ABSENT', 'orders', o.id, jsonb_build_object('calls', o.delivery_calls, 'wait_until', v_until));
    PERFORM public.order_notify('ORDER_CLIENT_ABSENT', o.id, 'CLIENT', jsonb_build_object('wait_until', v_until));
    IF v_as = 'COURIER' THEN
        PERFORM public.order_notify('ORDER_CLIENT_ABSENT_PRO', o.id, 'OWNER', jsonb_build_object('wait_until', v_until));
    END IF;
    RETURN jsonb_build_object('ok', true, 'order_id', o.id, 'wait_until', v_until);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Tâche de surveillance (absences échues, fins de pause)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_watch_tick()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r          record;
    rr         record;
    v_absences integer := 0;
    v_pauses   integer := 0;
BEGIN
    FOR r IN SELECT id, venue_id FROM public.orders
              WHERE absent_reported_at IS NOT NULL AND absent_escalated_at IS NULL AND absent_decided_at IS NULL
                AND absent_wait_until <= now() AND order_state = 'EN_ROUTE'
              ORDER BY absent_wait_until LOOP
        PERFORM public.order_venue_lock(r.venue_id);
        SELECT * INTO rr FROM public.orders WHERE id = r.id FOR UPDATE;
        IF rr.order_state <> 'EN_ROUTE' OR rr.absent_escalated_at IS NOT NULL OR rr.absent_decided_at IS NOT NULL
           OR rr.absent_wait_until > now() THEN
            CONTINUE;
        END IF;
        PERFORM set_config('event_village.order_flow', 'on', true);
        UPDATE public.orders SET absent_escalated_at = now(), updated_at = now() WHERE id = rr.id;
        PERFORM private.order_log_state(rr.id, 'EN_ROUTE', 'EN_ROUTE', NULL, 'SYSTEM', 'Client toujours absent après 30 minutes : décision de l’équipe Event Village');
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_ORDER_ABSENT', 'ref', rr.id::text,
            'data', COALESCE(public.order_notif_data(rr.id), '{}'::jsonb) || jsonb_build_object('recipient_role', 'ADMIN')));
        IF rr.courier_user_id IS NOT NULL THEN
            PERFORM public.order_notify('ORDER_COURIER_RETURN', rr.id, 'COURIER', '{}'::jsonb);
        END IF;
        v_absences := v_absences + 1;
    END LOOP;

    FOR r IN SELECT ve.id, ve.name, ve.orders_paused_until, pa.user_id AS owner_id
               FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id
              WHERE NOT ve.orders_pause_end_notified AND ve.orders_paused_until <= now()
              FOR UPDATE OF ve SKIP LOCKED LOOP
        UPDATE public.venues SET orders_pause_end_notified = TRUE WHERE id = r.id AND NOT orders_pause_end_notified;
        IF FOUND THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'ORDER_PAUSE_ENDED',
                'key', 'ORDER_PAUSE_ENDED:' || r.id::text || ':' || extract(epoch FROM r.orders_paused_until)::bigint::text,
                'user_id', r.owner_id,
                'data', jsonb_build_object('venue_id', r.id, 'venue_name', r.name, 'paused_until', r.orders_paused_until)));
            v_pauses := v_pauses + 1;
        END IF;
    END LOOP;
    RETURN jsonb_build_object('absences_escalated', v_absences, 'pauses_ended', v_pauses);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Décision de l'équipe sur une absence
-- ----------------------------------------------------------------------------
-- p : actor_id, order_id, decision (TOUT | PART | RIEN), percent (PART : 1 à 99), reason (5 caractères au moins),
-- preview (vrai : montant seulement, rien d'écrit), expected_amount (montant affiché à la confirmation).
CREATE OR REPLACE FUNCTION public.order_absence_decide(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id uuid := public.try_uuid(p->>'order_id');
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_decision text := upper(COALESCE(p->>'decision', ''));
    v_reason   text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'reason', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    v_preview  boolean := COALESCE(jsonb_typeof(p->'preview') = 'boolean' AND (p->>'preview')::boolean, FALSE);
    v_pct      integer;
    v_amount   numeric := 0;
    v_paid     numeric := 0;
    v_role     text;
    o          record;
    v_res      jsonb;
BEGIN
    IF NOT private.order_admin_allowed(v_actor, ARRAY['refunds.manage']) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit de décider pour cette commande.');
    END IF;
    IF v_decision NOT IN ('TOUT', 'PART', 'RIEN') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DECISION', 'message', 'Choisissez : rembourser tout, une part, ou rien.');
    END IF;
    BEGIN
        v_pct := CASE v_decision WHEN 'TOUT' THEN 100 WHEN 'RIEN' THEN 0 ELSE (p->>'percent')::int END;
    EXCEPTION WHEN others THEN
        v_pct := NULL;
    END;
    IF v_decision = 'PART' AND (v_pct IS NULL OR v_pct NOT BETWEEN 1 AND 99 OR (p->>'percent') !~ '^[0-9]+$') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PERCENT', 'message', 'Indiquez la part rendue, de 1 à 99 %.');
    END IF;
    IF v_order_id IS NULL OR public.order_lock(v_order_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    SELECT * INTO o FROM public.orders WHERE id = v_order_id FOR UPDATE;
    IF o.absent_decided_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_DECIDED', 'message', 'Une décision a déjà été prise pour cette absence.');
    END IF;
    IF o.order_state <> 'EN_ROUTE' OR o.absent_reported_at IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_ABSENCE', 'message', 'Cette commande n’attend pas de décision : elle est remise, close ou le client n’est pas signalé absent.');
    END IF;
    IF o.absent_escalated_at IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ABSENCE_WAITING', 'message',
            format('Le livreur attend encore le client jusqu’à %s : décidez après.', to_char(o.absent_wait_until AT TIME ZONE 'Africa/Dakar', 'HH24:MI')));
    END IF;
    -- Montant rendu : même calcul que order_refund_payment, paiement par paiement encaissé
    SELECT COALESCE(sum(round(pp.amount * v_pct / 100.0)), 0), COALESCE(sum(pp.amount), 0) INTO v_amount, v_paid
      FROM public.payments pp WHERE pp.order_id = o.id AND pp.status::text = 'SUCCESS'
       AND NOT EXISTS (SELECT 1 FROM public.cashouts c WHERE c.idempotency_key = 'REFUND-ORDER-' || pp.id::text);
    IF v_preview THEN
        RETURN jsonb_build_object('ok', true, 'preview', true, 'order_id', o.id, 'decision', v_decision, 'percent', v_pct,
                                  'refund_amount', v_amount, 'paid', v_paid);
    END IF;
    IF v_reason IS NULL OR length(v_reason) < 5 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif : il est envoyé au client et à l’établissement.');
    END IF;
    IF NOT (p ? 'expected_amount') OR (p->>'expected_amount') !~ '^[0-9]+(\.0+)?$' OR (p->>'expected_amount')::numeric <> v_amount THEN
        RETURN jsonb_build_object('ok', false, 'code', 'AMOUNT_CHANGED', 'refund_amount', v_amount,
            'message', format('Le montant rendu est maintenant de %s F CFA : vérifiez-le puis confirmez de nouveau.',
                              replace(to_char(v_amount, 'FM999G999G999'), ',', ' ')));
    END IF;
    v_role := private.order_admin_role(v_actor);
    PERFORM set_config('event_village.order_flow', 'on', true);
    UPDATE public.orders SET absent_decision = v_decision, absent_decided_at = now(), absent_decided_by = v_actor, updated_at = now()
     WHERE id = o.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value, metadata)
    VALUES (v_actor, v_role, 'ORDER_ABSENCE_DECIDED', 'orders', o.id,
            jsonb_build_object('decision', v_decision, 'percent', v_pct, 'refund_amount', v_amount), jsonb_build_object('reason', v_reason));
    v_res := private.order_close_apply(o.id, 'NON_RETIREE', 'EVENT_VILLAGE', v_actor, v_role,
                                       'Client absent : ' || v_reason, v_pct, FALSE, 'ABSENT');
    RETURN v_res || jsonb_build_object('decision', v_decision, 'percent', v_pct);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Fin d'une commande (recopie de 20261130000006_l12a_etapes.sql:121-206)
-- ----------------------------------------------------------------------------
-- p_notice 'REGLEMENTE' : commande refusée par Event Village parce qu'un produit est devenu réglementé ; avis à part au
-- client, à la partenaire et au livreur (sur leurs canaux)
-- p_notice 'ABSENT' (lot 12d) : décision de l'équipe Event Village sur un client absent ; avis à part au client et à la
-- partenaire
CREATE OR REPLACE FUNCTION private.order_close_apply(p_order_id uuid, p_state text, p_origin text, p_actor uuid, p_role text,
                                                    p_reason text, p_percent numeric, p_fault boolean DEFAULT FALSE,
                                                    p_notice text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    o         record;
    v_pay     record;
    v_cashout uuid;
    v_ids     uuid[] := ARRAY[]::uuid[];
    v_refund  numeric := 0;
    v_extra   jsonb;
    v_shown   text;
BEGIN
    SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
    FOR v_pay IN SELECT id FROM public.payments WHERE order_id = o.id AND status::text = 'SUCCESS' ORDER BY paid_at, id LOOP
        v_cashout := private.order_refund_payment(v_pay.id, p_percent, p_reason);
        IF v_cashout IS NOT NULL THEN
            v_ids := v_ids || v_cashout;
        END IF;
    END LOOP;
    SELECT COALESCE(sum(f.amount), 0) INTO v_refund
      FROM public.refunds f JOIN public.payments pp ON pp.id = f.payment_id
     WHERE pp.order_id = o.id AND f.settlement = 'PLATEFORME' AND f.refund_transaction_id LIKE 'REFUND-ORDER-%';

    -- Produits préparés d'une commande non retirée : rien n'est rendu au stock
    IF p_state <> 'NON_RETIREE' THEN
        PERFORM private.order_release_stock(o.id);
    END IF;
    PERFORM set_config('event_village.order_flow', 'on', true);
    UPDATE public.orders
       SET order_state = p_state, cancel_origin = p_origin, cancel_reason = p_reason, cancelled_by = p_actor,
           closed_at = now(), partner_fault = COALESCE(p_fault, FALSE),
           refund_percent = CASE WHEN o.paid_goods + o.paid_fees > 0 THEN p_percent END,
           refunded_amount = LEAST(v_refund, paid_goods + paid_fees), hold_expires_at = NULL, response_due_at = NULL,
           code_hash = NULL,
           -- Contre-vérification (T1) : commande jamais transmise à la partenaire, coordonnées masquées tout de suite
           delivery_address = CASE WHEN o.received_at IS NULL THEN NULL ELSE delivery_address END,
           contact_phone = CASE WHEN o.received_at IS NULL THEN NULL ELSE contact_phone END,
           delivery_notes = CASE WHEN o.received_at IS NULL THEN NULL ELSE delivery_notes END,
           delivery_latitude = CASE WHEN o.received_at IS NULL THEN NULL ELSE delivery_latitude END,
           delivery_longitude = CASE WHEN o.received_at IS NULL THEN NULL ELSE delivery_longitude END,
           contact_masked_at = CASE WHEN o.received_at IS NULL THEN COALESCE(contact_masked_at, now()) ELSE contact_masked_at END,
           payment_status = CASE WHEN v_refund > 0 THEN 'REFUND_PENDING'
                                 WHEN o.paid_goods + o.paid_fees > 0 THEN o.payment_status::text
                                 ELSE 'CANCELLED' END::public.payment_status_enum,
           updated_at = now()
     WHERE id = o.id;
    PERFORM private.order_log_state(o.id, o.order_state, p_state, p_actor, p_role, p_reason);
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (p_actor, p_role,
            CASE p_state WHEN 'REFUSEE' THEN 'ORDER_REFUSED' WHEN 'SANS_REPONSE' THEN 'ORDER_UNANSWERED'
                         WHEN 'NON_RETIREE' THEN 'ORDER_NOT_COLLECTED' ELSE 'ORDER_CANCELLED' END,
            'orders', o.id,
            jsonb_build_object('order_state', o.order_state, 'paid', o.paid_goods + o.paid_fees),
            jsonb_build_object('order_state', p_state, 'refunded_amount', v_refund, 'refund_percent', p_percent),
            jsonb_build_object('origin', p_origin, 'reason', p_reason, 'partner_fault', COALESCE(p_fault, FALSE), 'cashout_ids', to_jsonb(v_ids)));

    v_shown := CASE WHEN p_notice = 'REGLEMENTE' THEN 'REGLEMENTE'
                    WHEN p_state IN ('REFUSEE', 'SANS_REPONSE') THEN p_state ELSE COALESCE(p_origin, p_state) END;
    v_extra := jsonb_strip_nulls(jsonb_build_object(
        'origin', v_shown, 'refund_amount', v_refund,
        'reason', CASE WHEN p_origin IN ('PARTENAIRE', 'EVENT_VILLAGE') OR p_state = 'REFUSEE' THEN p_reason END));
    -- Lot 12d : décision sur un client absent : avis propres (client sur ses 4 canaux, partenaire : cloche et téléphone)
    IF p_notice = 'ABSENT' THEN
        v_extra := v_extra || jsonb_build_object('decision', (SELECT x.absent_decision FROM public.orders x WHERE x.id = o.id));
        PERFORM public.order_notify('ORDER_ABSENCE_DECIDED', o.id, 'CLIENT', v_extra);
        PERFORM public.order_notify('ORDER_ABSENCE_DECIDED_PRO', o.id, 'OWNER', v_extra);
        RETURN jsonb_build_object('ok', true, 'order_id', o.id, 'order_state', p_state,
                                  'refund_percent', CASE WHEN o.paid_goods + o.paid_fees > 0 THEN p_percent ELSE 0 END,
                                  'refund_amount', v_refund, 'paid', o.paid_goods + o.paid_fees, 'cashout_ids', to_jsonb(v_ids));
    END IF;
    IF p_state = 'NON_RETIREE' THEN
        PERFORM public.order_notify('ORDER_NOT_COLLECTED', o.id, 'CLIENT', v_extra);
        PERFORM public.order_notify('ORDER_CANCELLED_PRO', o.id, 'OWNER', v_extra || jsonb_build_object('origin', 'NON_RETIREE'));
    ELSE
        PERFORM public.order_notify('ORDER_CANCELLED', o.id, 'CLIENT', v_extra);
        -- Refus pour produit réglementé : la partenaire est prévenue aussi (elle n'a pas refusé elle-même)
        IF p_origin IS DISTINCT FROM 'PARTENAIRE' AND (p_state <> 'REFUSEE' OR p_notice = 'REGLEMENTE') THEN
            PERFORM public.order_notify('ORDER_CANCELLED_PRO', o.id, 'OWNER', v_extra);
        END IF;
        IF o.courier_user_id IS NOT NULL THEN
            PERFORM public.order_notify('ORDER_COURIER_CANCELLED', o.id, 'COURIER',
                                        jsonb_strip_nulls(jsonb_build_object('origin', p_notice)), o.courier_user_id::text);
        END IF;
    END IF;
    RETURN jsonb_build_object('ok', true, 'order_id', o.id, 'order_state', p_state,
                              'refund_percent', CASE WHEN o.paid_goods + o.paid_fees > 0 THEN p_percent ELSE 0 END,
                              'refund_amount', v_refund, 'paid', o.paid_goods + o.paid_fees, 'cashout_ids', to_jsonb(v_ids));
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Signalements
-- ----------------------------------------------------------------------------
-- p : actor_id (client), order_id, reason (RETARD | INCOMPLETE | ERREUR | AUTRE), details (300 caractères au plus ;
-- obligatoire pour AUTRE).
CREATE OR REPLACE FUNCTION public.order_issue_report(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id uuid := public.try_uuid(p->>'order_id');
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_reason   text := upper(COALESCE(p->>'reason', ''));
    v_details  text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'details', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    o          record;
    v_count    integer;
    v_issue    public.order_issues;
BEGIN
    IF v_order_id IS NULL OR public.order_lock(v_order_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    SELECT od.*, ve.name AS venue_name INTO o FROM public.orders od JOIN public.venues ve ON ve.id = od.venue_id
     WHERE od.id = v_order_id FOR UPDATE OF od;
    IF v_actor IS NULL OR o.client_id IS DISTINCT FROM v_actor
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    IF v_reason NOT IN ('RETARD', 'INCOMPLETE', 'ERREUR', 'AUTRE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REASON', 'message', 'Choisissez ce qui ne va pas : retard, commande incomplète, erreur ou autre.');
    END IF;
    IF v_reason = 'AUTRE' AND (v_details IS NULL OR length(v_details) < 5) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DETAILS_REQUIRED', 'message', 'Dites en quelques mots ce qui ne va pas.');
    END IF;
    IF o.order_state IN ('EN_ATTENTE_PAIEMENT', 'RECUE', 'ACCEPTEE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ISSUE_TOO_EARLY',
            'message', 'La préparation n’a pas commencé : vous pouvez encore annuler la commande depuis cette page.');
    END IF;
    IF NOT (o.order_state IN ('EN_PREPARATION', 'PRETE', 'EN_ROUTE')
            OR (o.order_state = 'REMISE' AND o.handed_over_at > now() - interval '48 hours')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ISSUE_TOO_LATE',
            'message', 'Cette commande est close depuis trop longtemps pour un signalement : écrivez à Event Village.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.order_issues i WHERE i.order_id = o.id AND i.status = 'OUVERT') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ISSUE_ALREADY_OPEN', 'message', 'Un signalement est déjà en cours pour cette commande : l’équipe Event Village s’en occupe.');
    END IF;
    SELECT count(*) INTO v_count FROM public.order_issues i WHERE i.order_id = o.id;
    IF v_count >= 3 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_ISSUES', 'message', 'Vous avez déjà fait trois signalements pour cette commande : écrivez à Event Village.');
    END IF;
    INSERT INTO public.order_issues (order_id, client_id, reason, details) VALUES (o.id, v_actor, v_reason, v_details)
    RETURNING * INTO v_issue;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value)
    VALUES (v_actor, 'CLIENT', 'ORDER_ISSUE_REPORTED', 'order_issues', v_issue.id, jsonb_build_object('order_id', o.id, 'reason', v_reason));
    -- Administrateurs : un avis par heure au plus (regroupé) ; établissement : à chaque signalement
    PERFORM public.notif_enqueue_admins(jsonb_build_object(
        'type', 'ADMIN_ORDER_ISSUE', 'ref', to_char(now() AT TIME ZONE 'Africa/Dakar', 'YYYYMMDDHH24'),
        'data', COALESCE(public.order_notif_data(o.id), '{}'::jsonb) || jsonb_build_object('reason', v_reason, 'recipient_role', 'ADMIN')));
    PERFORM public.order_notify('ORDER_ISSUE_PRO', o.id, 'OWNER', jsonb_build_object('reason', v_reason), v_issue.id::text);
    RETURN jsonb_build_object('ok', true, 'order_id', o.id,
                              'issue', jsonb_build_object('id', v_issue.id, 'reason', v_issue.reason, 'status', v_issue.status, 'created_at', v_issue.created_at));
END;
$$;

-- p : actor_id (équipe : refunds.manage ou super-administrateur), issue_id, note (5 à 300 caractères, envoyée au client)
CREATE OR REPLACE FUNCTION public.order_issue_close(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id    uuid := public.try_uuid(p->>'issue_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_note  text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'note', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    i       record;
BEGIN
    IF NOT private.order_admin_allowed(v_actor, ARRAY['refunds.manage']) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit de traiter ce signalement.');
    END IF;
    SELECT * INTO i FROM public.order_issues WHERE id = v_id;
    IF v_id IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ISSUE_NOT_FOUND', 'message', 'Signalement introuvable.');
    END IF;
    PERFORM public.order_lock(i.order_id);
    SELECT * INTO i FROM public.order_issues WHERE id = v_id FOR UPDATE;
    IF i.status <> 'OUVERT' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ISSUE_ALREADY_CLOSED', 'message', 'Ce signalement est déjà traité.');
    END IF;
    IF v_note IS NULL OR length(v_note) < 5 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Écrivez la réponse au client : elle lui est envoyée.');
    END IF;
    UPDATE public.order_issues SET status = 'TRAITE', closed_at = now(), closed_by = v_actor, close_note = v_note WHERE id = i.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value)
    VALUES (v_actor, private.order_admin_role(v_actor), 'ORDER_ISSUE_CLOSED', 'order_issues', i.id, jsonb_build_object('order_id', i.order_id));
    PERFORM public.order_notify('ORDER_ISSUE_CLOSED', i.order_id, 'CLIENT', jsonb_build_object('reason', i.reason), i.id::text);
    RETURN jsonb_build_object('ok', true, 'issue_id', i.id, 'order_id', i.order_id, 'status', 'TRAITE');
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Droits
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION private.order_admin_allowed(uuid, text[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_admin_role(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_close_apply(uuid, text, text, uuid, text, text, numeric, boolean, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.order_delivery_step(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_watch_tick() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_absence_decide(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_issue_report(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_issue_close(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_delivery_step(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_watch_tick() TO service_role;
GRANT EXECUTE ON FUNCTION public.order_absence_decide(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_issue_report(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_issue_close(jsonb) TO service_role;
