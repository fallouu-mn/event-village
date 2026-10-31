-- ============================================================================
-- EVENT VILLAGE — LOT 1B.4 : écritures partenaire et annulations d'événement
-- ============================================================================
-- events_partner_manage et ticket_categories_partner_manage (FOR ALL, USING propriétaire)
-- laissaient un partenaire, par l'API REST : publier son brouillon sans validation, se mettre
-- en avant (is_featured), créer un événement PUBLIE, modifier sold_quantity / held_quantity.
-- Toutes les écritures applicatives sur ces tables passent par le service_role (grep dans le
-- rapport, section 1B.4) : les politiques n'accordent plus d'écriture au partenaire. La lecture
-- de ses propres événements et catégories reste assurée par events_read_public et
-- ticket_categories_read_public (branche is_partner_owner).
--
-- event_cancellations : les quatre politiques comparaient events.partner_id à
-- « SELECT partner_id FROM partners WHERE user_id = auth.uid() ». partners n'a pas de colonne
-- partner_id : PostgreSQL résolvait le nom sur events.partner_id (requête externe), la condition
-- était toujours vraie pour tout partenaire. Lecture : propriétaire de l'événement ou admin.
-- Écritures : service_role uniquement (lib/events/event-cancellation.service.ts).
-- ============================================================================

DROP POLICY IF EXISTS "events_partner_manage" ON public.events;
DROP POLICY IF EXISTS "events_admin_manage" ON public.events;
CREATE POLICY "events_admin_manage" ON public.events
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ticket_categories_partner_manage" ON public.ticket_categories;
DROP POLICY IF EXISTS "ticket_categories_admin_manage" ON public.ticket_categories;
CREATE POLICY "ticket_categories_admin_manage" ON public.ticket_categories
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "event_cancellations_select" ON public.event_cancellations;
DROP POLICY IF EXISTS "event_cancellations_insert" ON public.event_cancellations;
DROP POLICY IF EXISTS "event_cancellations_update" ON public.event_cancellations;
DROP POLICY IF EXISTS "event_cancellations_delete" ON public.event_cancellations;

CREATE POLICY "event_cancellations_select" ON public.event_cancellations
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.events e
             WHERE e.id = event_cancellations.event_id
               AND public.is_partner_owner(e.partner_id)
        )
        OR public.is_admin()
    );

REVOKE INSERT, UPDATE, DELETE ON TABLE public.event_cancellations FROM anon, authenticated;
