-- ============================================================================
-- EVENT VILLAGE — LOT 10b, migration 01 : droit unique « Valider les salles et les établissements »
-- ============================================================================
-- Consigne du lot 10b (point 1) : une nouvelle permission halls.validate, dans le profil « Validation », sert à la
-- validation des salles ET des établissements de tables ; elle remplace partners.validate pour ces deux usages
-- (partners.validate garde la validation des comptes partenaires).
--  1. hall_validation_decide : recopie de 20261122000006_l10a_validation.sql:14-87 ; changement : droit lu par
--     admin_can(v_actor, 'halls.validate') (rôles de user_roles), au lieu de has_admin_permission(…, 'partners.validate')
--     (ancienne fonction qui lit users.role) ;
--  2. venue_validation_decide : recopie de 20261123000107_l11a_validation.sql:20-89 ; même changement ;
--  3. notif_admin_review_sms : recopie de 20261123000107_l11a_validation.sql:127-216 ; changements : élément
--     HALL_SUBMITTED (salle envoyée en validation, compté dans hall_count) ; établissements et salles prévenus aux
--     administrateurs qui ont halls.validate ;
--  4. type d'avis ADMIN_VENUE_SUBMITTED : destinataires avec halls.validate (au lieu de partners.validate).
-- Aucun administrateur ne reçoit le droit d'office : le Superadmin le coche (profil « Validation » ou case à cocher).
-- Rejouable : CREATE OR REPLACE (droits d'exécution conservés), UPDATE idempotent, REVOKE et GRANT idempotents.
-- ============================================================================

-- Recopie de 20261122000006_l10a_validation.sql:14-87 ; changement : droit halls.validate lu par admin_can.
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
               OR public.admin_can(v_actor, 'halls.validate')) THEN
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

