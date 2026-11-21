-- ============================================================================
-- EVENT VILLAGE — LOT 11b, migration 10 : paiements et remboursements lus par le client et l'administration seulement
-- ============================================================================
-- Contre-vérification du lot 11b (docs/audit-lot11b.md, T8), pour TOUTE l'application (billets, salles, tables, et les
-- commandes à venir) : une partenaire lisait par la REST les paiements de ses clients (numéro du payeur, compte du
-- client, montant, état, quel que soit l'état de la réservation) et leurs remboursements : politiques payments_read et
-- refunds_read de 0003_rls.sql:274-291 (« OR (partner_id IS NOT NULL AND is_partner_owner(partner_id)) »), jamais
-- reprises depuis. Les recettes et les tableaux de bord de la partenaire passent par les routes serveur (rôle de service)
-- et les fonctions en base SECURITY DEFINER : aucun écran ne lit ces tables par le navigateur (vérifié : aucune lecture
-- de payments ni de refunds hors des routes serveur ; aucune fonction non SECURITY DEFINER qui les lise).
--  1. payments_read : le client (ses paiements) ou l'administration ;
--  2. refunds_read : le client (remboursements de ses paiements) ou l'administration.
-- Aucun BEGIN ni COMMIT ; rejouable (DROP POLICY IF EXISTS puis CREATE).
-- ============================================================================

DROP POLICY IF EXISTS "payments_read" ON public.payments;
CREATE POLICY "payments_read" ON public.payments
    FOR SELECT USING (
        client_id = auth.uid()
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "refunds_read" ON public.refunds;
CREATE POLICY "refunds_read" ON public.refunds
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.payments py WHERE py.id = refunds.payment_id AND py.client_id = auth.uid())
        OR public.is_admin()
    );
