-- Finition 2b (D, E-27) — fenêtre « Prévenir » avant d'enregistrer un changement de date, d'heure, de lieu ou de repère :
-- « {n} détenteurs seront prévenus par SMS {à HH:MM | tout de suite}. » L'écran doit connaître, AVANT l'enregistrement,
-- le nombre de SMS et l'heure réelle de leur départ, calculés par les mêmes règles que l'enregistrement (repère déplacé
-- de plus de 200 m de la position annoncée, fenêtre de 10 minutes, retenue d'une heure, dernière heure avant le début).
--  event_update_preview(p) : exécute event_update(p) dans un sous-bloc, puis lève EVP01 avec le résultat en DETAIL : le
--  sous-bloc est annulé (événement, catégories, avis, journal : rien n'est écrit), le résultat est rendu. Mêmes contrôles
--  que l'enregistrement (propriétaire, version attendue, statut, compte suspendu en lecture seule, verrous après ventes),
--  mêmes refus. Rend : ok, changed_fields, sms_recipients, sms_notice_at, sms_notice_immediate, sms_notice_held,
--  place_notice_at (ou le refus d'event_update tel quel).
-- Sans BEGIN ni COMMIT, rejouable : CREATE OR REPLACE ; aucune donnée écrite.

CREATE OR REPLACE FUNCTION public.event_update_preview(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
    v_detail text;
BEGIN
    BEGIN
        v_result := public.event_update(p);
        -- Annulation du sous-bloc : rien de ce qu'event_update a écrit ne reste (la ligne de l'événement n'est pas rendue)
        RAISE EXCEPTION 'EVENT_UPDATE_PREVIEW' USING ERRCODE = 'EVP01', DETAIL = (COALESCE(v_result, '{}'::jsonb) - 'event')::text;
    EXCEPTION WHEN SQLSTATE 'EVP01' THEN
        GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
        v_result := v_detail::jsonb;
    END;

    IF (v_result->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_result;
    END IF;
    RETURN jsonb_build_object(
        'ok', true,
        'changed_fields', COALESCE(v_result->'changed_fields', '[]'::jsonb),
        'sms_recipients', COALESCE((v_result->>'sms_recipients')::integer, 0),
        'sms_notice_at', v_result->'sms_notice_at',
        'sms_notice_immediate', COALESCE((v_result->>'sms_notice_immediate')::boolean, false),
        'sms_notice_held', COALESCE((v_result->>'sms_notice_held')::boolean, false),
        'place_notice_at', v_result->'place_notice_at');
END;
$$;

COMMENT ON FUNCTION public.event_update_preview(jsonb) IS
    'Finition 2b (D, E-27) : aperçu d''une modification (nombre de SMS, heure réelle de l''avis) par event_update exécuté puis annulé (EVP01) ; mêmes contrôles et refus, rien n''est écrit.';

REVOKE ALL ON FUNCTION public.event_update_preview(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_update_preview(jsonb) TO service_role;
