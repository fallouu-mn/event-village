-- ============================================================================
-- EVENT VILLAGE — LOT 12d, migration 04 : administration des commandes (liste paginée, fiche)
-- ============================================================================
-- Relevé de l'existant : l'administration ne voyait les commandes que dans l'onglet « Commandes » de
-- app/admin/services/page.tsx (lecture REST de l'ancien order_status, sans établissement, sans pagination par la base,
-- app/api/admin/services/route.ts) ; POST /api/admin/orders/[id]/cancel existait sans écran.
--  1. order_admin_list(p) : fonction NOUVELLE ; droits payments.read ou refunds.manage (ou super-administrateur) ;
--     filtres : groupe (A_DECIDER : client absent en attente de l'équipe ou signalement ouvert ; EN_COURS ; TERMINEES ;
--     ANNULEES ; NON_PAYEES ; TOUTES) ou état détaillé exact, recherche (numéro de commande, nom de l'établissement ou de
--     la partenaire), page (20 par page, 50 au plus) ; rend le total, la page et les lignes (numéro, état, mode,
--     établissement, partenaire, heures, total, payé, remboursé, signalement ouvert, absence) ; le nom du client
--     seulement avec users.read (prénom et initiale sinon) ;
--  2. order_admin_view(p) : fonction NOUVELLE ; mêmes droits ; la vue de l'administration (order_view as ADMIN) plus :
--     historique des étapes avec les notes, paiements (part, montant, état, opérateur, heure ; jamais le numéro du payeur
--     sans users.read), remboursements, signalements, client (nom et numéro, adresse et consignes de livraison avec
--     users.read seulement, tant qu'ils ne sont pas masqués), montant remboursable (servi par la base : aucun calcul dans
--     le navigateur), actions permises (annuler et rembourser, décider d'une absence, traiter un signalement : refunds.manage).
-- Fonctions au seul rôle de service. Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents. Aucun BEGIN ni COMMIT.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.order_admin_list(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_group  text := upper(COALESCE(NULLIF(p->>'group', ''), 'TOUTES'));
    v_state  text := NULLIF(upper(COALESCE(p->>'state', '')), '');
    v_q      text := NULLIF(left(btrim(COALESCE(p->>'q', '')), 80), '');
    v_page   integer;
    v_size   integer;
    v_people boolean;
    v_total  integer;
    v_items  jsonb;
BEGIN
    IF NOT private.order_admin_allowed(v_actor, ARRAY['payments.read', 'refunds.manage']) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit de voir les commandes.');
    END IF;
    IF v_group NOT IN ('A_DECIDER', 'EN_COURS', 'TERMINEES', 'ANNULEES', 'NON_PAYEES', 'TOUTES') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Filtre inconnu.');
    END IF;
    IF v_state IS NOT NULL AND v_state NOT IN ('EN_ATTENTE_PAIEMENT', 'RECUE', 'ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE', 'REMISE',
                                               'NON_RETIREE', 'EXPIREE', 'REFUSEE', 'SANS_REPONSE', 'ANNULEE_CLIENT', 'ANNULEE_PARTENAIRE', 'ANNULEE_EV') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Filtre inconnu.');
    END IF;
    BEGIN
        v_page := GREATEST(COALESCE(NULLIF(p->>'page', '')::int, 1), 1);
        v_size := LEAST(GREATEST(COALESCE(NULLIF(p->>'page_size', '')::int, 20), 1), 50);
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Page inconnue.');
    END;
    v_people := private.order_admin_allowed(v_actor, ARRAY['users.read']);

    WITH base AS (
        SELECT o.*, ve.name AS venue_name, COALESCE(pa.commercial_name, pa.company_name) AS partner_name,
               cl.first_name AS client_first, cl.last_name AS client_last,
               EXISTS (SELECT 1 FROM public.order_issues i WHERE i.order_id = o.id AND i.status = 'OUVERT') AS issue_open
          FROM public.orders o
          JOIN public.venues ve ON ve.id = o.venue_id
          JOIN public.partners pa ON pa.id = o.partner_id
          LEFT JOIN public.users cl ON cl.id = o.client_id
         WHERE o.venue_id IS NOT NULL
           AND (v_state IS NULL OR o.order_state = v_state)
           AND (v_q IS NULL OR o.order_number ILIKE '%' || v_q || '%' OR ve.name ILIKE '%' || v_q || '%'
                OR COALESCE(pa.commercial_name, pa.company_name, '') ILIKE '%' || v_q || '%')
    ), filtered AS (
        SELECT * FROM base b
         WHERE CASE v_group
                   WHEN 'A_DECIDER' THEN (b.order_state = 'EN_ROUTE' AND b.absent_escalated_at IS NOT NULL AND b.absent_decided_at IS NULL) OR b.issue_open
                   WHEN 'EN_COURS' THEN b.order_state IN ('RECUE', 'ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE')
                   WHEN 'TERMINEES' THEN b.order_state IN ('REMISE', 'NON_RETIREE')
                   WHEN 'ANNULEES' THEN b.order_state IN ('REFUSEE', 'SANS_REPONSE', 'ANNULEE_CLIENT', 'ANNULEE_PARTENAIRE', 'ANNULEE_EV')
                   WHEN 'NON_PAYEES' THEN b.order_state IN ('EN_ATTENTE_PAIEMENT', 'EXPIREE')
                   ELSE TRUE END
    )
    SELECT (SELECT count(*) FROM filtered),
           COALESCE((SELECT jsonb_agg(x.item ORDER BY x.created_at DESC, x.id) FROM (
               SELECT f.created_at, f.id, jsonb_strip_nulls(jsonb_build_object(
                   'id', f.id, 'order_number', f.order_number, 'state', f.order_state, 'mode', f.delivery_mode::text,
                   'venue_name', f.venue_name, 'partner_name', f.partner_name,
                   'client_name', CASE WHEN v_people THEN NULLIF(btrim(concat_ws(' ', f.client_first, f.client_last)), '')
                                       ELSE private.order_person_short(f.client_first, f.client_last) END,
                   'created_at', f.created_at, 'scheduled_for', f.scheduled_for, 'closed_at', f.closed_at,
                   'goods_total', f.goods_total, 'paid', f.paid_goods + f.paid_fees, 'refunded', f.refunded_amount,
                   'issue_open', f.issue_open,
                   'absence', CASE WHEN f.absent_reported_at IS NOT NULL THEN
                                   CASE WHEN f.absent_decided_at IS NOT NULL THEN 'DECIDEE' WHEN f.absent_escalated_at IS NOT NULL THEN 'EQUIPE' ELSE 'ATTENTE' END END,
                   'to_decide', (f.order_state = 'EN_ROUTE' AND f.absent_escalated_at IS NOT NULL AND f.absent_decided_at IS NULL) OR f.issue_open
               )) AS item
                 FROM filtered f ORDER BY f.created_at DESC, f.id
                OFFSET (v_page - 1) * v_size LIMIT v_size) x), '[]'::jsonb)
      INTO v_total, v_items;

    RETURN jsonb_build_object('ok', true, 'total', v_total, 'page', v_page, 'page_size', v_size,
                              'pages', GREATEST(ceil(v_total::numeric / v_size)::int, 1), 'items', v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.order_admin_view(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_id      uuid := public.try_uuid(p->>'order_id');
    v_view    jsonb;
    v_people  boolean;
    v_manage  boolean;
    o         record;
    v_open    boolean;
BEGIN
    IF NOT private.order_admin_allowed(v_actor, ARRAY['payments.read', 'refunds.manage']) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit de voir les commandes.');
    END IF;
    v_view := public.order_view(jsonb_build_object('order_id', v_id, 'actor_id', v_actor, 'as', 'ADMIN'));
    IF v_view IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable.');
    END IF;
    SELECT od.*, cl.first_name AS client_first, cl.last_name AS client_last, cl.phone AS client_phone,
           ve.name AS venue_name, COALESCE(pa.commercial_name, pa.company_name) AS partner_name,
           cu.first_name AS courier_first, cu.last_name AS courier_last
      INTO o
      FROM public.orders od
      JOIN public.venues ve ON ve.id = od.venue_id
      JOIN public.partners pa ON pa.id = od.partner_id
      LEFT JOIN public.users cl ON cl.id = od.client_id
      LEFT JOIN public.users cu ON cu.id = od.courier_user_id
     WHERE od.id = v_id;
    v_people := private.order_admin_allowed(v_actor, ARRAY['users.read']);
    v_manage := private.order_admin_allowed(v_actor, ARRAY['refunds.manage']);
    v_open := o.order_state IN ('EN_ATTENTE_PAIEMENT', 'RECUE', 'ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE');

    RETURN jsonb_build_object('ok', true, 'order', v_view || jsonb_strip_nulls(jsonb_build_object(
        'partner_name', o.partner_name,
        'client', jsonb_strip_nulls(jsonb_build_object(
            'name', CASE WHEN v_people THEN NULLIF(btrim(concat_ws(' ', o.client_first, o.client_last)), '')
                         ELSE private.order_person_short(o.client_first, o.client_last) END,
            'phone', CASE WHEN v_people THEN o.client_phone END)),
        'admin_contact', CASE WHEN v_people AND o.contact_masked_at IS NULL THEN jsonb_strip_nulls(jsonb_build_object(
            'address', o.delivery_address, 'phone', o.contact_phone, 'notes', o.delivery_notes)) END,
        'people_visible', v_people,
        'courier_name', CASE WHEN o.courier_user_id IS NOT NULL THEN private.order_person_short(o.courier_first, o.courier_last) END,
        'timeline', (SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('from', h.from_state, 'to', h.to_state, 'at', h.at,
                                                                           'by', h.actor_role, 'note', h.note)) ORDER BY h.at, h.id)
                       FROM public.order_state_history h WHERE h.order_id = o.id),
        'payments', (SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                             'id', pp.id, 'part', pp.metadata->>'part', 'amount', pp.amount, 'status', pp.status::text,
                             'operator', pp.operator::text, 'created_at', pp.created_at, 'paid_at', pp.paid_at,
                             'payer_phone', CASE WHEN v_people THEN pp.payer_phone END)) ORDER BY pp.created_at, pp.id)
                       FROM public.payments pp WHERE pp.order_id = o.id),
        'refunds', (SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                            'id', f.id, 'amount', f.amount, 'status', f.status::text, 'reason', f.reason, 'created_at', f.created_at,
                            'cashout_status', c.status::text)) ORDER BY f.created_at, f.id)
                      FROM public.refunds f JOIN public.payments pp ON pp.id = f.payment_id
                      LEFT JOIN public.cashouts c ON c.id = f.cashout_id
                     WHERE pp.order_id = o.id),
        'issues', (SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                           'id', i.id, 'reason', i.reason, 'details', i.details, 'status', i.status, 'created_at', i.created_at,
                           'closed_at', i.closed_at, 'close_note', i.close_note)) ORDER BY i.created_at DESC, i.id)
                     FROM public.order_issues i WHERE i.order_id = o.id),
        'refundable', CASE WHEN v_open THEN o.paid_goods + o.paid_fees - o.refunded_amount ELSE 0 END,
        'can_cancel', v_manage AND v_open,
        'can_decide_absence', v_manage AND o.order_state = 'EN_ROUTE' AND o.absent_escalated_at IS NOT NULL AND o.absent_decided_at IS NULL,
        'can_close_issue', v_manage AND EXISTS (SELECT 1 FROM public.order_issues i WHERE i.order_id = o.id AND i.status = 'OUVERT'))));
END;
$$;

REVOKE ALL ON FUNCTION public.order_admin_list(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_admin_view(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_admin_list(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_admin_view(jsonb) TO service_role;
