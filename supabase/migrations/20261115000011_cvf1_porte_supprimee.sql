-- ============================================================================
-- EVENT VILLAGE — Correctifs de la contre-vérification de la finition 1 — R1 : porte supprimée pendant l'enregistrement
-- ============================================================================
-- Recopies de event_controller_settings_set (20261115000002, fenêtre « Modifier ») et de event_controller_gate_set
-- (20261110000009) ; seul ajout : la porte demandée est verrouillée en partage de clé (FOR KEY SHARE) avant d'être lue.
-- Une suppression concurrente fait attendre l'enregistrement, puis la porte est absente : refus 409 GATE_GONE « Cette
-- porte n’existe plus. Choisissez-en une autre. » au lieu d'une clé étrangère violée (erreur 500). Une porte d'un autre
-- événement garde son refus GATE_INVALID. Réservées au service_role. Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.event_controller_settings_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_controller uuid := public.try_uuid(p->>'controller_id');
    v_gate uuid := public.try_uuid(p->>'gate_id');
    v_reason text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    v_entry text := NULLIF(btrim(COALESCE(p->>'entry_point', '')), '');
    v_allowed boolean;
    v_cash boolean;
    v_zones boolean;
    v_gate_name text;
    v_gate_json jsonb := 'null'::jsonb;
    v_open boolean;
    a record;
    ec record;
BEGIN
    IF v_actor IS NULL OR v_event IS NULL OR v_controller IS NULL
       OR jsonb_typeof(p->'can_accept_cash') IS DISTINCT FROM 'boolean'
       OR (COALESCE(jsonb_typeof(p->'gate_id'), 'null') <> 'null' AND v_gate IS NULL)
       OR COALESCE(jsonb_typeof(p->'gate_change_allowed'), 'null') NOT IN ('null', 'boolean')
       OR char_length(COALESCE(v_entry, '')) > 80 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Réglages invalides.');
    END IF;
    v_cash := (p->>'can_accept_cash')::boolean;
    v_allowed := COALESCE((p->>'gate_change_allowed')::boolean, FALSE);
    PERFORM 1 FROM public.events e WHERE e.id = v_event FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (COALESCE(a.is_owner, FALSE) OR COALESCE(a.is_staff, FALSE)) THEN
        IF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PERMISSION_MISSING', 'permission', 'events.write',
                'message', 'Action non autorisée : votre compte n’a pas la permission « Gérer les événements ».');
        END IF;
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF NOT COALESCE(a.is_active, FALSE) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;
    IF NOT COALESCE(a.is_owner, FALSE) AND char_length(COALESCE(v_reason, '')) < 5 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED',
            'message', 'Indiquez le motif de cette action (5 caractères au moins) : il est inscrit au journal.');
    END IF;
    v_zones := EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = v_event);
    -- Complément 9 : sur un événement à zones, la porte se choisit dans la liste ; aucun texte libre
    IF v_zones AND v_entry IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'GATES_CONFIGURED',
            'message', 'Cet événement a des portes : choisissez la porte du contrôleur dans la liste.');
    END IF;
    IF NOT v_zones AND v_gate IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'GATE_INVALID', 'message', 'Cet événement n’a pas de portes : indiquez un point d’entrée.');
    END IF;
    IF v_gate IS NOT NULL THEN
        -- cvf1 R1 : la porte est verrouillée (partage de clé) avant d'être vérifiée : une suppression en cours fait attendre
        -- l'enregistrement, qui la trouve ensuite absente et refuse (jamais une clé étrangère violée, jamais d'erreur 500)
        PERFORM 1 FROM public.event_gates gl WHERE gl.id = v_gate FOR KEY SHARE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'GATE_GONE', 'message', 'Cette porte n’existe plus. Choisissez-en une autre.');
        END IF;
        SELECT g.name, jsonb_build_object('id', g.id, 'name', g.name, 'zone_name', z.name, 'categories', public.team_gate_categories(g.id))
          INTO v_gate_name, v_gate_json
          FROM public.event_gates g JOIN public.event_zones z ON z.id = g.zone_id
         WHERE g.id = v_gate AND g.event_id = v_event;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'GATE_INVALID', 'message', 'Porte inconnue : choisissez une porte de cet événement.');
        END IF;
    END IF;
    SELECT x.id, x.gate_id, x.gate_change_allowed, x.entry_point, x.can_accept_cash INTO ec
      FROM public.event_controllers x
     WHERE x.event_id = v_event AND x.user_id = v_controller FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_ASSIGNED', 'message', 'Ce contrôleur ne contrôle pas cet événement.');
    END IF;
    UPDATE public.event_controllers
       SET gate_id = CASE WHEN v_zones THEN v_gate ELSE NULL END,
           gate_change_allowed = CASE WHEN v_zones THEN v_allowed ELSE FALSE END,
           entry_point = CASE WHEN v_zones THEN v_gate_name ELSE v_entry END,
           can_accept_cash = v_cash
     WHERE id = ec.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, CASE WHEN COALESCE(a.is_owner, FALSE) THEN 'PARTENAIRE' ELSE 'ADMIN' END, 'CONTROLLER_SETTINGS_SET',
            'event_controllers', ec.id,
            jsonb_build_object('gate_id', ec.gate_id, 'gate_change_allowed', ec.gate_change_allowed,
                               'entry_point', ec.entry_point, 'can_accept_cash', ec.can_accept_cash),
            jsonb_build_object('gate_id', CASE WHEN v_zones THEN v_gate END, 'gate_change_allowed', v_zones AND v_allowed,
                               'entry_point', CASE WHEN v_zones THEN v_gate_name ELSE v_entry END, 'can_accept_cash', v_cash),
            jsonb_build_object('event_id', v_event, 'controller_id', v_controller, 'reason', v_reason));
    v_open := EXISTS (SELECT 1 FROM public.controller_shifts s
                       WHERE s.event_id = v_event AND s.controller_id = v_controller AND s.status = 'OUVERT');
    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'controller_id', v_controller,
                              'gate', CASE WHEN v_zones THEN v_gate_json ELSE 'null'::jsonb END,
                              'gate_change_allowed', v_zones AND v_allowed,
                              'entry_point', CASE WHEN v_zones THEN v_gate_name ELSE v_entry END,
                              'can_accept_cash', v_cash, 'open_shift', v_open);
