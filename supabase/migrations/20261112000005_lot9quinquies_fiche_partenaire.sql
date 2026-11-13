-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUINQUIES : droits de la partenaire selon le statut de sa fiche (A9, contre-vérification du
-- lot 9 quater, point 2)
-- ============================================================================
-- Avant : is_partner_owner (20261111000003_lot9quater_droits.sql) ne lisait que le statut du COMPTE (ACTIF ou
--   EN_ATTENTE) : une fiche partenaire EN_ATTENTE ou REJETE (par exemple remise en attente après validation) gardait,
--   par la REST, la lecture et la gestion de ses événements, catégories, billets, salles, tables, produits, commandes,
--   paiements et remboursements (politiques de 0003_rls.sql et suivantes).
-- Désormais (décision du chef de projet) : la fiche doit être VALIDE. SUSPENDU est gardé (décision du lot 6 : un
--   partenaire suspendu garde ses lectures ; ses actions sont refusées par leurs contrôles, lot 9 quater A6). Le compte
--   reste exigé ACTIF ou EN_ATTENTE. Les lectures permises à une fiche EN_ATTENTE (tableau de bord, profil, pièces) et le
--   complément de dossier passent par les routes de l'application (service_role, lib/auth/partner-fiche-guard.ts), jamais
--   par is_partner_owner.
-- Objet : recopie de is_partner_owner (20261111000003_lot9quater_droits.sql, section 1) ; changement : statut de la fiche.
-- Droits inchangés (CREATE OR REPLACE). Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

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
           AND p.status::text IN ('VALIDE', 'SUSPENDU')
           AND u.status::text IN ('ACTIF', 'EN_ATTENTE')
    );
$$;

COMMENT ON FUNCTION public.is_partner_owner(uuid) IS
    'Lot 9 quater (A6, AUD-06) puis lot 9 quinquies (A9) : aide RLS du groupe a. Vrai si la fiche partenaire appartient au compte appelant, que cette fiche est VALIDE (ou SUSPENDU, lectures gardées) ET que ce compte est ACTIF ou EN_ATTENTE.';
