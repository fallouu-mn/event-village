-- Correctifs de la contre-vérification de la finition 2b, 4f — plafond « jamais plus de 2 SMS d'avis par détenteur et
-- par événement dans une heure glissante », indépendant de l'heure de début. Constat (docs/audit-finition-2b.md, 4f) :
-- le plafond de la dernière heure comptait depuis LEAST(ancien, nouveau début) − 1 h ; reporter le début d'une vingtaine
-- de minutes sortait de cette fenêtre les deux SMS déjà partis et le compteur repartait (4 SMS au même détenteur en
-- 37 s, répétable).
-- event_change_notify (recopie de 20261121000005_cvf2b_avis_en_cours_envoi.sql) : avant tout nouvel SMS d'avis (porteur
-- ou numéro sans compte), on compte ses SMS d'avis en attente ou en cours d'envoi (PENDING, SENDING : ils partent) et
-- ceux partis (SENT, UNCERTAIN) dans l'heure qui précède l'échéance de ce nouvel SMS ; deux ou plus : aucun troisième
-- (trace SKIPPED LAST_HOUR_CAP pour un porteur, rien pour un numéro). La fenêtre ne dépend plus du début : la clé
-- `last_hour_from` que passent encore event_update et event_place_notices_release n'est plus lue. Le plafond vaut à
-- toute heure ; hors de la dernière heure il ne mord pas (au plus un SMS par heure : retenue d'une heure et échéance
-- plancher du 4d). Conséquence voulue : pendant un événement commencé, 2 SMS au plus par heure glissante (avant : 2 en
-- tout depuis le début moins une heure).
-- Sans BEGIN ni COMMIT, rejouable (CREATE OR REPLACE) ; aucune donnée écrite.

-- event_change_notify
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
    -- Contre-vérification 2b (4f) : au plus 2 SMS d'avis par destinataire dans l'heure glissante qui précède l'échéance
    -- du nouvel SMS (indépendant du début : last_hour_from n'est plus lu)
    v_cap_from timestamptz;
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
    -- Contre-vérification 2b (4d) : échéance du SMS de ce destinataire (une heure au moins après son dernier SMS d'avis)
    v_hdue timestamptz;
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
            IF v_sms AND v_pending_id IS NULL THEN
                -- Contre-vérification 2b (4d) : hors dernière heure, jamais dû moins d'une heure après le dernier SMS
                -- d'avis réservé (SENDING) ou parti (SENT, UNCERTAIN) pour ce détenteur
                v_hdue := v_due;
                IF NOT v_urgent THEN
                    SELECT GREATEST(v_due, max(COALESCE(o.sent_at, o.claimed_at)) + interval '1 hour') INTO v_hdue
                      FROM public.notification_outbox o
                     WHERE o.event_id = v_event AND o.recipient_user_id = v_holder AND o.type = 'EVENT_CHANGED'
                       AND o.channel = 'SMS' AND o.status IN ('SENDING', 'SENT', 'UNCERTAIN');
                END IF;
                -- Contre-vérification 2b (4f) : deux SMS d'avis en attente, en cours d'envoi ou partis dans l'heure qui
                -- précède cette échéance : aucun troisième, trace SKIPPED (quel que soit le début de l'événement)
                v_cap_from := v_hdue - interval '1 hour';
                IF (SELECT count(*) FROM public.notification_outbox o
                     WHERE o.event_id = v_event AND o.recipient_user_id = v_holder AND o.type = 'EVENT_CHANGED'
                       AND o.channel = 'SMS'
                       AND (o.status IN ('PENDING', 'SENDING')
                            OR (o.status IN ('SENT', 'UNCERTAIN') AND COALESCE(o.sent_at, o.claimed_at, o.created_at) > v_cap_from))) >= 2 THEN
                    PERFORM public.notif_enqueue(jsonb_build_object(
                        'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                        'data', v_hdata, 'channels', jsonb_build_array('SMS'),
                        'skip', jsonb_build_object('SMS', 'LAST_HOUR_CAP')));
                ELSE
                    PERFORM public.notif_enqueue(jsonb_build_object(
                        'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                        'data', v_hdata, 'channels', jsonb_build_array('SMS'), 'due_at', v_hdue));
                    IF EXISTS (SELECT 1 FROM public.notification_outbox o
                                WHERE o.idempotency_key = v_nkey || ':SMS' AND o.status = 'PENDING') THEN
                        v_sms_queued := v_sms_queued + 1;
                    END IF;
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
            ELSIF v_sms THEN
                v_nkey := 'EVENT_CHANGED:' || v_event::text || ':t' || n.ticket_id::text || ':' || v_suffix;
                -- Contre-vérification 2b (4d) : même échéance plancher pour un numéro sans compte
                v_hdue := v_due;
                IF NOT v_urgent THEN
                    SELECT GREATEST(v_due, max(COALESCE(o.sent_at, o.claimed_at)) + interval '1 hour') INTO v_hdue
                      FROM public.notification_outbox o
                     WHERE o.event_id = v_event AND o.recipient_phone = n.phone AND o.recipient_user_id IS NULL
                       AND o.type = 'EVENT_CHANGED' AND o.channel = 'SMS' AND o.status IN ('SENDING', 'SENT', 'UNCERTAIN');
                END IF;
                -- Contre-vérification 2b (4f) : même plafond sur l'heure glissante pour un numéro sans compte (aucune trace :
                -- rien n'est écrit pour lui)
                v_cap_from := v_hdue - interval '1 hour';
                IF (SELECT count(*) FROM public.notification_outbox o
                     WHERE o.event_id = v_event AND o.recipient_phone = n.phone AND o.recipient_user_id IS NULL
                       AND o.type = 'EVENT_CHANGED' AND o.channel = 'SMS'
                       AND (o.status IN ('PENDING', 'SENDING')
                            OR (o.status IN ('SENT', 'UNCERTAIN') AND COALESCE(o.sent_at, o.claimed_at, o.created_at) > v_cap_from))) < 2 THEN
                    PERFORM public.notif_enqueue(jsonb_build_object(
                        'type', 'EVENT_CHANGED', 'key', v_nkey, 'phone', n.phone, 'event_id', v_event,
                        'data', v_data || jsonb_build_object('recipient_kind', 'PHONE', 'ticket_id', n.ticket_id),
                        'channels', jsonb_build_array('SMS'), 'due_at', v_hdue));
                    IF EXISTS (SELECT 1 FROM public.notification_outbox o
                                WHERE o.idempotency_key = v_nkey || ':SMS' AND o.status = 'PENDING') THEN
                        v_sms_queued := v_sms_queued + 1;
                    END IF;
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

REVOKE ALL ON FUNCTION public.event_change_notify(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_change_notify(jsonb) TO service_role;
