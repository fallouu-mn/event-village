-- ============================================================================
-- EVENT VILLAGE — LOT 4 : données du pilotage (complément, écran au lot 5)
-- ============================================================================
--  - event_controllers.entry_point : point d'entrée facultatif de l'affectation (« Porte A »,
--    « Entrée VIP »), modifiable par le partenaire propriétaire.
--  - ticket_scans : catégorie du billet, rôle du scanneur (CONTROLEUR, PARTENAIRE, ADMIN) et point
--    d'entrée, renseignés par trigger à l'insertion, quel que soit le chemin (scan, encaissement) :
--    le point d'entrée est celui du moment du scan, un changement ultérieur ne réécrit pas l'historique.
--  - Index pour les requêtes par événement et période, et par événement et scanneur.
--  - Lecture (API et Realtime) par le seul partenaire propriétaire de l'événement et les admins ;
--    publication Realtime, filtrée par événement côté abonnement et par la RLS côté serveur.
-- ============================================================================

ALTER TABLE public.event_controllers ADD COLUMN IF NOT EXISTS entry_point TEXT;
ALTER TABLE public.event_controllers DROP CONSTRAINT IF EXISTS event_controllers_entry_point_length;
ALTER TABLE public.event_controllers ADD CONSTRAINT event_controllers_entry_point_length
    CHECK (entry_point IS NULL OR char_length(entry_point) BETWEEN 1 AND 80);

ALTER TABLE public.ticket_scans ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.ticket_categories(id) ON DELETE RESTRICT;
ALTER TABLE public.ticket_scans ADD COLUMN IF NOT EXISTS entry_point TEXT;
ALTER TABLE public.ticket_scans ADD COLUMN IF NOT EXISTS scanner_role TEXT;
ALTER TABLE public.ticket_scans DROP CONSTRAINT IF EXISTS ticket_scans_scanner_role_check;
ALTER TABLE public.ticket_scans ADD CONSTRAINT ticket_scans_scanner_role_check
    CHECK (scanner_role IS NULL OR scanner_role IN ('CONTROLEUR', 'PARTENAIRE', 'ADMIN'));
CREATE INDEX IF NOT EXISTS idx_ticket_scans_event_scanner ON public.ticket_scans (event_id, scanner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_event_category ON public.ticket_scans (event_id, category_id);

CREATE OR REPLACE FUNCTION public.ticket_scans_enrich()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_entry text;
    v_assigned boolean := FALSE;
BEGIN
    IF NEW.category_id IS NULL AND NEW.ticket_id IS NOT NULL THEN
        SELECT category_id INTO NEW.category_id FROM public.tickets WHERE id = NEW.ticket_id;
    END IF;
    IF NEW.event_id IS NOT NULL THEN
        SELECT TRUE, entry_point INTO v_assigned, v_entry
          FROM public.event_controllers WHERE event_id = NEW.event_id AND user_id = NEW.scanner_id;
        IF COALESCE(v_assigned, FALSE) THEN
            NEW.scanner_role := COALESCE(NEW.scanner_role, 'CONTROLEUR');
            NEW.entry_point := COALESCE(NEW.entry_point, v_entry);
        ELSIF EXISTS (SELECT 1 FROM public.events e JOIN public.partners p ON p.id = e.partner_id
                       WHERE e.id = NEW.event_id AND p.user_id = NEW.scanner_id) THEN
            NEW.scanner_role := COALESCE(NEW.scanner_role, 'PARTENAIRE');
        ELSIF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = NEW.scanner_id AND r.role IN ('ADMIN', 'SUPERADMIN')) THEN
            NEW.scanner_role := COALESCE(NEW.scanner_role, 'ADMIN');
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_scans_enrich ON public.ticket_scans;
CREATE TRIGGER trg_ticket_scans_enrich
    BEFORE INSERT ON public.ticket_scans
    FOR EACH ROW EXECUTE FUNCTION public.ticket_scans_enrich();

-- ── Lecture : partenaire propriétaire de l'événement et admins ──────────────
GRANT SELECT ON TABLE public.ticket_scans TO authenticated;
DROP POLICY IF EXISTS ticket_scans_owner_admin_select ON public.ticket_scans;
CREATE POLICY ticket_scans_owner_admin_select ON public.ticket_scans
    FOR SELECT TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.events e JOIN public.partners p ON p.id = e.partner_id
                    WHERE e.id = ticket_scans.event_id AND p.user_id = auth.uid())
    );

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'ticket_scans') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_scans;
    END IF;
END $$;

-- Privilèges : service_role uniquement pour la fonction du trigger
REVOKE ALL ON FUNCTION public.ticket_scans_enrich() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_scans_enrich() TO service_role;
