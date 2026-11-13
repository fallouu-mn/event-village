-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUATER : adresse email en attente (A9 ; AUD-34)
-- ============================================================================
-- AUD-34 : quand un compte valide une adresse, les autres comptes qui l'attendaient la perdaient sans le savoir
--   (20261109000010_lot9bis_email.sql:1038-1040) : une victime qui clique un lien qu'elle n'a pas demandé rattachait
--   son adresse au compte d'un tiers et perdait sa propre attente. Désormais l'attente des autres comptes reste ; elle
--   n'est retirée qu'à la confirmation par son titulaire (son lien répond EMAIL_TAKEN, retrait existant) ; chaque
--   titulaire est prévenu (type EMAIL_CLAIMED_ELSEWHERE : cloche, SMS et email vérifié, ESSENTIAL, sans l'adresse).
-- A4 (AUD-19) : les adresses techniques des comptes à numéro passent sous le domaine réservé .invalid (migration
--   20261111000001). Les fonctions qui les reconnaissaient par le seul domaine eventvillage.sn (aucun email envoyé ni
--   vérifié vers une adresse technique) sont recopiées avec le motif étendu à .invalid : notif_verified_email,
--   notif_enqueue, notification_outbox_claim, email_verification_issue, email_verification_log (fin de fichier).
-- Objets : registre EMAIL_CLAIMED_ELSEWHERE ; recopie email_verification_finalize
--   (20261109000010_lot9bis_email.sql:965-1049), changement indiqué au-dessus du bloc remplacé. Droits inchangés
--   (CREATE OR REPLACE ; service_role seul, 20261109000010:1049-1064).
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('EMAIL_CLAIMED_ELSEWHERE',    'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL'],         'ANY',        'BLOCK', FALSE, NULL)
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;


-- ----------------------------------------------------------------------------
-- email_verification_finalize (recopie de 20261109000010_lot9bis_email.sql:965-1049)
-- Changement : l'attente de la même adresse sur d'autres comptes n'est plus retirée ni ses liens fermés ; avis
-- EMAIL_CLAIMED_ELSEWHERE à chacun de ces comptes.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_verification_finalize(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hash     text := lower(btrim(COALESCE(p->>'token_hash', '')));
    v_expected text := p->>'expected_email';
    v_user     uuid;
    v_target   text;
    v_link     record;
    v_email    text;
    v_pending  text;
    v_verified timestamptz;
    v_role     text;
    v_now      timestamptz;
BEGIN
    IF v_hash !~ '^[0-9a-f]{64}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_LINK_INVALID');
    END IF;
    SELECT l.user_id, l.email INTO v_user, v_target FROM public.email_verifications l WHERE l.token_hash = v_hash;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_LINK_INVALID');
    END IF;

    -- Comptes d'abord, dans un seul ordre : deux validations de la même adresse se suivent, sans interblocage.
    PERFORM 1 FROM public.users u
      WHERE u.id = v_user OR u.email_pending = v_target
      ORDER BY u.id
        FOR UPDATE;
    SELECT l.id, l.used_at, l.superseded_at, l.expires_at INTO v_link
      FROM public.email_verifications l WHERE l.token_hash = v_hash
       FOR UPDATE;
    v_now := clock_timestamp();
    SELECT u.email, u.email_pending, u.email_verified_at, u.role::text INTO v_email, v_pending, v_verified, v_role
      FROM public.users u WHERE u.id = v_user;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_LINK_INVALID');
    END IF;

    IF v_link.used_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_LINK_USED');
    END IF;
    IF EXISTS (SELECT 1 FROM public.users o WHERE o.id <> v_user AND lower(o.email) = v_target) THEN
        UPDATE public.users SET email_pending = NULL WHERE id = v_user AND email_pending = v_target;
        UPDATE public.email_verifications SET superseded_at = v_now WHERE id = v_link.id AND superseded_at IS NULL;
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_TAKEN');
    END IF;
    IF v_link.superseded_at IS NOT NULL
       OR NOT (v_pending = v_target
               OR (v_pending IS NULL AND v_verified IS NULL AND lower(COALESCE(v_email, '')) = v_target)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_LINK_INVALID');
    END IF;
    IF v_link.expires_at <= v_now THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_LINK_EXPIRED');
    END IF;
    IF v_email IS DISTINCT FROM v_expected THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_CONFLICT');
    END IF;

    UPDATE public.users
       SET email = v_target, email_verified_at = v_now, email_pending = NULL
     WHERE id = v_user;
    UPDATE public.email_verifications SET used_at = v_now WHERE id = v_link.id;
    UPDATE public.email_verifications
       SET superseded_at = v_now
     WHERE user_id = v_user AND id <> v_link.id AND used_at IS NULL AND superseded_at IS NULL;
    -- Lot 9 quater (A9 : AUD-34) : la même adresse en attente sur d'autres comptes (tenus plus haut) n'est PAS retirée
    -- ici : elle ne l'est qu'à la confirmation par leur titulaire (son lien répond alors EMAIL_TAKEN et retire
    -- l'attente). Chaque titulaire est prévenu (EMAIL_CLAIMED_ELSEWHERE, cloche et SMS, sans l'adresse).
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'EMAIL_CLAIMED_ELSEWHERE',
        'key', 'EMAIL_CLAIMED_ELSEWHERE:' || o.id::text || ':' || v_link.id::text,
        'user_id', o.id,
        'data', '{}'::jsonb))
      FROM public.users o
     WHERE o.id <> v_user AND o.email_pending = v_target;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_user, v_role, 'ACCOUNT_EMAIL_VERIFIED', 'users', v_user, jsonb_build_object('verification_id', v_link.id));

    RETURN jsonb_build_object('ok', true, 'user_id', v_user);
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_TAKEN');
END;
$$;


