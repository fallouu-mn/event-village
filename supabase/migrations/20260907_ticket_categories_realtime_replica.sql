-- ================================================================
-- EVENT VILLAGE — MIGRATION REALTIME PUBLICATION SUR TICKET_CATEGORIES
-- Active REPLICA IDENTITY FULL sur ticket_categories et l'ajoute 
-- à supabase_realtime pour les abonnements frontend instantanés
-- ================================================================

ALTER TABLE public.ticket_categories REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'ticket_categories'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_categories;
    END IF;
END $$;
