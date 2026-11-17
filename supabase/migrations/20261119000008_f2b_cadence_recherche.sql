-- Finition 2b (ajout, point 1) — recherche de lieu : le limiteur espace les APPELS au service d'au moins une seconde, pas
-- seulement les réservations de créneau. Au run complet 252 (finition 3a), un appel servi sans attente est parti en retard
-- (charge du serveur) et n'a précédé le suivant que de 801 ms (tests/audit/cvf2a-3-recherche).
-- Côté application (lib/places/place-search.ts) : l'appel attend l'heure de son créneau, puis ne part que si son retard
-- sur ce créneau reste sous 150 ms et qu'au moins une seconde s'est écoulée depuis le dernier appel du processus ; sinon le
-- créneau est perdu et un autre est réservé. Ici : créneaux espacés de 1,3 s (au lieu de 1,1 s), si bien que deux appels
-- partis chacun dans les 150 ms de leur créneau sont séparés de 1,15 s au moins, toutes instances confondues.
-- place_search_slot recopiée de 20261116000003_f2a_carte.sql ; seul l'espacement change.
-- Sans BEGIN ni COMMIT, rejouable : CREATE OR REPLACE ; aucune donnée écrite.

CREATE OR REPLACE FUNCTION public.place_search_slot(p_max_wait_ms integer)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now timestamptz := clock_timestamp();
    v_slot timestamptz;
    v_wait integer;
BEGIN
    INSERT INTO public.place_search_throttle (id, next_at) VALUES (1, v_now) ON CONFLICT (id) DO NOTHING;
    SELECT GREATEST(t.next_at, v_now) INTO v_slot FROM public.place_search_throttle t WHERE t.id = 1 FOR UPDATE;
    v_wait := GREATEST(0, ceil(extract(epoch FROM (v_slot - v_now)) * 1000))::integer;
    IF v_wait > GREATEST(COALESCE(p_max_wait_ms, 0), 0) THEN
        RETURN jsonb_build_object('ok', false, 'wait_ms', v_wait);
    END IF;
    -- Finition 2b : 1,3 s entre deux créneaux (retard admis de 150 ms à l'appel : 1,15 s au moins entre deux appels)
    UPDATE public.place_search_throttle SET next_at = v_slot + interval '1300 milliseconds' WHERE id = 1;
    RETURN jsonb_build_object('ok', true, 'wait_ms', v_wait);
END;
$$;
REVOKE ALL ON FUNCTION public.place_search_slot(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_search_slot(integer) TO service_role;
