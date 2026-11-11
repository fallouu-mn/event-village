-- ============================================================================
-- EVENT VILLAGE — LOT 9 BIS : le cycle de l'événement (M08, agent S-C ; contrat sections 3.1, 3.2, 3.3, 4.3, 5.20 à 5.29)
-- ============================================================================
-- Rejouable : aucun BEGIN ni COMMIT ; ADD COLUMN IF NOT EXISTS, CREATE TABLE / INDEX IF NOT EXISTS, DROP … IF EXISTS
-- puis ADD pour les contraintes, INSERT … ON CONFLICT DO NOTHING, CREATE OR REPLACE, privilèges réappliqués ; aucune
-- reprise de données (A12 : les fins par défaut ne sont pas réécrites, elles sont recalculées à la lecture).
-- Écrite tâche après tâche (section 10), un commit par tâche ; le bloc des privilèges, en fin de fichier, grandit avec
-- chaque tâche. Chaque recopie part de la dernière définition (grep de toutes les migrations), signature, type de
-- retour et volatilité identiques.
--
-- Tâche 20 (R3 ; B46, D1) :
--  1. Ligne de transition SUSPENDU → TERMINE (ADMIN, motif obligatoire, canal TRANSITION, « Clore l’événement »).
--  2. event_transition(jsonb) : base 20261103000005_lot6_billetterie.sql:942-1054, recopie intégrale, signature et
--     VOLATILE identiques. Changement : SUSPENDU → TERMINE refusé EVENT_NOT_ENDED tant que la fin (event_end_at) n'est
--     pas passée (contrôlé après le motif, avant EVENT_NOT_STARTED). La permission events.write vient de
--     event_actor_profile (M04).
--  3. event_actions(jsonb) : base 20261102000003_lot5_cycle.sql:482-547, recopie intégrale, signature et STABLE
--     identiques. Changement : aucune action que event_transition refuserait par la date : PUBLIE retiré une fois la
--     fin passée (EVENT_ENDED), TERMINE depuis SUSPENDU retiré tant que la fin n'est pas passée (EVENT_NOT_ENDED).
--  Avis EVENT_CLOSED_HOLDER et EVENT_CLOSED_BY_ADMIN : trigger notif_event_status_changed (M09, S-D, fix(9b.20-SD)).
--
-- Tâche 21 (R16 ; B47, B48, X7, A12) :
--  4. event_end_from_v2(p_start_date, p_start_time, p_end_date, p_end_time) (nouvelle, LANGUAGE sql, IMMUTABLE) : fin
--     d'un événement à partir de ses colonnes ; date et heure de fin ; date de fin sans heure → 23:59 ; aucune date de
--     fin → début + 6 h. Nom nouveau (A2, X7) : event_end_from(date, date, time) reste telle quelle, sans appelant
--     après ce fichier et la recopie de event_update (M09).
--  5. event_end_at(uuid) : base 20261102000003_lot5_cycle.sql:149-159, recopie, signature, LANGUAGE sql et STABLE
--     identiques. Changement : sans date de fin, début + 6 h (au lieu du début à 23:59). Formule écrite en ligne : une
--     fonction LANGUAGE sql ne cite que des objets d'un fichier antérieur (section 1). Aucune donnée réécrite.
--  6. event_create(jsonb) : base 20261106000001_lot8_canaux.sql:637-827, recopie intégrale, signature et VOLATILE
--     identiques. Changement : la fin vient de event_end_from_v2 (début + 6 h sans fin) pour borner les ventes.
--  7. scan_states(p jsonb) (nouvelle, STABLE) : p { event_ids[], actor_id? } → { ok, items[{ event_id, open, problem,
--     opens_at, closes_at }] } ; problem = scan_event_problem, bornes = scan_window ; avec actor_id, chaque événement
--     doit être permis par scan_scanner_authorized, sinon SCAN_FORBIDDEN sans aucune donnée.
--  8. DO de fin de fichier : RAISE NOTICE du nombre de catégories dont la fin de vente dépasse la nouvelle fin (A12),
--     sans reprise.
-- ============================================================================


