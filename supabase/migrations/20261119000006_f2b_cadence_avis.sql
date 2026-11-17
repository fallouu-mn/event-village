-- Finition 2b (D, E-28) — cadence des avis de lieu ET de date. Règle (consigne) : au plus un SMS par détenteur et par
-- événement par heure glissante, changements regroupés ; à moins d'une heure du début, l'avis part tout de suite, au plus
-- 2 SMS par détenteur dans cette dernière heure. Avant : seuls les avis de lieu suivaient la cadence d'une heure
-- (correctifs de la contre-vérification de la finition 2a, T4) ; un avis de date partait 10 minutes après chaque
-- modification, et rien ne bornait les SMS de la dernière heure.
--  1. event_place_notices : les champs de date peuvent être retenus (contrainte des champs élargie) ;
--  2. event_notice_recipient_count : nombre de destinataires d'un avis par SMS (porteurs et numéros sans compte), pour un
--     avis retenu (la fenêtre « Prévenir » et le bilan disent combien seront prévenus) ;
--  3. event_change_notify (recopie de 20261116000006_f2acv_avis_de_lieu.sql) : `last_hour_from` : deux SMS déjà partis
--     ou en attente depuis cet instant → aucun troisième (trace SKIPPED LAST_HOUR_CAP pour un porteur) ;
--  4. event_update (recopie de 20261116000006) : la retenue d'une heure couvre lieu et date ; jamais à moins d'une heure du
--     début ; rend l'heure réelle de l'avis par SMS (sms_notice_at, sms_notice_immediate, sms_notice_held) et le nombre
--     de SMS (sms_recipients) ; texte « type d'événement » (E-66) ;
--  5. event_place_notices_release (recopie de 20261116000006) : un avis de date retenu part avec les valeurs actuelles ;
--     plafond de la dernière heure ;
--  6. notif_place_notice_sent (recopie de 20261116000006) : tout SMS de lieu ou de date pose l'heure du dernier avis.
-- Sans BEGIN ni COMMIT, rejouable : DROP CONSTRAINT IF EXISTS puis ADD, CREATE OR REPLACE ; aucune donnée écrite.

-- 1. Champs de date retenus
ALTER TABLE public.event_place_notices DROP CONSTRAINT IF EXISTS event_place_notices_fields_chk;
ALTER TABLE public.event_place_notices ADD CONSTRAINT event_place_notices_fields_chk
    CHECK (held_fields <@ ARRAY['location', 'city', 'address', 'position', 'start_date', 'start_time', 'end_date', 'end_time']::text[]);
COMMENT ON TABLE public.event_place_notices IS
    'Correctifs de la contre-vérification de la finition 2a (T3, T4) et finition 2b (D) : dernière position annoncée aux '
    'détenteurs (posée à la validation, mise à jour au départ de chaque avis de lieu), départ du dernier avis de lieu ou de '
    'date par SMS (cadence : un par heure glissante), champs de lieu et de date retenus par la cadence et heure de leur '
    'départ. Serveur seulement.';

-- 2. Destinataires d'un avis par SMS (mêmes règles que event_change_notify)
CREATE OR REPLACE FUNCTION public.event_notice_recipient_count(p_event uuid, p_multi boolean)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH holders AS (
        SELECT DISTINCT t.user_id
          FROM public.tickets t JOIN public.users u ON u.id = t.user_id
         WHERE t.event_id = p_event AND t.user_id IS NOT NULL AND u.status::text <> 'SUPPRIME'
           AND (t.status::text = 'VALIDE' OR (t.status::text = 'UTILISE' AND p_multi))
    ), phones AS (
        SELECT DISTINCT x.phone
          FROM (SELECT tr.to_phone_or_email AS phone
                  FROM public.ticket_transfers tr
                  JOIN public.tickets t ON t.id = tr.ticket_id
                 WHERE t.event_id = p_event AND tr.status::text = 'PENDING' AND tr.from_user_id IS NULL
                   AND t.user_id IS NULL AND t.status::text = 'VALIDE'
                UNION ALL
                SELECT '+221' || py.payer_phone
                  FROM public.tickets t
                  JOIN public.payments py ON py.id = t.payment_id
                 WHERE t.event_id = p_event AND t.sale_channel::text = 'COUNTER' AND NOT py.is_platform_payment
                   AND py.payer_phone ~ '^7[05678][0-9]{7}$'
                   AND (t.status::text = 'VALIDE' OR (t.status::text = 'UTILISE' AND p_multi))) x
         WHERE x.phone ~ '^\+221[0-9]{9}$'
           AND NOT EXISTS (SELECT 1 FROM public.users u
                            WHERE u.id IN (SELECT h.user_id FROM holders h) AND u.phone IN (x.phone, substr(x.phone, 2)))
    )
    SELECT ((SELECT count(*) FROM holders) + (SELECT count(*) FROM phones))::integer
$$;
REVOKE ALL ON FUNCTION public.event_notice_recipient_count(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_notice_recipient_count(uuid, boolean) TO service_role;

-- 3. event_change_notify
CREATE OR REPLACE FUNCTION public.event_change_notify(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_changed text[] := ARRAY(SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'changed') = 'array' THEN p->'changed' ELSE '[]'::jsonb END));
    v_data jsonb := CASE WHEN jsonb_typeof(p->'data') = 'object' THEN p->'data' ELSE '{}'::jsonb END;
    v_drop text[] := ARRAY(SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'drop') = 'array' THEN p->'drop' ELSE '[]'::jsonb END));
    v_urgent boolean := COALESCE((p->>'urgent')::boolean, FALSE);
    v_due timestamptz := COALESCE(NULLIF(p->>'due', '')::timestamptz, now());
    v_suffix text := COALESCE(NULLIF(btrim(p->>'key_suffix'), ''), 'v0');
    v_multi boolean := COALESCE((p->>'multi_day')::boolean, FALSE);
    -- Finition 2b (D) : à moins d'une heure du début, au plus 2 SMS par détenteur depuis cet instant (début moins une heure)
    v_cap_from timestamptz := NULLIF(p->>'last_hour_from', '')::timestamptz;
    v_sms boolean;
    v_place boolean;
    v_holders uuid[];
    v_notified integer := 0;
    v_phones integer := 0;
    v_sms_queued integer := 0;
    v_holder uuid;
    v_nkey text;
    v_hdata jsonb;
    v_pending_id uuid;
    v_pending_data jsonb;
    v_ch text;
    n record;
