-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUINQUIES, correctifs de la contre-vérification, point 4 : une fiche partenaire ni VALIDE ni
-- SUSPENDU rend inactives les affectations de contrôleurs de ses événements
-- ============================================================================
-- Constat (contre-vérification, run 177, tests/audit-auth/cv9qq-4 d, observation) : une partenaire dont la fiche était
--   remise EN_ATTENTE, affectée comme contrôleuse de son propre événement, passait la garde du scan (200) :
--   scan_scanner_authorized (20261111000003_lot9quater_droits.sql:238-251) ne regardait pas la fiche.
-- Règle : sur un événement dont la fiche partenaire n'est ni VALIDE ni SUSPENDU (EN_ATTENTE, REJETE…), ni les contrôleurs
--   affectés, ni la partenaire (propriétaire ou affectée à son propre événement) ne scannent ; toutes les RPC du contrôle
--   d'accès passent par scan_scanner_authorized (scan, liste d'invités, recherche manuelle, codes hors ligne, portes,
--   caisse). Leurs lectures de billets par la REST suivent la même règle (politique tickets_read). SUSPENDU garde les
--   affectations (même règle que la garde des fiches, lib/auth/partner-fiche-guard.ts). Les comptes ADMIN (permission
--   access.operate) et SUPERADMIN ne sont pas concernés.
-- Objets : controller_assignment_active(uuid) (aide RLS, groupe a : 8e de la liste blanche) ; recopies :
--   scan_scanner_authorized (20261111000003_lot9quater_droits.sql:238-251), politique tickets_read
--   (20261103000001_lot6_dette.sql:116-139).
-- L'aide ne répond que pour le compte appelant (auth.uid()) : elle ne révèle pas le statut de la fiche d'un événement
--   auquel l'appelant n'est pas affecté (faux pour anon).
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

-- Vrai si le compte appelant est affecté comme contrôleur à l'événement ET que la fiche partenaire de l'événement est
-- VALIDE ou SUSPENDU (un événement sans fiche n'est pas concerné)
CREATE OR REPLACE FUNCTION public.controller_assignment_active(p_event uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = p_event AND ec.user_id = auth.uid())
       AND NOT EXISTS (
        SELECT 1
          FROM public.events e
          JOIN public.partners p ON p.id = e.partner_id
         WHERE e.id = p_event
           AND p.status::text NOT IN ('VALIDE', 'SUSPENDU')
    );
$$;
REVOKE ALL ON FUNCTION public.controller_assignment_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.controller_assignment_active(uuid) TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.controller_assignment_active(uuid) IS
    'Lot 9 quinquies (contre-vérification, point 4) : aide RLS ; vrai si l''appelant est affecté à l''événement et que la fiche partenaire de l''événement est VALIDE ou SUSPENDU.';

-- Recopie de 20261111000003_lot9quater_droits.sql:238-251 ; changement : contrôleur affecté et partenaire seulement si la
-- fiche de l'événement est VALIDE ou SUSPENDU
CREATE OR REPLACE FUNCTION public.scan_scanner_authorized(p_scanner uuid, p_event uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_scanner AND u.status = 'ACTIF')
       AND (((EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = p_event AND ec.user_id = p_scanner)
              OR EXISTS (SELECT 1 FROM public.events e JOIN public.partners p ON p.id = e.partner_id WHERE e.id = p_event AND p.user_id = p_scanner))
             AND NOT EXISTS (SELECT 1 FROM public.events e JOIN public.partners p ON p.id = e.partner_id
                              WHERE e.id = p_event AND p.status::text NOT IN ('VALIDE', 'SUSPENDU')))
         OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_scanner AND r.role = 'SUPERADMIN')
         OR (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_scanner AND r.role = 'ADMIN')
             AND EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = p_scanner AND ap.permission = 'access.operate')))
$$;

-- Recopie de 20261103000001_lot6_dette.sql:116-139 ; changement : branche contrôleur par l'aide controller_assignment_active
-- (affectation de l'appelant ET fiche VALIDE ou SUSPENDU)
DROP POLICY IF EXISTS "tickets_read" ON public.tickets;
CREATE POLICY "tickets_read" ON public.tickets
    FOR SELECT TO authenticated USING (
        (
            user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.events e
                 WHERE e.id = tickets.event_id
                   AND public.is_partner_owner(e.partner_id)
            )
            OR public.is_admin()
            OR (
                public.is_controller()
                AND public.controller_assignment_active(tickets.event_id)
            )
        )
        AND EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = auth.uid() AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME'))
    );
