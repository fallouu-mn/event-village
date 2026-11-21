-- ============================================================================
-- EVENT VILLAGE — LOT 12a, migration 06 : étapes d'une commande (accepter, préparer, prête, en route, remise contre
-- code), annulations et remboursements, livreurs, lectures serveur, tâche planifiée
-- ============================================================================
-- Trous de l'existant (rapport § 1) : la partenaire écrivait n'importe quel statut, une annulation ne remboursait
-- rien, aucune remise contre code, aucun livreur, aucune expiration, adresse et téléphone gardés sans limite.
--  1. order_refund_payment(paiement, part, motif) : remboursement par le moteur financier (versement Wave ou Orange
--     Money, part de la partenaire reprise au grand livre, frais de l'opérateur de 1,5 % à la charge d'Event Village,
--     commission de parrainage régularisée par fin_refund_apply) ; une fois par paiement ;
--  2. order_close_apply (interne) : fin d'une commande sous verrou (annulée, refusée, sans réponse, non retirée) :
--     remboursement de chaque paiement encaissé, stock et portions rendus (sauf non retirée), code effacé, historique,
--     journal, avis ;
--  3. order_cancel(p) : par le client (gratuit et tout rendu avant le début de la préparation, refusé ensuite), par la
--     partenaire (motif, tout rendu), par Event Village (droit des remboursements ; faute de la partenaire notée ; tout
--     rendu) ;
--  4. order_partner_action(p) : ACCEPTER (heure estimée), REFUSER (motif, tout rendu), PREPARER, PRETE (retrait :
--     code envoyé au client), CONFIER (à un livreur ACTIF de son équipe), EN_ROUTE (code envoyé au client), REMETTRE
--     (code, solde reçu sur place), ANNULER ; fiche SUSPENDU : lecture seule ;
--  5. order_courier_action(p) : le livreur de la commande, membre ACTIF de l'équipe : EN_ROUTE, REMETTRE ;
--  6. remise (order_handover_apply) : code à 4 chiffres comparé à son empreinte, essais limités
--     (orders.code_max_attempts), solde dû encaissé sur place et noté (jamais compté) ; order_code_resend(p) : nouveau
--     code demandé par le client (orders.code_resend_max). Un code émis (prête à retirer, en route, nouveau code) est
--     rendu une seule fois dans la réponse de la fonction à la route serveur (`handover_code`, avec le numéro du
--     client), qui l'envoie aussitôt par SMS (ORDER_HANDOVER_CODE, journal sans le code) et ne le renvoie jamais au
--     navigateur ; il n'est stocké qu'en empreinte et n'entre jamais dans la boîte d'envoi ;
--  7. livreurs : order_courier_invite (par la partenaire, compte actif existant), order_courier_respond (accord du
--     livreur), order_courier_remove ;
--  8. lectures serveur : order_view (client, partenaire, livreur, administration), order_partner_list,
--     order_courier_list ; la partenaire et le livreur ne lisent rien par REST ; adresse et téléphone seulement tant
--     qu'ils ne sont pas masqués ;
--  9. order_tick() (tâche /api/cron/orders, toutes les 5 minutes) : attentes de paiement échues, commandes sans
--     réponse (tout rendu), client prévenu avant la clôture d'une commande non retirée, commande prête non retirée
--     close sans remboursement, adresse et téléphone masqués orders.contact_retention_days après la remise ; idempotente ;
-- 10. notif_cashouts_notify : recopie de 20261126000003_l10b_avis.sql:317-645 ; le remboursement d'une commande est
--     annoncé par l'avis de la commande (pas par le texte des billets), et son versement par ORDER_REFUND_PAID.
-- Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- ============================================================================

