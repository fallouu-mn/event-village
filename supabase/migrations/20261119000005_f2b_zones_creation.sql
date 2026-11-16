-- Finition 2b (B, E-23) — étape 5 « Contrôle à l'entrée (facultatif) » : portes et zones réglées dès la création de
-- l'événement, dans la même transaction que lui. Constat (état des lieux du 15/11, point 3) : la base acceptait les
-- zones dès le brouillon, mais seulement après la création, par l'enregistrement des zones (event_zones_save) ; l'écran
-- ne les proposait qu'après la validation.
--  1. event_zones_form_refusal(zones) : contrôle de forme de event_zones_save (bloc 1 du lot 9 ter, inchangé : 20 zones,
--     50 portes, noms de 1 à 40 caractères, types, identifiants, doublons, zone sans porte ou sans catégorie, au moins
--     une zone d'entrée), sans verrou ; NULL si tout va bien ;
--  2. event_zones_write(événement, auteur, zones) : partie écriture de event_zones_save (blocs 3 à 8 du lot 9 ter,
--     inchangés : catégories de l'événement, toute catégorie admise par une zone d'entrée, verrous, identifiants, portes et
--     zones déjà utilisées au contrôle, écritures en deux passes, audit) ; appelée après la garde de la billetterie (ou
--     après l'insertion des catégories, à la création) ;
--  3. event_zones_save (recopie de 20261110000009_lot9ter_zones.sql) : forme, garde, écriture commune, configuration lue
--     (même ordre des refus qu'avant) ;
--  4. event_create (recopie de 20261119000002_f2b_couleur_consigne.sql) : `zones` facultatif, chaque zone désignant ses
--     catégories par leur ordre (category_refs) ; forme vérifiée avant toute écriture ; catégories insérées AVANT les
--     zones ; refus des zones = rien d'écrit (l'événement et ses catégories sont annulés), refus rendu tel quel ; texte
--     « type d'événement » (E-66).
-- Le scanner lit les mêmes tables, quel que soit le moment où les zones ont été créées : rien à toucher au scanner.
-- Sans BEGIN ni COMMIT, rejouable (CREATE OR REPLACE) ; aucune donnée écrite.

-- 1. Forme des zones (commune)
CREATE OR REPLACE FUNCTION public.event_zones_form_refusal(p_zones jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_zones jsonb := p_zones;
    v_n integer;
    z jsonb;
    gt jsonb;
    i integer;
    j integer;
    v_name text;
    v_key text;
    v_total_gates integer := 0;
    v_zone_keys text[] := ARRAY[]::text[];
    v_gate_keys text[] := ARRAY[]::text[];
    v_req_zones uuid[] := ARRAY[]::uuid[];
    v_req_gates uuid[] := ARRAY[]::uuid[];
    v_has_entry boolean := FALSE;
    v_id uuid;
BEGIN
    -- Forme, sans verrou (bloc 1 de event_zones_save du lot 9 ter, inchangé)
    IF v_zones IS NULL OR jsonb_typeof(v_zones) <> 'array' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.');
    END IF;
    v_n := jsonb_array_length(v_zones);
    IF v_n > 20 THEN
        RETURN public.event_edit_refusal('TOO_MANY_ZONES', '20 zones au plus par événement.');
    END IF;
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        IF jsonb_typeof(z) <> 'object' OR jsonb_typeof(z->'gates') IS DISTINCT FROM 'array'
           OR jsonb_typeof(z->'category_ids') IS DISTINCT FROM 'array' THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.', 'zones.' || i);
        END IF;
        v_total_gates := v_total_gates + jsonb_array_length(z->'gates');
    END LOOP;
    IF v_total_gates > 50 THEN
        RETURN public.event_edit_refusal('TOO_MANY_GATES', '50 portes au plus par événement.');
    END IF;
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        v_name := CASE WHEN jsonb_typeof(z->'name') = 'string' THEN btrim(z->>'name') END;
        IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 40 OR v_name ~ '[[:cntrl:]]' THEN
            RETURN public.event_edit_refusal('ZONE_NAME_INVALID', 'Donnez à chaque zone un nom de 1 à 40 caractères.', 'zones.' || i || '.name');
        END IF;
        IF COALESCE(z->>'kind', '') NOT IN ('ENTREE', 'CONTROLE') THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.', 'zones.' || i || '.kind');
        END IF;
        IF COALESCE(jsonb_typeof(z->'position'), 'null') <> 'null'
           AND (jsonb_typeof(z->'position') <> 'number' OR (z->>'position') !~ '^[0-9]{1,2}$') THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.', 'zones.' || i || '.position');
        END IF;
        IF COALESCE(jsonb_typeof(z->'id'), 'null') <> 'null' THEN
            v_id := CASE WHEN jsonb_typeof(z->'id') = 'string' THEN public.try_uuid(z->>'id') END;
            IF v_id IS NULL OR v_id = ANY (v_req_zones) THEN
                RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.', 'zones.' || i || '.id');
            END IF;
            v_req_zones := v_req_zones || v_id;
        END IF;
        FOR j IN 0 .. jsonb_array_length(z->'category_ids') - 1 LOOP
            IF jsonb_typeof(z->'category_ids'->j) <> 'string' OR public.try_uuid(z->'category_ids'->>j) IS NULL THEN
                RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.', 'zones.' || i || '.category_ids');
            END IF;
        END LOOP;
        FOR j IN 0 .. jsonb_array_length(z->'gates') - 1 LOOP
            gt := z->'gates'->j;
            IF jsonb_typeof(gt) <> 'object' THEN
                RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.', 'zones.' || i || '.gates.' || j);
            END IF;
            v_name := CASE WHEN jsonb_typeof(gt->'name') = 'string' THEN btrim(gt->>'name') END;
            IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 40 OR v_name ~ '[[:cntrl:]]' THEN
                RETURN public.event_edit_refusal('ZONE_NAME_INVALID', 'Donnez à chaque porte un nom de 1 à 40 caractères.',
                                                 'zones.' || i || '.gates.' || j || '.name');
            END IF;
            IF COALESCE(jsonb_typeof(gt->'id'), 'null') <> 'null' THEN
                v_id := CASE WHEN jsonb_typeof(gt->'id') = 'string' THEN public.try_uuid(gt->>'id') END;
                IF v_id IS NULL OR v_id = ANY (v_req_gates) THEN
                    RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.', 'zones.' || i || '.gates.' || j || '.id');
                END IF;
                v_req_gates := v_req_gates || v_id;
            END IF;
        END LOOP;
    END LOOP;
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        v_key := lower(btrim(z->>'name'));
        IF v_key = ANY (v_zone_keys) THEN
            RETURN public.event_edit_refusal('ZONE_NAME_TAKEN', 'Deux zones portent le nom ' || btrim(z->>'name') || ' : choisissez des noms différents.',
                                             'zones.' || i || '.name');
        END IF;
        v_zone_keys := v_zone_keys || v_key;
    END LOOP;
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        FOR j IN 0 .. jsonb_array_length(z->'gates') - 1 LOOP
            v_key := lower(btrim(z->'gates'->j->>'name'));
            IF v_key = ANY (v_gate_keys) THEN
                RETURN public.event_edit_refusal('GATE_NAME_TAKEN', 'Deux portes portent le nom ' || btrim(z->'gates'->j->>'name') || ' : choisissez des noms différents.',
                                                 'zones.' || i || '.gates.' || j || '.name');
            END IF;
            v_gate_keys := v_gate_keys || v_key;
        END LOOP;
    END LOOP;
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        IF jsonb_array_length(z->'gates') = 0 THEN
            RETURN public.event_edit_refusal('ZONE_WITHOUT_GATE', 'La zone ' || btrim(z->>'name') || ' n’a aucune porte : ajoutez-en au moins une.',
                                             'zones.' || i || '.gates');
        END IF;
    END LOOP;
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        IF jsonb_array_length(z->'category_ids') = 0 THEN
            RETURN public.event_edit_refusal('ZONE_WITHOUT_CATEGORY', 'La zone ' || btrim(z->>'name') || ' n’admet aucune catégorie : cochez-en au moins une.',
                                             'zones.' || i || '.category_ids');
        END IF;
        IF z->>'kind' = 'ENTREE' THEN
            v_has_entry := TRUE;
        END IF;
    END LOOP;
    IF v_n > 0 AND NOT v_has_entry THEN
        RETURN public.event_edit_refusal('NO_ENTRANCE_ZONE', 'Il faut au moins une zone de type Entrée : c’est là que les billets sont compostés.');
    END IF;

    RETURN NULL;
END;
$$;

-- 2. Écriture des zones (commune)
CREATE OR REPLACE FUNCTION public.event_zones_write(p_event uuid, p_actor uuid, p_zones jsonb, p_at_creation boolean DEFAULT FALSE)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := p_event;
    v_actor uuid := p_actor;
    v_zones jsonb := p_zones;
    v_n integer;
    z jsonb;
    gt jsonb;
    i integer;
    j integer;
    v_name text;
    v_total_gates integer := 0;
    v_req_zones uuid[] := ARRAY[]::uuid[];
    v_req_gates uuid[] := ARRAY[]::uuid[];
    v_final_zones uuid[] := ARRAY[]::uuid[];
    v_zone uuid;
    v_pos integer;
    v_cat uuid;
    r record;
    v_admissions integer;
BEGIN
    -- Identifiants et nombre de portes fournis (forme déjà contrôlée par event_zones_form_refusal)
    v_n := jsonb_array_length(v_zones);
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        v_total_gates := v_total_gates + jsonb_array_length(z->'gates');
        IF COALESCE(jsonb_typeof(z->'id'), 'null') <> 'null' THEN
            v_req_zones := v_req_zones || public.try_uuid(z->>'id');
        END IF;
        FOR j IN 0 .. jsonb_array_length(z->'gates') - 1 LOOP
            gt := z->'gates'->j;
            IF COALESCE(jsonb_typeof(gt->'id'), 'null') <> 'null' THEN
                v_req_gates := v_req_gates || public.try_uuid(gt->>'id');
            END IF;
        END LOOP;
    END LOOP;

    -- 3. Catégories citées : toutes de l'événement ; toute catégorie (active ou non, x10) entre par une zone ENTREE
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        FOR j IN 0 .. jsonb_array_length(z->'category_ids') - 1 LOOP
            v_cat := public.try_uuid(z->'category_ids'->>j);
            IF NOT EXISTS (SELECT 1 FROM public.ticket_categories c WHERE c.id = v_cat AND c.event_id = v_event) THEN
                RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.', 'zones.' || i || '.category_ids');
            END IF;
        END LOOP;
    END LOOP;
    IF v_n > 0 THEN
        SELECT c.name INTO v_name
          FROM public.ticket_categories c
         WHERE c.event_id = v_event
           AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_zones) zz
                             CROSS JOIN LATERAL jsonb_array_elements_text(zz->'category_ids') cid
                            WHERE zz->>'kind' = 'ENTREE' AND public.try_uuid(cid) = c.id)
         ORDER BY c.price, c.name, c.id
         LIMIT 1;
        IF FOUND THEN
            RETURN public.event_edit_refusal('CATEGORY_WITHOUT_ENTRANCE',
                'La catégorie ' || v_name || ' n’entre par aucune zone de type Entrée : cochez-la dans une zone d’entrée.');
        END IF;
    END IF;

    -- 4. Verrous suivants : zones, portes (attend les scans en cours, qui tiennent un KEY SHARE par leur clé
    --    étrangère), affectations à une porte
    PERFORM 1 FROM public.event_zones ez WHERE ez.event_id = v_event ORDER BY ez.id FOR UPDATE;
    PERFORM 1 FROM public.event_gates eg WHERE eg.event_id = v_event ORDER BY eg.id FOR UPDATE;
    PERFORM 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.gate_id IS NOT NULL ORDER BY ec.id FOR UPDATE;

    -- 5. Identifiants fournis : zones et portes de cet événement
    IF EXISTS (SELECT 1 FROM unnest(v_req_zones) rz(id)
                WHERE NOT EXISTS (SELECT 1 FROM public.event_zones ez WHERE ez.id = rz.id AND ez.event_id = v_event)) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.');
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_req_gates) rg(id)
                WHERE NOT EXISTS (SELECT 1 FROM public.event_gates eg WHERE eg.id = rg.id AND eg.event_id = v_event)) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.');
    END IF;

    -- 6. Porte supprimée : citée par un scan → GATE_IN_USE ; affectée → GATE_ASSIGNED. Porte gardée changée de zone :
    --    citée par un scan → GATE_IN_USE. Zone supprimée ou changée de type : citée par un scan → ZONE_IN_USE (EC6).
    FOR r IN SELECT eg.id, eg.name FROM public.event_gates eg
              WHERE eg.event_id = v_event AND NOT (eg.id = ANY (v_req_gates))
              ORDER BY lower(btrim(eg.name)), eg.id LOOP
        IF EXISTS (SELECT 1 FROM public.ticket_scans sc WHERE sc.event_id = v_event AND sc.gate_id = r.id) THEN
            RETURN public.event_edit_refusal('GATE_IN_USE', 'La porte ' || r.name || ' a déjà servi au contrôle : elle ne peut être ni supprimée ni changée de zone.');
        END IF;
        IF EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.gate_id = r.id) THEN
            RETURN public.event_edit_refusal('GATE_ASSIGNED', 'Des contrôleurs sont affectés à la porte ' || r.name || ' : changez d’abord leur porte dans l’équipe.');
        END IF;
    END LOOP;
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        v_zone := CASE WHEN COALESCE(jsonb_typeof(z->'id'), 'null') <> 'null' THEN public.try_uuid(z->>'id') END;
        FOR j IN 0 .. jsonb_array_length(z->'gates') - 1 LOOP
            gt := z->'gates'->j;
            CONTINUE WHEN COALESCE(jsonb_typeof(gt->'id'), 'null') = 'null';
            SELECT eg.id, eg.name, eg.zone_id INTO r FROM public.event_gates eg WHERE eg.id = public.try_uuid(gt->>'id');
            IF r.zone_id IS DISTINCT FROM v_zone
               AND EXISTS (SELECT 1 FROM public.ticket_scans sc WHERE sc.event_id = v_event AND sc.gate_id = r.id) THEN
                RETURN public.event_edit_refusal('GATE_IN_USE', 'La porte ' || r.name || ' a déjà servi au contrôle : elle ne peut être ni supprimée ni changée de zone.');
            END IF;
        END LOOP;
    END LOOP;
    FOR r IN SELECT ez.id, ez.name, ez.kind FROM public.event_zones ez
              WHERE ez.event_id = v_event
              ORDER BY ez.position, lower(btrim(ez.name)), ez.id LOOP
        IF (NOT (r.id = ANY (v_req_zones))
            OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_zones) zz
                        WHERE COALESCE(jsonb_typeof(zz->'id'), 'null') <> 'null' AND public.try_uuid(zz->>'id') = r.id
                          AND zz->>'kind' IS DISTINCT FROM r.kind))
           AND EXISTS (SELECT 1 FROM public.ticket_scans sc WHERE sc.event_id = v_event AND sc.zone_id = r.id) THEN
            RETURN public.event_edit_refusal('ZONE_IN_USE', 'La zone ' || r.name || ' a déjà servi au contrôle : son type ne peut plus changer et elle ne peut plus être supprimée.');
        END IF;
    END LOOP;

    -- 7. Écritures. Portes absentes supprimées d'abord ; toutes les zones et les portes gardées prennent leur identifiant
    --    pour nom (première passe : un échange ou un nom repris d'une zone supprimée ne viole jamais l'unicité) ; zones
    --    absentes supprimées en dernier, une fois leurs portes gardées déplacées (clé étrangère RESTRICT des portes).
    DELETE FROM public.zone_categories zc WHERE zc.event_id = v_event;
    DELETE FROM public.event_gates eg WHERE eg.event_id = v_event AND NOT (eg.id = ANY (v_req_gates));
    UPDATE public.event_zones ez SET name = ez.id::text WHERE ez.event_id = v_event;
    UPDATE public.event_gates eg SET name = eg.id::text WHERE eg.event_id = v_event;
    FOR i IN 0 .. v_n - 1 LOOP
        z := v_zones->i;
        v_pos := CASE WHEN jsonb_typeof(z->'position') = 'number' THEN (z->>'position')::integer ELSE i END;
        v_zone := CASE WHEN COALESCE(jsonb_typeof(z->'id'), 'null') <> 'null' THEN public.try_uuid(z->>'id') END;
        IF v_zone IS NOT NULL THEN
            UPDATE public.event_zones SET name = btrim(z->>'name'), kind = z->>'kind', position = v_pos, updated_at = now()
             WHERE id = v_zone;
        ELSE
            INSERT INTO public.event_zones (event_id, name, kind, position)
            VALUES (v_event, btrim(z->>'name'), z->>'kind', v_pos)
            RETURNING id INTO v_zone;
        END IF;
        v_final_zones := v_final_zones || v_zone;
        INSERT INTO public.zone_categories (event_id, zone_id, category_id)
        SELECT DISTINCT v_event, v_zone, public.try_uuid(cid)
          FROM jsonb_array_elements_text(z->'category_ids') cid
        ON CONFLICT DO NOTHING;
        FOR j IN 0 .. jsonb_array_length(z->'gates') - 1 LOOP
            gt := z->'gates'->j;
            IF COALESCE(jsonb_typeof(gt->'id'), 'null') <> 'null' THEN
                UPDATE public.event_gates SET name = btrim(gt->>'name'), zone_id = v_zone WHERE id = public.try_uuid(gt->>'id');
            ELSE
                INSERT INTO public.event_gates (event_id, zone_id, name) VALUES (v_event, v_zone, btrim(gt->>'name'));
            END IF;
        END LOOP;
    END LOOP;
    DELETE FROM public.event_zones ez WHERE ez.event_id = v_event AND NOT (ez.id = ANY (v_final_zones));
    -- Porte renommée : le point d'entrée des contrôleurs qui y sont affectés suit
    UPDATE public.event_controllers ec SET entry_point = eg.name
      FROM public.event_gates eg
     WHERE eg.id = ec.gate_id AND ec.event_id = v_event AND ec.entry_point IS DISTINCT FROM eg.name;

    -- 8. Audit (aucun nom de personne)
    SELECT count(*) INTO v_admissions FROM public.zone_categories zc WHERE zc.event_id = v_event;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'EVENT_ZONES_UPDATED', 'events', v_event,
            jsonb_build_object('zones', v_n, 'gates', v_total_gates, 'admissions', v_admissions, 'implicit', v_n = 0,
                               'at_creation', COALESCE(p_at_creation, FALSE)));

    RETURN jsonb_build_object('ok', true, 'zones', v_n, 'gates', v_total_gates, 'admissions', v_admissions);
