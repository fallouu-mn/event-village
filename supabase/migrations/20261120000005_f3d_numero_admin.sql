-- Finition 3d (recours et suppléance), points 2a et 2c — changement du numéro d'un administrateur, prouvé par un code
-- envoyé au NOUVEAU numéro.
--
--  - Par le SUPERADMIN (BY_SUPERADMIN) : numéro d'un ADMIN (jamais d'un SUPERADMIN, jamais le sien par cet écran), avec un
--    motif ; toutes les sessions et tous les appareils de l'ADMIN sont révoqués.
--  - Par le SUPERADMIN lui-même (SELF), après « J'ai perdu mon téléphone » (code de secours) : ses autres sessions et ses
--    autres appareils sont révoqués, la session en cours reste.
--
-- 1. Table public.admin_phone_changes : une demande par changement (identifiant tiré par la route), code rangé en empreinte
--    HMAC liée à la demande, 5 essais au plus, 10 minutes ; une nouvelle demande annule la précédente de ce compte.
-- 2. Types d'avis ADMIN_PHONE_CHANGED (SMS à l'ANCIEN numéro, écrit dans la ligne d'envoi) et ADMIN_PHONE_CONFIRMED (SMS au
--    NOUVEAU numéro et cloche) ; envoi synchrone OTP_ADMIN_PHONE (code au nouveau numéro, à dicter au Superadmin) et
--    notification_sync_log recopiée (20261112000006_lot9quinquies_comptes_admin.sql ; changement : OTP_ADMIN_PHONE).
-- 3. admin_phone_change_start : SUPERADMIN actif, mot de passe et code saisis depuis moins de 10 minutes
--    (admin_identity_check), cible et motif, nouveau numéro libre et différent ; demande enregistrée ; journal.
-- 4. admin_phone_change_verify : le code saisi doit correspondre (5 essais, 10 minutes) ; la demande passe VERIFIED.
-- 5. admin_phone_change_finalize : demande VERIFIED depuis moins de 10 minutes, même auteur et même session qu'au départ ;
--    profil mis à jour ; sessions, appareils de confiance et abonnements push révoqués ; transferts en attente vers l'ancien
--    numéro annulés (recopie du bloc R63 de account_phone_finalize, 20261109000004) ; SMS à l'ancien et au nouveau numéro ;
--    journal ADMIN_PHONE_CHANGED (motif). L'auth (auth.users) est mise à jour par la route avant cet appel, et remise en
--    l'état si la finalisation échoue.
--
-- Sans BEGIN ni COMMIT ; rejouable (IF NOT EXISTS, ON CONFLICT, CREATE OR REPLACE, REVOKE et GRANT idempotents).

CREATE TABLE IF NOT EXISTS public.admin_phone_changes (
    id          uuid PRIMARY KEY,
    target_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    actor_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    kind        text NOT NULL CHECK (kind IN ('BY_SUPERADMIN', 'SELF')),
    session_id  uuid NOT NULL,
    old_phone   text,
    new_phone   text NOT NULL CHECK (new_phone ~ '^\+221[0-9]{9}$'),
    reason      text CHECK (reason IS NULL OR char_length(reason) BETWEEN 3 AND 500),
    code_hash   text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
    attempts    integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    status      text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'DONE', 'CANCELLED', 'EXPIRED', 'FAILED')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL,
    verified_at timestamptz,
    done_at     timestamptz
);
CREATE INDEX IF NOT EXISTS admin_phone_changes_target_idx ON public.admin_phone_changes (target_id, created_at DESC);
ALTER TABLE public.admin_phone_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_phone_changes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_phone_changes TO service_role;

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('ADMIN_PHONE_CHANGED',   'ESSENTIAL', NULL, ARRAY['SMS'],           'ANY',   'ALLOW', FALSE, NULL),
    ('ADMIN_PHONE_CONFIRMED', 'ESSENTIAL', NULL, ARRAY['IN_APP','SMS'],  'ADMIN', 'ALLOW', FALSE, NULL),
    ('OTP_ADMIN_PHONE',       'ESSENTIAL', NULL, ARRAY['SMS'],           'ANY',   'ALLOW', TRUE,  NULL)
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;

