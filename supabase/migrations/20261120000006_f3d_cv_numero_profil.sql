-- Contre-vérification de la finition 3d, T1 — le numéro d'un compte ADMIN ou SUPERADMIN ne se change jamais par le profil
-- client. Recopie de account_phone_finalize (20261109000004, dernière définition ; ni la finition 2b ni main n'y touchent)
-- avec une seule garde ajoutée, sous le verrou du compte : ADMIN_PHONE_PATH pour un compte qui a le rôle ADMIN ou
-- SUPERADMIN. Le reste de la fonction est inchangé. Les routes /api/account/phone/start et /confirm refusent avant (403,
-- message qui renvoie vers le bon chemin) ; cette garde tient même si une route l'oubliait.
-- Sans BEGIN ni COMMIT ; rejouable (CREATE OR REPLACE, REVOKE et GRANT idempotents).

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
    v_tr        record;
    v_tk        record;
    v_cancelled integer := 0;
BEGIN
    IF v_user IS NULL OR v_keep IS NULL OR v_new IS NULL OR v_new !~ '^\+221[0-9]{9}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;

    SELECT u.phone, u.role::text INTO v_old, v_role FROM public.users u WHERE u.id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND');
    END IF;
    -- Contre-vérification de la finition 3d (T1) : un compte ADMIN ou SUPERADMIN ne change jamais son numéro par le profil
    -- client. Son numéro reçoit les codes administrateur : ADMIN, par le Superadmin ; SUPERADMIN, par « Sécurité du compte »
    -- (admin_phone_change_start et …_finalize, nouveau numéro prouvé, mot de passe et code récents). Sous le verrou du compte.
    IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_user AND r.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ADMIN_PHONE_PATH');
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

    IF v_old ~ '^\+?221[0-9]{9}$' THEN
        v_old_e164 := '+' || ltrim(v_old, '+');

        -- Lot 9 bis (R63, B54) : transferts en attente vers l'ancien numéro annulés (le destinataire n'a plus ce numéro).
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
            v_cancelled := v_cancelled + 1;
            IF v_tr.from_user_id IS NULL THEN
                -- Invitation à réclamer : billet annulé et place rendue, aucun avis (B54)
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

        -- Sans user_id : l'envoyeur viserait le numéro du compte, c'est-à-dire le nouveau (L30). Lot 9 bis (G.49) : le
        -- registre déclare aussi EMAIL ; cette ligne au numéro reste SMS seul.
        v_queued := public.notif_enqueue(jsonb_build_object(
            'type', 'PHONE_CHANGED',
            'key', 'PHONE_CHANGED:' || v_user::text || ':' || txid_current()::text,
            'phone', v_old_e164,
            'data', '{}'::jsonb,
            'channels', jsonb_build_array('SMS')));
    END IF;

    -- Lot 9 bis (G.49, B97) : seconde mise en file au compte, EMAIL seul (adresse vérifiée exigée par notif_enqueue, M10) ;
    -- clé distincte de celle du SMS.
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'PHONE_CHANGED',
        'key', 'PHONE_CHANGED:' || v_user::text || ':' || txid_current()::text || ':compte',
        'user_id', v_user,
        'data', '{}'::jsonb,
        'channels', jsonb_build_array('EMAIL')));

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_user, v_role, 'ACCOUNT_PHONE_CHANGED', 'users', v_user, jsonb_build_object(
        'old_phone_masked', CASE WHEN v_old IS NULL THEN NULL ELSE '*** ** ' || right(v_old, 2) END,
        'new_phone_masked', '*** ** ' || right(v_new, 2),
        'sms_queued', v_queued > 0,
        'sessions_revoked', v_sessions,
        'transfers_cancelled', v_cancelled));

    RETURN jsonb_build_object('ok', true, 'sessions_revoked', v_sessions, 'transfers_cancelled', v_cancelled);
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PHONE_TAKEN');
END;
$$;

REVOKE ALL ON FUNCTION public.account_phone_finalize(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_phone_finalize(jsonb) TO service_role;
