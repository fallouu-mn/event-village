-- ============================================================================
-- EVENT VILLAGE — FINITION 1, complément 12 : la propriétaire scanne ses événements avec une fiche VALIDE seulement
-- ============================================================================
-- Constat (tests/parcours/finition1-controle.test.ts, « fiche VALIDE exigée ») : scan_scanner_authorized
--   (20261112000013_lot9quinquies_affectations_fiche.sql) laissait la propriétaire de l'événement scanner avec une fiche
--   SUSPENDU (règle A9 du lot 9 quinquies, écrite pour les affectations de contrôleurs). Le complément 12 exige une fiche
--   VALIDE pour la partenaire qui scanne elle-même. Le guichet de la propriétaire l'exigeait déjà (20261115000003).
-- Correctif : recopie de scan_scanner_authorized. La propriétaire de l'événement : fiche VALIDE (même si elle s'est
--   aussi affectée comme contrôleuse) ; un contrôleur affecté : règle A9 inchangée (fiche VALIDE ou SUSPENDU : les
--   détenteurs de billets entrent toujours) ; admins inchangés. Compte ACTIF exigé, comme avant.
-- Aucun BEGIN ni COMMIT ; rejouable (CREATE OR REPLACE : droits d'exécution existants gardés).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.scan_scanner_authorized(p_scanner uuid, p_event uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_scanner AND u.status = 'ACTIF')
       AND (
             -- Propriétaire de l'événement : fiche VALIDE seulement (finition 1, complément 12)
             EXISTS (SELECT 1 FROM public.events e JOIN public.partners p ON p.id = e.partner_id
                      WHERE e.id = p_event AND p.user_id = p_scanner AND p.status::text = 'VALIDE')
             -- Contrôleur affecté (autre que la propriétaire) : fiche de l'événement VALIDE ou SUSPENDU (lot 9 quinquies, A9)
          OR (NOT EXISTS (SELECT 1 FROM public.events e JOIN public.partners p ON p.id = e.partner_id
                           WHERE e.id = p_event AND p.user_id = p_scanner)
              AND EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = p_event AND ec.user_id = p_scanner)
              AND NOT EXISTS (SELECT 1 FROM public.events e JOIN public.partners p ON p.id = e.partner_id
                               WHERE e.id = p_event AND p.status::text NOT IN ('VALIDE', 'SUSPENDU')))
          OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_scanner AND r.role = 'SUPERADMIN')
          OR (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_scanner AND r.role = 'ADMIN')
              AND EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = p_scanner AND ap.permission = 'access.operate'))
       )
$$;