-- ----------------------------------------------------------------------------
-- notification_sync_log (recopie de 20261112000006_lot9quinquies_comptes_admin.sql) ; changement : OTP_ADMIN_PHONE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notification_sync_log(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type    text := p->>'type';
    v_ref     text := NULLIF(btrim(COALESCE(p->>'ref', '')), '');
    v_phone   text := NULLIF(btrim(COALESCE(p->>'phone', '')), '');
    v_user    uuid := NULLIF(p->>'user_id', '')::uuid;
    v_actor   uuid := NULLIF(p->>'actor_id', '')::uuid;
    v_outcome text := p->>'outcome';
    v_reason  text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    v_purpose text;
    v_key     text;
    v_id      uuid;
    v_now     timestamptz := now();
BEGIN
    v_purpose := CASE v_type
        WHEN 'OTP_LOGIN' THEN 'LOGIN'
        WHEN 'OTP_REGISTER' THEN 'REGISTER'
        WHEN 'OTP_PASSWORD_RESET' THEN 'PASSWORD_RESET'
        WHEN 'OTP_WITHDRAWAL' THEN 'WITHDRAWAL'
        WHEN 'OTP_PHONE_CHANGE' THEN 'PHONE_CHANGE'
        WHEN 'OTP_AUTH_HOOK' THEN 'AUTH_HOOK'
        WHEN 'CONTROLLER_INVITE' THEN 'CONTROLLER_SETUP'
        -- Lot 9 quinquies (A2, A3) : lien d'activation d'un compte créé par un admin ; code administrateur
        WHEN 'ACCOUNT_ACTIVATION' THEN 'ACCOUNT_ACTIVATION'
        WHEN 'OTP_ADMIN' THEN 'ADMIN_STEP_UP'
        -- Finition 3d (point 2a) : code au nouveau numéro d'un administrateur
        WHEN 'OTP_ADMIN_PHONE' THEN 'ADMIN_PHONE_CHANGE'
    END;
    IF v_purpose IS NULL OR NOT EXISTS (SELECT 1 FROM public.notification_types t WHERE t.type = v_type AND t.sync_only) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TYPE',
            'message', 'Seuls les codes à usage unique et les invitations se journalisent ici.');
    END IF;
    IF v_ref IS NULL OR v_outcome IS NULL OR v_outcome NOT IN ('SENT', 'FAILED', 'UNCERTAIN', 'SKIPPED')
       OR (v_phone IS NULL AND v_user IS NULL)
       OR (v_phone IS NOT NULL AND v_phone !~ '^\+221[0-9]{9}$')
       OR (v_outcome <> 'SENT' AND v_reason IS NULL) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Journal d''envoi incomplet.');
    END IF;

    v_key := v_type || ':' || v_ref;
    INSERT INTO public.notification_outbox (
        idempotency_key, group_key, type, family, topic, channel, origin,
        recipient_user_id, recipient_phone, actor_id, template_data, status, reason,
        attempts, max_attempts, due_at, next_attempt_at, sent_at, finished_at, provider_message_id, decision
    ) VALUES (
        v_key || ':SMS', v_key, v_type, 'ESSENTIAL', NULL, 'SMS', 'SYNC_LOG',
        v_user, v_phone, v_actor, jsonb_build_object('purpose', v_purpose), v_outcome,
        CASE WHEN v_outcome = 'SENT' THEN NULL ELSE v_reason END,
        CASE WHEN v_outcome = 'SKIPPED' THEN 0 ELSE 1 END, 5, v_now, v_now,
        CASE WHEN v_outcome IN ('SENT', 'UNCERTAIN') THEN v_now END, v_now,
        NULLIF(left(COALESCE(p->>'provider_message_id', ''), 200), ''),
        jsonb_build_object('at', v_now, 'stage', 'SYNC', 'outcome', v_outcome)
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        SELECT o.id INTO v_id FROM public.notification_outbox o WHERE o.idempotency_key = v_key || ':SMS';
    END IF;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.notification_sync_log(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_sync_log(jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- 3. Début : demande enregistrée, code (empreinte) prêt pour le nouveau numéro
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_phone_change_start(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request  uuid := public.try_uuid(p->>'request_id');
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_target   uuid := public.try_uuid(p->>'target_id');
    v_session  uuid := public.try_uuid(p->>'session_id');
    v_kind     text := p->>'kind';
    v_new      text := NULLIF(btrim(COALESCE(p->>'new_phone', '')), '');
    v_reason   text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    v_hash     text := btrim(COALESCE(p->>'code_hash', ''));
    v_identity text;
    v_old      text;
    v_status   text;
    v_expires  timestamptz := clock_timestamp() + interval '10 minutes';
BEGIN
    IF v_request IS NULL OR v_actor IS NULL OR v_target IS NULL OR v_session IS NULL OR v_kind NOT IN ('BY_SUPERADMIN', 'SELF')
       OR v_new IS NULL OR v_new !~ '^\+221[0-9]{9}$' OR v_hash !~ '^[0-9a-f]{64}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande incomplète.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
       OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SUPERADMIN_ONLY', 'message', 'Seul un Superadmin change le numéro d’un administrateur.');
    END IF;
    v_identity := public.admin_identity_check(jsonb_build_object('user_id', v_actor, 'session_id', v_session, 'device_key', p->>'device_key'));
    IF v_identity IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', v_identity,
            'message', CASE v_identity WHEN 'PASSWORD_CONFIRMATION_REQUIRED' THEN 'Par sécurité, saisissez votre mot de passe pour continuer.'
                                       ELSE 'Par sécurité, saisissez le code administrateur reçu par SMS pour continuer.' END);
    END IF;
    IF v_kind = 'SELF' AND v_target <> v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande incomplète.');
    END IF;
    IF v_kind = 'BY_SUPERADMIN' THEN
        IF v_target = v_actor THEN
            RETURN jsonb_build_object('ok', false, 'code', 'SELF_TARGET',
                                      'message', 'Votre propre numéro se change depuis « Sécurité du compte », pas depuis la liste des comptes.');
        END IF;
        IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_target AND r.role::text = 'SUPERADMIN') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TARGET_IS_SUPERADMIN',
                                      'message', 'Le numéro d’un Superadmin ne se change pas ici : il le change lui-même, avec ses codes de secours.');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_target AND r.role::text = 'ADMIN') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TARGET_NOT_ADMIN', 'message', 'Seul le numéro d’un administrateur se change ici.');
        END IF;
        IF v_reason IS NULL OR char_length(v_reason) < 3 OR char_length(v_reason) > 500 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif (3 à 500 caractères).');
        END IF;
    ELSE
        v_reason := COALESCE(v_reason, 'Téléphone perdu (code de secours)');
    END IF;
    SELECT u.phone, u.status::text INTO v_old, v_status FROM public.users u WHERE u.id = v_target FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND', 'message', 'Compte introuvable.');
    END IF;
    IF v_status = 'SUPPRIME' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND', 'message', 'Compte introuvable.');
    END IF;
    IF v_old IS NOT NULL AND ('+' || ltrim(v_old, '+')) = v_new THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PHONE_UNCHANGED', 'message', 'C’est déjà le numéro de ce compte.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.users u WHERE u.id <> v_target AND u.phone IN (v_new, ltrim(v_new, '+'))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PHONE_TAKEN', 'message', 'Ce numéro est déjà celui d’un autre compte.');
    END IF;
    UPDATE public.admin_phone_changes SET status = 'CANCELLED'
     WHERE target_id = v_target AND status IN ('PENDING', 'VERIFIED');
    INSERT INTO public.admin_phone_changes (id, target_id, actor_id, kind, session_id, old_phone, new_phone, reason, code_hash, expires_at)
    VALUES (v_request, v_target, v_actor, v_kind, v_session, v_old, v_new, v_reason, v_hash, v_expires);
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'SUPERADMIN', 'ADMIN_PHONE_CHANGE_REQUESTED', 'users', v_target,
            jsonb_build_object('request_id', v_request, 'kind', v_kind, 'reason', v_reason,
                               'new_phone_masked', '*** ** ' || right(v_new, 2)));
    RETURN jsonb_build_object('ok', true, 'request_id', v_request, 'expires_at', v_expires);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_phone_change_start(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_phone_change_start(jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- 4. Preuve : le code reçu par le nouveau numéro
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_phone_change_verify(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request uuid := public.try_uuid(p->>'request_id');
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_hash    text := btrim(COALESCE(p->>'code_hash', ''));
    r         record;
BEGIN
    SELECT * INTO r FROM public.admin_phone_changes c WHERE c.id = v_request FOR UPDATE;
    IF v_request IS NULL OR NOT FOUND OR r.actor_id IS DISTINCT FROM v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND', 'message', 'Demande introuvable : recommencez le changement.');
    END IF;
    IF r.status <> 'PENDING' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_CLOSED', 'message', 'Cette demande n’est plus valable : recommencez le changement.');
    END IF;
    IF r.expires_at < clock_timestamp() THEN
        UPDATE public.admin_phone_changes SET status = 'EXPIRED' WHERE id = r.id;
        RETURN jsonb_build_object('ok', false, 'code', 'CODE_EXPIRED', 'message', 'Le code a expiré : recommencez le changement.');
    END IF;
    IF v_hash !~ '^[0-9a-f]{64}$' OR v_hash <> r.code_hash THEN
        UPDATE public.admin_phone_changes
           SET attempts = attempts + 1, status = CASE WHEN attempts + 1 >= 5 THEN 'FAILED' ELSE status END
         WHERE id = r.id;
        IF r.attempts + 1 >= 5 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TOO_MANY_ATTEMPTS', 'message', 'Trop de codes faux : recommencez le changement.');
        END IF;
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_CODE', 'message', 'Code incorrect.', 'attempts_left', 5 - (r.attempts + 1));
    END IF;
    UPDATE public.admin_phone_changes SET status = 'VERIFIED', verified_at = clock_timestamp() WHERE id = r.id;
    RETURN jsonb_build_object('ok', true, 'target_id', r.target_id, 'new_phone', r.new_phone, 'old_phone', r.old_phone, 'kind', r.kind);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_phone_change_verify(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_phone_change_verify(jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- 5. Fin : profil, révocations, transferts, avis, journal
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_phone_change_finalize(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request  uuid := public.try_uuid(p->>'request_id');
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_session  uuid := public.try_uuid(p->>'session_id');
    v_device   text := btrim(COALESCE(p->>'device_key', ''));
    r          record;
    v_current  text;
    v_old_e164 text;
    v_sessions integer := 0;
    v_tr       record;
    v_tk       record;
BEGIN
    SELECT * INTO r FROM public.admin_phone_changes c WHERE c.id = v_request FOR UPDATE;
    IF v_request IS NULL OR NOT FOUND OR r.actor_id IS DISTINCT FROM v_actor OR r.session_id IS DISTINCT FROM v_session THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND', 'message', 'Demande introuvable : recommencez le changement.');
    END IF;
    IF r.status <> 'VERIFIED' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_VERIFIED', 'message', 'Le nouveau numéro n’a pas été prouvé par son code.');
    END IF;
    IF r.verified_at < clock_timestamp() - interval '10 minutes' THEN
        UPDATE public.admin_phone_changes SET status = 'EXPIRED' WHERE id = r.id;
        RETURN jsonb_build_object('ok', false, 'code', 'CODE_EXPIRED', 'message', 'La preuve a expiré : recommencez le changement.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
       OR NOT EXISTS (SELECT 1 FROM public.user_roles x WHERE x.user_id = v_actor AND x.role::text = 'SUPERADMIN') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SUPERADMIN_ONLY', 'message', 'Seul un Superadmin change le numéro d’un administrateur.');
    END IF;
    IF r.kind = 'BY_SUPERADMIN' AND (
           EXISTS (SELECT 1 FROM public.user_roles x WHERE x.user_id = r.target_id AND x.role::text = 'SUPERADMIN')
        OR NOT EXISTS (SELECT 1 FROM public.user_roles x WHERE x.user_id = r.target_id AND x.role::text = 'ADMIN')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TARGET_NOT_ADMIN', 'message', 'Seul le numéro d’un administrateur se change ici.');
    END IF;
    SELECT u.phone INTO v_current FROM public.users u WHERE u.id = r.target_id FOR UPDATE;
    IF v_current IS DISTINCT FROM r.old_phone THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PHONE_CONFLICT', 'message', 'Le numéro a changé entre-temps : recommencez.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.users u WHERE u.id <> r.target_id AND u.phone IN (r.new_phone, ltrim(r.new_phone, '+'))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PHONE_TAKEN', 'message', 'Ce numéro est déjà celui d’un autre compte.');
    END IF;

    UPDATE public.users SET phone = r.new_phone, phone_verified_at = now(), updated_at = now() WHERE id = r.target_id;

    -- Sessions et appareils : tout pour un ADMIN changé par le Superadmin ; tout sauf la session et l'appareil en cours pour
    -- un Superadmin qui change le sien (après un code de secours, ou avec son code habituel).
    IF r.kind = 'BY_SUPERADMIN' THEN
        v_sessions := public.revoke_user_sessions(r.target_id);
        DELETE FROM public.admin_devices WHERE user_id = r.target_id;
    ELSE
        UPDATE auth.refresh_tokens SET revoked = true, updated_at = now()
         WHERE user_id = r.target_id::text AND session_id IS DISTINCT FROM v_session AND revoked IS DISTINCT FROM true;
        DELETE FROM auth.sessions WHERE user_id = r.target_id AND id <> v_session;
        GET DIAGNOSTICS v_sessions = ROW_COUNT;
        DELETE FROM public.admin_devices WHERE user_id = r.target_id AND device_key <> v_device;
    END IF;
    DELETE FROM public.push_subscriptions WHERE user_id = r.target_id;

    -- Recopie du bloc R63 de account_phone_finalize (20261109000004) : transferts en attente vers l'ancien numéro annulés
    IF r.old_phone ~ '^\+?221[0-9]{9}$' THEN
        v_old_e164 := '+' || ltrim(r.old_phone, '+');
        PERFORM 1
           FROM public.ticket_categories c
          WHERE c.id IN (SELECT t.category_id
                           FROM public.ticket_transfers x JOIN public.tickets t ON t.id = x.ticket_id
                          WHERE x.status::text = 'PENDING' AND x.from_user_id IS NULL
                            AND x.to_phone_or_email IN (v_old_e164, ltrim(v_old_e164, '+')))
          ORDER BY c.id
            FOR NO KEY UPDATE;
        FOR v_tr IN
            SELECT x.id, x.ticket_id, x.from_user_id
              FROM public.ticket_transfers x
             WHERE x.status::text = 'PENDING' AND x.to_phone_or_email IN (v_old_e164, ltrim(v_old_e164, '+'))
             ORDER BY x.id
               FOR UPDATE
        LOOP
            SELECT t.id, t.status::text AS status, t.category_id, t.event_id INTO v_tk
              FROM public.tickets t WHERE t.id = v_tr.ticket_id FOR UPDATE;
            UPDATE public.ticket_transfers SET status = 'CANCELLED', cancelled_at = now() WHERE id = v_tr.id;
            IF v_tr.from_user_id IS NULL THEN
                IF v_tk.status = 'VALIDE' THEN
                    UPDATE public.tickets SET status = 'ANNULE', transfer_locked = FALSE, updated_at = now() WHERE id = v_tk.id;
                    UPDATE public.ticket_categories SET sold_quantity = sold_quantity - 1 WHERE id = v_tk.category_id;
                ELSE
                    UPDATE public.tickets SET transfer_locked = FALSE, updated_at = now() WHERE id = v_tk.id;
                END IF;
            ELSE
                UPDATE public.tickets SET transfer_locked = FALSE, updated_at = now() WHERE id = v_tk.id;
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'TRANSFER_RECIPIENT_CHANGED', 'key', 'TRANSFER_RECIPIENT_CHANGED:' || v_tr.id::text,
                    'user_id', v_tr.from_user_id, 'event_id', v_tk.event_id,
                    'data', COALESCE(public.notif_event_data(v_tk.event_id), '{}'::jsonb)
                            || jsonb_build_object('transfer_id', v_tr.id, 'ticket_id', v_tk.id)));
            END IF;
        END LOOP;

        -- SMS à l'ANCIEN numéro, écrit dans la ligne d'envoi (sans compte : sinon l'envoyeur viserait le nouveau)
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'ADMIN_PHONE_CHANGED', 'key', 'ADMIN_PHONE_CHANGED:' || r.id::text,
            'phone', v_old_e164, 'actor_id', v_actor,
            'data', jsonb_build_object('by_self', r.kind = 'SELF')));
    END IF;
    -- SMS au NOUVEAU numéro (écrit dans la ligne) et cloche au compte
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'ADMIN_PHONE_CONFIRMED', 'key', 'ADMIN_PHONE_CONFIRMED:' || r.id::text,
        'user_id', r.target_id, 'phone', r.new_phone, 'actor_id', v_actor,
        'data', jsonb_build_object('by_self', r.kind = 'SELF')));

    UPDATE public.admin_phone_changes SET status = 'DONE', done_at = clock_timestamp() WHERE id = r.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, 'SUPERADMIN', 'ADMIN_PHONE_CHANGED', 'users', r.target_id,
            jsonb_build_object('phone_masked', CASE WHEN r.old_phone IS NULL THEN NULL ELSE '*** ** ' || right(r.old_phone, 2) END),
            jsonb_build_object('phone_masked', '*** ** ' || right(r.new_phone, 2)),
            jsonb_build_object('request_id', r.id, 'kind', r.kind, 'reason', r.reason, 'sessions_revoked', v_sessions));
    RETURN jsonb_build_object('ok', true, 'target_id', r.target_id, 'new_phone', r.new_phone, 'sessions_revoked', v_sessions, 'kind', r.kind);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_phone_change_finalize(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_phone_change_finalize(jsonb) TO service_role;