END;
$$;

CREATE OR REPLACE FUNCTION public.event_controller_gate_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_controller uuid := public.try_uuid(p->>'controller_id');
    v_gate uuid := public.try_uuid(p->>'gate_id');
    v_allowed boolean;
    v_status text;
    a record;
    ec record;
    v_gate_name text;
    v_gate_json jsonb := 'null'::jsonb;
    v_configured boolean;
BEGIN
    IF v_actor IS NULL OR v_event IS NULL OR v_controller IS NULL
       OR (COALESCE(jsonb_typeof(p->'gate_id'), 'null') <> 'null' AND v_gate IS NULL)
       OR COALESCE(jsonb_typeof(p->'gate_change_allowed'), 'null') NOT IN ('null', 'boolean') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande invalide.');
    END IF;
    v_allowed := COALESCE((p->>'gate_change_allowed')::boolean, FALSE);
    SELECT e.status::text INTO v_status FROM public.events e WHERE e.id = v_event FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (COALESCE(a.is_owner, FALSE) OR COALESCE(a.is_staff, FALSE)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF NOT COALESCE(a.is_active, FALSE) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;
    v_configured := EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = v_event);
    IF v_gate IS NOT NULL THEN
        -- cvf1 R1 : la porte est verrouillée (partage de clé) avant d'être vérifiée : une suppression en cours fait attendre
        -- l'enregistrement, qui la trouve ensuite absente et refuse (jamais une clé étrangère violée, jamais d'erreur 500)
        PERFORM 1 FROM public.event_gates gl WHERE gl.id = v_gate FOR KEY SHARE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'GATE_GONE', 'message', 'Cette porte n’existe plus. Choisissez-en une autre.');
        END IF;
        SELECT eg.name, jsonb_build_object('id', eg.id, 'name', eg.name,
                                           'zone', jsonb_build_object('id', z.id, 'name', z.name, 'kind', z.kind))
          INTO v_gate_name, v_gate_json
          FROM public.event_gates eg JOIN public.event_zones z ON z.id = eg.zone_id
         WHERE eg.id = v_gate AND eg.event_id = v_event;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'GATE_INVALID', 'message', 'Porte inconnue : choisissez une porte de cet événement.');
        END IF;
    END IF;
    SELECT x.id, x.gate_id INTO ec FROM public.event_controllers x
     WHERE x.event_id = v_event AND x.user_id = v_controller FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_ASSIGNED', 'message', 'Ce contrôleur n’est pas affecté à cet événement.');
    END IF;
    UPDATE public.event_controllers
       SET gate_id = v_gate,
           gate_change_allowed = v_allowed,
           entry_point = CASE WHEN v_gate IS NOT NULL THEN v_gate_name WHEN v_configured THEN NULL ELSE entry_point END
     WHERE id = ec.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, CASE WHEN COALESCE(a.is_owner, FALSE) THEN 'PARTENAIRE' ELSE 'ADMIN' END, 'CONTROLLER_GATE_SET',
            'event_controllers', ec.id,
            jsonb_build_object('event_id', v_event, 'controller_id', v_controller, 'gate_id', v_gate,
                               'gate_change_allowed', v_allowed, 'previous_gate_id', ec.gate_id));
    RETURN jsonb_build_object('ok', true, 'controller_id', v_controller, 'gate', v_gate_json, 'gate_change_allowed', v_allowed);
END;
$$;

REVOKE ALL ON FUNCTION public.event_controller_settings_set(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.event_controller_gate_set(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_controller_settings_set(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.event_controller_gate_set(jsonb) TO service_role;
