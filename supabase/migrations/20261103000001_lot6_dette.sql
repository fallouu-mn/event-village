-- ============================================================================
-- EVENT VILLAGE — LOT 6, TÂCHE 6.0 : dette du lot 5 (contrat A1, A2, A4 ; amendement 1)
-- ============================================================================
-- A1 — Statut du compte dans la RLS des tables publiées.
--   Aucune politique ne lisait users.status : un compte suspendu (partenaire, admin, contrôleur, client)
--   gardait toutes ses lectures, donc toute la diffusion Realtime (Realtime évalue la RLS sous le rôle et
--   les claims de l'abonné, à chaque changement). Chaque politique SELECT des tables publiées reçoit un
--   prédicat en ligne (aucune nouvelle aide RLS : la liste blanche des 6 aides reste intacte) :
--     P_ACTIF = EXISTS (SELECT 1 FROM public.users u
--                        WHERE u.id = auth.uid() AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME'))
--   « Ni suspendu ni supprimé », et non « = ACTIF » (amendement 1) : un partenaire qui vient de s'inscrire a
--   users.status = EN_ATTENTE (app/api/partner/register/route.ts) et ces politiques régissent aussi les
--   lectures REST du navigateur. users_select_policy (lot1b3) rend sa propre ligne à tout compte connecté,
--   et le SELECT de users n'est pas révoqué : le prédicat s'évalue sous le rôle de l'abonné.
--   is_partner_owner, has_role, is_admin… ne changent pas (un partenaire suspendu garde ses lectures
--   financières par les routes service_role et les tables non publiées). La RLS ne lit que users.status :
--   la synchronisation partners.status / users.status est faite par la RPC partner_status_set (6.6).
--   Chaque expression actuelle est recopiée telle quelle depuis sa dernière migration, puis « AND P_ACTIF ».
--
-- A2 — Suppression d'un événement refusée en base hors brouillon neuf, y compris pour le service_role
--   (trigger BEFORE DELETE ; seul un superutilisateur peut le désactiver) ; TRUNCATE refusé ;
--   events_admin_manage supprimée et écritures REST révoquées sur events (les écritures légitimes passent
--   par les routes serveur en service_role et par les RPC).
--
-- A4 — hall_reservations et table_reservations (aucun abonné dans l'application) retirées de la
--   publication supabase_realtime ; orders y reste (abonnés partenaire) avec orders_read durcie (A1).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- A1 — Politiques SELECT des tables publiées
-- ----------------------------------------------------------------------------

-- ticket_scans (dernière définition : 20261101000013_lot4_pilotage.sql:65-72)
DROP POLICY IF EXISTS ticket_scans_owner_admin_select ON public.ticket_scans;
CREATE POLICY ticket_scans_owner_admin_select ON public.ticket_scans
    FOR SELECT TO authenticated
    USING (
        (
            public.is_admin()
            OR EXISTS (SELECT 1 FROM public.events e JOIN public.partners p ON p.id = e.partner_id
                        WHERE e.id = ticket_scans.event_id AND p.user_id = auth.uid())
        )
        AND EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = auth.uid() AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME'))
    );

-- scan_incidents (dernière définition : 20261102000002_lot5_dette.sql:885-892)
DROP POLICY IF EXISTS scan_incidents_owner_admin_select ON public.scan_incidents;
CREATE POLICY scan_incidents_owner_admin_select ON public.scan_incidents
    FOR SELECT TO authenticated
    USING (
        (
            public.is_admin()
            OR EXISTS (SELECT 1 FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
                        WHERE e.id = scan_incidents.event_id AND pa.user_id = auth.uid())
        )
        AND EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = auth.uid() AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME'))
    );

-- controller_shifts (20260906000002_controller_shifts.sql:61-62 et :72-79 ; 20261101000011_lot4_caisse.sql:36-37)
-- Les trois politiques n'avaient pas de clause TO (évaluées aussi pour anon) : TO authenticated ajouté.
DROP POLICY IF EXISTS controller_shifts_controller_select ON public.controller_shifts;
CREATE POLICY controller_shifts_controller_select ON public.controller_shifts
    FOR SELECT TO authenticated
    USING (
        (auth.uid() = controller_id)
        AND EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = auth.uid() AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME'))
    );

DROP POLICY IF EXISTS controller_shifts_partner_select ON public.controller_shifts;
CREATE POLICY controller_shifts_partner_select ON public.controller_shifts
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.partners p
            WHERE p.id = controller_shifts.partner_id AND p.user_id = auth.uid()
        )
        AND EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = auth.uid() AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME'))
    );

DROP POLICY IF EXISTS controller_shifts_admin_select ON public.controller_shifts;
CREATE POLICY controller_shifts_admin_select ON public.controller_shifts
    FOR SELECT TO authenticated
    USING (
        public.is_admin()
        AND EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = auth.uid() AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME'))
    );

-- event_status_history (dernière définition : 20261102000003_lot5_cycle.sql:95-100)
DROP POLICY IF EXISTS "event_status_history_read" ON public.event_status_history;
CREATE POLICY "event_status_history_read" ON public.event_status_history
    FOR SELECT TO authenticated USING (
        (
            EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_status_history.event_id AND public.is_partner_owner(e.partner_id))
            OR public.is_admin()
        )
        AND EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = auth.uid() AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME'))
    );

