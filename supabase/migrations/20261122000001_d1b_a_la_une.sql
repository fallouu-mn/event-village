-- Design 1b (À LA UNE) — événements « À la une » de l'accueil, choisis par le SUPERADMIN.
--
-- Système NEUF, indépendant de l'ancienne mise en avant (events.is_featured, events.featured_until, sponsored_promotions,
-- 20260902000003 ; écriture service_role seulement depuis 20261110000001), laissée telle quelle.
--
-- 1. public.home_featured : un placement par ligne (événement, rang, fenêtre d'affichage facultative, étiquette, motif,
--    auteur, retrait). Un seul placement actif par événement (index unique partiel). RLS activée, AUCUNE politique :
--    anon et authenticated n'y ont aucun droit ; le service_role ne fait que LIRE ; toute écriture passe par les fonctions
--    ci-dessous (SECURITY DEFINER), qui revérifient le Superadmin.
--    Étiquette : 'A_LA_UNE' (défaut) ; 'SPONSORISE' admise par la table (champ prévu pour plus tard) mais REFUSÉE à la
--    saisie (LABEL_NOT_OPEN) tant qu'elle n'est pas ouverte : l'ouvrir demandera une décision (contrat, paiement,
--    mention légale) et une nouvelle version de home_featured_add, sans changer la table ni les lectures.
--    Motif : 3 à 500 caractères, espaces regroupés (retours à la ligne et tabulations compris), aucun caractère de
--    contrôle (C0, DEL, C1) ni contrôle de sens d'écriture (U+061C, U+200E, U+200F, U+202A à U+202E, U+2066 à U+2069),
--    même liste que la consigne d'entrée (20261121000008) ; vérifié par la fonction ET par une contrainte de la table.
-- 2. Lecture publique : public.home_featured_public(p_limit) rend seulement (event_id, sort_order, label) des placements
--    actifs valides : événement PUBLIE, non terminé (event_end_at > now()), dans la fenêtre d'affichage ; jamais l'auteur
--    ni le motif. Réservée au service_role (comme events_popular) : l'accueil la lit côté serveur
--    (lib/events/featured.server.ts).
-- 3. Écritures du Superadmin (service_role seulement, appelées par app/api/admin/a-la-une/**) : home_featured_add,
--    home_featured_reorder, home_featured_set_window, home_featured_remove. Chacune : compte ACTIF au rôle SUPERADMIN
--    (user_roles) revérifié ; mot de passe et code administrateur de moins de 10 minutes revérifiés
--    (admin_identity_check, 20261120000003) ; verrou unique de la liste (pg_advisory_xact_lock) ; événement relu FOR SHARE
--    (une annulation simultanée attend, puis le refus suit) ; journal audit_logs (object_type 'home_featured') dans la
--    même transaction.
--    Lectures de l'administration : home_featured_admin_list (liste, historique, journal), home_featured_candidates
--    (événements publiés non terminés à proposer) ; Superadmin revérifié.
-- 4. Retrait automatique : trigger AFTER UPDATE OF status sur events : un événement qui quitte PUBLIE (annulé, suspendu,
--    terminé — y compris par le cron events_finish_overdue —, revenu à l'état validé ou brouillon) perd son placement
--    actif, avec un motif automatique et un journal HOME_FEATURED_AUTO_REMOVED (auteur : aucun, rôle SYSTEM). Une fin
--    passée avant le passage du cron est déjà exclue à la lecture.
--
-- Sans BEGIN ni COMMIT ; rejouable (IF NOT EXISTS, CREATE OR REPLACE, DROP … IF EXISTS, REVOKE et GRANT idempotents).

-- ----------------------------------------------------------------------------
-- 1. Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.home_featured (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id       uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    sort_order     integer NOT NULL,
    label          text NOT NULL DEFAULT 'A_LA_UNE',
    starts_at      timestamptz,
    ends_at        timestamptz,
    reason         text NOT NULL,
    created_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    removed_at     timestamptz,
    removed_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
    removed_reason text,
    removed_code   text
);

ALTER TABLE public.home_featured DROP CONSTRAINT IF EXISTS home_featured_sort_order_check;
ALTER TABLE public.home_featured ADD CONSTRAINT home_featured_sort_order_check CHECK (sort_order BETWEEN 1 AND 1000);
ALTER TABLE public.home_featured DROP CONSTRAINT IF EXISTS home_featured_label_check;
ALTER TABLE public.home_featured ADD CONSTRAINT home_featured_label_check CHECK (label IN ('A_LA_UNE', 'SPONSORISE'));
ALTER TABLE public.home_featured DROP CONSTRAINT IF EXISTS home_featured_window_check;
ALTER TABLE public.home_featured ADD CONSTRAINT home_featured_window_check
    CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at);
ALTER TABLE public.home_featured DROP CONSTRAINT IF EXISTS home_featured_reason_check;
ALTER TABLE public.home_featured ADD CONSTRAINT home_featured_reason_check
    CHECK (char_length(reason) BETWEEN 3 AND 500
           AND reason !~ '[\u0001-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]');
ALTER TABLE public.home_featured DROP CONSTRAINT IF EXISTS home_featured_removed_check;
ALTER TABLE public.home_featured ADD CONSTRAINT home_featured_removed_check
    CHECK ((removed_at IS NULL AND removed_reason IS NULL AND removed_code IS NULL AND removed_by IS NULL)
        OR (removed_at IS NOT NULL AND removed_reason IS NOT NULL AND removed_code IS NOT NULL));
ALTER TABLE public.home_featured DROP CONSTRAINT IF EXISTS home_featured_removed_reason_check;
ALTER TABLE public.home_featured ADD CONSTRAINT home_featured_removed_reason_check
    CHECK (removed_reason IS NULL OR (char_length(removed_reason) BETWEEN 3 AND 500
           AND removed_reason !~ '[\u0001-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]'));
ALTER TABLE public.home_featured DROP CONSTRAINT IF EXISTS home_featured_removed_code_check;
ALTER TABLE public.home_featured ADD CONSTRAINT home_featured_removed_code_check
    CHECK (removed_code IS NULL OR removed_code IN ('MANUAL', 'EVENT_CANCELLED', 'EVENT_SUSPENDED', 'EVENT_FINISHED', 'EVENT_UNPUBLISHED'));

CREATE UNIQUE INDEX IF NOT EXISTS home_featured_one_active_per_event ON public.home_featured (event_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS home_featured_active_order ON public.home_featured (sort_order, created_at, id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS home_featured_removed_at ON public.home_featured (removed_at DESC) WHERE removed_at IS NOT NULL;

ALTER TABLE public.home_featured ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.home_featured FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.home_featured TO service_role;

COMMENT ON TABLE public.home_featured IS
    'Design 1b : événements « À la une » de l''accueil, choisis par le Superadmin. Écriture seulement par les fonctions home_featured_* (SECURITY DEFINER).';

-- ----------------------------------------------------------------------------
-- Aides internes (aucun droit d'exécution hors du propriétaire)
-- ----------------------------------------------------------------------------
-- Motif nettoyé : espaces regroupés (retours à la ligne et tabulations compris), bords retirés. NULL si absent, hors de
-- 3 à 500 caractères ou porteur d'un caractère de contrôle ou d'un contrôle de sens d'écriture.
CREATE OR REPLACE FUNCTION public.home_featured_clean_reason(p_raw jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v text;
BEGIN
    IF p_raw IS NULL OR jsonb_typeof(p_raw) <> 'string' THEN
        RETURN NULL;
    END IF;
    v := btrim(regexp_replace(p_raw #>> '{}', '[\s ]+', ' ', 'g'));
    IF v ~ '[\u0001-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]' THEN
        RETURN NULL;
    END IF;
    IF char_length(v) < 3 OR char_length(v) > 500 THEN
        RETURN NULL;
    END IF;
    RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.home_featured_clean_reason(jsonb) FROM PUBLIC, anon, authenticated;
-- Règle du projet (fonctions-privileges, groupe b ; 03-verification 1A.3) : toute fonction publique reste exécutable par
-- service_role (le serveur), jamais par anon ni authenticated
GRANT EXECUTE ON FUNCTION public.home_featured_clean_reason(jsonb) TO service_role;

-- Code du refus d'un motif (pour un message juste) : REASON_REQUIRED ou REASON_INVALID_CHARACTERS.
CREATE OR REPLACE FUNCTION public.home_featured_reason_refusal(p_raw jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_raw IS NOT NULL AND jsonb_typeof(p_raw) = 'string'
       AND regexp_replace(p_raw #>> '{}', '[\s ]+', ' ', 'g') ~ '[\u0001-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_INVALID_CHARACTERS',
                                  'message', 'Le motif contient un caractère invisible ou de contrôle : retirez-le.');
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif (3 à 500 caractères).');
END;
$$;
REVOKE ALL ON FUNCTION public.home_featured_reason_refusal(jsonb) FROM PUBLIC, anon, authenticated;
-- Règle du projet (fonctions-privileges, groupe b ; 03-verification 1A.3) : toute fonction publique reste exécutable par
-- service_role (le serveur), jamais par anon ni authenticated
GRANT EXECUTE ON FUNCTION public.home_featured_reason_refusal(jsonb) TO service_role;

-- Superadmin actif (user_roles, jamais users.role) puis mot de passe et code administrateur de moins de 10 minutes.
-- NULL si l'auteur peut écrire ; sinon le refus.
CREATE OR REPLACE FUNCTION public.home_featured_actor_refusal(p jsonb, p_identity boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_identity text;
BEGIN
    IF v_actor IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
       OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SUPERADMIN_ONLY', 'message', 'Seul un Superadmin choisit les événements à la une.');
    END IF;
    IF p_identity THEN
        v_identity := public.admin_identity_check(jsonb_build_object('user_id', v_actor, 'session_id', p->>'session_id', 'device_key', p->>'device_key'));
        IF v_identity IS NOT NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', v_identity,
                'message', CASE v_identity WHEN 'PASSWORD_CONFIRMATION_REQUIRED' THEN 'Par sécurité, saisissez votre mot de passe pour continuer.'
                                           ELSE 'Par sécurité, saisissez le code administrateur reçu par SMS pour continuer.' END);
        END IF;
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.home_featured_actor_refusal(jsonb, boolean) FROM PUBLIC, anon, authenticated;
-- Règle du projet (fonctions-privileges, groupe b ; 03-verification 1A.3) : toute fonction publique reste exécutable par
-- service_role (le serveur), jamais par anon ni authenticated
GRANT EXECUTE ON FUNCTION public.home_featured_actor_refusal(jsonb, boolean) TO service_role;

-- Horodatage facultatif lu dans p->key : (ok, valeur). Une chaîne vide ou null vaut « aucun ».
CREATE OR REPLACE FUNCTION public.home_featured_ts(p jsonb, p_key text, OUT ok boolean, OUT value timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    ok := true;
    value := NULL;
    IF NOT (p ? p_key) OR jsonb_typeof(p->p_key) = 'null' OR btrim(COALESCE(p->>p_key, '')) = '' THEN
        RETURN;
    END IF;
    IF jsonb_typeof(p->p_key) <> 'string' OR char_length(p->>p_key) > 40 THEN
        ok := false;
        RETURN;
    END IF;
    BEGIN
        value := (p->>p_key)::timestamptz;
    EXCEPTION WHEN others THEN
        ok := false;
        value := NULL;
    END;
END;
$$;
REVOKE ALL ON FUNCTION public.home_featured_ts(jsonb, text) FROM PUBLIC, anon, authenticated;
-- Règle du projet (fonctions-privileges, groupe b ; 03-verification 1A.3) : toute fonction publique reste exécutable par
-- service_role (le serveur), jamais par anon ni authenticated
GRANT EXECUTE ON FUNCTION public.home_featured_ts(jsonb, text) TO service_role;

-- Fenêtre d'affichage contrôlée contre la fin de l'événement : NULL si valable, sinon le refus.
CREATE OR REPLACE FUNCTION public.home_featured_window_refusal(p_starts timestamptz, p_ends timestamptz, p_event_end timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_ends IS NOT NULL AND p_ends <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'WINDOW_IN_PAST', 'message', 'La fin d’affichage est déjà passée : choisissez une date à venir.');
    END IF;
    IF p_starts IS NOT NULL AND p_ends IS NOT NULL AND p_ends <= p_starts THEN
        RETURN jsonb_build_object('ok', false, 'code', 'WINDOW_INVALID', 'message', 'La fin d’affichage doit venir après le début.');
    END IF;
    IF (p_ends IS NOT NULL AND p_ends > p_event_end) OR (p_starts IS NOT NULL AND p_starts >= p_event_end) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'WINDOW_AFTER_EVENT', 'message', 'L’affichage s’arrête au plus tard à la fin de l’événement.');
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.home_featured_window_refusal(timestamptz, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
-- Règle du projet (fonctions-privileges, groupe b ; 03-verification 1A.3) : toute fonction publique reste exécutable par
-- service_role (le serveur), jamais par anon ni authenticated
GRANT EXECUTE ON FUNCTION public.home_featured_window_refusal(timestamptz, timestamptz, timestamptz) TO service_role;

-- Rangs des placements actifs remis à 1..n dans l'ordre courant.
CREATE OR REPLACE FUNCTION public.home_featured_renumber()
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.home_featured f
       SET sort_order = s.rn
      FROM (SELECT h.id, row_number() OVER (ORDER BY h.sort_order, h.created_at, h.id)::integer AS rn
              FROM public.home_featured h WHERE h.removed_at IS NULL) s
     WHERE f.id = s.id AND f.sort_order <> s.rn;
$$;
REVOKE ALL ON FUNCTION public.home_featured_renumber() FROM PUBLIC, anon, authenticated;
-- Règle du projet (fonctions-privileges, groupe b ; 03-verification 1A.3) : toute fonction publique reste exécutable par
-- service_role (le serveur), jamais par anon ni authenticated
GRANT EXECUTE ON FUNCTION public.home_featured_renumber() TO service_role;

-- ----------------------------------------------------------------------------
-- 2. Lecture publique (accueil)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.home_featured_public(p_limit integer DEFAULT 10)
RETURNS TABLE (event_id uuid, sort_order integer, label text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT v.event_id, (row_number() OVER (ORDER BY v.sort_order, v.created_at, v.id))::integer AS sort_order, v.label
      FROM (
        SELECT f.id, f.event_id, f.sort_order, f.created_at, f.label
          FROM public.home_featured f
          JOIN public.events e ON e.id = f.event_id
         WHERE f.removed_at IS NULL
           AND e.status = 'PUBLIE'
           AND public.event_end_at(e.id) > now()
           AND (f.starts_at IS NULL OR f.starts_at <= now())
           AND (f.ends_at IS NULL OR f.ends_at > now())
         ORDER BY f.sort_order, f.created_at, f.id
         LIMIT LEAST(GREATEST(COALESCE(p_limit, 0), 0), 20)
      ) v
     ORDER BY v.sort_order, v.created_at, v.id
$$;
REVOKE ALL ON FUNCTION public.home_featured_public(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_featured_public(integer) TO service_role;

-- ----------------------------------------------------------------------------
-- 3a. Ajouter un événement à la une (à la fin de la liste)
-- ----------------------------------------------------------------------------
-- p : { actor_id, session_id, device_key, event_id, starts_at?, ends_at?, reason, label? }
CREATE OR REPLACE FUNCTION public.home_featured_add(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_event   uuid := public.try_uuid(p->>'event_id');
    v_label   text := upper(btrim(COALESCE(p->>'label', 'A_LA_UNE')));
    v_refusal jsonb;
    v_reason  text;
    v_starts  record;
    v_ends    record;
    v_status  text;
    v_title   text;
    v_end     timestamptz;
    v_count   integer;
    v_pos     integer;
    v_id      uuid;
BEGIN
    IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande incomplète.');
    END IF;
    v_refusal := public.home_featured_actor_refusal(p, true);
    IF v_refusal IS NOT NULL THEN RETURN v_refusal; END IF;
    IF v_event IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Choisissez un événement.');
    END IF;
    IF v_label = 'SPONSORISE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'LABEL_NOT_OPEN', 'message', 'L’étiquette « Sponsorisé » n’est pas encore ouverte.');
    END IF;
    IF v_label <> 'A_LA_UNE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Étiquette inconnue.');
    END IF;
    v_reason := public.home_featured_clean_reason(p->'reason');
    IF v_reason IS NULL THEN RETURN public.home_featured_reason_refusal(p->'reason'); END IF;
    SELECT * INTO v_starts FROM public.home_featured_ts(p, 'starts_at');
    SELECT * INTO v_ends FROM public.home_featured_ts(p, 'ends_at');
    IF NOT v_starts.ok OR NOT v_ends.ok THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATE', 'message', 'Date d’affichage illisible.');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('public.home_featured'));

    SELECT e.status::text, e.title INTO v_status, v_title FROM public.events e WHERE e.id = v_event FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF v_status <> 'PUBLIE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_PUBLISHED', 'message', 'Seul un événement publié peut être mis à la une.');
    END IF;
    v_end := public.event_end_at(v_event);
    IF v_end <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_FINISHED', 'message', 'Cet événement est terminé : il ne peut plus être mis à la une.');
    END IF;
    v_refusal := public.home_featured_window_refusal(v_starts.value, v_ends.value, v_end);
    IF v_refusal IS NOT NULL THEN RETURN v_refusal; END IF;
    IF EXISTS (SELECT 1 FROM public.home_featured f WHERE f.event_id = v_event AND f.removed_at IS NULL) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_FEATURED', 'message', 'Cet événement est déjà à la une.');
    END IF;
    SELECT count(*)::integer, COALESCE(max(f.sort_order), 0) INTO v_count, v_pos FROM public.home_featured f WHERE f.removed_at IS NULL;
    IF v_count >= 20 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'LIMIT_REACHED', 'message', 'La une compte déjà 20 événements : retirez-en un d’abord.');
    END IF;

    INSERT INTO public.home_featured (event_id, sort_order, label, starts_at, ends_at, reason, created_by)
    VALUES (v_event, LEAST(v_pos + 1, 1000), v_label, v_starts.value, v_ends.value, v_reason, v_actor)
    RETURNING id INTO v_id;
    PERFORM public.home_featured_renumber();
    SELECT f.sort_order INTO v_pos FROM public.home_featured f WHERE f.id = v_id;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, 'SUPERADMIN', 'HOME_FEATURED_ADDED', 'home_featured', v_id, NULL,
            jsonb_build_object('event_id', v_event, 'sort_order', v_pos, 'label', v_label, 'starts_at', v_starts.value, 'ends_at', v_ends.value),
            jsonb_build_object('reason', v_reason, 'event_id', v_event, 'event_title', v_title));

    RETURN jsonb_build_object('ok', true, 'id', v_id, 'sort_order', v_pos);
END;
$$;
REVOKE ALL ON FUNCTION public.home_featured_add(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_featured_add(jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- 3b. Ordonner : la liste complète des placements actifs, dans le nouvel ordre
-- ----------------------------------------------------------------------------
-- p : { actor_id, session_id, device_key, ids: [uuid…], reason? }. La liste doit être exactement celle des placements
-- actifs (sinon ORDER_STALE : la liste a changé entre-temps, rien n'est écrit).
CREATE OR REPLACE FUNCTION public.home_featured_reorder(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_refusal jsonb;
    v_reason  text;
    v_ids     uuid[];
    v_bad     integer;
    v_before  jsonb;
    v_after   jsonb;
BEGIN
    IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande incomplète.');
    END IF;
    v_refusal := public.home_featured_actor_refusal(p, true);
    IF v_refusal IS NOT NULL THEN RETURN v_refusal; END IF;
    IF jsonb_typeof(p->'ids') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'ids') = 0 OR jsonb_array_length(p->'ids') > 20 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Ordre illisible.');
    END IF;
    SELECT count(*) FILTER (WHERE public.try_uuid(x) IS NULL)::integer,
           array_agg(public.try_uuid(x) ORDER BY o)
      INTO v_bad, v_ids
      FROM jsonb_array_elements_text(p->'ids') WITH ORDINALITY AS t(x, o);
    IF v_bad > 0 OR (SELECT count(DISTINCT i) FROM unnest(v_ids) AS i) <> cardinality(v_ids) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Ordre illisible.');
    END IF;
    -- Motif facultatif ici ; s'il est donné, il suit les règles des motifs.
    IF p ? 'reason' AND jsonb_typeof(p->'reason') <> 'null' AND btrim(COALESCE(p->>'reason', '')) <> '' THEN
        v_reason := public.home_featured_clean_reason(p->'reason');
        IF v_reason IS NULL THEN RETURN public.home_featured_reason_refusal(p->'reason'); END IF;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('public.home_featured'));

    IF (SELECT count(*) FROM public.home_featured f WHERE f.removed_at IS NULL) <> cardinality(v_ids)
       OR EXISTS (SELECT 1 FROM unnest(v_ids) AS i
                   WHERE NOT EXISTS (SELECT 1 FROM public.home_featured f WHERE f.id = i AND f.removed_at IS NULL)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ORDER_STALE', 'message', 'La liste a changé entre-temps : rechargez la page, puis recommencez.');
    END IF;

    SELECT COALESCE(jsonb_agg(f.event_id ORDER BY f.sort_order, f.created_at, f.id), '[]'::jsonb) INTO v_before
      FROM public.home_featured f WHERE f.removed_at IS NULL;
    UPDATE public.home_featured f
       SET sort_order = t.o::integer, updated_at = clock_timestamp()
      FROM unnest(v_ids) WITH ORDINALITY AS t(id, o)
     WHERE f.id = t.id AND f.sort_order IS DISTINCT FROM t.o::integer;
    SELECT COALESCE(jsonb_agg(f.event_id ORDER BY f.sort_order, f.created_at, f.id), '[]'::jsonb) INTO v_after
      FROM public.home_featured f WHERE f.removed_at IS NULL;

    IF v_before IS DISTINCT FROM v_after THEN
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
        VALUES (v_actor, 'SUPERADMIN', 'HOME_FEATURED_REORDERED', 'home_featured', NULL,
                jsonb_build_object('order', v_before), jsonb_build_object('order', v_after),
                jsonb_build_object('reason', v_reason));
    END IF;

    RETURN jsonb_build_object('ok', true, 'changed', v_before IS DISTINCT FROM v_after, 'order', to_jsonb(v_ids));
END;
$$;
REVOKE ALL ON FUNCTION public.home_featured_reorder(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_featured_reorder(jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- 3c. Modifier les dates d'affichage
-- ----------------------------------------------------------------------------
-- p : { actor_id, session_id, device_key, id, starts_at?, ends_at?, reason }
CREATE OR REPLACE FUNCTION public.home_featured_set_window(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_id      uuid := public.try_uuid(p->>'id');
    v_refusal jsonb;
    v_reason  text;
    v_starts  record;
    v_ends    record;
    v_row     public.home_featured%ROWTYPE;
    v_status  text;
    v_title   text;
    v_end     timestamptz;
BEGIN
    IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande incomplète.');
    END IF;
    v_refusal := public.home_featured_actor_refusal(p, true);
    IF v_refusal IS NOT NULL THEN RETURN v_refusal; END IF;
    IF v_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Cet événement n’est plus à la une.');
    END IF;
    v_reason := public.home_featured_clean_reason(p->'reason');
    IF v_reason IS NULL THEN RETURN public.home_featured_reason_refusal(p->'reason'); END IF;
    SELECT * INTO v_starts FROM public.home_featured_ts(p, 'starts_at');
    SELECT * INTO v_ends FROM public.home_featured_ts(p, 'ends_at');
    IF NOT v_starts.ok OR NOT v_ends.ok THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DATE', 'message', 'Date d’affichage illisible.');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('public.home_featured'));

    SELECT * INTO v_row FROM public.home_featured f WHERE f.id = v_id AND f.removed_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Cet événement n’est plus à la une.');
    END IF;
    SELECT e.status::text, e.title INTO v_status, v_title FROM public.events e WHERE e.id = v_row.event_id FOR SHARE;
    IF v_status IS DISTINCT FROM 'PUBLIE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_PUBLISHED', 'message', 'Cet événement n’est plus publié.');
    END IF;
    v_end := public.event_end_at(v_row.event_id);
    IF v_end <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_FINISHED', 'message', 'Cet événement est terminé.');
    END IF;
    v_refusal := public.home_featured_window_refusal(v_starts.value, v_ends.value, v_end);
    IF v_refusal IS NOT NULL THEN RETURN v_refusal; END IF;

    UPDATE public.home_featured
       SET starts_at = v_starts.value, ends_at = v_ends.value, updated_at = clock_timestamp()
     WHERE id = v_id;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, 'SUPERADMIN', 'HOME_FEATURED_WINDOW_SET', 'home_featured', v_id,
            jsonb_build_object('starts_at', v_row.starts_at, 'ends_at', v_row.ends_at),
            jsonb_build_object('starts_at', v_starts.value, 'ends_at', v_ends.value),
            jsonb_build_object('reason', v_reason, 'event_id', v_row.event_id, 'event_title', v_title));

    RETURN jsonb_build_object('ok', true, 'id', v_id, 'starts_at', v_starts.value, 'ends_at', v_ends.value);
END;
$$;
REVOKE ALL ON FUNCTION public.home_featured_set_window(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_featured_set_window(jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- 3d. Retirer un événement de la une
-- ----------------------------------------------------------------------------
-- p : { actor_id, session_id, device_key, id, reason }
CREATE OR REPLACE FUNCTION public.home_featured_remove(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_id      uuid := public.try_uuid(p->>'id');
    v_refusal jsonb;
    v_reason  text;
    v_row     public.home_featured%ROWTYPE;
    v_title   text;
BEGIN
    IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande incomplète.');
    END IF;
    v_refusal := public.home_featured_actor_refusal(p, true);
    IF v_refusal IS NOT NULL THEN RETURN v_refusal; END IF;
    IF v_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Cet événement n’est plus à la une.');
    END IF;
    v_reason := public.home_featured_clean_reason(p->'reason');
    IF v_reason IS NULL THEN RETURN public.home_featured_reason_refusal(p->'reason'); END IF;

    PERFORM pg_advisory_xact_lock(hashtext('public.home_featured'));

    SELECT * INTO v_row FROM public.home_featured f WHERE f.id = v_id AND f.removed_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Cet événement n’est plus à la une.');
    END IF;
    SELECT e.title INTO v_title FROM public.events e WHERE e.id = v_row.event_id;

    UPDATE public.home_featured
       SET removed_at = clock_timestamp(), removed_by = v_actor, removed_reason = v_reason, removed_code = 'MANUAL',
           updated_at = clock_timestamp()
     WHERE id = v_id;
    PERFORM public.home_featured_renumber();

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, 'SUPERADMIN', 'HOME_FEATURED_REMOVED', 'home_featured', v_id,
            jsonb_build_object('event_id', v_row.event_id, 'sort_order', v_row.sort_order, 'label', v_row.label,
                               'starts_at', v_row.starts_at, 'ends_at', v_row.ends_at),
            NULL,
            jsonb_build_object('reason', v_reason, 'event_id', v_row.event_id, 'event_title', v_title));

    RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.home_featured_remove(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_featured_remove(jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- 3e. Lectures de l'administration
-- ----------------------------------------------------------------------------
-- p : { actor_id }. Liste active (dans l'ordre, avec l'état d'affichage), historique des 50 derniers retraits, journal
-- des 100 dernières actions. Pour le Superadmin seulement (jamais servi à une page publique).
CREATE OR REPLACE FUNCTION public.home_featured_admin_list(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_refusal jsonb;
    v_active  jsonb;
    v_history jsonb;
    v_journal jsonb;
BEGIN
    v_refusal := public.home_featured_actor_refusal(COALESCE(p, '{}'::jsonb), false);
    IF v_refusal IS NOT NULL THEN RETURN v_refusal; END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(a)::jsonb ORDER BY a.sort_order, a.created_at, a.id), '[]'::jsonb) INTO v_active
      FROM (
        SELECT f.id, f.event_id, f.sort_order, f.label, f.starts_at, f.ends_at, f.reason, f.created_at,
               e.title, e.slug, e.start_date, e.start_time, e.city, e.image_url, e.status::text AS event_status,
               public.event_end_at(e.id) AS event_end_at,
               NULLIF(btrim(concat_ws(' ', u.first_name, u.last_name)), '') AS created_by_name,
               CASE WHEN e.status::text <> 'PUBLIE' THEN 'EVENT_NOT_PUBLISHED'
                    WHEN public.event_end_at(e.id) <= now() THEN 'EVENT_FINISHED'
                    WHEN f.ends_at IS NOT NULL AND f.ends_at <= now() THEN 'WINDOW_ENDED'
                    WHEN f.starts_at IS NOT NULL AND f.starts_at > now() THEN 'SCHEDULED'
                    ELSE 'LIVE' END AS display_state
          FROM public.home_featured f
          JOIN public.events e ON e.id = f.event_id
          LEFT JOIN public.users u ON u.id = f.created_by
         WHERE f.removed_at IS NULL
      ) a;

    SELECT COALESCE(jsonb_agg(row_to_json(h)::jsonb ORDER BY h.removed_at DESC, h.id), '[]'::jsonb) INTO v_history
      FROM (
        SELECT f.id, f.event_id, f.label, f.reason, f.created_at, f.removed_at, f.removed_reason, f.removed_code,
               e.title,
               NULLIF(btrim(concat_ws(' ', u.first_name, u.last_name)), '') AS created_by_name,
               NULLIF(btrim(concat_ws(' ', r.first_name, r.last_name)), '') AS removed_by_name
          FROM public.home_featured f
          JOIN public.events e ON e.id = f.event_id
          LEFT JOIN public.users u ON u.id = f.created_by
          LEFT JOIN public.users r ON r.id = f.removed_by
         WHERE f.removed_at IS NOT NULL
         ORDER BY f.removed_at DESC, f.id
         LIMIT 50
      ) h;

    SELECT COALESCE(jsonb_agg(row_to_json(j)::jsonb ORDER BY j.created_at DESC, j.id), '[]'::jsonb) INTO v_journal
      FROM (
        SELECT l.id, l.created_at, l.action, l.user_role,
               CASE WHEN l.user_id IS NULL THEN NULL
                    ELSE COALESCE(NULLIF(btrim(concat_ws(' ', u.first_name, u.last_name)), ''), 'Un Superadmin') END AS actor_name,
               l.metadata->>'reason' AS reason,
               COALESCE(l.metadata->>'event_title', e.title) AS event_title
          FROM public.audit_logs l
          LEFT JOIN public.users u ON u.id = l.user_id
          LEFT JOIN public.events e ON e.id = public.try_uuid(l.metadata->>'event_id')
         WHERE l.object_type = 'home_featured'
         ORDER BY l.created_at DESC, l.id
         LIMIT 100
      ) j;

    RETURN jsonb_build_object('ok', true, 'active', v_active, 'history', v_history, 'journal', v_journal);
END;
$$;
REVOKE ALL ON FUNCTION public.home_featured_admin_list(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_featured_admin_list(jsonb) TO service_role;

-- p : { actor_id, q?, limit? }. Événements PUBLIE non terminés, pas déjà à la une ; titre ou ville contenant q (sans
-- jokers : % et _ pris à la lettre) ; les plus proches d'abord ; 20 au plus.
CREATE OR REPLACE FUNCTION public.home_featured_candidates(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_refusal jsonb;
    v_q       text := btrim(regexp_replace(COALESCE(p->>'q', ''), '[\s ]+', ' ', 'g'));
    v_limit   integer := 20;
    v_like    text;
    v_rows    jsonb;
BEGIN
    v_refusal := public.home_featured_actor_refusal(COALESCE(p, '{}'::jsonb), false);
    IF v_refusal IS NOT NULL THEN RETURN v_refusal; END IF;
    IF p->>'limit' ~ '^\d{1,3}$' THEN
        v_limit := LEAST(GREATEST((p->>'limit')::integer, 1), 20);
    END IF;
    v_q := regexp_replace(v_q, '[\u0001-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]', '', 'g');
    IF char_length(v_q) > 100 THEN
        v_q := left(v_q, 100);
    END IF;
    v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

    SELECT COALESCE(jsonb_agg(row_to_json(c)::jsonb ORDER BY c.event_end_at, c.id), '[]'::jsonb) INTO v_rows
      FROM (
        SELECT e.id, e.title, e.slug, e.start_date, e.start_time, e.city, e.location, e.image_url,
               public.event_end_at(e.id) AS event_end_at
          FROM public.events e
         WHERE e.status = 'PUBLIE'
           AND public.event_end_at(e.id) > now()
           AND NOT EXISTS (SELECT 1 FROM public.home_featured f WHERE f.event_id = e.id AND f.removed_at IS NULL)
           AND (v_q = '' OR e.title ILIKE v_like ESCAPE '\' OR COALESCE(e.city, '') ILIKE v_like ESCAPE '\')
         ORDER BY public.event_start_at(e.id), e.id
         LIMIT v_limit
      ) c;

    RETURN jsonb_build_object('ok', true, 'events', v_rows);
END;
$$;
REVOKE ALL ON FUNCTION public.home_featured_candidates(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_featured_candidates(jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- 4. Retrait automatique quand l'événement quitte PUBLIE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.home_featured_on_event_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_code   text;
    v_reason text;
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status::text = 'PUBLIE' THEN
        RETURN NULL;
    END IF;
    v_code := CASE NEW.status::text
        WHEN 'ANNULE' THEN 'EVENT_CANCELLED'
        WHEN 'SUSPENDU' THEN 'EVENT_SUSPENDED'
        WHEN 'TERMINE' THEN 'EVENT_FINISHED'
        ELSE 'EVENT_UNPUBLISHED' END;
    v_reason := CASE v_code
        WHEN 'EVENT_CANCELLED' THEN 'Retrait automatique : l’événement a été annulé.'
        WHEN 'EVENT_SUSPENDED' THEN 'Retrait automatique : l’événement a été suspendu.'
        WHEN 'EVENT_FINISHED' THEN 'Retrait automatique : l’événement est terminé.'
        ELSE 'Retrait automatique : l’événement n’est plus en vente au public.' END;

    WITH removed AS (
        UPDATE public.home_featured f
           SET removed_at = clock_timestamp(), removed_by = NULL, removed_reason = v_reason, removed_code = v_code,
               updated_at = clock_timestamp()
         WHERE f.event_id = NEW.id AND f.removed_at IS NULL
        RETURNING f.id, f.event_id, f.sort_order, f.label, f.starts_at, f.ends_at
    )
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    SELECT NULL, 'SYSTEM', 'HOME_FEATURED_AUTO_REMOVED', 'home_featured', r.id,
           jsonb_build_object('event_id', r.event_id, 'sort_order', r.sort_order, 'label', r.label, 'starts_at', r.starts_at, 'ends_at', r.ends_at),
           NULL,
           jsonb_build_object('reason', v_reason, 'code', v_code, 'event_id', r.event_id, 'event_title', NEW.title,
                              'event_status', NEW.status::text)
      FROM removed r;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.home_featured_on_event_status() FROM PUBLIC, anon, authenticated;
-- Règle du projet (fonctions-privileges, groupe b ; 03-verification 1A.3) : toute fonction publique reste exécutable par
-- service_role (le serveur), jamais par anon ni authenticated
GRANT EXECUTE ON FUNCTION public.home_featured_on_event_status() TO service_role;

DROP TRIGGER IF EXISTS trg_home_featured_on_event_status ON public.events;
CREATE TRIGGER trg_home_featured_on_event_status
    AFTER UPDATE OF status ON public.events
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.home_featured_on_event_status();