BEGIN
    IF v_event IS NULL OR cardinality(v_changed) = 0 THEN
        RETURN jsonb_build_object('ok', true, 'notified_holders', 0, 'notified_phones', 0, 'sms_queued', 0);
    END IF;
    v_sms := EXISTS (SELECT 1 FROM unnest(v_changed) AS f WHERE f <> 'title');
    -- Correctifs de la contre-vérification (T4) : avis qui touche au lieu (nom, ville, adresse, repère)
    v_place := v_changed && ARRAY['location', 'city', 'address', 'position']::text[];

    -- Porteurs prévenus : billets VALIDE (et UTILISE pour un événement de plusieurs jours), comptes non supprimés
    SELECT array_agg(DISTINCT t.user_id) INTO v_holders
      FROM public.tickets t JOIN public.users u ON u.id = t.user_id
     WHERE t.event_id = v_event AND t.user_id IS NOT NULL AND u.status::text <> 'SUPPRIME'
       AND (t.status::text = 'VALIDE' OR (t.status::text = 'UTILISE' AND v_multi));
    v_notified := COALESCE(cardinality(v_holders), 0);
    IF v_notified > 0 THEN
        FOREACH v_holder IN ARRAY v_holders LOOP
            v_nkey := 'EVENT_CHANGED:' || v_event::text || ':' || v_holder::text || ':' || v_suffix;
            -- Lot 9 bis (R32, B23) : report qui ouvre le remboursement d'un billet du porteur (règle de M06, lue après
            -- l'écriture du nouveau début et de event_start_changes) → variante « report » du modèle
            v_hdata := v_data || CASE WHEN EXISTS (SELECT 1 FROM public.tickets t
                                                    WHERE t.event_id = v_event AND t.user_id = v_holder
                                                      AND public.ticket_postponement_refund_open(t.id))
                                      THEN jsonb_build_object('refund_open', true) ELSE '{}'::jsonb END;
            IF v_place THEN
                -- Correctifs de la contre-vérification (T4) : avis de lieu regroupé dans l'application et en push comme par
                -- SMS (même échéance, annulé si le repère revient, retenu par la cadence d'une heure), au lieu de partir tout
                -- de suite à chaque modification
                FOREACH v_ch IN ARRAY ARRAY['IN_APP', 'PUSH'] LOOP
                    v_pending_id := NULL;
                    SELECT o.id, o.template_data INTO v_pending_id, v_pending_data
                      FROM public.notification_outbox o
                     WHERE o.event_id = v_event AND o.recipient_user_id = v_holder
                       AND o.type = 'EVENT_CHANGED' AND o.channel = v_ch AND o.status = 'PENDING'
                       AND o.template_data->>'place_notice' = 'true'
                     ORDER BY o.created_at, o.id
                     LIMIT 1
                       FOR UPDATE;
                    IF v_pending_id IS NOT NULL THEN
                        UPDATE public.notification_outbox
                           SET template_data = (v_pending_data - v_drop - 'refund_open') || v_hdata
                                               || jsonb_build_object('place_notice', true, 'changed_fields', (
                                   SELECT COALESCE(jsonb_agg(f ORDER BY f), '[]'::jsonb)
                                     FROM (SELECT jsonb_array_elements_text(COALESCE(v_pending_data->'changed_fields', '[]'::jsonb)) AS f
                                           UNION
                                           SELECT unnest(v_changed)) x)),
                               due_at = CASE WHEN v_urgent THEN LEAST(due_at, v_due) ELSE due_at END,
                               next_attempt_at = CASE WHEN v_urgent THEN LEAST(next_attempt_at, v_due) ELSE next_attempt_at END
                         WHERE id = v_pending_id;
                    ELSE
                        PERFORM public.notif_enqueue(jsonb_build_object(
                            'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                            'data', v_hdata || jsonb_build_object('place_notice', true), 'channels', jsonb_build_array(v_ch),
                            'due_at', v_due));
                    END IF;
                END LOOP;
            ELSE
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                    'data', v_hdata, 'channels', jsonb_build_array('IN_APP', 'PUSH')));
            END IF;

            -- SMS regroupé : la ligne en attente du porteur pour cet événement reçoit l'union des champs ; lot 9 bis
            -- (R26, B71) : fenêtre fixe de 10 minutes depuis le premier changement, jamais prolongée, ramenée à
            -- maintenant si un début est à moins d'une heure.
            v_pending_id := NULL;
            SELECT o.id, o.template_data INTO v_pending_id, v_pending_data
              FROM public.notification_outbox o
             WHERE o.event_id = v_event AND o.recipient_user_id = v_holder
               AND o.type = 'EVENT_CHANGED' AND o.channel = 'SMS' AND o.status = 'PENDING'
             ORDER BY o.created_at, o.id
             LIMIT 1
               FOR UPDATE;
            IF v_pending_id IS NOT NULL THEN
                UPDATE public.notification_outbox
                   SET template_data = (v_pending_data - v_drop - 'refund_open') || v_hdata || jsonb_build_object('changed_fields', (
                           SELECT COALESCE(jsonb_agg(f ORDER BY f), '[]'::jsonb)
                             FROM (SELECT jsonb_array_elements_text(COALESCE(v_pending_data->'changed_fields', '[]'::jsonb)) AS f
                                   UNION
                                   SELECT unnest(v_changed)) x)),
                       due_at = CASE WHEN v_urgent THEN LEAST(due_at, now()) ELSE due_at END,
                       next_attempt_at = CASE WHEN v_urgent THEN LEAST(next_attempt_at, now()) ELSE next_attempt_at END
                 WHERE id = v_pending_id;
                IF v_sms THEN
                    v_sms_queued := v_sms_queued + 1;
                END IF;
            END IF;
            IF v_sms AND v_pending_id IS NULL AND v_cap_from IS NOT NULL
               AND (SELECT count(*) FROM public.notification_outbox o
                     WHERE o.event_id = v_event AND o.recipient_user_id = v_holder AND o.type = 'EVENT_CHANGED'
                       AND o.channel = 'SMS' AND o.status IN ('PENDING', 'SENDING', 'SENT', 'UNCERTAIN')
                       AND COALESCE(o.sent_at, o.created_at) >= v_cap_from) >= 2 THEN
                -- Finition 2b (D) : deux SMS déjà partis dans la dernière heure : aucun troisième, trace SKIPPED
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                    'data', v_hdata, 'channels', jsonb_build_array('SMS'),
                    'skip', jsonb_build_object('SMS', 'LAST_HOUR_CAP')));
            ELSIF v_sms AND v_pending_id IS NULL THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                    'data', v_hdata, 'channels', jsonb_build_array('SMS'), 'due_at', v_due));
                IF EXISTS (SELECT 1 FROM public.notification_outbox o
                            WHERE o.idempotency_key = v_nkey || ':SMS' AND o.status = 'PENDING') THEN
                    v_sms_queued := v_sms_queued + 1;
                END IF;
            ELSIF NOT v_sms THEN
                -- Titre seul : aucun SMS, trace SKIPPED (le SMS déjà en attente porte le nouveau titre)
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                    'data', v_hdata, 'channels', jsonb_build_array('SMS'),
                    'skip', jsonb_build_object('SMS', 'TITLE_ONLY')));
            END IF;

            -- Lot 9 bis (G.49, B97, B71) : email du changement au compte, dû à 10 minutes et fusionné comme le SMS
            -- (index uq_outbox_event_change_pending_email) ; titre seul : fusion seulement, aucune ligne nouvelle.
            v_pending_id := NULL;
            SELECT o.id, o.template_data INTO v_pending_id, v_pending_data
              FROM public.notification_outbox o
             WHERE o.event_id = v_event AND o.recipient_user_id = v_holder
               AND o.type = 'EVENT_CHANGED' AND o.channel = 'EMAIL' AND o.status = 'PENDING'
             ORDER BY o.created_at, o.id
             LIMIT 1
               FOR UPDATE;
            IF v_pending_id IS NOT NULL THEN
                UPDATE public.notification_outbox
                   SET template_data = (v_pending_data - v_drop - 'refund_open') || v_hdata || jsonb_build_object('changed_fields', (
                           SELECT COALESCE(jsonb_agg(f ORDER BY f), '[]'::jsonb)
                             FROM (SELECT jsonb_array_elements_text(COALESCE(v_pending_data->'changed_fields', '[]'::jsonb)) AS f
                                   UNION
                                   SELECT unnest(v_changed)) x)),
                       due_at = CASE WHEN v_urgent THEN LEAST(due_at, now()) ELSE due_at END,
                       next_attempt_at = CASE WHEN v_urgent THEN LEAST(next_attempt_at, now()) ELSE next_attempt_at END
                 WHERE id = v_pending_id;
            ELSIF v_sms THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                    'data', v_hdata, 'channels', jsonb_build_array('EMAIL'), 'due_at', v_due));
            END IF;
        END LOOP;
    END IF;

    -- Lot 9 bis (R12, B69) : numéros sans compte (invitations non réclamées, acheteurs au guichet), mêmes statuts de
    -- billet que les porteurs ; un SMS par numéro, fusionné par numéro ; numéros des porteurs prévenus retirés.
    IF cardinality(v_changed) > 0 THEN
        FOR n IN
            SELECT x.phone, (array_agg(x.ticket_id ORDER BY x.ticket_id))[1] AS ticket_id
              FROM (SELECT tr.to_phone_or_email AS phone, t.id AS ticket_id
                      FROM public.ticket_transfers tr
                      JOIN public.tickets t ON t.id = tr.ticket_id
                     WHERE t.event_id = v_event AND tr.status::text = 'PENDING' AND tr.from_user_id IS NULL
                       AND t.user_id IS NULL AND t.status::text = 'VALIDE'
                    UNION ALL
                    SELECT '+221' || py.payer_phone, t.id
                      FROM public.tickets t
                      JOIN public.payments py ON py.id = t.payment_id
                     WHERE t.event_id = v_event AND t.sale_channel::text = 'COUNTER' AND NOT py.is_platform_payment
                       AND py.payer_phone ~ '^7[05678][0-9]{7}$'
                       AND (t.status::text = 'VALIDE'
                            OR (t.status::text = 'UTILISE' AND v_multi))) x
             WHERE x.phone ~ '^\+221[0-9]{9}$'
               AND NOT EXISTS (SELECT 1 FROM public.users u
                                WHERE u.id = ANY (COALESCE(v_holders, ARRAY[]::uuid[])) AND u.phone IN (x.phone, substr(x.phone, 2)))
             GROUP BY x.phone
             ORDER BY x.phone
        LOOP
            v_phones := v_phones + 1;
            v_pending_id := NULL;
            SELECT o.id, o.template_data INTO v_pending_id, v_pending_data
              FROM public.notification_outbox o
             WHERE o.event_id = v_event AND o.recipient_phone = n.phone AND o.recipient_user_id IS NULL
               AND o.type = 'EVENT_CHANGED' AND o.channel = 'SMS' AND o.status = 'PENDING'
             ORDER BY o.created_at, o.id
             LIMIT 1
               FOR UPDATE;
            IF v_pending_id IS NOT NULL THEN
                UPDATE public.notification_outbox
                   SET template_data = (v_pending_data - v_drop) || v_data || jsonb_build_object(
                           'recipient_kind', 'PHONE', 'ticket_id', n.ticket_id, 'changed_fields', (
                           SELECT COALESCE(jsonb_agg(f ORDER BY f), '[]'::jsonb)
                             FROM (SELECT jsonb_array_elements_text(COALESCE(v_pending_data->'changed_fields', '[]'::jsonb)) AS f
                                   UNION
                                   SELECT unnest(v_changed)) x)),
                       due_at = CASE WHEN v_urgent THEN LEAST(due_at, now()) ELSE due_at END,
                       next_attempt_at = CASE WHEN v_urgent THEN LEAST(next_attempt_at, now()) ELSE next_attempt_at END
                 WHERE id = v_pending_id;
                IF v_sms THEN
                    v_sms_queued := v_sms_queued + 1;
                END IF;
            ELSIF v_sms AND v_cap_from IS NOT NULL
                  AND (SELECT count(*) FROM public.notification_outbox o
                        WHERE o.event_id = v_event AND o.recipient_phone = n.phone AND o.recipient_user_id IS NULL
                          AND o.type = 'EVENT_CHANGED' AND o.channel = 'SMS' AND o.status IN ('PENDING', 'SENDING', 'SENT', 'UNCERTAIN')
                          AND COALESCE(o.sent_at, o.created_at) >= v_cap_from) >= 2 THEN
                -- Finition 2b (D) : même plafond pour un numéro sans compte (aucune trace : rien n'est écrit pour lui)
                NULL;
            ELSIF v_sms THEN
                v_nkey := 'EVENT_CHANGED:' || v_event::text || ':t' || n.ticket_id::text || ':' || v_suffix;
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'phone', n.phone, 'event_id', v_event,
                    'data', v_data || jsonb_build_object('recipient_kind', 'PHONE', 'ticket_id', n.ticket_id),
                    'channels', jsonb_build_array('SMS'), 'due_at', v_due));
                IF EXISTS (SELECT 1 FROM public.notification_outbox o
                            WHERE o.idempotency_key = v_nkey || ':SMS' AND o.status = 'PENDING') THEN
                    v_sms_queued := v_sms_queued + 1;
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- Lot 9 bis (R33, B72) : contrôleurs affectés (affectations acceptées) prévenus d'un changement de date ou de lieu :
    -- in-app tout de suite ; SMS et email dus dans 10 minutes, fusionnés comme EVENT_CHANGED (ligne en attente du
    -- contrôleur, index uq_outbox_controller_change_pending_sms pour le SMS) ; titre seul : fusion seulement.
    IF cardinality(v_changed) > 0 THEN
        FOR n IN
            SELECT ec.user_id FROM public.event_controllers ec WHERE ec.event_id = v_event ORDER BY ec.user_id
        LOOP
            v_nkey := 'CONTROLLER_EVENT_CHANGED:' || v_event::text || ':' || n.user_id::text || ':' || v_suffix;
            IF v_sms THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'CONTROLLER_EVENT_CHANGED', 'key', v_nkey, 'user_id', n.user_id, 'event_id', v_event,
                    'data', v_data, 'channels', jsonb_build_array('IN_APP')));
            END IF;
            FOREACH v_ch IN ARRAY ARRAY['SMS', 'EMAIL'] LOOP
                v_pending_id := NULL;
                SELECT o.id, o.template_data INTO v_pending_id, v_pending_data
                  FROM public.notification_outbox o
                 WHERE o.event_id = v_event AND o.recipient_user_id = n.user_id
                   AND o.type = 'CONTROLLER_EVENT_CHANGED' AND o.channel = v_ch AND o.status = 'PENDING'
                 ORDER BY o.created_at, o.id
                 LIMIT 1
                   FOR UPDATE;
                IF v_pending_id IS NOT NULL THEN
                    UPDATE public.notification_outbox
                       SET template_data = (v_pending_data - v_drop) || v_data || jsonb_build_object('changed_fields', (
                               SELECT COALESCE(jsonb_agg(f ORDER BY f), '[]'::jsonb)
                                 FROM (SELECT jsonb_array_elements_text(COALESCE(v_pending_data->'changed_fields', '[]'::jsonb)) AS f
                                       UNION
                                       SELECT unnest(v_changed)) x)),
                           due_at = CASE WHEN v_urgent THEN LEAST(due_at, now()) ELSE due_at END,
                           next_attempt_at = CASE WHEN v_urgent THEN LEAST(next_attempt_at, now()) ELSE next_attempt_at END
                     WHERE id = v_pending_id;
                ELSIF v_sms THEN
                    PERFORM public.notif_enqueue(jsonb_build_object(
                        'type', 'CONTROLLER_EVENT_CHANGED', 'key', v_nkey, 'user_id', n.user_id, 'event_id', v_event,
                        'data', v_data, 'channels', jsonb_build_array(v_ch), 'due_at', v_due));
                END IF;
            END LOOP;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('ok', true, 'notified_holders', v_notified, 'notified_phones', v_phones, 'sms_queued', v_sms_queued);
