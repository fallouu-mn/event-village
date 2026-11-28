-- ============================================================================
-- EVENT VILLAGE — LOT « AVIS », PHASE 2, SOUS-LOT 2b : titulaires de table (écart A1 de docs/avis-inventaire.md)
-- ============================================================================
-- Constat (revérifié dans le code le 27/11) : le titulaire d'une table d'événement qui a envoyé toutes ses places n'a plus
-- de billet. Les destinataires du report (event_change_notify) et de la suspension, de la réactivation et de la clôture
-- (notif_event_status_changed) sont lus dans les billets : il n'apprend rien, alors que le remboursement de toute la table
-- lui est ouvert (event_table_postponement_refund). De plus, à l'envoi, notification_outbox_claim saute un EVENT_CHANGED
-- dont le destinataire n'a plus de billet (NO_VALID_TICKET).
--
-- Correctif :
--  1. private.event_table_holders(événement) — nouvelle : titulaires des tables ACTIVES de l'événement (comptes non
--     supprimés), une ligne par compte (sa première table active), avec l'ouverture du remboursement de la table ;
--  2. private.notif_holder_sms_count(événement, compte, depuis) — nouvelle : SMS de suspension et de reprise au
--     détenteur en attente ou en cours d'envoi, ou partis depuis l'instant donné (correctif T1 de la contre-vérification :
--     ni le report ni la clôture n'y sont comptés) ;
--  3. event_notice_recipient_count — recopie de 20261119000006_f2b_cadence_avis.sql:30-61 : les titulaires sans billet
--     sont comptés (aperçu « Prévenir ») ;
--  4. event_change_notify — recopie de 20261121000006_cvf2b_plafond_heure_glissante.sql:17-325 : les titulaires sans
--     billet rejoignent les détenteurs (même clé par compte : jamais deux avis s'il garde aussi un billet), avec
--     booking_id dans les données (lien « Ma table ») et refund_open si le remboursement de la table est ouvert ; le
--     plafond de 2 SMS par heure glissante reste celui d'avant le lot (seuls les EVENT_CHANGED, correctif T1) ;
--  5. notif_event_status_changed — recopie de 20261109000009_lot9bis_messages.sql:106-374 : suspension, réactivation et
--     clôture parviennent aux titulaires sans billet (booking_id) ; seules les bascules répétées entre suspension et
--     reprise sont bornées entre elles (2 SMS par détenteur et par événement dans l'heure, trace SKIPPED LAST_HOUR_CAP) ;
--     le SMS de la clôture et celui de la première suspension ne sont jamais plafonnés (correctif T1) ;
--  6. notification_outbox_claim — recopie de 20261125000006_f4_evenement_proche.sql:46-457 : un EVENT_CHANGED adressé au
--     titulaire d'une table encore active n'est plus sauté faute de billet.
-- Chaque recopie : ajouts seuls, aucune ligne de la dernière définition retirée (test
-- tests/schema/migration-avis2-rejouable.test.ts). Droits : aides private fermées à tous les rôles de l'API ; fonctions
-- publiques inchangées (service_role seulement ; notif_event_status_changed et notification_outbox_claim comme avant).
-- Sans BEGIN ni COMMIT, rejouable (CREATE OR REPLACE) ; aucune donnée écrite.
-- ============================================================================

-- 1. Titulaires des tables actives d'un événement
CREATE OR REPLACE FUNCTION private.event_table_holders(p_event uuid)
RETURNS TABLE (user_id uuid, booking_id uuid, refund_open boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT DISTINCT ON (b.holder_id) b.holder_id, b.id,
           COALESCE((private.event_table_postponement_window(b.id)->>'open')::boolean, FALSE)
      FROM public.event_table_bookings b
      JOIN public.users u ON u.id = b.holder_id
     WHERE b.event_id = p_event AND b.status = 'ACTIVE' AND u.status::text <> 'SUPPRIME'
     ORDER BY b.holder_id, b.created_at, b.id
$$;
REVOKE ALL ON FUNCTION private.event_table_holders(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 2. SMS de suspension et de reprise récents d'un détenteur pour un événement (bascules répétées, 2 SMS par heure glissante)
CREATE OR REPLACE FUNCTION private.notif_holder_sms_count(p_event uuid, p_user uuid, p_from timestamptz)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT count(*)::integer
      FROM public.notification_outbox o
     WHERE o.event_id = p_event AND o.recipient_user_id = p_user AND o.channel = 'SMS'
       AND o.type IN ('EVENT_SUSPENDED_HOLDER', 'EVENT_REACTIVATED_HOLDER')
       AND (o.status IN ('PENDING', 'SENDING')
            OR (o.status IN ('SENT', 'UNCERTAIN') AND COALESCE(o.sent_at, o.claimed_at, o.created_at) > p_from))
$$;
REVOKE ALL ON FUNCTION private.notif_holder_sms_count(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated, service_role;

-- 2 bis. Bascules répétées (nouvelle suspension, reprise) : SMS sauté (LAST_HOUR_CAP) si le détenteur a déjà 2 SMS de
-- suspension ou de reprise pour cet événement dans l'heure ; la ligne SMS sautée prend la clé de l'avis, l'émetteur crée
-- ensuite les autres canaux (même clé : ON CONFLICT DO NOTHING de notif_enqueue, aucun SMS en double). Jamais pour la
-- clôture, ni pour la première suspension de l'événement adressée à ce détenteur (correctif T1).
CREATE OR REPLACE FUNCTION private.notif_holder_status_sms_cap(p_type text, p_key text, p_user uuid, p_event uuid, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_type NOT IN ('EVENT_SUSPENDED_HOLDER', 'EVENT_REACTIVATED_HOLDER') THEN
        RETURN;
    END IF;
    IF p_type = 'EVENT_SUSPENDED_HOLDER' AND NOT EXISTS (
        SELECT 1 FROM public.notification_outbox o
         WHERE o.event_id = p_event AND o.recipient_user_id = p_user AND o.type = 'EVENT_SUSPENDED_HOLDER' AND o.channel = 'SMS') THEN
        RETURN;
    END IF;
    IF private.notif_holder_sms_count(p_event, p_user, now() - interval '1 hour') >= 2 THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', p_type, 'key', p_key, 'user_id', p_user, 'event_id', p_event, 'data', p_data,
            'channels', jsonb_build_array('SMS'), 'skip', jsonb_build_object('SMS', 'LAST_HOUR_CAP')));
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.notif_holder_status_sms_cap(text, text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- 2 ter. Avis d'état aux titulaires des tables actives qui n'ont plus de billet VALIDE ou UTILISE (les autres l'ont déjà
-- reçu comme détenteurs, même clé) : lien « Ma table » (booking_id), mêmes bascules bornées (jamais la clôture).
CREATE OR REPLACE FUNCTION private.notif_table_holders_status(p_type text, p_ref text, p_event uuid, p_data jsonb)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    h      record;
    v_key  text;
    v_data jsonb;
    v_n    integer := 0;
BEGIN
    FOR h IN
        SELECT th.user_id, th.booking_id FROM private.event_table_holders(p_event) th
         WHERE NOT EXISTS (SELECT 1 FROM public.tickets t
                            WHERE t.event_id = p_event AND t.user_id = th.user_id AND t.status::text IN ('VALIDE', 'UTILISE'))
         ORDER BY th.user_id
    LOOP
        v_key := p_type || ':' || p_ref || ':' || h.user_id::text;
        v_data := p_data || jsonb_build_object('booking_id', h.booking_id);
        PERFORM private.notif_holder_status_sms_cap(p_type, v_key, h.user_id, p_event, v_data);
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', p_type, 'key', v_key, 'user_id', h.user_id, 'event_id', p_event, 'data', v_data));
        v_n := v_n + 1;
    END LOOP;
    RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION private.notif_table_holders_status(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- 3. event_notice_recipient_count (recopie de 20261119000006_f2b_cadence_avis.sql:30-61)
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
        -- Avis phase 2 (2b, A1) : titulaires des tables actives, même sans billet (UNION : une fois par compte)
        UNION
        SELECT th.user_id FROM private.event_table_holders(p_event) th
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

-- 4. event_change_notify (recopie de 20261121000006_cvf2b_plafond_heure_glissante.sql:17-325)
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
    -- Avis phase 2 (2b, A1) : titulaires des tables actives sans billet → { compte : { booking_id, refund_open } }
    v_tables jsonb := '{}'::jsonb;
    v_th record;
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
    -- Avis phase 2 (2b, A1) : le titulaire d'une table active qui n'a plus de billet (places toutes envoyées) est prévenu
    -- comme un détenteur, une fois par compte (même clé), lien « Ma table » (booking_id) ; remboursement de la table ouvert
    -- par le report → variante « report » (refund_open)
    FOR v_th IN SELECT th.user_id, th.booking_id, th.refund_open FROM private.event_table_holders(v_event) th ORDER BY th.user_id LOOP
        CONTINUE WHEN v_th.user_id = ANY (COALESCE(v_holders, ARRAY[]::uuid[]));
        v_holders := COALESCE(v_holders, ARRAY[]::uuid[]) || v_th.user_id;
        v_tables := v_tables || jsonb_build_object(v_th.user_id::text, jsonb_build_object('booking_id', v_th.booking_id, 'refund_open', v_th.refund_open));
    END LOOP;
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
            -- Avis phase 2 (2b, A1) : titulaire d'une table sans billet → lien « Ma table », remboursement de la table
            IF v_tables ? v_holder::text THEN
                v_hdata := v_hdata || jsonb_build_object('booking_id', v_tables->(v_holder::text)->>'booking_id')
                           || CASE WHEN COALESCE((v_tables->(v_holder::text)->>'refund_open')::boolean, FALSE)
                                   THEN jsonb_build_object('refund_open', true) ELSE '{}'::jsonb END;
            END IF;
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

-- 5. notif_event_status_changed (recopie de 20261109000009_lot9bis_messages.sql:106-374)
CREATE OR REPLACE FUNCTION public.notif_event_status_changed()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old text := NEW.old_status::text;
    v_new text := NEW.new_status::text;
    v_owner uuid;
    v_company text;
    v_data jsonb;
    v_notice text;
    v_recipients uuid[];
    v_user uuid;
    v_open integer;
    v_cascade boolean := COALESCE(current_setting('ev.partner_cascade', true), '') = '1';
    h record;
    n record;
BEGIN
    IF NEW.channel = 'CREATION' OR v_old IS NULL THEN
        RETURN NULL;
    END IF;
    v_data := public.notif_event_data(NEW.event_id);
    IF v_data IS NULL THEN
        RETURN NULL;   -- événement absent (cascade) : rien à prévenir
    END IF;
    SELECT pa.user_id, pa.company_name INTO v_owner, v_company
      FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = NEW.event_id;

    IF v_old = 'BROUILLON' AND v_new = 'EN_ATTENTE' THEN
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_EVENT_SUBMITTED', 'ref', NEW.id::text, 'event_id', NEW.event_id,
            'data', v_data || jsonb_strip_nulls(jsonb_build_object('company', v_company))));
        -- Lot 9 bis (R95, B76) : accusé de soumission à la propriétaire
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_SUBMITTED_ACK', 'key', 'EVENT_SUBMITTED_ACK:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id, 'data', v_data));
        END IF;

    ELSIF v_old = 'EN_ATTENTE' AND v_new = 'BROUILLON' AND NEW.actor_role = 'ADMIN' THEN
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_REJECTED', 'key', 'EVENT_REJECTED:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id,
                'data', v_data || jsonb_strip_nulls(jsonb_build_object('reason', NEW.reason))));
        END IF;

    ELSIF v_old = 'EN_ATTENTE' AND v_new = 'VALIDE' THEN
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_VALIDATED', 'key', 'EVENT_VALIDATED:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id, 'data', v_data));
        END IF;

    ELSIF v_old = 'VALIDE' AND v_new = 'PUBLIE' AND NEW.actor_role = 'ADMIN' THEN
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_PUBLISHED_BY_ADMIN', 'key', 'EVENT_PUBLISHED_BY_ADMIN:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id, 'data', v_data));
        END IF;

    ELSIF v_old = 'PUBLIE' AND v_new = 'SUSPENDU' THEN
        -- Lot 9 bis (A7, B17) : transition d'une cascade de suspension de la partenaire (marqueur posé par
        -- partner_status_set, M06) : aucun avis par événement à la partenaire, qui a déjà celui de son compte.
        IF v_owner IS NOT NULL AND NOT v_cascade THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_SUSPENDED', 'key', 'EVENT_SUSPENDED:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id,
                'data', v_data || jsonb_strip_nulls(jsonb_build_object('reason', NEW.reason))));
        END IF;
        FOR h IN
            SELECT DISTINCT t.user_id FROM public.tickets t
             WHERE t.event_id = NEW.event_id AND t.user_id IS NOT NULL AND t.status::text IN ('VALIDE', 'UTILISE')
             ORDER BY t.user_id
        LOOP
            -- Avis phase 2 (2b, correctif T1) : bascules répétées bornées (jamais la première suspension)
            PERFORM private.notif_holder_status_sms_cap('EVENT_SUSPENDED_HOLDER', 'EVENT_SUSPENDED_HOLDER:' || NEW.id::text || ':' || h.user_id::text,
                                                         h.user_id, NEW.event_id, v_data);
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_SUSPENDED_HOLDER', 'key', 'EVENT_SUSPENDED_HOLDER:' || NEW.id::text || ':' || h.user_id::text,
                'user_id', h.user_id, 'event_id', NEW.event_id, 'data', v_data));
        END LOOP;
        -- Avis phase 2 (2b, A1) : titulaires des tables actives sans billet
        PERFORM private.notif_table_holders_status('EVENT_SUSPENDED_HOLDER', NEW.id::text, NEW.event_id, v_data);
        -- Lot 9 bis (R33, B72) : contrôleurs affectés (affectations acceptées), in-app et email, jamais de SMS
        FOR h IN
            SELECT ec.user_id FROM public.event_controllers ec WHERE ec.event_id = NEW.event_id ORDER BY ec.user_id
        LOOP
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'CONTROLLER_EVENT_STATUS', 'key', 'CONTROLLER_EVENT_STATUS:' || NEW.id::text || ':' || h.user_id::text,
                'user_id', h.user_id, 'event_id', NEW.event_id, 'data', v_data || jsonb_build_object('status', v_new)));
        END LOOP;

    ELSIF v_old = 'SUSPENDU' AND v_new = 'PUBLIE' THEN
        -- Lot 9 bis (A7, B17) : réactivation en cascade, aucun avis par événement à la partenaire
        IF v_owner IS NOT NULL AND NOT v_cascade THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_REACTIVATED', 'key', 'EVENT_REACTIVATED:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id, 'data', v_data));
        END IF;
        FOR h IN
            SELECT DISTINCT t.user_id FROM public.tickets t
             WHERE t.event_id = NEW.event_id AND t.user_id IS NOT NULL AND t.status::text IN ('VALIDE', 'UTILISE')
             ORDER BY t.user_id
        LOOP
            -- Avis phase 2 (2b, correctif T1) : bascules répétées bornées entre suspension et reprise
            PERFORM private.notif_holder_status_sms_cap('EVENT_REACTIVATED_HOLDER', 'EVENT_REACTIVATED_HOLDER:' || NEW.id::text || ':' || h.user_id::text,
                                                         h.user_id, NEW.event_id, v_data);
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_REACTIVATED_HOLDER', 'key', 'EVENT_REACTIVATED_HOLDER:' || NEW.id::text || ':' || h.user_id::text,
                'user_id', h.user_id, 'event_id', NEW.event_id, 'data', v_data));
        END LOOP;
        -- Avis phase 2 (2b, A1) : titulaires des tables actives sans billet
        PERFORM private.notif_table_holders_status('EVENT_REACTIVATED_HOLDER', NEW.id::text, NEW.event_id, v_data);
        -- Lot 9 bis (R33, B72) : contrôleurs affectés, in-app et email
        FOR h IN
            SELECT ec.user_id FROM public.event_controllers ec WHERE ec.event_id = NEW.event_id ORDER BY ec.user_id
        LOOP
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'CONTROLLER_EVENT_STATUS', 'key', 'CONTROLLER_EVENT_STATUS:' || NEW.id::text || ':' || h.user_id::text,
                'user_id', h.user_id, 'event_id', NEW.event_id, 'data', v_data || jsonb_build_object('status', v_new)));
        END LOOP;

    ELSIF v_new = 'ANNULE' THEN
        -- Avis public écrit par event_cancel avant la transition ; porteurs lus avant toute modification des
        -- billets (event_cancel ne les annule qu'après) ; mode de remboursement par porteur.
        -- Lot 9 bis (R13, B70) : destinataires = porteurs ∪ acheteurs d'origine (payeurs des paiements en ligne de
        -- billets encore valables, remboursés par event_cancel) ; mode par destinataire, premier vrai : AUTO pour le
        -- payeur (son remboursement est réel, prioritaire), TRANSFERRED pour le porteur d'un billet payé par un autre
        -- compte, ORGANIZER et NONE inchangés.
        SELECT c.public_notice INTO v_notice FROM public.event_cancellations c WHERE c.event_id = NEW.event_id;
        SELECT COALESCE(array_agg(x.uid ORDER BY x.uid), ARRAY[]::uuid[]) INTO v_recipients
          FROM (SELECT t.user_id AS uid FROM public.tickets t
                 WHERE t.event_id = NEW.event_id AND t.user_id IS NOT NULL AND t.status::text IN ('VALIDE', 'UTILISE')
                UNION
                SELECT py.client_id FROM public.tickets t
                  JOIN public.payments py ON py.id = t.payment_id
                 WHERE t.event_id = NEW.event_id AND t.status::text IN ('VALIDE', 'UTILISE') AND COALESCE(t.price, 0) > 0
                   AND py.client_id IS NOT NULL AND py.is_platform_payment AND py.payment_target::text = 'TICKET'
                   AND py.status::text IN ('SUCCESS', 'PARTIAL') AND py.amount > 0) x;
        FOREACH v_user IN ARRAY v_recipients LOOP
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_CANCELLED', 'key', 'EVENT_CANCELLED:' || NEW.event_id::text || ':' || v_user::text,
                'user_id', v_user, 'event_id', NEW.event_id,
                'data', v_data || jsonb_strip_nulls(jsonb_build_object(
                    'public_notice', NULLIF(btrim(COALESCE(v_notice, '')), ''),
                    'refund_mode', CASE
                        WHEN EXISTS (SELECT 1 FROM public.tickets t
                                       JOIN public.payments py ON py.id = t.payment_id
                                      WHERE t.event_id = NEW.event_id AND py.client_id = v_user
                                        AND t.status::text IN ('VALIDE', 'UTILISE') AND COALESCE(t.price, 0) > 0
                                        AND py.is_platform_payment AND py.payment_target::text = 'TICKET'
                                        AND py.status::text IN ('SUCCESS', 'PARTIAL') AND py.amount > 0) THEN 'AUTO'
                        WHEN EXISTS (SELECT 1 FROM public.tickets t
                                       JOIN public.payments py ON py.id = t.payment_id
                                      WHERE t.event_id = NEW.event_id AND t.user_id = v_user
                                        AND t.status::text IN ('VALIDE', 'UTILISE') AND py.is_platform_payment
                                        AND COALESCE(t.price, 0) > 0
                                        AND py.client_id IS DISTINCT FROM v_user) THEN 'TRANSFERRED'
                        WHEN EXISTS (SELECT 1 FROM public.tickets t
                                      WHERE t.event_id = NEW.event_id AND t.user_id = v_user
                                        AND t.status::text IN ('VALIDE', 'UTILISE') AND t.payment_id IS NULL
                                        AND t.order_id IS NOT NULL AND COALESCE(t.price, 0) > 0) THEN 'ORGANIZER'
                        ELSE 'NONE' END))));
        END LOOP;

        -- Lot 9 bis (R12, B69 ; R81) : numéros sans compte, une ligne SMS par numéro, sans lien. Invitation non
        -- réclamée et (R23) destinataire d'un transfert révoqué → NONE ; acheteur au guichet (numéro saisi, vente
        -- payée en espèces) → ORGANIZER, prioritaire.
        -- Les numéros des comptes déjà prévenus ci-dessus sont retirés. Aucun numéro dans les données.
        FOR n IN
            SELECT x.phone,
                   CASE WHEN bool_or(x.src = 'COUNTER') THEN 'ORGANIZER' ELSE 'NONE' END AS mode,
                   (array_agg(x.ticket_id ORDER BY x.ticket_id))[1] AS ticket_id
              FROM (SELECT tr.to_phone_or_email AS phone, 'INVITATION'::text AS src, t.id AS ticket_id
                      FROM public.ticket_transfers tr
                      JOIN public.tickets t ON t.id = tr.ticket_id
                     WHERE t.event_id = NEW.event_id AND tr.status::text = 'PENDING' AND tr.from_user_id IS NULL
                       AND t.user_id IS NULL AND t.status::text = 'VALIDE'
                    UNION ALL
                    SELECT '+221' || py.payer_phone, 'COUNTER', t.id
                      FROM public.tickets t
                      JOIN public.payments py ON py.id = t.payment_id
                     WHERE t.event_id = NEW.event_id AND t.sale_channel::text = 'COUNTER' AND NOT py.is_platform_payment
                       AND py.payer_phone ~ '^7[05678][0-9]{7}$'
                       AND t.status::text IN ('VALIDE', 'UTILISE') AND COALESCE(t.price, 0) > 0
                    UNION ALL
                    -- Lot 9 bis (R23, B73) : destinataire d'un transfert en attente, révoqué par event_cancel
                    SELECT tr.to_phone_or_email, 'TRANSFER', t.id
                      FROM public.ticket_transfers tr
                      JOIN public.tickets t ON t.id = tr.ticket_id
                     WHERE t.event_id = NEW.event_id AND tr.status::text = 'PENDING' AND tr.from_user_id IS NOT NULL
                       AND t.status::text = 'VALIDE') x
             WHERE x.phone ~ '^\+221[0-9]{9}$'
               AND NOT EXISTS (SELECT 1 FROM public.users u
                                WHERE u.id = ANY (v_recipients) AND u.phone IN (x.phone, substr(x.phone, 2)))
             GROUP BY x.phone
             ORDER BY x.phone
        LOOP
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_CANCELLED', 'key', 'EVENT_CANCELLED:' || NEW.event_id::text || ':t' || n.ticket_id::text,
                'phone', n.phone, 'event_id', NEW.event_id, 'channels', jsonb_build_array('SMS'),
                'data', v_data || jsonb_strip_nulls(jsonb_build_object(
                    'public_notice', NULLIF(btrim(COALESCE(v_notice, '')), ''),
                    'refund_mode', n.mode, 'recipient_kind', 'PHONE', 'ticket_id', n.ticket_id))));
        END LOOP;

        -- Lot 9 bis (R15, B72) : annulation par un admin → la propriétaire, avec l'avis public (jamais le motif
        -- interne), avant tout versement ; annulation par la partenaire → admins events.read, motif interne.
        IF NEW.actor_role = 'ADMIN' THEN
            IF v_owner IS NOT NULL THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CANCELLED_BY_ADMIN', 'key', 'EVENT_CANCELLED_BY_ADMIN:' || NEW.id::text,
                    'user_id', v_owner, 'event_id', NEW.event_id,
                    'data', v_data || jsonb_strip_nulls(jsonb_build_object('public_notice', NULLIF(btrim(COALESCE(v_notice, '')), '')))));
            END IF;
        ELSIF NEW.actor_role = 'PARTENAIRE' THEN
            PERFORM public.notif_enqueue_admins(jsonb_build_object(
                'type', 'ADMIN_EVENT_CANCELLED', 'ref', NEW.id::text, 'event_id', NEW.event_id,
                'data', v_data || jsonb_strip_nulls(jsonb_build_object(
                    'company', v_company,
                    'reason', (SELECT NULLIF(btrim(COALESCE(c.internal_reason, '')), '')
                                 FROM public.event_cancellations c WHERE c.event_id = NEW.event_id)))));
        END IF;

        -- Lot 9 bis (R33, B72) : contrôleurs affectés (affectations acceptées), SMS et in-app
        FOR h IN
            SELECT ec.user_id FROM public.event_controllers ec WHERE ec.event_id = NEW.event_id ORDER BY ec.user_id
        LOOP
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'CONTROLLER_EVENT_CANCELLED', 'key', 'CONTROLLER_EVENT_CANCELLED:' || NEW.event_id::text || ':' || h.user_id::text,
                'user_id', h.user_id, 'event_id', NEW.event_id, 'data', v_data));
        END LOOP;

    ELSIF v_new = 'TERMINE' THEN
        -- Lot 9 bis (R72, B77, X11) : un seul avis par cas à la propriétaire. Les rappels en attente sont annulés par
        -- trg_notif_cancel_on_status. Caisses encore ouvertes lues sans verrou (shift_close passe par la caisse).
        SELECT count(*)::integer INTO v_open
          FROM public.controller_shifts s WHERE s.event_id = NEW.event_id AND s.status = 'OUVERT';
        IF v_old = 'PUBLIE' AND v_open = 0 AND v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_FINISHED', 'key', 'EVENT_FINISHED:' || NEW.event_id::text,
                'user_id', v_owner, 'event_id', NEW.event_id, 'data', v_data));
        END IF;
        -- Lot 9 bis (R3, B46, X10) : un événement suspendu clos par l'administration. Porteurs (billets VALIDE ou
        -- UTILISE) : EVENT_CLOSED_HOLDER sans motif ; propriétaire : EVENT_CLOSED_BY_ADMIN avec le motif de l'admin.
        IF v_old = 'SUSPENDU' THEN
            FOR h IN
                SELECT DISTINCT t.user_id FROM public.tickets t
                 WHERE t.event_id = NEW.event_id AND t.user_id IS NOT NULL AND t.status::text IN ('VALIDE', 'UTILISE')
                 ORDER BY t.user_id
            LOOP
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CLOSED_HOLDER', 'key', 'EVENT_CLOSED_HOLDER:' || NEW.id::text || ':' || h.user_id::text,
                    'user_id', h.user_id, 'event_id', NEW.event_id, 'data', v_data));
            END LOOP;
            -- Avis phase 2 (2b, A1) : titulaires des tables actives sans billet
            PERFORM private.notif_table_holders_status('EVENT_CLOSED_HOLDER', NEW.id::text, NEW.event_id, v_data);
            IF v_owner IS NOT NULL THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CLOSED_BY_ADMIN', 'key', 'EVENT_CLOSED_BY_ADMIN:' || NEW.id::text,
                    'user_id', v_owner, 'event_id', NEW.event_id,
                    'data', v_data || jsonb_strip_nulls(jsonb_build_object('reason', NULLIF(btrim(COALESCE(NEW.reason, '')), '')))));
            END IF;
        END IF;
        -- Lot 9 bis (R43, B50, X11) : caisse encore ouverte au passage à TERMINE (depuis PUBLIE ou SUSPENDU), jamais
        -- à l'annulation : SHIFT_OPEN_AT_END à la propriétaire, nombre de caisses ouvertes.
        IF v_open > 0 AND v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'SHIFT_OPEN_AT_END', 'key', 'SHIFT_OPEN_AT_END:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id,
                'data', v_data || jsonb_build_object('open_shifts', v_open)));
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notif_event_status_changed() FROM PUBLIC, anon, authenticated;

