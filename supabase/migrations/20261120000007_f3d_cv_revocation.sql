-- Contre-vérification de la finition 3d, T2 — révocation immédiate partout, REST et temps réel compris.
-- Constat (cvf3d-1 j2 et j3, cvf3d-2 i) : après une révocation, le jeton d'accès déjà ouvert gardait le pouvoir
-- d'administration par la REST et le temps réel jusqu'à son échéance (1 heure au plus). Les routes de l'application le
-- refusaient (GoTrue ne trouve plus la session), mais is_admin() et is_superadmin() ne lisent que admin_session_codes, que
-- personne n'effaçait ; PostgREST et le temps réel ne vérifient que la signature et l'échéance du jeton.
-- Correctif :
--   admin_session_code_valid() exige en plus que la session du jeton existe encore dans auth.sessions (même requête : une
--     jointure sur clé primaire, STABLE ; toute révocation, quel que soit son chemin, coupe donc aussitôt la REST) ;
--   revoke_user_sessions (20261031000008) efface aussi les lignes admin_session_codes du compte ;
--   admin_phone_change_finalize (20261120000005) : quand le Superadmin change son propre numéro, les codes des sessions
--     révoquées (toutes sauf la session en cours) sont effacés.
-- Recopies avec ces seuls ajouts. Sans BEGIN ni COMMIT ; rejouable (CREATE OR REPLACE, REVOKE et GRANT idempotents).

-- Recopie de 20261112000011_lot9quinquies_admin_code_rls.sql ; ajout : la session du jeton existe encore (auth.sessions)
CREATE OR REPLACE FUNCTION public.admin_session_code_valid()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(EXISTS (
        SELECT 1
          FROM public.admin_session_codes c
          JOIN auth.sessions s ON s.id = c.session_id AND s.user_id = c.user_id
         WHERE c.session_id = public.try_uuid(auth.jwt() ->> 'session_id')
           AND c.user_id = auth.uid()
           AND c.code_at > now() - interval '12 hours'
    ), FALSE);
$$;
REVOKE ALL ON FUNCTION public.admin_session_code_valid() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_session_code_valid() TO service_role;
COMMENT ON FUNCTION public.admin_session_code_valid() IS
    'Lot 9 quinquies (contre-vérification, point 1) ; finition 3d (contre-vérification, T2) : vrai si la session du jeton courant (session_id) existe encore (auth.sessions) et a passé le code administrateur depuis moins de 12 heures.';

-- Recopie de 20261031000008_lot1c3_revocation_sessions.sql ; ajout : codes administrateur du compte effacés
CREATE OR REPLACE FUNCTION public.revoke_user_sessions(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_sessions integer;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'revoke_user_sessions : p_user_id requis';
    END IF;

    UPDATE auth.refresh_tokens
       SET revoked = true, updated_at = now()
     WHERE user_id = p_user_id::text
       AND revoked IS DISTINCT FROM true;

    DELETE FROM auth.sessions WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_sessions = ROW_COUNT;
    -- Finition 3d (contre-vérification, T2) : plus aucun pouvoir d'administration par la REST ni le temps réel
    DELETE FROM public.admin_session_codes WHERE user_id = p_user_id;
    RETURN v_sessions;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) TO service_role;
COMMENT ON FUNCTION public.revoke_user_sessions(uuid) IS
    'Lot 1C.3 : supprime les sessions et révoque les jetons de rafraîchissement d''un compte ; finition 3d (contre-vérification, T2) : efface aussi ses codes administrateur. Service_role uniquement.';

-- Recopie de 20261120000005_f3d_numero_admin.sql ; ajout : codes des sessions révoquées effacés (numéro du Superadmin)
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
        -- Contre-vérification (T2) : les codes administrateur des sessions révoquées disparaissent aussitôt (REST, temps réel)
        DELETE FROM public.admin_session_codes WHERE user_id = r.target_id AND session_id <> v_session;
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

        -- SMS à l'ANCIEN numéro, écrit dans la ligne d'envoi (sans compte : sinon l'envoyeur viserait le nouveau). Le
        -- registre déclare aussi EMAIL (G.49) ; cette ligne reste SMS seul, l'email au compte part avec ADMIN_PHONE_CONFIRMED.
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'ADMIN_PHONE_CHANGED', 'key', 'ADMIN_PHONE_CHANGED:' || r.id::text,
            'phone', v_old_e164, 'actor_id', v_actor,
            'data', jsonb_build_object('by_self', r.kind = 'SELF'),
            'channels', jsonb_build_array('SMS')));
    END IF;
    -- SMS au NOUVEAU numéro (écrit dans la ligne), cloche et email (adresse vérifiée) au compte
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
