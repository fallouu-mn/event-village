-- Correctifs de la contre-vérification de la finition 2a, T5 — n'accepter comme affiche que les fichiers produits par la
-- route de dépôt (horodatage_8 caractères.webp : réencodés, sans métadonnée). Rapport d'audit docs/audit-finition-2a.md,
-- T5 : un fichier brut d'avant la finition, déjà dans le dossier de la partenaire (JPEG avec position GPS), était accepté
-- comme affiche puis servi avec ses métadonnées.
--
--   1. event_poster_path_ok (recopie de 20261102000004_lot5_edition.sql) : le nom du fichier doit être celui de la route
--      (13 chiffres, « _ », 8 caractères hexadécimaux, « .webp ») ; contrôlée par event_create, et par event_update quand
--      l'affiche change (une affiche ancienne renvoyée telle quelle reste acceptée) ;
--   2. event_poster_reencoded : nouvelle adresse d'une affiche réencodée par scripts/reencode-posters.ts (même dossier,
--      nom de la route), écrite seulement si l'événement cite encore l'ancienne, journalisée (EVENT_POSTER_REENCODED,
--      SYSTEM) ;
--   3. notif_events_admin_change_alert (recopie de 20261116000006) : ce réencodage n'alerte pas les admins (« affiche »).
-- Aucune donnée existante n'est modifiée par la migration : le réencodage est fait par le script (rapport, T5).
-- Sans BEGIN ni COMMIT (transaction de la CLI), rejouable : CREATE OR REPLACE, DROP TRIGGER IF EXISTS.

