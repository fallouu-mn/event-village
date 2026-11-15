-- ============================================================================
-- EVENT VILLAGE — Correctifs de la contre-vérification de la finition 1 — T1 : un compte ADMIN ou SUPERADMIN ne peut
-- jamais être invité ni devenir contrôleur
-- ============================================================================
-- account_is_staff(compte) : rôle ADMIN ou SUPERADMIN dans user_roles, ou users.role. Utilisée par :
--  - controller_invitation_create (recopie de 20261115000002, seul ajout : refus NOT_INVITABLE avant toute écriture) ;
--  - controller_invitation_respond (recopie de 20261115000002, seul ajout : acceptation refusée à un compte
--    d'administration ; le refus de l'invitation reste possible).
-- La route d'invitation refuse avant la confirmation « ce numéro a déjà un compte » (aucun nom masqué, aucun SMS).
-- Toutes réservées au service_role. Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.account_is_staff(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p_user AND ur.role::text IN ('ADMIN', 'SUPERADMIN'))
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user AND u.role::text IN ('ADMIN', 'SUPERADMIN'))
$$;

-- ----------------------------------------------------------------------------
-- Recopie de controller_invitation_create (20261115000002) : + refus d'un compte d'administration
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Recopie de controller_invitation_respond (20261115000002) : + acceptation refusée à un compte d'administration
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.controller_invitation_respond(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid := public.try_uuid(p->>'invitation_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_accept boolean;
    inv record;
    v_assigned uuid[];
BEGIN
    IF v_id IS NULL OR v_actor IS NULL OR jsonb_typeof(p->'accept') IS DISTINCT FROM 'boolean' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Réponse incomplète.');
    END IF;
    v_accept := (p->>'accept')::boolean;
    SELECT * INTO inv FROM public.controller_invitations WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    IF inv.user_id IS DISTINCT FROM v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n''est pas actif.');
    END IF;
    -- Finition 1 (E-19) : invitation annulée par l'organisateur
    IF inv.status = 'CANCELLED' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_CANCELLED', 'message', 'L’organisateur a annulé cette invitation.');
    END IF;
    IF inv.status <> 'PENDING' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_PENDING', 'status', inv.status, 'message', 'Cette invitation a déjà reçu une réponse.');
    END IF;
    IF inv.expires_at <= now() THEN
        UPDATE public.controller_invitations SET status = 'EXPIRED', responded_at = now() WHERE id = inv.id;
        PERFORM public.controller_invitation_notify_partner(inv.id, 'CONTROLLER_INVITATION_EXPIRED');
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_EXPIRED', 'message', 'Cette invitation a expiré.');
    END IF;

    -- cvf1 T1 : un compte d'administration ne devient jamais contrôleur ; il peut encore refuser l'invitation
    IF v_accept AND public.account_is_staff(v_actor) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_INVITABLE', 'message', 'Ce compte ne peut pas devenir contrôleur. Refusez cette invitation.');
    END IF;

    IF NOT v_accept THEN
        UPDATE public.controller_invitations SET status = 'DECLINED', responded_at = now() WHERE id = inv.id;
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
        VALUES (v_actor, 'CLIENT', 'CONTROLLER_INVITATION_DECLINED', 'controller_invitations', inv.id,
                jsonb_build_object('partner_id', inv.partner_id));
        PERFORM public.controller_invitation_notify_partner(inv.id, 'CONTROLLER_INVITATION_DECLINED');
        RETURN jsonb_build_object('ok', true, 'status', 'DECLINED');
    END IF;

    -- Rôle CONTROLEUR ajouté au compte, sans toucher au reste (users.role recalculé par le trigger de user_roles)
    INSERT INTO public.user_roles (user_id, role) VALUES (v_actor, 'CLIENT'), (v_actor, 'CONTROLEUR')
    ON CONFLICT (user_id, role) DO NOTHING;
    -- Affectations aux événements encore VALIDE ou PUBLIE de la partenaire, en une instruction (un SMS regroupé)
    WITH ins AS (
        INSERT INTO public.event_controllers (event_id, user_id, can_accept_cash, created_by)
        SELECT e.id, v_actor, COALESCE((a->>'can_accept_cash')::boolean, FALSE), inv.created_by
          FROM jsonb_array_elements(inv.assignments) a
          JOIN public.events e ON e.id = public.try_uuid(a->>'event_id')
         WHERE e.partner_id = inv.partner_id AND e.status::text IN ('VALIDE', 'PUBLIE')
        ON CONFLICT (event_id, user_id) DO NOTHING
        RETURNING event_id
    )
    SELECT COALESCE(array_agg(event_id ORDER BY event_id), ARRAY[]::uuid[]) INTO v_assigned FROM ins;
    UPDATE public.controller_invitations SET status = 'ACCEPTED', responded_at = now() WHERE id = inv.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value, metadata)
    VALUES (v_actor, 'CLIENT', 'CONTROLLER_INVITATION_ACCEPTED', 'controller_invitations', inv.id,
            jsonb_build_object('assigned_event_ids', to_jsonb(v_assigned)), jsonb_build_object('partner_id', inv.partner_id));
    PERFORM public.controller_invitation_notify_partner(inv.id, 'CONTROLLER_INVITATION_ACCEPTED');
    RETURN jsonb_build_object('ok', true, 'status', 'ACCEPTED', 'assigned_event_ids', to_jsonb(v_assigned));
END;
$$;

REVOKE ALL ON FUNCTION public.account_is_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.controller_invitation_create(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.controller_invitation_respond(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_is_staff(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.controller_invitation_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.controller_invitation_respond(jsonb) TO service_role;
