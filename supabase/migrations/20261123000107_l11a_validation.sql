-- ============================================================================
-- EVENT VILLAGE — LOT 11a, migration 07 : validation des établissements par l'administration
-- ============================================================================
-- Décision du client : un établissement n'est visible qu'après validation par l'administration (réglage
-- tables.validation_required, activé), comme les salles et les événements.
--  1. venue_validation_decide(p) : VALIDER (établissement en attente, partenaire VALIDE), REFUSER (motif), SUSPENDRE
--     (établissement validé, motif), REACTIVER (établissement suspendu) ; administrateur actif avec le droit
--     partners.validate (ou Superadmin) ; verrou, journal, avis à la partenaire. Seule écriture admise du statut
--     (drapeau event_village.venue_validation lu par trg_venues_validation_guard, migration 02). Un établissement
--     suspendu garde ses réservations déjà prises ; il n'en reçoit plus de nouvelles ;
--  2. trg_venues_submitted : un établissement créé en attente, ou refusé puis modifié (de nouveau en attente : le
--     statut est changé par le déclencheur BEFORE, d'où un déclencheur AFTER UPDATE sans liste de colonnes),
--     prévient les administrateurs qui peuvent valider : cloche, push et email (ADMIN_VENUE_SUBMITTED) et SMS groupé
--     (ADMIN_REVIEW_SMS, au plus un par 30 minutes et par admin, rien de 22 h à 8 h : reporté à 8 h) ;
--  3. notif_admin_review_sms : recopie de 20261112000001_lot9quinquies_admin_sms.sql:70-155 ; élément VENUE_SUBMITTED (droit partners.validate), compté à part
--     (venue_count) dans le SMS groupé.
-- Rejouable : CREATE OR REPLACE, DROP TRIGGER IF EXISTS puis CREATE, REVOKE et GRANT idempotents.
-- ============================================================================

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
               OR public.has_admin_permission(v_actor, 'partners.validate')) THEN
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

-- Établissement soumis (créé en attente, ou refusé puis modifié) : les administrateurs qui peuvent valider sont prévenus
CREATE OR REPLACE FUNCTION public.venues_notify_submitted()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ref text;
BEGIN
    IF NEW.validation_status <> 'EN_ATTENTE_VALIDATION'
       OR (TG_OP = 'UPDATE' AND OLD.validation_status = 'EN_ATTENTE_VALIDATION') THEN
        RETURN NULL;
    END IF;
    v_ref := NEW.id::text || ':' || extract(epoch FROM now())::bigint::text;
    PERFORM public.notif_enqueue_admins(jsonb_build_object(
        'type', 'ADMIN_VENUE_SUBMITTED', 'ref', v_ref,
        'data', jsonb_build_object('venue_id', NEW.id, 'venue_name', NEW.name, 'kind', NEW.kind, 'city', NEW.city,
                                   'resubmitted', TG_OP = 'UPDATE')));
    PERFORM public.notif_admin_review_sms(jsonb_build_object('kind', 'VENUE_SUBMITTED', 'ref', v_ref));
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.venues_notify_submitted() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_venues_submitted ON public.venues;
CREATE TRIGGER trg_venues_submitted
    AFTER INSERT OR UPDATE ON public.venues
    FOR EACH ROW EXECUTE FUNCTION public.venues_notify_submitted();


-- Recopie de 20261112000001_lot9quinquies_admin_sms.sql:70-155 ; changement : élément VENUE_SUBMITTED, compté dans venue_count.
CREATE OR REPLACE FUNCTION public.notif_admin_review_sms(p jsonb)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_kind    text := btrim(COALESCE(p->>'kind', ''));
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
                    'venue_count', COALESCE((v_row.template_data->>'venue_count')::integer, 0) + CASE WHEN v_kind = 'VENUE_SUBMITTED' THEN 1 ELSE 0 END,
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
                'venue_count', CASE WHEN v_kind = 'VENUE_SUBMITTED' THEN 1 ELSE 0 END,
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
