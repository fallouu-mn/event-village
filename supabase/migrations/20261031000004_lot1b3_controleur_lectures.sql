-- ============================================================================
-- EVENT VILLAGE — LOT 1B.3 : lectures du contrôleur
-- ============================================================================
-- tickets_read : la branche is_controller() donnait à tout contrôleur la lecture de TOUS les
-- billets. Désormais : billets des événements auxquels il est affecté (event_controllers),
-- tant qu'il détient le rôle. Les administrateurs gardent la lecture complète (is_admin()).
--
-- users_select_policy : la branche is_controller() rendait lisibles tous les profils.
-- Retirée : le nom du porteur affiché au scan est servi par /api/controller/scan et
-- /api/tickets/verify (service_role) ; aucune lecture de profil tiers côté navigateur
-- (grep dans le rapport, section 1B.3).
-- ============================================================================

DROP POLICY IF EXISTS "tickets_read" ON public.tickets;
CREATE POLICY "tickets_read" ON public.tickets
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.events e
             WHERE e.id = tickets.event_id
               AND public.is_partner_owner(e.partner_id)
        )
        OR public.is_admin()
        OR (
            public.is_controller()
            AND EXISTS (
                SELECT 1 FROM public.event_controllers ec
                 WHERE ec.event_id = tickets.event_id
                   AND ec.user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "users_select_policy" ON public.users;
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT USING (id = auth.uid() OR public.is_admin());