-- Contre-vérification (T7) : aides internes dans le schéma private (non exposé par l'API, hors de la règle 1A.3) ;
-- anciennes versions publiques retirées
DROP FUNCTION IF EXISTS public.order_refund_payment(uuid, numeric, text);
DROP FUNCTION IF EXISTS private.order_close_apply(uuid, text, text, uuid, text, text, numeric, boolean);
DROP FUNCTION IF EXISTS public.order_close_apply(uuid, text, text, uuid, text, text, numeric, boolean);
DROP FUNCTION IF EXISTS public.order_issue_code(uuid);
DROP FUNCTION IF EXISTS public.order_code_delivery(uuid, text, text);
DROP FUNCTION IF EXISTS public.order_set_en_route(uuid, uuid, text, integer);
DROP FUNCTION IF EXISTS public.order_handover_apply(uuid, uuid, text, text, boolean);

-- ----------------------------------------------------------------------------
-- 1. Remboursement d'un paiement de commande
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.order_refund_payment(p_payment_id uuid, p_percent numeric, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay     record;
    v_user    record;
    v_key     text := 'REFUND-ORDER-' || p_payment_id::text;
    v_cashout uuid;
    v_refund  uuid;
    v_amount  numeric;
    v_comm    numeric;
    v_facial  numeric;
    v_service numeric;
    v_agg     numeric;
    v_blocked text;
BEGIN
    SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND OR v_pay.payment_target::text <> 'ORDER' THEN
        RAISE EXCEPTION 'order_refund_payment : paiement de commande % introuvable', p_payment_id;
    END IF;
    SELECT id INTO v_cashout FROM public.cashouts WHERE idempotency_key = v_key;
    IF FOUND THEN
        RETURN v_cashout;
    END IF;
    IF p_percent IS NULL OR p_percent <= 0 OR v_pay.status::text <> 'SUCCESS' THEN
        RETURN NULL;
    END IF;
    IF p_percent > 100 THEN
        RAISE EXCEPTION 'order_refund_payment : part % hors bornes', p_percent;
    END IF;
    v_amount := round(v_pay.amount * p_percent / 100);
    -- Part de la partenaire (prix moins commission) rendue par la partenaire ; le reste (frais de service et commission)
    -- par Event Village ; frais de l'opérateur (1,5 %) à la charge d'Event Village (§78)
    v_comm := COALESCE(NULLIF(v_pay.metadata->>'commission_amount', '')::numeric, 0);
    v_facial := LEAST(round((COALESCE(v_pay.facial_amount, 0) - v_comm) * p_percent / 100), v_amount);
    v_service := v_amount - v_facial;
    v_agg := public.fin_round_2(COALESCE(v_pay.aggregator_fee, 0) * p_percent / 100);
    SELECT first_name, last_name INTO v_user FROM public.users WHERE id = v_pay.client_id;
    v_blocked := CASE
        WHEN v_pay.operator IS NULL THEN 'OPERATOR_UNKNOWN'
        WHEN v_pay.payer_phone IS NULL THEN 'PHONE_UNKNOWN'
        WHEN NULLIF(btrim(v_user.first_name), '') IS NULL OR NULLIF(btrim(v_user.last_name), '') IS NULL THEN 'NAME_UNKNOWN'
        ELSE NULL END;
    INSERT INTO public.refunds (payment_id, refund_transaction_id, amount, reason, status, settlement, kind,
                                facial_part, service_part, aggregator_fee_share, aggregator_fee_bearer, net_revenue_reversal)
    VALUES (p_payment_id, v_key, v_amount, COALESCE(p_reason, 'Annulation d’une commande'), 'PENDING', 'PLATEFORME', 'REFUND',
            v_facial, v_service, v_agg, 'EVENT_VILLAGE', v_service)
    RETURNING id INTO v_refund;
    INSERT INTO public.cashouts (kind, idempotency_key, payment_id, refund_id, beneficiary_user_id, operator, phone_number,
                                 first_name, last_name, amount, blocked_reason)
    VALUES ('REFUND', v_key, p_payment_id, v_refund, v_pay.client_id, v_pay.operator, v_pay.payer_phone,
            NULLIF(btrim(v_user.first_name), ''), NULLIF(btrim(v_user.last_name), ''), v_amount, v_blocked)
    RETURNING id INTO v_cashout;
    UPDATE public.refunds SET cashout_id = v_cashout WHERE id = v_refund;
    PERFORM public.fin_refund_apply(v_refund);
    RETURN v_cashout;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Fin d'une commande (l'appelant tient le verrou de l'établissement)
-- ----------------------------------------------------------------------------
-- p_notice 'REGLEMENTE' : commande refusée par Event Village parce qu'un produit est devenu réglementé ; avis à part au
-- client, à la partenaire et au livreur (sur leurs canaux)
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
-- 3. Annuler
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_cancel(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id uuid := public.try_uuid(p->>'order_id');
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_origin   text := upper(COALESCE(p->>'origin', ''));
    v_reason   text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'reason', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    v_fault    boolean := COALESCE(NULLIF(p->>'partner_fault', '')::boolean, TRUE);
    o          record;
    v_role     text;
BEGIN
    IF v_origin NOT IN ('CLIENT', 'PARTENAIRE', 'EVENT_VILLAGE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ORIGIN', 'message', 'Annulation refusée.');
    END IF;
    IF v_order_id IS NULL OR public.order_lock(v_order_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    SELECT od.*, pa.user_id AS owner_id, pa.status::text AS partner_status INTO o
      FROM public.orders od JOIN public.partners pa ON pa.id = od.partner_id
     WHERE od.id = v_order_id FOR UPDATE OF od;

    IF v_origin = 'CLIENT' AND (v_actor IS NULL OR v_actor <> o.client_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    -- Contre-vérification (T1) : la partenaire n'agit que sur une commande qui lui a été transmise (received_at)
    IF v_origin = 'PARTENAIRE' AND (v_actor IS NULL OR v_actor <> o.owner_id OR o.received_at IS NULL
        OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    IF v_origin = 'PARTENAIRE' AND o.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre fiche est suspendue : vos commandes sont en lecture seule.');
    END IF;
    IF v_origin = 'EVENT_VILLAGE' AND (v_actor IS NULL
        OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
        OR NOT (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
                OR public.has_admin_permission(v_actor, 'refunds.manage')
                OR (o.paid_goods = 0 AND o.order_state = 'EN_ATTENTE_PAIEMENT' AND public.has_admin_permission(v_actor, 'events.write')))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit d’annuler cette commande.');
    END IF;
    IF v_origin IN ('PARTENAIRE', 'EVENT_VILLAGE') AND (v_reason IS NULL OR length(v_reason) < 5) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif : il est envoyé au client.');
    END IF;
    IF o.order_state NOT IN ('EN_ATTENTE_PAIEMENT', 'RECUE', 'ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_CANCELLABLE', 'message', 'Cette commande est déjà annulée ou terminée.');
    END IF;
    -- Décision du client : annulation gratuite par le client avant le début de la préparation ; ensuite non (sauf faute
    -- de la partenaire, constatée par Event Village)
    IF v_origin = 'CLIENT' AND o.order_state NOT IN ('EN_ATTENTE_PAIEMENT', 'RECUE', 'ACCEPTEE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PREPARATION_STARTED',
            'message', 'La préparation a commencé : la commande ne peut plus être annulée. En cas de problème, contactez Event Village depuis la commande.');
    END IF;
    v_role := CASE v_origin WHEN 'CLIENT' THEN 'CLIENT' WHEN 'PARTENAIRE' THEN 'PARTENAIRE'
                   ELSE CASE WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
                             THEN 'SUPERADMIN' ELSE 'ADMIN' END END;
    RETURN private.order_close_apply(o.id,
        CASE v_origin WHEN 'CLIENT' THEN 'ANNULEE_CLIENT' WHEN 'PARTENAIRE' THEN 'ANNULEE_PARTENAIRE' ELSE 'ANNULEE_EV' END,
        v_origin, v_actor, v_role, COALESCE(v_reason, 'Annulation par le client'), 100,
        CASE WHEN v_origin = 'PARTENAIRE' THEN TRUE WHEN v_origin = 'EVENT_VILLAGE' THEN v_fault ELSE FALSE END);
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Code de remise
-- ----------------------------------------------------------------------------
-- Nouveau code à 4 chiffres (tirage cryptographique) ; seule son empreinte est gardée ; essais remis à zéro
CREATE OR REPLACE FUNCTION private.order_issue_code(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    b      bytea := extensions.gen_random_bytes(4);
    v_code text;
BEGIN
    v_code := lpad((((get_byte(b, 0)::bigint << 24) | (get_byte(b, 1) << 16) | (get_byte(b, 2) << 8) | get_byte(b, 3)) % 10000)::text, 4, '0');
    PERFORM set_config('event_village.order_flow', 'on', true);
    UPDATE public.orders
       SET code_hash = private.order_code_hash(id, v_code), code_issued_at = now(), code_attempts = 0, updated_at = now()
     WHERE id = p_order_id;
    RETURN v_code;
END;
$$;

-- Code à envoyer tout de suite par la route serveur : le code, l'étape, le client et son numéro, le numéro de la commande.
-- Jamais rendu au navigateur (les routes le retirent de la réponse après l'envoi du SMS).
CREATE OR REPLACE FUNCTION private.order_code_delivery(p_order_id uuid, p_code text, p_step text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    -- Contre-vérification (T9) : une référence par envoi (commande, étape, nouveaux codes déjà demandés) : chaque SMS
    -- du code est journalisé
    SELECT jsonb_build_object('handover_code', p_code, 'handover_step', p_step, 'client_id', o.client_id,
                              'client_phone', u.phone, 'order_number', o.order_number,
                              'handover_ref', o.id::text || ':' || p_step || ':' || o.code_resends::text)
      FROM public.orders o JOIN public.users u ON u.id = o.client_id
     WHERE o.id = p_order_id;
$$;

-- Départ du livreur (ou de la partenaire) : code envoyé au client, heure estimée
CREATE OR REPLACE FUNCTION private.order_set_en_route(p_order_id uuid, p_actor uuid, p_role text, p_eta_minutes integer)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    o      record;
    v_code text;
    v_eta  timestamptz;
BEGIN
    SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF o.delivery_mode::text <> 'LIVRAISON' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_DELIVERY', 'message', 'Cette commande n’est pas à livrer.');
    END IF;
    IF o.order_state <> 'PRETE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_READY', 'message', 'La commande doit être prête avant le départ du livreur.');
    END IF;
    IF p_eta_minutes IS NOT NULL AND p_eta_minutes NOT BETWEEN 5 AND 240 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ETA', 'message', 'Indiquez une durée de trajet de 5 à 240 minutes.');
    END IF;
    v_eta := CASE WHEN p_eta_minutes IS NOT NULL THEN now() + make_interval(mins => p_eta_minutes)
                  ELSE GREATEST(COALESCE(o.estimated_at, o.scheduled_for), now()) END;
    PERFORM set_config('event_village.order_flow', 'on', true);
    UPDATE public.orders SET order_state = 'EN_ROUTE', en_route_at = now(), estimated_at = v_eta, updated_at = now() WHERE id = o.id;
    v_code := private.order_issue_code(o.id);
    PERFORM private.order_log_state(o.id, 'PRETE', 'EN_ROUTE', p_actor, p_role, NULL);
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value)
    VALUES (p_actor, p_role, 'ORDER_ON_THE_WAY', 'orders', o.id, jsonb_build_object('order_state', 'EN_ROUTE', 'estimated_at', v_eta));
    PERFORM public.order_notify('ORDER_ON_THE_WAY', o.id, 'CLIENT');
    RETURN jsonb_build_object('ok', true, 'order_id', o.id, 'order_state', 'EN_ROUTE', 'estimated_at', v_eta)
           || private.order_code_delivery(o.id, v_code, 'LIVRAISON');
END;
$$;

-- Remise : code (retrait et livraison), solde encaissé sur place et noté ; une seule fois
CREATE OR REPLACE FUNCTION private.order_handover_apply(p_order_id uuid, p_actor uuid, p_role text, p_code text, p_balance_received boolean)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    o         record;
    v_max     integer := public.fin_setting_num('orders.code_max_attempts')::int;
    v_balance numeric;
    v_left    integer;
BEGIN
    SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF o.order_state = 'REMISE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_HANDED_OVER', 'message', 'Cette commande est déjà remise.');
    END IF;
    IF (o.delivery_mode::text = 'LIVRAISON' AND o.order_state <> 'EN_ROUTE')
       OR (o.delivery_mode::text <> 'LIVRAISON' AND o.order_state <> 'PRETE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_HANDOVER_READY',
            'message', CASE WHEN o.delivery_mode::text = 'LIVRAISON' THEN 'La commande doit être en route pour être remise.'
                            ELSE 'La commande doit être prête pour être remise.' END);
    END IF;
    -- Contre-vérification (T2) : fiche suspendue, remise refusée ; produit devenu réglementé, jamais remis : commande
    -- refusée par Event Village, tout rendu au client, sans faute de la partenaire (avant tout essai du code)
    IF EXISTS (SELECT 1 FROM public.partners pa WHERE pa.id = o.partner_id AND pa.status::text <> 'VALIDE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'L’établissement est suspendu : ses commandes sont en lecture seule.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.order_items i WHERE i.order_id = o.id AND public.product_regulated(i.product_id)) THEN
        PERFORM private.order_close_apply(o.id, 'REFUSEE', NULL, NULL, 'SYSTEM', 'Produit réglementé : il ne se vend pas en ligne', 100, FALSE, 'REGLEMENTE');
        RETURN jsonb_build_object('ok', false, 'code', 'REGULATED_ORDER_REFUSED',
            'message', 'Un produit de cette commande est réglementé : elle ne peut pas être remise. Elle est annulée et le client remboursé.');
    END IF;
    PERFORM set_config('event_village.order_flow', 'on', true);
    IF o.delivery_mode::text IN ('LIVRAISON', 'RETRAIT') THEN
        IF o.code_hash IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'CODE_NOT_ISSUED', 'message', 'Aucun code n’a encore été envoyé au client.');
        END IF;
        IF o.code_attempts >= v_max THEN
            RETURN jsonb_build_object('ok', false, 'code', 'CODE_LOCKED',
                'message', 'Trop d’essais : le client doit demander un nouveau code depuis sa commande.');
        END IF;
        IF p_code IS NULL OR p_code !~ '^[0-9]{4}$' OR private.order_code_hash(o.id, p_code) <> o.code_hash THEN
            UPDATE public.orders SET code_attempts = code_attempts + 1, updated_at = now() WHERE id = o.id;
            v_left := v_max - o.code_attempts - 1;
            INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
            VALUES (p_actor, p_role, 'ORDER_CODE_REJECTED', 'orders', o.id, jsonb_build_object('attempt', o.code_attempts + 1, 'max', v_max));
            IF v_left <= 0 THEN
                RETURN jsonb_build_object('ok', false, 'code', 'CODE_LOCKED',
                    'message', 'Code incorrect. Trop d’essais : le client doit demander un nouveau code depuis sa commande.');
            END IF;
            RETURN jsonb_build_object('ok', false, 'code', 'WRONG_CODE', 'attempts_left', v_left,
                'message', CASE WHEN v_left = 1 THEN 'Code incorrect. Il reste 1 essai.' ELSE format('Code incorrect. Il reste %s essais.', v_left) END);
        END IF;
    END IF;
    v_balance := o.goods_total - o.paid_goods;
    IF v_balance > 0 AND NOT COALESCE(p_balance_received, FALSE) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'BALANCE_DUE', 'balance_due', v_balance,
            'message', format('Le client doit encore %s F CFA : encaissez-les, puis confirmez « solde reçu ».',
                              replace(to_char(v_balance, 'FM999G999G999'), ',', ' ')));
    END IF;
    UPDATE public.orders
       SET order_state = 'REMISE', handed_over_at = now(), closed_at = now(), code_hash = NULL,
           onsite_amount = CASE WHEN v_balance > 0 THEN v_balance END,
           onsite_recorded_at = CASE WHEN v_balance > 0 THEN now() END,
           onsite_recorded_by = CASE WHEN v_balance > 0 THEN p_actor END,
           updated_at = now()
     WHERE id = o.id;
    PERFORM private.order_log_state(o.id, o.order_state, 'REMISE', p_actor, p_role,
        CASE WHEN v_balance > 0 THEN format('Solde de %s F CFA reçu sur place', v_balance) END);
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (p_actor, p_role, 'ORDER_HANDED_OVER', 'orders', o.id,
            jsonb_build_object('order_state', o.order_state), jsonb_build_object('order_state', 'REMISE'),
            jsonb_build_object('onsite_amount', CASE WHEN v_balance > 0 THEN v_balance END, 'mode', o.delivery_mode::text));
    PERFORM public.order_notify('ORDER_HANDED_OVER', o.id, 'CLIENT');
    IF p_role = 'LIVREUR' THEN
        PERFORM public.order_notify('ORDER_HANDED_OVER_PRO', o.id, 'OWNER');
    END IF;
    RETURN jsonb_build_object('ok', true, 'order_id', o.id, 'order_state', 'REMISE',
                              'onsite_amount', CASE WHEN v_balance > 0 THEN v_balance END);
END;
$$;

-- Nouveau code demandé par le client (perdu, ou trop d'essais)
CREATE OR REPLACE FUNCTION public.order_code_resend(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id uuid := public.try_uuid(p->>'order_id');
    v_client   uuid := public.try_uuid(p->>'client_id');
    o          record;
    v_code     text;
BEGIN
    IF v_order_id IS NULL OR public.order_lock(v_order_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    SELECT * INTO o FROM public.orders WHERE id = v_order_id FOR UPDATE;
    IF v_client IS NULL OR o.client_id <> v_client THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    IF o.code_hash IS NULL OR NOT ((o.delivery_mode::text = 'RETRAIT' AND o.order_state = 'PRETE')
                                   OR (o.delivery_mode::text = 'LIVRAISON' AND o.order_state = 'EN_ROUTE')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_CODE_YET',
            'message', 'Le code est envoyé quand la commande est prête à retirer ou en route.');
    END IF;
    IF o.code_resends >= public.fin_setting_num('orders.code_resend_max')::int THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_CODES', 'message', 'Vous avez déjà demandé plusieurs codes : contactez l’établissement.');
    END IF;
    v_code := private.order_issue_code(o.id);
    UPDATE public.orders SET code_resends = code_resends + 1, updated_at = now() WHERE id = o.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_client, 'CLIENT', 'ORDER_CODE_RESENT', 'orders', o.id, jsonb_build_object('resends', o.code_resends + 1));
    RETURN jsonb_build_object('ok', true, 'order_id', o.id,
                              'resends_left', public.fin_setting_num('orders.code_resend_max')::int - o.code_resends - 1)
           || private.order_code_delivery(o.id, v_code, 'NOUVEAU');
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Actions de la partenaire
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_partner_action(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id uuid := public.try_uuid(p->>'order_id');
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_action   text := upper(COALESCE(p->>'action', ''));
    v_reason   text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'reason', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    v_courier  uuid := public.try_uuid(NULLIF(p->>'courier_id', ''));
    v_minutes  integer;
    o          record;
    v_eta      timestamptz;
    v_code     text;
BEGIN
    IF v_action NOT IN ('ACCEPTER', 'REFUSER', 'PREPARER', 'PRETE', 'CONFIER', 'EN_ROUTE', 'REMETTRE', 'ANNULER') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ACTION', 'message', 'Action inconnue.');
    END IF;
    BEGIN
        v_minutes := NULLIF(p->>'minutes', '')::int;
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MINUTES', 'message', 'La durée indiquée n’est pas valable.');
    END;
    IF v_order_id IS NULL OR public.order_lock(v_order_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    SELECT od.*, pa.user_id AS owner_id, pa.status::text AS partner_status, ve.is_active AS venue_active,
           ve.validation_status AS venue_status
      INTO o
      FROM public.orders od JOIN public.partners pa ON pa.id = od.partner_id JOIN public.venues ve ON ve.id = od.venue_id
     WHERE od.id = v_order_id FOR UPDATE OF od;
    -- La partenaire ne voit jamais une commande d'une autre, ni une commande qui ne lui a pas été transmise (payée, ou
    -- payable à la remise) : contre-vérification T1
    IF v_actor IS NULL OR v_actor <> o.owner_id OR o.received_at IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    -- Fiche SUSPENDU (ou non validée) : lecture seule
    IF o.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre fiche est suspendue : vos commandes sont en lecture seule.');
    END IF;

    IF v_action = 'ANNULER' THEN
        RETURN public.order_cancel(jsonb_build_object('order_id', o.id, 'actor_id', v_actor, 'origin', 'PARTENAIRE', 'reason', v_reason));
    END IF;
    IF v_action = 'REMETTRE' THEN
        RETURN private.order_handover_apply(o.id, v_actor, 'PARTENAIRE', NULLIF(p->>'code', ''),
                                           COALESCE(NULLIF(p->>'balance_received', '')::boolean, FALSE));
    END IF;

    IF v_action IN ('ACCEPTER', 'REFUSER') THEN
        IF o.order_state <> 'RECUE' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NOT_PENDING', 'message', 'Cette commande a déjà reçu une réponse.');
        END IF;
        IF o.response_due_at IS NOT NULL AND o.response_due_at <= now() THEN
            PERFORM private.order_close_apply(o.id, 'SANS_REPONSE', 'SANS_REPONSE', NULL, 'SYSTEM', 'Pas de réponse de l’établissement à temps', 100, TRUE);
            RETURN jsonb_build_object('ok', false, 'code', 'RESPONSE_TOO_LATE', 'message', 'Le délai de réponse est passé : la commande est annulée et le client remboursé.');
        END IF;
        IF v_action = 'REFUSER' THEN
            IF v_reason IS NULL OR length(v_reason) < 5 THEN
                RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif : il est envoyé au client.');
            END IF;
            RETURN private.order_close_apply(o.id, 'REFUSEE', NULL, v_actor, 'PARTENAIRE', v_reason, 100, FALSE);
        END IF;
        -- Établissement suspendu ou retiré entre-temps : la commande est refusée, le client remboursé
        IF NOT o.venue_active OR o.venue_status <> 'VALIDEE' THEN
            PERFORM private.order_close_apply(o.id, 'REFUSEE', NULL, NULL, 'SYSTEM', 'L’établissement ne prend plus de commande', 100, TRUE);
            RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_AVAILABLE', 'message', 'Cet établissement ne prend plus de commande : le client est remboursé.');
        END IF;
        -- Contre-vérification (T2) : produit devenu réglementé : commande refusée par Event Village, tout rendu au client
        IF EXISTS (SELECT 1 FROM public.order_items i WHERE i.order_id = o.id AND public.product_regulated(i.product_id)) THEN
            PERFORM private.order_close_apply(o.id, 'REFUSEE', NULL, NULL, 'SYSTEM', 'Produit réglementé : il ne se vend pas en ligne', 100, FALSE, 'REGLEMENTE');
            RETURN jsonb_build_object('ok', false, 'code', 'REGULATED_ORDER_REFUSED',
                'message', 'Un produit de cette commande est réglementé : elle ne peut pas être acceptée. Elle est annulée et le client remboursé.');
        END IF;
        IF v_minutes IS NOT NULL AND v_minutes NOT BETWEEN 5 AND 240 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MINUTES', 'message', 'Indiquez une préparation de 5 à 240 minutes.');
        END IF;
        v_eta := GREATEST(o.scheduled_for, now() + make_interval(mins => COALESCE(v_minutes, o.prep_minutes)));
        PERFORM set_config('event_village.order_flow', 'on', true);
        UPDATE public.orders
           SET order_state = 'ACCEPTEE', accepted_at = now(), response_due_at = NULL, estimated_at = v_eta,
               prep_minutes = COALESCE(v_minutes, prep_minutes), updated_at = now()
         WHERE id = o.id;
        PERFORM private.order_log_state(o.id, 'RECUE', 'ACCEPTEE', v_actor, 'PARTENAIRE', NULL);
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
        VALUES (v_actor, 'PARTENAIRE', 'ORDER_ACCEPTED', 'orders', o.id,
                jsonb_build_object('order_state', 'RECUE'), jsonb_build_object('order_state', 'ACCEPTEE', 'estimated_at', v_eta));
        PERFORM public.order_notify('ORDER_ACCEPTED', o.id, 'CLIENT');
        RETURN jsonb_build_object('ok', true, 'order_id', o.id, 'order_state', 'ACCEPTEE', 'estimated_at', v_eta);
    END IF;

    IF v_action = 'PREPARER' THEN
        IF o.order_state <> 'ACCEPTEE' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_STEP', 'message', 'Acceptez d’abord la commande.');
        END IF;
        IF v_minutes IS NOT NULL AND v_minutes NOT BETWEEN 5 AND 240 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MINUTES', 'message', 'Indiquez une préparation de 5 à 240 minutes.');
        END IF;
        v_eta := CASE WHEN v_minutes IS NOT NULL THEN GREATEST(o.scheduled_for, now() + make_interval(mins => v_minutes)) ELSE o.estimated_at END;
        PERFORM set_config('event_village.order_flow', 'on', true);
        UPDATE public.orders SET order_state = 'EN_PREPARATION', preparing_at = now(), estimated_at = v_eta, updated_at = now() WHERE id = o.id;
        PERFORM private.order_log_state(o.id, 'ACCEPTEE', 'EN_PREPARATION', v_actor, 'PARTENAIRE', NULL);
        PERFORM public.order_notify('ORDER_PREPARING', o.id, 'CLIENT');
        RETURN jsonb_build_object('ok', true, 'order_id', o.id, 'order_state', 'EN_PREPARATION', 'estimated_at', v_eta);
    END IF;

    IF v_action = 'PRETE' THEN
        IF o.order_state NOT IN ('ACCEPTEE', 'EN_PREPARATION') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_STEP', 'message', 'Seule une commande acceptée ou en préparation peut être prête.');
        END IF;
        PERFORM set_config('event_village.order_flow', 'on', true);
        UPDATE public.orders
           SET order_state = 'PRETE', ready_at = now(),
               estimated_at = CASE WHEN delivery_mode::text = 'LIVRAISON' THEN estimated_at ELSE GREATEST(now(), LEAST(estimated_at, scheduled_for)) END,
               updated_at = now()
         WHERE id = o.id;
        PERFORM private.order_log_state(o.id, o.order_state, 'PRETE', v_actor, 'PARTENAIRE', NULL);
        IF o.delivery_mode::text = 'RETRAIT' THEN
            -- Le SMS de l'étape est le code de retrait, envoyé tout de suite par la route ; cloche, push et email ici
            v_code := private.order_issue_code(o.id);
            PERFORM public.order_notify('ORDER_READY', o.id, 'CLIENT', '{}'::jsonb, NULL, ARRAY['IN_APP', 'PUSH', 'EMAIL']);
            RETURN jsonb_build_object('ok', true, 'order_id', o.id, 'order_state', 'PRETE') || private.order_code_delivery(o.id, v_code, 'RETRAIT');
        END IF;
        PERFORM public.order_notify('ORDER_READY', o.id, 'CLIENT');
        RETURN jsonb_build_object('ok', true, 'order_id', o.id, 'order_state', 'PRETE');
    END IF;

    IF v_action = 'CONFIER' THEN
        IF o.delivery_mode::text <> 'LIVRAISON' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NOT_DELIVERY', 'message', 'Cette commande n’est pas à livrer.');
        END IF;
        IF o.order_state NOT IN ('ACCEPTEE', 'EN_PREPARATION', 'PRETE') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_STEP', 'message', 'Le livreur se choisit avant son départ.');
        END IF;
        IF v_courier IS NULL OR NOT EXISTS (
            SELECT 1 FROM public.partner_couriers c JOIN public.users u ON u.id = c.user_id
             WHERE c.partner_id = o.partner_id AND c.user_id = v_courier AND c.status = 'ACTIVE' AND u.status::text = 'ACTIF') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'COURIER_NOT_FOUND', 'message', 'Ce livreur ne fait pas partie de votre équipe.');
        END IF;
        PERFORM set_config('event_village.order_flow', 'on', true);
        UPDATE public.orders SET courier_user_id = v_courier, updated_at = now() WHERE id = o.id;
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
        VALUES (v_actor, 'PARTENAIRE', 'ORDER_COURIER_ASSIGNED', 'orders', o.id,
                jsonb_build_object('courier_user_id', o.courier_user_id), jsonb_build_object('courier_user_id', v_courier));
        IF o.courier_user_id IS NOT NULL AND o.courier_user_id <> v_courier THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'ORDER_COURIER_CANCELLED', 'key', 'ORDER_COURIER_CANCELLED:' || o.id::text || ':' || o.courier_user_id::text || ':' || o.courier_user_id::text,
                'user_id', o.courier_user_id,
                'data', COALESCE(public.order_notif_data(o.id), '{}'::jsonb) || jsonb_build_object('recipient_role', 'COURIER')));
        END IF;
        PERFORM public.order_notify('ORDER_COURIER_ASSIGNED', o.id, 'COURIER', '{}'::jsonb, v_courier::text);
        RETURN jsonb_build_object('ok', true, 'order_id', o.id, 'courier_id', v_courier);
    END IF;

    -- EN_ROUTE : la partenaire livre elle-même (ou fait partir le livreur choisi)
    RETURN private.order_set_en_route(o.id, v_actor, 'PARTENAIRE', v_minutes);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Actions du livreur
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_courier_action(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id uuid := public.try_uuid(p->>'order_id');
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_action   text := upper(COALESCE(p->>'action', ''));
    v_minutes  integer;
    o          record;
BEGIN
    IF v_action NOT IN ('EN_ROUTE', 'REMETTRE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ACTION', 'message', 'Action inconnue.');
    END IF;
    BEGIN
        v_minutes := NULLIF(p->>'minutes', '')::int;
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MINUTES', 'message', 'La durée indiquée n’est pas valable.');
    END;
    IF v_order_id IS NULL OR public.order_lock(v_order_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    SELECT od.*, pa.status::text AS partner_status INTO o
      FROM public.orders od JOIN public.partners pa ON pa.id = od.partner_id
     WHERE od.id = v_order_id FOR UPDATE OF od;
    -- Le livreur de cette commande seulement, membre ACTIF de l'équipe de sa partenaire, compte actif
    IF v_actor IS NULL OR o.courier_user_id IS DISTINCT FROM v_actor
       OR NOT EXISTS (SELECT 1 FROM public.partner_couriers c WHERE c.partner_id = o.partner_id AND c.user_id = v_actor AND c.status = 'ACTIVE')
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    IF o.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'L’établissement est suspendu : ses commandes sont en lecture seule.');
    END IF;
    IF v_action = 'EN_ROUTE' THEN
        RETURN private.order_set_en_route(o.id, v_actor, 'LIVREUR', v_minutes);
    END IF;
    RETURN private.order_handover_apply(o.id, v_actor, 'LIVREUR', NULLIF(p->>'code', ''),
                                       COALESCE(NULLIF(p->>'balance_received', '')::boolean, FALSE));
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Livreurs de la partenaire
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_courier_invite(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_phone  text := regexp_replace(COALESCE(p->>'phone', ''), '[^0-9+]', '', 'g');
    v_max    integer := public.fin_setting_num('orders.courier_invites_per_day')::int;
    v_sent   integer;
    pa       record;
    u        record;
    c        record;
BEGIN
    SELECT * INTO pa FROM public.partners WHERE user_id = v_actor ORDER BY created_at LIMIT 1;
    IF v_actor IS NULL OR NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.users x WHERE x.id = v_actor AND x.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Réservé aux partenaires.');
    END IF;
    IF pa.status::text <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre fiche doit être validée pour gérer votre équipe.');
    END IF;
    IF v_phone !~ '^(\+221|00221|221)?7[0-9]{8}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PHONE', 'message', 'Indiquez un numéro de mobile sénégalais (9 chiffres).');
    END IF;
    -- Invitations au plus par partenaire et par jour (heure de Dakar), sous verrou de la partenaire : réglage
    -- orders.courier_invites_per_day (décision du chef de projet, 21/11)
    PERFORM pg_advisory_xact_lock(hashtextextended('order_courier_invite:' || pa.id::text, 0));
    SELECT count(*) INTO v_sent FROM public.audit_logs l
     WHERE l.action = 'ORDER_COURIER_INVITED' AND l.user_id = v_actor
       AND l.created_at >= (date_trunc('day', now() AT TIME ZONE 'Africa/Dakar') AT TIME ZONE 'Africa/Dakar');
    IF v_sent >= v_max THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_INVITES',
            'message', format('Vous avez déjà envoyé %s invitations aujourd’hui : réessayez demain.', v_sent));
    END IF;
    v_phone := '+221' || right(v_phone, 9);
    SELECT id, first_name, last_name, status::text AS status INTO u FROM public.users WHERE phone = v_phone AND status::text = 'ACTIF' LIMIT 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_FOUND', 'message', 'Aucun compte actif avec ce numéro : la personne doit d’abord créer son compte.');
    END IF;
    IF u.id = v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SELF', 'message', 'Vous livrez déjà vos commandes vous-même : inutile de vous inviter.');
    END IF;
    SELECT * INTO c FROM public.partner_couriers WHERE partner_id = pa.id AND user_id = u.id FOR UPDATE;
    IF FOUND AND c.status = 'ACTIVE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_COURIER', 'message', 'Cette personne livre déjà pour vous.');
    END IF;
    IF FOUND AND c.status = 'PENDING' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_INVITED', 'message', 'Cette personne a déjà une invitation en attente.');
    END IF;
    INSERT INTO public.partner_couriers (partner_id, user_id, status, invited_by, invited_at, responded_at, removed_at)
    VALUES (pa.id, u.id, 'PENDING', v_actor, now(), NULL, NULL)
    ON CONFLICT (partner_id, user_id) DO UPDATE SET status = 'PENDING', invited_by = EXCLUDED.invited_by, invited_at = now(),
                                                   responded_at = NULL, removed_at = NULL
    RETURNING * INTO c;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'ORDER_COURIER_INVITED', 'partner_couriers', c.id, jsonb_build_object('user_id', u.id));
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'ORDER_COURIER_INVITED', 'key', 'ORDER_COURIER_INVITED:' || c.id::text || ':' || extract(epoch FROM c.invited_at)::bigint::text,
        'user_id', u.id, 'actor_id', v_actor,
        'data', jsonb_build_object('invitation_id', c.id, 'partner_name', COALESCE(pa.commercial_name, pa.company_name))));
    -- Contre-vérification (T4) : avant l'accord, le numéro saisi et un nom masqué seulement (comme pour les contrôleurs)
    RETURN jsonb_build_object('ok', true, 'invitation_id', c.id, 'status', 'PENDING', 'phone', v_phone,
                              'display_name', public.team_mask_name(u.first_name, u.last_name));
END;
$$;

CREATE OR REPLACE FUNCTION public.order_courier_respond(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_id    uuid := public.try_uuid(p->>'invitation_id');
    v_ok    boolean;
    c       record;
BEGIN
    IF jsonb_typeof(p->'accept') <> 'boolean' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ANSWER', 'message', 'Acceptez ou refusez l’invitation.');
    END IF;
    v_ok := (p->>'accept')::boolean;
    SELECT * INTO c FROM public.partner_couriers WHERE id = v_id FOR UPDATE;
    IF v_id IS NULL OR NOT FOUND OR c.user_id IS DISTINCT FROM v_actor
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    IF c.status <> 'PENDING' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_ANSWERED', 'message', 'Cette invitation a déjà reçu une réponse.');
    END IF;
    UPDATE public.partner_couriers SET status = CASE WHEN v_ok THEN 'ACTIVE' ELSE 'DECLINED' END, responded_at = now() WHERE id = c.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value)
    VALUES (v_actor, 'LIVREUR', CASE WHEN v_ok THEN 'ORDER_COURIER_ACCEPTED' ELSE 'ORDER_COURIER_DECLINED' END, 'partner_couriers', c.id,
            jsonb_build_object('status', CASE WHEN v_ok THEN 'ACTIVE' ELSE 'DECLINED' END));
    RETURN jsonb_build_object('ok', true, 'invitation_id', c.id, 'status', CASE WHEN v_ok THEN 'ACTIVE' ELSE 'DECLINED' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.order_courier_remove(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_user  uuid := public.try_uuid(p->>'courier_id');
    pa      record;
    c       record;
    r       record;
    v_n     integer := 0;
BEGIN
    SELECT * INTO pa FROM public.partners WHERE user_id = v_actor ORDER BY created_at LIMIT 1;
    IF v_actor IS NULL OR NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.users x WHERE x.id = v_actor AND x.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Réservé aux partenaires.');
    END IF;
    IF pa.status::text <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre fiche doit être validée pour gérer votre équipe.');
    END IF;
    SELECT * INTO c FROM public.partner_couriers WHERE partner_id = pa.id AND user_id = v_user FOR UPDATE;
    IF v_user IS NULL OR NOT FOUND OR c.status IN ('REMOVED', 'DECLINED') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'COURIER_NOT_FOUND', 'message', 'Ce livreur ne fait pas partie de votre équipe.');
    END IF;
    UPDATE public.partner_couriers SET status = 'REMOVED', removed_at = now() WHERE id = c.id;
    -- Commandes pas encore parties : plus confiées à ce livreur (celles en route restent à terminer par la partenaire)
    FOR r IN SELECT id FROM public.orders
              WHERE partner_id = pa.id AND courier_user_id = v_user AND order_state IN ('ACCEPTEE', 'EN_PREPARATION', 'PRETE') LOOP
        PERFORM public.order_lock(r.id);
        PERFORM set_config('event_village.order_flow', 'on', true);
        UPDATE public.orders SET courier_user_id = NULL, updated_at = now() WHERE id = r.id AND courier_user_id = v_user;
        v_n := v_n + 1;
    END LOOP;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'ORDER_COURIER_REMOVED', 'partner_couriers', c.id, jsonb_build_object('user_id', v_user, 'orders_unassigned', v_n));
    RETURN jsonb_build_object('ok', true, 'courier_id', v_user, 'orders_unassigned', v_n);
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Lectures serveur
-- ----------------------------------------------------------------------------
-- Une commande vue par son client, sa partenaire, son livreur ou l'administration ; NULL si elle n'est pas lisible.
-- Adresse, téléphone et consignes : tant qu'ils ne sont pas masqués ; pour le livreur, tant que la commande est ouverte.
CREATE OR REPLACE FUNCTION public.order_view(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id uuid := public.try_uuid(p->>'order_id');
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_as       text := upper(COALESCE(p->>'as', ''));
    o          record;
    v_contact  boolean;
BEGIN
    SELECT od.*, pa.user_id AS owner_id, ve.name AS venue_name, z.name AS zone_name, t.table_number,
           cu.first_name AS courier_first_name
      INTO o
      FROM public.orders od
      JOIN public.partners pa ON pa.id = od.partner_id
      JOIN public.venues ve ON ve.id = od.venue_id
      LEFT JOIN public.order_delivery_zones z ON z.id = od.zone_id
      LEFT JOIN public.restaurant_tables t ON t.id = od.onsite_table_id
      LEFT JOIN public.users cu ON cu.id = od.courier_user_id
     WHERE od.id = v_order_id;
    IF v_order_id IS NULL OR v_actor IS NULL OR NOT FOUND THEN
        RETURN NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN NULL;
    END IF;
    IF v_as = 'CLIENT' AND o.client_id <> v_actor THEN RETURN NULL; END IF;
    -- Contre-vérification (T1) : la partenaire ne lit qu'une commande qui lui a été transmise, coordonnées comprises
    IF v_as = 'PARTNER' AND (o.owner_id <> v_actor OR o.received_at IS NULL) THEN RETURN NULL; END IF;
    IF v_as = 'COURIER' AND (o.courier_user_id IS DISTINCT FROM v_actor
        OR NOT EXISTS (SELECT 1 FROM public.partner_couriers c WHERE c.partner_id = o.partner_id AND c.user_id = v_actor AND c.status = 'ACTIVE')
        OR o.order_state NOT IN ('ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE')) THEN RETURN NULL; END IF;
    IF v_as = 'ADMIN' AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
        RETURN NULL;
    END IF;
    IF v_as NOT IN ('CLIENT', 'PARTNER', 'COURIER', 'ADMIN') THEN RETURN NULL; END IF;
    v_contact := o.contact_masked_at IS NULL;
    RETURN jsonb_strip_nulls(jsonb_build_object(
        'id', o.id, 'order_number', o.order_number, 'state', o.order_state, 'mode', o.delivery_mode::text,
        'payment_type', o.payment_type::text, 'venue', jsonb_build_object('id', o.venue_id, 'name', o.venue_name),
        'asap', o.asap, 'scheduled_for', o.scheduled_for, 'estimated_at', o.estimated_at,
        'steps', jsonb_strip_nulls(jsonb_build_object(
            'received_at', o.received_at, 'accepted_at', o.accepted_at, 'preparing_at', o.preparing_at, 'ready_at', o.ready_at,
            'en_route_at', o.en_route_at, 'handed_over_at', o.handed_over_at, 'closed_at', o.closed_at)),
        'history', (SELECT jsonb_agg(jsonb_build_object('from', h.from_state, 'to', h.to_state, 'at', h.at, 'by', h.actor_role) ORDER BY h.at, h.id)
                      FROM public.order_state_history h WHERE h.order_id = o.id),
        'items', (SELECT jsonb_agg(jsonb_build_object('product_id', i.product_id, 'name', i.product_name, 'quantity', i.quantity,
                                                      'unit_price', i.unit_price, 'total_price', i.total_price, 'options', i.options,
                                                      'notes', i.notes) ORDER BY i.created_at, i.id)
                    FROM public.order_items i WHERE i.order_id = o.id),
        'amounts', jsonb_build_object(
            'items_amount', o.items_amount, 'delivery_fee', o.delivery_fee, 'goods_total', o.goods_total,
            'deposit_percent', o.deposit_percent, 'paid_goods', o.paid_goods, 'paid_fees', o.paid_fees,
            'refunded_amount', o.refunded_amount, 'onsite_amount', o.onsite_amount,
            'balance_due', o.goods_total - o.paid_goods - COALESCE(o.onsite_amount, 0),
            'to_pay_now', CASE WHEN o.order_state = 'EN_ATTENTE_PAIEMENT' THEN o.first_goods + o.first_fee END),
        'zone_name', o.zone_name, 'onsite_label', COALESCE(o.table_number, o.onsite_label),
        'contact', CASE WHEN v_contact AND v_as <> 'ADMIN' THEN jsonb_strip_nulls(jsonb_build_object(
            'address', o.delivery_address, 'phone', o.contact_phone, 'notes', o.delivery_notes)) END,
        'contact_masked', NOT v_contact,
        'courier', CASE WHEN o.courier_user_id IS NOT NULL AND v_as IN ('CLIENT', 'PARTNER')
                        THEN jsonb_build_object('first_name', o.courier_first_name) END,
        'code', CASE WHEN v_as = 'CLIENT' AND o.code_hash IS NOT NULL THEN jsonb_build_object(
            'sent', true, 'resends_left', GREATEST(public.fin_setting_num('orders.code_resend_max')::int - o.code_resends, 0),
            'locked', o.code_attempts >= public.fin_setting_num('orders.code_max_attempts')::int) END,
        'hold_expires_at', CASE WHEN o.order_state = 'EN_ATTENTE_PAIEMENT' THEN o.hold_expires_at END,
        'response_due_at', CASE WHEN o.order_state = 'RECUE' THEN o.response_due_at END,
        'cancel', CASE WHEN o.cancel_origin IS NOT NULL OR o.order_state IN ('REFUSEE', 'SANS_REPONSE', 'NON_RETIREE', 'EXPIREE')
                       THEN jsonb_strip_nulls(jsonb_build_object('origin', o.cancel_origin, 'reason', o.cancel_reason,
                                                                 'refund_percent', o.refund_percent)) END,
        'can_cancel', v_as = 'CLIENT' AND o.order_state IN ('EN_ATTENTE_PAIEMENT', 'RECUE', 'ACCEPTEE'),
        'created_at', o.created_at));
END;
$$;

-- Commandes d'une partenaire (seulement celles qui lui ont été transmises : payées, ou payables à la remise) : ouvertes ou
-- terminées, 200 au plus
CREATE OR REPLACE FUNCTION public.order_partner_list(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_filter text := upper(COALESCE(NULLIF(p->>'filter', ''), 'OPEN'));
    v_list   jsonb;
BEGIN
    IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN '[]'::jsonb;
    END IF;
    SELECT COALESCE(jsonb_agg(public.order_view(jsonb_build_object('order_id', x.id, 'actor_id', v_actor, 'as', 'PARTNER'))
                              ORDER BY x.created_at DESC), '[]'::jsonb)
      INTO v_list
      FROM (SELECT o.id, o.created_at FROM public.orders o JOIN public.partners pa ON pa.id = o.partner_id
             WHERE pa.user_id = v_actor AND o.venue_id IS NOT NULL AND o.received_at IS NOT NULL
               AND (CASE WHEN v_filter = 'CLOSED' THEN o.closed_at IS NOT NULL ELSE o.closed_at IS NULL END)
             ORDER BY o.created_at DESC LIMIT 200) x;
    RETURN v_list;
END;
$$;

-- Livraisons confiées à un livreur (membre ACTIF), en cours seulement
CREATE OR REPLACE FUNCTION public.order_courier_list(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_list  jsonb;
BEGIN
    IF v_actor IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;
    SELECT COALESCE(jsonb_agg(public.order_view(jsonb_build_object('order_id', o.id, 'actor_id', v_actor, 'as', 'COURIER'))
                              ORDER BY o.estimated_at), '[]'::jsonb)
      INTO v_list
      FROM public.orders o
     WHERE o.courier_user_id = v_actor AND o.order_state IN ('ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE')
       AND EXISTS (SELECT 1 FROM public.partner_couriers c WHERE c.partner_id = o.partner_id AND c.user_id = v_actor AND c.status = 'ACTIVE');
    RETURN v_list;
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. Tâche planifiée (/api/cron/orders, toutes les 5 minutes) ; idempotente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_tick()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_holds      integer := 0;
    v_unanswered integer := 0;
    v_warned     integer := 0;
    v_uncollected integer := 0;
    v_masked     integer := 0;
    v_ids        uuid[] := ARRAY[]::uuid[];
    v_grace      interval := public.fin_setting_num('orders.pickup_grace_hours') * interval '1 hour';
    v_warn       interval := LEAST(public.fin_setting_num('orders.pickup_warning_hours'), public.fin_setting_num('orders.pickup_grace_hours') - 1) * interval '1 hour';
    v_keep       interval := public.fin_setting_num('orders.contact_retention_days') * interval '1 day';
    r            record;
    rr           record;
    v_res        jsonb;
BEGIN
    FOR r IN SELECT id, venue_id FROM public.orders
              WHERE order_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at <= now() ORDER BY hold_expires_at LOOP
        PERFORM public.order_venue_lock(r.venue_id);
        IF public.order_expire_hold(r.id) THEN
            v_holds := v_holds + 1;
        END IF;
    END LOOP;

    FOR r IN SELECT id, venue_id FROM public.orders
              WHERE order_state = 'RECUE' AND response_due_at <= now() ORDER BY response_due_at LOOP
        PERFORM public.order_venue_lock(r.venue_id);
        SELECT * INTO rr FROM public.orders WHERE id = r.id FOR UPDATE;
        IF rr.order_state <> 'RECUE' OR rr.response_due_at > now() THEN
            CONTINUE;
        END IF;
        v_res := private.order_close_apply(rr.id, 'SANS_REPONSE', 'SANS_REPONSE', NULL, 'SYSTEM', 'Pas de réponse de l’établissement à temps', 100, TRUE);
        v_ids := v_ids || ARRAY(SELECT jsonb_array_elements_text(v_res->'cashout_ids')::uuid);
        v_unanswered := v_unanswered + 1;
    END LOOP;

    -- Commande prête à retirer : client prévenu avant la clôture, puis close sans remboursement
    FOR r IN SELECT id, venue_id FROM public.orders
              WHERE order_state = 'PRETE' AND delivery_mode::text = 'RETRAIT' AND pickup_warned_at IS NULL
                AND now() >= GREATEST(scheduled_for, ready_at) + v_grace - v_warn LOOP
        PERFORM public.order_venue_lock(r.venue_id);
        SELECT * INTO rr FROM public.orders WHERE id = r.id FOR UPDATE;
        IF rr.order_state <> 'PRETE' OR rr.pickup_warned_at IS NOT NULL THEN
            CONTINUE;
        END IF;
        PERFORM set_config('event_village.order_flow', 'on', true);
        UPDATE public.orders SET pickup_warned_at = now(), updated_at = now() WHERE id = rr.id;
        PERFORM public.order_notify('ORDER_PICKUP_REMINDER', rr.id, 'CLIENT',
            jsonb_build_object('closes_at', GREATEST(rr.scheduled_for, rr.ready_at) + v_grace));
        v_warned := v_warned + 1;
    END LOOP;
    FOR r IN SELECT id, venue_id FROM public.orders
              WHERE order_state = 'PRETE' AND delivery_mode::text = 'RETRAIT' AND now() >= GREATEST(scheduled_for, ready_at) + v_grace LOOP
        PERFORM public.order_venue_lock(r.venue_id);
        SELECT * INTO rr FROM public.orders WHERE id = r.id FOR UPDATE;
        IF rr.order_state <> 'PRETE' OR now() < GREATEST(rr.scheduled_for, rr.ready_at) + v_grace THEN
            CONTINUE;
        END IF;
        PERFORM private.order_close_apply(rr.id, 'NON_RETIREE', NULL, NULL, 'SYSTEM', 'Commande non retirée à temps', 0, FALSE);
        v_uncollected := v_uncollected + 1;
    END LOOP;

    -- Adresse, téléphone et consignes masqués : orders.contact_retention_days après la remise (ou la fin de la commande)
    PERFORM set_config('event_village.order_flow', 'on', true);
    WITH masked AS (
        UPDATE public.orders
           SET delivery_address = NULL, contact_phone = NULL, delivery_notes = NULL, delivery_latitude = NULL,
               delivery_longitude = NULL, contact_masked_at = now(), updated_at = now()
         WHERE venue_id IS NOT NULL AND contact_masked_at IS NULL AND closed_at IS NOT NULL
           AND COALESCE(handed_over_at, closed_at) <= now() - v_keep
        RETURNING id)
    SELECT count(*) INTO v_masked FROM masked;

    RETURN jsonb_build_object('expired_holds', v_holds, 'unanswered', v_unanswered, 'pickup_warnings', v_warned,
                              'not_collected', v_uncollected, 'contacts_masked', v_masked, 'cashout_ids', to_jsonb(v_ids));
END;
$$;

REVOKE ALL ON FUNCTION private.order_refund_payment(uuid, numeric, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_close_apply(uuid, text, text, uuid, text, text, numeric, boolean, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.order_cancel(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.order_issue_code(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_code_delivery(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_set_en_route(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_handover_apply(uuid, uuid, text, text, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.order_code_resend(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_partner_action(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_courier_action(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_courier_invite(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_courier_respond(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_courier_remove(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_view(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_partner_list(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_courier_list(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_cancel(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_code_resend(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_partner_action(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_courier_action(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_courier_invite(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_courier_respond(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_courier_remove(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_view(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_partner_list(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_courier_list(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_tick() TO service_role;


-- Recopie de 20261126000003_l10b_avis.sql:317-645 ; changements : remboursement d'une commande annoncé par l'avis de la
-- commande (pas de PAYMENT_REFUND_STARTED), versement annoncé par ORDER_REFUND_PAID.
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
    -- Lot 10b : réservation de salle du paiement remboursé (avis « Remboursement versé » propre aux salles)
    v_hall_res      uuid;
    v_order_res     uuid;
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
    IF v_refund THEN
        SELECT p.hall_reservation_id INTO v_hall_res FROM public.payments p
         WHERE p.id = NEW.payment_id AND p.payment_target::text = 'HALL_RESERVATION';
        -- Lot 12a : remboursement d'une commande d'établissement (pas une commande de billets)
        SELECT o.id INTO v_order_res FROM public.payments p JOIN public.orders o ON o.id = p.order_id
         WHERE p.id = NEW.payment_id AND p.payment_target::text = 'ORDER' AND o.venue_id IS NOT NULL;
    END IF;

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
       -- Lot 12a : de même pour le remboursement d'une commande (avis de la commande)
       AND v_order_res IS NULL
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
                    -- Lot 10b : remboursement d'une réservation de salle, avis de la salle ; sinon, avis inchangé
                    IF v_hall_res IS NOT NULL THEN
                        PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                            'type', 'HALL_REFUND_PAID',
                            'key', 'HALL_REFUND_PAID:' || NEW.id::text,
                            'user_id', v_user,
                            'phone', v_phone,
                            'data', COALESCE(public.hall_notif_data(v_hall_res), '{}'::jsonb) || v_money
                        )));
                    -- Lot 12a : remboursement d'une commande versé, avis de la commande (étape « remboursée »)
                    ELSIF v_order_res IS NOT NULL THEN
                        PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                            'type', 'ORDER_REFUND_PAID',
                            'key', 'ORDER_REFUND_PAID:' || NEW.id::text,
                            'user_id', v_user,
                            'phone', v_phone,
                            'data', COALESCE(public.order_notif_data(v_order_res), '{}'::jsonb) || jsonb_build_object('recipient_role', 'CLIENT') || v_money
                        )));
                    ELSE
                    PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                        'type', 'REFUND_PAID',
                        'key', 'REFUND_PAID:' || NEW.id::text,
                        'user_id', v_user,
                        'phone', v_phone,
                        'event_id', v_event,
                        'data', v_event_data || v_money
                    )));
                    END IF;
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


