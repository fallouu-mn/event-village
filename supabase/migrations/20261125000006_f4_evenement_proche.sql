-- ============================================================================
-- EVENT VILLAGE — FINITION 4, 6 : un avis lié à un événement proche n'attend pas la fin de la nuit
-- ============================================================================
-- Décision du client (20/11) : la liste des avis non urgents est validée, avec une règle en plus : tout avis lié à un
-- événement qui commence dans moins de 12 heures, ou qui est en cours, devient urgent (billet revenu à l'expéditeur,
-- transfert, invitation de contrôleur…), même pendant la plage de nuit.
--
-- notif_event_soon(événement, données, heure) : vrai si l'événement de la ligne (event_id) ou l'un des événements de ses
-- données (liste « events » des invitations de contrôleurs) n'est pas annulé, commence au plus 12 heures après l'heure donnée
-- et n'est pas fini (event_end_at). Fonction fermée (service_role seulement).
-- notification_outbox_claim (recopie de 20261125000002_f4_nuit.sql, dernière définition de la branche) : dans la plage de nuit,
-- une ligne SMS ou push d'un type non urgent liée à un événement proche part tout de suite (décision SEND, instantané
-- quiet.event_soon = true) ; les autres sont reportées comme avant. Seul changement de la fonction.
-- Correctifs de la contre-vérification (docs/audit-finition-4.md, 20/11), dans cette même migration (aucune n'est appliquée) :
--  T1 : à la réservation, un avis d'état au porteur dont l'état n'est plus celui annoncé est annulé (SUSPENDU pour
--      EVENT_SUSPENDED_HOLDER, PUBLIE pour EVENT_REACTIVATED_HOLDER) ; notif_cancel_on_status (recopie de
--      20261109000009_lot9bis_messages.sql:941) annule aussi ces lignes en attente au changement d'état ;
--  T2 : la règle des 12 heures envoie tout de suite ; en plus, à la réservation, un avis d'état dont l'événement est terminé
--      (statut TERMINE ou fin passée) est annulé (motif EVENT_TERMINE).
-- Droits inchangés (CREATE OR REPLACE). Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notif_event_soon(p_event uuid, p_data jsonb, p_now timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.events e
         WHERE e.id IN (
                   SELECT p_event WHERE p_event IS NOT NULL
                   UNION
                   SELECT public.try_uuid(x->>'event_id')
                     FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_data->'events') = 'array' THEN p_data->'events' ELSE '[]'::jsonb END) AS x)
           AND e.status::text <> 'ANNULE'
           AND public.event_start_at(e.id) <= p_now + interval '12 hours'
           AND p_now < public.event_end_at(e.id))
$$;
REVOKE ALL ON FUNCTION public.notif_event_soon(uuid, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notif_event_soon(uuid, jsonb, timestamptz) TO service_role;

-- Recopie : 20261125000002_f4_nuit.sql:26
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

-- Recopie : 20261109000009_lot9bis_messages.sql:941 (contre-vérification, T1)
CREATE OR REPLACE FUNCTION public.notif_cancel_on_status()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Contre-vérification de la finition 4 (T1) : le déclencheur réagit aussi à PUBLIE (reprise) ; les rappels ne sont
    -- annulés que pour les statuts d'origine (SUSPENDU, ANNULE, TERMINE), jamais à une publication
    IF NEW.new_status::text IN ('SUSPENDU', 'ANNULE', 'TERMINE') THEN
    UPDATE public.notification_outbox
       SET status = 'CANCELLED', reason = 'EVENT_' || NEW.new_status::text, finished_at = now()
     WHERE event_id = NEW.event_id
       AND status = 'PENDING'
       AND type IN ('REMINDER_J1', 'REMINDER_H3', 'CONTROLLER_REMINDER');
    END IF;
    -- Contre-vérification de la finition 4 (T1) : un avis d'état au porteur en attente qui n'est plus vrai est annulé (suspendu
    -- puis repris, annulé ou terminé ; repris puis suspendu de nouveau, annulé ou terminé)
    UPDATE public.notification_outbox
       SET status = 'CANCELLED', reason = 'NO_LONGER_RELEVANT', finished_at = now()
     WHERE event_id = NEW.event_id
       AND status = 'PENDING'
       AND ((type = 'EVENT_SUSPENDED_HOLDER' AND NEW.new_status::text <> 'SUSPENDU')
            OR (type = 'EVENT_REACTIVATED_HOLDER' AND NEW.new_status::text <> 'PUBLIE'));
    IF NEW.new_status::text IN ('ANNULE', 'TERMINE') THEN
        UPDATE public.notification_outbox
           SET status = 'CANCELLED', reason = 'NO_LONGER_RELEVANT', finished_at = now()
         WHERE event_id = NEW.event_id
           AND status = 'PENDING'
           AND type IN ('EVENT_CHANGED', 'CONTROLLER_EVENT_CHANGED');
    END IF;
    RETURN NEW;
END;
$$;

-- Contre-vérification de la finition 4 (T1) : le déclencheur réagit aussi à la reprise (PUBLIE) pour annuler un avis
-- « suspendu » encore en attente ; même table, même fonction (20261103000004_lot6_rappels.sql:239)
DROP TRIGGER IF EXISTS trg_notif_cancel_on_status ON public.event_status_history;
CREATE TRIGGER trg_notif_cancel_on_status
    AFTER INSERT ON public.event_status_history
    FOR EACH ROW
    WHEN (NEW.new_status::text IN ('SUSPENDU', 'ANNULE', 'TERMINE', 'PUBLIE'))
    EXECUTE FUNCTION public.notif_cancel_on_status();
