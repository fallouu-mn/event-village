-- Finition 3b (E-29) — « À faire aujourd'hui » en tête de l'accueil de l'administration.
--
-- admin_todo(p jsonb) : compteurs des seules lignes demandées (la route ne demande que celles que l'administrateur a le
-- droit de traiter). Chaque ligne est calculée dans son propre bloc : une lecture en échec rend
-- {"unavailable": true, "error": "<SQLSTATE>"} pour cette ligne, jamais 0, et n'empêche pas les autres.
--   p : {"lines": ["to_resume", "events_to_validate", ...], "simulated": bool, "unconfirmed_hours": int, "now": timestamptz?}
-- Lignes :
--   to_resume            versements à reprendre (même règle que « Argent qui attend » : finance_admin_waiting)
--   events_to_validate   événements EN_ATTENTE ; plus ancienne soumission (event_status_history)
--   partners_to_validate fiches partenaires EN_ATTENTE ; dont dossiers complétés après un refus (resubmitted_at)
--   events_suspended     événements SUSPENDU ; partage passé (fin dépassée, event_end_at) / à venir
--   cash_discrepancies   caisses clôturées avec un écart non validé ; les 3 événements les plus anciens
--   failed_sends         envois FAILED terminés aujourd'hui (jour de Dakar)
--   sms_cap              SMS optionnels du jour / plafond ; alerte à 80 % (même seuil que ADMIN_SMS_OPTIONAL_80)
--   debts                créances ouvertes (reste > 0)
-- Lecture seule. Sans BEGIN ni COMMIT ; rejouable (CREATE OR REPLACE, REVOKE/GRANT).

