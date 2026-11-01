-- ============================================================================
-- EVENT VILLAGE — LOT 5 : sécurité urgente (tâche 5.0, contrat A2 à A5)
-- ============================================================================
-- Idempotente : peut être rejouée sans effet de bord.
--  A2. partners : anon et les comptes connectés ne lisent plus aucune donnée administrative d'un
--      partenaire (téléphone, email, pièces, motifs, compte). Lecture de sa propre fiche et lecture
--      admin conservées ; la fiche publique passe par la vue public_partners.
--  A3. ticket_categories : lecture publique limitée aux catégories actives ET visibles d'un événement
--      dans un statut public (PUBLIE, SUSPENDU, ANNULE, TERMINE) ; propriétaire et admins lisent tout.
--      Arbitrage A3/O : sold_quantity, held_quantity (et held_expires_at) ne sont plus lisibles par anon
--      ni par authenticated, ni par REST ni par Realtime (privilèges de colonne) ; le stock public
--      passe par public_category_stock (tranches, migration 20261102000006), le propriétaire et les
--      admins lisent les volumes par les routes serveur.
--  A4. payments retirée de la publication supabase_realtime.
--  A5. ticket_transfers : plus aucune écriture REST (création par la RPC ticket_transfer_initiate).
-- A1 (PATCH /api/admin/services) est corrigé dans la route ; A6 et A7 relèvent du cycle de vie (D).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A2 — partners : plus de lecture publique de la table
-- ----------------------------------------------------------------------------
-- 0003_rls.sql:109-110 (partners_read_public) : USING (status = 'VALIDE' OR user_id = auth.uid()
-- OR is_admin()) rendait toutes les colonnes d'un partenaire VALIDE lisibles par anon et tout compte
-- (phone, email, id_card_url, business_doc_url, rejection_reason, suspended_reason, user_id).
-- Grep des lectures de partners (git grep -n "from('partners')" -- app components hooks lib) : toutes
-- passent par getServiceRoleClient() ; aucune lecture côté navigateur. Les politiques des autres tables
-- qui interrogent partners le font sur la fiche de l'appelant (p.user_id = auth.uid()), toujours lisible.
DROP POLICY IF EXISTS "partners_read_public" ON public.partners;
DROP POLICY IF EXISTS "partners_select_owner_admin" ON public.partners;
CREATE POLICY "partners_select_owner_admin" ON public.partners
    FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- Fiche publique : colonnes publiques des seuls partenaires VALIDE. La vue s'exécute avec les droits de
-- son propriétaire (lecture de partners sans la politique ci-dessus) et n'expose que ces colonnes.
CREATE OR REPLACE VIEW public.public_partners
WITH (security_barrier = true) AS
SELECT p.id, p.company_name, p.logo_url, p.city, p.description, p.status
  FROM public.partners p
 WHERE p.status = 'VALIDE';
COMMENT ON VIEW public.public_partners IS
    'Lot 5 (A2) : fiche publique des partenaires VALIDE (id, nom, logo, ville, description, statut), sans aucune donnée administrative.';
REVOKE ALL ON public.public_partners FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_partners TO anon, authenticated;
GRANT ALL ON public.public_partners TO service_role;

-- ----------------------------------------------------------------------------
-- A3 — ticket_categories : lecture publique restreinte
-- ----------------------------------------------------------------------------
-- 0003_rls.sql:141-146 (ticket_categories_read_public) : USING (is_active = TRUE OR propriétaire OR
-- is_admin()) : une catégorie active était lisible par tous, masquée ou non, quel que soit le statut de
-- l'événement (brouillon, en attente, validé).
--
-- Statuts publics d'un événement, lus sans passer par la politique de events (qui ne rend à anon que
-- les PUBLIE) : la vue n'expose que l'identifiant et le statut des événements déjà publics.
CREATE OR REPLACE VIEW public.events_public_status
WITH (security_barrier = true) AS
SELECT e.id, e.status
  FROM public.events e
 WHERE e.status::text IN ('PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE');
COMMENT ON VIEW public.events_public_status IS
    'Lot 5 (A3) : identifiant et statut des événements dans un statut public (PUBLIE, SUSPENDU, ANNULE, TERMINE), pour la politique de lecture de ticket_categories.';
REVOKE ALL ON public.events_public_status FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.events_public_status TO anon, authenticated;
GRANT ALL ON public.events_public_status TO service_role;

DROP POLICY IF EXISTS "ticket_categories_read_public" ON public.ticket_categories;
CREATE POLICY "ticket_categories_read_public" ON public.ticket_categories
    FOR SELECT USING (
        (ticket_categories.is_active AND ticket_categories.is_visible
            AND EXISTS (SELECT 1 FROM public.events_public_status s WHERE s.id = ticket_categories.event_id))
        OR EXISTS (SELECT 1 FROM public.events e
                    WHERE e.id = ticket_categories.event_id AND public.is_partner_owner(e.partner_id))
        OR public.is_admin()
    );

-- Volumes de vente : plus de privilège de lecture pour anon ni authenticated (REST et Realtime : la
-- diffusion Realtime filtre les colonnes non lisibles par le rôle de l'abonné). Le privilège de table
-- est remplacé par un privilège sur chaque autre colonne existante. Une colonne ajoutée plus tard à
-- ticket_categories doit recevoir son GRANT SELECT (colonne) explicite pour rester lisible.
REVOKE SELECT ON TABLE public.ticket_categories FROM anon, authenticated;
DO $$
DECLARE
    v_cols text;
BEGIN
    SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position) INTO v_cols
      FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.table_name = 'ticket_categories'
       AND c.column_name NOT IN ('sold_quantity', 'held_quantity', 'held_expires_at');
    IF v_cols IS NULL THEN
        RAISE EXCEPTION 'ticket_categories : aucune colonne à accorder';
    END IF;
    EXECUTE format('GRANT SELECT (%s) ON TABLE public.ticket_categories TO anon, authenticated', v_cols);
END;
$$;

-- ----------------------------------------------------------------------------
-- A4 — payments retirée de la publication Realtime
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'payments') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.payments;
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- A5 — ticket_transfers : aucune écriture REST
-- ----------------------------------------------------------------------------
-- 20260908000001_ticket_transfers_p2p.sql:98-114 : ticket_transfers_insert WITH CHECK (from_user_id =
-- auth.uid() OR is_admin()) ne vérifiait pas le porteur du billet : un compte connecté posait un
-- transfert PENDING sur le billet d'autrui (l'index unique des PENDING bloquait alors le porteur).
-- Toutes les écritures passent par le service_role (RPC ticket_transfer_initiate, _cancel, _claim,
-- ticket_transfers_expire). Lecture par l'émetteur, le destinataire et les admins conservée.
DROP POLICY IF EXISTS "ticket_transfers_insert" ON public.ticket_transfers;
DROP POLICY IF EXISTS "ticket_transfers_update_admin" ON public.ticket_transfers;
DROP POLICY IF EXISTS "ticket_transfers_delete_admin" ON public.ticket_transfers;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.ticket_transfers FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ticket_transfers TO service_role;