-- ============================================================================
-- Tâche 20 — 1. Transition SUSPENDU → TERMINE par un admin (R3)
-- ============================================================================
INSERT INTO public.event_status_transitions (from_status, to_status, actor_kind, reason_required, channel, action_label)
VALUES ('SUSPENDU', 'TERMINE', 'ADMIN', TRUE, 'TRANSITION', 'Clore l’événement')
ON CONFLICT DO NOTHING;


-- ============================================================================
-- Tâche 20 — 2. event_transition (recopie, 20261103000005_lot6_billetterie.sql:942-1054)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.event_transition(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_to_text text := p->>'to_status';
    v_to event_status;
    v_event uuid;
    v_actor uuid;
    v_reason text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    e record;
    a record;
    v_role text;
    v_reason_required boolean;
    v_role_missing boolean;
    v_missing jsonb := '[]'::jsonb;
    v_history uuid;
    v_owner uuid;
BEGIN
    IF v_to_text IS NULL OR NOT EXISTS (
        SELECT 1 FROM pg_enum WHERE enumtypid = 'public.event_status'::regtype AND enumlabel = v_to_text) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_STATUS', 'message', 'Statut demandé inconnu.');
    END IF;
    v_to := v_to_text::event_status;
    BEGIN
        v_event := (p->>'event_id')::uuid;
        v_actor := (p->>'actor_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END;
    IF v_event IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;

    SELECT id, partner_id, status, title, image_url, start_date, start_time INTO e
      FROM public.events WHERE id = v_event FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;

    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (a.is_owner OR a.is_staff) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'role_missing', true,
                                  'message', 'Vous n''êtes pas autorisé à changer le statut de cet événement.');
    END IF;
    IF NOT a.is_active THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n''est pas actif.');
    END IF;
    IF v_to = 'ANNULE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CANCELLATION_REQUIRED',
                                  'message', 'L''annulation passe par la procédure d''annulation, qui rembourse les acheteurs.');
    END IF;

    -- Règle de la table : le propriétaire agit comme partenaire, sinon l'admin comme admin
    IF a.is_owner THEN
        SELECT t.reason_required INTO v_reason_required FROM public.event_status_transitions t
         WHERE t.from_status = e.status AND t.to_status = v_to AND t.actor_kind = 'PARTENAIRE' AND t.channel = 'TRANSITION';
        IF FOUND THEN v_role := 'PARTENAIRE'; END IF;
    END IF;
    IF v_role IS NULL AND a.is_staff THEN
        SELECT t.reason_required INTO v_reason_required FROM public.event_status_transitions t
         WHERE t.from_status = e.status AND t.to_status = v_to AND t.actor_kind = 'ADMIN' AND t.channel = 'TRANSITION';
        IF FOUND THEN v_role := 'ADMIN'; END IF;
    END IF;
    IF v_role IS NULL THEN
        v_role_missing := EXISTS (SELECT 1 FROM public.event_status_transitions t
                                   WHERE t.from_status = e.status AND t.to_status = v_to AND t.channel <> 'CANCELLATION');
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'role_missing', v_role_missing,
            'message', CASE WHEN v_role_missing
                            THEN format('Votre rôle ne permet pas de passer cet événement de « %s » à « %s ».',
                                        public.event_status_label(e.status::text), public.event_status_label(v_to::text))
                            ELSE format('Un événement « %s » ne peut pas passer à « %s ».',
                                        public.event_status_label(e.status::text), public.event_status_label(v_to::text)) END);
    END IF;

    IF v_reason_required AND (v_reason IS NULL OR char_length(v_reason) < 3) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Un motif d''au moins 3 caractères est obligatoire.');
    END IF;

    IF e.status = 'BROUILLON' AND v_to = 'EN_ATTENTE' THEN
        IF NULLIF(btrim(COALESCE(e.image_url, '')), '') IS NULL THEN
            v_missing := v_missing || jsonb_build_object('field', 'image_url', 'message', 'Ajoutez une affiche à l''événement.');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.ticket_categories c WHERE c.event_id = v_event AND c.is_active) THEN
            v_missing := v_missing || jsonb_build_object('field', 'ticket_categories', 'message', 'Ajoutez au moins une catégorie de billets active.');
        END IF;
        IF jsonb_array_length(v_missing) > 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'SUBMIT_INCOMPLETE', 'missing', v_missing,
                                      'message', 'L''événement est incomplet : complétez-le avant de le soumettre.');
        END IF;
    END IF;
    IF v_to = 'PUBLIE' AND public.event_end_at(v_event) <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_ENDED', 'message', 'La fin de cet événement est passée : il ne peut plus être publié.');
    END IF;
    -- Lot 9 bis (R3) : un SUSPENDU ne se clôt qu'une fois sa fin passée ; avant, il se réactive ou s'annule.
    IF e.status = 'SUSPENDU' AND v_to = 'TERMINE' AND public.event_end_at(v_event) > now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ENDED',
                                  'message', 'L’événement n’est pas fini : réactivez-le ou annulez-le.');
    END IF;
    IF v_to = 'TERMINE' AND ((e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar') > now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_STARTED',
                                  'message', 'Un événement qui n''a pas commencé ne se termine pas : suspendez-le ou annulez-le.');
    END IF;

    v_history := public.event_status_apply(v_event, e.status, v_to, v_actor, v_role, v_reason, 'TRANSITION');

    -- Lot 6 : les avis (partenaire, porteurs, administrateurs) sont mis en file par le trigger
    -- trg_event_status_notify sur la ligne d'historique, dans cette même transaction.
    SELECT user_id INTO v_owner FROM public.partners WHERE id = e.partner_id;

    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'from', e.status::text, 'to', v_to::text,
                              'actor_role', v_role, 'reason', v_reason, 'history_id', v_history,
                              'title', e.title, 'partner_user_id', v_owner);
