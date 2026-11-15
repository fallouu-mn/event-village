-- ============================================================================
-- EVENT VILLAGE — Correctifs de la contre-vérification de la finition 1 — T3 : « Mes soirées » ne retient que les scans
-- ACCEPTÉS du compte (plus ses affectations et ses caisses)
-- ============================================================================
-- Recopie de controller_evenings (20261115000005_finition1_soirees.sql) ; seuls changements : `sc.accepted` dans la liste
-- des événements du compte et dans la porte lue à défaut d'affectation. Un scan refusé (ligne `forbidden` écrite par
-- ticket_scan quand il refuse le scanneur) ne fait plus entrer l'événement d'une autre organisatrice. Chiffres inchangés
-- (controller_evening_figures comptait déjà les entrées acceptées). Réservée au service_role. Aucun BEGIN ni COMMIT ;
-- rejouable.
-- ============================================================================

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
        -- cvf1 T3 : scans ACCEPTÉS seulement ; un scan refusé (forbidden, chez une autre organisatrice…) ne fait pas
        -- entrer un événement dans « Mes soirées »
        UNION SELECT sc.event_id FROM public.ticket_scans sc WHERE sc.scanner_id = v_user AND sc.accepted
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
                         WHERE sc.event_id = ev.id AND sc.scanner_id = v_user AND sc.accepted AND sc.gate_id IS NOT NULL
                         ORDER BY sc.created_at DESC LIMIT 1))
          ) gt ON TRUE
         WHERE ev.end_at < now() OR ev.status IN ('TERMINE', 'ANNULE')
         ORDER BY ev.start_at DESC NULLS LAST
         LIMIT 200
      ) x;
    RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;

REVOKE ALL ON FUNCTION public.controller_evenings(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.controller_evenings(jsonb) TO service_role;
