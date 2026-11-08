-- ============================================================================
-- EVENT VILLAGE — LOT 9 (9.2) : compte client (profil, changement de numéro, Mes paiements, photo)
-- ============================================================================
-- Contrat : scratchpad/lot9-design.md, sections 3.1 (M4), 3.2, 4.3 et 5.3 ; décisions AR2, AR3, AM1, L24 à L35.
-- Migration rejouable (IF EXISTS, CREATE OR REPLACE, ON CONFLICT) ; aucune migration gelée modifiée.
--
-- Recopie :
--  - notification_sync_log(jsonb) : base 20261103000002:663-722, une ligne ajoutée (OTP_PHONE_CHANGE → PHONE_CHANGE).
-- Nouvelles, service_role seul :
--  - account_identity_taken : un email ou un numéro est-il pris par un autre compte (AM1 : GoTrue ne garantit pas de code) ;
--  - account_profile_finalize, account_phone_finalize : écriture de public.users, APRÈS auth.admin.updateUserById (AR2) ;
--  - client_payments_list : Mes paiements, le compte vient toujours de la session.
-- auth.users n'est jamais écrit ici : seule l'API d'administration l'écrit. auth.sessions et auth.refresh_tokens le
-- sont, patron 20261031000008:28-33 (révocation « sauf la session courante », même transaction que le reste).
-- Verrous : public.users seul, puis les tables auth ; aucune table de la chaîne events → paiements → catégories →
-- transferts → billets (section 3.3).
--
-- REVOKE : prénom, nom et photo ne s'écrivent plus en REST (L32, AR3) ; seules les routes écrivent, sinon Zod et le
-- retrait EXIF seraient contournables.
-- ============================================================================

-- ── Objet des codes OTP (L26 : hors ACCOUNT_OTP_PURPOSES, n'ouvre aucune session) ──
ALTER TABLE public.otp_codes DROP CONSTRAINT IF EXISTS otp_codes_purpose_check;
ALTER TABLE public.otp_codes ADD CONSTRAINT otp_codes_purpose_check
    CHECK (purpose IN ('LOGIN', 'REGISTER', 'PASSWORD_RESET', 'CONTROLLER_SETUP', 'WITHDRAWAL', 'PHONE_CHANGE'));

-- ── Registre des notifications (L30) ────────────────────────────────────────
INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('PHONE_CHANGED',    'ESSENTIAL', NULL, ARRAY['SMS'], 'ANY', 'ALLOW', FALSE, NULL),
    ('OTP_PHONE_CHANGE', 'ESSENTIAL', NULL, ARRAY['SMS'], 'ANY', 'ALLOW', TRUE,  NULL)
ON CONFLICT (type) DO NOTHING;

-- ── Colonnes du profil : plus d'écriture REST (L32, AR3) ────────────────────
REVOKE UPDATE (first_name, last_name, avatar_url) ON TABLE public.users FROM authenticated;

-- ── Journal des envois synchrones (recopie, une ligne ajoutée) ──────────────
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

-- ── Email ou numéro pris par un autre compte (AM1) ──────────────────────────
-- Lit auth.users ET public.users : appelée avant l'API (rien n'est tenté) et après toute erreur de l'API (course).
-- Email comparé en minuscules, numéro par ses chiffres (formes +221… et 221…).
CREATE OR REPLACE FUNCTION public.account_identity_taken(p_user_id uuid, p_email text, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email  text := lower(NULLIF(btrim(COALESCE(p_email, '')), ''));
    v_digits text := NULLIF(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), '');
    v_email_taken boolean := false;
    v_phone_taken boolean := false;
BEGIN
    IF v_email IS NOT NULL THEN
        v_email_taken := EXISTS (SELECT 1 FROM auth.users a WHERE a.id IS DISTINCT FROM p_user_id AND lower(a.email) = v_email)
                      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id IS DISTINCT FROM p_user_id AND lower(u.email) = v_email);
    END IF;
    IF v_digits IS NOT NULL THEN
        v_phone_taken := EXISTS (SELECT 1 FROM auth.users a WHERE a.id IS DISTINCT FROM p_user_id AND a.phone IN (v_digits, '+' || v_digits))
                      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id IS DISTINCT FROM p_user_id AND u.phone IN (v_digits, '+' || v_digits));
    END IF;
    RETURN jsonb_build_object('email_taken', v_email_taken, 'phone_taken', v_phone_taken);
