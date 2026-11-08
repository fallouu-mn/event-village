-- ============================================================================
-- EVENT VILLAGE — LOT 9 (9.1) : découverte, ville du client et classement « Populaires »
-- ============================================================================
-- Contrat : scratchpad/lot9-design.md, sections 3.1 (M3), 4.2 et 5.2 ; décisions L20, L21, L22, AR12.
-- Migration rejouable (IF NOT EXISTS, DROP … IF EXISTS, CREATE OR REPLACE) ; aucune migration gelée modifiée.
--
-- users.city : ville choisie une fois par le client, en capitales, nullable. Aucun GRANT : l'UPDATE d'authenticated
-- reste limité à ses colonnes (20261031000003), seule la route PATCH /api/profile/city écrit (service_role).
--
-- idx_tickets_created_at : sans lui, chaque calcul de Populaires balaierait toute la table des billets.
--
-- events_popular : nouvelle.
--  - Billets VALIDE et UTILISE créés depuis 168 h, tous canaux sauf INVITATION (FREE et COUNTER comptés, définition
--    « vendus » du pilotage) ; événements PUBLIE et non terminés ; global, pas par ville.
--  - Départage total et stable : ventes décroissantes, début le plus proche, id.
--  - Réservée au service_role : `sold` n'est jamais exposé, la route ne rend que les cartes du catalogue.
-- ============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_city_length;
ALTER TABLE public.users ADD CONSTRAINT users_city_length
    CHECK (city IS NULL OR char_length(city) BETWEEN 2 AND 80);

CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets (created_at);

CREATE OR REPLACE FUNCTION public.events_popular(p_limit integer DEFAULT 10)
RETURNS TABLE (event_id uuid, sold bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT t.event_id, count(*) AS sold
      FROM public.tickets t
      JOIN public.events e ON e.id = t.event_id
     WHERE t.created_at >= now() - interval '7 days'
       AND t.status IN ('VALIDE', 'UTILISE')
       AND t.sale_channel IS DISTINCT FROM 'INVITATION'
       AND e.status = 'PUBLIE'
       AND public.event_end_at(e.id) > now()
     GROUP BY t.event_id, e.id
     ORDER BY sold DESC, public.event_start_at(e.id) ASC, t.event_id ASC
     LIMIT GREATEST(p_limit, 0)
$$;

REVOKE ALL ON FUNCTION public.events_popular(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.events_popular(integer) TO service_role;
