-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUINQUIES : SMS aux administrateurs pour ce qui attend leur action (D1)
-- ============================================================================
-- D1 (décision du chef de projet) : une nouvelle candidature de partenaire, un dossier complété après refus et un
--   événement soumis à la validation préviennent par SMS le SUPERADMIN et les ADMIN qui ont le droit d'agir
--   (partners.validate pour les candidatures et les dossiers, events.write pour les événements). Cloche, push et email
--   (ADMIN_PARTNER_REGISTERED, ADMIN_PARTNER_RESUBMITTED, ADMIN_EVENT_SUBMITTED) inchangés.
--   - Le premier SMS est dû tout de suite (l'envoyeur passe chaque minute).
--   - Ce qui arrive ensuite pour le même admin, tant que son SMS n'est pas parti, ou dans les 30 minutes qui suivent
--     l'envoi du précédent, est regroupé dans UN SMS : jamais plus d'un SMS par 30 minutes et par admin.
--   - Entre 22 h et 8 h (heure de Dakar), rien ne part : l'échéance est reportée à 8 h, le regroupement de la nuit part
--     à 8 h.
--   - SMS indispensable (famille ESSENTIAL) : hors plafond des SMS optionnels et hors plage de silence des optionnels
--     (la plage de la nuit est appliquée ici, par l'échéance).
-- Objets :
--   registre : ADMIN_REVIEW_SMS (ESSENTIAL, SMS seul, ADMIN, BLOCK ; destinataires choisis par la fonction ci-dessous,
--              admin_permission NULL) ;
--   notif_admin_review_due(timestamptz) : échéance hors de 22 h à 8 h (Dakar) ;
--   notif_admin_review_sms(jsonb) : ajoute un élément au SMS en attente de chaque admin concerné, ou met en file un
--              nouveau SMS (échéance = maintenant, ou envoi précédent + 30 min, puis hors nuit) ;
--   triggers : trg_partners_admin_review_sms (INSERT d'une fiche EN_ATTENTE, UPDATE de resubmitted_at) et
--              trg_event_status_admin_review_sms (BROUILLON → EN_ATTENTE dans event_status_history).
-- Données du SMS (template_data) : partner_count (demandes de partenaire, candidatures et dossiers complétés), event_count
--   (événements), company (société, seulement quand l'unique élément est une candidature nouvelle), refs (références
--   déjà comptées : une même référence n'est jamais comptée deux fois).
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('ADMIN_REVIEW_SMS',           'ESSENTIAL', NULL,            ARRAY['SMS'],                          'ADMIN',      'BLOCK', FALSE, NULL)
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;


-- ----------------------------------------------------------------------------
-- Échéance hors de la nuit : de 22 h à 8 h (heure de Dakar, UTC+0 toute l'année), reportée à 8 h.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_admin_review_due(p_at timestamptz)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE
        WHEN extract(hour FROM (p_at AT TIME ZONE 'Africa/Dakar')) >= 22
            THEN ((date_trunc('day', p_at AT TIME ZONE 'Africa/Dakar') + interval '1 day 8 hours') AT TIME ZONE 'Africa/Dakar')
        WHEN extract(hour FROM (p_at AT TIME ZONE 'Africa/Dakar')) < 8
            THEN ((date_trunc('day', p_at AT TIME ZONE 'Africa/Dakar') + interval '8 hours') AT TIME ZONE 'Africa/Dakar')
        ELSE p_at
    END
$$;

REVOKE ALL ON FUNCTION public.notif_admin_review_due(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notif_admin_review_due(timestamptz) TO service_role;


-- ----------------------------------------------------------------------------
-- notif_admin_review_sms(p) : p = { kind, ref, company?, now?, only_admin_ids? }
--   kind : PARTNER_NEW (candidature), PARTNER_RESUBMITTED (dossier complété), EVENT_SUBMITTED (événement soumis) ;
--   ref  : référence de l'élément (fiche partenaire, ligne d'historique de l'événement) ;
--   now  : horloge simulée (tests), jamais dans le passé ;
--   only_admin_ids : restreint aux admins listés (tests ; l'éligibilité reste exigée).
-- Destinataires : notif_admin_recipients('partners.validate') ou ('events.write') : comptes ACTIF SUPERADMIN, ou ADMIN
-- avec la permission. Pour chacun, sous verrou consultatif : SMS en attente (PENDING) → l'élément y est ajouté
-- (échéance inchangée) ; sinon nouveau SMS, échéance = plus tard de maintenant et du dernier envoi + 30 min, puis hors
-- nuit. Renvoie le nombre d'admins touchés.
-- ----------------------------------------------------------------------------
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
    IF v_kind NOT IN ('PARTNER_NEW', 'PARTNER_RESUBMITTED', 'EVENT_SUBMITTED') THEN
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
                    'partner_count', COALESCE((v_row.template_data->>'partner_count')::integer, 0) + CASE WHEN v_kind = 'EVENT_SUBMITTED' THEN 0 ELSE 1 END,
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
                'partner_count', CASE WHEN v_kind = 'EVENT_SUBMITTED' THEN 0 ELSE 1 END,
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

REVOKE ALL ON FUNCTION public.notif_admin_review_sms(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notif_admin_review_sms(jsonb) TO service_role;

COMMENT ON FUNCTION public.notif_admin_review_sms(jsonb) IS
    'Lot 9 quinquies (D1) : SMS aux admins qui peuvent agir (candidature, dossier complété, événement soumis), regroupé : au plus un par 30 minutes et par admin, rien de 22 h à 8 h (Dakar).';


-- ----------------------------------------------------------------------------
-- Déclencheurs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_partners_admin_review_sms()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Même garde que notif_partners_notify (20261103000006_lot6_pros_admin.sql:638-640) : fiche sans compte, rien.
    IF NEW.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id) THEN
        RETURN NULL;
    END IF;
    IF TG_OP = 'INSERT' THEN
        IF NEW.status::text = 'EN_ATTENTE' THEN
            PERFORM public.notif_admin_review_sms(jsonb_build_object(
                'kind', 'PARTNER_NEW', 'ref', NEW.id::text, 'company', NEW.company_name));
        END IF;
    ELSIF NEW.resubmitted_at IS NOT NULL AND NEW.resubmitted_at IS DISTINCT FROM OLD.resubmitted_at
          AND NEW.status::text = 'EN_ATTENTE' THEN
        PERFORM public.notif_admin_review_sms(jsonb_build_object(
            'kind', 'PARTNER_RESUBMITTED', 'ref', NEW.id::text || ':' || extract(epoch FROM NEW.resubmitted_at)::text));
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notif_partners_admin_review_sms() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_partners_admin_review_sms ON public.partners;
CREATE TRIGGER trg_partners_admin_review_sms
    AFTER INSERT OR UPDATE OF resubmitted_at, status ON public.partners
    FOR EACH ROW EXECUTE FUNCTION public.notif_partners_admin_review_sms();


CREATE OR REPLACE FUNCTION public.notif_event_status_admin_review_sms()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.channel <> 'CREATION' AND NEW.old_status::text = 'BROUILLON' AND NEW.new_status::text = 'EN_ATTENTE'
       AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = NEW.event_id) THEN
        PERFORM public.notif_admin_review_sms(jsonb_build_object('kind', 'EVENT_SUBMITTED', 'ref', NEW.id::text));
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notif_event_status_admin_review_sms() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_event_status_admin_review_sms ON public.event_status_history;
CREATE TRIGGER trg_event_status_admin_review_sms
    AFTER INSERT ON public.event_status_history
    FOR EACH ROW EXECUTE FUNCTION public.notif_event_status_admin_review_sms();