END;
$$;


-- 4. event_update
CREATE OR REPLACE FUNCTION public.event_update(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_patch jsonb := p->'patch';
    v_expected timestamptz;
    e public.events%ROWTYPE;
    a record;
    v_key text;
    v_forbidden text[] := ARRAY['status', 'services', 'gallery_urls', 'ticket_categories', 'slug', 'partner_id', 'is_featured',
                                'featured_until', 'id', 'created_at', 'updated_at'];
    v_allowed text[] := ARRAY['title', 'category', 'description', 'start_date', 'start_time', 'end_date', 'end_time', 'location',
                              'city', 'latitude', 'longitude', 'image_url', 'capacity', 'program', 'practical_info'];
    n_title text;
    n_category event_category;
    n_description text;
    n_start_date date;
    n_start_time time;
    n_end_date date;
    n_end_time time;
    n_location text;
    n_city text;
    n_lat double precision;
    n_lng double precision;
    n_image text;
    n_capacity integer;
    n_program jsonb;
    n_practical jsonb;
    v_post boolean;
    v_has_sales boolean;
    v_start_changed boolean;
    v_dates_changed boolean;
    v_new_start timestamptz;
    v_old_start timestamptz;
    v_old_end timestamptz;
    v_new_end timestamptz;
    v_engaged integer;
    v_quota integer;
    v_late jsonb;
    v_late_names text;
    v_changed text[] := ARRAY[]::text[];
    v_labels text[] := ARRAY[]::text[];
    v_sms boolean := false;
    v_holders uuid[];
    v_notified integer := 0;
    v_phones integer := 0;
    v_sms_queued integer := 0;
    v_version integer;
    v_row jsonb;
    v_holder uuid;
    v_nkey text;
    v_data jsonb;
    v_hdata jsonb;
    v_drop text[] := ARRAY['migrated_from'];
    v_pending_id uuid;
    v_pending_data jsonb;
    v_urgent boolean := false;
    v_due timestamptz;
    v_ch text;
    n record;
    v_refusal jsonb;
    -- Correctifs de la contre-vérification (T3, T4) : avis de lieu
    v_ann_lat double precision;
    v_ann_lng double precision;
    v_last_sent timestamptz;
    v_held_before text[];
    v_moved boolean := false;
    v_place text[];
    v_held text[] := ARRAY[]::text[];
    v_pending_place boolean;
    v_notify jsonb;
    v_place_at timestamptz;
    -- Finition 2b (D) : cadence des avis de lieu et de date ; heure réelle et nombre de SMS de l'avis
    v_hold_until timestamptz;
    v_notice_at timestamptz;
    v_notice_held boolean := false;
    v_notice_recipients integer := 0;
BEGIN
    -- Finition 2a (1a) : fiche SUSPENDU, événements en lecture seule pour la partenaire (l'admin events.write garde ses actions)
    IF public.partner_owner_suspended(public.try_uuid(p->>'event_id'), public.try_uuid(p->>'actor_id')) THEN
        RETURN public.event_edit_refusal('PARTNER_SUSPENDED', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');
    END IF;
    IF v_event IS NULL THEN
        RETURN public.event_edit_refusal('EVENT_NOT_FOUND', 'Événement introuvable.');
    END IF;
    IF v_patch IS NULL OR jsonb_typeof(v_patch) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les modifications de l''événement sont illisibles.');
    END IF;
    BEGIN
        v_expected := (p->>'expected_updated_at')::timestamptz;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
        v_expected := NULL;
    END;
    IF v_expected IS NULL THEN
        RETURN public.event_edit_refusal('EXPECTED_VERSION_REQUIRED', 'Version de l''événement manquante : rechargez la page puis recommencez.');
    END IF;

    SELECT * INTO e FROM public.events WHERE id = v_event FOR NO KEY UPDATE;
    IF NOT FOUND THEN
        RETURN public.event_edit_refusal('EVENT_NOT_FOUND', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT a.is_owner THEN
        IF a.is_staff THEN
            RETURN public.event_edit_refusal('ADMIN_CANNOT_EDIT', 'Seul l''organisateur modifie son événement ; l''administration agit par les changements de statut.');
        END IF;
        RETURN public.event_edit_refusal('EVENT_NOT_FOUND', 'Événement introuvable.');
    END IF;
    IF NOT a.is_active THEN
        RETURN public.event_edit_refusal('ACCOUNT_NOT_ACTIVE', 'Votre compte n''est pas actif.');
    END IF;

    SELECT k INTO v_key FROM jsonb_object_keys(v_patch) AS k
     WHERE k = ANY (v_forbidden) OR k <> ALL (v_allowed)
     ORDER BY k LIMIT 1;
    IF v_key IS NOT NULL THEN
        RETURN public.event_edit_refusal('FIELD_NOT_EDITABLE', 'Ce champ ne se modifie pas depuis le formulaire de l''événement.', v_key);
    END IF;

    IF e.status::text = 'EN_ATTENTE' THEN
        RETURN public.event_edit_refusal('WITHDRAW_TO_EDIT', 'L''événement est en cours de validation : retirez-le de la validation pour le modifier.');
    END IF;
    IF e.status::text IN ('TERMINE', 'ANNULE') THEN
        RETURN public.event_edit_refusal('EVENT_LOCKED', 'Un événement terminé ou annulé ne peut plus être modifié.');
    END IF;
    IF e.updated_at IS DISTINCT FROM v_expected THEN
        RETURN public.event_edit_refusal('EDIT_CONFLICT', 'L''événement a été modifié entre-temps : rechargez la page pour voir la dernière version.');
    END IF;
    v_post := e.status::text IN ('VALIDE', 'PUBLIE', 'SUSPENDU');
    -- Correctifs de la contre-vérification (T3, T4) : position annoncée, départ du dernier avis de lieu et retenue de
    -- l'événement, verrouillés jusqu'à la fin de la modification (l'envoyeur les met à jour au départ d'un avis)
    IF v_post THEN
        INSERT INTO public.event_place_notices (event_id) VALUES (v_event) ON CONFLICT (event_id) DO NOTHING;
        SELECT pn.announced_latitude, pn.announced_longitude, pn.last_sent_at, pn.held_fields
          INTO v_ann_lat, v_ann_lng, v_last_sent, v_held_before
          FROM public.event_place_notices pn
         WHERE pn.event_id = v_event
           FOR UPDATE;
        -- Aucune position annoncée (événement validé sans repère) : le repère actuel en tient lieu
        IF v_ann_lat IS NULL OR v_ann_lng IS NULL THEN
            v_ann_lat := e.latitude;
            v_ann_lng := e.longitude;
        END IF;
    END IF;

    -- Nouvelles valeurs (colonnes absentes du patch : inchangées)
    n_title := e.title; n_category := e.category; n_description := e.description;
    n_start_date := e.start_date; n_start_time := e.start_time; n_end_date := e.end_date; n_end_time := e.end_time;
    n_location := e.location; n_city := e.city; n_lat := e.latitude; n_lng := e.longitude; n_image := e.image_url;
    n_capacity := e.capacity; n_program := e.program; n_practical := e.practical_info;
    BEGIN
        IF v_patch ? 'title' THEN n_title := btrim(v_patch->>'title'); END IF;
        v_key := 'category';
        IF v_patch ? 'category' THEN n_category := (v_patch->>'category')::event_category; END IF;
        v_key := NULL;
        IF v_patch ? 'description' THEN n_description := NULLIF(btrim(COALESCE(v_patch->>'description', '')), ''); END IF;
        IF v_patch ? 'start_date' THEN n_start_date := (v_patch->>'start_date')::date; END IF;
        IF v_patch ? 'start_time' THEN n_start_time := (v_patch->>'start_time')::time; END IF;
        IF v_patch ? 'end_date' THEN n_end_date := NULLIF(v_patch->>'end_date', '')::date; END IF;
        IF v_patch ? 'end_time' THEN n_end_time := NULLIF(v_patch->>'end_time', '')::time; END IF;
        IF v_patch ? 'location' THEN n_location := btrim(v_patch->>'location'); END IF;
        IF v_patch ? 'city' THEN n_city := btrim(v_patch->>'city'); END IF;
        IF v_patch ? 'latitude' THEN n_lat := (v_patch->>'latitude')::double precision; END IF;
        IF v_patch ? 'longitude' THEN n_lng := (v_patch->>'longitude')::double precision; END IF;
        IF v_patch ? 'image_url' THEN n_image := NULLIF(btrim(COALESCE(v_patch->>'image_url', '')), ''); END IF;
        IF v_patch ? 'capacity' THEN n_capacity := (v_patch->>'capacity')::integer; END IF;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
        IF v_key = 'category' THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez un type d''événement dans la liste.', 'category');
        END IF;
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Une valeur modifiée est illisible.');
    END;
    IF v_patch ? 'program' THEN
        n_program := CASE jsonb_typeof(v_patch->'program') WHEN 'array' THEN v_patch->'program' WHEN 'null' THEN '[]'::jsonb END;
        IF n_program IS NULL OR jsonb_array_length(n_program) > 50 THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Le programme compte 50 lignes au plus.', 'program');
        END IF;
    END IF;
    IF v_patch ? 'practical_info' THEN
        n_practical := CASE jsonb_typeof(v_patch->'practical_info') WHEN 'object' THEN v_patch->'practical_info' WHEN 'null' THEN '{}'::jsonb END;
        IF n_practical IS NULL THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Les informations pratiques sont illisibles.', 'practical_info');
        END IF;
    END IF;
    -- Heure renvoyée par le formulaire en HH:mm : identique à la minute près = inchangée (R29)
    IF n_start_time IS NOT NULL AND e.start_time IS NOT NULL AND to_char(n_start_time, 'HH24:MI') = to_char(e.start_time, 'HH24:MI') THEN
        n_start_time := e.start_time;
    END IF;
    IF n_end_time IS NOT NULL AND e.end_time IS NOT NULL AND to_char(n_end_time, 'HH24:MI') = to_char(e.end_time, 'HH24:MI') THEN
        n_end_time := e.end_time;
    END IF;

    -- Défense : bornes de F1 (déjà contrôlées par le schéma partagé), sur les seuls champs envoyés
    IF v_patch ? 'title' AND (n_title IS NULL OR char_length(n_title) < 3 OR char_length(n_title) > 120) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le titre compte de 3 à 120 caractères.', 'title');
    END IF;
    IF v_patch ? 'category' AND n_category IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez un type d''événement dans la liste.', 'category');
    END IF;
    IF v_patch ? 'description' AND n_description IS NOT NULL AND char_length(n_description) > 5000 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La description ne dépasse pas 5 000 caractères.', 'description');
    END IF;
    IF v_patch ? 'location' AND (n_location IS NULL OR char_length(n_location) < 2 OR char_length(n_location) > 200) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le lieu compte de 2 à 200 caractères.', 'location');
    END IF;
    IF v_patch ? 'city' AND (n_city IS NULL OR char_length(n_city) < 2 OR char_length(n_city) > 80) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La ville compte de 2 à 80 caractères.', 'city');
    END IF;
    IF n_start_date IS NULL OR n_start_time IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La date et l''heure de début sont obligatoires.', 'start_date');
    END IF;
    -- Finition 2a (3) : position du lieu. Latitude et longitude voyagent ensemble, au Sénégal ; une fois l'événement
    -- validé, le repère se déplace mais ne se retire plus. Un événement ancien sans position reste modifiable tant que la
    -- modification ne touche pas la position.
    IF (v_patch ? 'latitude') <> (v_patch ? 'longitude') THEN
        RETURN public.event_edit_refusal('POSITION_INCOMPLETE', 'La position du lieu est incomplète : touchez la carte pour placer le repère.',
                                         CASE WHEN v_patch ? 'latitude' THEN 'longitude' ELSE 'latitude' END);
    END IF;
    IF v_patch ? 'latitude' THEN
        v_refusal := public.event_position_refusal(n_lat, n_lng);
        IF v_refusal IS NOT NULL THEN
            RETURN v_refusal;
        END IF;
        IF v_post AND n_lat IS NULL AND e.latitude IS NOT NULL THEN
            RETURN public.event_edit_refusal('POSITION_REQUIRED', 'Le repère du lieu ne peut plus être retiré après la validation : déplacez-le si le lieu change.', 'latitude');
        END IF;
    END IF;
    IF n_capacity IS NOT NULL AND (n_capacity < 1 OR n_capacity > 100000) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La jauge est un nombre entier de 1 à 100 000.', 'capacity');
    END IF;
    IF n_image IS DISTINCT FROM e.image_url AND NOT public.event_poster_path_ok(n_image, e.partner_id) THEN
        RETURN public.event_edit_refusal('IMAGE_ORIGIN_INVALID', 'L''affiche doit être déposée depuis le formulaire de l''événement.', 'image_url');
    END IF;

    -- Dates (Africa/Dakar) : début dans le futur s'il change, fin après le début
    v_start_changed := n_start_date IS DISTINCT FROM e.start_date OR n_start_time IS DISTINCT FROM e.start_time;
    v_dates_changed := v_start_changed OR n_end_date IS DISTINCT FROM e.end_date OR n_end_time IS DISTINCT FROM e.end_time;
    IF n_end_time IS NOT NULL AND n_end_date IS NULL THEN
        RETURN public.event_edit_refusal('END_DATE_REQUIRED', 'Indiquez la date de fin pour l''heure de fin saisie.', 'end_date');
    END IF;
    v_new_start := (n_start_date + n_start_time) AT TIME ZONE 'Africa/Dakar';
    v_old_start := (e.start_date + e.start_time) AT TIME ZONE 'Africa/Dakar';
    IF v_start_changed AND v_new_start <= now() THEN
        RETURN public.event_edit_refusal('EVENT_START_PAST', 'Le nouveau début de l''événement doit être dans le futur (heure de Dakar).', 'start_date');
    END IF;
    -- Lot 9 bis (R16, B47, X7) : fin par event_end_from_v2 (M08), même règle que event_end_at (sans fin : début + 6 h)
    v_old_end := public.event_end_from_v2(e.start_date, e.start_time, e.end_date, e.end_time);
    v_new_end := public.event_end_from_v2(n_start_date, n_start_time, n_end_date, n_end_time);
    IF v_dates_changed AND n_end_date IS NOT NULL AND v_new_end <= v_new_start THEN
        RETURN public.event_edit_refusal('EVENT_END_BEFORE_START', 'La fin de l''événement doit être postérieure à son début.',
                                         CASE WHEN n_end_time IS NOT NULL THEN 'end_time' ELSE 'end_date' END);
    END IF;

    PERFORM 1 FROM public.ticket_categories WHERE event_id = v_event ORDER BY id FOR UPDATE;
    v_has_sales := public.event_has_sales(v_event);

    -- Verrouillés dès qu'il y a des ventes : catégorie d'événement, jauge supprimée ou sous vendus + réservés
    IF v_has_sales AND n_category IS DISTINCT FROM e.category THEN
        RETURN public.event_edit_refusal('LOCKED_AFTER_SALES', 'La catégorie de l''événement ne change plus : des billets ont été vendus ou réservés.', 'category');
    END IF;
    IF n_capacity IS DISTINCT FROM e.capacity THEN
        SELECT COALESCE(sum(c.sold_quantity + c.held_quantity), 0)::int,
               COALESCE(sum(c.total_quantity) FILTER (WHERE c.is_active), 0)::int
          INTO v_engaged, v_quota
          FROM public.ticket_categories c WHERE c.event_id = v_event;
        IF v_has_sales AND n_capacity IS NULL THEN
            RETURN public.event_edit_refusal('LOCKED_AFTER_SALES', 'La jauge ne peut plus être supprimée : des billets ont été vendus ou réservés.', 'capacity');
        END IF;
        IF v_has_sales AND n_capacity < v_engaged THEN
            RETURN public.event_edit_refusal('LOCKED_AFTER_SALES',
                format('La jauge ne peut pas descendre sous %s : billets vendus et paiements en cours compris.', v_engaged), 'capacity');
        END IF;
        IF n_capacity IS NOT NULL AND n_capacity < v_quota THEN
            RETURN public.event_edit_refusal('CAPACITY_BELOW_QUOTAS',
                format('La jauge ne peut pas descendre sous la somme des quotas des catégories actives (%s) : baissez d''abord les quotas.', v_quota), 'capacity');
        END IF;
    END IF;

    -- Une fin de vente ne dépasse jamais la fin de l'événement
    IF v_dates_changed THEN
        SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'sale_end', c.sale_end) ORDER BY c.name, c.id),
               string_agg(format('« %s »', c.name), ', ' ORDER BY c.name, c.id)
          INTO v_late, v_late_names
          FROM public.ticket_categories c
         WHERE c.event_id = v_event AND c.sale_end IS NOT NULL AND c.sale_end > v_new_end;
        IF v_late IS NOT NULL THEN
            RETURN public.event_edit_refusal('SALE_END_AFTER_EVENT',
                format('La fin de vente de %s dépasse la nouvelle fin de l''événement : avancez d''abord la fin de vente.', v_late_names),
                CASE WHEN v_patch ? 'end_time' THEN 'end_time' WHEN v_patch ? 'end_date' THEN 'end_date' ELSE 'start_date' END,
                jsonb_build_object('categories', v_late));
        END IF;
        -- Lot 9 bis (R94, B61) : un début de vente précède toujours la fin de l'événement
        SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'sale_start', c.sale_start) ORDER BY c.name, c.id)
          INTO v_late
          FROM public.ticket_categories c
         WHERE c.event_id = v_event AND c.sale_start IS NOT NULL AND c.sale_start >= v_new_end;
        IF v_late IS NOT NULL THEN
            RETURN public.event_edit_refusal('SALE_START_AFTER_EVENT', 'Le début de vente doit précéder la fin de l’événement.',
                CASE WHEN v_patch ? 'end_time' THEN 'end_time' WHEN v_patch ? 'end_date' THEN 'end_date' ELSE 'start_date' END,
                jsonb_build_object('categories', v_late));
        END IF;
    END IF;

    -- Champs notifiés (après publication) : titre, dates et heures, lieu, ville, adresse
    IF v_post THEN
        IF n_title IS DISTINCT FROM e.title THEN
            v_changed := array_append(v_changed, 'title'); v_labels := array_append(v_labels, 'le titre');
        END IF;
        IF n_start_date IS DISTINCT FROM e.start_date OR n_end_date IS DISTINCT FROM e.end_date THEN
            IF n_start_date IS DISTINCT FROM e.start_date THEN v_changed := array_append(v_changed, 'start_date'); END IF;
            IF n_end_date IS DISTINCT FROM e.end_date THEN v_changed := array_append(v_changed, 'end_date'); END IF;
            v_labels := array_append(v_labels, 'la date');
        END IF;
        IF n_start_time IS DISTINCT FROM e.start_time OR n_end_time IS DISTINCT FROM e.end_time THEN
            IF n_start_time IS DISTINCT FROM e.start_time THEN v_changed := array_append(v_changed, 'start_time'); END IF;
            IF n_end_time IS DISTINCT FROM e.end_time THEN v_changed := array_append(v_changed, 'end_time'); END IF;
            v_labels := array_append(v_labels, 'l''horaire');
        END IF;
        IF n_location IS DISTINCT FROM e.location OR n_city IS DISTINCT FROM e.city
           OR NULLIF(btrim(COALESCE(n_practical->>'address', '')), '') IS DISTINCT FROM NULLIF(btrim(COALESCE(e.practical_info->>'address', '')), '') THEN
            IF n_location IS DISTINCT FROM e.location THEN v_changed := array_append(v_changed, 'location'); END IF;
            IF n_city IS DISTINCT FROM e.city THEN v_changed := array_append(v_changed, 'city'); END IF;
            IF NULLIF(btrim(COALESCE(n_practical->>'address', '')), '') IS DISTINCT FROM NULLIF(btrim(COALESCE(e.practical_info->>'address', '')), '') THEN
                v_changed := array_append(v_changed, 'address');
            END IF;
            v_labels := array_append(v_labels, 'le lieu');
        END IF;
        -- Finition 2a (3), correctifs de la contre-vérification (T3) : repère à plus de 200 m de la DERNIÈRE POSITION
        -- ANNONCÉE (et non du repère précédent : des petits pas ne contournent plus l'avis) = changement de lieu (mêmes
        -- avis aux détenteurs, mêmes règles d'envoi) ; en deçà, personne n'est prévenu
        v_moved := n_lat IS DISTINCT FROM e.latitude OR n_lng IS DISTINCT FROM e.longitude;
        IF v_moved AND v_ann_lat IS NOT NULL AND v_ann_lng IS NOT NULL AND n_lat IS NOT NULL AND n_lng IS NOT NULL
           AND public.geo_distance_m(v_ann_lat, v_ann_lng, n_lat, n_lng) > 200 THEN
            v_changed := array_append(v_changed, 'position');
            IF NOT ('le lieu' = ANY (v_labels)) THEN
                v_labels := array_append(v_labels, 'le lieu');
            END IF;
        END IF;
        -- Correctifs de la contre-vérification (T4) : repère revenu à moins de 200 m de la position annoncée → l'avis de
        -- lieu encore en attente (et la retenue) perd « position » ; une ligne qui n'a plus rien à dire est annulée
        IF v_moved AND v_ann_lat IS NOT NULL AND v_ann_lng IS NOT NULL AND n_lat IS NOT NULL AND n_lng IS NOT NULL
           AND public.geo_distance_m(v_ann_lat, v_ann_lng, n_lat, n_lng) <= 200 THEN
            PERFORM public.event_place_notice_revert(v_event);
            v_held_before := array_remove(v_held_before, 'position');
        END IF;
        -- Finition 2b (D, E-28) : cadence des avis par SMS de lieu ET de date : au plus un par détenteur et par événement par
        -- heure glissante (départ du dernier avis : event_place_notices.last_sent_at, posé par tout SMS EVENT_CHANGED de
        -- lieu ou de date). Un avis parti il y a moins d'une heure et aucun SMS en attente : les champs de lieu et de date
        -- sont retenus et partent ensemble à l'heure dite (event_place_notices_release, appelée par l'envoyeur) ; le titre
        -- part comme avant. À moins d'une heure du début (ancien ou nouveau) : jamais retenu, l'avis part tout de suite
        -- (event_change_notify plafonne alors à 2 SMS par détenteur depuis le début moins une heure). Une retenue dont
        -- l'heure est passée (pas encore libérée) est jointe à cet avis.
        v_urgent := v_old_start < now() + interval '1 hour' OR v_new_start < now() + interval '1 hour';
        v_place := ARRAY(SELECT f FROM unnest(v_changed) AS f
                          WHERE f IN ('location', 'city', 'address', 'position', 'start_date', 'start_time', 'end_date', 'end_time'));
        IF cardinality(v_place) > 0 THEN
            v_pending_place := EXISTS (SELECT 1 FROM public.notification_outbox o
                                        WHERE o.event_id = v_event AND o.type = 'EVENT_CHANGED' AND o.channel = 'SMS' AND o.status = 'PENDING');
            IF NOT v_urgent AND NOT v_pending_place AND v_last_sent IS NOT NULL AND v_last_sent > now() - interval '1 hour' THEN
                v_held := v_place;
                v_hold_until := v_last_sent + interval '1 hour';
                IF v_place && ARRAY['location', 'city', 'address', 'position']::text[] THEN
                    v_place_at := v_hold_until;
                END IF;
                v_changed := ARRAY(SELECT f FROM unnest(v_changed) AS f WHERE NOT f = ANY (v_place));
                UPDATE public.event_place_notices
                   SET held_fields = ARRAY(SELECT DISTINCT f FROM unnest(held_fields || v_place) AS f ORDER BY f),
                       held_until = v_hold_until, updated_at = now()
                 WHERE event_id = v_event;
            ELSIF cardinality(COALESCE(v_held_before, ARRAY[]::text[])) > 0 THEN
                -- Retenue encore là (heure passée, pas encore libérée, ou début à moins d'une heure) : jointe à cet avis
                v_changed := v_changed || ARRAY(SELECT f FROM unnest(v_held_before) AS f WHERE NOT f = ANY (v_changed));
                UPDATE public.event_place_notices SET held_fields = '{}'::text[], held_until = NULL, updated_at = now()
                 WHERE event_id = v_event;
            END IF;
        END IF;
        v_sms := EXISTS (SELECT 1 FROM unnest(v_changed) AS f WHERE f <> 'title');
    END IF;
    v_version := e.notify_version + CASE WHEN cardinality(v_changed) > 0 THEN 1 ELSE 0 END;

    UPDATE public.events
       SET title = n_title, category = n_category, description = n_description,
           start_date = n_start_date, start_time = n_start_time, end_date = n_end_date, end_time = n_end_time,
           location = n_location, city = n_city, latitude = n_lat, longitude = n_lng, image_url = n_image,
           capacity = n_capacity, program = n_program, practical_info = n_practical, notify_version = v_version,
           updated_at = now()
     WHERE id = v_event;

    -- Lot 9 bis (R32, B23) : changement de début journalisé ; le droit au remboursement d'un report se mesure depuis
    -- le début en vigueur à l'achat (ticket_postponement_refund_open, M06). Ordre : events NKU → catégories →
    -- event_start_changes (clé étrangère vers l'événement déjà tenu) → boîte d'envoi.
    IF v_start_changed THEN
        INSERT INTO public.event_start_changes (event_id, old_start_at, new_start_at, actor_id)
        VALUES (v_event, v_old_start, v_new_start, v_actor);
    END IF;

    -- Fonds : une fin qui recule repousse la disponibilité des crédits VENTE pas encore disponibles ; jamais d'avancement
    IF v_new_end > v_old_end THEN
        UPDATE public.finance_ledger l
           SET available_at = GREATEST(l.available_at, public.fin_payout_available_at(l.payment_id))
         WHERE l.entry_type = 'VENTE' AND l.available_at > now()
           AND l.payment_id IN (SELECT py.id FROM public.payments py WHERE py.event_id = v_event);
    END IF;

    -- Porteurs, numéros sans compte et contrôleurs prévenus : event_change_notify (correctifs de la contre-vérification,
    -- T3 et T4 : bloc déplacé de cette fonction, inchangé hormis l'avis de lieu regroupé dans l'application et en push)
    IF cardinality(v_changed) > 0 THEN
        -- Données du modèle EVENT_CHANGED (valeurs d'après la modification, nouvelles valeurs des champs changés)
        v_data := jsonb_strip_nulls(jsonb_build_object(
            'event_id', v_event, 'title', n_title, 'start_at', v_new_start, 'location', n_location, 'city', n_city,
            'changed_fields', to_jsonb(v_changed),
            'new_start_at', CASE WHEN v_start_changed THEN v_new_start END,
            'new_end_at', CASE WHEN 'end_date' = ANY (v_changed) OR 'end_time' = ANY (v_changed) THEN v_new_end END,
            'new_location', CASE WHEN 'location' = ANY (v_changed) THEN n_location END,
            'new_address', CASE WHEN 'address' = ANY (v_changed) THEN NULLIF(btrim(COALESCE(n_practical->>'address', '')), '') END,
            'new_city', CASE WHEN 'city' = ANY (v_changed) THEN n_city END,
            'old_title', CASE WHEN 'title' = ANY (v_changed) THEN e.title END,
            -- Lot 9 bis (R80) : adresse retirée (variante « adresse retirée, lieu … » du SMS)
            'address_cleared', CASE WHEN 'address' = ANY (v_changed)
                                         AND NULLIF(btrim(COALESCE(n_practical->>'address', '')), '') IS NULL THEN true END,
            -- T3 : repère de cet avis ; il devient la position annoncée au départ du SMS
            'new_position', CASE WHEN 'position' = ANY (v_changed) THEN jsonb_build_object('latitude', n_lat, 'longitude', n_lng) END));
        -- Lot 9 bis (R80) : à la fusion, une adresse changée de nouveau remplace l'ancienne (posée ou retirée)
        v_drop := ARRAY['migrated_from']
                  || CASE WHEN 'address' = ANY (v_changed) THEN ARRAY['new_address', 'address_cleared'] ELSE ARRAY[]::text[] END;
        -- Lot 9 bis (B71) : SMS dû dans 10 minutes, tout de suite si l'ancien ou le nouveau début est à moins d'une heure
        v_urgent := v_old_start < now() + interval '1 hour' OR v_new_start < now() + interval '1 hour';
        v_due := CASE WHEN v_urgent THEN now() ELSE now() + interval '10 minutes' END;
        -- T4 : avis qui touche au lieu, regroupé : il part (application, push, SMS) à l'échéance de la fenêtre
        IF v_changed && ARRAY['location', 'city', 'address', 'position']::text[] THEN
            v_place_at := v_due;
        END IF;
        v_notify := public.event_change_notify(jsonb_build_object(
            'event_id', v_event, 'changed', to_jsonb(v_changed), 'data', v_data, 'drop', to_jsonb(v_drop),
            'urgent', v_urgent, 'due', v_due, 'key_suffix', 'v' || v_version::text,
            -- Finition 2b (D) : plafond de 2 SMS par détenteur dans la dernière heure avant le début
            'last_hour_from', CASE WHEN v_urgent THEN LEAST(v_old_start, v_new_start) - interval '1 hour' END,
            'multi_day', n_end_date IS NOT NULL AND n_end_date > n_start_date));
        v_notified := COALESCE((v_notify->>'notified_holders')::integer, 0);
        v_phones := COALESCE((v_notify->>'notified_phones')::integer, 0);
        v_sms_queued := COALESCE((v_notify->>'sms_queued')::integer, 0);
        -- Heure réelle de l'avis de lieu : celle de la fenêtre déjà ouverte s'il a été regroupé dans un avis en attente
        IF v_place_at IS NOT NULL THEN
            SELECT COALESCE(min(o.due_at), v_place_at) INTO v_place_at
              FROM public.notification_outbox o
             WHERE o.event_id = v_event AND o.type = 'EVENT_CHANGED' AND o.status = 'PENDING'
               AND o.template_data->'changed_fields' ?| ARRAY['location', 'city', 'address', 'position'];
        END IF;
    END IF;

    -- Finition 2b (D, E-28) : heure réelle de l'avis par SMS (fenêtre en cours, retenue d'une heure, ou tout de suite) et
    -- nombre de SMS (fenêtre « Prévenir » et bilan de l'enregistrement)
    IF cardinality(v_held) > 0 THEN
        v_notice_held := true;
        v_notice_at := v_hold_until;
        v_notice_recipients := public.event_notice_recipient_count(v_event, n_end_date IS NOT NULL AND n_end_date > n_start_date);
    ELSIF v_sms THEN
        SELECT min(o.due_at) INTO v_notice_at
          FROM public.notification_outbox o
         WHERE o.event_id = v_event AND o.type = 'EVENT_CHANGED' AND o.channel = 'SMS' AND o.status = 'PENDING';
        v_notice_recipients := v_sms_queued;
    END IF;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', CASE WHEN v_post THEN 'EVENT_LIVE_UPDATED' ELSE 'EVENT_UPDATED' END, 'EVENT', v_event,
            jsonb_build_object('status', e.status::text,
                               'fields', (SELECT COALESCE(jsonb_agg(k ORDER BY k), '[]'::jsonb) FROM jsonb_object_keys(v_patch) AS k),
                               'notified_fields', to_jsonb(v_changed), 'notified_holders', v_notified, 'notified_phones', v_phones,
                               'sms_queued', v_sms_queued, 'end_moved_later', v_new_end > v_old_end,
                               -- T4 : champs de lieu retenus par la cadence d'une heure (partent avec l'avis suivant)
                               'place_held', to_jsonb(v_held)));

    SELECT to_jsonb(ev) INTO v_row FROM public.events ev WHERE ev.id = v_event;
    RETURN jsonb_build_object('ok', true, 'event', v_row, 'notified_holders', v_notified, 'notified_phones', v_phones,
                              'sms_queued', v_sms_queued, 'changed_fields', to_jsonb(v_changed),
                              -- T4 : heure de l'avis de lieu (fenêtre de 10 minutes, ou fin de la retenue d'une heure)
                              'place_notice_at', v_place_at,
                              'place_notice_held', v_held && ARRAY['location', 'city', 'address', 'position']::text[],
                              -- Finition 2b (D) : avis par SMS (lieu ou date) : heure réelle, tout de suite, retenu, nombre de SMS
                              'sms_notice_at', v_notice_at,
                              'sms_notice_immediate', v_notice_at IS NOT NULL AND v_notice_at <= now(),
                              'sms_notice_held', v_notice_held,
                              'sms_recipients', v_notice_recipients);