END;
$$;


-- ============================================================================
-- Tâche 20 — 3. event_actions (recopie, 20261102000003_lot5_cycle.sql:482-547)
-- ============================================================================
-- p : { event_id, actor_id } → { ok, status, actions[{to, reason_required, label}], can_edit, can_cancel, last_reason? }
CREATE OR REPLACE FUNCTION public.event_actions(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid;
    v_actor uuid;
    e record;
    a record;
    h record;
    v_kinds text[] := ARRAY[]::text[];
    v_actions jsonb;
    v_last jsonb;
    v_ended boolean;
BEGIN
    BEGIN
        v_event := (p->>'event_id')::uuid;
        v_actor := (p->>'actor_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END;
    SELECT id, status INTO e FROM public.events WHERE id = v_event;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (a.is_owner OR a.is_staff) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF a.is_owner THEN v_kinds := v_kinds || 'PARTENAIRE'::text; END IF;
    IF a.is_staff THEN v_kinds := v_kinds || 'ADMIN'::text; END IF;

    -- Lot 9 bis (R3) : aucune action que event_transition refuserait par la date
    v_ended := COALESCE(public.event_end_at(v_event) <= now(), FALSE);

    SELECT COALESCE(jsonb_agg(x.action ORDER BY x.to_status), '[]'::jsonb) INTO v_actions
      FROM (SELECT DISTINCT ON (t.to_status) t.to_status,
                   jsonb_build_object('to', t.to_status::text, 'reason_required', t.reason_required, 'label', t.action_label) AS action
              FROM public.event_status_transitions t
             WHERE t.from_status = e.status AND t.channel = 'TRANSITION' AND t.actor_kind = ANY (v_kinds)
               AND NOT (t.to_status = 'PUBLIE' AND v_ended)
               AND NOT (t.from_status = 'SUSPENDU' AND t.to_status = 'TERMINE' AND NOT v_ended)
             ORDER BY t.to_status, (t.actor_kind = 'PARTENAIRE') DESC) x;

    SELECT old_status::text AS old_status, new_status::text AS new_status, actor_role, reason, created_at INTO h
      FROM public.event_status_history
     WHERE event_id = v_event
     ORDER BY created_at DESC, txid DESC, id DESC
     LIMIT 1;
    -- Champs du record lus seulement s'il est affecté (pas de court-circuit garanti sur AND)
    IF FOUND THEN
        IF h.new_status = e.status::text THEN
            IF h.old_status = 'EN_ATTENTE' AND h.new_status = 'BROUILLON' AND h.actor_role = 'ADMIN' THEN
                v_last := jsonb_build_object('kind', 'REFUS', 'reason', h.reason, 'at', h.created_at);
            ELSIF h.old_status = 'PUBLIE' AND h.new_status = 'SUSPENDU' THEN
                v_last := jsonb_build_object('kind', 'SUSPENSION', 'reason', h.reason, 'at', h.created_at);
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'status', e.status::text,
        'actions', v_actions,
        'can_edit', a.is_owner AND e.status::text IN ('BROUILLON', 'VALIDE', 'PUBLIE', 'SUSPENDU'),
        'can_cancel', e.status::text IN ('VALIDE', 'PUBLIE', 'SUSPENDU'),
        'last_reason', v_last);
END;
$$;


-- ============================================================================
-- Tâche 21 — 4. event_end_from_v2 (nouvelle)
-- ============================================================================
-- Fin d'un événement à partir de ses colonnes (même règle que event_end_at, heure de Dakar) : date et heure de fin ;
-- date de fin sans heure → 23:59 ; aucune date de fin → début + 6 h.
CREATE OR REPLACE FUNCTION public.event_end_from_v2(p_start_date date, p_start_time time, p_end_date date, p_end_time time)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE WHEN p_end_date IS NOT NULL
                THEN ((p_end_date + COALESCE(p_end_time, time '23:59')) AT TIME ZONE 'Africa/Dakar')
                ELSE ((p_start_date + COALESCE(p_start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar') + interval '6 hours'
           END
$$;


-- ============================================================================
-- Tâche 21 — 5. event_end_at (recopie, 20261102000003_lot5_cycle.sql:149-159)
-- ============================================================================
-- Fin d'un événement (lot 9 bis, R16) : end_date + end_time à Dakar ; fin sans heure : end_date à 23:59 ;
-- sans fin : début (start_date + start_time) + 6 h.
CREATE OR REPLACE FUNCTION public.event_end_at(p_event_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE WHEN e.end_date IS NOT NULL
                THEN ((e.end_date + COALESCE(e.end_time, time '23:59')) AT TIME ZONE 'Africa/Dakar')
                ELSE ((e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar') + interval '6 hours'
           END
      FROM public.events e WHERE e.id = p_event_id
$$;


-- ============================================================================
-- Tâche 21 — 6. event_create (recopie, 20261106000001_lot8_canaux.sql:637-827)
-- ============================================================================
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
BEGIN
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
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une catégorie d''événement dans la liste.', 'category');
        END IF;
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Une valeur de l''événement est illisible.');
    END;
    v_program := COALESCE(v_ev->'program', '[]'::jsonb);
    v_practical := COALESCE(v_ev->'practical_info', '{}'::jsonb);

    IF v_title IS NULL OR char_length(v_title) < 3 OR char_length(v_title) > 120 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le titre compte de 3 à 120 caractères.', 'title');
    END IF;
    IF v_category IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une catégorie d''événement dans la liste.', 'category');
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
    IF v_lat IS NOT NULL AND (v_lat < -90 OR v_lat > 90) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La latitude est comprise entre -90 et 90.', 'latitude');
    END IF;
    IF v_lng IS NOT NULL AND (v_lng < -180 OR v_lng > 180) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La longitude est comprise entre -180 et 180.', 'longitude');
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

    v_slug := btrim(regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'), '-');
    IF v_slug = '' THEN v_slug := 'evenement'; END IF;
    v_slug := left(v_slug, 60) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

    -- Statut forcé à BROUILLON par trg_events_force_draft, historique NULL → BROUILLON par trg_events_log_creation
    INSERT INTO public.events (partner_id, title, slug, category, description, start_date, start_time, end_date, end_time,
                               location, city, latitude, longitude, image_url, gallery_urls, capacity, program, practical_info, services)
    VALUES (v_partner.id, v_title, v_slug, v_category, v_description, v_start_date, v_start_time, v_end_date, v_end_time,
            v_location, v_city, v_lat, v_lng, v_image, '{}', v_capacity, v_program, v_practical,
            '{"ticketing": true, "tableBooking": false, "communication": false}'::jsonb)
    RETURNING id INTO v_event_id;

    INSERT INTO public.ticket_categories (event_id, name, description, price, total_quantity, sold_quantity, max_per_order,
                                          sale_start, sale_end, sale_online, sale_counter, is_active)
    SELECT v_event_id, c->>'name', c->>'description', (c->>'price')::numeric, (c->>'total_quantity')::integer, 0,
           (c->>'max_per_order')::integer, (c->>'sale_start')::timestamptz, (c->>'sale_end')::timestamptz,
           (c->>'sale_online')::boolean, (c->>'sale_counter')::boolean, (c->>'is_active')::boolean
      FROM jsonb_array_elements(v_normalized) AS c;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'EVENT_CREATED', 'EVENT', v_event_id,
            jsonb_build_object('categories', jsonb_array_length(v_normalized)));

    SELECT to_jsonb(ev) INTO v_row FROM public.events ev WHERE ev.id = v_event_id;
    RETURN jsonb_build_object('ok', true, 'event_id', v_event_id, 'event', v_row);
END;
$$;


-- ============================================================================
-- Tâche 21 — 7. scan_states (nouvelle)
-- ============================================================================
-- p : { event_ids[], actor_id? } → { ok, items[{ event_id, open, problem, opens_at, closes_at }] } ; le scanner et le
-- scan partenaire décident par `open` (même règle que ticket_scan : scan_event_problem et scan_window). Avec actor_id,
-- un seul événement non permis (scan_scanner_authorized) refuse tout : SCAN_FORBIDDEN, aucune donnée.
CREATE OR REPLACE FUNCTION public.scan_states(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_ids uuid[] := ARRAY[]::uuid[];
    v_id uuid;
    v_raw text;
    v_items jsonb := '[]'::jsonb;
    v_problem text;
    w record;
BEGIN
    IF jsonb_typeof(p->'event_ids') IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Liste d''événements illisible.');
    END IF;
    FOR v_raw IN SELECT jsonb_array_elements_text(p->'event_ids') LOOP
        v_id := public.try_uuid(v_raw);
        IF v_id IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Liste d''événements illisible.');
        END IF;
        IF NOT v_id = ANY (v_ids) THEN v_ids := v_ids || v_id; END IF;
    END LOOP;
    IF p ? 'actor_id' THEN
        IF v_actor IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'SCAN_FORBIDDEN');
        END IF;
        FOREACH v_id IN ARRAY v_ids LOOP
            IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = v_id) OR NOT public.scan_scanner_authorized(v_actor, v_id) THEN
                RETURN jsonb_build_object('ok', false, 'code', 'SCAN_FORBIDDEN');
            END IF;
        END LOOP;
    END IF;
    FOREACH v_id IN ARRAY v_ids LOOP
        CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.events WHERE id = v_id);
        v_problem := public.scan_event_problem(v_id);
        SELECT * INTO w FROM public.scan_window(v_id);
        v_items := v_items || jsonb_build_object('event_id', v_id, 'open', v_problem IS NULL, 'problem', v_problem,
                                                 'opens_at', w.opens_at, 'closes_at', w.closes_at);
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;


-- ============================================================================
-- Privilèges (toutes les fonctions du fichier) : service_role uniquement
-- ============================================================================
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.event_transition(jsonb)',
        'public.event_actions(jsonb)',
        'public.event_end_from_v2(date, time, date, time)',
        'public.event_end_at(uuid)',
        'public.event_create(jsonb)',
        'public.scan_states(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;


-- ============================================================================
-- Tâche 21 — 8. Fins de vente au-delà de la nouvelle fin par défaut (A12 : comptées, jamais réécrites)
-- ============================================================================
DO $$
DECLARE
    v_count integer;
BEGIN
    SELECT count(*) INTO v_count
      FROM public.ticket_categories c
      JOIN public.events e ON e.id = c.event_id
     WHERE e.end_date IS NULL
       AND c.sale_end IS NOT NULL
       AND e.status::text NOT IN ('ANNULE', 'TERMINE')
       AND c.sale_end > public.event_end_at(e.id);
    RAISE NOTICE 'lot 9 bis (R16) : % catégorie(s) d''un événement sans date de fin ont une fin de vente après début + 6 h (non réécrites, rapport section 14)', v_count;
END;
$$;
