-- Design 1d (VITRINE) — couleur des affiches et favoris.
--
-- 1. Couleur de l'affiche (point 1 de la consigne).
--    - events.poster_color : couleur dominante de l'affiche, assombrie pour un contraste d'au moins 4,5:1 avec du texte
--      blanc (« #rrggbb », minuscules) ; NULL sans affiche ou sans calcul : l'écran prend le jeton « bleu nuit ».
--    - events.poster_blur : petite image déjà floutée (WebP en adresse data:, 3 000 caractères au plus) pour le fond de
--      la fiche ; NULL sinon.
--    - public.poster_styles : style calculé au dépôt d'une image (POST /api/partner/upload, lib/images/poster-style.ts),
--      par chemin du fichier dans le compartiment public-images. RLS activée, AUCUNE politique, aucun droit pour anon ni
--      authenticated ; le service_role ne fait que LIRE ; écriture seulement par poster_style_put (SECURITY DEFINER,
--      service_role seulement), qui vérifie le chemin, la couleur (forme ET contraste) et l'image floutée.
--    - Trigger BEFORE INSERT OR UPDATE OF image_url sur events : l'événement prend le style du fichier cité (chemin tiré
--      de l'adresse publique du compartiment) ; affiche retirée, fichier inconnu ou adresse d'un autre hôte : NULL (jamais
--      la couleur de l'ancienne affiche). Aucune autre colonne n'est touchée : ni statut, ni alerte aux admins (le
--      trigger d'alerte ne regarde pas ces deux colonnes).
--    - poster_style_put range aussi le style dans les événements qui citent DÉJÀ ce fichier (script des affiches
--      existantes, scripts/poster-styles.ts) : même règle, en une seule écriture par événement, seulement si le style
--      change (rejouable sans écriture inutile).
-- 2. Favoris (point 8).
--    - public.event_favorites (compte, événement, date) : RLS activée, AUCUNE politique, AUCUN droit de table pour anon,
--      authenticated NI service_role : lecture et écriture uniquement par les fonctions ci-dessous (SECURITY DEFINER,
--      exécutables par le service_role seul). Le compte est TOUJOURS celui de la session, lu par la route serveur
--      (app/api/favorites/**) : aucune fonction ne lit un compte venu du navigateur, une personne ne voit jamais les
--      favoris d'une autre.
--    - event_favorite_set(compte, événement, oui/non) : compte ACTIF exigé ; ajout seulement d'un événement PUBLIE et
--      public (même réponse EVENT_NOT_FOUND pour un événement inconnu, brouillon, en attente, validé, terminé sans
--      publication, suspendu, annulé ou terminé : rien ne laisse deviner l'existence d'un événement non public) ;
--      500 favoris au plus par compte ; retrait toujours permis (idempotent).
--    - event_favorite_list(compte, limite) : événements favoris encore publics (PUBLIE, SUSPENDU, ANNULE, TERMINE publié),
--      du plus récent au plus ancien ; jamais un brouillon ni un événement redevenu non public.
--    - Aucun avis n'est créé ici (le rappel de la veille viendra dans un lot suivant).
--
-- Sans BEGIN ni COMMIT ; rejouable (IF NOT EXISTS, CREATE OR REPLACE, DROP … IF EXISTS, REVOKE et GRANT idempotents).

-- ----------------------------------------------------------------------------
-- 1. Couleur de l'affiche
-- ----------------------------------------------------------------------------
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS poster_color text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS poster_blur text;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_poster_color_check;
ALTER TABLE public.events ADD CONSTRAINT events_poster_color_check
    CHECK (poster_color IS NULL OR poster_color ~ '^#[0-9a-f]{6}$');
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_poster_blur_check;
ALTER TABLE public.events ADD CONSTRAINT events_poster_blur_check
    CHECK (poster_blur IS NULL OR (char_length(poster_blur) <= 3000 AND poster_blur ~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$'));

COMMENT ON COLUMN public.events.poster_color IS
    'Design 1d : couleur dominante de l''affiche, assombrie (contraste >= 4,5:1 avec du blanc). NULL : jeton « bleu nuit ».';
COMMENT ON COLUMN public.events.poster_blur IS
    'Design 1d : petite image floutée de l''affiche (WebP, adresse data:) pour le fond de la fiche. NULL : aucune.';

CREATE TABLE IF NOT EXISTS public.poster_styles (
    path       text PRIMARY KEY,
    color      text NOT NULL,
    blur       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.poster_styles DROP CONSTRAINT IF EXISTS poster_styles_path_check;
ALTER TABLE public.poster_styles ADD CONSTRAINT poster_styles_path_check
    CHECK (char_length(path) <= 200 AND path ~ '^(events|halls|products|misc)/[0-9a-f-]{36}/[^/]+$' AND path !~ '\.\.');
ALTER TABLE public.poster_styles DROP CONSTRAINT IF EXISTS poster_styles_color_check;
ALTER TABLE public.poster_styles ADD CONSTRAINT poster_styles_color_check CHECK (color ~ '^#[0-9a-f]{6}$');
ALTER TABLE public.poster_styles DROP CONSTRAINT IF EXISTS poster_styles_blur_check;
ALTER TABLE public.poster_styles ADD CONSTRAINT poster_styles_blur_check
    CHECK (char_length(blur) <= 3000 AND blur ~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$');

ALTER TABLE public.poster_styles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.poster_styles FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.poster_styles TO service_role;

COMMENT ON TABLE public.poster_styles IS
    'Design 1d : style (couleur, image floutée) de chaque image déposée, par chemin. Écriture seulement par poster_style_put.';

-- Contraste avec du blanc (WCAG 2) d'une couleur « #rrggbb ». Aide interne.
CREATE OR REPLACE FUNCTION public.poster_color_contrast(p_hex text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_c   numeric[];
    v_l   numeric := 0;
    v_x   numeric;
    i     integer;
BEGIN
    IF p_hex IS NULL OR p_hex !~ '^#[0-9a-f]{6}$' THEN
        RETURN NULL;
    END IF;
    v_c := ARRAY[
        ('x' || substr(p_hex, 2, 2))::bit(8)::integer / 255.0,
        ('x' || substr(p_hex, 4, 2))::bit(8)::integer / 255.0,
        ('x' || substr(p_hex, 6, 2))::bit(8)::integer / 255.0
    ];
    FOR i IN 1..3 LOOP
        v_x := CASE WHEN v_c[i] <= 0.03928 THEN v_c[i] / 12.92 ELSE power((v_c[i] + 0.055) / 1.055, 2.4) END;
        v_l := v_l + v_x * (ARRAY[0.2126, 0.7152, 0.0722])[i];
    END LOOP;
    RETURN 1.05 / (v_l + 0.05);
END;
$$;
REVOKE ALL ON FUNCTION public.poster_color_contrast(text) FROM PUBLIC, anon, authenticated;
-- Règle du projet (fonctions-privileges, groupe b ; 03-verification 1A.3) : toute fonction publique reste exécutable par
-- service_role (le serveur), jamais par anon ni authenticated
GRANT EXECUTE ON FUNCTION public.poster_color_contrast(text) TO service_role;

-- Chemin d'un fichier du compartiment public-images tiré de son adresse publique (…/storage/v1/object/public/
-- public-images/<chemin>), NULL pour toute autre adresse. Aide interne.
CREATE OR REPLACE FUNCTION public.poster_path_of(p_url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE
        WHEN p_url IS NULL THEN NULL
        ELSE NULLIF(substring(p_url FROM '/storage/v1/object/public/public-images/([^?#]+)$'), '')
    END;
$$;
REVOKE ALL ON FUNCTION public.poster_path_of(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.poster_path_of(text) TO service_role;

-- Dépôt du style d'un fichier (service_role seulement) : { ok, code?, events } ; events = événements mis à jour.
CREATE OR REPLACE FUNCTION public.poster_style_put(p_path text, p_color text, p_blur text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_events integer := 0;
BEGIN
    IF p_path IS NULL OR char_length(p_path) > 200 OR p_path !~ '^(events|halls|products|misc)/[0-9a-f-]{36}/[^/]+$'
       OR p_path ~ '\.\.' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PATH_INVALID');
    END IF;
    IF p_color IS NULL OR p_color !~ '^#[0-9a-f]{6}$' OR public.poster_color_contrast(p_color) < 4.5 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'COLOR_INVALID');
    END IF;
    IF p_blur IS NULL OR char_length(p_blur) > 3000 OR p_blur !~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'BLUR_INVALID');
    END IF;

    INSERT INTO public.poster_styles AS s (path, color, blur)
    VALUES (p_path, p_color, p_blur)
    ON CONFLICT (path) DO UPDATE SET color = EXCLUDED.color, blur = EXCLUDED.blur, updated_at = now()
     WHERE s.color IS DISTINCT FROM EXCLUDED.color OR s.blur IS DISTINCT FROM EXCLUDED.blur;

    UPDATE public.events e
       SET poster_color = p_color, poster_blur = p_blur
     WHERE public.poster_path_of(e.image_url) = p_path
       AND (e.poster_color IS DISTINCT FROM p_color OR e.poster_blur IS DISTINCT FROM p_blur);
    GET DIAGNOSTICS v_events = ROW_COUNT;

    RETURN jsonb_build_object('ok', true, 'events', v_events);
END;
$$;
REVOKE ALL ON FUNCTION public.poster_style_put(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.poster_style_put(text, text, text) TO service_role;

-- Trigger : l'événement prend le style du fichier cité par image_url (NULL sinon).
CREATE OR REPLACE FUNCTION public.events_poster_style_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_path text;
    s      record;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.image_url IS NOT DISTINCT FROM OLD.image_url THEN
        RETURN NEW;
    END IF;
    v_path := public.poster_path_of(NEW.image_url);
    IF v_path IS NULL THEN
        NEW.poster_color := NULL;
        NEW.poster_blur := NULL;
        RETURN NEW;
    END IF;
    SELECT color, blur INTO s FROM public.poster_styles WHERE path = v_path;
    IF FOUND THEN
        NEW.poster_color := s.color;
        NEW.poster_blur := s.blur;
    ELSE
        NEW.poster_color := NULL;
        NEW.poster_blur := NULL;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.events_poster_style_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.events_poster_style_sync() TO service_role;

DROP TRIGGER IF EXISTS trg_events_poster_style ON public.events;
CREATE TRIGGER trg_events_poster_style
    BEFORE INSERT OR UPDATE OF image_url ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.events_poster_style_sync();

-- ----------------------------------------------------------------------------
-- 2. Favoris
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_favorites (
    user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, event_id)
);
CREATE INDEX IF NOT EXISTS event_favorites_user_recent ON public.event_favorites (user_id, created_at DESC, event_id);
CREATE INDEX IF NOT EXISTS event_favorites_event ON public.event_favorites (event_id);

ALTER TABLE public.event_favorites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.event_favorites FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.event_favorites IS
    'Design 1d : événements favoris de chaque compte. Aucun droit de table : lecture et écriture par event_favorite_set et event_favorite_list (service_role).';

-- Ajout (p_on vrai) ou retrait (faux) d'un favori du compte donné par la route serveur (compte de la session).
CREATE OR REPLACE FUNCTION public.event_favorite_set(p_user uuid, p_event uuid, p_on boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    IF p_user IS NULL OR p_on IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_INACTIVE');
    END IF;
    IF p_event IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND');
    END IF;

    IF NOT p_on THEN
        DELETE FROM public.event_favorites WHERE user_id = p_user AND event_id = p_event;
        RETURN jsonb_build_object('ok', true, 'favorite', false);
    END IF;

    -- Verrou du compte : deux ajouts simultanés ne dépassent pas la limite
    PERFORM pg_advisory_xact_lock(hashtextextended('event_favorites:' || p_user::text, 0));
    IF NOT EXISTS (
        SELECT 1 FROM public.events e
         WHERE e.id = p_event AND e.status::text = 'PUBLIE' AND e.ended_unpublished IS NOT TRUE
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND');
    END IF;
    IF EXISTS (SELECT 1 FROM public.event_favorites WHERE user_id = p_user AND event_id = p_event) THEN
        RETURN jsonb_build_object('ok', true, 'favorite', true);
    END IF;
    SELECT count(*)::int INTO v_count FROM public.event_favorites WHERE user_id = p_user;
    IF v_count >= 500 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FAVORITES_LIMIT');
    END IF;
    INSERT INTO public.event_favorites (user_id, event_id) VALUES (p_user, p_event) ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('ok', true, 'favorite', true);
END;
$$;
REVOKE ALL ON FUNCTION public.event_favorite_set(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_favorite_set(uuid, uuid, boolean) TO service_role;

-- Favoris encore publics du compte donné par la route serveur, du plus récent au plus ancien (500 au plus).
CREATE OR REPLACE FUNCTION public.event_favorite_list(p_user uuid, p_limit integer)
RETURNS TABLE (event_id uuid, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT f.event_id, f.created_at
      FROM public.event_favorites f
      JOIN public.events e ON e.id = f.event_id
     WHERE p_user IS NOT NULL
       AND f.user_id = p_user
       AND e.status::text IN ('PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE')
       AND e.ended_unpublished IS NOT TRUE
     ORDER BY f.created_at DESC, f.event_id
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 500);
$$;
REVOKE ALL ON FUNCTION public.event_favorite_list(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_favorite_list(uuid, integer) TO service_role;
