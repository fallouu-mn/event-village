-- ============================================================================
-- EVENT VILLAGE — LOT « AVIS », PHASE 2, SOUS-LOT 2a : canaux manquants (écarts B1 à B6, B11 à B14 de docs/avis-inventaire.md)
-- ============================================================================
-- Règle du 27/11 : étape importante = SMS, email (adresse vérifiée), cloche et notification du téléphone ; petite étape =
-- cloche et notification. On ajoute, on n'enlève rien. Textes : lib/notifications/catalog.ts (même registre, égalité imposée
-- par tests/parcours/notif-modeles.test.ts).
--
--  B1  TRANSFER_RECEIVED      + SMS (billet reçu après acceptation ; part la nuit) ;
--  B2  PHONE_CHANGED          + cloche et notification au compte (recopie d'account_phone_finalize, seul émetteur qui
--                               impose ses canaux : ['SMS'] à l'ancien numéro puis ['EMAIL'] au compte) ;
--  B3  EMAIL_ADDED            + cloche et notification (émetteur sans liste de canaux : le registre suffit) ;
--  B4  ACCOUNT_LOGIN_FAILURES + cloche et notification (idem) ;
--  B5  PAYMENT_SUCCESS        + SMS (abonnement : un seul SMS, celui du paiement ; SUBSCRIPTION_ACTIVATED inchangé) ;
--  B6  ORDER_COURIER_INVITED  + SMS (reporté la nuit, règle déjà DEFER) ;
--  B11 ADMIN_EVENT_PUBLISHED, ADMIN_EVENT_WITHDRAWN, ADMIN_EVENT_CHANGED, ADMIN_EVENT_CANCELLED, ADMIN_NOTIFICATION_FAILED,
--      ADMIN_SMS_DAILY_THRESHOLD, ADMIN_SMS_OPTIONAL_80, ADMIN_SMS_FORECAST : + notification, reportée la nuit (DEFER : seuls
--      le SMS et la notification sont reportés ; ces types n'avaient ni l'un ni l'autre) ;
--  B12 SUPERADMIN_PROMOTED, ADMIN_PHONE_CONFIRMED : + notification ; ADMIN_BACKUP_CODE_USED : + cloche et notification
--      (sécurité : part la nuit) ;
--  B13 EVENT_SUSPENDED_HOLDER : famille indispensable (plus de sujet, plus de préférence : décision D5 du 27/11), reportée
--      la nuit sauf événement à moins de 12 h ; les rappels de table restent désactivables (D5) ;
--  B14 NEW_ORDER (ventes groupées de 15 minutes) : + notification, toujours désactivable (sujet PRO_ACTIVITY).
-- Recopies (ajouts seuls, droits inchangés) : account_phone_finalize, de 20261120000006_f3d_cv_numero_profil.sql:8-135 ;
-- notif_enqueue_grouped, de 20261125000003_f4_ventes.sql:37-92 (B14 : la notification des ventes reportée la nuit ne retient
-- plus la série, et une seule reste en attente par série).
-- Sans BEGIN ni COMMIT, rejouable (UPDATE à valeurs fixes, CREATE OR REPLACE).
-- ============================================================================

-- 1. Registre
UPDATE public.notification_types SET channels = ARRAY['IN_APP','PUSH','EMAIL','SMS'] WHERE type = 'TRANSFER_RECEIVED';
UPDATE public.notification_types SET channels = ARRAY['SMS','EMAIL','IN_APP','PUSH'] WHERE type IN ('PHONE_CHANGED', 'EMAIL_ADDED', 'ACCOUNT_LOGIN_FAILURES', 'ADMIN_BACKUP_CODE_USED');
UPDATE public.notification_types SET channels = ARRAY['IN_APP','EMAIL','PUSH','SMS'] WHERE type = 'PAYMENT_SUCCESS';
UPDATE public.notification_types SET channels = ARRAY['IN_APP','PUSH','EMAIL','SMS'] WHERE type = 'ORDER_COURIER_INVITED';
UPDATE public.notification_types SET channels = ARRAY['IN_APP','EMAIL','PUSH'], night_policy = 'DEFER'
 WHERE type IN ('ADMIN_EVENT_PUBLISHED', 'ADMIN_EVENT_WITHDRAWN', 'ADMIN_EVENT_CHANGED', 'ADMIN_EVENT_CANCELLED', 'ADMIN_NOTIFICATION_FAILED',
                'ADMIN_SMS_DAILY_THRESHOLD', 'ADMIN_SMS_OPTIONAL_80', 'ADMIN_SMS_FORECAST');
UPDATE public.notification_types SET channels = ARRAY['IN_APP','SMS','EMAIL','PUSH'] WHERE type IN ('SUPERADMIN_PROMOTED', 'ADMIN_PHONE_CONFIRMED');
UPDATE public.notification_types SET family = 'ESSENTIAL', topic = NULL, night_policy = 'DEFER' WHERE type = 'EVENT_SUSPENDED_HOLDER';
UPDATE public.notification_types SET channels = ARRAY['IN_APP','PUSH'] WHERE type = 'NEW_ORDER';

-- 2. account_phone_finalize (recopie de 20261120000006_f3d_cv_numero_profil.sql:8-135)
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
    -- Avis phase 2 (2a, B2) : cloche et notification du téléphone au compte (même clé que l'email : une ligne par canal)
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'PHONE_CHANGED',
        'key', 'PHONE_CHANGED:' || v_user::text || ':' || txid_current()::text || ':compte',
        'user_id', v_user,
        'data', '{}'::jsonb,
        'channels', jsonb_build_array('IN_APP', 'PUSH')));

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

-- 3. notif_enqueue_grouped (recopie de 20261125000003_f4_ventes.sql:37-92)
CREATE OR REPLACE FUNCTION public.notif_enqueue_grouped(p jsonb)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type    text := p->>'type';
    v_scope   text := NULLIF(btrim(COALESCE(p->>'scope', '')), '');
    v_window  integer := NULLIF(p->>'window_minutes', '')::integer;
    v_add     jsonb := COALESCE(p->'add', '{}'::jsonb);
    v_now     timestamptz := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    v_prefix  text;
    v_group   text;
    v_last    timestamptz;
    v_due     timestamptz;
BEGIN
    IF v_type IS NULL OR v_scope IS NULL OR v_window IS NULL OR v_window < 1 OR jsonb_typeof(v_add) <> 'object' THEN
        RAISE EXCEPTION USING ERRCODE = 'NT004', MESSAGE = 'Avis groupé : type, série, fenêtre ou compteurs absents.';
    END IF;
    v_prefix := v_type || ':' || v_scope || ':';
    PERFORM pg_advisory_xact_lock(hashtextextended('notif-group:' || v_prefix, 0));

    SELECT o.group_key INTO v_group
      FROM public.notification_outbox o
     WHERE o.type = v_type AND left(o.group_key, length(v_prefix)) = v_prefix AND o.status = 'PENDING'
       -- Avis phase 2 (2a, B14) : la notification des ventes reportée la nuit ne garde pas la série ouverte (la cloche partie,
       -- la vente suivante ouvre une série nouvelle et sa propre cloche)
       AND (v_type <> 'NEW_ORDER' OR o.channel <> 'PUSH')
     ORDER BY o.created_at DESC, o.id
     LIMIT 1;
    IF v_group IS NOT NULL THEN
        UPDATE public.notification_outbox o
           SET template_data = o.template_data || (
                   SELECT COALESCE(jsonb_object_agg(a.key,
                              to_jsonb(COALESCE(CASE WHEN o.template_data->>a.key ~ '^-?[0-9]+(\.[0-9]+)?$'
                                                     THEN (o.template_data->>a.key)::numeric END, 0) + a.value::numeric)), '{}'::jsonb)
                     FROM jsonb_each_text(v_add) AS a)
         WHERE o.group_key = v_group AND o.status = 'PENDING';
        RETURN 0;
    END IF;

    -- Avis phase 2 (2a, B14) : une seule notification des ventes en attente par série : celle de la série précédente, déjà
    -- couverte par sa cloche, est remplacée par la nouvelle (jamais une rafale de notifications à la fin de la nuit)
    IF v_type = 'NEW_ORDER' THEN
        UPDATE public.notification_outbox o
           SET status = 'CANCELLED', reason = 'SUPERSEDED', finished_at = now()
         WHERE o.type = v_type AND left(o.group_key, length(v_prefix)) = v_prefix AND o.channel = 'PUSH' AND o.status = 'PENDING';
    END IF;
    SELECT max(o.due_at) INTO v_last
      FROM public.notification_outbox o
     WHERE o.type = v_type AND left(o.group_key, length(v_prefix)) = v_prefix;
    v_due := GREATEST(v_now, COALESCE(v_last + make_interval(mins => v_window), v_now),
                      COALESCE(NULLIF(p->>'not_before', '')::timestamptz, v_now));
    RETURN public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
        'type', v_type,
        'key', v_prefix || gen_random_uuid()::text,
        'user_id', p->>'user_id',
        'event_id', p->>'event_id',
        'due_at', v_due,
        'now', p->>'now',
        'channels', p->'channels',
        'data', COALESCE(p->'data', '{}'::jsonb) || v_add || jsonb_build_object('since', v_now))));
END;
$$;
REVOKE ALL ON FUNCTION public.notif_enqueue_grouped(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notif_enqueue_grouped(jsonb) TO service_role;