-- ----------------------------------------------------------------------------
-- 1. event_poster_path_ok : fichier de la route de dépôt seulement
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_poster_path_ok(p_url text, p_partner uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p_url IS NULL OR (
        position('..' in p_url) = 0
        AND p_url ~ ('^https?://[^?#]*/storage/v1/object/public/public-images/events/' || p_partner::text
                     || '/[0-9]{13}_[0-9a-f]{8}[.]webp$'))
$$;
REVOKE ALL ON FUNCTION public.event_poster_path_ok(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_poster_path_ok(text, uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. event_poster_reencoded : adresse d'une affiche réencodée par le script (comparaison, puis écriture)
-- ----------------------------------------------------------------------------
-- p : { event_id, old_url, new_url }. new_url : fichier de la route dans le dossier events/ de l'ancienne adresse. Rend
-- { ok, updated } : updated = false si l'événement ne cite plus old_url (affiche changée entre-temps).
CREATE OR REPLACE FUNCTION public.event_poster_reencoded(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_old text := NULLIF(p->>'old_url', '');
    v_new text := NULLIF(p->>'new_url', '');
    v_old_folder text;
    v_new_folder text;
    v_id uuid;
BEGIN
    IF v_event IS NULL OR v_old IS NULL OR v_new IS NULL OR position('..' in v_new) > 0
       OR v_new !~ '^https?://[^?#]*/storage/v1/object/public/public-images/events/[0-9a-f-]{36}/[0-9]{13}_[0-9a-f]{8}[.]webp$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Adresses de l''affiche illisibles.');
    END IF;
    -- Même dossier : events/<dossier>/ de l'ancienne adresse
    v_old_folder := substring(v_old from '/storage/v1/object/public/public-images/(events/[0-9a-f-]{36})/[^/?#]+');
    v_new_folder := substring(v_new from '/storage/v1/object/public/public-images/(events/[0-9a-f-]{36})/[^/?#]+$');
    IF v_old_folder IS NULL OR v_old_folder IS DISTINCT FROM v_new_folder THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FOLDER_MISMATCH', 'message', 'L''affiche réencodée doit rester dans le même dossier.');
    END IF;
    PERFORM set_config('event_village.poster_reencode', 'on', true);
    UPDATE public.events SET image_url = v_new WHERE id = v_event AND image_url = v_old RETURNING id INTO v_id;
    PERFORM set_config('event_village.poster_reencode', 'off', true);
    IF v_id IS NOT NULL THEN
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
        VALUES (NULL, 'SYSTEM', 'EVENT_POSTER_REENCODED', 'EVENT', v_event,
                jsonb_build_object('image_url', v_old), jsonb_build_object('image_url', v_new),
                jsonb_build_object('reason', 'Affiche d''avant la finition 2a réencodée (correctifs de la contre-vérification, T5)'));
    END IF;
    RETURN jsonb_build_object('ok', true, 'updated', v_id IS NOT NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.event_poster_reencoded(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_poster_reencoded(jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- 3. notif_events_admin_change_alert (recopie de 20261116000006_f2acv_avis_de_lieu.sql) : le réencodage d'une affiche
--    n'est pas un changement d'affiche ; le reste est inchangé
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_events_admin_change_alert()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_changes text[] := ARRAY[]::text[];
    v_company text;
    v_ref_lat double precision;
    v_ref_lng double precision;
BEGIN
    IF NEW.status::text NOT IN ('VALIDE', 'PUBLIE', 'SUSPENDU') THEN
        RETURN NULL;
    END IF;
    IF NEW.title IS DISTINCT FROM OLD.title THEN
        v_changes := array_append(v_changes, 'TITLE');
    END IF;
    -- Correctifs de la contre-vérification (T5) : le réencodage d'une affiche d'avant la finition (même image, adresse
    -- nouvelle : event_poster_reencoded) n'est pas un changement d'affiche pour l'administration
    IF NEW.image_url IS DISTINCT FROM OLD.image_url
       AND COALESCE(current_setting('event_village.poster_reencode', true), '') <> 'on' THEN
        v_changes := array_append(v_changes, 'POSTER');
    END IF;
    -- Correctifs de la contre-vérification (T3) : repère de référence = position annoncée (à défaut, le repère précédent)
    SELECT pn.announced_latitude, pn.announced_longitude INTO v_ref_lat, v_ref_lng
      FROM public.event_place_notices pn
     WHERE pn.event_id = NEW.id AND pn.announced_latitude IS NOT NULL AND pn.announced_longitude IS NOT NULL;
    IF v_ref_lat IS NULL OR v_ref_lng IS NULL THEN
        v_ref_lat := OLD.latitude;
        v_ref_lng := OLD.longitude;
    END IF;
    IF NEW.location IS DISTINCT FROM OLD.location OR NEW.city IS DISTINCT FROM OLD.city
       OR NULLIF(btrim(COALESCE(NEW.practical_info->>'address', '')), '') IS DISTINCT FROM NULLIF(btrim(COALESCE(OLD.practical_info->>'address', '')), '')
       -- Finition 2a (3), correctifs de la contre-vérification (T3) : repère déplacé, à plus de 200 m de la position annoncée
       -- (des petits pas ne contournent plus l'alerte) ; en deçà : aucune alerte
       OR ((NEW.latitude IS DISTINCT FROM OLD.latitude OR NEW.longitude IS DISTINCT FROM OLD.longitude)
           AND v_ref_lat IS NOT NULL AND v_ref_lng IS NOT NULL AND NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL
           AND public.geo_distance_m(v_ref_lat, v_ref_lng, NEW.latitude, NEW.longitude) > 200) THEN
        v_changes := array_append(v_changes, 'PLACE');
    END IF;
    IF NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.start_time IS DISTINCT FROM OLD.start_time
       OR NEW.end_date IS DISTINCT FROM OLD.end_date OR NEW.end_time IS DISTINCT FROM OLD.end_time THEN
        v_changes := array_append(v_changes, 'DATE');
    END IF;
    IF cardinality(v_changes) = 0 THEN
        RETURN NULL;
    END IF;
    SELECT pa.company_name INTO v_company FROM public.partners pa WHERE pa.id = NEW.partner_id;
    PERFORM public.notif_enqueue_admins(jsonb_build_object(
        'type', 'ADMIN_EVENT_CHANGED', 'ref', NEW.id::text || ':tx' || txid_current()::text, 'event_id', NEW.id,
        'data', COALESCE(public.notif_event_data(NEW.id), '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
            'changes', to_jsonb(v_changes),
            'old_title', CASE WHEN 'TITLE' = ANY (v_changes) THEN OLD.title END,
            'company', v_company))));
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notif_events_admin_change_alert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_events_admin_change_alert ON public.events;
CREATE TRIGGER trg_events_admin_change_alert
    AFTER UPDATE OF title, image_url, location, city, practical_info, start_date, start_time, end_date, end_time, latitude, longitude ON public.events
    FOR EACH ROW
    WHEN (NEW.status::text IN ('VALIDE', 'PUBLIE', 'SUSPENDU'))
    EXECUTE FUNCTION public.notif_events_admin_change_alert();
