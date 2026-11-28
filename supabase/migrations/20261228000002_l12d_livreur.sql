-- ============================================================================
-- EVENT VILLAGE — LOT 12d, migration 02 : espace du livreur (vue d'une commande, journée, invitation, avis)
-- ============================================================================
-- Relevé de l'existant (état des lieux docs/lot12-etat-des-lieux.md § 4 sur etat/lot12, revérifié le 27/11 sur main
-- f7bf7ad94) : GET /api/courier/orders (order_courier_list : en cours seulement), GET/PATCH /api/courier/orders/[id]
-- (order_view as COURIER, order_courier_action EN_ROUTE et REMETTRE), POST /api/courier/invitations/[id]
-- (order_courier_respond) ; aucune page ; aucune lecture d'une invitation ; le livreur lisait le téléphone du client dès
-- que la commande lui était confiée (avant son départ) ; aucun avis quand le livreur répond à une invitation ni quand il
-- est retiré (inventaire des avis A6 et A7).
--  1. order_view : recopie de 20261130000006_l12a_etapes.sql:843-920 (dernière définition ; aucune autre migration ne la
--     redéfinit). Changements (lignes ajoutées ; lignes remplacées déclarées dans tests/parcours/l12d-statique.test.ts) :
--     a. le livreur lit le téléphone du client seulement pendant la livraison (commande en route) ; l'adresse et les
--        consignes tant que la commande lui est confiée et ouverte (inchangé) ;
--     b. l'établissement porte son adresse (point de départ de l'itinéraire du livreur, adresse publique de la fiche) ;
--     c. absence du client (lot 12d) : heure du signalement, fin de l'attente, phase (ATTENTE, EQUIPE, DECIDEE) et
--        décision ; pour le livreur : appels comptés et « Client absent » possible (deux appels au moins, une fois) ;
--     d. signalement (lot 12d) : dernier signalement (motif, état, heures ; réponse de l'équipe pour le client et
--        l'administration) pour le client, la partenaire et l'administration ; « Signaler un problème » possible pour le
--        client (préparation commencée : en préparation, prête, en route, ou remise depuis moins de 48 h ; aucun
--        signalement ouvert ; 3 au plus par commande).
--  2. order_courier_day(p) : fonction NOUVELLE : livraisons du jour du livreur (en cours par order_view, terminées
--     aujourd'hui sans coordonnées), invitations en attente ; rien d'une équipe dont il n'est pas membre ACTIF.
--  3. order_courier_invitation_view(p) : fonction NOUVELLE : une invitation adressée au compte (établissement, état,
--     heure) ; NULL pour toute autre.
--  4. Avis des livreurs (A6, A7) par déclencheur sur partner_couriers (aucune recopie d'order_courier_respond ni
--     d'order_courier_remove) : réponse à une invitation → la partenaire (cloche, notification du téléphone) ; livreur
--     retiré de l'équipe → le livreur (cloche, notification du téléphone). Prénom et initiale seulement.
-- Fonctions publiques au seul rôle de service ; aides du schéma private à aucun rôle. Rejouable : CREATE OR REPLACE,
-- DROP TRIGGER IF EXISTS puis CREATE, REVOKE et GRANT idempotents. Aucun BEGIN ni COMMIT.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Vue d'une commande (recopie de 20261130000006_l12a_etapes.sql:843-920)
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
    -- Lot 12d : absence du client et signalement
    v_issue    record;
    v_issues   integer := 0;
    v_report   boolean := FALSE;
BEGIN
    SELECT od.*, pa.user_id AS owner_id, ve.name AS venue_name, z.name AS zone_name, t.table_number,
           cu.first_name AS courier_first_name, ve.address AS venue_address
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
    -- Lot 12d : dernier signalement (client, partenaire, administration) et « Signaler un problème » possible (client)
    -- (lu pour tous : un enregistrement jamais rempli ne se lit pas ; le livreur n'en reçoit rien)
    SELECT i.* INTO v_issue FROM public.order_issues i WHERE i.order_id = o.id ORDER BY i.created_at DESC, i.id DESC LIMIT 1;
    SELECT count(*) INTO v_issues FROM public.order_issues i WHERE i.order_id = o.id;
    v_report := v_as = 'CLIENT' AND v_issues < 3 AND (v_issue.id IS NULL OR v_issue.status <> 'OUVERT')
                AND (o.order_state IN ('EN_PREPARATION', 'PRETE', 'EN_ROUTE')
                     OR (o.order_state = 'REMISE' AND o.handed_over_at > now() - interval '48 hours'));
    RETURN jsonb_strip_nulls(jsonb_build_object(
        'id', o.id, 'order_number', o.order_number, 'state', o.order_state, 'mode', o.delivery_mode::text,
        'payment_type', o.payment_type::text, 'venue', jsonb_build_object('id', o.venue_id, 'name', o.venue_name),
        'venue_address', o.venue_address,
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
        -- Lot 12d : le livreur lit le téléphone du client seulement pendant la livraison (en route)
        'contact', CASE WHEN v_contact AND v_as <> 'ADMIN' THEN jsonb_strip_nulls(jsonb_build_object(
            'address', o.delivery_address, 'phone', CASE WHEN v_as <> 'COURIER' OR o.order_state = 'EN_ROUTE' THEN o.contact_phone END,
            'notes', o.delivery_notes)) END,
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
        -- Lot 12d : absence du client (le livreur ne voit pas la décision, seulement la phase)
        'absence', CASE WHEN o.absent_reported_at IS NOT NULL THEN jsonb_strip_nulls(jsonb_build_object(
            'reported_at', o.absent_reported_at, 'wait_until', o.absent_wait_until, 'escalated_at', o.absent_escalated_at,
            'phase', CASE WHEN o.absent_decided_at IS NOT NULL THEN 'DECIDEE' WHEN o.absent_escalated_at IS NOT NULL THEN 'EQUIPE' ELSE 'ATTENTE' END,
            'decision', CASE WHEN v_as <> 'COURIER' THEN o.absent_decision END,
            'decided_at', CASE WHEN v_as <> 'COURIER' THEN o.absent_decided_at END)) END,
        'calls', CASE WHEN v_as IN ('COURIER', 'PARTNER') AND o.delivery_mode::text = 'LIVRAISON' THEN o.delivery_calls END,
        'can_report_absent', v_as IN ('COURIER', 'PARTNER') AND o.order_state = 'EN_ROUTE' AND o.delivery_calls >= 2 AND o.absent_reported_at IS NULL,
        -- Lot 12d : signalement du client
        'issue', CASE WHEN v_issue.id IS NOT NULL AND v_as <> 'COURIER' THEN jsonb_strip_nulls(jsonb_build_object(
            'id', v_issue.id, 'reason', v_issue.reason, 'status', v_issue.status, 'created_at', v_issue.created_at,
            'details', CASE WHEN v_as IN ('CLIENT', 'ADMIN') THEN v_issue.details END,
            'closed_at', v_issue.closed_at,
            'close_note', CASE WHEN v_as IN ('CLIENT', 'ADMIN') THEN v_issue.close_note END)) END,
        'can_report', v_report,
        'created_at', o.created_at));
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Journée du livreur
-- ----------------------------------------------------------------------------
-- p : actor_id. Rend { active: [vue de chaque livraison en cours], done: [livraisons terminées aujourd'hui, heure de Dakar,
-- sans adresse ni téléphone], invitations: [invitations en attente] }. Seulement les équipes dont le compte est livreur
-- ACTIF ; compte non ACTIF : tout vide.
CREATE OR REPLACE FUNCTION public.order_courier_day(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_start  timestamptz := date_trunc('day', now() AT TIME ZONE 'Africa/Dakar') AT TIME ZONE 'Africa/Dakar';
    v_active jsonb;
    v_done   jsonb;
    v_inv    jsonb;
BEGIN
    IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('active', '[]'::jsonb, 'done', '[]'::jsonb, 'invitations', '[]'::jsonb);
    END IF;
    v_active := public.order_courier_list(jsonb_build_object('actor_id', v_actor));
    SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', o.id, 'order_number', o.order_number, 'state', o.order_state, 'mode', o.delivery_mode::text,
               'venue', jsonb_build_object('id', o.venue_id, 'name', ve.name), 'zone_name', z.name,
               'handed_over_at', o.handed_over_at, 'closed_at', o.closed_at, 'onsite_amount', o.onsite_amount,
               'collected_by_me', o.onsite_recorded_by = v_actor))
             ORDER BY o.closed_at DESC), '[]'::jsonb)
      INTO v_done
      FROM public.orders o
      JOIN public.venues ve ON ve.id = o.venue_id
      LEFT JOIN public.order_delivery_zones z ON z.id = o.zone_id
     WHERE o.courier_user_id = v_actor AND o.closed_at >= v_start AND o.venue_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.partner_couriers c WHERE c.partner_id = o.partner_id AND c.user_id = v_actor AND c.status = 'ACTIVE');
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'partner_name', COALESCE(pa.commercial_name, pa.company_name),
                                                 'invited_at', c.invited_at) ORDER BY c.invited_at DESC), '[]'::jsonb)
      INTO v_inv
      FROM public.partner_couriers c JOIN public.partners pa ON pa.id = c.partner_id
     WHERE c.user_id = v_actor AND c.status = 'PENDING';
    RETURN jsonb_build_object('active', COALESCE(v_active, '[]'::jsonb), 'done', v_done, 'invitations', v_inv);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Une invitation adressée au compte
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_courier_invitation_view(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_id    uuid := public.try_uuid(p->>'invitation_id');
    c       record;
BEGIN
    IF v_actor IS NULL OR v_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN NULL;
    END IF;
    SELECT pc.id, pc.status, pc.invited_at, pc.responded_at, COALESCE(pa.commercial_name, pa.company_name) AS partner_name,
           (SELECT COALESCE(jsonb_agg(ve.name ORDER BY ve.name), '[]'::jsonb) FROM public.venues ve
             WHERE ve.partner_id = pa.id AND ve.is_active AND ve.validation_status = 'VALIDEE') AS venues
      INTO c
      FROM public.partner_couriers pc JOIN public.partners pa ON pa.id = pc.partner_id
     WHERE pc.id = v_id AND pc.user_id = v_actor;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    RETURN jsonb_strip_nulls(jsonb_build_object('id', c.id, 'status', c.status, 'partner_name', c.partner_name,
                                                'venues', c.venues, 'invited_at', c.invited_at, 'responded_at', c.responded_at));
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Avis des livreurs (A6, A7) : déclencheur sur partner_couriers
-- ----------------------------------------------------------------------------
-- Prénom et initiale du nom (« Moussa D. ») : jamais le nom entier dans un avis
CREATE OR REPLACE FUNCTION private.order_person_short(p_first text, p_last text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT NULLIF(btrim(concat_ws(' ', NULLIF(btrim(COALESCE(p_first, '')), ''),
                                  CASE WHEN NULLIF(btrim(COALESCE(p_last, '')), '') IS NOT NULL
                                       THEN upper(left(btrim(p_last), 1)) || '.' END)), '');
$$;

CREATE OR REPLACE FUNCTION private.order_courier_status_notify()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner   uuid;
    v_partner text;
    v_name    text;
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;
    SELECT pa.user_id, COALESCE(pa.commercial_name, pa.company_name) INTO v_owner, v_partner
      FROM public.partners pa WHERE pa.id = NEW.partner_id;
    -- A6 : le livreur répond à une invitation → la partenaire (cloche, notification du téléphone)
    IF OLD.status = 'PENDING' AND NEW.status IN ('ACTIVE', 'DECLINED') AND v_owner IS NOT NULL THEN
        SELECT private.order_person_short(u.first_name, u.last_name) INTO v_name FROM public.users u WHERE u.id = NEW.user_id;
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'ORDER_COURIER_ANSWERED',
            'key', 'ORDER_COURIER_ANSWERED:' || NEW.id::text || ':' || extract(epoch FROM COALESCE(NEW.responded_at, now()))::bigint::text,
            'user_id', v_owner, 'actor_id', NEW.user_id,
            'data', jsonb_strip_nulls(jsonb_build_object('invitation_id', NEW.id, 'accepted', NEW.status = 'ACTIVE',
                                                         'courier_name', v_name))));
    END IF;
    -- A7 : livreur retiré de l'équipe → le livreur (cloche, notification du téléphone)
    IF OLD.status = 'ACTIVE' AND NEW.status = 'REMOVED' THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'ORDER_COURIER_REMOVED',
            'key', 'ORDER_COURIER_REMOVED:' || NEW.id::text || ':' || extract(epoch FROM COALESCE(NEW.removed_at, now()))::bigint::text,
            'user_id', NEW.user_id, 'actor_id', v_owner,
            'data', jsonb_strip_nulls(jsonb_build_object('invitation_id', NEW.id, 'partner_name', v_partner))));
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_couriers_status_notify ON public.partner_couriers;
CREATE TRIGGER trg_partner_couriers_status_notify
    AFTER UPDATE OF status ON public.partner_couriers
    FOR EACH ROW EXECUTE FUNCTION private.order_courier_status_notify();

-- ----------------------------------------------------------------------------
-- 5. Droits
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.order_view(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_courier_day(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_courier_invitation_view(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.order_person_short(text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_courier_status_notify() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.order_view(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_courier_day(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_courier_invitation_view(jsonb) TO service_role;
