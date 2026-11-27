-- ============================================================================
-- EVENT VILLAGE — LOT 12c, migration 01 : produits « à vérifier », archivage, enregistrement d'un produit par la base
-- ============================================================================
-- Décisions du client (26/11) : un produit dont le nom, la description ou un supplément contient un mot de la liste
-- (bière, vin, whisky, liqueur, cigarette, chicha…) est « à vérifier » : non vendable jusqu'à la décision de
-- l'administration, l'équipe est prévenue à chaque produit ; liste modifiable par Event Village ; un produit déjà vendu
-- est archivé, jamais supprimé (il disparaît de la carte et reste dans l'historique des commandes).
--  1. products : review_state ('A_VERIFIER' ou vide), review_words (mots trouvés), review_requested_at ; archived_at ;
--     order_delivery_zones.archived_at (zone retirée qui a servi à une commande : la clé étrangère l'empêche d'être
--     supprimée) ;
--  2. réglage orders.review_keywords (liste de mots, écrite par order_review_keywords_set : super-administrateur actif,
--     motif historisé par platform_settings_history). finance_setting_set, fin_setting_valid et
--     platform_settings_defaults ne sont PAS recopiés : la suite d'audit cv12a-3 (S1) n'admet qu'une recopie de ces
--     fonctions après main (même choix que le lot 11c-a, 20261201000001) ; platform_settings_defaults couvre déjà le
--     préfixe orders (20261130000001_l12a_reglages.sql:226) ;
--  3. private.order_text_fold (minuscules, sans accents) et private.order_review_words (mots de la liste trouvés en début
--     de mot, pluriel en s ou x admis : « vin », « vins », pas « vinaigrette ») ;
--  4. product_regulated : recopie de 20261130000002_l12a_catalogue.sql:86-94 ; changement : vrai aussi tant que le
--     produit est à vérifier (devis, ligne, paiement, acceptation et remise refusent donc sans autre changement) ;
--  5. products_order_guard : recopie de 20261130000002_l12a_catalogue.sql:96-139 ; changement : l'état « à vérifier »,
--     les mots trouvés et l'archivage ne s'écrivent que par les fonctions en base (drapeaux event_village.product_write
--     et event_village.product_regulation) ; une écriture directe ne peut ni les poser ni les effacer ;
--  6. order_product_regulation_decide : recopie de 20261130000002_l12a_catalogue.sql:373-415 ; changement : la décision
--     efface l'état « à vérifier » et prévient la partenaire (PRODUCT_REVIEW_DECIDED) ;
--  7. order_product_save(p) : création et modification d'un produit par sa partenaire (fiche VALIDE, compte actif),
--     établissement choisi à la création et jamais changé, catégorie de la partenaire, prix et stock entiers bornés,
--     case « réglementé » et sorte ; l'état « à vérifier » posé par la base dès qu'un mot de la liste apparaît (jamais
--     effacé par une modification) ; avis ADMIN_PRODUCT_REVIEW aux administrateurs (partners.validate) ;
--  8. order_product_remove(p) : produit jamais vendu supprimé ; produit vendu archivé (plus d'erreur de clé étrangère) ;
--  9. avis : ADMIN_PRODUCT_REVIEW (administration : cloche, email) et PRODUCT_REVIEW_DECIDED (partenaire : cloche,
--     notification du téléphone, email).
-- Correctifs de la contre-vérification (docs/audit-lot12c.md), faits EN PLACE (migration jamais appliquée) :
--  T1 une seule fonction de pliage (order_text_fold) : NFKC, accents retirés (NFD), caractères invisibles retirés,
--     lettres cyrilliques et grecques d'aspect latin ramenées au latin ; order_review_words cherche aussi dans le texte
--     où les lettres isolées sont recollées (« W.H.I.S.K.Y », « W H I S K Y ») ;
--  T2 décision liée à la version lue (reviewed_at) : refus REVIEW_CHANGED sinon ;
--  T3 marques courantes au Sénégal dans la liste par défaut ; un changement de la liste revoit les produits existants
--     (order_review_keywords_set → private.order_review_backfill, migration 20261224000005) ;
--  T5 nom de la catégorie compris dans le texte comparé ;
--  T6 produit archivé figé (garde), sauf remise en vente par order_product_save (restore).
-- Toutes les fonctions publiques au rôle de service seulement ; les aides private à aucun rôle de l'API.
-- Rejouable : ADD COLUMN IF NOT EXISTS, DROP … IF EXISTS puis ADD, CREATE OR REPLACE, ON CONFLICT.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Colonnes
-- ----------------------------------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS review_state TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS review_words TEXT[];
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
-- Contre-vérification (T3) : motif d'une mise « à vérifier » par l'administration ; mots déjà vus par une autorisation
-- (la revue des produits existants ne remet pas « à vérifier » un produit autorisé pour ces mots-là)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS review_cleared_words TEXT[];
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_review_state_chk;
ALTER TABLE public.products ADD CONSTRAINT products_review_state_chk CHECK (
    (review_state IS NULL AND review_words IS NULL) OR (review_state = 'A_VERIFIER' AND review_requested_at IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_products_review ON public.products(review_requested_at) WHERE review_state IS NOT NULL;

COMMENT ON COLUMN public.products.review_state IS
    'Lot 12c : « A_VERIFIER » tant que l''administration n''a pas décidé (nom, description ou supplément avec un mot de orders.review_keywords) ; produit non vendable en ligne. Écrit seulement par les fonctions en base.';
COMMENT ON COLUMN public.products.archived_at IS
    'Lot 12c : produit archivé (retiré de la carte, gardé pour l''historique des commandes). Écrit seulement par order_product_remove.';

ALTER TABLE public.order_delivery_zones ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
COMMENT ON COLUMN public.order_delivery_zones.archived_at IS
    'Lot 12c : zone retirée par la partenaire alors qu''une commande l''a utilisée (clé étrangère) : inactive et cachée.';

-- ----------------------------------------------------------------------------
-- 2. Réglage des mots-clés
-- ----------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, description) VALUES
    ('orders.review_keywords',
     '{"value": ["bière", "vin", "whisky", "liqueur", "cigarette", "chicha", "alcool", "rhum", "vodka", "gin", "champagne", "cognac", "tequila", "pastis", "cigare", "tabac", "narguilé", "shisha", "gazelle", "flag", "castel", "33 export", "heineken", "guinness", "desperados", "johnnie walker", "jack daniel''s", "chivas", "smirnoff", "baileys", "martini", "ricard", "marlboro", "dunhill", "camel", "winston"]}',
     'Commandes : mots qui mettent un produit « à vérifier » (non vendable jusqu''à la décision de l''administration)')
ON CONFLICT (key) DO NOTHING;

-- Texte comparé (contre-vérification T1 : SEULE fonction de pliage, utilisée par l'enregistrement, les suppléments, les
-- catégories, la revue et le surlignage de l'administration) : formes de compatibilité (NFKC : pleine chasse, ligatures),
-- accents retirés (NFD puis marques combinantes), caractères invisibles retirés (espaces de largeur nulle, marques de
-- sens, trait d'union conditionnel), caractères de contrôle remplacés par une espace, minuscules, lettres cyrilliques et
-- grecques d'aspect latin ramenées au latin, apostrophes droites.
CREATE OR REPLACE FUNCTION private.order_text_fold(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT translate(
        replace(replace(replace(replace(replace(
            lower(regexp_replace(regexp_replace(regexp_replace(
                normalize(normalize(COALESCE(p_text, ''), NFKC), NFD),
                '[\u0300-\u036f]', '', 'g'),
                '[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u206a-\u206f\ufeff]', '', 'g'),
                '[[:cntrl:]]', ' ', 'g')),
            'œ', 'oe'), 'æ', 'ae'), '’', ''''), 'ʼ', ''''), 'ß', 'ss'),
        'аАвВеЕкКмМнНоОрРсСтТуУхХіІјЈѕЅԁһӏαΑβΒεΕζΖηΗιΙκΚμΜνΝοΟρΡτΤυΥχΧøØđĐłŁı',
        'aabbeekkmmhhooppccttyyxxiijjssdhlaabbeezznhiikkumvnooppttuyxxooddlli');
$$;

-- Liste valable : 1 à 100 mots distincts (une fois pliés), de 2 à 40 caractères : lettres, chiffres, espace, tiret,
-- apostrophe
CREATE OR REPLACE FUNCTION public.order_review_keywords_valid(v jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    x       jsonb;
    v_fold  text;
    v_seen  text[] := ARRAY[]::text[];
BEGIN
    IF v IS NULL OR jsonb_typeof(v) <> 'array' OR jsonb_array_length(v) NOT BETWEEN 1 AND 100 THEN
        RETURN FALSE;
    END IF;
    FOR x IN SELECT * FROM jsonb_array_elements(v) LOOP
        IF jsonb_typeof(x) <> 'string' THEN RETURN FALSE; END IF;
        v_fold := btrim(private.order_text_fold(x #>> '{}'));
        IF v_fold !~ '^[a-z0-9][a-z0-9 ''-]{0,38}[a-z0-9]$' OR v_fold = ANY (v_seen) THEN
            RETURN FALSE;
        END IF;
        v_seen := v_seen || v_fold;
    END LOOP;
    RETURN TRUE;
END;
$$;

-- Mots de la liste trouvés dans un texte (orthographe de la liste, dans son ordre), ou vide. Deux lectures du texte
-- plié : mots tels quels (début de mot, pluriel en s ou x : « vin », « vins », pas « vinaigrette ») ; et lettres isolées
-- recollées (contre-vérification T1 : « W.H.I.S.K.Y », « W H I S K Y », « C-H-I-C-H-A » se lisent « whisky », « chicha »).
CREATE OR REPLACE FUNCTION private.order_review_words(p_text text)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_fold    text := private.order_text_fold(p_text);
    v_spaced  text := ' ' || regexp_replace(v_fold, '[^a-z0-9''-]+', ' ', 'g') || ' ';
    v_tokens  text[] := regexp_split_to_array(btrim(regexp_replace(v_fold, '[^a-z0-9]+', ' ', 'g')), ' ');
    v_joined  text := ' ';
    v_run     text := '';
    t         text;
    k         record;
    v_key     text;
    v_out     text[] := ARRAY[]::text[];
BEGIN
    FOREACH t IN ARRAY COALESCE(v_tokens, ARRAY[]::text[]) LOOP
        IF length(t) = 1 THEN
            v_run := v_run || t;
        ELSE
            IF length(v_run) >= 2 THEN v_joined := v_joined || v_run || ' '; END IF;
            v_run := '';
        END IF;
    END LOOP;
    IF length(v_run) >= 2 THEN v_joined := v_joined || v_run || ' '; END IF;
    FOR k IN SELECT x.word, x.ord
               FROM public.platform_settings s
               CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(s.value->'value') = 'array' THEN s.value->'value' ELSE '[]'::jsonb END)
                    WITH ORDINALITY AS x(word, ord)
              WHERE s.key = 'orders.review_keywords'
              ORDER BY x.ord LOOP
        v_key := btrim(private.order_text_fold(k.word));
        CONTINUE WHEN v_key !~ '^[a-z0-9][a-z0-9 ''-]*$';
        IF v_spaced ~ ('[^a-z0-9]' || v_key || '(s|x)?[^a-z0-9]')
           OR v_joined ~ ('[^a-z0-9]' || regexp_replace(v_key, '[^a-z0-9]', '', 'g') || '(s|x)?[^a-z0-9]') THEN
            v_out := v_out || k.word;
        END IF;
    END LOOP;
    RETURN v_out;
END;
$$;

-- Mots de la liste dans tout le texte d'un produit : nom, description, catégorie et suppléments (contre-vérification T5)
CREATE OR REPLACE FUNCTION private.order_product_words(p_product_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((SELECT private.order_review_words(concat_ws(' | ', pr.name, pr.description, c.name,
                        (SELECT string_agg(o.name, ' | ' ORDER BY o.sort_order, o.id) FROM public.product_options o WHERE o.product_id = pr.id)))
                       FROM public.products pr LEFT JOIN public.product_categories c ON c.id = pr.category_id
                      WHERE pr.id = p_product_id), ARRAY[]::text[]);
$$;

-- Liste des mots écrite par un super-administrateur actif (mêmes règles que finance_setting_set : UNKNOWN_KEY n'existe
-- pas ici, FORBIDDEN, INVALID_VALUE ; motif historisé par platform_settings_history)
CREATE OR REPLACE FUNCTION public.order_review_keywords_set(p_value jsonb, p_actor uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb := p_value->'value';
    v_flagged integer;
BEGIN
    IF p_actor IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_roles r JOIN public.users u ON u.id = r.user_id
         WHERE r.user_id = p_actor AND r.role = 'SUPERADMIN' AND u.status = 'ACTIF'
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Seul un super-administrateur actif peut modifier la liste des mots.');
    END IF;
    IF NOT public.order_review_keywords_valid(v) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_VALUE',
            'message', 'Indiquez de 1 à 100 mots différents, de 2 à 40 lettres chacun (lettres, chiffres, espace, tiret ou apostrophe).');
    END IF;
    IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL OR length(btrim(p_reason)) < 3 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif du changement.');
    END IF;
    PERFORM set_config('finance.change_reason', left(btrim(p_reason), 300), true);
    INSERT INTO public.platform_settings (key, value, updated_by, updated_at)
    VALUES ('orders.review_keywords', jsonb_build_object('value', v), p_actor, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
    -- Contre-vérification (T3) : produits déjà enregistrés revus avec la nouvelle liste (« à vérifier » posé, jamais
    -- effacé ; un avis groupé à l'administration) — private.order_review_backfill, migration 20261224000005
    v_flagged := private.order_review_backfill('LISTE', p_actor);
    RETURN jsonb_build_object('ok', true, 'key', 'orders.review_keywords', 'value', v, 'flagged', v_flagged);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Produit réglementé (ou à vérifier)
-- ----------------------------------------------------------------------------
-- Recopie de 20261130000002_l12a_catalogue.sql:86-94 ; changement : vrai aussi tant que le produit est à vérifier.
CREATE OR REPLACE FUNCTION public.product_regulated(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((SELECT pr.is_regulated OR COALESCE(pr.regulated_admin, FALSE) OR pr.review_state IS NOT NULL FROM public.products pr WHERE pr.id = p_product_id), TRUE);
$$;

-- Recopie de 20261130000002_l12a_catalogue.sql:96-139 ; changement : état « à vérifier », mots trouvés et archivage
-- écrits seulement par les fonctions en base (bloc « Lot 12c » ajouté avant la case « réglementé »).
CREATE OR REPLACE FUNCTION public.products_order_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner uuid;
BEGIN
    -- Établissement de la même partenaire, jamais changé une fois posé (lignes de commande, recettes)
    IF NEW.venue_id IS NOT NULL THEN
        SELECT partner_id INTO v_partner FROM public.venues WHERE id = NEW.venue_id;
        IF v_partner IS DISTINCT FROM NEW.partner_id THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ce produit doit appartenir à un établissement de la même partenaire.';
        END IF;
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Un produit ne change pas de partenaire.';
        END IF;
        IF OLD.venue_id IS NOT NULL AND NEW.venue_id IS DISTINCT FROM OLD.venue_id THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Un produit ne change pas d''établissement.';
        END IF;
    END IF;
    -- Décision de l'administration : seulement par order_product_regulation_decide
    IF current_setting('event_village.product_regulation', true) IS DISTINCT FROM 'on' THEN
        IF TG_OP = 'INSERT' THEN
            NEW.regulated_admin := NULL;
            NEW.regulated_checked_by := NULL;
            NEW.regulated_checked_at := NULL;
        ELSIF NEW.regulated_admin IS DISTINCT FROM OLD.regulated_admin
              OR NEW.regulated_checked_by IS DISTINCT FROM OLD.regulated_checked_by
              OR NEW.regulated_checked_at IS DISTINCT FROM OLD.regulated_checked_at THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La vérification d''un produit réglementé se fait seulement par l''administration.';
        END IF;
    END IF;
    -- Contre-vérification (T6) : un produit archivé ne change plus (statut, prix, stock…), sauf par les fonctions en base
    -- (remise en vente, décision de l'administration) et les fonctions de commande (stock rendu à une annulation)
    IF TG_OP = 'UPDATE' AND OLD.archived_at IS NOT NULL
       AND current_setting('event_village.product_write', true) IS DISTINCT FROM 'on'
       AND current_setting('event_village.product_regulation', true) IS DISTINCT FROM 'on'
       AND current_setting('event_village.order_flow', true) IS DISTINCT FROM 'on'
       AND (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ce produit est archivé : il ne se modifie plus.';
    END IF;
    -- Lot 12c : « à vérifier » posé par order_product_save ou product_option_set, effacé par la décision de
    -- l'administration ; archivage par order_product_remove. Aucune autre écriture ne les pose ni ne les efface.
    IF current_setting('event_village.product_write', true) IS DISTINCT FROM 'on'
       AND current_setting('event_village.product_regulation', true) IS DISTINCT FROM 'on' THEN
        IF TG_OP = 'INSERT' THEN
            NEW.review_state := NULL;
            NEW.review_words := NULL;
            NEW.review_requested_at := NULL;
            NEW.review_note := NULL;
            NEW.review_cleared_words := NULL;
            NEW.archived_at := NULL;
        ELSIF NEW.review_state IS DISTINCT FROM OLD.review_state
              OR NEW.review_words IS DISTINCT FROM OLD.review_words
              OR NEW.review_requested_at IS DISTINCT FROM OLD.review_requested_at
              OR NEW.review_note IS DISTINCT FROM OLD.review_note
              OR NEW.review_cleared_words IS DISTINCT FROM OLD.review_cleared_words
              OR NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La vérification et l''archivage d''un produit se font seulement par les fonctions en base.';
        END IF;
    END IF;
    -- Une case « réglementé » cochée garde sa sorte ; décochée, la sorte est effacée
    IF NOT NEW.is_regulated THEN
        NEW.regulated_kind := NULL;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.products_order_guard() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Décision de l'administration
-- ----------------------------------------------------------------------------
-- Recopie de 20261130000002_l12a_catalogue.sql:373-415 ; changements : l'état « à vérifier » est effacé par la décision
-- (autorisé = vendable si la case de la partenaire n'est pas cochée ; refusé = réglementé, affiché sans être vendu) ;
-- avis PRODUCT_REVIEW_DECIDED à la partenaire ; mots trouvés gardés au journal. Contre-vérification (T2) : la décision
-- porte sur la version lue (reviewed_at = date de la demande, ou date de la fiche d'un produit sans demande) : un produit
-- changé depuis est refusé (REVIEW_CHANGED) ; une autorisation garde les mots vus (review_cleared_words) ; SMS de la
-- décision à la partenaire (PRODUCT_DECISION_SMS, en plus de la cloche, du téléphone et de l'email).
CREATE OR REPLACE FUNCTION public.order_product_regulation_decide(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_product uuid := public.try_uuid(p->>'product_id');
    v_reason  text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'reason', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    v_value   boolean;
    pr        record;
    v_owner   uuid;
    v_seen    timestamptz;
    v_words   text[];
BEGIN
    IF jsonb_typeof(p->'regulated') <> 'boolean' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DECISION', 'message', 'Indiquez si le produit est réglementé ou non.');
    END IF;
    v_value := (p->>'regulated')::boolean;
    IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
       OR NOT (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
               OR public.has_admin_permission(v_actor, 'partners.validate')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit de vérifier les produits.');
    END IF;
    IF v_reason IS NULL OR length(v_reason) < 3 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif de la vérification.');
    END IF;
    SELECT * INTO pr FROM public.products WHERE id = v_product FOR UPDATE;
    IF v_product IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_NOT_FOUND', 'message', 'Produit introuvable.');
    END IF;
    -- Contre-vérification (T2) : version lue par l'administration (la route l'exige ; la base la contrôle dès qu'elle est
    -- donnée)
    IF NULLIF(p->>'reviewed_at', '') IS NOT NULL THEN
        BEGIN
            v_seen := (p->>'reviewed_at')::timestamptz;
        EXCEPTION WHEN others THEN
            v_seen := NULL;
        END;
        IF v_seen IS NULL OR v_seen IS DISTINCT FROM COALESCE(pr.review_requested_at, pr.updated_at) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'REVIEW_CHANGED', 'message', 'Ce produit a changé pendant votre lecture : relisez-le.');
        END IF;
    END IF;
    v_words := private.order_product_words(pr.id);
    PERFORM set_config('event_village.product_regulation', 'on', true);
    UPDATE public.products
       SET regulated_admin = v_value, regulated_checked_by = v_actor, regulated_checked_at = now(), updated_at = now(),
           review_note = NULL, review_cleared_words = CASE WHEN v_value THEN review_cleared_words ELSE v_words END,
           review_state = NULL, review_words = NULL, review_requested_at = NULL
     WHERE id = pr.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, CASE WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN') THEN 'SUPERADMIN' ELSE 'ADMIN' END,
            'PRODUCT_REGULATION_DECIDED', 'products', pr.id,
            jsonb_build_object('regulated_admin', pr.regulated_admin), jsonb_build_object('regulated_admin', v_value),
            jsonb_build_object('reason', v_reason, 'partner_box', pr.is_regulated)
            || jsonb_strip_nulls(jsonb_build_object('review_words', to_jsonb(pr.review_words), 'product_name', pr.name)));
    -- Lot 12c : la partenaire est prévenue (cloche, notification du téléphone, email), une fois par décision
    SELECT pa.user_id INTO v_owner FROM public.partners pa WHERE pa.id = pr.partner_id;
    IF v_owner IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'PRODUCT_REVIEW_DECIDED',
            'key', 'PRODUCT_REVIEW_DECIDED:' || pr.id::text || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'),
            'user_id', v_owner, 'actor_id', v_actor,
            'data', jsonb_strip_nulls(jsonb_build_object(
                'product_id', pr.id, 'product_name', pr.name, 'decision', CASE WHEN v_value THEN 'REFUSE' ELSE 'AUTORISE' END,
                'reason', v_reason, 'partner_box', pr.is_regulated))));
        -- Contre-vérification (point 7, P5) : la même décision par SMS (type à part : l'avis ci-dessus n'a pas de SMS)
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'PRODUCT_DECISION_SMS',
            'key', 'PRODUCT_DECISION_SMS:' || pr.id::text || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'),
            'user_id', v_owner, 'actor_id', v_actor,
            'data', jsonb_strip_nulls(jsonb_build_object(
                'product_id', pr.id, 'product_name', pr.name, 'decision', CASE WHEN v_value THEN 'REFUSE' ELSE 'AUTORISE' END,
                'partner_box', pr.is_regulated))));
    END IF;
    RETURN jsonb_build_object('ok', true, 'product_id', pr.id, 'regulated_admin', v_value,
                              'regulated', pr.is_regulated OR v_value);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Enregistrer un produit (partenaire)
-- ----------------------------------------------------------------------------
-- Partenaire du compte (fiche la plus ancienne, comme order_courier_invite), refus en français simple, ou NULL si tout
-- va bien : compte actif, fiche VALIDE (une fiche SUSPENDU est en lecture seule)
CREATE OR REPLACE FUNCTION private.order_catalog_owner(p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    pa record;
BEGIN
    SELECT id, status::text AS status INTO pa FROM public.partners WHERE user_id = p_actor ORDER BY created_at LIMIT 1;
    IF p_actor IS NULL OR NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Réservé aux partenaires.');
    END IF;
    IF pa.status = 'SUSPENDU' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre fiche est suspendue : votre carte et vos réglages de vente sont en lecture seule.');
    END IF;
    IF pa.status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_VALIDATED', 'message', 'Votre fiche doit être validée pour modifier votre carte.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'partner_id', pa.id);
END;
$$;

-- Avis « produit à vérifier » aux administrateurs qui ont partners.validate (une fois par demande)
CREATE OR REPLACE FUNCTION private.order_product_review_notify(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r record;
BEGIN
    SELECT pr.id, pr.name, pr.review_words, pr.review_requested_at, v.name AS venue_name,
           COALESCE(pa.commercial_name, pa.company_name) AS company
      INTO r
      FROM public.products pr JOIN public.partners pa ON pa.id = pr.partner_id
      LEFT JOIN public.venues v ON v.id = pr.venue_id
     WHERE pr.id = p_product_id AND pr.review_state IS NOT NULL;
    IF NOT FOUND THEN
        RETURN;
    END IF;
    PERFORM public.notif_enqueue_admins(jsonb_build_object(
        'type', 'ADMIN_PRODUCT_REVIEW',
        'ref', r.id::text || ':' || to_char(r.review_requested_at, 'YYYYMMDDHH24MISSUS'),
        'data', jsonb_strip_nulls(jsonb_build_object(
            'product_id', r.id, 'product_name', r.name, 'venue_name', r.venue_name, 'company', r.company,
            'words', to_jsonb(r.review_words)))));
END;
$$;

-- p : actor_id, product_id (vide = création), fields { venue_id, category_id, name, description, price,
-- is_daily_special, daily_special_date, stock_quantity, is_stock_managed, images, is_regulated, regulated_kind }.
-- Seules les clés présentes changent à la modification. Rend { ok, product, review_requested } ou { ok:false, code, message }.
-- Contre-vérification : texte comparé = nom, description, nom de la catégorie et suppléments (T5) ; p.restore = true
-- remet en vente un produit archivé (point 8), revu par la liste des mots (mots déjà autorisés exceptés).
CREATE OR REPLACE FUNCTION public.order_product_save(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_product  uuid := public.try_uuid(NULLIF(p->>'product_id', ''));
    f          jsonb := COALESCE(p->'fields', '{}'::jsonb);
    v_owner    jsonb;
    v_partner  uuid;
    pr         public.products%ROWTYPE;
    v_new      public.products;
    v_name     text;
    v_desc     text;
    v_price    numeric;
    v_stock    integer;
    v_images   text[];
    v_venue    uuid;
    v_category uuid;
    v_reg      boolean;
    v_kind     text;
    v_daily    boolean;
    v_day      date;
    v_managed  boolean;
    v_words    text[];
    v_review   boolean := FALSE;
    v_bump     boolean := FALSE;
    v_restore  boolean := jsonb_typeof(p->'restore') = 'boolean' AND (p->>'restore')::boolean;
BEGIN
    v_owner := private.order_catalog_owner(v_actor);
    IF NOT (v_owner->>'ok')::boolean THEN
        RETURN v_owner;
    END IF;
    v_partner := (v_owner->>'partner_id')::uuid;
    IF jsonb_typeof(f) <> 'object' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Données du produit illisibles.');
    END IF;
    IF v_product IS NOT NULL OR NULLIF(p->>'product_id', '') IS NOT NULL THEN
        SELECT * INTO pr FROM public.products WHERE id = v_product AND partner_id = v_partner FOR UPDATE;
        IF v_product IS NULL OR NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_NOT_FOUND', 'message', 'Ce produit n’existe pas ou n’est pas le vôtre.');
        END IF;
        IF pr.archived_at IS NOT NULL AND NOT v_restore THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_ARCHIVED', 'message', 'Ce produit est archivé : il ne se modifie plus.');
        END IF;
        IF v_restore AND pr.archived_at IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_NOT_ARCHIVED', 'message', 'Ce produit est déjà sur votre carte.');
        END IF;
    ELSIF v_restore THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_NOT_FOUND', 'message', 'Ce produit n’existe pas ou n’est pas le vôtre.');
    END IF;

    -- Valeurs (présentes dans la requête, sinon celles du produit ou celles par défaut)
    BEGIN
        v_name := CASE WHEN f ? 'name' THEN NULLIF(btrim(regexp_replace(COALESCE(f->>'name', ''), '[[:cntrl:]]', ' ', 'g')), '') ELSE pr.name END;
        v_desc := CASE WHEN f ? 'description' THEN NULLIF(btrim(regexp_replace(COALESCE(f->>'description', ''), '[[:cntrl:]]', ' ', 'g')), '') ELSE pr.description END;
        v_price := CASE WHEN f ? 'price' THEN (f->>'price')::numeric ELSE pr.price END;
        v_stock := CASE WHEN f ? 'stock_quantity' AND jsonb_typeof(f->'stock_quantity') <> 'null' THEN (f->>'stock_quantity')::integer
                        WHEN f ? 'stock_quantity' THEN NULL ELSE pr.stock_quantity END;
        v_managed := CASE WHEN jsonb_typeof(f->'is_stock_managed') = 'boolean' THEN (f->>'is_stock_managed')::boolean ELSE COALESCE(pr.is_stock_managed, FALSE) END;
        v_daily := CASE WHEN jsonb_typeof(f->'is_daily_special') = 'boolean' THEN (f->>'is_daily_special')::boolean ELSE COALESCE(pr.is_daily_special, FALSE) END;
        v_day := CASE WHEN f ? 'daily_special_date' AND jsonb_typeof(f->'daily_special_date') <> 'null' THEN (f->>'daily_special_date')::date
                      WHEN f ? 'daily_special_date' THEN NULL ELSE pr.daily_special_date END;
        v_reg := CASE WHEN jsonb_typeof(f->'is_regulated') = 'boolean' THEN (f->>'is_regulated')::boolean ELSE COALESCE(pr.is_regulated, FALSE) END;
        v_kind := CASE WHEN f ? 'regulated_kind' THEN NULLIF(upper(COALESCE(f->>'regulated_kind', '')), '') ELSE pr.regulated_kind END;
        v_images := CASE WHEN jsonb_typeof(f->'images') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(f->'images'))
                         WHEN f ? 'images' THEN ARRAY[]::text[] ELSE COALESCE(pr.images, ARRAY[]::text[]) END;
        v_category := CASE WHEN f ? 'category_id' THEN public.try_uuid(NULLIF(f->>'category_id', '')) ELSE pr.category_id END;
        v_venue := CASE WHEN pr.id IS NOT NULL THEN pr.venue_id ELSE public.try_uuid(NULLIF(f->>'venue_id', '')) END;
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Une valeur du produit n’est pas valable.');
    END;
    IF v_name IS NULL OR length(v_name) > 200 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Le nom du produit compte de 1 à 200 caractères.');
    END IF;
    IF v_desc IS NOT NULL AND length(v_desc) > 2000 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'La description compte au plus 2 000 caractères.');
    END IF;
    IF v_price IS NULL OR v_price <> trunc(v_price) OR v_price < 0 OR v_price > 10000000 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PRICE', 'message', 'Le prix est un nombre entier de F CFA, de 0 à 10 000 000.');
    END IF;
    IF v_stock IS NOT NULL AND (v_stock < 0 OR v_stock > 1000000) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Le stock est un nombre entier de 0 à 1 000 000.');
    END IF;
    IF cardinality(v_images) > 10 OR EXISTS (SELECT 1 FROM unnest(v_images) x WHERE length(x) > 600 OR length(x) = 0) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', '10 images au plus.');
    END IF;
    IF v_reg AND (v_kind IS NULL OR v_kind NOT IN ('ALCOOL', 'TABAC')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REGULATED_KIND_REQUIRED', 'message', 'Choisissez la sorte de produit réglementé : alcool ou tabac.');
    END IF;
    IF NOT v_reg THEN
        v_kind := NULL;
    END IF;
    -- L'établissement se choisit à la création et ne change jamais
    IF pr.id IS NOT NULL AND f ? 'venue_id' AND public.try_uuid(NULLIF(f->>'venue_id', '')) IS DISTINCT FROM pr.venue_id THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_LOCKED', 'message', 'L’établissement d’un produit ne change pas : créez le produit dans l’autre établissement.');
    END IF;
    IF pr.id IS NULL AND NULLIF(f->>'venue_id', '') IS NOT NULL
       AND (v_venue IS NULL OR NOT EXISTS (SELECT 1 FROM public.venues ve WHERE ve.id = v_venue AND ve.partner_id = v_partner)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_FOUND', 'message', 'Cet établissement n’existe pas ou n’est pas le vôtre.');
    END IF;
    IF v_category IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.product_categories c WHERE c.id = v_category AND c.partner_id = v_partner) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CATEGORY_NOT_FOUND', 'message', 'Catégorie de produit introuvable.');
    END IF;
    IF f ? 'category_id' AND NULLIF(f->>'category_id', '') IS NOT NULL AND v_category IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CATEGORY_NOT_FOUND', 'message', 'Catégorie de produit introuvable.');
    END IF;

    -- « À vérifier » : un mot de la liste dans le nom, la description, la catégorie ou un supplément, à la création ou quand
    -- le nom, la description ou la catégorie changent (même après une autorisation : le texte a changé) ; jamais effacé
    -- par une modification (seule la décision de l'administration l'efface). Remise en vente : revue, sauf les mots que
    -- l'administration a déjà vus en autorisant le produit.
    IF pr.id IS NULL OR v_restore OR v_name IS DISTINCT FROM pr.name OR v_desc IS DISTINCT FROM pr.description
       OR v_category IS DISTINCT FROM pr.category_id THEN
        v_words := private.order_review_words(concat_ws(' | ', v_name, v_desc,
                       (SELECT c.name FROM public.product_categories c WHERE c.id = v_category),
                       (SELECT string_agg(o.name, ' | ' ORDER BY o.sort_order, o.id) FROM public.product_options o WHERE o.product_id = pr.id)));
        v_review := CASE WHEN v_restore
                         THEN EXISTS (SELECT 1 FROM unnest(v_words) w WHERE NOT (w = ANY (COALESCE(pr.review_cleared_words, ARRAY[]::text[]))))
                         ELSE cardinality(v_words) > 0 END;
    END IF;
    -- Contre-vérification (T2) : un produit encore « à vérifier » dont le texte, la catégorie ou les photos changent prend
    -- une nouvelle version (date de la demande) : une décision prise sur la version affichée avant est refusée.
    v_bump := pr.id IS NOT NULL AND pr.review_state = 'A_VERIFIER'
              AND (v_name IS DISTINCT FROM pr.name OR v_desc IS DISTINCT FROM pr.description
                   OR v_category IS DISTINCT FROM pr.category_id OR v_images IS DISTINCT FROM COALESCE(pr.images, ARRAY[]::text[]));

    PERFORM set_config('event_village.product_write', 'on', true);
    IF pr.id IS NULL THEN
        INSERT INTO public.products (partner_id, venue_id, category_id, name, description, price, is_daily_special, daily_special_date,
                                     stock_quantity, is_stock_managed, images, is_regulated, regulated_kind,
                                     review_state, review_words, review_requested_at)
        VALUES (v_partner, v_venue, v_category, v_name, v_desc, v_price, v_daily, v_day, v_stock, v_managed, v_images, v_reg, v_kind,
                CASE WHEN v_review THEN 'A_VERIFIER' END, CASE WHEN v_review THEN v_words END, CASE WHEN v_review THEN now() END)
        RETURNING * INTO v_new;
    ELSE
        UPDATE public.products
           SET category_id = v_category, name = v_name, description = v_desc, price = v_price, is_daily_special = v_daily,
               daily_special_date = v_day, stock_quantity = v_stock, is_stock_managed = v_managed, images = v_images,
               is_regulated = v_reg, regulated_kind = v_kind,
               review_state = CASE WHEN v_review THEN 'A_VERIFIER' ELSE review_state END,
               review_words = CASE WHEN v_review THEN v_words ELSE review_words END,
               review_requested_at = CASE WHEN v_review OR v_bump THEN clock_timestamp() ELSE review_requested_at END,
               archived_at = CASE WHEN v_restore THEN NULL ELSE archived_at END,
               updated_at = now()
         WHERE id = pr.id
        RETURNING * INTO v_new;
    END IF;
    PERFORM set_config('event_village.product_write', 'off', true);

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, 'PARTENAIRE', CASE WHEN pr.id IS NULL THEN 'PRODUCT_CREATED' WHEN v_restore THEN 'PRODUCT_RESTORED' ELSE 'PRODUCT_UPDATED' END, 'products', v_new.id,
            CASE WHEN pr.id IS NOT NULL THEN jsonb_build_object('name', pr.name, 'price', pr.price, 'is_regulated', pr.is_regulated) END,
            jsonb_build_object('name', v_new.name, 'price', v_new.price, 'is_regulated', v_new.is_regulated, 'venue_id', v_new.venue_id),
            jsonb_strip_nulls(jsonb_build_object('review_words', CASE WHEN v_review THEN to_jsonb(v_words) END)));
    IF v_review THEN
        PERFORM private.order_product_review_notify(v_new.id);
    END IF;
    RETURN jsonb_build_object('ok', true, 'product', to_jsonb(v_new), 'review_requested', v_review);
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Retirer un produit : supprimé s'il n'a jamais été vendu, archivé sinon
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_product_remove(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_product uuid := public.try_uuid(p->>'product_id');
    v_owner   jsonb;
    pr        record;
BEGIN
    v_owner := private.order_catalog_owner(v_actor);
    IF NOT (v_owner->>'ok')::boolean THEN
        RETURN v_owner;
    END IF;
    SELECT * INTO pr FROM public.products WHERE id = v_product AND partner_id = (v_owner->>'partner_id')::uuid FOR UPDATE;
    IF v_product IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_NOT_FOUND', 'message', 'Ce produit n’existe pas ou n’est pas le vôtre.');
    END IF;
    IF pr.archived_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'product_id', pr.id, 'outcome', 'ARCHIVED', 'message', 'Ce produit est déjà archivé.');
    END IF;
    PERFORM set_config('event_village.product_write', 'on', true);
    IF EXISTS (SELECT 1 FROM public.order_items i WHERE i.product_id = pr.id) THEN
        UPDATE public.products SET archived_at = now(), updated_at = now() WHERE id = pr.id;
        PERFORM set_config('event_village.product_write', 'off', true);
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value)
        VALUES (v_actor, 'PARTENAIRE', 'PRODUCT_ARCHIVED', 'products', pr.id, jsonb_build_object('name', pr.name, 'price', pr.price));
        RETURN jsonb_build_object('ok', true, 'product_id', pr.id, 'outcome', 'ARCHIVED',
            'message', 'Produit archivé : il n’est plus sur votre carte et reste dans l’historique de vos commandes.');
    END IF;
    -- Jamais vendu : supprimé, avec ses suppléments et ses portions (la garde des portions laisse passer les fonctions)
    PERFORM set_config('event_village.order_flow', 'on', true);
    DELETE FROM public.products WHERE id = pr.id;
    PERFORM set_config('event_village.order_flow', 'off', true);
    PERFORM set_config('event_village.product_write', 'off', true);
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value)
    VALUES (v_actor, 'PARTENAIRE', 'PRODUCT_DELETED', 'products', pr.id, jsonb_build_object('name', pr.name, 'price', pr.price));
    RETURN jsonb_build_object('ok', true, 'product_id', pr.id, 'outcome', 'DELETED', 'message', 'Produit supprimé.');
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Avis
-- ----------------------------------------------------------------------------
INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission, night_policy) VALUES
    ('ADMIN_PRODUCT_REVIEW',   'ESSENTIAL', NULL, ARRAY['IN_APP','EMAIL'],         'ADMIN',   'BLOCK', FALSE, 'partners.validate', 'DEFER'),
    ('PRODUCT_REVIEW_DECIDED', 'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL'],  'PARTNER', 'ALLOW', FALSE, NULL,                'DEFER')
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission,
    night_policy = EXCLUDED.night_policy;

-- ----------------------------------------------------------------------------
-- 8. Droits
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION private.order_text_fold(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_review_words(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_product_words(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_catalog_owner(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.order_product_review_notify(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.order_review_keywords_valid(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_review_keywords_set(jsonb, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_regulated(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_product_regulation_decide(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_product_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_product_remove(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_review_keywords_valid(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_review_keywords_set(jsonb, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_regulated(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_product_regulation_decide(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_product_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_product_remove(jsonb) TO service_role;
