-- ============================================================================
-- EVENT VILLAGE — LOT 9 TER : statut de transfert ADMITTED (tâche 9t.17 ; contrat, section C.3.2)
-- ============================================================================
-- ADMITTED : transfert d'invitation clos par la liste des invités (entrée validée à la porte avant toute réclamation
-- dans l'application). Valeur ajoutée SEULE dans ce fichier (une valeur ajoutée par ALTER TYPE … ADD VALUE ne peut
-- pas servir dans la transaction qui l'ajoute) ; la contrainte ticket_transfers_admitted_chk est posée par
-- 20261110000008_lot9ter_invites.sql. Rejouable : IF NOT EXISTS ; aucun BEGIN ni COMMIT.
-- ============================================================================

ALTER TYPE public.ticket_transfer_status ADD VALUE IF NOT EXISTS 'ADMITTED';