END;
$$;

REVOKE ALL ON FUNCTION public.account_identity_taken(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_identity_taken(uuid, text, text) TO service_role;

-- ── Profil (section 5.3) ────────────────────────────────────────────────────
-- p = { user_id, first_name, last_name, email, expected_email }. L'audit ne porte aucune valeur : noms des champs seuls.
CREATE OR REPLACE FUNCTION public.account_profile_finalize(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user     uuid := NULLIF(p->>'user_id', '')::uuid;
    v_first    text := NULLIF(btrim(COALESCE(p->>'first_name', '')), '');
    v_last     text := NULLIF(btrim(COALESCE(p->>'last_name', '')), '');
    v_email    text := NULLIF(btrim(COALESCE(p->>'email', '')), '');
    v_expected text := p->>'expected_email';
    v_cur_first text;
    v_cur_last  text;
    v_cur_email text;
    v_role      text;
    v_fields    text[] := ARRAY[]::text[];
BEGIN
    IF v_user IS NULL OR v_first IS NULL OR v_last IS NULL OR v_email IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;

    SELECT u.first_name, u.last_name, u.email, u.role::text
      INTO v_cur_first, v_cur_last, v_cur_email, v_role
      FROM public.users u WHERE u.id = v_user
       FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND');
    END IF;
    IF v_cur_email IS DISTINCT FROM v_expected THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_CONFLICT');
    END IF;

    IF v_cur_first IS DISTINCT FROM v_first THEN v_fields := v_fields || 'first_name'::text; END IF;
    IF v_cur_last IS DISTINCT FROM v_last THEN v_fields := v_fields || 'last_name'::text; END IF;
    IF v_cur_email IS DISTINCT FROM v_email THEN v_fields := v_fields || 'email'::text; END IF;

    UPDATE public.users SET first_name = v_first, last_name = v_last, email = v_email WHERE id = v_user;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_user, v_role, 'ACCOUNT_PROFILE_UPDATED', 'users', v_user, jsonb_build_object('fields', to_jsonb(v_fields)));

    RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_TAKEN');
END;
$$;

REVOKE ALL ON FUNCTION public.account_profile_finalize(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_profile_finalize(jsonb) TO service_role;

-- ── Changement de numéro (section 5.3, AR2) ─────────────────────────────────
-- p = { user_id, new_phone, expected_phone, new_email, keep_session_id }, en une transaction : profil, autres sessions,
-- SMS à l'ancien numéro, audit. keep_session_id est obligatoire : jamais de révocation totale par défaut.
CREATE OR REPLACE FUNCTION public.account_phone_finalize(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user      uuid := NULLIF(p->>'user_id', '')::uuid;
    v_new       text := NULLIF(btrim(COALESCE(p->>'new_phone', '')), '');
    v_expected  text := p->>'expected_phone';
    v_new_email text := NULLIF(btrim(COALESCE(p->>'new_email', '')), '');
    v_keep      uuid := NULLIF(p->>'keep_session_id', '')::uuid;
    v_old       text;
    v_role      text;
    v_old_e164  text;
    v_sessions  integer;
    v_queued    integer := 0;
BEGIN
    IF v_user IS NULL OR v_keep IS NULL OR v_new IS NULL OR v_new !~ '^\+221[0-9]{9}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;

    SELECT u.phone, u.role::text INTO v_old, v_role FROM public.users u WHERE u.id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND');
    END IF;
    IF v_old IS DISTINCT FROM v_expected THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PHONE_CONFLICT');
    END IF;
    IF EXISTS (SELECT 1 FROM public.users u WHERE u.id <> v_user AND u.phone IN (v_new, ltrim(v_new, '+'))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PHONE_TAKEN');
    END IF;

    UPDATE public.users
       SET phone = v_new, phone_verified_at = now(), email = COALESCE(v_new_email, email)
     WHERE id = v_user;

    UPDATE auth.refresh_tokens
       SET revoked = true, updated_at = now()
     WHERE user_id = v_user::text
       AND session_id IS DISTINCT FROM v_keep
       AND revoked IS DISTINCT FROM true;
    DELETE FROM auth.sessions WHERE user_id = v_user AND id <> v_keep;
    GET DIAGNOSTICS v_sessions = ROW_COUNT;

    -- Sans user_id : l'envoyeur viserait le numéro du compte, c'est-à-dire le nouveau (L30).
    IF v_old ~ '^\+?221[0-9]{9}$' THEN
        v_old_e164 := '+' || ltrim(v_old, '+');
        v_queued := public.notif_enqueue(jsonb_build_object(
            'type', 'PHONE_CHANGED',
            'key', 'PHONE_CHANGED:' || v_user::text || ':' || txid_current()::text,
            'phone', v_old_e164,
            'data', '{}'::jsonb));
    END IF;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_user, v_role, 'ACCOUNT_PHONE_CHANGED', 'users', v_user, jsonb_build_object(
        'old_phone_masked', CASE WHEN v_old IS NULL THEN NULL ELSE '*** ** ' || right(v_old, 2) END,
        'new_phone_masked', '*** ** ' || right(v_new, 2),
        'sms_queued', v_queued > 0,
        'sessions_revoked', v_sessions));

    RETURN jsonb_build_object('ok', true, 'sessions_revoked', v_sessions);
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PHONE_TAKEN');
END;
$$;

REVOKE ALL ON FUNCTION public.account_phone_finalize(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_phone_finalize(jsonb) TO service_role;

-- ── Mes paiements (L33) ─────────────────────────────────────────────────────
-- p = { user_id, page, page_size, include_simulated }. Totaux sur tout le filtre, indépendants de la page.
CREATE OR REPLACE FUNCTION public.client_payments_list(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := NULLIF(p->>'user_id', '')::uuid;
    v_page integer := GREATEST(COALESCE(NULLIF(p->>'page', '')::integer, 1), 1);
    v_size integer := LEAST(GREATEST(COALESCE(NULLIF(p->>'page_size', '')::integer, 20), 1), 100);
    v_sim  boolean := COALESCE(NULLIF(p->>'include_simulated', '')::boolean, false);
    v_total    bigint;
    v_paid     numeric;
    v_refunded numeric;
    v_items    jsonb;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'client_payments_list : user_id requis';
    END IF;

    SELECT count(*),
           COALESCE(sum(pay.amount) FILTER (WHERE pay.status::text IN ('SUCCESS', 'PARTIAL', 'REFUNDED', 'REFUND_PENDING')), 0),
           COALESCE(sum(pay.refunded_amount), 0)
      INTO v_total, v_paid, v_refunded
      FROM public.payments pay
     WHERE pay.client_id = v_user AND pay.amount > 0 AND pay.simulated = v_sim;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', r.id,
               'created_at', r.created_at,
               'amount', r.amount,
               'refunded_amount', r.refunded_amount,
               'operator', r.operator,
               'is_platform_payment', r.is_platform_payment,
               'status', r.status,
               'target', r.payment_target,
               'event_title', r.event_title
           ) ORDER BY r.created_at DESC, r.id DESC), '[]'::jsonb)
      INTO v_items
      FROM (
          SELECT pay.id, pay.created_at, pay.amount, COALESCE(pay.refunded_amount, 0) AS refunded_amount, pay.operator,
                 pay.is_platform_payment, pay.status::text AS status, pay.payment_target::text AS payment_target, e.title AS event_title
            FROM public.payments pay
            LEFT JOIN public.events e ON e.id = pay.event_id
           WHERE pay.client_id = v_user AND pay.amount > 0 AND pay.simulated = v_sim
           ORDER BY pay.created_at DESC, pay.id DESC
           LIMIT v_size OFFSET (v_page - 1)::bigint * v_size
      ) r;

    RETURN jsonb_build_object('items', v_items, 'total_count', v_total, 'total_paid', v_paid, 'total_refunded', v_refunded);
END;
$$;

REVOKE ALL ON FUNCTION public.client_payments_list(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_payments_list(jsonb) TO service_role;