END;
$$;

-- 3. event_zones_save
CREATE OR REPLACE FUNCTION public.event_zones_save(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_zones jsonb := p->'zones';
    v_guard jsonb;
    v_code text;
    v_refusal jsonb;
    v_written jsonb;
BEGIN
    -- 1. Forme, sans verrou (fonction commune event_zones_form_refusal)
    IF v_event IS NULL OR v_actor IS NULL OR v_zones IS NULL OR jsonb_typeof(v_zones) <> 'array' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Demande invalide.');
    END IF;
    v_refusal := public.event_zones_form_refusal(v_zones);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;

    -- 2. Verrous : événement NKU, droits du propriétaire, statut, catégories ORDER BY id FOR UPDATE. Un admin, même
    --    muni de events.write, ne modifie pas les zones (C-D7) ; textes de la garde dits pour les zones.
    v_guard := public.ticket_category_guard(v_event, v_actor);
    IF NOT COALESCE((v_guard->>'ok')::boolean, FALSE) THEN
        v_code := v_guard->>'code';
        IF v_code = 'EVENT_NOT_FOUND' AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = v_event)
           AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
            v_code := 'ADMIN_CANNOT_EDIT';
        END IF;
        RETURN public.event_edit_refusal(v_code, CASE v_code
            WHEN 'ADMIN_CANNOT_EDIT' THEN 'Seul l’organisateur modifie les zones de son événement.'
            WHEN 'EVENT_LOCKED' THEN 'Les zones d’un événement terminé ou annulé ne peuvent plus être modifiées.'
            WHEN 'WITHDRAW_TO_EDIT' THEN 'L’événement est en cours de validation : retirez-le de la validation pour modifier ses zones.'
            WHEN 'ACCOUNT_NOT_ACTIVE' THEN 'Votre compte n’est pas actif.'
            ELSE COALESCE(v_guard->>'message', 'Événement introuvable.') END);
    END IF;

    -- 3 à 8. Catégories, verrous, identifiants, portes et zones déjà utilisées, écritures, audit (fonction commune
    --        event_zones_write, appelée aussi par event_create à la création de l'événement)
    v_written := public.event_zones_write(v_event, v_actor, v_zones);
    IF (v_written->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_written;
    END IF;

    -- 9. Configuration enregistrée
    RETURN public.event_zones_get(jsonb_build_object('event_id', v_event, 'actor_id', v_actor));
END;
$$;

-- 4. event_create
CREATE OR REPLACE FUNCTION public.event_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_ev jsonb := p->'event';
    v_cats jsonb := COALESCE(p->'ticket_categories', '[]'::jsonb);
    -- Finition 2b (B) : portes et zones réglées dès la création (catégories désignées par leur ordre)
    v_zones_in jsonb := p->'zones';
    v_resolved jsonb;
    v_zone_refusal jsonb;
    v_zone_result jsonb;
    v_detail text;
    v_cat_id uuid;
    v_cat_ids uuid[] := ARRAY[]::uuid[];
    v_zone_count integer := 0;
    z jsonb;
    r jsonb;
    i integer;
    j integer;
    v_partner record;
    v_key text;
    v_title text;
    v_category event_category;
    v_description text;
    v_start_date date;
    v_start_time time;
    v_end_date date;
    v_end_time time;
    v_location text;
    v_city text;
    v_lat double precision;
    v_lng double precision;
    v_image text;
    v_capacity integer;
    v_program jsonb;
    v_practical jsonb;
    v_start timestamptz;
    v_end timestamptz;
    v_cat jsonb;
    v_norm jsonb;
    v_idx integer;
    v_names text[] := ARRAY[]::text[];
    v_normalized jsonb := '[]'::jsonb;
    v_active_sum integer := 0;
    v_slug text;
    v_event_id uuid;
    v_row jsonb;
    v_refusal jsonb;
BEGIN
    -- Finition 2a (1a) : fiche SUSPENDU, événements en lecture seule pour la partenaire (l'admin events.write garde ses actions)
    IF public.partner_actor_suspended(public.try_uuid(p->>'actor_id')) THEN
        RETURN public.event_edit_refusal('PARTNER_SUSPENDED', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    IF v_actor IS NULL THEN
        RETURN public.event_edit_refusal('PARTNER_NOT_FOUND', 'Seul un organisateur disposant d''un profil partenaire peut créer un événement.');
    END IF;
    SELECT pa.id, pa.status::text AS status, u.status::text AS user_status INTO v_partner
      FROM public.partners pa JOIN public.users u ON u.id = pa.user_id
     WHERE pa.user_id = v_actor;
    IF NOT FOUND THEN
        RETURN public.event_edit_refusal('PARTNER_NOT_FOUND', 'Seul un organisateur disposant d''un profil partenaire peut créer un événement.');
    END IF;
    IF v_partner.user_status <> 'ACTIF' THEN
        RETURN public.event_edit_refusal('ACCOUNT_NOT_ACTIVE', 'Votre compte n''est pas actif.');
    END IF;
    IF v_partner.status <> 'VALIDE' THEN
        RETURN public.event_edit_refusal('PARTNER_NOT_VALIDATED', 'Votre profil d''organisateur doit être validé avant de créer un événement.');
    END IF;

    IF v_ev IS NULL OR jsonb_typeof(v_ev) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les informations de l''événement sont illisibles.');
    END IF;
    IF jsonb_typeof(v_cats) <> 'array' OR jsonb_array_length(v_cats) > 50 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les catégories de billets sont illisibles (50 au plus).', 'ticket_categories');
    END IF;
    SELECT k INTO v_key FROM jsonb_object_keys(v_ev) AS k
     WHERE k <> ALL (ARRAY['title', 'category', 'description', 'start_date', 'start_time', 'end_date', 'end_time', 'location', 'city',
                           'latitude', 'longitude', 'image_url', 'capacity', 'program', 'practical_info'])
     ORDER BY k LIMIT 1;
    IF v_key IS NOT NULL THEN
        RETURN public.event_edit_refusal('FIELD_NOT_EDITABLE', 'Ce champ ne peut pas être fourni à la création d''un événement.', v_key);
    END IF;

    BEGIN
        v_title := btrim(v_ev->>'title');
        v_key := 'category';
        v_category := (v_ev->>'category')::event_category;
        v_key := NULL;
        v_description := NULLIF(btrim(COALESCE(v_ev->>'description', '')), '');
        v_start_date := (v_ev->>'start_date')::date;
        v_start_time := (v_ev->>'start_time')::time;
        v_end_date := NULLIF(v_ev->>'end_date', '')::date;
        v_end_time := NULLIF(v_ev->>'end_time', '')::time;
        v_location := btrim(v_ev->>'location');
        v_city := btrim(v_ev->>'city');
        v_lat := (v_ev->>'latitude')::double precision;
        v_lng := (v_ev->>'longitude')::double precision;
        v_image := NULLIF(btrim(COALESCE(v_ev->>'image_url', '')), '');
        v_capacity := (v_ev->>'capacity')::integer;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
        IF v_key = 'category' THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez un type d''événement dans la liste.', 'category');
        END IF;
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Une valeur de l''événement est illisible.');
    END;
    v_program := COALESCE(v_ev->'program', '[]'::jsonb);
    v_practical := COALESCE(v_ev->'practical_info', '{}'::jsonb);

    -- Finition 2a (3) : position du lieu, latitude et longitude ensemble ou aucune, au Sénégal (contrôlée en premier)
    v_refusal := public.event_position_refusal(v_lat, v_lng);
    IF v_refusal IS NOT NULL THEN
        RETURN v_refusal;
    END IF;

    IF v_title IS NULL OR char_length(v_title) < 3 OR char_length(v_title) > 120 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le titre compte de 3 à 120 caractères.', 'title');
    END IF;
    IF v_category IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez un type d''événement dans la liste.', 'category');
    END IF;
    IF v_description IS NOT NULL AND char_length(v_description) > 5000 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La description ne dépasse pas 5 000 caractères.', 'description');
    END IF;
    IF v_location IS NULL OR char_length(v_location) < 2 OR char_length(v_location) > 200 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le lieu compte de 2 à 200 caractères.', 'location');
    END IF;
    IF v_city IS NULL OR char_length(v_city) < 2 OR char_length(v_city) > 80 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La ville compte de 2 à 80 caractères.', 'city');
    END IF;
    IF v_capacity IS NOT NULL AND (v_capacity < 1 OR v_capacity > 100000) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La jauge est un nombre entier de 1 à 100 000.', 'capacity');
    END IF;
    IF NOT public.event_poster_path_ok(v_image, v_partner.id) THEN
        RETURN public.event_edit_refusal('IMAGE_ORIGIN_INVALID', 'L''affiche doit être déposée depuis le formulaire de l''événement.', 'image_url');
    END IF;
    IF jsonb_typeof(v_program) <> 'array' OR jsonb_array_length(v_program) > 50 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le programme compte 50 lignes au plus.', 'program');
    END IF;
    IF jsonb_typeof(v_practical) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les informations pratiques sont illisibles.', 'practical_info');
    END IF;

    IF v_end_time IS NOT NULL AND v_end_date IS NULL THEN
        RETURN public.event_edit_refusal('END_DATE_REQUIRED', 'Indiquez la date de fin pour l''heure de fin saisie.', 'end_date');
    END IF;
    v_start := (v_start_date + v_start_time) AT TIME ZONE 'Africa/Dakar';
    IF v_start <= now() THEN
        RETURN public.event_edit_refusal('EVENT_START_PAST', 'Le début de l''événement doit être dans le futur (heure de Dakar).', 'start_date');
    END IF;
    v_end := public.event_end_from_v2(v_start_date, v_start_time, v_end_date, v_end_time);
    IF v_end_date IS NOT NULL AND v_end <= v_start THEN
        RETURN public.event_edit_refusal('EVENT_END_BEFORE_START', 'La fin de l''événement doit être postérieure à son début.',
                                         CASE WHEN v_end_time IS NOT NULL THEN 'end_time' ELSE 'end_date' END);
    END IF;

    -- Catégories : toutes contrôlées avant la moindre écriture (tout ou rien)
    FOR v_cat, v_idx IN SELECT x.e, (x.o - 1)::int FROM jsonb_array_elements(v_cats) WITH ORDINALITY AS x(e, o) LOOP
        v_norm := public.ticket_category_normalize(v_cat, v_end, format('ticket_categories.%s.', v_idx));
        IF (v_norm->>'ok')::boolean IS NOT TRUE THEN
            RETURN v_norm;
        END IF;
        IF lower(v_norm->>'name') = ANY (v_names) THEN
            RETURN public.event_edit_refusal('CATEGORY_NAME_TAKEN',
                format('Deux catégories portent le nom « %s » : chaque nom doit être unique.', v_norm->>'name'),
                format('ticket_categories.%s.name', v_idx));
        END IF;
        v_names := array_append(v_names, lower(v_norm->>'name'));
        IF (v_norm->>'is_active')::boolean THEN
            v_active_sum := v_active_sum + (v_norm->>'total_quantity')::integer;
        END IF;
        v_normalized := v_normalized || jsonb_build_array(v_norm);
    END LOOP;
    IF v_capacity IS NOT NULL AND v_active_sum > v_capacity THEN
        RETURN public.event_edit_refusal('QUOTA_ABOVE_CAPACITY',
            format('La somme des quotas des catégories actives (%s) dépasse la jauge (%s).', v_active_sum, v_capacity), 'capacity');
    END IF;

    -- Finition 2b (B) : forme des zones de la création, avant toute écriture. Chaque zone désigne ses catégories par leur
    -- ordre dans ticket_categories (category_refs : 0 pour la première) ; les règles des zones sont celles de
    -- event_zones_save (fonctions communes event_zones_form_refusal et event_zones_write), appliquées une fois les
    -- catégories insérées.
    IF v_zones_in IS NOT NULL AND jsonb_typeof(v_zones_in) <> 'null' THEN
        IF jsonb_typeof(v_zones_in) <> 'array' THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Les portes et les zones sont illisibles.', 'zones');
        END IF;
        FOR i IN 0 .. jsonb_array_length(v_zones_in) - 1 LOOP
            z := v_zones_in->i;
            IF jsonb_typeof(z) <> 'object' OR jsonb_typeof(z->'category_refs') IS DISTINCT FROM 'array' THEN
                RETURN public.event_edit_refusal('INVALID_INPUT', 'Les portes et les zones sont illisibles.', 'zones.' || i);
            END IF;
            FOR j IN 0 .. jsonb_array_length(z->'category_refs') - 1 LOOP
                r := z->'category_refs'->j;
                IF jsonb_typeof(r) <> 'number' OR r::text !~ '^[0-9]{1,2}$' OR r::text::integer >= jsonb_array_length(v_normalized) THEN
                    RETURN public.event_edit_refusal('INVALID_INPUT', 'Une zone cite une catégorie de billets inconnue.', 'zones.' || i || '.category_refs');
                END IF;
            END LOOP;
        END LOOP;
        v_zone_count := jsonb_array_length(v_zones_in);
    END IF;

    v_slug := btrim(regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'), '-');
    IF v_slug = '' THEN v_slug := 'evenement'; END IF;
    v_slug := left(v_slug, 60) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

    -- Finition 2b (B) : écritures dans un bloc ; un refus des zones annule l'événement et ses catégories (sous-transaction
    -- du bloc), puis le refus est rendu tel quel
    BEGIN
    -- Statut forcé à BROUILLON par trg_events_force_draft, historique NULL → BROUILLON par trg_events_log_creation
    INSERT INTO public.events (partner_id, title, slug, category, description, start_date, start_time, end_date, end_time,
                               location, city, latitude, longitude, image_url, gallery_urls, capacity, program, practical_info, services)
    VALUES (v_partner.id, v_title, v_slug, v_category, v_description, v_start_date, v_start_time, v_end_date, v_end_time,
            v_location, v_city, v_lat, v_lng, v_image, '{}', v_capacity, v_program, v_practical,
            '{"ticketing": true, "tableBooking": false, "communication": false}'::jsonb)
    RETURNING id INTO v_event_id;

    -- Finition 2b (A) : catégories insérées une par une, dans l'ordre reçu, avec leur couleur au contrôle et leur consigne
    -- d'entrée (couleur absente : posée par la base)
    FOR v_cat IN SELECT x.e FROM jsonb_array_elements(v_normalized) WITH ORDINALITY AS x(e, o) ORDER BY x.o LOOP
        INSERT INTO public.ticket_categories (event_id, name, description, price, total_quantity, sold_quantity, max_per_order,
                                              sale_start, sale_end, sale_online, sale_counter, is_active, scan_color, entry_instruction)
        VALUES (v_event_id, v_cat->>'name', v_cat->>'description', (v_cat->>'price')::numeric, (v_cat->>'total_quantity')::integer, 0,
                (v_cat->>'max_per_order')::integer, (v_cat->>'sale_start')::timestamptz, (v_cat->>'sale_end')::timestamptz,
                (v_cat->>'sale_online')::boolean, (v_cat->>'sale_counter')::boolean, (v_cat->>'is_active')::boolean,
                v_cat->>'scan_color', v_cat->>'entry_instruction')
        RETURNING id INTO v_cat_id;
        v_cat_ids := v_cat_ids || v_cat_id;
    END LOOP;

    -- Finition 2b (B) : zones APRÈS les catégories (sinon trg_ticket_categories_zone_admit admettrait chaque catégorie
    -- dans chaque zone d'entrée) ; mêmes règles que l'enregistrement des zones
    IF v_zone_count > 0 THEN
        SELECT jsonb_agg(jsonb_build_object(
                   'name', x.zone_in->'name', 'kind', x.zone_in->'kind', 'position', x.zone_in->'position',
                   'category_ids', (SELECT COALESCE(jsonb_agg(to_jsonb(v_cat_ids[(c.ref_txt)::integer + 1]) ORDER BY c.ref_pos), '[]'::jsonb)
                                      FROM jsonb_array_elements_text(x.zone_in->'category_refs') WITH ORDINALITY AS c(ref_txt, ref_pos)),
                   'gates', x.zone_in->'gates') ORDER BY x.zone_pos)
          INTO v_resolved
          FROM jsonb_array_elements(v_zones_in) WITH ORDINALITY AS x(zone_in, zone_pos);
        v_zone_refusal := public.event_zones_form_refusal(v_resolved);
        IF v_zone_refusal IS NULL THEN
            v_zone_result := public.event_zones_write(v_event_id, v_actor, v_resolved, TRUE);
            IF (v_zone_result->>'ok')::boolean IS NOT TRUE THEN
                v_zone_refusal := v_zone_result;
            END IF;
        END IF;
        IF v_zone_refusal IS NOT NULL THEN
            RAISE EXCEPTION 'EVENT_ZONES_REFUSED' USING ERRCODE = 'EVZ22', DETAIL = v_zone_refusal::text;
        END IF;
    END IF;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'EVENT_CREATED', 'EVENT', v_event_id,
            jsonb_build_object('categories', jsonb_array_length(v_normalized), 'zones', v_zone_count));
    EXCEPTION WHEN SQLSTATE 'EVZ22' THEN
        GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
        RETURN v_detail::jsonb;
    END;

    SELECT to_jsonb(ev) INTO v_row FROM public.events ev WHERE ev.id = v_event_id;
    RETURN jsonb_build_object('ok', true, 'event_id', v_event_id, 'event', v_row);
END;
$$;


DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.event_zones_form_refusal(jsonb)',
        'public.event_zones_write(uuid, uuid, jsonb, boolean)',
        'public.event_zones_save(jsonb)',
        'public.event_create(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
