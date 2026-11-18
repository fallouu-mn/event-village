-- ============================================================================
-- EVENT VILLAGE — LOT 10a, migration 06 : validation des salles par l'administration
-- ============================================================================
-- Décision du client : une salle n'est visible qu'après validation par l'administration (réglage
-- halls.validation_required, activé par défaut), sur le modèle des événements.
--  hall_validation_decide(p) : VALIDER (salle en attente, prix par jour renseigné, partenaire VALIDE), REFUSER
--  (motif), SUSPENDRE (salle validée, motif), REACTIVER (salle suspendue) ; administrateur actif avec le droit
--  partners.validate (ou Superadmin) ; verrou, journal, avis à la partenaire. Seule écriture admise du statut de
--  validation (drapeau event_village.hall_validation lu par trg_halls_validation_guard, migration 02).
--  Une salle suspendue garde ses réservations déjà payées ; elle n'en reçoit plus de nouvelles.
-- Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hall_validation_decide(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_hall_id  uuid := public.try_uuid(p->>'hall_id');
    v_decision text := upper(COALESCE(p->>'decision', ''));
    v_reason   text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'reason', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    h          record;
    v_new      text;
    v_role     text;
    v_owner    uuid;
BEGIN
    IF v_actor IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
       OR NOT (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
               OR public.has_admin_permission(v_actor, 'partners.validate')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit de valider les salles.');
    END IF;
    IF v_decision NOT IN ('VALIDER', 'REFUSER', 'SUSPENDRE', 'REACTIVER') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DECISION', 'message', 'Choisissez de valider, refuser, suspendre ou réactiver la salle.');
    END IF;
    SELECT hl.*, pa.status::text AS partner_status, pa.user_id AS owner_id INTO h
      FROM public.halls hl JOIN public.partners pa ON pa.id = hl.partner_id
     WHERE hl.id = v_hall_id FOR UPDATE OF hl;
    IF v_hall_id IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'HALL_NOT_FOUND', 'message', 'Cette salle n’existe pas.');
    END IF;
    IF v_decision IN ('REFUSER', 'SUSPENDRE') AND (v_reason IS NULL OR length(v_reason) < 5) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif : il est envoyé à la partenaire.');
    END IF;
    v_new := CASE
        WHEN v_decision = 'VALIDER' AND h.validation_status = 'EN_ATTENTE_VALIDATION' THEN 'VALIDEE'
        WHEN v_decision = 'REFUSER' AND h.validation_status = 'EN_ATTENTE_VALIDATION' THEN 'REFUSEE'
        WHEN v_decision = 'SUSPENDRE' AND h.validation_status = 'VALIDEE' THEN 'SUSPENDUE'
        WHEN v_decision = 'REACTIVER' AND h.validation_status = 'SUSPENDUE' THEN 'VALIDEE'
        END;
    IF v_new IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION', 'message', 'Cette décision ne s’applique pas à la salle dans son état actuel.');
    END IF;
    IF v_new = 'VALIDEE' AND (h.price_per_day IS NULL OR h.price_per_day < 1) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PRICE_MISSING', 'message', 'La salle n’a pas de prix par jour : la partenaire doit le renseigner avant la validation.');
    END IF;
    IF v_new = 'VALIDEE' AND h.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_VALIDATED', 'message', 'Le compte de la partenaire n’est pas validé : validez-le d’abord.');
    END IF;

    PERFORM set_config('event_village.hall_validation', 'on', true);
    UPDATE public.halls
       SET validation_status = v_new, validation_reason = CASE WHEN v_new IN ('REFUSEE', 'SUSPENDUE') THEN v_reason END,
           validated_by = v_actor, validated_at = now(), updated_at = now()
     WHERE id = h.id;
    PERFORM set_config('event_village.hall_validation', 'off', true);

    v_role := CASE WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
                   THEN 'SUPERADMIN' ELSE 'ADMIN' END;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, v_role, 'HALL_VALIDATION_DECIDED', 'halls', h.id,
            jsonb_build_object('validation_status', h.validation_status),
            jsonb_build_object('validation_status', v_new),
            jsonb_build_object('decision', v_decision, 'reason', v_reason));
    IF h.owner_id IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'HALL_VALIDATION_DECIDED', 'key', 'HALL_VALIDATION_DECIDED:' || h.id::text || ':' || txid_current()::text,
            'user_id', h.owner_id,
            'data', jsonb_strip_nulls(jsonb_build_object('hall_id', h.id, 'hall_name', h.name, 'decision', v_decision, 'reason', v_reason))));
    END IF;
    RETURN jsonb_build_object('ok', true, 'hall_id', h.id, 'validation_status', v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.hall_validation_decide(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hall_validation_decide(jsonb) TO service_role;
