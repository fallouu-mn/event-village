-- ============================================================================
-- EVENT VILLAGE — Correctifs de la contre-vérification de la finition 1 — R2 : invitations simultanées du même numéro
-- ============================================================================
-- Recopie de controller_invitation_create (20261115000006, refus d'un compte d'administration compris) ; seul ajout : un
-- verrou transactionnel par organisatrice et par compte (pg_advisory_xact_lock), puis le refus INVITATION_ALREADY_SENT
-- d'une invitation identique encore en attente, créée il y a moins de 60 secondes. Quatre demandes simultanées : une
-- seule invitation créée, un seul SMS. Réservée au service_role. Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

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
