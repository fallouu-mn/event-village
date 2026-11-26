-- ============================================================================
-- Lot 11c-c — correctifs de la contre-vérification (docs/audit-lot11c-c.md, lot11c/cv-rouges-c f6a50fac74)
-- ============================================================================
--  T1. Liste de la porte : public.event_table_door_list (recopie de 20261201000004_l11c_vente.sql:1018-1050). Hors de la
--      plage du contrôle (public.scan_event_problem : pas encore ouvert, terminé, suspendu, annulé), un lecteur qui n'est
--      ni la propriétaire ni un administrateur muni de events.read reçoit CONTROL_CLOSED (problem, opens_at) et aucune
--      donnée : même règle et même réponse que public.ticket_guest_list_search (finition 1, complément 10). Un
--      administrateur qui n'a que le droit de scanner est traité comme un contrôleur (décision).
--  T2, T3. Copie des tables d'un événement précédent : public.event_table_copy (NOUVELLE), une seule transaction. Verrou
--      de l'événement cible et de ses catégories (private.event_table_refusal), vérification SOUS ce verrou que la cible
--      n'a ni type ni table de table (sinon TABLES_NOT_EMPTY), source de la même organisatrice, types et tables créés
--      (numéros, positions, formes, rotations de la source ; état de vente de la source gardé, décision), jauge en places
--      (private.event_seats_refusal) ; au moindre refus, rien n'est écrit et aucun avis ne part (les avis du déclencheur
--      sont annulés avec le reste). Après validation, UN avis ADMIN_EVENT_TABLES_CHANGED (une transaction) et une ligne
--      d'historique « Plan copié depuis … » (journal EVENT_TABLES_COPIED, lu par event_table_report).
--  T4. Textes des refus d'écriture des tables : un seul endroit, private.event_table_refusal_message (NOUVELLE), lu par
--      private.event_table_edit_refusal (recopie de 20261215000001_l11cc_lectures_tables.sql:26-68), qui devient la
--      règle unique : private.event_table_refusal (recopie de 20261201000003_l11c_configuration.sql:28-52) prend les
--      mêmes verrous que public.ticket_category_guard (événement, puis ses catégories) puis rend ce refus. Textes
--      gardés : ceux que l'écriture rendait déjà (public.ticket_category_guard, 20261116000001_f2a_fiche_suspendue.sql,
--      et private.event_table_refusal) ; l'écran les affiche désormais à l'identique.
--  T5. Suppression d'un type : règle unique private.event_table_type_delete_refusal (NOUVELLE), appelée par
--      public.event_table_type_delete (recopie de 20261201000003_l11c_configuration.sql:296-333) et lue par l'écran
--      (public.event_table_report, recopie de 20261215000001_l11cc_lectures_tables.sql:74-198 : deletable,
--      delete_refusal ; ever_sold d'un type = déjà vendu ou mis en paiement, paiement échoué compris).
-- Recopies : chaque fonction reprend sa dernière définition, changements indiqués en ligne (CV 11c-c). Droits : fonctions
-- publiques au rôle de service seulement ; aides du schéma private à aucun rôle de l'API (clé de service comprise).
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. T4 — textes des refus d'écriture des tables : un seul endroit
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.event_table_refusal_message(p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE p_code
        WHEN 'SERVICE_UNAVAILABLE' THEN 'La vente de tables n’est pas encore ouverte sur Event Village.'
        WHEN 'PARTNER_SUSPENDED' THEN 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.'
        WHEN 'EVENT_NOT_FOUND' THEN 'Événement introuvable.'
        WHEN 'ADMIN_CANNOT_EDIT' THEN 'Seul l''organisateur modifie la billetterie de son événement.'
        WHEN 'ACCOUNT_NOT_ACTIVE' THEN 'Votre compte n''est pas actif.'
        WHEN 'EVENT_LOCKED' THEN 'La billetterie d''un événement terminé ou annulé ne peut plus être modifiée.'
        WHEN 'WITHDRAW_TO_EDIT' THEN 'L''événement est en cours de validation : retirez-le de la validation pour modifier sa billetterie.'
        WHEN 'EVENT_SUSPENDED' THEN 'Cet événement est suspendu : ses tables ne se modifient plus. Contactez le support.'
    END
$$;

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
    -- CV 11c-c (T4) : règle unique des refus d'écriture des tables (l'écriture passe aussi par ici, private.event_table_refusal) ;
    -- textes : private.event_table_refusal_message
    IF NOT public.fin_setting_bool('features.event_tables_enabled') THEN
        RETURN jsonb_build_object('code', 'SERVICE_UNAVAILABLE', 'message', private.event_table_refusal_message('SERVICE_UNAVAILABLE'));
    END IF;
    IF public.partner_owner_suspended(p_event, p_actor) THEN
        RETURN jsonb_build_object('code', 'PARTNER_SUSPENDED', 'message', private.event_table_refusal_message('PARTNER_SUSPENDED'));
    END IF;
    SELECT e.status::text INTO v_status FROM public.events e WHERE e.id = p_event;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('code', 'EVENT_NOT_FOUND', 'message', private.event_table_refusal_message('EVENT_NOT_FOUND'));
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(p_event, p_actor);
    IF NOT COALESCE(a.is_owner, FALSE) THEN
        IF COALESCE(a.is_staff, FALSE) THEN
            RETURN jsonb_build_object('code', 'ADMIN_CANNOT_EDIT', 'message', private.event_table_refusal_message('ADMIN_CANNOT_EDIT'));
        END IF;
        RETURN jsonb_build_object('code', 'EVENT_NOT_FOUND', 'message', private.event_table_refusal_message('EVENT_NOT_FOUND'));
    END IF;
    IF NOT COALESCE(a.is_active, FALSE) THEN
        RETURN jsonb_build_object('code', 'ACCOUNT_NOT_ACTIVE', 'message', private.event_table_refusal_message('ACCOUNT_NOT_ACTIVE'));
    END IF;
    IF v_status IN ('TERMINE', 'ANNULE') THEN
        RETURN jsonb_build_object('code', 'EVENT_LOCKED', 'message', private.event_table_refusal_message('EVENT_LOCKED'));
    END IF;
    IF v_status = 'EN_ATTENTE' THEN
        RETURN jsonb_build_object('code', 'WITHDRAW_TO_EDIT', 'message', private.event_table_refusal_message('WITHDRAW_TO_EDIT'));
    END IF;
    IF v_status = 'SUSPENDU' THEN
        RETURN jsonb_build_object('code', 'EVENT_SUSPENDED', 'message', private.event_table_refusal_message('EVENT_SUSPENDED'));
    END IF;
    RETURN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. T4 — garde d'écriture des tables : verrous, puis la règle unique
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.event_table_refusal(p_event uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_guard jsonb;
BEGIN
    -- CV 11c-c (T4) : mêmes verrous que public.ticket_category_guard (l'événement, puis ses catégories après la règle),
    -- puis la règle unique private.event_table_edit_refusal sur l'état verrouillé : service fermé, fiche suspendue,
    -- événement introuvable, administration, compte inactif, terminé ou annulé, en attente de validation, suspendu.
    -- L'écran lit le même refus (public.event_table_report : edit_refusal), code et texte.
    IF p_event IS NOT NULL THEN
        PERFORM 1 FROM public.events WHERE id = p_event FOR NO KEY UPDATE;
    END IF;
    v_guard := private.event_table_edit_refusal(p_event, p_actor);
    IF v_guard IS NOT NULL THEN
        RETURN public.event_edit_refusal(v_guard->>'code', v_guard->>'message');
    END IF;
    PERFORM 1 FROM public.ticket_categories WHERE event_id = p_event ORDER BY id FOR UPDATE;
    RETURN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. T5 — un type de table se supprime-t-il ? Règle unique (suppression et écran)
-- ----------------------------------------------------------------------------
-- Refus CATEGORY_HAS_SALES dès qu'une table de ce type est ou a été vendue ou mise en paiement : vente, attente, ou
-- toute réservation quel que soit son statut (paiement échoué compris : stock_reservations.category_id est en ON DELETE
-- RESTRICT). NULL : le type se supprime.
CREATE OR REPLACE FUNCTION private.event_table_type_delete_refusal(p_type uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE WHEN c.sold_quantity > 0 OR c.held_quantity > 0
                     OR EXISTS (SELECT 1 FROM public.event_table_bookings b WHERE b.category_id = c.id)
                     OR EXISTS (SELECT 1 FROM public.stock_reservations r WHERE r.category_id = c.id)
                THEN public.event_edit_refusal('CATEGORY_HAS_SALES',
                    'Des tables de ce type ont déjà été vendues ou mises en paiement : ce type ne se supprime plus, arrêtez plutôt sa vente.')
           END
      FROM public.ticket_categories c
     WHERE c.id = p_type
$$;

CREATE OR REPLACE FUNCTION public.event_table_type_delete(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event   uuid := public.try_uuid(p->>'event_id');
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_type_id uuid := public.try_uuid(p->>'type_id');
    v_refusal jsonb;
    c         public.ticket_categories%ROWTYPE;
BEGIN
    v_refusal := private.event_table_refusal(v_event, v_actor);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;
    SELECT * INTO c FROM public.ticket_categories WHERE id = v_type_id AND event_id = v_event AND kind = 'TABLE';
    IF NOT FOUND THEN
        RETURN public.event_edit_refusal('TABLE_TYPE_NOT_FOUND', 'Type de table introuvable pour cet événement.');
    END IF;
    -- CV 11c-c (T5) : règle unique, lue aussi par l'écran (public.event_table_report : deletable, delete_refusal)
    v_refusal := private.event_table_type_delete_refusal(c.id);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;
    PERFORM set_config('event_village.event_tables', 'on', true);
    DELETE FROM public.event_tables WHERE category_id = c.id;
    DELETE FROM public.ticket_categories WHERE id = c.id;
    PERFORM set_config('event_village.event_tables', 'off', true);
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'EVENT_TABLE_TYPE_DELETED', 'TICKET_CATEGORY', c.id,
            jsonb_build_object('event_id', v_event, 'name', c.name));
    RETURN jsonb_build_object('ok', true, 'type_id', c.id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. T1 — liste de la porte : plage du contrôle pour les contrôleurs
-- ----------------------------------------------------------------------------
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
    v_keeps boolean;
    v_problem text;
    v_opens timestamptz;
BEGIN
    IF v_event IS NULL OR v_actor IS NULL OR NOT public.scan_scanner_authorized(v_actor, v_event) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Liste réservée à l’organisatrice et à son équipe de contrôle.');
    END IF;
    -- CV 11c-c (T1) : la propriétaire et l'administration munie de events.read gardent la liste (elles lisent déjà les
    -- mêmes titulaires au pilotage ; impression à l'avance). Tout autre lecteur (contrôleur affecté, administrateur qui
    -- n'a que le droit de scanner) ne la lit que dans la plage du contrôle : même règle et même réponse que la liste des
    -- invités (public.ticket_guest_list_search, finition 1, complément 10) ; aucune donnée hors de la plage.
    SELECT COALESCE(f.is_owner, FALSE) OR COALESCE(f.is_staff, FALSE) INTO v_keeps
      FROM public.event_actor_profile_perm(v_event, v_actor, 'events.read') f;
    IF NOT COALESCE(v_keeps, FALSE) THEN
        v_problem := public.scan_event_problem(v_event);
        IF v_problem IS NOT NULL THEN
            SELECT w.opens_at INTO v_opens FROM public.scan_window(v_event) w;
            RETURN jsonb_build_object('ok', false, 'http', 409, 'code', 'CONTROL_CLOSED', 'problem', v_problem, 'opens_at', v_opens);
        END IF;
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'table_number', b.table_number, 'type_name', c.name, 'zone', z.name, 'seats', b.seats,
               'holder', private.event_table_person(b.holder_id),
               'entered', (SELECT count(*) FROM public.tickets tk WHERE tk.event_table_booking_id = b.id AND tk.status::text = 'UTILISE'),
               'guests', (SELECT COALESCE(jsonb_agg(DISTINCT private.event_table_person(tk.user_id)) FILTER (WHERE private.event_table_person(tk.user_id) IS NOT NULL), '[]'::jsonb)
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

-- ----------------------------------------------------------------------------
-- 5. Lecture des écrans : supprimable (T5), texte de l'administration (T4), historique de la copie (T2)
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
                      -- CV 11c-c (T5) : déjà vendu ou mis en paiement (paiement échoué compris), comme le texte du refus de la
                      -- suppression ; supprimable selon la règle unique de la suppression (private.event_table_type_delete_refusal)
                      'ever_sold', EXISTS (SELECT 1 FROM public.event_table_bookings b WHERE b.category_id = c.id)
                                   OR EXISTS (SELECT 1 FROM public.stock_reservations r WHERE r.category_id = c.id),
                      'deletable', dr.refusal IS NULL,
                      'delete_refusal', dr.refusal - 'ok') || private.event_table_prices(c.id, NULL)
                    ORDER BY c.created_at, c.id), '[]'::jsonb)
                    FROM public.ticket_categories c
                    CROSS JOIN LATERAL (SELECT private.event_table_type_delete_refusal(c.id) AS refusal) dr
                   WHERE c.event_id = v_event AND c.kind = 'TABLE'),
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
            -- CV 11c-c (T4) : texte de l'écriture (private.event_table_refusal_message)
            'edit_refusal', jsonb_build_object('code', 'ADMIN_CANNOT_EDIT', 'message', private.event_table_refusal_message('ADMIN_CANNOT_EDIT')),
            -- CV 11c-c (T2) : une ligne par transaction signalée ; une copie porte « Plan copié depuis … » (journal
            -- EVENT_TABLES_COPIED de la même transaction : même horodatage now())
            'changes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('at', g.at, 'label',
                                   (SELECT format('Plan copié depuis « %s »', l.metadata->>'from_title')
                                      FROM public.audit_logs l
                                     WHERE l.action = 'EVENT_TABLES_COPIED' AND l.object_id = v_event AND l.created_at = g.at
                                     ORDER BY l.id
                                     LIMIT 1)) ORDER BY g.at DESC), '[]'::jsonb)
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

