-- ============================================================================
-- Lot 11c-c — tables d'un événement : lecture des écrans de l'organisatrice, du pilotage et de l'administration
-- ============================================================================
-- Aucune donnée existante ne disait, par table vendue, qui en est titulaire, combien de places sont envoyées et entrées,
-- ni quelles tables ont été remboursées, ni quand des changements ont été signalés après validation. Cette migration
-- AJOUTE deux fonctions de lecture ; elle ne recopie et ne modifie aucune fonction, table, politique ni donnée.
--
--   private.event_table_edit_refusal(p_event, p_actor) : pourquoi l'organisatrice ne peut pas modifier ses tables
--     maintenant (NULL si elle le peut). Mêmes refus, mêmes codes et même ordre que private.event_table_refusal
--     (20261201000003_l11c_configuration.sql) et public.ticket_category_guard (20261116000001_f2a_fiche_suspendue.sql),
--     sans aucun verrou (lecture). Seul le texte d'un événement en attente de validation est propre à l'écran des tables.
--   public.event_table_report(p jsonb) : { event_id, actor_id }. Accès du pilotage (pilotage_access : propriétaire, ou
--     administration avec events.read ; un tiers reçoit EVENT_NOT_FOUND). Rend l'état de l'événement, la jauge en places
--     (private.event_seats_gauge, la règle unique de la base), les types (prix par personne et frais par
--     private.event_table_prices), les tables et leur état, les zones, chaque vente (titulaire en prénom et initiale,
--     places envoyées, en attente, à envoyer, entrées, par private.event_table_seats), les totaux, et :
--       - pour la propriétaire : edit_refusal et les événements précédents copiables (copy_sources) ;
--       - pour l'administration : l'historique des signalements ADMIN_EVENT_TABLES_CHANGED (boîte d'envoi).
--     Jamais de téléphone, de courriel ni de nom complet.
--
-- Réservées au rôle de service (l'aide dans le schéma private, hors de l'API). Rejouable, sans BEGIN ni COMMIT.

-- ----------------------------------------------------------------------------
-- 1. Refus d'écriture des tables, sans verrou
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.event_table_edit_refusal(p_event uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status text;
    a record;
BEGIN
    IF NOT public.fin_setting_bool('features.event_tables_enabled') THEN
        RETURN jsonb_build_object('code', 'SERVICE_UNAVAILABLE', 'message', 'La vente de tables n’est pas encore ouverte sur Event Village.');
    END IF;
    IF public.partner_owner_suspended(p_event, p_actor) THEN
        RETURN jsonb_build_object('code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    SELECT e.status::text INTO v_status FROM public.events e WHERE e.id = p_event;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(p_event, p_actor);
    IF NOT COALESCE(a.is_owner, FALSE) THEN
        IF COALESCE(a.is_staff, FALSE) THEN
            RETURN jsonb_build_object('code', 'ADMIN_CANNOT_EDIT', 'message', 'Seul l’organisateur modifie les tables de son événement.');
        END IF;
        RETURN jsonb_build_object('code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF NOT COALESCE(a.is_active, FALSE) THEN
        RETURN jsonb_build_object('code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;
    IF v_status IN ('TERMINE', 'ANNULE') THEN
        RETURN jsonb_build_object('code', 'EVENT_LOCKED', 'message', 'Un événement terminé ou annulé ne se modifie plus : ses tables restent en lecture.');
    END IF;
    IF v_status = 'EN_ATTENTE' THEN
        RETURN jsonb_build_object('code', 'WITHDRAW_TO_EDIT', 'message', 'Retirez l’événement de la validation pour modifier ses tables.');
    END IF;
    IF v_status = 'SUSPENDU' THEN
        RETURN jsonb_build_object('code', 'EVENT_SUSPENDED', 'message', 'Cet événement est suspendu : ses tables ne se modifient plus. Contactez le support.');
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.event_table_edit_refusal(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Lecture des écrans (éditeur, pilotage, administration)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_table_report(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event    uuid := public.try_uuid(p->>'event_id');
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_code     text;
    v_owner    boolean;
    v_status   text;
    v_capacity integer;
    v_partner  uuid;
    v_seats    integer;
    v_tables   integer;
    v_tickets  integer;
    v_bookings jsonb;
    v_out      jsonb;
BEGIN
    v_code := public.pilotage_access(v_event, v_actor);
    IF v_code IS NOT NULL THEN
        RETURN public.pilotage_refusal(v_code);
    END IF;
    SELECT e.status::text, e.capacity, e.partner_id INTO v_status, v_capacity, v_partner FROM public.events e WHERE e.id = v_event;
    SELECT COALESCE(f.is_owner, FALSE) INTO v_owner FROM public.event_actor_profile_perm(v_event, v_actor, 'events.read') f;
    v_seats := private.event_seats_gauge(v_event);
    v_tables := private.event_seats_gauge(v_event, NULL, 'TABLE');
    v_tickets := private.event_seats_gauge(v_event, NULL, 'TICKET');

    SELECT COALESCE(jsonb_agg(x.item ORDER BY x.table_number, x.created_at), '[]'::jsonb) INTO v_bookings
      FROM (
        SELECT b.table_number, b.created_at, jsonb_build_object(
                   'table_number', b.table_number, 'table_id', b.event_table_id, 'type_id', b.category_id, 'type_name', c.name,
                   'zone', z.name, 'seats', b.seats, 'status', b.status, 'refund_origin', b.refund_origin,
                   'sold_at', b.created_at, 'refunded_at', b.refunded_at,
                   'holder', private.event_table_person(b.holder_id),
                   'price', pay.facial_amount,
                   'counts', (SELECT jsonb_build_object(
                                  'sent', count(*) FILTER (WHERE s->>'state' = 'ENVOYEE'),
                                  'pending', count(*) FILTER (WHERE s->>'state' = 'EN_ATTENTE'),
                                  'to_send', count(*) FILTER (WHERE s->>'state' = 'A_ENVOYER'),
                                  'entered', count(*) FILTER (WHERE s->>'state' = 'ENTREE'),
                                  'given', count(*) FILTER (WHERE s->>'state' = 'ENVOYEE' OR (s->>'state' = 'ENTREE' AND (s->>'mine')::boolean IS NOT TRUE)))
                                FROM jsonb_array_elements(private.event_table_seats(b.id)) s)) AS item
          FROM public.event_table_bookings b
          JOIN public.ticket_categories c ON c.id = b.category_id
          JOIN public.payments pay ON pay.id = b.payment_id
          JOIN public.event_tables t ON t.id = b.event_table_id
          LEFT JOIN public.event_zones z ON z.id = t.zone_id
         WHERE b.event_id = v_event
      ) x;

    v_out := jsonb_build_object(
        'ok', true, 'event_id', v_event, 'event_status', v_status, 'viewer', CASE WHEN v_owner THEN 'OWNER' ELSE 'STAFF' END,
        'service_open', public.fin_setting_bool('features.event_tables_enabled'),
        'plan_enabled', COALESCE((SELECT pl.plan_enabled FROM public.event_table_plans pl WHERE pl.event_id = v_event), FALSE),
        'gauge', jsonb_build_object('capacity', v_capacity, 'seats', v_seats, 'table_seats', v_tables, 'ticket_seats', v_tickets,
                                    'free', CASE WHEN v_capacity IS NULL THEN NULL ELSE GREATEST(v_capacity - v_seats, 0) END),
        'types', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                      'id', c.id, 'name', c.name, 'included_text', c.included_text, 'onsite_note', c.onsite_note,
                      'payment_mode', c.payment_mode, 'is_active', c.is_active, 'sale_start', c.sale_start, 'sale_end', c.sale_end,
                      'scan_color', c.scan_color, 'entry_instruction', c.entry_instruction,
                      'total_tables', c.total_quantity, 'sold_tables', c.sold_quantity, 'held_tables', c.held_quantity,
                      'free_tables', (SELECT count(*) FROM public.event_tables t WHERE t.category_id = c.id AND private.event_table_state(t.id) = 'LIBRE'),
                      'type_seats', c.total_quantity * c.seats_per_unit,
                      'locked', c.sold_quantity > 0 OR c.held_quantity > 0,
                      'ever_sold', EXISTS (SELECT 1 FROM public.event_table_bookings b WHERE b.category_id = c.id)) || private.event_table_prices(c.id, NULL)
                    ORDER BY c.created_at, c.id), '[]'::jsonb)
                    FROM public.ticket_categories c WHERE c.event_id = v_event AND c.kind = 'TABLE'),
        'tables', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       'id', t.id, 'number', t.number, 'type_id', t.category_id, 'zone_id', t.zone_id, 'x', t.plan_x, 'y', t.plan_y,
                       'shape', t.plan_shape, 'rotation', t.plan_rotation, 'state', private.event_table_state(t.id),
                       'ever_sold', EXISTS (SELECT 1 FROM public.event_table_bookings b WHERE b.event_table_id = t.id))
                     ORDER BY t.number), '[]'::jsonb)
                     FROM public.event_tables t WHERE t.event_id = v_event),
        'zones', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', z.id, 'name', z.name, 'x', z.plan_x, 'y', z.plan_y, 'w', z.plan_w, 'h', z.plan_h)
                    ORDER BY z.name), '[]'::jsonb)
                    FROM public.event_zones z WHERE z.event_id = v_event),
        'bookings', v_bookings,
        'totals', jsonb_build_object(
            'tables', (SELECT count(*) FROM public.event_tables t WHERE t.event_id = v_event),
            'placed', (SELECT count(*) FROM public.event_tables t WHERE t.event_id = v_event AND t.plan_x IS NOT NULL),
            'unplaced', (SELECT count(*) FROM public.event_tables t WHERE t.event_id = v_event AND t.plan_x IS NULL),
            'free', (SELECT count(*) FROM public.event_tables t WHERE t.event_id = v_event AND private.event_table_state(t.id) = 'LIBRE'),
            'held', (SELECT count(*) FROM public.event_tables t WHERE t.event_id = v_event AND private.event_table_state(t.id) = 'EN_ATTENTE'),
            'sold', (SELECT count(*) FROM public.event_table_bookings b WHERE b.event_id = v_event AND b.status = 'ACTIVE'),
            'sold_seats', (SELECT COALESCE(sum(b.seats), 0) FROM public.event_table_bookings b WHERE b.event_id = v_event AND b.status = 'ACTIVE'),
            'entered_seats', (SELECT count(*) FROM public.tickets tk JOIN public.event_table_bookings b ON b.id = tk.event_table_booking_id
                               WHERE b.event_id = v_event AND b.status = 'ACTIVE' AND tk.status::text = 'UTILISE'),
            'revenue', (SELECT COALESCE(sum(pay.facial_amount), 0) FROM public.event_table_bookings b JOIN public.payments pay ON pay.id = b.payment_id
                         WHERE b.event_id = v_event AND b.status = 'ACTIVE'),
            'refunded', (SELECT count(*) FROM public.event_table_bookings b WHERE b.event_id = v_event AND b.status = 'REFUNDED'),
            'refunded_amount', (SELECT COALESCE(sum(pay.facial_amount), 0) FROM public.event_table_bookings b JOIN public.payments pay ON pay.id = b.payment_id
                                 WHERE b.event_id = v_event AND b.status = 'REFUNDED')),
        'read_at', now());

    IF v_owner THEN
        v_out := v_out || jsonb_build_object(
            'edit_refusal', private.event_table_edit_refusal(v_event, v_actor),
            'copy_sources', (SELECT COALESCE(jsonb_agg(s.item ORDER BY s.start_at DESC NULLS LAST), '[]'::jsonb)
                               FROM (SELECT public.event_start_at(e.id) AS start_at,
                                            jsonb_build_object('event_id', e.id, 'title', e.title, 'start_at', public.event_start_at(e.id),
                                                               'types', (SELECT count(*) FROM public.ticket_categories c WHERE c.event_id = e.id AND c.kind = 'TABLE'),
                                                               'tables', (SELECT count(*) FROM public.event_tables t WHERE t.event_id = e.id)) AS item
                                       FROM public.events e
                                      WHERE e.partner_id = v_partner AND e.id <> v_event
                                        AND EXISTS (SELECT 1 FROM public.event_tables t WHERE t.event_id = e.id)
                                      ORDER BY public.event_start_at(e.id) DESC NULLS LAST
                                      LIMIT 10) s));
    ELSE
        v_out := v_out || jsonb_build_object(
            'edit_refusal', jsonb_build_object('code', 'ADMIN_CANNOT_EDIT', 'message', 'Seul l’organisateur modifie les tables de son événement.'),
            'changes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('at', g.at) ORDER BY g.at DESC), '[]'::jsonb)
                          FROM (SELECT min(o.created_at) AS at
                                  FROM public.notification_outbox o
                                 WHERE o.type = 'ADMIN_EVENT_TABLES_CHANGED' AND o.event_id = v_event
                                 GROUP BY substring(o.idempotency_key FROM ':tx([0-9]+)')
                                 ORDER BY 1 DESC
                                 LIMIT 50) g));
    END IF;
    RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.event_table_report(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_report(jsonb) TO service_role;
COMMENT ON FUNCTION public.event_table_report(jsonb) IS
    'Lot 11c-c : lecture des tables d''un événement pour l''éditeur, le pilotage et l''administration (pilotage_access). Titulaires en prénom et initiale seulement.';
