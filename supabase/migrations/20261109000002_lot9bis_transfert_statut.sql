-- ============================================================================
-- EVENT VILLAGE — LOT 9 BIS : statut de transfert DECLINED (tâche 23/R46 ; contrat M02, section 3.1, B55)
-- ============================================================================
-- DECLINED : transfert refusé par son destinataire (ticket_transfer_decline, M08, S-C). Le billet reste à
-- l'expéditeur ; une invitation refusée annule le billet et rend la place. La colonne declined_at et la contrainte
-- « DECLINED ⇒ declined_at » sont posées par M08.
-- Valeur ajoutée SEULE dans ce fichier : une valeur ajoutée par ALTER TYPE … ADD VALUE ne peut pas être utilisée
-- dans la transaction qui l'ajoute (précédent : 20261101000001_lot3_statuts.sql). Rejouable : IF NOT EXISTS ;
-- aucun BEGIN ni COMMIT.
-- ============================================================================

ALTER TYPE public.ticket_transfer_status ADD VALUE IF NOT EXISTS 'DECLINED';
