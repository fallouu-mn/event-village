-- ============================================================================
-- Lot 6, tâche 6.10 — cloche et centre de notifications (contrat F1 second temps, N1)
-- ============================================================================
-- F1, second temps (après la réécriture de tous les écrivains en 05 et 06) :
--   - notifications.channel ne vaut plus que 'IN_APP' : les anciennes lignes PUSH (cloche du lot 5)
--     deviennent IN_APP ; les traces d'envoi SMS, EMAIL ou WHATSAPP gardent leur canal d'origine dans
--     metadata.legacy_channel ; défaut 'IN_APP' et contrainte notifications_channel_in_app ;
--   - plus aucune écriture REST : politiques notifications_insert_admin et notifications_update_own
--     supprimées, INSERT, UPDATE, DELETE, TRUNCATE révoqués pour anon et authenticated. La lecture de ses
--     propres notifications (cloche, temps réel) reste régie par notifications_read_own (migration 01).
--     Seuls écrivent : notification_outbox_mark (livraison in-app), notifications_mark_read (ci-dessous)
--     et le service_role des tests.
-- N1 : notifications_page (liste et compteur sur le même ensemble, non lues d'abord, paginée) et
--   notifications_mark_read (une ou toutes, au compte seulement).
-- notification_channel_enum n'est plus utilisé et reste défini (aucune dépendance).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- F1, second temps — données, défaut, contrainte
-- ----------------------------------------------------------------------------
UPDATE public.notifications
   SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('legacy_channel', channel)
 WHERE channel NOT IN ('PUSH', 'IN_APP')
   AND NOT (COALESCE(metadata, '{}'::jsonb) ? 'legacy_channel');

UPDATE public.notifications SET channel = 'IN_APP' WHERE channel IS DISTINCT FROM 'IN_APP';

ALTER TABLE public.notifications ALTER COLUMN channel SET DEFAULT 'IN_APP';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.notifications'::regclass AND conname = 'notifications_channel_in_app'
    ) THEN
        ALTER TABLE public.notifications ADD CONSTRAINT notifications_channel_in_app CHECK (channel = 'IN_APP');
    END IF;
END;
$$;

COMMENT ON COLUMN public.notifications.channel IS
    'Lot 6 (F1) : toujours IN_APP (la cloche). Les envois SMS, email et push sont tracés dans notification_outbox.';

-- ----------------------------------------------------------------------------
-- F1, second temps — plus aucune écriture par REST
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_insert_admin" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.notifications FROM anon, authenticated;

-- Liste de la cloche : non lues d'abord, puis date et id décroissants (N1).
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications (user_id, (status = 'READ'), created_at DESC, id DESC);