END;
$$;


-- 5. event_place_notices_release
CREATE OR REPLACE FUNCTION public.event_place_notices_release(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now timestamptz := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    v_only uuid[] := CASE WHEN jsonb_typeof(p->'only_event_ids') = 'array'
                          THEN ARRAY(SELECT public.try_uuid(x) FROM jsonb_array_elements_text(p->'only_event_ids') AS x) END;
    r record;
    e public.events%ROWTYPE;
    v_fields text[];
    v_seq integer;
    v_data jsonb;
    v_released integer := 0;
BEGIN
    FOR r IN
        SELECT pn.event_id, pn.held_fields, pn.announced_latitude, pn.announced_longitude
          FROM public.event_place_notices pn
         WHERE pn.held_until IS NOT NULL AND pn.held_until <= v_now
           AND (v_only IS NULL OR pn.event_id = ANY (v_only))
         ORDER BY pn.held_until, pn.event_id
           FOR UPDATE SKIP LOCKED
    LOOP
        e := NULL;
        SELECT * INTO e FROM public.events ev WHERE ev.id = r.event_id;
        v_fields := r.held_fields;
        IF 'position' = ANY (v_fields)
           AND NOT COALESCE(e.latitude IS NOT NULL AND e.longitude IS NOT NULL AND r.announced_latitude IS NOT NULL
                            AND public.geo_distance_m(r.announced_latitude, r.announced_longitude, e.latitude, e.longitude) > 200, FALSE) THEN
            v_fields := array_remove(v_fields, 'position');
        END IF;
        UPDATE public.event_place_notices
           SET held_fields = '{}'::text[], held_until = NULL, release_seq = release_seq + 1, updated_at = now()
         WHERE event_id = r.event_id
        RETURNING release_seq INTO v_seq;
        IF e.id IS NULL OR e.status::text NOT IN ('VALIDE', 'PUBLIE', 'SUSPENDU') OR cardinality(v_fields) = 0 THEN
            CONTINUE;
        END IF;
        v_data := jsonb_strip_nulls(jsonb_build_object(
            'event_id', e.id, 'title', e.title, 'start_at', (e.start_date + e.start_time) AT TIME ZONE 'Africa/Dakar',
            'location', e.location, 'city', e.city,
            'changed_fields', to_jsonb(v_fields),
            -- Finition 2b (D) : avis de date retenu par la cadence : valeurs actuelles
            'new_start_at', CASE WHEN v_fields && ARRAY['start_date', 'start_time']::text[]
                                 THEN (e.start_date + e.start_time) AT TIME ZONE 'Africa/Dakar' END,
            'new_end_at', CASE WHEN v_fields && ARRAY['end_date', 'end_time']::text[] THEN public.event_end_at(e.id) END,
            'new_location', CASE WHEN 'location' = ANY (v_fields) THEN e.location END,
            'new_address', CASE WHEN 'address' = ANY (v_fields) THEN NULLIF(btrim(COALESCE(e.practical_info->>'address', '')), '') END,
            'new_city', CASE WHEN 'city' = ANY (v_fields) THEN e.city END,
            'address_cleared', CASE WHEN 'address' = ANY (v_fields)
                                         AND NULLIF(btrim(COALESCE(e.practical_info->>'address', '')), '') IS NULL THEN true END,
            'new_position', CASE WHEN 'position' = ANY (v_fields) THEN jsonb_build_object('latitude', e.latitude, 'longitude', e.longitude) END));
        PERFORM public.event_change_notify(jsonb_build_object(
            'event_id', e.id, 'changed', to_jsonb(v_fields), 'data', v_data,
            'drop', to_jsonb(ARRAY['migrated_from']
                             || CASE WHEN 'address' = ANY (v_fields) THEN ARRAY['new_address', 'address_cleared'] ELSE ARRAY[]::text[] END),
            'urgent', true, 'due', v_now, 'key_suffix', 'lieu' || v_seq::text,
            -- Finition 2b (D) : libéré dans la dernière heure avant le début : même plafond de 2 SMS par détenteur
            'last_hour_from', CASE WHEN (e.start_date + e.start_time) AT TIME ZONE 'Africa/Dakar' < v_now + interval '1 hour'
                                   THEN ((e.start_date + e.start_time) AT TIME ZONE 'Africa/Dakar') - interval '1 hour' END,
            'multi_day', e.end_date IS NOT NULL AND e.end_date > e.start_date));
        v_released := v_released + 1;
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'released', v_released);
END;
$$;