-- Recopies : adresse technique .invalid (lot 9 quater, A4)

-- ----------------------------------------------------------------------------
-- Recopie : notif_verified_email (20261109000010_lot9bis_email.sql:100-122). Seul changement : l'adresse technique est
-- reconnue aussi sous le domaine réservé .invalid (1 motif(s)) ; droits inchangés (CREATE OR REPLACE).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_verified_email(p_user uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email text;
BEGIN
    IF p_user IS NULL THEN
        RETURN NULL;
    END IF;
    SELECT u.email INTO v_email
      FROM public.users u
     WHERE u.id = p_user
       AND u.email_verified_at IS NOT NULL
       AND u.email IS NOT NULL
       AND position('@' IN u.email) > 1
       AND u.email !~* '@(([a-z0-9-]+\.)*eventvillage\.sn|([a-z0-9-]+\.)*invalid)$';
    RETURN v_email;
END;
$$;


-- ----------------------------------------------------------------------------
-- Recopie : notif_enqueue (20261109000010_lot9bis_email.sql:136-269). Seul changement : l'adresse technique est
-- reconnue aussi sous le domaine réservé .invalid (1 motif(s)) ; droits inchangés (CREATE OR REPLACE).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_enqueue(p jsonb)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type      text := p->>'type';
    v_key       text := NULLIF(btrim(COALESCE(p->>'key', '')), '');
    v_family    text;
    v_topic     text;
    v_channels  text[];
    v_policy    text;
    v_sync      boolean;
    v_now       timestamptz;
    v_due       timestamptz;
    v_user      uuid := NULLIF(p->>'user_id', '')::uuid;
    v_phone     text := NULLIF(btrim(COALESCE(p->>'phone', '')), '');
    v_email     text := NULLIF(btrim(COALESCE(p->>'email', '')), '');
    v_event     uuid := NULLIF(p->>'event_id', '')::uuid;
    v_actor     uuid := NULLIF(p->>'actor_id', '')::uuid;
    v_shift     uuid := NULLIF(p->>'shift_id', '')::uuid;
    v_data      jsonb := COALESCE(p->'data', '{}'::jsonb);
    v_wanted    text[];
    v_ustatus   text;
    v_uphone    text;
    v_uemail    text;
    v_vemail    text;
    v_everified boolean;
    v_blocked   boolean := false;
    v_ch        text;
    v_status    text;
    v_reason    text;
    v_pref      boolean;
    v_decision  jsonb;
    v_mail      text;
    v_n         integer;
    v_created   integer := 0;
BEGIN
    SELECT t.family, t.topic, t.channels, t.suspended_policy, t.sync_only
      INTO v_family, v_topic, v_channels, v_policy, v_sync
      FROM public.notification_types t WHERE t.type = v_type;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'NT001', MESSAGE = format('Type de notification inconnu : %s.', COALESCE(v_type, '(vide)'));
    END IF;
    IF v_sync THEN
        RAISE EXCEPTION USING ERRCODE = 'NT002',
            MESSAGE = format('Le type %s est un envoi synchrone : il se journalise par notification_sync_log.', v_type);
    END IF;
    v_now := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    IF v_now < now() - interval '1 minute' THEN
        RAISE EXCEPTION USING ERRCODE = 'NT003', MESSAGE = 'Horloge refusée : une heure dans le passé n''est jamais acceptée.';
    END IF;
    IF v_key IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'NT004', MESSAGE = 'Clé de notification absente.';
    END IF;
    IF v_user IS NULL AND v_phone IS NULL AND v_email IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'NT004', MESSAGE = 'Destinataire de la notification absent.';
    END IF;
    v_due := COALESCE(NULLIF(p->>'due_at', '')::timestamptz, v_now);

    IF jsonb_typeof(p->'channels') = 'array' THEN
        v_wanted := ARRAY(SELECT jsonb_array_elements_text(p->'channels'));
    END IF;

    IF v_user IS NOT NULL THEN
        SELECT u.status::text, u.phone, u.email INTO v_ustatus, v_uphone, v_uemail FROM public.users u WHERE u.id = v_user;
        v_blocked := public.notif_account_blocked(v_user);
        -- Lot 9 bis (R87, B96) : seule l'adresse vérifiée du compte reçoit un email.
        v_vemail := public.notif_verified_email(v_user);
    END IF;

    FOREACH v_ch IN ARRAY v_channels LOOP
        CONTINUE WHEN v_wanted IS NOT NULL AND NOT (v_ch = ANY (v_wanted));
        CONTINUE WHEN v_ch IN ('IN_APP', 'PUSH') AND v_user IS NULL;

        v_status := 'PENDING';
        v_reason := NULL;
        v_pref := NULL;
        IF v_family = 'OPTIONAL' AND v_user IS NOT NULL THEN
            v_pref := public.notif_preference_enabled(v_user, v_topic, v_ch);
        END IF;
        v_mail := COALESCE(v_email, v_uemail);
        v_everified := v_mail IS NOT NULL AND v_vemail IS NOT NULL AND lower(v_mail) = lower(v_vemail);

        IF jsonb_typeof(p->'skip') = 'object' AND NULLIF(btrim(COALESCE(p->'skip'->>v_ch, '')), '') IS NOT NULL THEN
            v_status := 'SKIPPED';
            v_reason := btrim(p->'skip'->>v_ch);
        ELSIF v_blocked AND v_policy = 'BLOCK' THEN
            v_status := 'SKIPPED';
            v_reason := 'ACCOUNT_SUSPENDED';
        ELSIF v_family = 'OPTIONAL' AND v_pref IS FALSE THEN
            v_status := 'SKIPPED';
            v_reason := 'PREFERENCE_DISABLED';
        ELSIF v_ch = 'SMS' AND v_phone IS NULL AND (v_uphone IS NULL OR btrim(v_uphone) = '') THEN
            v_status := 'SKIPPED';
            v_reason := 'NO_PHONE';
        ELSIF v_ch = 'EMAIL' AND (v_mail IS NULL OR position('@' IN v_mail) <= 1 OR v_mail ~* '@(([a-z0-9-]+\.)*eventvillage\.sn|([a-z0-9-]+\.)*invalid)$') THEN
            v_status := 'SKIPPED';
            v_reason := 'NO_REAL_EMAIL';
        ELSIF v_ch = 'EMAIL' AND NOT v_everified THEN
            v_status := 'SKIPPED';
            v_reason := 'EMAIL_NOT_VERIFIED';
        END IF;

        v_decision := NULL;
        IF v_status = 'SKIPPED' THEN
            v_decision := jsonb_strip_nulls(jsonb_build_object(
                'at', v_now, 'stage', 'ENQUEUE', 'outcome', 'SKIP', 'reason', v_reason,
                'family', v_family, 'topic', v_topic,
                'account', CASE WHEN v_user IS NULL THEN NULL ELSE jsonb_build_object('status', v_ustatus, 'blocked', v_blocked) END,
                'preference', CASE WHEN v_family = 'OPTIONAL' THEN jsonb_build_object('topic', v_topic, 'channel', v_ch, 'enabled', COALESCE(v_pref, TRUE)) END,
                'email', CASE WHEN v_ch = 'EMAIL' THEN jsonb_build_object('verified', v_everified) END
            ));
        END IF;

        INSERT INTO public.notification_outbox (
            idempotency_key, group_key, type, family, topic, channel, origin,
            recipient_user_id, recipient_phone, recipient_email, event_id, actor_id, shift_id,
            template_data, status, reason, attempts, max_attempts, due_at, next_attempt_at, finished_at, decision
        ) VALUES (
            v_key || ':' || v_ch, v_key, v_type, v_family, v_topic, v_ch, 'OUTBOX',
            v_user, v_phone, v_email, v_event, v_actor, v_shift,
            v_data, v_status, v_reason, 0, 5, v_due, v_due,
            CASE WHEN v_status = 'SKIPPED' THEN v_now END, v_decision
        )
        ON CONFLICT DO NOTHING;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_created := v_created + v_n;
    END LOOP;
    RETURN v_created;
END;
$$;


-- ----------------------------------------------------------------------------
-- Recopie : notification_outbox_claim (20261109000010_lot9bis_email.sql:276-639). Seul changement : l'adresse technique est
-- reconnue aussi sous le domaine réservé .invalid (1 motif(s)) ; droits inchangés (CREATE OR REPLACE).
-- ----------------------------------------------------------------------------
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
               o.template_data, o.attempts, o.max_attempts, o.due_at, t.suspended_policy
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
        END IF;

        IF v_outcome = 'SEND' AND r.channel = 'SMS' THEN
            IF v_phone IS NULL THEN
                v_outcome := 'SKIP'; v_reason := 'NO_PHONE';
            ELSIF r.family = 'OPTIONAL' THEN
                v_qs := public.notif_setting_int('notif.sms_quiet_start');
                v_qe := public.notif_setting_int('notif.sms_quiet_end');
                IF v_qs IS NULL OR v_qe IS NULL THEN
                    v_outcome := 'SKIP'; v_reason := 'SETTING_MISSING';
                ELSE
                    v_in_quiet := public.notif_in_quiet_hours(v_now, v_qs, v_qe);
                    v_quiet := jsonb_build_object('start', v_qs, 'end', v_qe,
                        'hour', extract(hour FROM (v_now AT TIME ZONE 'Africa/Dakar'))::integer, 'in_quiet', v_in_quiet);
                    IF v_in_quiet THEN
                        v_outcome := 'SKIP'; v_reason := 'QUIET_HOURS';
                    END IF;
                END IF;
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


-- ----------------------------------------------------------------------------
-- Recopie : email_verification_issue (20261109000010_lot9bis_email.sql:748-823). Seul changement : l'adresse technique est
-- reconnue aussi sous le domaine réservé .invalid (1 motif(s)) ; droits inchangés (CREATE OR REPLACE).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_verification_issue(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user        uuid;
    v_hash        text := lower(btrim(COALESCE(p->>'token_hash', '')));
    v_account_max integer;
    v_address_max integer;
    v_email       text;
    v_pending     text;
    v_verified    timestamptz;
    v_target      text;
    v_quota       jsonb;
    v_id          uuid;
    v_expires     timestamptz;
BEGIN
    BEGIN
        v_user := NULLIF(p->>'user_id', '')::uuid;
        v_account_max := NULLIF(p->>'account_max', '')::integer;
        v_address_max := NULLIF(p->>'address_max', '')::integer;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande de lien illisible.');
    END;
    IF v_user IS NULL OR v_hash !~ '^[0-9a-f]{64}$'
       OR v_account_max IS NULL OR v_account_max < 1 OR v_address_max IS NULL OR v_address_max < 1 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande de lien incomplète.');
    END IF;

    SELECT u.email, u.email_pending, u.email_verified_at
      INTO v_email, v_pending, v_verified
      FROM public.users u WHERE u.id = v_user
       FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND');
    END IF;

    v_target := v_pending;
    IF v_target IS NULL AND v_verified IS NULL AND v_email IS NOT NULL AND position('@' IN v_email) > 1
       AND v_email !~* '@(([a-z0-9-]+\.)*eventvillage\.sn|([a-z0-9-]+\.)*invalid)$' THEN
        v_target := lower(btrim(v_email));
    END IF;
    IF v_target IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_EMAIL_TO_VERIFY');
    END IF;
    IF (public.account_identity_taken(v_user, v_target, NULL)->>'email_taken')::boolean THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_TAKEN');
    END IF;

    v_quota := public.quota_reserve(jsonb_build_array(
        jsonb_build_object('scope', 'email_verify_account', 'bucket', v_user::text,
                           'window_secs', 3600, 'max', v_account_max),
        jsonb_build_object('scope', 'email_verify_address', 'bucket', encode(sha256(convert_to(v_target, 'UTF8')), 'hex'),
                           'window_secs', 86400, 'max', v_address_max)
    ));
    IF (v_quota->>'allowed')::boolean IS NOT TRUE THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RATE_LIMITED',
            'retry_after_seconds', COALESCE(NULLIF(v_quota->>'retry_after_seconds', '')::integer, 3600));
    END IF;

    UPDATE public.email_verifications
       SET superseded_at = now()
     WHERE user_id = v_user AND used_at IS NULL AND superseded_at IS NULL;

    INSERT INTO public.email_verifications (user_id, email, token_hash, created_at, expires_at)
    VALUES (v_user, v_target, v_hash, now(), now() + interval '24 hours')
    RETURNING id, expires_at INTO v_id, v_expires;

    RETURN jsonb_build_object('ok', true, 'verification_id', v_id, 'email', v_target, 'expires_at', v_expires);
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Jeton déjà employé : tirez-en un autre.');
END;
$$;


-- ----------------------------------------------------------------------------
-- Recopie : email_verification_log (20261109000010_lot9bis_email.sql:829-904). Seul changement : l'adresse technique est
-- reconnue aussi sous le domaine réservé .invalid (1 motif(s)) ; droits inchangés (CREATE OR REPLACE).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_verification_log(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_link     uuid;
    v_user     uuid;
    v_outcome  text := p->>'outcome';
    v_reason   text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    v_email    text;
    v_pending  text;
    v_verified timestamptz;
    v_target   text;
    v_key      text;
    v_id       uuid;
    v_now      timestamptz := now();
BEGIN
    BEGIN
        v_link := NULLIF(p->>'verification_id', '')::uuid;
        v_user := NULLIF(p->>'user_id', '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Journal d''envoi illisible.');
    END;
    IF v_outcome IS NULL OR v_outcome NOT IN ('SENT', 'FAILED', 'SKIPPED')
       OR (v_outcome <> 'SENT' AND v_reason IS NULL)
       OR (v_link IS NULL AND v_user IS NULL) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Journal d''envoi incomplet.');
    END IF;

    IF v_link IS NOT NULL THEN
        SELECT l.user_id, l.email INTO v_user, v_target FROM public.email_verifications l WHERE l.id = v_link;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Lien inconnu.');
        END IF;
        v_key := 'EMAIL_VERIFICATION:' || v_link::text;
    ELSE
        SELECT u.email, u.email_pending, u.email_verified_at INTO v_email, v_pending, v_verified
          FROM public.users u WHERE u.id = v_user;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND');
        END IF;
        v_target := v_pending;
        IF v_target IS NULL AND v_verified IS NULL AND v_email IS NOT NULL AND position('@' IN v_email) > 1
           AND v_email !~* '@(([a-z0-9-]+\.)*eventvillage\.sn|([a-z0-9-]+\.)*invalid)$' THEN
            v_target := lower(btrim(v_email));
        END IF;
        IF v_target IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NO_EMAIL_TO_VERIFY');
        END IF;
        v_key := 'EMAIL_VERIFICATION:' || gen_random_uuid()::text;
    END IF;

    INSERT INTO public.notification_outbox (
        idempotency_key, group_key, type, family, topic, channel, origin,
        recipient_user_id, recipient_email, template_data, status, reason,
        attempts, max_attempts, due_at, next_attempt_at, sent_at, finished_at, provider_message_id, decision
    ) VALUES (
        v_key || ':EMAIL', v_key, 'EMAIL_VERIFICATION', 'ESSENTIAL', NULL, 'EMAIL', 'SYNC_LOG',
        v_user, v_target, jsonb_build_object('purpose', 'EMAIL_VERIFY'), v_outcome,
        CASE WHEN v_outcome = 'SENT' THEN NULL ELSE v_reason END,
        CASE WHEN v_outcome = 'SKIPPED' THEN 0 ELSE 1 END, 5, v_now, v_now,
        CASE WHEN v_outcome = 'SENT' THEN v_now END, v_now,
        NULLIF(left(COALESCE(p->>'provider_message_id', ''), 200), ''),
        jsonb_build_object('at', v_now, 'stage', 'SYNC', 'outcome', v_outcome, 'email', jsonb_build_object('verified', false))
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        SELECT o.id INTO v_id FROM public.notification_outbox o WHERE o.idempotency_key = v_key || ':EMAIL';
    END IF;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;