CREATE OR REPLACE FUNCTION public.admin_todo(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lines   text[];
    v_now     timestamptz;
    v_today   date;
    v_start   timestamptz;
    v_out     jsonb := '{}'::jsonb;
    v_line    text;
    v_known   CONSTANT text[] := ARRAY['to_resume', 'events_to_validate', 'partners_to_validate', 'events_suspended',
                                       'cash_discrepancies', 'failed_sends', 'sms_cap', 'debts'];
    v_n       bigint;
    v_k       bigint;
    v_amount  numeric;
    v_oldest  timestamptz;
    v_j       jsonb;
    v_cap     integer;
BEGIN
    IF p IS NULL OR jsonb_typeof(p->'lines') <> 'array' THEN
        RAISE EXCEPTION 'admin_todo : liste des lignes absente' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::text[]) INTO v_lines FROM jsonb_array_elements_text(p->'lines') x;
    IF NOT (v_lines <@ v_known) THEN
        RAISE EXCEPTION 'admin_todo : ligne inconnue (%)', array_to_string(v_lines, ', ') USING ERRCODE = '22023';
    END IF;
    v_now   := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    v_today := (v_now AT TIME ZONE 'Africa/Dakar')::date;
    v_start := v_today::timestamp AT TIME ZONE 'Africa/Dakar';

    FOREACH v_line IN ARRAY v_lines LOOP
        BEGIN
            CASE v_line
            WHEN 'to_resume' THEN
                v_j := public.finance_admin_waiting(COALESCE((p->>'simulated')::boolean, false),
                                                    COALESCE(NULLIF(p->>'unconfirmed_hours', '')::integer, 48)) -> 'to_resume';
                v_out := v_out || jsonb_build_object(v_line, jsonb_build_object(
                    'count', COALESCE((v_j->>'count')::bigint, 0), 'amount', COALESCE((v_j->>'amount')::numeric, 0)));
            WHEN 'events_to_validate' THEN
                SELECT count(*), min(s.submitted_at) INTO v_n, v_oldest
                  FROM public.events e
                  LEFT JOIN LATERAL (SELECT max(h.created_at) AS submitted_at FROM public.event_status_history h
                                      WHERE h.event_id = e.id AND h.new_status = 'EN_ATTENTE') s ON true
                 WHERE e.status::text = 'EN_ATTENTE';
                v_out := v_out || jsonb_build_object(v_line, jsonb_build_object('count', v_n, 'oldest_at', v_oldest));
            WHEN 'partners_to_validate' THEN
                SELECT count(*), count(*) FILTER (WHERE pa.resubmitted_at IS NOT NULL) INTO v_n, v_k
                  FROM public.partners pa WHERE pa.status::text = 'EN_ATTENTE';
                v_out := v_out || jsonb_build_object(v_line, jsonb_build_object('count', v_n, 'resubmitted', v_k));
            WHEN 'events_suspended' THEN
                SELECT count(*), count(*) FILTER (WHERE public.event_end_at(e.id) < v_now) INTO v_n, v_k
                  FROM public.events e WHERE e.status::text = 'SUSPENDU';
                v_out := v_out || jsonb_build_object(v_line, jsonb_build_object('count', v_n, 'past', v_k, 'upcoming', v_n - v_k));
            WHEN 'cash_discrepancies' THEN
                SELECT count(*), COALESCE(sum(abs(s.discrepancy_amount)), 0) INTO v_n, v_amount
                  FROM public.controller_shifts s
                 WHERE s.status = 'CLOTURE' AND COALESCE(s.discrepancy_amount, 0) <> 0 AND s.discrepancy_validated_at IS NULL;
                SELECT COALESCE(jsonb_agg(jsonb_build_object('event_id', x.event_id, 'title', x.title, 'count', x.n)
                                          ORDER BY x.oldest, x.event_id), '[]'::jsonb), count(*)
                  INTO v_j, v_k
                  FROM (SELECT s.event_id, e.title, count(*) AS n, min(COALESCE(s.closed_at, s.updated_at)) AS oldest
                          FROM public.controller_shifts s JOIN public.events e ON e.id = s.event_id
                         WHERE s.status = 'CLOTURE' AND COALESCE(s.discrepancy_amount, 0) <> 0 AND s.discrepancy_validated_at IS NULL
                         GROUP BY s.event_id, e.title) x;
                v_out := v_out || jsonb_build_object(v_line, jsonb_build_object(
                    'count', v_n, 'amount', v_amount, 'events_count', v_k,
                    'events', COALESCE((SELECT jsonb_agg(z.value ORDER BY z.i)
                                          FROM (SELECT t.value, t.i FROM jsonb_array_elements(v_j) WITH ORDINALITY t(value, i)
                                                 ORDER BY t.i LIMIT 3) z), '[]'::jsonb)));
            WHEN 'failed_sends' THEN
                SELECT count(*) INTO v_n FROM public.notification_outbox o
                 WHERE o.status = 'FAILED' AND COALESCE(o.finished_at, o.created_at) >= v_start;
                v_out := v_out || jsonb_build_object(v_line, jsonb_build_object('count', v_n));
            WHEN 'sms_cap' THEN
                v_cap := public.notif_setting_int('notif.sms_optional_daily_cap');
                v_n := public.notif_sms_optional_used(v_today);
                v_out := v_out || jsonb_build_object(v_line, jsonb_build_object(
                    'count', v_n, 'cap', v_cap,
                    'alert', v_cap IS NOT NULL AND v_cap > 0 AND v_n * 100 >= v_cap * 80));
            WHEN 'debts' THEN
                SELECT count(*), COALESCE(sum(d.remaining), 0) INTO v_n, v_amount
                  FROM public.finance_debts d WHERE d.remaining > 0;
                v_out := v_out || jsonb_build_object(v_line, jsonb_build_object('count', v_n, 'amount', v_amount));
            END CASE;
        EXCEPTION WHEN OTHERS THEN
            v_out := v_out || jsonb_build_object(v_line, jsonb_build_object('unavailable', true, 'error', SQLSTATE));
        END;
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'computed_at', v_now, 'lines', v_out);
END;
$$;

COMMENT ON FUNCTION public.admin_todo(jsonb) IS
    'Finition 3b (E-29) : compteurs de « À faire aujourd''hui », seulement pour les lignes demandées ; une ligne en échec est « unavailable », jamais 0.';

REVOKE ALL ON FUNCTION public.admin_todo(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_todo(jsonb) TO service_role;
