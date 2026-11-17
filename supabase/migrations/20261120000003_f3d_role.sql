-- Finition 3d (recours et suppléance), point 3 — changer le rôle d'un compte (SUPERADMIN seulement), et socle commun des
-- actions sensibles de la finition (« mot de passe et code administrateur »).
--
-- 1. public.admin_identity_check(p jsonb) { user_id, session_id, device_key } → NULL si le compte a, dans CETTE session,
--    saisi son mot de passe depuis moins de 10 minutes (password_confirmations) ET, sur CET appareil, le code administrateur
--    reçu par SMS (ou un code de secours) depuis moins de 10 minutes (admin_devices.sms_verified_at) ; sinon le code du
--    refus : PASSWORD_CONFIRMATION_REQUIRED ou ADMIN_CODE_CONFIRMATION_REQUIRED. Contrôlé par la route, puis revérifié ici
--    par chaque fonction sensible.
-- 2. Type d'avis SUPERADMIN_PROMOTED : SMS (et cloche) d'alerte à chaque SUPERADMIN actif quand un compte devient SUPERADMIN.
-- 3. public.user_roles_set (recopie de 20261115000014_cvf1_promotion_admin.sql) ; changement : le rôle SUPERADMIN ne se
--    donne et ne se retire plus que par admin_role_change (ROLE_SCREEN_REQUIRED sinon) : aucun autre chemin (modification
--    d'un compte, création) ne nomme ni ne retire un SUPERADMIN sans mot de passe, code, motif ni alerte.
-- 4. public.admin_role_change(p jsonb) { actor_id, user_id, role, reason, confirm_staff_promotion, session_id, device_key } :
--    client → ADMIN, ADMIN → client, ADMIN → SUPERADMIN, SUPERADMIN → ADMIN ; SUPERADMIN actif revérifié ; mot de passe et
--    code revérifiés ; motif obligatoire ; son propre rôle seulement pour quitter le rôle de SUPERADMIN ; jamais le dernier
--    SUPERADMIN actif retiré (verrou sur les lignes SUPERADMIN : deux Superadmins qui se retirent l'un l'autre, le second
--    est refusé) ; contrôleur promu : confirmation de la finition 1 d'abord (STAFF_PROMOTION_CONFIRMATION) puis retrait des
--    équipes par user_roles_set ; retrait d'un rôle d'administration : droits effacés, sessions et appareils de confiance
--    révoqués, codes de secours annulés ; promotion en SUPERADMIN : alerte à tous les SUPERADMIN actifs ; journal
--    ADMIN_ROLE_CHANGED (motif) en plus de ROLES_SET ; une transaction.
--
-- Sans BEGIN ni COMMIT ; rejouable (CREATE OR REPLACE, ON CONFLICT, REVOKE et GRANT idempotents).

-- ----------------------------------------------------------------------------
-- 1. Mot de passe et code administrateur saisis depuis moins de 10 minutes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_identity_check(p jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user    uuid := public.try_uuid(p->>'user_id');
    v_session uuid := public.try_uuid(p->>'session_id');
    v_device  text := btrim(COALESCE(p->>'device_key', ''));
BEGIN
    IF v_user IS NULL OR v_session IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.password_confirmations pc
         WHERE pc.session_id = v_session AND pc.user_id = v_user
           AND pc.confirmed_at > clock_timestamp() - interval '10 minutes') THEN
        RETURN 'PASSWORD_CONFIRMATION_REQUIRED';
    END IF;
    IF v_device = '' OR NOT EXISTS (
        SELECT 1 FROM public.admin_devices d
         WHERE d.user_id = v_user AND d.device_key = v_device
           AND d.sms_verified_at > clock_timestamp() - interval '10 minutes') THEN
        RETURN 'ADMIN_CODE_CONFIRMATION_REQUIRED';
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_identity_check(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_identity_check(jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. Alerte aux SUPERADMIN quand un compte devient SUPERADMIN
-- ----------------------------------------------------------------------------
INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('SUPERADMIN_PROMOTED', 'ESSENTIAL', NULL, ARRAY['IN_APP','SMS'], 'ADMIN', 'ALLOW', FALSE, NULL)
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;

-- ----------------------------------------------------------------------------
-- 3. user_roles_set (recopie de 20261115000014_cvf1_promotion_admin.sql) ; changement : garde du rôle SUPERADMIN
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_roles_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := public.try_uuid(p->>'user_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_target text[];
    v_before text[];
    v_invalid text[];
    v_actor_super boolean;
    -- Migration 14
    v_staff boolean;
    v_shift jsonb;
    v_hint text;
    v_text text;
BEGIN
    IF v_user IS NULL OR v_actor IS NULL OR jsonb_typeof(p->'roles') IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Changement de rôles incomplet.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status = 'ACTIF')
       OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role IN ('ADMIN', 'SUPERADMIN')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Changement de rôles réservé à un administrateur actif.');
    END IF;
    v_actor_super := EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role = 'SUPERADMIN');

    SELECT array_agg(DISTINCT x ORDER BY x) INTO v_target
      FROM (SELECT jsonb_array_elements_text(p->'roles') AS x UNION SELECT 'CLIENT') s;
    SELECT array_agg(x ORDER BY x) INTO v_invalid
      FROM unnest(v_target) AS x
     WHERE x NOT IN (SELECT unnest(enum_range(NULL::public.user_role))::text);
    IF v_invalid IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ROLE', 'roles', to_jsonb(v_invalid), 'message', 'Rôle inconnu.');
    END IF;

    PERFORM 1 FROM public.users WHERE id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND', 'message', 'Compte introuvable.');
    END IF;
    SELECT COALESCE(array_agg(role::text ORDER BY role::text), ARRAY[]::text[]) INTO v_before
      FROM public.user_roles WHERE user_id = v_user;
    IF NOT v_actor_super AND ('SUPERADMIN' = ANY (v_target) OR 'SUPERADMIN' = ANY (v_before)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SUPERADMIN_REQUIRED', 'message', 'Seul un superadmin peut attribuer ou retirer le rôle de superadmin.');
    END IF;
    IF NOT v_actor_super AND (('ADMIN' = ANY (v_target)) IS DISTINCT FROM ('ADMIN' = ANY (v_before))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ADMIN_ROLE_SUPERADMIN_ONLY',
                                  'message', 'Seul un superadmin peut créer un administrateur ou changer ce rôle.');
    END IF;
    -- Finition 3d (point 3) : le rôle SUPERADMIN ne se donne et ne se retire que par admin_role_change (mot de passe,
    -- code, motif, dernier SUPERADMIN, alerte), qui lève le drapeau event_village.role_screen le temps de cet appel.
    IF ('SUPERADMIN' = ANY (v_target)) IS DISTINCT FROM ('SUPERADMIN' = ANY (v_before))
       AND COALESCE(current_setting('event_village.role_screen', true), '') <> 'on' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ROLE_SCREEN_REQUIRED',
                                  'message', 'Le rôle de Superadmin se donne et se retire depuis « Changer le rôle », sur la ligne du compte.');
    END IF;

    -- Migration 14 : un compte d'administration n'est jamais contrôleur. Avec ADMIN ou SUPERADMIN, CONTROLEUR est retiré.
    -- Une caisse ouverte refuse la promotion (rien ne change). Sinon, l'insertion du rôle déclenche, dans cette transaction,
    -- controller_staff_promotion_apply (affectations, invitations en attente, sessions, journal, avis aux organisatrices),
    -- avec l'auteur lu dans event_village.actor_id.
    v_staff := 'ADMIN' = ANY (v_target) OR 'SUPERADMIN' = ANY (v_target);
    IF v_staff THEN
        v_target := array_remove(v_target, 'CONTROLEUR');
        v_shift := public.controller_staff_open_shift(v_user);
        IF v_shift IS NOT NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_HAS_OPEN_SHIFT', 'event_id', v_shift->'event_id',
                                      'event_title', v_shift->'title', 'message', v_shift->>'message');
        END IF;
    END IF;
    PERFORM set_config('event_village.actor_id', v_actor::text, true);

    BEGIN
        DELETE FROM public.user_roles WHERE user_id = v_user AND NOT (role::text = ANY (v_target));
        INSERT INTO public.user_roles (user_id, role)
        SELECT v_user, x::public.user_role FROM unnest(v_target) AS x
        ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN SQLSTATE 'EV409' THEN
        -- Migration 14 : caisse ouverte entre la vérification et l'écriture (promotion) : le texte de la promotion
        GET STACKED DIAGNOSTICS v_hint = PG_EXCEPTION_HINT, v_text = MESSAGE_TEXT;
        RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_HAS_OPEN_SHIFT',
                                  'message', CASE WHEN v_hint = 'STAFF_PROMOTION_OPEN_SHIFT' THEN v_text
                                                  ELSE 'Ce contrôleur a une caisse ouverte : clôturez-la avant de lui retirer ce rôle.' END);
    END;

    -- Lot 9 bis (ex-10.0 c, B45, tâche 19) : journal ROLES_SET dans la transaction, avec l'acteur ; s'il ne s'écrit
    -- pas, l'erreur remonte et aucun rôle n'est changé.
    IF v_target IS DISTINCT FROM v_before THEN
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
        VALUES (v_actor, CASE WHEN v_actor_super THEN 'SUPERADMIN' ELSE 'ADMIN' END, 'ROLES_SET', 'users', v_user,
                jsonb_build_object('roles', to_jsonb(v_before)), jsonb_build_object('roles', to_jsonb(v_target)),
                jsonb_build_object(
                    'added', COALESCE((SELECT jsonb_agg(x ORDER BY x) FROM unnest(v_target) x WHERE NOT (x = ANY (v_before))), '[]'::jsonb),
                    'removed', COALESCE((SELECT jsonb_agg(x ORDER BY x) FROM unnest(v_before) x WHERE NOT (x = ANY (v_target))), '[]'::jsonb)));
    END IF;

    RETURN jsonb_build_object('ok', true,
        'before', to_jsonb(v_before),
        'after', to_jsonb(v_target),
        'added', COALESCE((SELECT jsonb_agg(x ORDER BY x) FROM unnest(v_target) x WHERE NOT (x = ANY (v_before))), '[]'::jsonb),
        'removed', COALESCE((SELECT jsonb_agg(x ORDER BY x) FROM unnest(v_before) x WHERE NOT (x = ANY (v_target))), '[]'::jsonb));
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Changer le rôle d'un compte (écran « Changer le rôle », SUPERADMIN seulement)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_role_change(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor      uuid := public.try_uuid(p->>'actor_id');
    v_user       uuid := public.try_uuid(p->>'user_id');
    v_role       text := upper(btrim(COALESCE(p->>'role', '')));
    v_reason     text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    v_confirm    boolean := COALESCE(p->>'confirm_staff_promotion', '') = 'true';
    v_identity   text;
    v_status     text;
    v_before     text[];
    v_level      text;
    v_target     text[];
    v_others     integer;
    v_preview    jsonb;
    v_set        jsonb;
    v_sessions   integer := 0;
    v_user_name  text;
    v_actor_name text;
    v_sa         record;