-- Recopie de 20261123000107_l11a_validation.sql:20-89 ; changement : droit halls.validate lu par admin_can.
CREATE OR REPLACE FUNCTION public.venue_validation_decide(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    v_decision text := upper(COALESCE(p->>'decision', ''));
    v_reason   text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'reason', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    v          record;
    v_new      text;
    v_role     text;
BEGIN
    IF v_actor IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
       OR NOT (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
               OR public.admin_can(v_actor, 'halls.validate')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit de valider les établissements.');
    END IF;
    IF v_decision NOT IN ('VALIDER', 'REFUSER', 'SUSPENDRE', 'REACTIVER') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DECISION', 'message', 'Choisissez de valider, refuser, suspendre ou réactiver l’établissement.');
    END IF;
    SELECT ve.*, pa.status::text AS partner_status, pa.user_id AS owner_id INTO v
      FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id
     WHERE ve.id = v_venue_id FOR UPDATE OF ve;
    IF v_venue_id IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_FOUND', 'message', 'Cet établissement n’existe pas.');
    END IF;
    IF v_decision IN ('REFUSER', 'SUSPENDRE') AND (v_reason IS NULL OR length(v_reason) < 5) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif : il est envoyé à la partenaire.');
    END IF;
    v_new := CASE
        WHEN v_decision = 'VALIDER' AND v.validation_status = 'EN_ATTENTE_VALIDATION' THEN 'VALIDEE'
        WHEN v_decision = 'REFUSER' AND v.validation_status = 'EN_ATTENTE_VALIDATION' THEN 'REFUSEE'
        WHEN v_decision = 'SUSPENDRE' AND v.validation_status = 'VALIDEE' THEN 'SUSPENDUE'
        WHEN v_decision = 'REACTIVER' AND v.validation_status = 'SUSPENDUE' THEN 'VALIDEE'
        END;
    IF v_new IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION', 'message', 'Cette décision ne s’applique pas à l’établissement dans son état actuel.');
    END IF;
    IF v_new = 'VALIDEE' AND v.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_VALIDATED', 'message', 'Le compte de la partenaire n’est pas validé : validez-le d’abord.');
    END IF;

    PERFORM set_config('event_village.venue_validation', 'on', true);
    UPDATE public.venues
       SET validation_status = v_new, validation_reason = CASE WHEN v_new IN ('REFUSEE', 'SUSPENDUE') THEN v_reason END,
           validated_by = v_actor, validated_at = now(), updated_at = now()
     WHERE id = v.id;
    PERFORM set_config('event_village.venue_validation', 'off', true);

    v_role := CASE WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
                   THEN 'SUPERADMIN' ELSE 'ADMIN' END;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, v_role, 'VENUE_VALIDATION_DECIDED', 'venues', v.id,
            jsonb_build_object('validation_status', v.validation_status),
            jsonb_build_object('validation_status', v_new),
            jsonb_build_object('decision', v_decision, 'reason', v_reason));
    IF v.owner_id IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'VENUE_VALIDATION_DECIDED', 'key', 'VENUE_VALIDATION_DECIDED:' || v.id::text || ':' || txid_current()::text,
            'user_id', v.owner_id,
            'data', jsonb_strip_nulls(jsonb_build_object('venue_id', v.id, 'venue_name', v.name, 'decision', v_decision, 'reason', v_reason))));
    END IF;
    RETURN jsonb_build_object('ok', true, 'venue_id', v.id, 'validation_status', v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.venue_validation_decide(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.venue_validation_decide(jsonb) TO service_role;

-- Recopie de 20261123000107_l11a_validation.sql:127-216 ; changements : élément HALL_SUBMITTED (hall_count), droit halls.validate pour les salles et les établissements.
CREATE OR REPLACE FUNCTION public.notif_admin_review_sms(p jsonb)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_kind    text := btrim(COALESCE(p->>'kind', ''));
    -- Lot 10b : salle envoyée en validation (HALL_SUBMITTED), comptée à part (hall_count), même droit que les établissements
    v_is_hall boolean := btrim(COALESCE(p->>'kind', '')) = 'HALL_SUBMITTED';
    v_ref     text := NULLIF(btrim(COALESCE(p->>'ref', '')), '');
    v_company text := NULLIF(btrim(COALESCE(p->>'company', '')), '');
    v_now     timestamptz := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    v_perm    text;
    v_only    uuid[];
    v_admin   uuid;
    v_row     record;
    v_last    timestamptz;
    v_due     timestamptz;
    v_data    jsonb;
    v_refs    jsonb;
    v_touched integer := 0;
BEGIN
    -- Lot 10b : une salle suit le chemin d'un établissement (même droit), comptée à part
    IF v_is_hall THEN
        v_kind := 'VENUE_SUBMITTED';
    END IF;
    -- Lot 11a : établissement soumis à la validation (VENUE_SUBMITTED, droit partners.validate)
    IF v_kind NOT IN ('PARTNER_NEW', 'PARTNER_RESUBMITTED', 'EVENT_SUBMITTED', 'VENUE_SUBMITTED') THEN
        RAISE EXCEPTION USING ERRCODE = 'NT004', MESSAGE = format('Élément à valider inconnu : %s.', COALESCE(NULLIF(v_kind, ''), '(vide)'));
    END IF;
    IF v_ref IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'NT004', MESSAGE = 'Référence de l''élément à valider absente.';
    END IF;
    IF v_now < now() - interval '1 minute' THEN
        RAISE EXCEPTION USING ERRCODE = 'NT003', MESSAGE = 'Horloge refusée : une heure dans le passé n''est jamais acceptée.';
    END IF;
    v_perm := CASE WHEN v_kind = 'EVENT_SUBMITTED' THEN 'events.write' ELSE 'partners.validate' END;
    -- Lot 10b : établissements et salles prévenus aux administrateurs qui ont halls.validate
    IF v_kind = 'VENUE_SUBMITTED' THEN
        v_perm := 'halls.validate';
    END IF;
    IF jsonb_typeof(p->'only_admin_ids') = 'array' THEN
        v_only := ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(p->'only_admin_ids') AS x);
    END IF;

    FOR v_admin IN
        SELECT x.admin_id FROM public.notif_admin_recipients(v_perm) AS x(admin_id)
         WHERE v_only IS NULL OR x.admin_id = ANY (v_only)
         ORDER BY x.admin_id
    LOOP
        PERFORM pg_advisory_xact_lock(hashtext('notif.admin_review_sms:' || v_admin::text));

        SELECT o.id, o.template_data INTO v_row
          FROM public.notification_outbox o
         WHERE o.type = 'ADMIN_REVIEW_SMS' AND o.channel = 'SMS' AND o.recipient_user_id = v_admin AND o.status = 'PENDING'
         ORDER BY o.due_at, o.id
         LIMIT 1
           FOR UPDATE;

        IF FOUND THEN
            v_refs := COALESCE(v_row.template_data->'refs', '[]'::jsonb);
            IF NOT (v_refs ? v_ref) THEN
                v_data := jsonb_build_object(
                    'partner_count', COALESCE((v_row.template_data->>'partner_count')::integer, 0) + CASE WHEN v_kind IN ('PARTNER_NEW', 'PARTNER_RESUBMITTED') THEN 1 ELSE 0 END,
                    'venue_count', COALESCE((v_row.template_data->>'venue_count')::integer, 0) + CASE WHEN v_kind = 'VENUE_SUBMITTED' AND NOT v_is_hall THEN 1 ELSE 0 END,
                    'hall_count', COALESCE((v_row.template_data->>'hall_count')::integer, 0) + CASE WHEN v_is_hall THEN 1 ELSE 0 END,
                    'event_count', COALESCE((v_row.template_data->>'event_count')::integer, 0) + CASE WHEN v_kind = 'EVENT_SUBMITTED' THEN 1 ELSE 0 END,
                    'refs', v_refs || to_jsonb(v_ref)
                );
                UPDATE public.notification_outbox SET template_data = v_data WHERE id = v_row.id;
            END IF;
        ELSE
            SELECT max(COALESCE(o.sent_at, o.claimed_at, o.finished_at)) INTO v_last
              FROM public.notification_outbox o
             WHERE o.type = 'ADMIN_REVIEW_SMS' AND o.channel = 'SMS' AND o.recipient_user_id = v_admin
               AND o.status IN ('SENDING', 'SENT', 'UNCERTAIN');
            v_due := public.notif_admin_review_due(GREATEST(v_now, COALESCE(v_last + interval '30 minutes', v_now)));
            v_data := jsonb_strip_nulls(jsonb_build_object(
                'partner_count', CASE WHEN v_kind IN ('PARTNER_NEW', 'PARTNER_RESUBMITTED') THEN 1 ELSE 0 END,
                'venue_count', CASE WHEN v_kind = 'VENUE_SUBMITTED' AND NOT v_is_hall THEN 1 ELSE 0 END,
                'hall_count', CASE WHEN v_is_hall THEN 1 ELSE 0 END,
                'event_count', CASE WHEN v_kind = 'EVENT_SUBMITTED' THEN 1 ELSE 0 END,
                'company', CASE WHEN v_kind = 'PARTNER_NEW' THEN COALESCE(v_company, 'Une structure') END,
                'refs', jsonb_build_array(v_ref)
            ));
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'ADMIN_REVIEW_SMS',
                'key', 'ADMIN_REVIEW_SMS:' || v_admin::text || ':' || gen_random_uuid()::text,
                'user_id', v_admin,
                'data', v_data,
                'due_at', v_due,
                'now', v_now
            ));
        END IF;
        v_touched := v_touched + 1;
    END LOOP;
    RETURN v_touched;
END;
$$;

-- 4. Établissement soumis : prévenir les administrateurs qui peuvent le valider (halls.validate)
UPDATE public.notification_types SET admin_permission = 'halls.validate'
 WHERE type = 'ADMIN_VENUE_SUBMITTED' AND admin_permission IS DISTINCT FROM 'halls.validate';