-- ----------------------------------------------------------------------------
-- N1 — notifications_page(p)
-- p = { user_id, page (>= 1, défaut 1), page_size (1..100, défaut 20), filter: 'all' | 'unread' (défaut
--       'all'), types?: text[] }
-- Ensemble : toutes les lignes notifications du compte (canal IN_APP par construction, F1).
-- Tri : (status = 'READ') ASC, created_at DESC, id DESC. total = lignes du filtre et des types ;
-- unread_count = non lues du compte, sans filtre de type (le badge de la cloche).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notifications_page(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user   uuid;
    v_page   integer;
    v_size   integer;
    v_filter text;
    v_types  text[];
    v_items  jsonb;
    v_total  bigint;
    v_unread bigint;
    v_bad    jsonb := jsonb_build_object('ok', false, 'code', 'INVALID_INPUT',
                         'message', 'Paramètres de la liste des notifications invalides.');
BEGIN
    IF p IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object' THEN
        RETURN v_bad;
    END IF;
    IF COALESCE(p->>'user_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN v_bad;
    END IF;
    v_user := (p->>'user_id')::uuid;

    IF COALESCE(p->>'page', '1') !~ '^[1-9][0-9]{0,5}$' THEN
        RETURN v_bad;
    END IF;
    v_page := COALESCE(p->>'page', '1')::integer;

    IF COALESCE(p->>'page_size', '20') !~ '^[1-9][0-9]{0,2}$' THEN
        RETURN v_bad;
    END IF;
    v_size := COALESCE(p->>'page_size', '20')::integer;
    IF v_size > 100 THEN
        RETURN v_bad;
    END IF;

    v_filter := COALESCE(p->>'filter', 'all');
    IF v_filter NOT IN ('all', 'unread') THEN
        RETURN v_bad;
    END IF;

    IF p ? 'types' AND jsonb_typeof(p->'types') IS DISTINCT FROM 'null' THEN
        IF jsonb_typeof(p->'types') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'types') > 100 THEN
            RETURN v_bad;
        END IF;
        IF EXISTS (
            SELECT 1 FROM jsonb_array_elements(p->'types') AS t(v)
             WHERE jsonb_typeof(t.v) IS DISTINCT FROM 'string' OR (t.v #>> '{}') !~ '^[A-Z][A-Z0-9_]{0,63}$'
        ) THEN
            RETURN v_bad;
        END IF;
        v_types := ARRAY(SELECT jsonb_array_elements_text(p->'types'));
    END IF;

    SELECT count(*) INTO v_total
      FROM public.notifications n
     WHERE n.user_id = v_user
       AND (v_filter = 'all' OR n.status <> 'READ')
       AND (v_types IS NULL OR n.type = ANY (v_types));

    SELECT count(*) INTO v_unread
      FROM public.notifications n
     WHERE n.user_id = v_user AND n.status <> 'READ';

    SELECT COALESCE(jsonb_agg(s.j ORDER BY s.is_read, s.created_at DESC, s.id DESC), '[]'::jsonb)
      INTO v_items
      FROM (
            SELECT to_jsonb(n) AS j, (n.status = 'READ') AS is_read, n.created_at, n.id
              FROM public.notifications n
             WHERE n.user_id = v_user
               AND (v_filter = 'all' OR n.status <> 'READ')
               AND (v_types IS NULL OR n.type = ANY (v_types))
             ORDER BY (n.status = 'READ'), n.created_at DESC, n.id DESC
             LIMIT v_size OFFSET (v_page - 1)::bigint * v_size
           ) s;

    RETURN jsonb_build_object(
        'ok', true,
        'items', v_items,
        'total', v_total,
        'unread_count', v_unread,
        'page', v_page,
        'page_size', v_size
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- N1 — notifications_mark_read(p)
-- p = { user_id, id? } : une ligne (si elle est au compte) ou toutes les non lues du compte →
-- status = 'READ', read_at = now(). Réponse { ok, updated, found? } : `found` (avec `id`) dit si la ligne
-- existe et appartient au compte (déjà lue : found vrai, updated 0) ; la route répond 404 sinon.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notifications_mark_read(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user  uuid;
    v_id    uuid;
    v_found boolean;
    v_n     integer;
BEGIN
    IF p IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object'
       OR COALESCE(p->>'user_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Compte absent.');
    END IF;
    v_user := (p->>'user_id')::uuid;

    IF p ? 'id' AND jsonb_typeof(p->'id') IS DISTINCT FROM 'null' THEN
        IF COALESCE(p->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Notification inconnue.');
        END IF;
        v_id := (p->>'id')::uuid;
        SELECT EXISTS (SELECT 1 FROM public.notifications n WHERE n.id = v_id AND n.user_id = v_user) INTO v_found;
        UPDATE public.notifications n
           SET status = 'READ', read_at = now()
         WHERE n.id = v_id AND n.user_id = v_user AND n.status <> 'READ';
        GET DIAGNOSTICS v_n = ROW_COUNT;
        RETURN jsonb_build_object('ok', true, 'updated', v_n, 'found', v_found);
    END IF;

    UPDATE public.notifications n
       SET status = 'READ', read_at = now()
     WHERE n.user_id = v_user AND n.status <> 'READ';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN jsonb_build_object('ok', true, 'updated', v_n);
END;
$$;

-- ----------------------------------------------------------------------------
-- Privilèges (règle 1A.3) : service_role seul
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_sig text;
BEGIN
    FOREACH v_sig IN ARRAY ARRAY[
        'public.notifications_page(jsonb)',
        'public.notifications_mark_read(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
    END LOOP;
END;
$$;
