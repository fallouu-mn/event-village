-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUATER : droits (A6 ; AUD-06)
-- ============================================================================
-- A6 (AUD-06) : les quatre aides de droits exécutables par anon et authenticated qui ignoraient le statut du compte
--   (is_partner_owner, 0003_rls.sql:33-38 ; has_role, is_controller, auth_user_role,
--   20260906000004_user_roles_multi_role.sql:192-228) exigent désormais un compte ni SUSPENDU ni SUPPRIME (ACTIF, ou
--   EN_ATTENTE : partenaire dont la fiche attend validation, qui garde son espace ; is_admin reste ACTIF seul)
--   (20261110000001_lot9ter_rls.sql:116-117). Un partenaire suspendu ne lit plus les paiements de ses acheteurs, même avec
--   un jeton encore valable. À la suspension (ou à la suppression), le compte est bloqué chez GoTrue (banned_until) :
--   aucun jeton neuf, ni par mot de passe, ni par rafraîchissement ; à la réactivation, il est débloqué. Le blocage suit
--   users.status par un trigger : tout chemin (RPC user_status_set, partner_status_set, anonymisation, écriture du
--   service_role) est couvert. La révocation des sessions existante reste dans les RPC.
-- Objets :
--   recopies (signature, droits et comportement pour un compte ACTIF inchangés ; changement : test du statut ACTIF ou EN_ATTENTE,
--   search_path fixé, noms qualifiés) : is_partner_owner(uuid), has_role(user_role), is_controller(), auth_user_role()
--   (NULL pour un compte SUSPENDU ou SUPPRIME : toute comparaison de politique est fausse) ;
--   nouvelles : users_status_sync_auth_ban() (trigger) et trigger trg_users_status_auth_ban sur public.users ;
--   reprise : comptes déjà SUSPENDU ou SUPPRIME bloqués, comptes ACTIF débloqués (sauf compte anonymisé).
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Aides de droits : compte ni SUSPENDU ni SUPPRIME (ACTIF ou EN_ATTENTE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(p_role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.user_roles r
          JOIN public.users u ON u.id = r.user_id
         WHERE r.user_id = auth.uid()
           AND r.role = p_role
           AND u.status::text IN ('ACTIF', 'EN_ATTENTE')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_controller()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((public.has_role('CONTROLEUR') OR public.has_role('ADMIN') OR public.has_role('SUPERADMIN'))
                    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status::text IN ('ACTIF', 'EN_ATTENTE')), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE
        WHEN NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status::text IN ('ACTIF', 'EN_ATTENTE')) THEN NULL
        WHEN public.has_role('SUPERADMIN') THEN 'SUPERADMIN'::user_role
        WHEN public.has_role('ADMIN')      THEN 'ADMIN'::user_role
        WHEN public.has_role('PARTENAIRE') THEN 'PARTENAIRE'::user_role
        WHEN public.has_role('CONTROLEUR') THEN 'CONTROLEUR'::user_role
        ELSE 'CLIENT'::user_role
    END;
$$;

CREATE OR REPLACE FUNCTION public.is_partner_owner(p_partner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.partners p
          JOIN public.users u ON u.id = p.user_id
         WHERE p.id = p_partner_id
           AND p.user_id = auth.uid()
           AND u.status::text IN ('ACTIF', 'EN_ATTENTE')
    );
$$;

COMMENT ON FUNCTION public.has_role(user_role) IS
    'Lot 9 quater (A6, AUD-06) : aide RLS du groupe a. Vrai si le compte appelant porte ce rôle (user_roles) ET est ACTIF ou EN_ATTENTE (jamais SUSPENDU ni SUPPRIME).';
COMMENT ON FUNCTION public.is_controller() IS
    'Lot 9 quater (A6, AUD-06) : aide RLS du groupe a. Vrai pour un CONTROLEUR, ADMIN ou SUPERADMIN dont le compte est ACTIF ou EN_ATTENTE.';
COMMENT ON FUNCTION public.auth_user_role() IS
    'Lot 9 quater (A6, AUD-06) : aide RLS du groupe a. Rôle prioritaire du compte appelant s''il est ACTIF ou EN_ATTENTE ; NULL sinon (toute comparaison est fausse).';
COMMENT ON FUNCTION public.is_partner_owner(uuid) IS
    'Lot 9 quater (A6, AUD-06) : aide RLS du groupe a. Vrai si la fiche partenaire appartient au compte appelant ET que ce compte est ACTIF ou EN_ATTENTE.';

-- Groupe a (20261031000002:123) : droits inchangés par CREATE OR REPLACE, répétés explicitement.
GRANT EXECUTE ON FUNCTION public.has_role(user_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_controller() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_user_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_partner_owner(uuid) TO anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 2. Blocage chez GoTrue qui suit users.status
-- ----------------------------------------------------------------------------
-- SUSPENDU ou SUPPRIME → auth.users.banned_until dans 100 ans (même durée que l'anonymisation,
-- lib/admin/admin.service.ts : ban_duration 876000h) : GoTrue refuse toute connexion et tout rafraîchissement.
-- ACTIF (réactivation) → débloqué. Les autres statuts (EN_ATTENTE…) ne changent rien. Un compte anonymisé
-- (adresse @deleted.eventvillage.sn) n'est jamais débloqué.
CREATE OR REPLACE FUNCTION public.users_status_sync_auth_ban()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;
    IF NEW.status::text IN ('SUSPENDU', 'SUPPRIME') THEN
        UPDATE auth.users a
           SET banned_until = now() + interval '100 years'
         WHERE a.id = NEW.id
           AND (a.banned_until IS NULL OR a.banned_until < now() + interval '99 years');
    ELSIF NEW.status::text = 'ACTIF' THEN
        UPDATE auth.users a
           SET banned_until = NULL
         WHERE a.id = NEW.id
           AND a.banned_until IS NOT NULL
           AND COALESCE(NEW.email, '') !~* '@deleted\.eventvillage\.sn$';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.users_status_sync_auth_ban() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_users_status_auth_ban ON public.users;
CREATE TRIGGER trg_users_status_auth_ban
    AFTER INSERT OR UPDATE OF status ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.users_status_sync_auth_ban();

-- Reprise (DML après la DDL) : état actuel aligné ; rejouable (chaque instruction ne touche que les lignes à reprendre).
UPDATE auth.users a
   SET banned_until = now() + interval '100 years'
  FROM public.users u
 WHERE u.id = a.id
   AND u.status::text IN ('SUSPENDU', 'SUPPRIME')
   AND (a.banned_until IS NULL OR a.banned_until < now() + interval '99 years');

UPDATE auth.users a
   SET banned_until = NULL
  FROM public.users u
 WHERE u.id = a.id
   AND u.status::text = 'ACTIF'
   AND a.banned_until IS NOT NULL
   AND COALESCE(u.email, '') !~* '@deleted\.eventvillage\.sn$';


-- ----------------------------------------------------------------------------
-- 3. Journal d'audit pseudonymisé à l'anonymisation d'un compte (A9 : AUD-33)
-- ----------------------------------------------------------------------------
-- p = { user_id, phones[], names[] } → { ok, rows }. Appelée par AdminService.anonymizeUser AVANT l'effacement du
-- profil (les valeurs d'origine sont passées par l'appelant). Dans old_value, new_value et metadata :
--  - lignes du compte (user_id ou object_id) : chaque numéro (forme à 9 chiffres, qui couvre +221…, 221… et 77…), nom,
--    prénom ou adresse donné est remplacé par « [anonymisé] » ; IP et navigateur effacés ;
--  - toute autre ligne : seuls les numéros et l'adresse (identifiants uniques) sont remplacés (un prénom courant ne doit
--    pas effacer le journal d'un autre compte).
-- Termes de moins de 3 caractères ignorés ; caractères spéciaux des expressions régulières échappés.
CREATE OR REPLACE FUNCTION public.audit_logs_pseudonymize(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user   uuid := public.try_uuid(p->>'user_id');
    v_unique text;
    v_all    text;
    v_linked integer := 0;
    v_other  integer := 0;
BEGIN
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    SELECT string_agg(regexp_replace(t, '([.+*?^$()\[\]{}|\\])', '\\\1', 'g'), '|')
      INTO v_unique
      FROM (SELECT btrim(x) AS t FROM jsonb_array_elements_text(COALESCE(p->'phones', '[]'::jsonb)) AS x) s
     WHERE length(t) >= 3;
    SELECT string_agg(regexp_replace(t, '([.+*?^$()\[\]{}|\\])', '\\\1', 'g'), '|')
      INTO v_all
      FROM (SELECT btrim(x) AS t FROM jsonb_array_elements_text(COALESCE(p->'phones', '[]'::jsonb)) AS x
            UNION ALL
            SELECT btrim(x) FROM jsonb_array_elements_text(COALESCE(p->'names', '[]'::jsonb)) AS x) s
     WHERE length(t) >= 3;

    UPDATE public.audit_logs l
       SET old_value  = CASE WHEN v_all IS NULL OR l.old_value IS NULL THEN l.old_value
                             ELSE regexp_replace(l.old_value::text, '(' || v_all || ')', '[anonymisé]', 'gi')::jsonb END,
           new_value  = CASE WHEN v_all IS NULL OR l.new_value IS NULL THEN l.new_value
                             ELSE regexp_replace(l.new_value::text, '(' || v_all || ')', '[anonymisé]', 'gi')::jsonb END,
           metadata   = CASE WHEN v_all IS NULL THEN l.metadata
                             ELSE regexp_replace(l.metadata::text, '(' || v_all || ')', '[anonymisé]', 'gi')::jsonb END,
           ip_address = NULL,
           user_agent = NULL
     WHERE l.user_id = v_user OR l.object_id = v_user;
    GET DIAGNOSTICS v_linked = ROW_COUNT;

    IF v_unique IS NOT NULL THEN
        UPDATE public.audit_logs l
           SET old_value = CASE WHEN l.old_value IS NULL THEN NULL
                                ELSE regexp_replace(l.old_value::text, '(' || v_unique || ')', '[anonymisé]', 'gi')::jsonb END,
               new_value = CASE WHEN l.new_value IS NULL THEN NULL
                                ELSE regexp_replace(l.new_value::text, '(' || v_unique || ')', '[anonymisé]', 'gi')::jsonb END,
               metadata  = regexp_replace(l.metadata::text, '(' || v_unique || ')', '[anonymisé]', 'gi')::jsonb
         WHERE (l.user_id IS DISTINCT FROM v_user AND l.object_id IS DISTINCT FROM v_user)
           AND (COALESCE(l.old_value::text, '') ~* v_unique OR COALESCE(l.new_value::text, '') ~* v_unique
                OR l.metadata::text ~* v_unique);
        GET DIAGNOSTICS v_other = ROW_COUNT;
    END IF;
    RETURN jsonb_build_object('ok', true, 'rows', v_linked + v_other);
END;
$$;
REVOKE ALL ON FUNCTION public.audit_logs_pseudonymize(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_logs_pseudonymize(jsonb) TO service_role;


-- ----------------------------------------------------------------------------
-- 4. Contrôle des entrées et caisse : permission access.operate pour un ADMIN (B4 : AUD-15)
-- ----------------------------------------------------------------------------
-- Recopies de scan_scanner_authorized (20261101000010_lot4_scan.sql:60-71) et shift_can_handle_cash
-- (20261101000011_lot4_caisse.sql:47-57). Changement : la branche « administrateur » exige un SUPERADMIN, ou un ADMIN
-- qui a la permission access.operate (« Contrôler les entrées et tenir une caisse ») dans admin_permissions. Contrôleur
-- affecté et partenaire propriétaire : inchangés. Droits inchangés (CREATE OR REPLACE ; service_role seul).
CREATE OR REPLACE FUNCTION public.scan_scanner_authorized(p_scanner uuid, p_event uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_scanner AND u.status = 'ACTIF')
       AND (EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = p_event AND ec.user_id = p_scanner)
         OR EXISTS (SELECT 1 FROM public.events e JOIN public.partners p ON p.id = e.partner_id WHERE e.id = p_event AND p.user_id = p_scanner)
         OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_scanner AND r.role = 'SUPERADMIN')
         OR (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_scanner AND r.role = 'ADMIN')
             AND EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = p_scanner AND ap.permission = 'access.operate')))