-- admin_signals (dernière définition : 20261102000006_lot5_temps_reel.sql:440-442)
DROP POLICY IF EXISTS "admin_signals_admin_read" ON public.admin_signals;
CREATE POLICY "admin_signals_admin_read" ON public.admin_signals
    FOR SELECT TO authenticated USING (
        public.is_admin()
        AND EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = auth.uid() AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME'))
    );

-- tickets (dernière définition : 20261031000004_lot1b3_controleur_lectures.sql:14-32) ; TO authenticated ajouté
-- (anon n'a déjà plus de privilège SELECT sur tickets, 20261102000006_lot5_temps_reel.sql).
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
                AND EXISTS (
                    SELECT 1 FROM public.event_controllers ec
                     WHERE ec.event_id = tickets.event_id
                       AND ec.user_id = auth.uid()
                )
            )
        )
        AND EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = auth.uid() AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME'))
    );

-- ticket_categories_read_public (dernière définition : 20261102000001_lot5_securite.sql:66-73)
-- La branche publique (catégorie active et visible d'un événement public) reste ouverte à tous, sans
-- condition de compte (donnée publique) ; les branches propriétaire et admin reçoivent P_ACTIF.
-- Rôles inchangés (aucune clause TO : le catalogue public est lu par anon).
DROP POLICY IF EXISTS "ticket_categories_read_public" ON public.ticket_categories;
CREATE POLICY "ticket_categories_read_public" ON public.ticket_categories
    FOR SELECT USING (
        (ticket_categories.is_active AND ticket_categories.is_visible
            AND EXISTS (SELECT 1 FROM public.events_public_status s WHERE s.id = ticket_categories.event_id))
        OR (
            (
                EXISTS (SELECT 1 FROM public.events e
                         WHERE e.id = ticket_categories.event_id AND public.is_partner_owner(e.partner_id))
                OR public.is_admin()
            )
            AND EXISTS (SELECT 1 FROM public.users u
                         WHERE u.id = auth.uid() AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME'))
        )
    );

-- ticket_categories_admin_manage FOR ALL (dernière définition : 20261031000005_lot1b4_partenaire_ecritures.sql:25-27)
-- Rôles inchangés.
DROP POLICY IF EXISTS "ticket_categories_admin_manage" ON public.ticket_categories;
CREATE POLICY "ticket_categories_admin_manage" ON public.ticket_categories
    FOR ALL
    USING (
        public.is_admin()
        AND EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = auth.uid() AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME'))
    )
    WITH CHECK (
        public.is_admin()
        AND EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = auth.uid() AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME'))
    );

-- notifications_read_own (dernière définition : 0003_rls.sql:342-343) ; P_NON_BLOQUE = P_ACTIF ; TO authenticated ajouté.
DROP POLICY IF EXISTS "notifications_read_own" ON public.notifications;
CREATE POLICY "notifications_read_own" ON public.notifications
    FOR SELECT TO authenticated USING (
        user_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = auth.uid() AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME'))
    );

-- orders_read (dernière définition : 0003_rls.sql:243-248) ; TO authenticated ajouté.
DROP POLICY IF EXISTS "orders_read" ON public.orders;
CREATE POLICY "orders_read" ON public.orders
    FOR SELECT TO authenticated USING (
        (
            client_id = auth.uid()
            OR public.is_partner_owner(partner_id)
            OR public.is_admin()
        )
        AND EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = auth.uid() AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME'))
    );


-- ----------------------------------------------------------------------------
-- A2 — Suppression d'un événement
-- ----------------------------------------------------------------------------
-- Code EV423 (même famille que la garde des statuts EV422, lot 5). Traduit par EventService.deleteEvent
-- en 409 EVENT_NOT_DELETABLE avec le message du trigger. Un brouillon déjà soumis (historique au-delà de
-- la ligne CREATION : soumission, refus, retrait) n'est plus supprimable : son historique est conservé.
-- Un brouillon neuf (seule la ligne CREATION) reste supprimable, son historique part en cascade.
CREATE OR REPLACE FUNCTION public.events_delete_guard() RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status::text <> 'BROUILLON' THEN
        RAISE EXCEPTION USING ERRCODE = 'EV423',
            MESSAGE = 'Un événement sorti du brouillon ne peut pas être supprimé : annulez-le ou laissez-le se terminer.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.event_status_history h WHERE h.event_id = OLD.id AND h.channel <> 'CREATION') THEN
        RAISE EXCEPTION USING ERRCODE = 'EV423',
            MESSAGE = 'Ce brouillon a déjà été soumis : son historique est conservé, il ne peut pas être supprimé.';
    END IF;
    RETURN OLD;
END;
$$;
COMMENT ON FUNCTION public.events_delete_guard() IS
    'Lot 6 (6.0 b) : refuse la suppression d''un événement hors brouillon, ou d''un brouillon déjà soumis (EV423), y compris pour le service_role.';
REVOKE ALL ON FUNCTION public.events_delete_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.events_delete_guard() TO service_role;

DROP TRIGGER IF EXISTS trg_events_delete_guard ON public.events;
CREATE TRIGGER trg_events_delete_guard
    BEFORE DELETE ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.events_delete_guard();

CREATE OR REPLACE FUNCTION public.events_truncate_guard() RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION USING ERRCODE = 'EV423', MESSAGE = 'La table des événements ne se vide pas.';
END;
$$;
COMMENT ON FUNCTION public.events_truncate_guard() IS
    'Lot 6 (6.0 b) : refuse tout TRUNCATE de public.events (EV423) : l''historique ne disparaît jamais par cascade.';
REVOKE ALL ON FUNCTION public.events_truncate_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.events_truncate_guard() TO service_role;

DROP TRIGGER IF EXISTS trg_events_truncate_guard ON public.events;
CREATE TRIGGER trg_events_truncate_guard
    BEFORE TRUNCATE ON public.events
    FOR EACH STATEMENT EXECUTE FUNCTION public.events_truncate_guard();

-- events_admin_manage (FOR ALL, is_admin(), 20261031000005_lot1b4_partenaire_ecritures.sql:20-22) : supprimée.
-- Sans la révocation, une écriture REST d'un ADMIN renverrait 0 ligne sans erreur (R17 exige une erreur) :
-- avec elle, toute écriture REST sur events est refusée par la base (42501). La lecture (events_read_public)
-- est inchangée.
DROP POLICY IF EXISTS "events_admin_manage" ON public.events;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.events FROM anon, authenticated;


-- ----------------------------------------------------------------------------
-- A4 — Publication supabase_realtime
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_table text;
BEGIN
    FOREACH v_table IN ARRAY ARRAY['hall_reservations', 'table_reservations'] LOOP
        IF EXISTS (SELECT 1 FROM pg_publication_tables
                    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_table) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', v_table);
        END IF;
    END LOOP;
END;
$$;
