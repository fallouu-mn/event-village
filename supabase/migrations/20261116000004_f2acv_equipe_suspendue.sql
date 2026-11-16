-- Correctifs de la contre-vérification de la finition 2a, T1 — fiche SUSPENDU : l'équipe de ses événements est en lecture
-- seule pour la partenaire, comme ses événements (finition 2a, 1a). Rapport d'audit docs/audit-finition-2a.md, T1 : 11 des
-- 12 écritures de l'onglet Équipe passaient, et trois fonctions de la base acceptaient la partenaire suspendue pour autrice.
--
-- Côté routes : /api/partner/team/* et /api/partner/shifts/* comptent parmi les écritures refusées par la garde de la fiche
-- (lib/auth/partner-fiche-guard.ts, partnerEventWrite : 403 PARTNER_SUSPENDED, texte et contact du support).
-- Côté base (cette migration) : la fiche est contrôlée EN TÊTE de chaque fonction d'équipe, avant tout le reste :
--   1. aide partner_team_owner_suspended (équipe d'une fiche : invitations, retrait de l'équipe), pendant de
--      partner_owner_suspended (20261116000001, événement) ; un admin muni de events.write n'est jamais visé ;
--   2. recopies, garde en tête : event_controller_settings_set (réglages : porte, point d'entrée, espèces),
--      event_controller_gate_set (porte), event_controller_set_cash (espèces), controller_invitation_create (invitation),
--      controller_invitation_resend (renvoi), controller_invitation_cancel (annulation), controller_invitation_clear
--      (effacement), controller_assignments_sync (événements du contrôleur : ajouts et retraits),
--      atomic_partner_remove_controller (retrait de l'équipe, auteur ajouté) ;
--   3. trois fonctions nouvelles pour les écritures que des routes faisaient directement dans event_controllers :
--      event_controller_entry_point_set (PATCH /api/partner/team/entry-point) et event_controllers_remove (DELETE
--      /api/partner/team/[eventId] et DELETE /api/partner/team/all), event_controllers_add (POST /api/partner/team/invite,
--      compte de contrôleur créé par l'invitation) ; plus aucune route n'écrit l'équipe sans fonction.
-- Rien n'est changé d'autre dans les fonctions recopiées. Aucune donnée existante n'est modifiée.
-- Sans BEGIN ni COMMIT (transaction de la CLI), rejouable : CREATE OR REPLACE, DROP … IF EXISTS.

-- ----------------------------------------------------------------------------
-- 1. Aide : propriétaire d'une fiche SUSPENDU (équipe de la fiche), sans être admin events.write
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_team_owner_suspended(p_partner uuid, p_actor uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p_actor IS NOT NULL AND p_partner IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.partners pa
                    WHERE pa.id = p_partner AND pa.user_id = p_actor AND pa.status::text = 'SUSPENDU')
       AND NOT COALESCE(public.admin_can(p_actor, 'events.write'), FALSE)
$$;
REVOKE ALL ON FUNCTION public.partner_team_owner_suspended(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.partner_team_owner_suspended(uuid, uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. Recopies des fonctions d’équipe, contrôle de la fiche en tête
-- ----------------------------------------------------------------------------
-- 2.1 event_controller_settings_set (recopie de 20261115000011_cvf1_porte_supprimee.sql) : réglages du contrôleur (porte, point d’entrée, espèces)
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
    -- Correctifs de la contre-vérification (T1) : fiche SUSPENDU, équipe en lecture seule pour la partenaire (l'admin
    -- events.write garde ses actions), contrôlé avant tout le reste
    IF public.partner_owner_suspended(public.try_uuid(p->>'event_id'), public.try_uuid(p->>'actor_id')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
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
REVOKE ALL ON FUNCTION public.event_controller_settings_set(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_controller_settings_set(jsonb) TO service_role;

-- 2.2 event_controller_gate_set (recopie de 20261115000011_cvf1_porte_supprimee.sql) : porte du contrôleur
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
    -- Correctifs de la contre-vérification (T1) : fiche SUSPENDU, équipe en lecture seule pour la partenaire (l'admin
    -- events.write garde ses actions), contrôlé avant tout le reste
    IF public.partner_owner_suspended(public.try_uuid(p->>'event_id'), public.try_uuid(p->>'actor_id')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
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
REVOKE ALL ON FUNCTION public.event_controller_gate_set(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_controller_gate_set(jsonb) TO service_role;

-- 2.3 event_controller_set_cash (recopie de 20261109000004_lot9bis_droits.sql) : droit d’encaisser d’une affectation
CREATE OR REPLACE FUNCTION public.event_controller_set_cash(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_assignment uuid := public.try_uuid(p->>'assignment_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_value boolean;
    r record;
    v_staff boolean;
    v_open boolean;
BEGIN
    -- Correctifs de la contre-vérification (T1) : fiche SUSPENDU, équipe en lecture seule pour la partenaire (l'admin
    -- events.write garde ses actions), contrôlé avant tout le reste
    IF public.partner_owner_suspended((SELECT ec.event_id FROM public.event_controllers ec WHERE ec.id = public.try_uuid(p->>'assignment_id')), public.try_uuid(p->>'actor_id')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    IF v_actor IS NULL OR jsonb_typeof(p->'can_accept_cash') IS DISTINCT FROM 'boolean' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Indiquez la permission espèces (oui ou non).');
    END IF;
    v_value := (p->>'can_accept_cash')::boolean;
    IF v_assignment IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ASSIGNMENT_NOT_FOUND', 'message', 'Affectation introuvable.');
    END IF;

    SELECT ec.id, ec.event_id, ec.user_id, ec.can_accept_cash, pa.user_id AS owner_id
      INTO r
      FROM public.event_controllers ec
      JOIN public.events e ON e.id = ec.event_id
      JOIN public.partners pa ON pa.id = e.partner_id
     WHERE ec.id = v_assignment
       FOR UPDATE OF ec;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ASSIGNMENT_NOT_FOUND', 'message', 'Affectation introuvable.');
    END IF;
    v_staff := FALSE;
    IF r.owner_id IS DISTINCT FROM v_actor THEN
        -- Lot 9 bis (R2, B31) : un admin muni de events.write (ou le SUPERADMIN) agit ; sans elle, refus nommé
        v_staff := public.admin_can(v_actor, 'events.write');
        IF NOT v_staff THEN
            IF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
                RETURN jsonb_build_object('ok', false, 'code', 'PERMISSION_MISSING', 'permission', 'events.write',
                    'message', 'Action non autorisée : votre compte n’a pas la permission « Gérer les événements ».');
            END IF;
            RETURN jsonb_build_object('ok', false, 'code', 'ASSIGNMENT_NOT_FOUND', 'message', 'Affectation introuvable.');
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;

    UPDATE public.event_controllers SET can_accept_cash = v_value WHERE id = r.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, CASE WHEN v_staff THEN 'ADMIN' ELSE 'PARTENAIRE' END, 'CONTROLLER_CASH_PERMISSION_SET', 'event_controllers', r.id,
            jsonb_build_object('can_accept_cash', r.can_accept_cash),
            jsonb_build_object('can_accept_cash', v_value),
            jsonb_build_object('event_id', r.event_id, 'controller_id', r.user_id));
    v_open := EXISTS (SELECT 1 FROM public.controller_shifts s
                       WHERE s.event_id = r.event_id AND s.controller_id = r.user_id AND s.status = 'OUVERT');

    RETURN jsonb_build_object('ok', true, 'assignment_id', r.id, 'event_id', r.event_id, 'controller_id', r.user_id,
                              'can_accept_cash', v_value, 'changed', r.can_accept_cash IS DISTINCT FROM v_value,
                              'open_shift', v_open);
END;
$$;
REVOKE ALL ON FUNCTION public.event_controller_set_cash(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_controller_set_cash(jsonb) TO service_role;

-- 2.4 controller_invitation_create (recopie de 20261115000014_cvf1_promotion_admin.sql) : invitation d’un contrôleur
CREATE OR REPLACE FUNCTION public.controller_invitation_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_partner uuid := public.try_uuid(p->>'partner_id');
    v_user uuid := public.try_uuid(p->>'user_id');
    v_phone text := NULLIF(btrim(COALESCE(p->>'phone_entered', '')), '');
    v_assignments jsonb;
    v_company text;
    v_events jsonb;
    v_id uuid;
    v_expires timestamptz;
BEGIN
    -- Correctifs de la contre-vérification (T1) : fiche SUSPENDU, équipe en lecture seule pour la partenaire (l'admin
    -- events.write garde ses actions), contrôlé avant tout le reste
    IF public.partner_team_owner_suspended(public.try_uuid(p->>'partner_id'), public.try_uuid(p->>'actor_id')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    IF v_actor IS NULL OR v_partner IS NULL OR v_user IS NULL OR jsonb_typeof(p->'assignments') IS DISTINCT FROM 'array'
       OR jsonb_array_length(p->'assignments') = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Invitation incomplète.');
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p->'assignments') a
                WHERE public.try_uuid(a->>'event_id') IS NULL
                   OR jsonb_typeof(a->'can_accept_cash') NOT IN ('boolean', 'null')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Invitation incomplète.');
    END IF;
    SELECT COALESCE(NULLIF(btrim(pa.commercial_name), ''), pa.company_name) INTO v_company
      FROM public.partners pa WHERE pa.id = v_partner;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_FOUND', 'message', 'Organisateur introuvable.');
    END IF;
    -- Migration 14 : le compte est verrouillé en partage avant d'être lu ; une promotion en cours (verrou du compte) fait
    -- attendre l'invitation, qui voit ensuite le rôle d'administration et refuse (aucune invitation en attente pour lui)
    PERFORM 1 FROM public.users u WHERE u.id = v_user FOR SHARE;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Ce compte n''est pas actif.');
    END IF;
    -- cvf1 T1 : un compte d'administration n'est jamais invité (texte neutre, qui ne dit pas pourquoi)
    IF public.account_is_staff(v_user) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_INVITABLE', 'message', 'Ce numéro ne peut pas être invité comme contrôleur. Choisissez une autre personne.');
    END IF;

    -- Une ligne par événement (le dernier droit d'encaisser donné l'emporte), événements de la partenaire seulement
    SELECT jsonb_agg(jsonb_build_object('event_id', x.event_id, 'can_accept_cash', x.cash) ORDER BY x.event_id)
      INTO v_assignments
      FROM (SELECT DISTINCT ON (public.try_uuid(a->>'event_id')) public.try_uuid(a->>'event_id') AS event_id,
                   COALESCE((a->>'can_accept_cash')::boolean, FALSE) AS cash
              FROM jsonb_array_elements(p->'assignments') WITH ORDINALITY AS t(a, o)
             ORDER BY public.try_uuid(a->>'event_id'), o DESC) x;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_assignments) a
                LEFT JOIN public.events e ON e.id = (a->>'event_id')::uuid
                WHERE e.id IS NULL OR e.partner_id IS DISTINCT FROM v_partner) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_OWNED', 'message', 'Vous n''êtes pas propriétaire de tous les événements sélectionnés.');
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_assignments) a
                JOIN public.events e ON e.id = (a->>'event_id')::uuid
                WHERE e.status::text NOT IN ('VALIDE', 'PUBLIE')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ELIGIBLE', 'message', 'Seuls les événements validés ou publiés peuvent être affectés.');
    END IF;

    -- cvf1 R2 : verrou par organisatrice et par compte ; des demandes simultanées passent l'une après l'autre. Une
    -- invitation identique (mêmes événements, mêmes droits) envoyée il y a moins de 60 secondes et toujours en attente
    -- n'est pas recréée : refus, aucun SMS (la route rend l'unité du numéro). « Inviter de nouveau » avec d'autres
    -- événements remplace toujours la précédente.
    PERFORM pg_advisory_xact_lock(hashtextextended('controller_invitation:' || v_partner::text || ':' || v_user::text, 0));
    IF EXISTS (SELECT 1 FROM public.controller_invitations ci
                WHERE ci.partner_id = v_partner AND ci.user_id = v_user AND ci.status = 'PENDING'
                  AND ci.expires_at > now() AND ci.created_at > now() - interval '60 seconds'
                  AND ci.assignments = v_assignments) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_ALREADY_SENT', 'message', 'Une invitation vient d’être envoyée à ce numéro. Attendez sa réponse ou utilisez « Renvoyer ».');
    END IF;

    -- Finition 1 : une seule invitation en attente par partenaire et par compte ; la précédente est annulée et effacée
    -- (remplacée par celle-ci), sans avis « expirée »
    UPDATE public.controller_invitations
       SET status = 'CANCELLED', responded_at = now(), cancelled_by = v_actor, cleared_at = now()
     WHERE partner_id = v_partner AND user_id = v_user AND status = 'PENDING';

    INSERT INTO public.controller_invitations (partner_id, user_id, created_by, assignments, phone_entered)
    VALUES (v_partner, v_user, v_actor, v_assignments, v_phone)
    RETURNING id, expires_at INTO v_id, v_expires;

    SELECT jsonb_agg(jsonb_build_object(
               'event_id', e.id, 'title', e.title,
               'start_at', (e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar')
           ORDER BY e.start_date, e.start_time, e.id)
      INTO v_events
      FROM public.events e
     WHERE e.id IN (SELECT (a->>'event_id')::uuid FROM jsonb_array_elements(v_assignments) a);

    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'CONTROLLER_INVITATION', 'key', 'CONTROLLER_INVITATION:' || v_id::text,
        'user_id', v_user, 'actor_id', v_actor,
        'data', jsonb_build_object('invitation_id', v_id, 'company', v_company, 'expires_at', v_expires, 'events', v_events)));

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value, metadata)
    VALUES (v_actor, COALESCE(NULLIF(p->>'actor_role', ''), 'PARTENAIRE'), 'CONTROLLER_INVITATION_CREATED', 'controller_invitations', v_id,
            jsonb_build_object('user_id', v_user, 'assignments', v_assignments),
            jsonb_build_object('partner_id', v_partner, 'expires_at', v_expires, 'reason', NULLIF(btrim(COALESCE(p->>'reason', '')), '')));

    RETURN jsonb_build_object('ok', true, 'invitation_id', v_id, 'expires_at', v_expires);
END;
$$;
REVOKE ALL ON FUNCTION public.controller_invitation_create(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.controller_invitation_create(jsonb) TO service_role;

-- 2.5 controller_invitation_resend (recopie de 20261115000002_finition1_equipe.sql) : renvoi d’une invitation
CREATE OR REPLACE FUNCTION public.controller_invitation_resend(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid := public.try_uuid(p->>'invitation_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_check boolean := COALESCE(jsonb_typeof(p->'check_only') = 'boolean' AND (p->>'check_only')::boolean, FALSE);
    inv record;
    chk jsonb;
    v_phone text;
    v_company text;
    v_events jsonb;
    v_expires timestamptz;
    v_count integer;
BEGIN
    -- Correctifs de la contre-vérification (T1) : fiche SUSPENDU, équipe en lecture seule pour la partenaire (l'admin
    -- events.write garde ses actions), contrôlé avant tout le reste
    IF public.partner_team_owner_suspended((SELECT ci.partner_id FROM public.controller_invitations ci WHERE ci.id = public.try_uuid(p->>'invitation_id')), public.try_uuid(p->>'actor_id')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    IF v_id IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    SELECT ci.*, pa.user_id AS owner_id, COALESCE(NULLIF(btrim(pa.commercial_name), ''), pa.company_name) AS company
      INTO inv
      FROM public.controller_invitations ci JOIN public.partners pa ON pa.id = ci.partner_id
     WHERE ci.id = v_id FOR UPDATE OF ci;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    chk := public.controller_invitation_actor_check(p, inv.owner_id);
    IF (chk->>'ok')::boolean IS NOT TRUE THEN
        RETURN chk;
    END IF;
    IF inv.status <> 'PENDING' OR inv.expires_at <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_PENDING',
            'message', 'Cette invitation n’attend plus de réponse : invitez de nouveau.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = inv.user_id AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Ce compte n’est pas actif : il ne peut pas être invité.');
    END IF;
    SELECT u.phone INTO v_phone FROM public.users u WHERE u.id = inv.user_id;
    IF v_check THEN
        RETURN jsonb_build_object('ok', true, 'invitation_id', inv.id, 'phone', v_phone);
    END IF;

    UPDATE public.controller_invitations
       SET expires_at = now() + interval '72 hours', last_sent_at = now(), send_count = send_count + 1
     WHERE id = inv.id
    RETURNING expires_at, send_count INTO v_expires, v_count;
    SELECT jsonb_agg(jsonb_build_object(
               'event_id', e.id, 'title', e.title,
               'start_at', (e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar')
           ORDER BY e.start_date, e.start_time, e.id)
      INTO v_events
      FROM public.events e
     WHERE e.id IN (SELECT public.try_uuid(a->>'event_id') FROM jsonb_array_elements(inv.assignments) a);
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'CONTROLLER_INVITATION', 'key', 'CONTROLLER_INVITATION:' || inv.id::text || ':' || v_count::text,
        'user_id', inv.user_id, 'actor_id', v_actor,
        'data', jsonb_build_object('invitation_id', inv.id, 'company', inv.company, 'expires_at', v_expires, 'events', v_events)));
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, CASE WHEN (chk->>'staff')::boolean THEN 'ADMIN' ELSE 'PARTENAIRE' END, 'CONTROLLER_INVITATION_RESENT',
            'controller_invitations', inv.id,
            jsonb_build_object('partner_id', inv.partner_id, 'send_count', v_count, 'expires_at', v_expires, 'reason', chk->>'reason'));
    RETURN jsonb_build_object('ok', true, 'invitation_id', inv.id, 'phone', v_phone, 'expires_at', v_expires, 'send_count', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.controller_invitation_resend(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.controller_invitation_resend(jsonb) TO service_role;

-- 2.6 controller_invitation_cancel (recopie de 20261115000002_finition1_equipe.sql) : annulation d’une invitation
CREATE OR REPLACE FUNCTION public.controller_invitation_cancel(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid := public.try_uuid(p->>'invitation_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    inv record;
    chk jsonb;
BEGIN
    -- Correctifs de la contre-vérification (T1) : fiche SUSPENDU, équipe en lecture seule pour la partenaire (l'admin
    -- events.write garde ses actions), contrôlé avant tout le reste
    IF public.partner_team_owner_suspended((SELECT ci.partner_id FROM public.controller_invitations ci WHERE ci.id = public.try_uuid(p->>'invitation_id')), public.try_uuid(p->>'actor_id')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    IF v_id IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    SELECT ci.*, pa.user_id AS owner_id INTO inv
      FROM public.controller_invitations ci JOIN public.partners pa ON pa.id = ci.partner_id
     WHERE ci.id = v_id FOR UPDATE OF ci;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    chk := public.controller_invitation_actor_check(p, inv.owner_id);
    IF (chk->>'ok')::boolean IS NOT TRUE THEN
        RETURN chk;
    END IF;
    IF inv.status <> 'PENDING' OR inv.expires_at <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_PENDING', 'message', 'Cette invitation n’attend plus de réponse.');
    END IF;
    UPDATE public.controller_invitations
       SET status = 'CANCELLED', responded_at = now(), cancelled_by = v_actor
     WHERE id = inv.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, CASE WHEN (chk->>'staff')::boolean THEN 'ADMIN' ELSE 'PARTENAIRE' END, 'CONTROLLER_INVITATION_CANCELLED',
            'controller_invitations', inv.id,
            jsonb_build_object('partner_id', inv.partner_id, 'user_id', inv.user_id, 'reason', chk->>'reason'));
    RETURN jsonb_build_object('ok', true, 'invitation_id', inv.id, 'status', 'CANCELLED');
END;
$$;
REVOKE ALL ON FUNCTION public.controller_invitation_cancel(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.controller_invitation_cancel(jsonb) TO service_role;

-- 2.7 controller_invitation_clear (recopie de 20261115000002_finition1_equipe.sql) : effacement d’une invitation
CREATE OR REPLACE FUNCTION public.controller_invitation_clear(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid := public.try_uuid(p->>'invitation_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    inv record;
    chk jsonb;
BEGIN
    -- Correctifs de la contre-vérification (T1) : fiche SUSPENDU, équipe en lecture seule pour la partenaire (l'admin
    -- events.write garde ses actions), contrôlé avant tout le reste
    IF public.partner_team_owner_suspended((SELECT ci.partner_id FROM public.controller_invitations ci WHERE ci.id = public.try_uuid(p->>'invitation_id')), public.try_uuid(p->>'actor_id')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    IF v_id IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    SELECT ci.*, pa.user_id AS owner_id INTO inv
      FROM public.controller_invitations ci JOIN public.partners pa ON pa.id = ci.partner_id
     WHERE ci.id = v_id FOR UPDATE OF ci;
    IF NOT FOUND OR inv.status = 'ACCEPTED' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    chk := public.controller_invitation_actor_check(p, inv.owner_id);
    IF (chk->>'ok')::boolean IS NOT TRUE THEN
        RETURN chk;
    END IF;
    IF inv.status = 'PENDING' AND inv.expires_at > now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_STILL_PENDING',
            'message', 'Cette invitation attend encore une réponse : annulez-la d’abord.');
    END IF;
    IF inv.cleared_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'invitation_id', inv.id);
    END IF;
    UPDATE public.controller_invitations
       SET cleared_at = now(),
           status = CASE WHEN status = 'PENDING' THEN 'EXPIRED' ELSE status END,
           responded_at = CASE WHEN status = 'PENDING' THEN expires_at ELSE responded_at END
     WHERE id = inv.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, CASE WHEN (chk->>'staff')::boolean THEN 'ADMIN' ELSE 'PARTENAIRE' END, 'CONTROLLER_INVITATION_CLEARED',
            'controller_invitations', inv.id,
            jsonb_build_object('partner_id', inv.partner_id, 'status', inv.status, 'reason', chk->>'reason'));
    RETURN jsonb_build_object('ok', true, 'invitation_id', inv.id);
END;
$$;
REVOKE ALL ON FUNCTION public.controller_invitation_clear(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.controller_invitation_clear(jsonb) TO service_role;

-- 2.8 controller_assignments_sync (recopie de 20261115000013_cvf1_affectations_admin_base.sql) : événements d’un contrôleur (ajouts, retraits, droit d’encaisser)
CREATE OR REPLACE FUNCTION public.controller_assignments_sync(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_ctrl uuid := public.try_uuid(p->>'controller_id');
    v_partner uuid := public.try_uuid(p->>'partner_id');
    v_role text := COALESCE(NULLIF(p->>'actor_role', ''), 'PARTENAIRE');
    v_req jsonb;
    v_requested uuid[];
    v_current uuid[];
    v_added uuid[];
    v_removed uuid[];
    v_updated integer := 0;
BEGIN
    -- Correctifs de la contre-vérification (T1) : fiche SUSPENDU, équipe en lecture seule pour la partenaire (l'admin
    -- events.write garde ses actions), contrôlé avant tout le reste
    IF public.partner_team_owner_suspended(COALESCE(public.try_uuid(p->>'partner_id'), (SELECT pa.id FROM public.partners pa WHERE pa.user_id = public.try_uuid(p->>'actor_id'))), public.try_uuid(p->>'actor_id')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    IF v_actor IS NULL OR v_ctrl IS NULL OR jsonb_typeof(p->'assignments') IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Affectations illisibles.');
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p->'assignments') a
                WHERE public.try_uuid(a->>'event_id') IS NULL
                   OR COALESCE(jsonb_typeof(a->'can_accept_cash'), 'null') NOT IN ('boolean', 'null')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Affectations illisibles.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_ctrl) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_NOT_FOUND', 'message', 'Contrôleur introuvable.');
    END IF;

    -- Une ligne par événement (la dernière l'emporte)
    SELECT COALESCE(jsonb_agg(jsonb_build_object('event_id', x.event_id, 'can_accept_cash', x.cash) ORDER BY x.event_id), '[]'::jsonb)
      INTO v_req
      FROM (SELECT DISTINCT ON (public.try_uuid(a->>'event_id')) public.try_uuid(a->>'event_id') AS event_id,
                   CASE WHEN jsonb_typeof(a->'can_accept_cash') = 'boolean' THEN (a->>'can_accept_cash')::boolean END AS cash
              FROM jsonb_array_elements(p->'assignments') WITH ORDINALITY AS t(a, o)
             ORDER BY public.try_uuid(a->>'event_id'), o DESC) x;
    SELECT COALESCE(array_agg((a->>'event_id')::uuid), ARRAY[]::uuid[]) INTO v_requested FROM jsonb_array_elements(v_req) a;

    IF EXISTS (SELECT 1 FROM unnest(v_requested) r(id) LEFT JOIN public.events e ON e.id = r.id
                WHERE e.id IS NULL OR (v_partner IS NOT NULL AND e.partner_id IS DISTINCT FROM v_partner)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_OWNED', 'message', 'Vous n''êtes pas propriétaire de tous les événements sélectionnés.');
    END IF;

    SELECT COALESCE(array_agg(ec.event_id), ARRAY[]::uuid[]) INTO v_current
      FROM public.event_controllers ec JOIN public.events e ON e.id = ec.event_id
     WHERE ec.user_id = v_ctrl AND (v_partner IS NULL OR e.partner_id = v_partner);
    SELECT COALESCE(array_agg(r.id ORDER BY r.id), ARRAY[]::uuid[]) INTO v_added FROM unnest(v_requested) r(id) WHERE NOT r.id = ANY (v_current);
    SELECT COALESCE(array_agg(c.id ORDER BY c.id), ARRAY[]::uuid[]) INTO v_removed FROM unnest(v_current) c(id) WHERE NOT c.id = ANY (v_requested);

    -- cvf1 (migration 13) : un compte d'administration (ADMIN, SUPERADMIN) ne reçoit jamais d'événement ; même texte neutre
    -- que la route (aucun nom, aucune raison). Retirer ses événements et changer son droit d'encaisser restent possibles
    -- (comptes devenus contrôleurs avant le correctif, rapport de la finition § 0.1).
    IF cardinality(v_added) > 0 AND public.account_is_staff(v_ctrl) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_INVITABLE', 'message', 'Ce numéro ne peut pas être invité comme contrôleur. Choisissez une autre personne.');
    END IF;

    -- Seuls les événements confirmés (VALIDE ou PUBLIE) sont nouvellement affectés
    IF EXISTS (SELECT 1 FROM public.events e WHERE e.id = ANY (v_added) AND e.status::text NOT IN ('VALIDE', 'PUBLIE')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ELIGIBLE', 'message', 'Seuls les événements validés ou publiés peuvent être affectés.');
    END IF;

    -- Lot 9 ter (9t.5, consigne 0.5, B-D6 à B-D8) : une partenaire qui n'a jamais eu ce contrôleur dans son équipe
    -- ne l'affecte pas directement ; il accepte d'abord son invitation (R37). Compte temporaire jamais activé :
    -- inchangé (il consent par l'activation). Admin agissant : la partenaire de chaque événement ajouté.
    IF cardinality(v_added) > 0
       AND COALESCE((SELECT a.raw_app_meta_data->>'controller_activation_pending' FROM auth.users a WHERE a.id = v_ctrl), 'false') <> 'true'
       AND EXISTS (SELECT 1 FROM public.events e
                    WHERE e.id = ANY (v_added) AND NOT public.partner_controller_known(e.partner_id, v_ctrl)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_CONSENT_REQUIRED',
                                  'message', 'Ce contrôleur doit d’abord accepter votre invitation.');
    END IF;

    IF cardinality(v_removed) > 0 THEN
        DELETE FROM public.event_controllers WHERE user_id = v_ctrl AND event_id = ANY (v_removed);
    END IF;
    IF cardinality(v_added) > 0 THEN
        INSERT INTO public.event_controllers (event_id, user_id, can_accept_cash, created_by)
        SELECT (a->>'event_id')::uuid, v_ctrl, COALESCE((a->>'can_accept_cash')::boolean, FALSE), v_actor
          FROM jsonb_array_elements(v_req) a
         WHERE (a->>'event_id')::uuid = ANY (v_added);
    END IF;
    UPDATE public.event_controllers ec
       SET can_accept_cash = (a->>'can_accept_cash')::boolean
      FROM jsonb_array_elements(v_req) a
     WHERE ec.user_id = v_ctrl AND ec.event_id = (a->>'event_id')::uuid
       AND NOT ec.event_id = ANY (v_added)
       AND jsonb_typeof(a->'can_accept_cash') = 'boolean'
       AND ec.can_accept_cash IS DISTINCT FROM (a->>'can_accept_cash')::boolean;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, v_role, 'CONTROLLER_ASSIGNMENTS_UPDATED', 'event_controllers', v_ctrl,
            jsonb_build_object('event_ids', to_jsonb(v_current)),
            jsonb_build_object('event_ids', to_jsonb(v_requested), 'added', to_jsonb(v_added), 'removed', to_jsonb(v_removed),
                               'cash_updated', v_updated),
            jsonb_build_object('partner_id', v_partner, 'controller_id', v_ctrl));

    RETURN jsonb_build_object('ok', true, 'added', to_jsonb(v_added), 'removed', to_jsonb(v_removed), 'updated', v_updated);
END;
$$;
REVOKE ALL ON FUNCTION public.controller_assignments_sync(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.controller_assignments_sync(jsonb) TO service_role;

-- 2.9 atomic_partner_remove_controller (recopie de 20261102000002_lot5_dette.sql) : « Retirer de l’équipe ». Auteur ajouté
-- (p_actor_id, passé par la route DELETE /api/partner/team/controller/[controllerId]) ; sans auteur (appel de la plateforme,
-- tests du lot 5), rien ne change. L'ancienne signature à deux paramètres est retirée : un appel à deux paramètres
-- trouve la nouvelle (auteur NULL).
DROP FUNCTION IF EXISTS public.atomic_partner_remove_controller(uuid, uuid);
CREATE OR REPLACE FUNCTION public.atomic_partner_remove_controller(p_partner_id uuid, p_controller_id uuid, p_actor_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_removed integer;
    v_remaining integer;
    v_role_removed integer := 0;
BEGIN
    -- Correctifs de la contre-vérification (T1) : fiche SUSPENDU, équipe en lecture seule pour la partenaire (l'admin
    -- events.write garde ses actions), contrôlé avant tout le reste
    IF public.partner_team_owner_suspended(p_partner_id, p_actor_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    IF p_partner_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_REQUIRED', 'message', 'Précisez l''organisateur dont le contrôleur doit être retiré.');
    END IF;
    IF p_controller_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_REQUIRED', 'message', 'Contrôleur à retirer non précisé.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.partners WHERE id = p_partner_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_FOUND', 'message', 'Organisateur introuvable.');
    END IF;

    -- Verrous : retrait concurrent du même contrôleur, puis profil (sérialise avec user_roles_set)
    PERFORM pg_advisory_xact_lock(hashtext('smart_delete_' || p_controller_id::text));
    PERFORM 1 FROM public.users WHERE id = p_controller_id FOR UPDATE;

    -- Le trigger controller_removal_guard refuse (EV409) le retrait d'une affectation à caisse ouverte
    WITH del AS (
        DELETE FROM public.event_controllers ec
         USING public.events e
         WHERE ec.event_id = e.id AND e.partner_id = p_partner_id AND ec.user_id = p_controller_id
        RETURNING ec.id
    )
    SELECT count(*)::int INTO v_removed FROM del;
    IF v_removed = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_NOT_IN_TEAM', 'removed_assignments', 0,
                                  'message', 'Ce contrôleur ne fait pas partie de l''équipe de cet organisateur.');
    END IF;

    SELECT count(*)::int INTO v_remaining FROM public.event_controllers WHERE user_id = p_controller_id;
    IF v_remaining = 0 THEN
        DELETE FROM public.user_roles WHERE user_id = p_controller_id AND role = 'CONTROLEUR';
        GET DIAGNOSTICS v_role_removed = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object('ok', true, 'removed_assignments', v_removed, 'remaining_assignments', v_remaining,
                              'is_exclusive', (v_remaining = 0), 'role_removed', (v_role_removed > 0),
                              'new_role', CASE WHEN v_remaining = 0 THEN 'CLIENT' ELSE 'CONTROLEUR' END);
END;
$$;
REVOKE ALL ON FUNCTION public.atomic_partner_remove_controller(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_partner_remove_controller(uuid, uuid, uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 3. Écritures que des routes faisaient directement : désormais par une fonction, fiche contrôlée en tête
-- ----------------------------------------------------------------------------
-- 3.1 Point d'entrée d'un contrôleur sur un événement sans portes (PATCH /api/partner/team/entry-point).
-- p : { actor_id, event_id, controller_id, entry_point }. La route vérifie avant la propriété, la permission et le motif
-- d'un admin ; la fonction refuse la fiche SUSPENDU, un auteur sans droit sur l'événement, un événement à portes.
CREATE OR REPLACE FUNCTION public.event_controller_entry_point_set(p jsonb)
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
    v_entry text := NULLIF(btrim(COALESCE(p->>'entry_point', '')), '');
    v_id uuid;
    a record;
BEGIN
    -- Correctifs de la contre-vérification (T1) : fiche SUSPENDU, équipe en lecture seule pour la partenaire (l'admin
    -- events.write garde ses actions), contrôlé avant tout le reste
    IF public.partner_owner_suspended(v_event, v_actor) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    IF v_actor IS NULL OR v_event IS NULL OR v_controller IS NULL
       OR COALESCE(jsonb_typeof(p->'entry_point'), 'null') NOT IN ('null', 'string')
       OR char_length(COALESCE(v_entry, '')) > 80 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Point d’entrée invalide (80 caractères au plus).');
    END IF;
    PERFORM 1 FROM public.events e WHERE e.id = v_event FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (COALESCE(a.is_owner, FALSE) OR COALESCE(a.is_staff, FALSE)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = v_event) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'GATES_CONFIGURED',
            'message', 'Cet événement a des portes : choisissez la porte du contrôleur dans la liste.');
    END IF;
    UPDATE public.event_controllers
       SET entry_point = v_entry
     WHERE event_id = v_event AND user_id = v_controller
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_ASSIGNED', 'message', 'Ce contrôleur n’est pas affecté à cet événement.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'assignment_id', v_id, 'entry_point', v_entry);
END;
$$;
REVOKE ALL ON FUNCTION public.event_controller_entry_point_set(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_controller_entry_point_set(jsonb) TO service_role;

-- 3.2 Retrait d'affectations (DELETE /api/partner/team/[eventId] : « Retirer de cet événement » ; DELETE
-- /api/partner/team/all : toutes les affectations d'un contrôleur chez l'organisatrice).
-- p : { actor_id, assignment_ids: [uuid, …], event_id? }. Toutes ou aucune : la fiche SUSPENDU est refusée si une seule
-- affectation est sur un de ses événements ; un auteur sans droit sur l'un des événements, une affectation inconnue (ou
-- d'un autre événement que event_id) → ASSIGNMENT_NOT_FOUND, rien n'est retiré. Le déclencheur controller_removal_guard
-- refuse toujours une affectation à caisse ouverte (EV409) ; l'avis de retrait au contrôleur part par le déclencheur
-- trg_event_controllers_notify, comme avant.
CREATE OR REPLACE FUNCTION public.event_controllers_remove(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_ids uuid[];
    v_found integer;
    v_removed jsonb;
BEGIN
    -- Correctifs de la contre-vérification (T1) : fiche SUSPENDU, équipe en lecture seule pour la partenaire (l'admin
    -- events.write garde ses actions), contrôlé avant tout le reste
    IF jsonb_typeof(p->'assignment_ids') = 'array'
       AND EXISTS (SELECT 1 FROM public.event_controllers ec
                    WHERE ec.id IN (SELECT public.try_uuid(x) FROM jsonb_array_elements_text(p->'assignment_ids') x)
                      AND public.partner_owner_suspended(ec.event_id, v_actor)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    IF v_actor IS NULL OR jsonb_typeof(p->'assignment_ids') IS DISTINCT FROM 'array'
       OR jsonb_array_length(p->'assignment_ids') = 0 OR jsonb_array_length(p->'assignment_ids') > 500
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p->'assignment_ids') x WHERE public.try_uuid(x) IS NULL)
       OR (COALESCE(jsonb_typeof(p->'event_id'), 'null') <> 'null' AND v_event IS NULL) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Affectations illisibles.');
    END IF;
    SELECT array_agg(DISTINCT public.try_uuid(x)) INTO v_ids FROM jsonb_array_elements_text(p->'assignment_ids') x;
    -- Affectations verrouillées, toutes connues, de l'événement donné s'il l'est, et sur des événements de l'auteur (ou
    -- d'une organisatrice qu'un admin events.write gère)
    SELECT count(*)::int INTO v_found
      FROM (SELECT ec.id FROM public.event_controllers ec
             WHERE ec.id = ANY (v_ids) AND (v_event IS NULL OR ec.event_id = v_event)
               FOR UPDATE) l;
    IF v_found <> cardinality(v_ids)
       OR EXISTS (SELECT 1 FROM public.event_controllers ec
                   LEFT JOIN LATERAL public.event_actor_profile(ec.event_id, v_actor) a ON TRUE
                   WHERE ec.id = ANY (v_ids) AND NOT (COALESCE(a.is_owner, FALSE) OR COALESCE(a.is_staff, FALSE))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ASSIGNMENT_NOT_FOUND', 'message', 'Affectation introuvable.');
    END IF;
    WITH del AS (
        DELETE FROM public.event_controllers ec WHERE ec.id = ANY (v_ids)
        RETURNING ec.id, ec.event_id, ec.user_id
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', del.id, 'event_id', del.event_id, 'controller_id', del.user_id)
                              ORDER BY del.id), '[]'::jsonb)
      INTO v_removed FROM del;
    RETURN jsonb_build_object('ok', true, 'removed', v_removed);
END;
$$;
REVOKE ALL ON FUNCTION public.event_controllers_remove(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_controllers_remove(jsonb) TO service_role;

-- 3.3 Affectations d'un compte de contrôleur créé par l'invitation (POST /api/partner/team/invite, numéro inconnu :
-- affecté tout de suite, activation par code) : droit d'encaisser des affectations existantes, puis nouvelles affectations
-- en une seule instruction (trg_event_controllers_notify : un seul SMS regroupé, comme avant).
-- p : { actor_id, controller_id, event_ids: [uuid, …], can_accept_cash }. Fiche SUSPENDU refusée en tête (un seul de ses
-- événements suffit) ; un événement inconnu, ou sur lequel l'auteur n'a pas de droit → EVENT_NOT_OWNED, rien n'est écrit.
-- La garde de la table (migration 20261115000013) refuse toujours un compte d'administration (NOT_INVITABLE).
CREATE OR REPLACE FUNCTION public.event_controllers_add(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_ctrl uuid := public.try_uuid(p->>'controller_id');
    v_cash boolean;
    v_events uuid[];
    v_new uuid[];
    v_rows jsonb;
BEGIN
    -- Correctifs de la contre-vérification (T1) : fiche SUSPENDU, équipe en lecture seule pour la partenaire (l'admin
    -- events.write garde ses actions), contrôlé avant tout le reste
    IF jsonb_typeof(p->'event_ids') = 'array'
       AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(p->'event_ids') x
                    WHERE public.partner_owner_suspended(public.try_uuid(x), v_actor)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    IF v_actor IS NULL OR v_ctrl IS NULL OR jsonb_typeof(p->'event_ids') IS DISTINCT FROM 'array'
       OR jsonb_array_length(p->'event_ids') = 0 OR jsonb_array_length(p->'event_ids') > 200
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p->'event_ids') x WHERE public.try_uuid(x) IS NULL)
       OR jsonb_typeof(p->'can_accept_cash') IS DISTINCT FROM 'boolean' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Affectations illisibles.');
    END IF;
    v_cash := (p->>'can_accept_cash')::boolean;
    SELECT array_agg(DISTINCT public.try_uuid(x)) INTO v_events FROM jsonb_array_elements_text(p->'event_ids') x;
    IF EXISTS (SELECT 1 FROM unnest(v_events) ev(id)
                LEFT JOIN public.events e ON e.id = ev.id
                LEFT JOIN LATERAL public.event_actor_profile(ev.id, v_actor) a ON TRUE
                WHERE e.id IS NULL OR NOT (COALESCE(a.is_owner, FALSE) OR COALESCE(a.is_staff, FALSE))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_OWNED',
            'message', 'Vous n’êtes pas propriétaire de tous les événements sélectionnés.');
    END IF;
    UPDATE public.event_controllers ec
       SET can_accept_cash = v_cash
     WHERE ec.user_id = v_ctrl AND ec.event_id = ANY (v_events) AND ec.can_accept_cash IS DISTINCT FROM v_cash;
    WITH ins AS (
        INSERT INTO public.event_controllers (event_id, user_id, can_accept_cash, created_by)
        SELECT ev.id, v_ctrl, v_cash, v_actor
          FROM unnest(v_events) ev(id)
         WHERE NOT EXISTS (SELECT 1 FROM public.event_controllers x WHERE x.event_id = ev.id AND x.user_id = v_ctrl)
        RETURNING id
    )
    SELECT COALESCE(array_agg(ins.id), ARRAY[]::uuid[]) INTO v_new FROM ins;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', ec.id, 'event_id', ec.event_id, 'user_id', ec.user_id,
                                                 'can_accept_cash', ec.can_accept_cash, 'created_at', ec.created_at,
                                                 'inserted', ec.id = ANY (v_new))
                              ORDER BY array_position(v_events, ec.event_id)), '[]'::jsonb)
      INTO v_rows
      FROM public.event_controllers ec
     WHERE ec.user_id = v_ctrl AND ec.event_id = ANY (v_events);
    RETURN jsonb_build_object('ok', true, 'assignments', v_rows);
END;
$$;
REVOKE ALL ON FUNCTION public.event_controllers_add(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_controllers_add(jsonb) TO service_role;