$$;

CREATE OR REPLACE FUNCTION public.shift_can_handle_cash(p_user uuid, p_event uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user AND u.status = 'ACTIF')
       AND (EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = p_event AND ec.user_id = p_user AND ec.can_accept_cash)
         OR EXISTS (SELECT 1 FROM public.events e JOIN public.partners p ON p.id = e.partner_id WHERE e.id = p_event AND p.user_id = p_user)
         OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role = 'SUPERADMIN')
         OR (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role = 'ADMIN')
             AND EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = p_user AND ap.permission = 'access.operate')))
$$;


-- ----------------------------------------------------------------------------
-- 5. Réglages de la plateforme : plus de lecture anonyme (B6 : AUD-40)
-- ----------------------------------------------------------------------------
-- La politique platform_settings_read valait USING (TRUE) (0007_superadmin_complete.sql:109-110) : un visiteur lisait
-- les 42 réglages, seuils anti-abus compris. Désormais : aucune lecture pour anon ; lecture REST réservée aux admins
-- ACTIF (is_admin()) ; l'application lit les réglages côté serveur (service_role). Vue publique
-- platform_settings_public, limitée aux réglages d'affichage :
--   features.halls_enabled, features.tables_enabled, features.orders_enabled (services visibles),
--   access.low_stock_threshold (seuil « Dernières places »), finance.service_fee_rate (frais de service affichés),
--   finance.min_paid_price (prix minimum d'une catégorie payante).
DROP POLICY IF EXISTS "platform_settings_read" ON public.platform_settings;
CREATE POLICY "platform_settings_read" ON public.platform_settings
    FOR SELECT TO authenticated USING (public.is_admin());
REVOKE SELECT ON TABLE public.platform_settings FROM anon;

CREATE OR REPLACE VIEW public.platform_settings_public
WITH (security_barrier = true) AS
    SELECT s.key, s.value
      FROM public.platform_settings s
     WHERE s.key IN ('features.halls_enabled', 'features.tables_enabled', 'features.orders_enabled',
                     'access.low_stock_threshold', 'finance.service_fee_rate', 'finance.min_paid_price');
COMMENT ON VIEW public.platform_settings_public IS
    'Lot 9 quater (B6, AUD-40) : réglages d''affichage lisibles par tous (services visibles, seuil « Dernières places », frais de service, prix minimum). Aucun seuil anti-abus.';
REVOKE ALL ON public.platform_settings_public FROM PUBLIC;
GRANT SELECT ON public.platform_settings_public TO anon, authenticated, service_role;
