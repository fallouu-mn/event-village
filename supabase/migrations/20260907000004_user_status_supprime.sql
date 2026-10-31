-- ============================================================================
-- EVENT VILLAGE — MIGRATION : STATUT 'SUPPRIME' DANS USER_STATUS (RGPD)
-- ============================================================================
-- Ajoute la valeur 'SUPPRIME' à l'enum user_status pour le soft delete RGPD
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'user_status' AND e.enumlabel = 'SUPPRIME'
    ) THEN
        ALTER TYPE user_status ADD VALUE 'SUPPRIME';
    END IF;
END $$;