-- ----------------------------------------------------------------------------
-- 6. T2, T3 — copie des tables d'un événement précédent : une fonction, une transaction
-- ----------------------------------------------------------------------------
-- p : event_id (cible), actor_id, from_event_id (source). Reprend chaque type de table de la source qui a au moins une
-- table (nom, places, prix, compris, minimum sur place, couleur et consigne d'entrée, état de vente) et ses tables
-- (numéros, positions, formes, rotations). Ni dates de vente (propres à chaque événement) ni zones d'accès. Plan non
-- montré aux clients.
CREATE OR REPLACE FUNCTION public.event_table_copy(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event   uuid := public.try_uuid(p->>'event_id');
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_from    uuid := public.try_uuid(p->>'from_event_id');
    v_refusal jsonb;
    v_fail    jsonb;
    v_title   text;
    v_bad     text;
    v_min     numeric;
    s         record;
    v_id      uuid;
    v_types   integer := 0;
    v_tables  integer := 0;
BEGIN
    IF v_from IS NULL OR v_from = v_event THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez un autre de vos événements.');
    END IF;
    -- Garde commune des tables (interrupteur, fiche, propriétaire, compte, état) ; verrou de la cible puis de ses catégories
    v_refusal := private.event_table_refusal(v_event, v_actor);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;
    -- Source : un autre événement de la même organisatrice ; sinon introuvable, sans rien dire de plus
    SELECT src.title INTO v_title
      FROM public.events src
      JOIN public.events tgt ON tgt.partner_id = src.partner_id
     WHERE src.id = v_from AND tgt.id = v_event;
    IF NOT FOUND THEN
        RETURN public.event_edit_refusal('EVENT_NOT_FOUND', private.event_table_refusal_message('EVENT_NOT_FOUND'));
    END IF;
    -- Sous le verrou : la cible n'a encore ni type ni table de table (deux copies simultanées : la seconde attend le
    -- verrou, puis s'arrête ici)
    IF EXISTS (SELECT 1 FROM public.ticket_categories c WHERE c.event_id = v_event AND c.kind = 'TABLE')
       OR EXISTS (SELECT 1 FROM public.event_tables x WHERE x.event_id = v_event) THEN
        RETURN public.event_edit_refusal('TABLES_NOT_EMPTY',
            'Cet événement a déjà des tables : la copie ne se fait que sur un événement sans table.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.event_tables x JOIN public.ticket_categories c ON c.id = x.category_id
                    WHERE x.event_id = v_from AND c.kind = 'TABLE') THEN
        RETURN public.event_edit_refusal('NOTHING_TO_COPY', 'Cet événement n’a aucune table à copier.');
    END IF;
    -- Mêmes contrôles qu'à la création d'un type (public.event_table_type_save) : prix du moment, nom libre
    v_min := GREATEST(COALESCE(public.fin_setting_num('finance.min_paid_price'), 1), 1);
    IF EXISTS (SELECT 1 FROM public.ticket_categories c
                WHERE c.event_id = v_from AND c.kind = 'TABLE'
                  AND EXISTS (SELECT 1 FROM public.event_tables x WHERE x.category_id = c.id)
                  AND (c.price <> trunc(c.price) OR c.price < v_min OR c.price > 10000000)) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT',
            format('Le prix de la table est un montant entier de %s à 10 000 000 F CFA.', v_min::bigint), 'price');
    END IF;
    SELECT c.name INTO v_bad
      FROM public.ticket_categories c
     WHERE c.event_id = v_from AND c.kind = 'TABLE'
       AND EXISTS (SELECT 1 FROM public.event_tables x WHERE x.category_id = c.id)
       AND EXISTS (SELECT 1 FROM public.ticket_categories o WHERE o.event_id = v_event AND lower(btrim(o.name)) = lower(btrim(c.name)))
     ORDER BY c.created_at, c.id
     LIMIT 1;
    IF v_bad IS NOT NULL THEN
        RETURN public.event_edit_refusal('CATEGORY_NAME_TAKEN',
            format('« %s » existe déjà pour cet événement (billets ou tables) : choisissez un autre nom.', v_bad), 'name');
    END IF;

    -- Tout ou rien : au moindre refus, les écritures (et les avis du déclencheur) sont annulées ensemble
    BEGIN
        PERFORM set_config('event_village.event_tables', 'on', true);
        FOR s IN
            SELECT c.*, (SELECT count(*) FROM public.event_tables x WHERE x.category_id = c.id)::int AS n
              FROM public.ticket_categories c
             WHERE c.event_id = v_from AND c.kind = 'TABLE'
             ORDER BY c.created_at, c.id
        LOOP
            CONTINUE WHEN s.n = 0;
            INSERT INTO public.ticket_categories (event_id, name, description, price, total_quantity, sold_quantity, max_per_order,
                                                  sale_start, sale_end, sale_online, sale_counter, is_active, scan_color,
                                                  entry_instruction, kind, seats_per_unit, included_text, onsite_note, payment_mode)
            VALUES (v_event, s.name, NULL, s.price, s.n, 0, 1, NULL, NULL, FALSE, FALSE, s.is_active, s.scan_color, s.entry_instruction,
                    'TABLE', s.seats_per_unit, s.included_text, s.onsite_note, 'FULL')
            RETURNING id INTO v_id;
            INSERT INTO public.event_tables (event_id, category_id, number, zone_id, plan_x, plan_y, plan_shape, plan_rotation)
            SELECT v_event, v_id, x.number, NULL, x.plan_x, x.plan_y, x.plan_shape, x.plan_rotation
              FROM public.event_tables x
             WHERE x.category_id = s.id
             ORDER BY x.number;
            v_types := v_types + 1;
            v_tables := v_tables + s.n;
        END LOOP;
        INSERT INTO public.event_table_plans (event_id, plan_enabled, updated_at)
        VALUES (v_event, FALSE, now())
        ON CONFLICT (event_id) DO UPDATE SET plan_enabled = FALSE, updated_at = now();
        v_fail := private.event_seats_refusal(v_event, 'count');
        IF v_fail IS NOT NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'event_table_copy : refus';
        END IF;
        PERFORM set_config('event_village.event_tables', 'off', true);
    EXCEPTION
        WHEN check_violation THEN
            PERFORM set_config('event_village.event_tables', 'off', true);
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Une valeur du type de table est hors des bornes.');
        WHEN unique_violation THEN
            PERFORM set_config('event_village.event_tables', 'off', true);
            RETURN public.event_edit_refusal('TABLES_NOT_EMPTY',
                'Cet événement a déjà des tables : la copie ne se fait que sur un événement sans table.');
        WHEN raise_exception THEN
            PERFORM set_config('event_village.event_tables', 'off', true);
            IF v_fail IS NULL THEN
                RAISE;
            END IF;
            RETURN v_fail;
    END;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'EVENT_TABLES_COPIED', 'EVENT', v_event,
            jsonb_build_object('from_event_id', v_from, 'from_title', v_title, 'types', v_types, 'tables', v_tables));
    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'types', v_types, 'tables', v_tables);
END;
$$;

-- ----------------------------------------------------------------------------
-- Droits : fonctions publiques au rôle de service seulement ; aides de private à aucun rôle de l'API
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION private.event_table_refusal_message(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.event_table_edit_refusal(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.event_table_refusal(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.event_table_type_delete_refusal(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.event_table_type_delete(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_type_delete(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_table_door_list(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_door_list(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_table_report(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_report(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_table_copy(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_copy(jsonb) TO service_role;
COMMENT ON FUNCTION public.event_table_copy(jsonb) IS
    'Lot 11c-c (contre-vérification T2, T3) : copie des types et des tables d''un événement précédent de la même organisatrice, en une transaction, sous le verrou de l''événement cible ; tout ou rien.';
