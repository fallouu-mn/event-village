-- ============================================================================
-- EVENT VILLAGE — FINITION 1, sécurité S1 (corrigée en premier) : lecture de event_controllers
-- ============================================================================
-- Constat (tests/parcours/finition1-securite.test.ts, S1 a et b) : la politique ec_select_by_creator
--   (20260904000002_event_controllers.sql:21-24, jamais reprise depuis) laissait lire une affectation à son créateur
--   (created_by = auth.uid()) sans statut du compte ni propriété actuelle de l'événement : un admin rétrogradé (rôle
--   ADMIN retiré) et une partenaire SUSPENDUE dont le jeton n'a pas expiré (jwt_expiry 3600 s) lisaient encore les
--   affectations par la REST. Même famille qu'AUD-06 (aides RLS fermées au lot 9 quater), restée ouverte ici.
-- Correctif : ec_select_by_creator supprimée ; ec_select_owner (is_partner_owner : fiche VALIDE ou SUSPENDU, compte
--   ACTIF ou EN_ATTENTE) ; ec_select_by_controller garde sa règle (sa propre ligne) avec la garde « compte non
--   suspendu ». Grep (rapport) : aucune lecture applicative de event_controllers par une session utilisateur (toutes les
--   routes lisent par le service_role), aucune publication temps réel de la table.
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. S1 — lecture de event_controllers : propriété actuelle et compte actif
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "ec_select_by_creator" ON public.event_controllers;
DROP POLICY IF EXISTS "ec_select_owner" ON public.event_controllers;
CREATE POLICY "ec_select_owner" ON public.event_controllers
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.events e
                    WHERE e.id = event_controllers.event_id AND public.is_partner_owner(e.partner_id)));

DROP POLICY IF EXISTS "ec_select_by_controller" ON public.event_controllers;
CREATE POLICY "ec_select_by_controller" ON public.event_controllers
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid())
           AND EXISTS (SELECT 1 FROM public.users u
                        WHERE u.id = (SELECT auth.uid()) AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME')));