-- 6. notif_place_notice_sent
CREATE OR REPLACE FUNCTION public.notif_place_notice_sent()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_fields text[];
    v_at timestamptz := COALESCE(NEW.sent_at, now());
    v_lat double precision;
    v_lng double precision;
BEGIN
    v_fields := ARRAY(SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(NEW.template_data->'changed_fields') = 'array'
                                                              THEN NEW.template_data->'changed_fields' ELSE '[]'::jsonb END));
    -- Finition 2b (D) : départ d'un SMS de lieu OU de date (cadence d'une heure commune) ; la position annoncée ne change
    -- que pour un avis qui porte le repère
    IF NOT (v_fields && ARRAY['location', 'city', 'address', 'position', 'start_date', 'start_time', 'end_date', 'end_time']::text[])
       OR NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = NEW.event_id) THEN
        RETURN NULL;
    END IF;
    IF 'position' = ANY (v_fields) THEN
        BEGIN
            v_lat := (NEW.template_data->'new_position'->>'latitude')::double precision;
            v_lng := (NEW.template_data->'new_position'->>'longitude')::double precision;
        EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
            v_lat := NULL;
            v_lng := NULL;
        END;
        IF v_lat IS NULL OR v_lng IS NULL THEN
            SELECT e.latitude, e.longitude INTO v_lat, v_lng FROM public.events e WHERE e.id = NEW.event_id;
        END IF;
    END IF;
    INSERT INTO public.event_place_notices (event_id, announced_latitude, announced_longitude, announced_at, last_sent_at)
    VALUES (NEW.event_id, v_lat, v_lng, CASE WHEN v_lat IS NOT NULL AND v_lng IS NOT NULL THEN v_at END, v_at)
    ON CONFLICT (event_id) DO UPDATE
       SET last_sent_at = GREATEST(COALESCE(public.event_place_notices.last_sent_at, EXCLUDED.last_sent_at), EXCLUDED.last_sent_at),
           announced_latitude = CASE WHEN EXCLUDED.announced_latitude IS NOT NULL AND EXCLUDED.announced_longitude IS NOT NULL
                                     THEN EXCLUDED.announced_latitude ELSE public.event_place_notices.announced_latitude END,
           announced_longitude = CASE WHEN EXCLUDED.announced_latitude IS NOT NULL AND EXCLUDED.announced_longitude IS NOT NULL
                                      THEN EXCLUDED.announced_longitude ELSE public.event_place_notices.announced_longitude END,
           announced_at = COALESCE(EXCLUDED.announced_at, public.event_place_notices.announced_at),
           updated_at = now();
    RETURN NULL;
END;
$$;


REVOKE ALL ON FUNCTION public.event_change_notify(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_change_notify(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_update(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_update(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.event_place_notices_release(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_place_notices_release(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.notif_place_notice_sent() FROM PUBLIC, anon, authenticated;
