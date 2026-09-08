-- ================================================================
-- EVENT VILLAGE — MIGRATION REALTIME PUBLICATION & REPLICA IDENTITY
-- Active REPLICA IDENTITY FULL sur la table tickets pour permettre 
-- le filtrage Supabase Realtime (user_id=eq.X) sur les événements UPDATE
-- ================================================================

ALTER TABLE public.tickets REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'tickets'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
    END IF;
END $$;