-- 6. notification_outbox_claim (recopie de 20261125000006_f4_evenement_proche.sql:46-457)
CREATE OR REPLACE FUNCTION public.notification_outbox_claim(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now         timestamptz;
    v_limit       integer;
    v_only_ids    uuid[];
    v_only_events uuid[];
    v_token       uuid := gen_random_uuid();
    r             record;
    v_ustatus     text;
    v_uphone      text;
    v_uemail      text;
    v_ufirst      text;
    v_blocked     boolean;
    v_pref        boolean;
    v_pref_json   jsonb;
    v_found_event boolean;
    v_estatus     text;
    v_etitle      text;
    v_eloc        text;
    v_ecity       text;
    v_estart      timestamptz;
    v_emulti      boolean;
    v_event_json  jsonb;
    v_holder      jsonb;
    v_valid       uuid[];
    v_quiet       jsonb;
    v_qs          integer;
    v_qe          integer;
    v_in_quiet    boolean;
    v_sibling     text;
    v_phone       text;
    v_email       text;
    v_vemail      text;
    v_email_json  jsonb;
    v_outcome     text;
    v_reason      text;
    v_tpl_start   timestamptz;
    v_decision    jsonb;
    v_cap         integer;
    v_bday        date;
    v_budget_day  date;
    v_budget_used integer := 0;
    v_budget      jsonb;
    v_claimed     jsonb := '[]'::jsonb;
    n_examined    integer := 0;
    n_skipped     integer := 0;
    n_cancelled   integer := 0;
    n_waiting     integer := 0;
    n_reclaimed   integer := 0;
    n_uncertain   integer := 0;
    n_failed      integer := 0;
BEGIN
    v_now := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    IF v_now < now() - interval '1 minute' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_NOW',
            'message', 'Horloge refusée : une heure dans le passé n''est jamais acceptée.');
    END IF;
    v_limit := LEAST(GREATEST(COALESCE(NULLIF(p->>'limit', '')::integer, 100), 1), 500);
    IF jsonb_typeof(p->'only_ids') = 'array' THEN
        v_only_ids := ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(p->'only_ids') AS x);
    END IF;
    IF jsonb_typeof(p->'only_event_ids') = 'array' THEN
        v_only_events := ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(p->'only_event_ids') AS x);
    END IF;

    -- 1. Reprise des lignes SENDING de plus de 10 minutes (envoyeur interrompu). Un SMS n'est jamais
    --    renvoyé : il devient UNCERTAIN. Les autres canaux repartent (IN_APP idempotent par notification_id,
    --    EMAIL par Idempotency-Key, PUSH par tag), ou passent FAILED à la dernière tentative.
    FOR r IN
        SELECT o.id, o.type, o.channel, o.attempts, o.max_attempts, o.claimed_at
          FROM public.notification_outbox o
         WHERE o.status = 'SENDING'
           AND o.claimed_at < v_now - interval '10 minutes'
           AND (v_only_ids IS NULL OR o.id = ANY (v_only_ids))
           AND (v_only_events IS NULL OR o.event_id = ANY (v_only_events))
         ORDER BY o.claimed_at, o.id
           FOR UPDATE SKIP LOCKED
    LOOP
        n_reclaimed := n_reclaimed + 1;
        IF r.channel = 'SMS' THEN
            UPDATE public.notification_outbox
               SET status = 'UNCERTAIN', reason = 'SENDING_INTERRUPTED',
                   reason_detail = 'Envoi interrompu après la réservation : issue inconnue, jamais renvoyé automatiquement.',
                   sent_at = r.claimed_at, finished_at = v_now
             WHERE id = r.id;
            n_uncertain := n_uncertain + 1;
        ELSIF r.attempts >= r.max_attempts THEN
            UPDATE public.notification_outbox
               SET status = 'FAILED', reason = 'SENDING_INTERRUPTED',
                   reason_detail = 'Envoi interrompu à la dernière tentative.', finished_at = v_now
             WHERE id = r.id;
            PERFORM public.notif_failed_alert(r.id, r.type, r.channel, 'SENDING_INTERRUPTED', r.attempts, v_now);
            n_failed := n_failed + 1;
        ELSE
            UPDATE public.notification_outbox
               SET status = 'PENDING', next_attempt_at = v_now, claim_token = NULL
             WHERE id = r.id;
        END IF;
    END LOOP;

    -- 2. Candidats dus, IN_APP d'abord (instantané), puis PUSH, EMAIL, SMS.
    FOR r IN
        SELECT o.id, o.idempotency_key, o.group_key, o.type, o.family, o.topic, o.channel,
               o.recipient_user_id, o.recipient_phone, o.recipient_email, o.event_id, o.actor_id, o.shift_id,
               o.template_data, o.attempts, o.max_attempts, o.due_at, t.suspended_policy,
               t.night_policy
          FROM public.notification_outbox o
          JOIN public.notification_types t ON t.type = o.type
         WHERE o.status = 'PENDING' AND o.origin = 'OUTBOX' AND o.next_attempt_at <= v_now
           AND (v_only_ids IS NULL OR o.id = ANY (v_only_ids))
           AND (v_only_events IS NULL OR o.event_id = ANY (v_only_events))
         ORDER BY CASE o.channel WHEN 'IN_APP' THEN 1 WHEN 'PUSH' THEN 2 WHEN 'EMAIL' THEN 3 ELSE 4 END,
                  o.next_attempt_at, o.id
         LIMIT v_limit
           FOR UPDATE OF o SKIP LOCKED
    LOOP
        n_examined := n_examined + 1;
        v_outcome := 'SEND';
        v_reason := NULL;
        v_ustatus := NULL; v_uphone := NULL; v_uemail := NULL; v_ufirst := NULL;
        v_blocked := false;
        v_pref := NULL; v_pref_json := NULL;
        v_found_event := false;
        v_estatus := NULL; v_etitle := NULL; v_eloc := NULL; v_ecity := NULL; v_estart := NULL; v_emulti := false;
        v_event_json := NULL; v_holder := NULL; v_quiet := NULL; v_sibling := NULL;
        v_phone := NULL; v_email := NULL;
        v_vemail := NULL; v_email_json := NULL;
        v_cap := NULL; v_budget := NULL;

        IF r.recipient_user_id IS NOT NULL THEN
            SELECT u.status::text, u.phone, u.email, u.first_name
              INTO v_ustatus, v_uphone, v_uemail, v_ufirst
              FROM public.users u WHERE u.id = r.recipient_user_id;
            v_blocked := public.notif_account_blocked(r.recipient_user_id);
        END IF;
        v_phone := COALESCE(r.recipient_phone, NULLIF(btrim(COALESCE(v_uphone, '')), ''));
        v_email := COALESCE(r.recipient_email, v_uemail);
        -- Lot 9 bis (R87, B96, w12) : adresse vérifiée du compte relue à la réservation.
        IF r.channel = 'EMAIL' THEN
            v_vemail := public.notif_verified_email(r.recipient_user_id);
            v_email_json := jsonb_build_object('verified',
                v_email IS NOT NULL AND v_vemail IS NOT NULL AND lower(v_email) = lower(v_vemail));
        END IF;

        IF r.family = 'OPTIONAL' THEN
            IF r.recipient_user_id IS NULL THEN
                v_pref := TRUE;
            ELSE
                v_pref := public.notif_preference_enabled(r.recipient_user_id, r.topic, r.channel);
            END IF;
            v_pref_json := jsonb_build_object('topic', r.topic, 'channel', r.channel, 'enabled', v_pref);
        END IF;

        IF r.event_id IS NOT NULL THEN
            SELECT e.status::text, e.title, e.location, e.city, public.event_start_at(e.id),
                   (e.end_date IS NOT NULL AND e.end_date > e.start_date)
              INTO v_estatus, v_etitle, v_eloc, v_ecity, v_estart, v_emulti
              FROM public.events e WHERE e.id = r.event_id;
            v_found_event := FOUND;
            IF v_found_event THEN
                v_event_json := jsonb_build_object('id', r.event_id, 'status', v_estatus, 'start_at', v_estart);
            END IF;
        END IF;

        -- Revérification : premier cas vrai.
        IF v_blocked AND r.suspended_policy = 'BLOCK' THEN
            v_outcome := 'SKIP'; v_reason := 'ACCOUNT_SUSPENDED';
        ELSIF r.family = 'OPTIONAL' AND v_pref IS FALSE THEN
            v_outcome := 'SKIP'; v_reason := 'PREFERENCE_DISABLED';
        END IF;

        IF v_outcome = 'SEND' AND r.type IN ('REMINDER_J1', 'REMINDER_H3', 'CONTROLLER_REMINDER') THEN
            v_tpl_start := public.notif_try_timestamptz(r.template_data->>'start_at');
            IF r.type = 'CONTROLLER_REMINDER'
               AND NOT EXISTS (SELECT 1 FROM public.event_controllers ec
                                WHERE ec.id::text = r.template_data->>'assignment_id'
                                  AND ec.user_id = r.recipient_user_id
                                  AND ec.event_id = r.event_id) THEN
                v_outcome := 'CANCEL'; v_reason := 'NO_LONGER_ASSIGNED';
            ELSIF NOT v_found_event OR v_estatus <> 'PUBLIE' THEN
                v_outcome := 'CANCEL'; v_reason := 'EVENT_NOT_PUBLISHED';
            ELSIF r.template_data ? 'start_at' AND v_tpl_start IS DISTINCT FROM v_estart THEN
                v_outcome := 'CANCEL'; v_reason := 'EVENT_RESCHEDULED';
            ELSIF v_estart <= v_now THEN
                v_outcome := 'CANCEL'; v_reason := 'EVENT_STARTED';
            -- Finition 4 (point 1) : pas de rappel à moins de 30 minutes du début
            ELSIF v_estart - interval '30 minutes' <= v_now THEN
                v_outcome := 'CANCEL'; v_reason := 'TOO_CLOSE_TO_START';
            ELSIF r.type IN ('REMINDER_J1', 'REMINDER_H3') THEN
                v_valid := ARRAY(SELECT t.id FROM public.tickets t
                                  WHERE t.event_id = r.event_id AND t.user_id = r.recipient_user_id
                                    AND t.status::text = 'VALIDE'
                                  ORDER BY t.id);
                v_holder := jsonb_build_object('valid_ticket_ids', to_jsonb(v_valid));
                IF cardinality(v_valid) = 0 THEN
                    v_outcome := 'SKIP'; v_reason := 'NO_VALID_TICKET';
                END IF;
            END IF;
        ELSIF v_outcome = 'SEND' AND r.type = 'EVENT_CHANGED' THEN
            IF NOT v_found_event OR v_estatus NOT IN ('VALIDE', 'PUBLIE', 'SUSPENDU') THEN
                v_outcome := 'CANCEL'; v_reason := 'NO_LONGER_RELEVANT';
            ELSIF r.recipient_user_id IS NOT NULL
                  -- Avis phase 2 (2b, A1) : le titulaire d'une table encore active est prévenu même sans billet
                  AND NOT EXISTS (SELECT 1 FROM public.event_table_bookings b
                                   WHERE b.event_id = r.event_id AND b.holder_id = r.recipient_user_id AND b.status = 'ACTIVE')
                  AND NOT EXISTS (SELECT 1 FROM public.tickets t
                                   WHERE t.event_id = r.event_id AND t.user_id = r.recipient_user_id
                                     AND (t.status::text = 'VALIDE' OR (v_emulti AND t.status::text = 'UTILISE'))) THEN
                v_outcome := 'SKIP'; v_reason := 'NO_VALID_TICKET';
            END IF;
        -- Finition 4 (point 2) : la catégorie complète encore en attente quand l'événement entier est complet n'est plus
        -- envoyée : « événement complet » (qui nomme la dernière catégorie) la remplace, un seul message.
        ELSIF v_outcome = 'SEND' AND r.type = 'CATEGORY_SOLD_OUT'
              AND EXISTS (SELECT 1 FROM public.notification_outbox s
                           WHERE s.type = 'EVENT_SOLD_OUT' AND s.event_id = r.event_id
                             AND s.recipient_user_id IS NOT DISTINCT FROM r.recipient_user_id
                             AND s.channel = r.channel AND s.status <> 'CANCELLED') THEN
            v_outcome := 'CANCEL'; v_reason := 'SUPERSEDED';
        -- Finition 4 (point 3) : merci du lendemain sans objet si l'événement est annulé ou supprimé
        ELSIF v_outcome = 'SEND' AND r.type = 'ENTRY_THANKS' AND (NOT v_found_event OR v_estatus = 'ANNULE') THEN
            v_outcome := 'CANCEL'; v_reason := 'NO_LONGER_RELEVANT';
        END IF;

        -- Finition 4 (point 1) : nuit. Un SMS ou un push d'un type non urgent (night_policy DEFER : toute la famille OPTIONAL,
        -- ADMIN_REVIEW_SMS et les avis sans urgence) réservé pendant la plage réglée est reporté à sa fin (DEFER, motif NIGHT) :
        -- toujours en attente, aucune tentative ni aucun budget consommé ; revérifié en entier à la fin de la plage. Placé avant
        -- l'attente du push (IF_NO_PUSH) : le SMS d'un rappel de nuit est reporté tout de suite, pas après 15 minutes d'attente.
        -- Remplace l'issue SKIP QUIET_HOURS des SMS facultatifs et le cas ADMIN_NIGHT du correctif main-414.
        IF v_outcome = 'SEND' AND r.channel IN ('SMS', 'PUSH') AND r.night_policy = 'DEFER' THEN
            v_qs := public.notif_setting_int('notif.sms_quiet_start');
            v_qe := public.notif_setting_int('notif.sms_quiet_end');
            IF v_qs IS NOT NULL AND v_qe IS NOT NULL THEN
                v_in_quiet := public.notif_in_quiet_hours(v_now, v_qs, v_qe);
                v_quiet := jsonb_build_object('start', v_qs, 'end', v_qe,
                    'hour', extract(hour FROM (v_now AT TIME ZONE 'Africa/Dakar'))::integer, 'in_quiet', v_in_quiet);
                -- Finition 4, règle du 20/11 : un avis lié à un événement qui commence dans moins de 12 h ou qui est en cours
                -- n'attend pas la fin de la nuit (instantané quiet.event_soon)
                IF v_in_quiet AND public.notif_event_soon(r.event_id, r.template_data, v_now) THEN
                    v_quiet := v_quiet || jsonb_build_object('event_soon', true);
                ELSIF v_in_quiet THEN
                    v_outcome := 'DEFER'; v_reason := 'NIGHT';
                    v_quiet := v_quiet || jsonb_build_object('until', public.notif_quiet_end_at(v_now, v_qs, v_qe));
                END IF;
            END IF;
        END IF;

        -- Contre-vérification de la finition 4 (T1, T2) : avis d'état au porteur revérifié AU MOMENT D'ENVOYER (après la décision
        -- de nuit : un avis reporté la nuit l'est à 07:00). Événement terminé (statut ou fin passée) : annulé (EVENT_TERMINE) ;
        -- état qui n'est plus celui annoncé (suspendu puis annulé ou repris, repris puis suspendu) : annulé (NO_LONGER_RELEVANT).
        IF v_outcome = 'SEND' AND r.type IN ('EVENT_SUSPENDED_HOLDER', 'EVENT_REACTIVATED_HOLDER') THEN
            IF v_found_event AND (v_estatus = 'TERMINE' OR v_now >= public.event_end_at(r.event_id)) THEN
                v_outcome := 'CANCEL'; v_reason := 'EVENT_TERMINE';
            ELSIF v_found_event
                  AND ((r.type = 'EVENT_SUSPENDED_HOLDER' AND v_estatus IS DISTINCT FROM 'SUSPENDU')
                       OR (r.type = 'EVENT_REACTIVATED_HOLDER' AND v_estatus IS DISTINCT FROM 'PUBLIE')) THEN
                v_outcome := 'CANCEL'; v_reason := 'NO_LONGER_RELEVANT';
            END IF;
        END IF;

        IF v_outcome = 'SEND' AND r.channel = 'SMS' THEN
            IF v_phone IS NULL THEN
                v_outcome := 'SKIP'; v_reason := 'NO_PHONE';
            ELSIF r.family = 'OPTIONAL'
                  AND (public.notif_setting_int('notif.sms_quiet_start') IS NULL OR public.notif_setting_int('notif.sms_quiet_end') IS NULL) THEN
                v_outcome := 'SKIP'; v_reason := 'SETTING_MISSING';
            END IF;

            -- Rappel en IF_NO_PUSH : le SMS attend le résultat de la ligne PUSH du même groupe tant qu'elle
            -- n'est pas terminale et au plus 15 min après l'échéance (amendement 7) ; dans le doute il part.
            IF v_outcome = 'SEND' AND r.type IN ('REMINDER_J1', 'REMINDER_H3', 'CONTROLLER_REMINDER')
               AND r.template_data->>'sms_policy' = 'IF_NO_PUSH' THEN
                SELECT s.status INTO v_sibling
                  FROM public.notification_outbox s
                 WHERE s.group_key = r.group_key AND s.channel = 'PUSH' AND s.id <> r.id
                 ORDER BY s.created_at, s.id LIMIT 1;
                IF v_sibling IS NULL THEN
                    v_sibling := 'ABSENT';
                END IF;
                IF v_sibling = 'SENT' THEN
                    v_outcome := 'SKIP'; v_reason := 'PUSH_DELIVERED';
                ELSIF v_sibling IN ('PENDING', 'SENDING') AND v_now < r.due_at + interval '15 minutes' THEN
                    v_outcome := 'WAIT';
                END IF;
            END IF;

            -- Affectation d'un compte invité il y a moins d'une heure : l'invitation a déjà prévenu.
            IF v_outcome = 'SEND' AND r.type = 'CONTROLLER_ASSIGNED'
               AND EXISTS (SELECT 1 FROM public.notification_outbox i
                            WHERE i.type = 'CONTROLLER_INVITE' AND i.status IN ('SENT', 'UNCERTAIN')
                              AND (i.recipient_user_id = r.recipient_user_id OR i.recipient_phone = v_phone)
                              AND COALESCE(i.sent_at, i.finished_at) > v_now - interval '1 hour') THEN
                v_outcome := 'SKIP'; v_reason := 'COVERED_BY_INVITATION';
            END IF;
        ELSIF v_outcome = 'SEND' AND r.channel = 'EMAIL' THEN
            IF v_email IS NULL OR position('@' IN v_email) <= 1 OR v_email ~* '@(([a-z0-9-]+\.)*eventvillage\.sn|([a-z0-9-]+\.)*invalid)$' THEN
                v_outcome := 'SKIP'; v_reason := 'NO_REAL_EMAIL';
            ELSIF (v_email_json->>'verified')::boolean IS NOT TRUE THEN
                v_outcome := 'SKIP'; v_reason := 'EMAIL_NOT_VERIFIED';
            END IF;
        END IF;

        IF v_outcome = 'SEND' AND r.attempts >= r.max_attempts THEN
            -- Garde : une ligne en attente qui a épuisé ses tentatives ne repart pas.
            v_outcome := 'FAIL';
            v_reason := CASE r.channel WHEN 'SMS' THEN 'SMS_PROVIDER_ERROR' WHEN 'EMAIL' THEN 'EMAIL_PROVIDER_ERROR'
                                       WHEN 'PUSH' THEN 'PUSH_PROVIDER_ERROR' ELSE 'TEMPLATE_ERROR' END;
        END IF;

        -- Lot 7 (7.0 a, D13) : budget des SMS optionnels du jour de Dakar de l'horloge de l'envoyeur. Lu une
        -- fois par jour et par appel, sous verrou consultatif (deux envoyeurs simultanés ne dépassent pas le
        -- plafond), puis incrémenté à chaque ligne réservée. Une ligne qui ne part pas ici ne consomme rien.
        IF v_outcome = 'SEND' AND r.channel = 'SMS' AND r.family = 'OPTIONAL' THEN
            v_cap := public.notif_setting_int('notif.sms_optional_daily_cap');
            IF v_cap IS NULL THEN
                v_outcome := 'SKIP'; v_reason := 'SETTING_MISSING';
            ELSE
                v_bday := (v_now AT TIME ZONE 'Africa/Dakar')::date;
                IF v_budget_day IS DISTINCT FROM v_bday THEN
                    PERFORM pg_advisory_xact_lock(hashtext('notif.sms_optional_cap:' || v_bday::text));
                    v_budget_used := public.notif_sms_optional_used(v_bday);
                    v_budget_day := v_bday;
                END IF;
                v_budget := jsonb_build_object('day', v_bday, 'cap', v_cap, 'used_before', v_budget_used);
                IF v_budget_used >= v_cap THEN
                    v_outcome := 'SKIP'; v_reason := 'SMS_OPTIONAL_CAP';
                ELSE
                    v_budget_used := v_budget_used + 1;
                END IF;
            END IF;
        END IF;

        v_decision := jsonb_strip_nulls(jsonb_build_object(
            'at', v_now, 'stage', 'CLAIM', 'outcome', v_outcome, 'reason', v_reason,
            'family', r.family, 'topic', r.topic,
            'account', CASE WHEN r.recipient_user_id IS NULL THEN NULL ELSE jsonb_build_object('status', v_ustatus, 'blocked', v_blocked) END,
            'preference', v_pref_json,
            'event', v_event_json,
            'holder', v_holder,
            'quiet', v_quiet,
            'sms_policy', r.template_data->'sms_policy',
            'push_sibling', v_sibling,
            'sms_budget', v_budget,
            'email', v_email_json
        ));

        IF v_outcome = 'SKIP' THEN
            UPDATE public.notification_outbox
               SET status = 'SKIPPED', reason = v_reason, finished_at = v_now, decision = v_decision
             WHERE id = r.id;
            n_skipped := n_skipped + 1;
        ELSIF v_outcome = 'CANCEL' THEN
            UPDATE public.notification_outbox
               SET status = 'CANCELLED', reason = v_reason, finished_at = v_now, decision = v_decision
             WHERE id = r.id;
            n_cancelled := n_cancelled + 1;
        ELSIF v_outcome = 'DEFER' THEN
            -- Finition 4 : reporté à la fin de la plage de nuit, toujours en attente (aucune tentative ni aucun budget consommé)
            UPDATE public.notification_outbox
               SET due_at = (v_quiet->>'until')::timestamptz, next_attempt_at = (v_quiet->>'until')::timestamptz,
                   decision = v_decision
             WHERE id = r.id;
            n_waiting := n_waiting + 1;
        ELSIF v_outcome = 'WAIT' THEN
            UPDATE public.notification_outbox
               SET next_attempt_at = v_now + interval '1 minute', decision = v_decision
             WHERE id = r.id;
            n_waiting := n_waiting + 1;
        ELSIF v_outcome = 'FAIL' THEN
            UPDATE public.notification_outbox
               SET status = 'FAILED', reason = v_reason,
                   reason_detail = 'Tentatives épuisées avant un nouvel envoi.', finished_at = v_now, decision = v_decision
             WHERE id = r.id;
            PERFORM public.notif_failed_alert(r.id, r.type, r.channel, v_reason, r.attempts, v_now);
            n_failed := n_failed + 1;
        ELSE
            UPDATE public.notification_outbox
               SET status = 'SENDING', attempts = attempts + 1, claimed_at = v_now, claim_token = v_token, decision = v_decision
             WHERE id = r.id;
            v_claimed := v_claimed || jsonb_build_array(jsonb_build_object(
                'id', r.id,
                'claim_token', v_token,
                'type', r.type,
                'channel', r.channel,
                'family', r.family,
                'topic', r.topic,
                'group_key', r.group_key,
                'idempotency_key', r.idempotency_key,
                'attempts', r.attempts + 1,
                'max_attempts', r.max_attempts,
                'due_at', r.due_at,
                'recipient', jsonb_build_object('user_id', r.recipient_user_id, 'phone', v_phone, 'email', v_email, 'first_name', v_ufirst),
                'event', CASE WHEN v_found_event THEN jsonb_build_object(
                             'id', r.event_id, 'title', v_etitle, 'start_at', v_estart, 'location', v_eloc, 'city', v_ecity)
                         END,
                'actor_id', r.actor_id,
                'shift_id', r.shift_id,
                'template_data', r.template_data,
                'sms_optional_cap', v_cap
            ));
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'ok', true, 'now', v_now, 'claimed', v_claimed, 'examined', n_examined,
        'skipped', n_skipped, 'cancelled', n_cancelled, 'reclaimed', n_reclaimed,
        'uncertain', n_uncertain, 'waiting', n_waiting, 'failed', n_failed
    );
END;
$$;
