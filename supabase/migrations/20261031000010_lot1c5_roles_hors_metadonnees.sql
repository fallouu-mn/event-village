-- ============================================================================
-- EVENT VILLAGE — LOT 1C.5 : plus de rôles dans auth.users.raw_user_meta_data
-- ============================================================================
-- sync_user_roles_to_jwt recopiait les rôles dans raw_user_meta_data (modifiable par
-- l'utilisateur, et plus lu nulle part depuis le lot 1B.1). Elle ne met plus à jour que
-- public.users.role (rôle legacy prioritaire, encore lu par quelques routes et métriques).
-- Nom conservé : le trigger trg_sync_roles_to_jwt et les inventaires du lot 1A le référencent.
-- Les clés role / roles des métadonnées existantes sont retirées.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_user_roles_to_jwt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
    v_role public.user_role;
BEGIN
    -- Agrégat sans GROUP BY : une ligne même sans aucun rôle (repli CLIENT, comme avant)
    SELECT CASE
             WHEN bool_or(ur.role = 'SUPERADMIN') THEN 'SUPERADMIN'::public.user_role
             WHEN bool_or(ur.role = 'ADMIN')      THEN 'ADMIN'::public.user_role
             WHEN bool_or(ur.role = 'PARTENAIRE') THEN 'PARTENAIRE'::public.user_role
             WHEN bool_or(ur.role = 'CONTROLEUR') THEN 'CONTROLEUR'::public.user_role
             ELSE 'CLIENT'::public.user_role
           END
      INTO v_role
      FROM public.user_roles ur
     WHERE ur.user_id = v_user_id;

    UPDATE public.users SET role = v_role WHERE id = v_user_id AND role IS DISTINCT FROM v_role;
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.sync_user_roles_to_jwt() IS
    'Recalcule public.users.role (rôle legacy prioritaire) depuis user_roles. N''écrit plus dans auth.users (lot 1C.5) ; nom historique conservé.';

UPDATE auth.users
   SET raw_user_meta_data = raw_user_meta_data - 'role' - 'roles'
 WHERE raw_user_meta_data ?| ARRAY['role', 'roles'];