BEGIN
    IF v_actor IS NULL OR v_user IS NULL OR v_role NOT IN ('CLIENT', 'ADMIN', 'SUPERADMIN') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Changement de rôle incomplet.');
    END IF;
    -- Verrou sur toutes les lignes SUPERADMIN : deux Superadmins qui se retirent l'un l'autre en même temps, le second
    -- attend le premier, puis n'est plus SUPERADMIN (refusé ci-dessous).
    PERFORM 1 FROM public.user_roles r WHERE r.role::text = 'SUPERADMIN' ORDER BY r.user_id FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
       OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SUPERADMIN_ONLY', 'message', 'Seul un Superadmin change le rôle d’un compte.');
    END IF;
    v_identity := public.admin_identity_check(jsonb_build_object('user_id', v_actor, 'session_id', p->>'session_id', 'device_key', p->>'device_key'));
    IF v_identity IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', v_identity,
            'message', CASE v_identity WHEN 'PASSWORD_CONFIRMATION_REQUIRED' THEN 'Par sécurité, saisissez votre mot de passe pour continuer.'
                                       ELSE 'Par sécurité, saisissez le code administrateur reçu par SMS pour continuer.' END);
    END IF;
    IF v_reason IS NULL OR char_length(v_reason) < 3 OR char_length(v_reason) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif (3 à 500 caractères).');
    END IF;

    SELECT u.status::text INTO v_status FROM public.users u WHERE u.id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND', 'message', 'Compte introuvable.');
    END IF;
    SELECT COALESCE(array_agg(r.role::text ORDER BY r.role::text), ARRAY[]::text[]) INTO v_before
      FROM public.user_roles r WHERE r.user_id = v_user;
    v_level := CASE WHEN 'SUPERADMIN' = ANY (v_before) THEN 'SUPERADMIN' WHEN 'ADMIN' = ANY (v_before) THEN 'ADMIN' ELSE 'CLIENT' END;

    IF v_user = v_actor AND NOT (v_level = 'SUPERADMIN' AND v_role = 'ADMIN') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SELF_ROLE_CHANGE',
                                  'message', 'Votre propre rôle ne se change pas ici, sauf pour quitter le rôle de Superadmin.');
    END IF;
    IF v_level = v_role THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_CHANGE', 'message', 'Ce compte a déjà ce rôle.');
    END IF;
    IF NOT ((v_level = 'CLIENT' AND v_role = 'ADMIN') OR (v_level = 'ADMIN' AND v_role IN ('CLIENT', 'SUPERADMIN'))
            OR (v_level = 'SUPERADMIN' AND v_role = 'ADMIN')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED',
                                  'message', 'Ce changement se fait en deux temps : passez d’abord par Administrateur.');
    END IF;
    IF v_level = 'CLIENT' AND 'PARTENAIRE' = ANY (v_before) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_ACCOUNT',
                                  'message', 'Un compte d’organisatrice ne devient pas administrateur : créez un compte à part.');
    END IF;
    IF v_level = 'CLIENT' AND v_status <> 'ACTIF' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Seul un compte actif devient administrateur.');
    END IF;
    IF v_level = 'SUPERADMIN' THEN
        SELECT count(*) INTO v_others
          FROM public.user_roles r JOIN public.users u ON u.id = r.user_id
         WHERE r.role::text = 'SUPERADMIN' AND r.user_id <> v_user AND u.status::text = 'ACTIF';
        IF v_others = 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'LAST_SUPERADMIN',
                                      'message', 'C’est le dernier Superadmin actif : nommez d’abord un autre Superadmin.');
        END IF;
    END IF;
    -- Contrôleur qui devient administrateur : la confirmation de la finition 1 d'abord (nombre d'organisatrices)
    IF v_level = 'CLIENT' THEN
        v_preview := public.controller_staff_promotion_preview(jsonb_build_object('user_id', v_user));
        IF jsonb_typeof(v_preview->'open_shift') = 'object' THEN
            RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_HAS_OPEN_SHIFT', 'message', v_preview->'open_shift'->>'message');
        END IF;
        IF COALESCE((v_preview->>'organizers')::integer, 0) > 0 AND NOT v_confirm THEN
            RETURN jsonb_build_object('ok', false, 'code', 'STAFF_PROMOTION_CONFIRMATION', 'requires_confirmation', true,
                                      'organizers', (v_preview->>'organizers')::integer);
        END IF;
    END IF;

    v_target := CASE v_role
        WHEN 'CLIENT' THEN ARRAY(SELECT x FROM unnest(v_before) AS x WHERE x NOT IN ('ADMIN', 'SUPERADMIN'))
        WHEN 'ADMIN' THEN ARRAY(SELECT x FROM unnest(v_before) AS x WHERE x <> 'SUPERADMIN') || ARRAY['ADMIN']
        ELSE ARRAY(SELECT x FROM unnest(v_before) AS x WHERE x <> 'ADMIN') || ARRAY['SUPERADMIN'] END;
    PERFORM set_config('event_village.role_screen', 'on', true);
    v_set := public.user_roles_set(jsonb_build_object('user_id', v_user, 'actor_id', v_actor, 'roles', to_jsonb(v_target)));
    PERFORM set_config('event_village.role_screen', 'off', true);
    IF (v_set->>'ok') IS DISTINCT FROM 'true' THEN
        RETURN v_set;
    END IF;

    -- Retrait d'un rôle d'administration (vers client, ou SUPERADMIN → ADMIN) : droits effacés (un ADMIN repart sans aucun
    -- droit), sessions et appareils de confiance révoqués, codes de secours annulés
    IF v_role = 'CLIENT' OR v_level = 'SUPERADMIN' THEN
        DELETE FROM public.admin_permissions WHERE user_id = v_user;
        v_sessions := public.revoke_user_sessions(v_user);
        DELETE FROM public.admin_devices WHERE user_id = v_user;
        IF to_regclass('public.admin_backup_codes') IS NOT NULL THEN
            UPDATE public.admin_backup_codes SET revoked_at = clock_timestamp()
             WHERE user_id = v_user AND used_at IS NULL AND revoked_at IS NULL;
        END IF;
    END IF;

    SELECT NULLIF(btrim(concat_ws(' ', u.first_name, u.last_name)), '') INTO v_user_name FROM public.users u WHERE u.id = v_user;
    SELECT NULLIF(btrim(concat_ws(' ', u.first_name, u.last_name)), '') INTO v_actor_name FROM public.users u WHERE u.id = v_actor;
    -- Promotion en SUPERADMIN : alerte à chaque SUPERADMIN actif (l'auteur compris), sauf au compte promu
    IF v_role = 'SUPERADMIN' THEN
        FOR v_sa IN
            SELECT r.user_id FROM public.user_roles r JOIN public.users u ON u.id = r.user_id
             WHERE r.role::text = 'SUPERADMIN' AND u.status::text = 'ACTIF' AND r.user_id <> v_user
             ORDER BY r.user_id
        LOOP
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'SUPERADMIN_PROMOTED',
                'key', 'SUPERADMIN_PROMOTED:' || v_user::text || ':' || txid_current()::text || ':' || v_sa.user_id::text,
                'user_id', v_sa.user_id, 'actor_id', v_actor,
                'data', jsonb_build_object('user_name', COALESCE(v_user_name, 'Un compte'), 'actor_name', COALESCE(v_actor_name, 'un Superadmin'))));
        END LOOP;
    END IF;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, 'SUPERADMIN', 'ADMIN_ROLE_CHANGED', 'users', v_user,
            jsonb_build_object('role', v_level, 'roles', v_set->'before'),
            jsonb_build_object('role', v_role, 'roles', v_set->'after'),
            jsonb_build_object('reason', v_reason, 'sessions_revoked', v_sessions));

    RETURN jsonb_build_object('ok', true, 'role_before', v_level, 'role_after', v_role,
                              'before', v_set->'before', 'after', v_set->'after', 'sessions_revoked', v_sessions);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_role_change(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_role_change(jsonb) TO service_role;
