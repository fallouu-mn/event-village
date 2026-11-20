-- ============================================================================
-- EVENT VILLAGE — LOT 10b, migration 05 : avis du changement de droits d'un administrateur
-- ============================================================================
-- Demande du 19/11 (correctifs de la contre-vérification du lot 10b) : quand un Superadmin donne ou retire un droit (ou
-- un profil, qui n'est qu'un ensemble de droits) à un administrateur, celui-ci est prévenu sur les 4 canaux (« Vous
-- pouvez maintenant valider les salles et les établissements. » / « Vous ne pouvez plus … »), et les autres
-- Superadmins actifs reçoivent une alerte (4 canaux). Avant : seul le journal d'audit gardait le changement.
--  1. types ADMIN_PERMISSIONS_CHANGED (l'administrateur) et ADMIN_PERMISSIONS_ALERT (les autres Superadmins) ;
--  2. admin_permissions_set : recopie de 20261117000001_f3a_securite.sql:212-270 ; changement : avis mis en file dans la même
--     transaction que le changement (droits ajoutés, droits retirés, noms de l'administrateur et de l'auteur).
-- Textes dans lib/notifications/catalog.ts (libellés des droits : lib/admin/permission-labels.ts).
-- Rejouable : ON CONFLICT DO UPDATE, CREATE OR REPLACE (droits d'exécution conservés).
-- ============================================================================

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('ADMIN_PERMISSIONS_CHANGED', 'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'ADMIN', 'BLOCK', FALSE, NULL),
    ('ADMIN_PERMISSIONS_ALERT',   'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'ADMIN', 'BLOCK', FALSE, NULL)
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;

-- Recopie de 20261117000001_f3a_securite.sql:212-270 ; changement : avis à l'administrateur et alerte aux autres Superadmins.
CREATE OR REPLACE FUNCTION public.admin_permissions_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin uuid := public.try_uuid(p->>'admin_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_target record;
    v_before text[];
    v_after text[];
    -- Contre-vérification du lot 10b (demande du 19/11) : avis du changement de droits
    v_added text[];
    v_removed text[];
    v_ref text;
    v_super uuid;
    v_names record;
    v_data jsonb;
BEGIN
    IF v_actor IS NULL OR jsonb_typeof(p->'permissions') IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Changement de permissions incomplet.');
    END IF;
    -- Finition 3a (1b) : auteur SUPERADMIN (user_roles) au compte ACTIF, contrôlé en base et non plus seulement par la route
    IF NOT EXISTS (
        SELECT 1 FROM public.users u
         WHERE u.id = v_actor AND u.status::text = 'ACTIF'
           AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role::text = 'SUPERADMIN')
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN',
                                  'message', 'Seul un Superadmin actif modifie les droits d’un administrateur.');
    END IF;

    -- Finition 3a (1b) : plus aucune lecture de users.role (seulement l'adresse, pour le journal)
    SELECT id, email INTO v_target FROM public.users WHERE id = v_admin FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TARGET_NOT_FOUND', 'message', 'Administrateur cible introuvable.');
    END IF;
    -- Finition 3a (1b) : rôles de la cible lus dans user_roles, jamais dans l'ancienne colonne users.role
    IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_admin AND r.role::text = 'SUPERADMIN') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TARGET_IS_SUPERADMIN', 'message', 'Le Superadmin dispose de toutes les permissions par défaut.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_admin AND r.role::text = 'ADMIN') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TARGET_NOT_ADMIN',
                                  'message', 'Ce compte n’est pas administrateur : ses droits ne se règlent pas ici.');
    END IF;

    SELECT COALESCE(array_agg(permission ORDER BY permission), ARRAY[]::text[]) INTO v_before
      FROM public.admin_permissions WHERE user_id = v_admin;
    SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), ARRAY[]::text[]) INTO v_after
      FROM jsonb_array_elements_text(p->'permissions') AS x;

    DELETE FROM public.admin_permissions WHERE user_id = v_admin;
    INSERT INTO public.admin_permissions (user_id, permission, granted_by)
    SELECT v_admin, x, v_actor FROM unnest(v_after) AS x;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, 'SUPERADMIN', 'UPDATE_PERMISSIONS', 'admin_permissions', v_admin,
            jsonb_build_object('permissions', to_jsonb(v_before)),
            jsonb_build_object('permissions', to_jsonb(v_after)),
            jsonb_build_object('target_email', v_target.email));

    -- Contre-vérification du lot 10b (demande du 19/11) : l'administrateur est prévenu sur les 4 canaux (droits donnés,
    -- droits retirés), les autres Superadmins actifs reçoivent une alerte ; rien si les droits n'ont pas changé
    v_added := ARRAY(SELECT x FROM unnest(v_after) AS x WHERE NOT (x = ANY (v_before)) ORDER BY x);
    v_removed := ARRAY(SELECT x FROM unnest(v_before) AS x WHERE NOT (x = ANY (v_after)) ORDER BY x);
    IF cardinality(v_added) + cardinality(v_removed) > 0 THEN
        v_ref := v_admin::text || ':' || txid_current()::text;
        SELECT NULLIF(btrim(concat_ws(' ', t.first_name, t.last_name)), '') AS target_name,
               NULLIF(btrim(concat_ws(' ', a.first_name, a.last_name)), '') AS actor_name
          INTO v_names
          FROM public.users t, public.users a
         WHERE t.id = v_admin AND a.id = v_actor;
        v_data := jsonb_strip_nulls(jsonb_build_object('admin_id', v_admin, 'added', to_jsonb(v_added), 'removed', to_jsonb(v_removed),
                                                       'target_name', v_names.target_name, 'actor_name', v_names.actor_name));
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'ADMIN_PERMISSIONS_CHANGED', 'key', 'ADMIN_PERMISSIONS_CHANGED:' || v_ref,
            'user_id', v_admin, 'data', v_data));
        FOR v_super IN
            SELECT r.user_id FROM public.user_roles r JOIN public.users u ON u.id = r.user_id
             WHERE r.role::text = 'SUPERADMIN' AND u.status::text = 'ACTIF' AND r.user_id <> v_actor
             ORDER BY r.user_id
        LOOP
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'ADMIN_PERMISSIONS_ALERT', 'key', 'ADMIN_PERMISSIONS_ALERT:' || v_ref || ':' || v_super::text,
                'user_id', v_super, 'data', v_data));
        END LOOP;
    END IF;

    RETURN jsonb_build_object('ok', true, 'permissions', to_jsonb(v_after), 'before', to_jsonb(v_before));
END;
$$;
