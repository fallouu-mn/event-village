-- Contre-vérification de la finition 3d, T4 — le rôle ADMIN exige mot de passe et code récents, comme SUPERADMIN.
-- Constat (cvf3d-3 g) : un Superadmin créait un compte ADMIN (POST /api/admin/users) sans redonner ni mot de passe ni code,
-- alors que « Changer le rôle » les exige pour faire d'un client un ADMIN.
-- Correctif en base :
--   user_roles_set (recopie de 20261120000003) : le rôle ADMIN est gardé comme SUPERADMIN : il ne se donne et ne se retire
--     qu'avec le drapeau event_village.role_screen, levé par admin_role_change ou par admin_account_admin_role ;
--   admin_account_admin_role(p) : rôle ADMIN d'un compte qui vient d'être créé (CLIENT seul, ou aucun rôle), par un
--     Superadmin actif dont le mot de passe et le code administrateur ont moins de 10 minutes (admin_identity_check,
--     revérifié ici avec la session et l'appareil) ; journal ROLES_SET par user_roles_set.
-- La route POST /api/admin/users exige d'abord requireAdminIdentity (lib/admin/identity-check.ts) ; POST
-- /api/admin/permissions aussi (grille des droits).
-- Sans BEGIN ni COMMIT ; rejouable (CREATE OR REPLACE, REVOKE et GRANT idempotents).

-- Recopie de 20261120000003_f3d_role.sql ; ajout : garde du rôle ADMIN
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
    -- Finition 3d (contre-vérification, T4) : le rôle ADMIN est gardé de même. Il ne se donne et ne se retire que par
    -- admin_role_change, ou à la création du compte par admin_account_admin_role : mot de passe et code administrateur de
    -- moins de 10 minutes, revérifiés en base dans les deux cas.
    IF ('ADMIN' = ANY (v_target)) IS DISTINCT FROM ('ADMIN' = ANY (v_before))
       AND COALESCE(current_setting('event_village.role_screen', true), '') <> 'on' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ROLE_SCREEN_REQUIRED',
                                  'message', 'Le rôle d’administrateur se donne à la création du compte ou depuis « Changer le rôle », avec votre mot de passe et le code administrateur.');
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
REVOKE ALL ON FUNCTION public.user_roles_set(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_roles_set(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_account_admin_role(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_user     uuid := public.try_uuid(p->>'user_id');
    v_identity text;
    v_before   text[];
    v_set      jsonb;
BEGIN
    IF v_actor IS NULL OR v_user IS NULL OR v_actor = v_user THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande invalide.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles r JOIN public.users u ON u.id = r.user_id
                    WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN' AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SUPERADMIN_ONLY', 'message', 'Seul un Superadmin crée un administrateur.');
    END IF;
    v_identity := public.admin_identity_check(jsonb_build_object(
        'user_id', v_actor, 'session_id', p->>'session_id', 'device_key', p->>'device_key'));
    IF v_identity IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', v_identity);
    END IF;
    PERFORM 1 FROM public.users WHERE id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND', 'message', 'Compte introuvable.');
    END IF;
    SELECT COALESCE(array_agg(role::text ORDER BY role::text), ARRAY[]::text[]) INTO v_before
      FROM public.user_roles WHERE user_id = v_user;
    IF NOT (v_before <@ ARRAY['CLIENT']::text[]) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TARGET_NOT_NEW',
                                  'message', 'Ce compte a déjà un rôle : passez par « Changer le rôle ».');
    END IF;
    PERFORM set_config('event_village.role_screen', 'on', true);
    v_set := public.user_roles_set(jsonb_build_object('user_id', v_user, 'actor_id', v_actor, 'roles', jsonb_build_array('CLIENT', 'ADMIN')));
    PERFORM set_config('event_village.role_screen', 'off', true);
    RETURN v_set;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_account_admin_role(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_account_admin_role(jsonb) TO service_role;
COMMENT ON FUNCTION public.admin_account_admin_role(jsonb) IS
    'Finition 3d (contre-vérification, T4) : rôle ADMIN d''un compte qui vient d''être créé, par un Superadmin actif dont le mot de passe et le code administrateur ont moins de 10 minutes (revérifiés ici). Service_role seul.';
