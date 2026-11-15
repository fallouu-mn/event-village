-- ============================================================================
-- EVENT VILLAGE — FINITION 1, complément 4 (points 13 et 14) : « Mes soirées » et menu « Scanner » à jour
-- ============================================================================
-- 13. controller_evening_figures(contrôleur, événement) : entrées validées par CE contrôleur et, s'il a tenu une caisse,
--     total encaissé (somme des expected_cash_total de ses caisses) et état de clôture. Une seule fonction, lue par
--     controller_evenings (page « Mes soirées » du contrôleur) et par partner_team_view (« Événements passés » de
--     l'équipe, recopie ci-dessous, seul ajout : le champ `evening` des événements passés) : mêmes chiffres des deux
--     côtés. Aucun nom, numéro ni billet de client ; rien des autres contrôleurs.
--     controller_evenings : événements passés (fin passée, ou TERMINE / ANNULE) où le compte a été affecté, a scanné ou a
--     tenu une caisse (une affectation retirée après la soirée ne fait pas disparaître la soirée).
-- 14. Recopie de controller_scanner_status : + next_change_at (prochain instant où le menu « Scanner » peut changer :
--     24 h avant une ouverture du contrôle, ou une fermeture ; servi s'il tombe dans les 24 h, null sinon). Règle du
--     menu inchangée.
-- Toutes réservées au service_role. Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 13. Chiffres d'une soirée, pour un contrôleur
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.controller_evening_figures(p_user uuid, p_event uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'entries', (SELECT count(*) FROM public.ticket_scans sc
                     WHERE sc.event_id = p_event AND sc.scanner_id = p_user AND sc.accepted),
        'cash', (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE jsonb_build_object(
                        'collected', COALESCE(sum(s.expected_cash_total), 0),
                        'gap', COALESCE(sum(s.discrepancy_amount), 0),
                        'state', CASE
                            WHEN bool_or(s.status = 'OUVERT') THEN 'OPEN'
                            WHEN bool_or(s.status = 'LITIGE') THEN 'DISPUTED'
                            WHEN bool_or(s.status = 'CLOTURE' AND COALESCE(s.discrepancy_amount, 0) <> 0
                                         AND s.discrepancy_validated_at IS NULL) THEN 'GAP_PENDING'
                            WHEN bool_or(COALESCE(s.discrepancy_amount, 0) <> 0) THEN 'GAP_ACCEPTED'
                            ELSE 'CLOSED' END) END
                   FROM public.controller_shifts s
                  WHERE s.event_id = p_event AND s.controller_id = p_user))
$$;

-- ----------------------------------------------------------------------------
-- 13. « Mes soirées » : événements passés du contrôleur, ses chiffres seulement
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.controller_evenings(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := public.try_uuid(p->>'user_id');
    v_items jsonb;
BEGIN
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    WITH mine AS (
        SELECT x.event_id FROM public.event_controllers x WHERE x.user_id = v_user
        UNION SELECT sc.event_id FROM public.ticket_scans sc WHERE sc.scanner_id = v_user
        UNION SELECT s.event_id FROM public.controller_shifts s WHERE s.controller_id = v_user
    ), ev AS (
        SELECT e.id, e.title, e.status::text AS status, e.partner_id,
               (e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar' AS start_at,
               (COALESCE(e.end_date, e.start_date) + COALESCE(e.end_time, time '23:59')) AT TIME ZONE 'Africa/Dakar' AS end_at
          FROM public.events e JOIN mine ON mine.event_id = e.id
    )
    SELECT COALESCE(jsonb_agg(x.item ORDER BY x.start_at DESC NULLS LAST, x.id), '[]'::jsonb)
      INTO v_items
      FROM (
        SELECT ev.id, ev.start_at,
               jsonb_build_object(
                   'event_id', ev.id, 'title', ev.title, 'status', ev.status, 'start_at', ev.start_at,
                   'organizer', COALESCE(NULLIF(btrim(pa.commercial_name), ''), pa.company_name),
                   'gate', gt.gate_name, 'zone', gt.zone_name, 'entry_point', ec.entry_point
               ) || public.controller_evening_figures(v_user, ev.id) AS item
          FROM ev
          JOIN public.partners pa ON pa.id = ev.partner_id
          LEFT JOIN public.event_controllers ec ON ec.event_id = ev.id AND ec.user_id = v_user
          LEFT JOIN LATERAL (
                SELECT g.name AS gate_name, z.name AS zone_name
                  FROM public.event_gates g JOIN public.event_zones z ON z.id = g.zone_id
                 WHERE g.id = COALESCE(ec.gate_id, (
                        SELECT sc.gate_id FROM public.ticket_scans sc
                         WHERE sc.event_id = ev.id AND sc.scanner_id = v_user AND sc.gate_id IS NOT NULL
                         ORDER BY sc.created_at DESC LIMIT 1))
          ) gt ON TRUE
         WHERE ev.end_at < now() OR ev.status IN ('TERMINE', 'ANNULE')
         ORDER BY ev.start_at DESC NULLS LAST
         LIMIT 200
      ) x;
    RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;

-- ----------------------------------------------------------------------------
-- 13. Recopie de partner_team_view (20261115000002) : + `evening` sur les événements passés de chaque contrôleur
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_team_view(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner uuid := public.try_uuid(p->>'partner_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_event_json jsonb := 'null'::jsonb;
    v_members jsonb;
    v_invitations jsonb;
    v_events jsonb;
    v_counts jsonb;
BEGIN
    IF v_partner IS NULL OR (COALESCE(jsonb_typeof(p->'event_id'), 'null') <> 'null' AND v_event IS NULL) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande invalide.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.partners pa WHERE pa.id = v_partner) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_FOUND', 'message', 'Organisateur introuvable.');
    END IF;
    IF v_event IS NOT NULL THEN
        SELECT jsonb_build_object('id', e.id, 'title', e.title, 'status', e.status::text,
                                  'start_at', (e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar',
                                  'assignable', e.status::text IN ('VALIDE', 'PUBLIE'),
                                  'has_zones', EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = e.id))
          INTO v_event_json
          FROM public.events e
         WHERE e.id = v_event AND e.partner_id = v_partner;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
        END IF;
    END IF;

    -- Événements de la portée, avec leurs portes
    WITH ev AS (
        SELECT e.id, e.title, e.status::text AS status,
               (e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar' AS start_at,
               (COALESCE(e.end_date, e.start_date) + COALESCE(e.end_time, time '23:59')) AT TIME ZONE 'Africa/Dakar' AS end_at
          FROM public.events e
         WHERE e.partner_id = v_partner AND (v_event IS NULL OR e.id = v_event)
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', ev.id, 'title', ev.title, 'status', ev.status, 'start_at', ev.start_at,
               'assignable', ev.status IN ('VALIDE', 'PUBLIE'),
               'past', ev.end_at < now() OR ev.status IN ('TERMINE', 'ANNULE'),
               'has_zones', EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = ev.id),
               'gates', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'zone_name', z.name,
                                                                      'categories', public.team_gate_categories(g.id))
                                                   ORDER BY z.position, lower(z.name), lower(g.name))
                                    FROM public.event_gates g JOIN public.event_zones z ON z.id = g.zone_id
                                   WHERE g.event_id = ev.id), '[]'::jsonb),
               -- Complément 9 : catégories en vente qu'aucune porte ne laisse entrer ; portes sans contrôleur (zones seulement)
               'uncovered_categories', CASE WHEN EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = ev.id) THEN COALESCE((
                    SELECT jsonb_agg(jsonb_build_object('name', c.name, 'scan_color', c.scan_color) ORDER BY c.price, lower(c.name), c.id)
                      FROM public.ticket_categories c
                     WHERE c.event_id = ev.id AND c.is_active
                       AND (COALESCE(c.sale_online, FALSE) OR COALESCE(c.sale_counter, FALSE))
                       AND NOT EXISTS (SELECT 1 FROM public.zone_categories zc
                                         JOIN public.event_gates g ON g.zone_id = zc.zone_id
                                        WHERE zc.category_id = c.id)), '[]'::jsonb) ELSE '[]'::jsonb END,
               'gates_without_controller', COALESCE((
                    SELECT jsonb_agg(g.name ORDER BY lower(g.name))
                      FROM public.event_gates g
                     WHERE g.event_id = ev.id
                       AND NOT EXISTS (SELECT 1 FROM public.event_controllers x WHERE x.event_id = ev.id AND x.gate_id = g.id)), '[]'::jsonb))
           ORDER BY ev.start_at NULLS LAST, lower(ev.title)), '[]'::jsonb)
      INTO v_events
      FROM ev;

    -- Membres : comptes affectés à au moins un événement de la portée
    WITH ev AS (
        SELECT e.id, e.title, e.status::text AS status,
               (e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar' AS start_at,
               (COALESCE(e.end_date, e.start_date) + COALESCE(e.end_time, time '23:59')) AT TIME ZONE 'Africa/Dakar' AS end_at
          FROM public.events e
         WHERE e.partner_id = v_partner AND (v_event IS NULL OR e.id = v_event)
    ), ec AS (
        SELECT x.id, x.event_id, x.user_id, x.can_accept_cash, x.entry_point, x.gate_id, x.gate_change_allowed, x.created_at,
               ev.title, ev.status, ev.start_at, ev.end_at
          FROM public.event_controllers x JOIN ev ON ev.id = x.event_id
    ), scans AS (
        SELECT sc.scanner_id, sc.event_id, count(*) FILTER (WHERE sc.accepted) AS entries, max(sc.created_at) AS last_at
          FROM public.ticket_scans sc
         WHERE sc.event_id IN (SELECT id FROM ev)
         GROUP BY sc.scanner_id, sc.event_id
    ), people AS (
        SELECT ec.user_id, min(ec.created_at) AS first_at FROM ec GROUP BY ec.user_id
    )
    SELECT COALESCE(jsonb_agg(m.item ORDER BY m.sort_key, m.user_id), '[]'::jsonb)
      INTO v_members
      FROM (
        SELECT u.id AS user_id,
               lower(btrim(concat_ws(' ', COALESCE(u.first_name, ''), COALESCE(u.last_name, '')))) AS sort_key,
               jsonb_build_object(
                   'user_id', u.id, 'first_name', u.first_name, 'last_name', u.last_name, 'phone', u.phone,
                   'account_state', st.state,
                   'active_since', GREATEST(people.first_at, act.at),
                   'activation', CASE WHEN st.state = 'PENDING_ACTIVATION' THEN (
                        SELECT jsonb_build_object('sent_at', o.created_at, 'expires_at', o.expires_at)
                          FROM public.otp_codes o
                         WHERE o.phone IN (u.phone, ltrim(u.phone, '+'), '+' || ltrim(u.phone, '+'))
                           AND o.purpose = 'CONTROLLER_SETUP'
                         ORDER BY o.created_at DESC LIMIT 1) END,
                   'other_organizers', EXISTS (SELECT 1 FROM public.event_controllers x2 JOIN public.events e2 ON e2.id = x2.event_id
                                                WHERE x2.user_id = u.id AND e2.partner_id IS DISTINCT FROM v_partner),
                   'assignments', (SELECT jsonb_agg(jsonb_build_object(
                           'assignment_id', ec.id, 'event_id', ec.event_id, 'title', ec.title, 'status', ec.status,
                           'start_at', ec.start_at, 'past', ec.end_at < now() OR ec.status IN ('TERMINE', 'ANNULE'),
                           'gate', (SELECT jsonb_build_object('id', g.id, 'name', g.name, 'zone_name', z.name,
                                                              'categories', public.team_gate_categories(g.id))
                                      FROM public.event_gates g JOIN public.event_zones z ON z.id = g.zone_id
                                     WHERE g.id = ec.gate_id),
                           'has_zones', EXISTS (SELECT 1 FROM public.event_zones z2 WHERE z2.event_id = ec.event_id),
                           'gate_change_allowed', ec.gate_change_allowed,
                           'entry_point', ec.entry_point,
                           'can_accept_cash', ec.can_accept_cash,
                           'open_shift', EXISTS (SELECT 1 FROM public.controller_shifts s
                                                  WHERE s.event_id = ec.event_id AND s.controller_id = ec.user_id AND s.status = 'OUVERT'),
                           'entries', COALESCE(sc.entries, 0),
                           'last_scan_at', sc.last_at,
                           -- Complément 13 : chiffres de la soirée passée, les mêmes que « Mes soirées » du contrôleur
                           'evening', CASE WHEN ec.end_at < now() OR ec.status IN ('TERMINE', 'ANNULE')
                                           THEN public.controller_evening_figures(ec.user_id, ec.event_id) END)
                       ORDER BY ec.start_at NULLS LAST, lower(ec.title))
                      FROM ec LEFT JOIN scans sc ON sc.scanner_id = ec.user_id AND sc.event_id = ec.event_id
                     WHERE ec.user_id = u.id)
               ) AS item
          FROM people
          JOIN public.users u ON u.id = people.user_id
          LEFT JOIN auth.users au ON au.id = u.id
          CROSS JOIN LATERAL (SELECT CASE
                    WHEN u.status::text IN ('SUSPENDU', 'SUPPRIME') THEN 'SUSPENDED'
                    WHEN COALESCE(au.raw_app_meta_data->>'controller_activation_pending', 'false') = 'true' THEN 'PENDING_ACTIVATION'
                    ELSE 'ACTIVE' END AS state) st
          LEFT JOIN LATERAL (SELECT max(al.created_at) AS at FROM public.audit_logs al
                              WHERE al.action = 'CONTROLLER_ACCOUNT_ACTIVATED' AND al.object_id = u.id) act ON TRUE
      ) m;

    -- Invitations : en attente (non échues) toujours ; expirées, refusées, annulées des 30 derniers jours ; non effacées
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', ci.id,
               'state', CASE WHEN ci.status = 'PENDING' AND ci.expires_at <= now() THEN 'EXPIRED' ELSE ci.status END,
               'phone_entered', ci.phone_entered,
               'display_name', public.team_mask_name(u.first_name, u.last_name),
               'created_at', ci.created_at, 'last_sent_at', ci.last_sent_at, 'expires_at', ci.expires_at,
               'responded_at', CASE WHEN ci.status = 'PENDING' AND ci.expires_at <= now() THEN ci.expires_at ELSE ci.responded_at END,
               'send_count', ci.send_count,
               'events', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                                          'id', e.id, 'title', e.title,
                                          'start_at', (e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar',
                                          'assignable', e.status::text IN ('VALIDE', 'PUBLIE'))
                                      ORDER BY e.start_date, e.start_time, e.id)
                                     FROM public.events e
                                    WHERE e.id IN (SELECT public.try_uuid(a->>'event_id') FROM jsonb_array_elements(ci.assignments) a)),
                                  '[]'::jsonb))
           ORDER BY ci.created_at DESC, ci.id), '[]'::jsonb)
      INTO v_invitations
      FROM public.controller_invitations ci
      JOIN public.users u ON u.id = ci.user_id
     WHERE ci.partner_id = v_partner
       AND ci.cleared_at IS NULL
       AND ci.status <> 'ACCEPTED'
       AND ((ci.status = 'PENDING' AND ci.expires_at > now())
            OR COALESCE(CASE WHEN ci.status = 'PENDING' THEN ci.expires_at ELSE ci.responded_at END, ci.created_at) > now() - interval '30 days')
       AND (v_event IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(ci.assignments) a WHERE public.try_uuid(a->>'event_id') = v_event));

    -- Comptages des bandeaux (aucun comptage à l'écran)
    SELECT jsonb_build_object(
               'members', jsonb_array_length(v_members),
               'ready', (SELECT count(*) FROM jsonb_array_elements(v_members) x WHERE x->>'account_state' = 'ACTIVE'),
               'pending', (SELECT count(*) FROM jsonb_array_elements(v_members) x WHERE x->>'account_state' = 'PENDING_ACTIVATION')
                        + (SELECT count(*) FROM jsonb_array_elements(v_invitations) i WHERE i->>'state' = 'PENDING'),
               'without_gate', (SELECT count(DISTINCT x->>'user_id') FROM jsonb_array_elements(v_members) x,
                                       jsonb_array_elements(x->'assignments') a
                                 WHERE (a->>'has_zones')::boolean AND a->'gate' = 'null'::jsonb AND NOT (a->>'past')::boolean),
               'to_follow_up', (SELECT count(*) FROM jsonb_array_elements(v_invitations) i WHERE i->>'state' IN ('EXPIRED', 'DECLINED')))
      INTO v_counts;

    RETURN jsonb_build_object('ok', true, 'partner_id', v_partner,
                              'partner_name', (SELECT COALESCE(NULLIF(btrim(pa.commercial_name), ''), pa.company_name)
                                                 FROM public.partners pa WHERE pa.id = v_partner),
                              'event', v_event_json, 'members', v_members,
                              'invitations', v_invitations, 'events', v_events, 'counts', v_counts);
END;
$$;

-- ----------------------------------------------------------------------------
-- 14. Recopie de controller_scanner_status (20261115000003) : + next_change_at
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
    v_change timestamptz;
BEGIN
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', true, 'scanner', false, 'open_now', 0, 'next_opens_at', NULL, 'next_change_at', NULL);
    END IF;
    WITH a AS (
        SELECT e.id, e.status::text AS status, public.scan_event_problem(e.id) AS problem, w.opens_at, w.closes_at
          FROM public.event_controllers ec
          JOIN public.events e ON e.id = ec.event_id
          JOIN public.partners pa ON pa.id = e.partner_id
          CROSS JOIN LATERAL public.scan_window(e.id) w
         WHERE ec.user_id = v_user AND pa.status::text IN ('VALIDE', 'SUSPENDU')
    )
    SELECT count(*) FILTER (WHERE a.problem IS NULL),
           min(a.opens_at) FILTER (WHERE a.problem = 'event_not_open' AND a.status = 'PUBLIE' AND a.opens_at > now()),
           -- Complément 14 : prochain instant où le menu peut changer (24 h avant une ouverture, ou une fermeture)
           LEAST(min(a.opens_at - interval '24 hours') FILTER (WHERE a.status = 'PUBLIE' AND a.opens_at - interval '24 hours' > now()),
                 min(a.closes_at) FILTER (WHERE a.status IN ('PUBLIE', 'TERMINE') AND a.closes_at > now()))
      INTO v_open, v_next, v_change
      FROM a;
    RETURN jsonb_build_object('ok', true,
                              'scanner', v_open > 0 OR (v_next IS NOT NULL AND v_next <= now() + interval '24 hours'),
                              'open_now', v_open, 'next_opens_at', v_next,
                              -- au-delà de 24 h : null (le profil est relu à chaque renouvellement de session, environ
                              -- toutes les heures, et rapproche l'heure ; le navigateur n'a pas de plafond à gérer)
                              'next_change_at', CASE WHEN v_change <= now() + interval '24 hours' THEN v_change END);
END;
$$;

REVOKE ALL ON FUNCTION public.controller_evening_figures(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.controller_evenings(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.partner_team_view(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.controller_scanner_status(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.controller_evening_figures(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.controller_evenings(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.partner_team_view(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.controller_scanner_status(jsonb) TO service_role;
