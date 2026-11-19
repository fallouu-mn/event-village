-- ============================================================================
-- EVENT VILLAGE — FINITION 4, 2/5 : la nuit (heure de Dakar), rappels à moins de 30 minutes, « complet » fusionné
-- ============================================================================
-- Décision du client (19/11, point 1) : plage de nuit par défaut 01:00 → 07:00 (réglage notif.sms_quiet_start / _end, valeur
-- posée par la migration 1/5). Un message non urgent préparé la nuit est REPORTÉ à la fin de la plage (plus jamais « non
-- envoyé »), sans consommer le budget des SMS facultatifs ; le push facultatif aussi ; l'urgent part tout de suite. Le SMS
-- des admins (D1) suit ce réglage. Pas de rappel à moins de 30 minutes du début.
--
-- notification_outbox_claim (recopie de 20261123000002_main414_nuit_sms_admins.sql:60, dernière définition de main) :
--  a. une ligne SMS ou PUSH d'un type « non urgent » (notification_types.night_policy = 'DEFER', toute la famille OPTIONAL,
--     ADMIN_REVIEW_SMS compris) réservée pendant la plage est reportée à sa fin : décision DEFER (motif NIGHT), due_at et
--     next_attempt_at = fin de la plage, toujours en attente, aucune tentative ni aucun budget consommé ; à la fin de la plage
--     toutes les revérifications s'appliquent (rappel annulé si l'événement a commencé, plus de billet valable…). Remplace
--     l'issue SKIP QUIET_HOURS des SMS facultatifs et le cas ADMIN_NIGHT du correctif main-414 ;
--  b. rappels (REMINDER_J1, REMINDER_H3, CONTROLLER_REMINDER) : annulés à moins de 30 minutes du début (motif
--     TOO_CLOSE_TO_START ; EVENT_STARTED une fois commencé) ;
--  c. CATEGORY_SOLD_OUT encore en attente quand l'événement entier est complet (EVENT_SOLD_OUT mis en file pour le même
--     destinataire et le même événement) : annulée, « Remplacée par une notification plus récente » (SUPERSEDED) ;
--  d. ENTRY_THANKS (merci du lendemain) : annulé si l'événement est annulé ou supprimé (NO_LONGER_RELEVANT).
-- notification_reminders_schedule (recopie de 20261105000002_lot7_sms.sql:532) : la prévision du budget compte les rappels
-- reportés à la fin de la nuit (plus d'exclusion par la plage) ; un rappel du jour même reporté à moins de 30 minutes du
-- début n'est pas compté.
-- Droits inchangés (CREATE OR REPLACE). Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

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
                IF v_in_quiet THEN
                    v_outcome := 'DEFER'; v_reason := 'NIGHT';
                    v_quiet := v_quiet || jsonb_build_object('until', public.notif_quiet_end_at(v_now, v_qs, v_qe));
                END IF;
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


CREATE OR REPLACE FUNCTION public.notification_reminders_schedule(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tolerance  constant interval := interval '15 minutes';
    v_now        timestamptz;
    v_only       uuid[];
    v_key        text;
    v_j1_on      boolean;
    v_j1_hour    integer;
    v_h3_on      boolean;
    v_h3_hours   integer;
    v_j1_sms     text;
    v_h3_sms     text;
    v_cap        integer;
    v_free       text;
    v_free_only  boolean;
    e            record;
    h            record;
    c            record;
    v_start      timestamptz;
    v_start_key  text;
    v_due        timestamptz;
    v_base       jsonb;
    v_open       boolean;
    n_j1         integer := 0;
    n_h3         integer := 0;
    n_ctrl       integer := 0;
    n_events     integer := 0;
    v_tomorrow   date;
    v_tom_txt    text;
    v_qs         integer;
    v_qe         integer;
    v_fc_j1      boolean;
    v_fc_ctrl    boolean;
    v_planned    integer;
    v_remaining  integer;
    v_prefix     text;
    v_first      uuid;
    v_n          integer;
    v_fc_alerted boolean := false;
    v_forecast   jsonb;
BEGIN
    -- Horloge : celle de l'appelant (tests, fumée) ou celle de la base ; jamais dans le passé.
    IF NULLIF(btrim(COALESCE(p->>'now', '')), '') IS NULL THEN
        v_now := now();
    ELSE
        v_now := public.notif_try_timestamptz(p->>'now');
        IF v_now IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_NOW', 'message', 'Horloge illisible.');
        END IF;
    END IF;
    IF v_now < now() - interval '1 minute' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_NOW',
            'message', 'Horloge refusée : une heure dans le passé n''est jamais acceptée.');
    END IF;
    IF jsonb_typeof(p->'only_event_ids') = 'array' THEN
        v_only := ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(p->'only_event_ids') AS x);
    END IF;

    -- Réglages : fin_setting lève si la clé manque (message qui nomme la clé) ; une valeur écrite hors
    -- bornes par le service_role lève aussi (jamais de défaut caché, décision 25). Lot 7 : budget des SMS
    -- optionnels et politique des billets gratuits.
    FOREACH v_key IN ARRAY ARRAY['notif.reminder_j1_enabled', 'notif.reminder_j1_hour', 'notif.reminder_h3_enabled',
                                 'notif.reminder_h3_hours', 'notif.j1_sms', 'notif.h3_sms',
                                 'notif.sms_optional_daily_cap', 'notif.free_ticket_reminder_sms'] LOOP
        IF NOT public.fin_setting_valid(v_key, public.fin_setting(v_key)) THEN
            RAISE EXCEPTION USING ERRCODE = 'NT010',
                MESSAGE = format('Réglage %s invalide : planification des rappels impossible.', v_key);
        END IF;
    END LOOP;
    v_j1_on    := public.fin_setting_bool('notif.reminder_j1_enabled');
    v_j1_hour  := public.fin_setting_num('notif.reminder_j1_hour')::integer;
    v_h3_on    := public.fin_setting_bool('notif.reminder_h3_enabled');
    v_h3_hours := public.fin_setting_num('notif.reminder_h3_hours')::integer;
    v_j1_sms   := public.fin_setting_text('notif.j1_sms');
    v_h3_sms   := public.fin_setting_text('notif.h3_sms');
    v_cap      := public.fin_setting_num('notif.sms_optional_daily_cap')::integer;
    v_free     := public.fin_setting_text('notif.free_ticket_reminder_sms');

    -- Événements candidats : PUBLIE, début futur, au plus le lendemain (heure de Dakar) : toute échéance
    -- (veille à l'heure réglée, veille à 18:00, début moins 12 h au plus) tombe au plus tard aujourd'hui.
    FOR e IN
        SELECT ev.id, ev.title, ev.location, ev.city, ev.start_date,
               ((ev.start_date + ev.start_time) AT TIME ZONE 'Africa/Dakar') AS start_at
          FROM public.events ev
         WHERE ev.status::text = 'PUBLIE'
           AND ev.start_date IS NOT NULL AND ev.start_time IS NOT NULL
           AND ev.start_date <= (v_now AT TIME ZONE 'Africa/Dakar')::date + 1
           AND ((ev.start_date + ev.start_time) AT TIME ZONE 'Africa/Dakar') > v_now
           AND (v_only IS NULL OR ev.id = ANY (v_only))
         ORDER BY ev.start_date, ev.id
    LOOP
        v_start := e.start_at;
        v_start_key := to_char(v_start AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MI"Z"');
        v_base := jsonb_build_object('event_id', e.id, 'title', e.title, 'start_at', v_start,
                                     'location', e.location, 'city', e.city);
        v_open := false;

        -- J-1 : la veille du début, à l'heure réglée.
        IF v_j1_on THEN
            v_due := ((e.start_date - 1) + make_time(v_j1_hour, 0, 0)) AT TIME ZONE 'Africa/Dakar';
            IF v_due <= v_now AND v_now < v_due + v_tolerance THEN
                v_open := true;
                FOR h IN
                    SELECT DISTINCT t.user_id
                      FROM public.tickets t
                     WHERE t.event_id = e.id AND t.status::text = 'VALIDE' AND t.user_id IS NOT NULL
                       AND t.created_at <= v_due
                       AND NOT EXISTS (SELECT 1 FROM public.ticket_transfers x
                                        WHERE x.ticket_id = t.id AND x.status::text = 'CLAIMED'
                                          AND x.to_user_id = t.user_id AND x.claimed_at > v_due)
                     ORDER BY t.user_id
                LOOP
                    -- Lot 7 (7.0 b, D17) : porteur qui ne détient, pour l'événement, que des billets gratuits.
                    v_free_only := NOT EXISTS (
                        SELECT 1 FROM public.tickets t
                         WHERE t.event_id = e.id AND t.user_id = h.user_id AND t.status::text = 'VALIDE'
                           AND NOT ((t.price = 0 OR t.sale_channel IN ('FREE', 'INVITATION')) IS TRUE));
                    n_j1 := n_j1 + public.notif_enqueue(jsonb_build_object(
                        'type', 'REMINDER_J1',
                        'key', 'REMINDER_J1:' || e.id || ':' || h.user_id || ':' || v_start_key,
                        'user_id', h.user_id,
                        'event_id', e.id,
                        'due_at', v_due,
                        'data', v_base || jsonb_build_object('sms_policy', v_j1_sms, 'free_only', v_free_only),
                        'skip', CASE WHEN v_j1_sms = 'NEVER' THEN jsonb_build_object('SMS', 'SMS_POLICY_NEVER')
                                     WHEN v_free = 'NEVER' AND v_free_only THEN jsonb_build_object('SMS', 'FREE_TICKETS_ONLY') END,
                        'now', v_now));
                END LOOP;
            END IF;
        END IF;

        -- H-3 : au début moins le nombre d'heures réglé.
        IF v_h3_on THEN
            v_due := v_start - make_interval(hours => v_h3_hours);
            IF v_due <= v_now AND v_now < v_due + v_tolerance THEN
                v_open := true;
                FOR h IN
                    SELECT DISTINCT t.user_id
                      FROM public.tickets t
                     WHERE t.event_id = e.id AND t.status::text = 'VALIDE' AND t.user_id IS NOT NULL
                       AND t.created_at <= v_due
                       AND NOT EXISTS (SELECT 1 FROM public.ticket_transfers x
                                        WHERE x.ticket_id = t.id AND x.status::text = 'CLAIMED'
                                          AND x.to_user_id = t.user_id AND x.claimed_at > v_due)
                     ORDER BY t.user_id
                LOOP
                    -- Lot 7 (7.0 b, D17) : même règle que le J-1.
                    v_free_only := NOT EXISTS (
                        SELECT 1 FROM public.tickets t
                         WHERE t.event_id = e.id AND t.user_id = h.user_id AND t.status::text = 'VALIDE'
                           AND NOT ((t.price = 0 OR t.sale_channel IN ('FREE', 'INVITATION')) IS TRUE));
                    n_h3 := n_h3 + public.notif_enqueue(jsonb_build_object(
                        'type', 'REMINDER_H3',
                        'key', 'REMINDER_H3:' || e.id || ':' || h.user_id || ':' || v_start_key,
                        'user_id', h.user_id,
                        'event_id', e.id,
                        'due_at', v_due,
                        'data', v_base || jsonb_build_object('sms_policy', v_h3_sms, 'free_only', v_free_only),
                        'skip', CASE WHEN v_h3_sms = 'NEVER' THEN jsonb_build_object('SMS', 'SMS_POLICY_NEVER')
                                     WHEN v_free = 'NEVER' AND v_free_only THEN jsonb_build_object('SMS', 'FREE_TICKETS_ONLY') END,
                        'now', v_now));
                END LOOP;
            END IF;
        END IF;

        -- Rappel du contrôleur : la veille du début à 18:00, une ligne par affectation existante à
        -- l'échéance ; point d'entrée et permission espèces lus maintenant.
        v_due := ((e.start_date - 1) + time '18:00') AT TIME ZONE 'Africa/Dakar';
        IF v_due <= v_now AND v_now < v_due + v_tolerance THEN
            v_open := true;
            FOR c IN
                SELECT ec.id, ec.user_id, ec.entry_point, ec.can_accept_cash
                  FROM public.event_controllers ec
                 WHERE ec.event_id = e.id AND ec.created_at <= v_due
                 ORDER BY ec.user_id
            LOOP
                n_ctrl := n_ctrl + public.notif_enqueue(jsonb_build_object(
                    'type', 'CONTROLLER_REMINDER',
                    'key', 'CONTROLLER_REMINDER:' || e.id || ':' || c.user_id || ':' || v_start_key,
                    'user_id', c.user_id,
                    'event_id', e.id,
                    'due_at', v_due,
                    'data', jsonb_build_object(
                        'assignment_id', c.id, 'event_id', e.id, 'title', e.title, 'start_at', v_start,
                        'location', e.location, 'entry_point', NULLIF(btrim(COALESCE(c.entry_point, '')), ''),
                        'can_accept_cash', COALESCE(c.can_accept_cash, false)),
                    'now', v_now));
            END LOOP;
        END IF;

        IF v_open THEN
            n_events := n_events + 1;
        END IF;
    END LOOP;

    -- Lot 7 (7.0 a, D16) : prévision des SMS de rappel du lendemain contre le budget optionnel restant.
    v_tomorrow := (v_now AT TIME ZONE 'Africa/Dakar')::date + 1;
    v_tom_txt := to_char(v_tomorrow, 'YYYY-MM-DD');
    IF v_cap > 0 THEN
        v_qs := public.notif_setting_int('notif.sms_quiet_start');
        v_qe := public.notif_setting_int('notif.sms_quiet_end');
        -- J-1 dus demain (événements du surlendemain), à l'heure réglée. Finition 4 : un rappel dû pendant la plage de nuit
        -- est reporté à sa fin, le même jour (plus jamais perdu) : il est compté.
        v_fc_j1 := v_j1_on AND v_j1_sms <> 'NEVER';
        -- Rappels du contrôleur dus demain à 18:00 (même règle que la planification), reportés comme les autres la nuit.
        v_fc_ctrl := true;

        WITH holders AS (
            SELECT DISTINCT ev.id AS event_id, t.user_id
              FROM public.events ev
              JOIN public.tickets t ON t.event_id = ev.id
             WHERE v_fc_j1
               AND ev.status::text = 'PUBLIE'
               AND ev.start_time IS NOT NULL
               AND ev.start_date = v_tomorrow + 1
               AND (v_only IS NULL OR ev.id = ANY (v_only))
               AND t.status::text = 'VALIDE' AND t.user_id IS NOT NULL
            UNION ALL
            SELECT DISTINCT ev.id AS event_id, t.user_id
              FROM public.events ev
              JOIN public.tickets t ON t.event_id = ev.id
             WHERE v_h3_on AND v_h3_sms <> 'NEVER'
               AND ev.status::text = 'PUBLIE'
               AND ev.start_time IS NOT NULL
               AND ev.start_date BETWEEN v_tomorrow AND v_tomorrow + 1
               -- Finition 4 : échéance reportée à la fin de la plage de nuit si elle y tombe ; comptée le jour où elle part,
               -- seulement si elle part plus de 30 minutes avant le début (sinon le rappel est annulé)
               AND (public.notif_quiet_end_at(((ev.start_date + ev.start_time) AT TIME ZONE 'Africa/Dakar') - make_interval(hours => v_h3_hours),
                                              v_qs, v_qe) AT TIME ZONE 'Africa/Dakar')::date = v_tomorrow
               AND public.notif_quiet_end_at(((ev.start_date + ev.start_time) AT TIME ZONE 'Africa/Dakar') - make_interval(hours => v_h3_hours),
                                             v_qs, v_qe) < ((ev.start_date + ev.start_time) AT TIME ZONE 'Africa/Dakar') - interval '30 minutes'
               AND (v_only IS NULL OR ev.id = ANY (v_only))
               AND t.status::text = 'VALIDE' AND t.user_id IS NOT NULL
        ), controllers AS (
            SELECT ec.id, ec.user_id
              FROM public.event_controllers ec
              JOIN public.events ev ON ev.id = ec.event_id
             WHERE v_fc_ctrl
               AND ev.status::text = 'PUBLIE'
               AND ev.start_time IS NOT NULL
               AND ev.start_date = v_tomorrow + 1
               AND (v_only IS NULL OR ev.id = ANY (v_only))
        )
        SELECT (SELECT count(*)
                  FROM holders hd
                  JOIN public.users u ON u.id = hd.user_id
                 WHERE NULLIF(btrim(COALESCE(u.phone, '')), '') IS NOT NULL
                   AND NOT public.notif_account_blocked(u.id)
                   AND public.notif_preference_enabled(u.id, 'REMINDERS', 'SMS')
                   AND NOT (v_free = 'NEVER' AND NOT EXISTS (
                        SELECT 1 FROM public.tickets t
                         WHERE t.event_id = hd.event_id AND t.user_id = hd.user_id AND t.status::text = 'VALIDE'
                           AND NOT ((t.price = 0 OR t.sale_channel IN ('FREE', 'INVITATION')) IS TRUE))))
             + (SELECT count(*)
                  FROM controllers ct
                  JOIN public.users u ON u.id = ct.user_id
                 WHERE NULLIF(btrim(COALESCE(u.phone, '')), '') IS NOT NULL
                   AND NOT public.notif_account_blocked(u.id)
                   AND public.notif_preference_enabled(u.id, 'REMINDERS', 'SMS'))
          INTO v_planned;

        v_remaining := GREATEST(v_cap - public.notif_sms_optional_used(v_tomorrow), 0);
        IF v_planned > v_remaining THEN
            PERFORM pg_advisory_xact_lock(hashtext('notif.sms_forecast:' || v_tom_txt));
            v_prefix := 'ADMIN_SMS_FORECAST:' || v_tom_txt || ':';
            IF NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                            WHERE o.type = 'ADMIN_SMS_FORECAST'
                              AND left(o.idempotency_key, length(v_prefix)) = v_prefix) THEN
                v_n := public.notif_enqueue_admins(jsonb_build_object(
                    'type', 'ADMIN_SMS_FORECAST', 'ref', v_tom_txt,
                    'data', jsonb_build_object('day', v_tom_txt, 'planned', v_planned, 'cap', v_cap, 'remaining', v_remaining),
                    'now', v_now));
                IF v_n > 0 THEN
                    SELECT o.id INTO v_first
                      FROM public.notification_outbox o
                     WHERE o.type = 'ADMIN_SMS_FORECAST' AND left(o.idempotency_key, length(v_prefix)) = v_prefix
                     ORDER BY o.created_at, o.id LIMIT 1;
                    INSERT INTO public.admin_signals (kind, ref_id) VALUES ('SMS_FORECAST', v_first) ON CONFLICT DO NOTHING;
                    v_fc_alerted := true;
                END IF;
            END IF;
        END IF;
        v_forecast := jsonb_build_object('day', v_tom_txt, 'planned', v_planned, 'cap', v_cap,
                                         'remaining', v_remaining, 'alerted', v_fc_alerted);
    ELSE
        -- Plafond 0 : l'administrateur a coupé les SMS optionnels ; aucune prévision ni alerte (D15).
        v_forecast := jsonb_build_object('day', v_tom_txt, 'planned', NULL, 'cap', v_cap,
                                         'remaining', 0, 'alerted', false);
    END IF;

    RETURN jsonb_build_object(
        'ok', true, 'now', v_now,
        'created', jsonb_build_object('REMINDER_J1', n_j1, 'REMINDER_H3', n_h3, 'CONTROLLER_REMINDER', n_ctrl),
        'events', n_events,
        'forecast', v_forecast);
END;
$$;
