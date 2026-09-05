-- Compostage atomique d'un billet avec advisory lock.
-- Empêche le double-scan si deux contrôleurs scannent le même billet simultanément.

CREATE OR REPLACE FUNCTION atomic_ticket_checkin(
    p_ticket_id UUID,
    p_controller_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status TEXT;
    v_checked_at TIMESTAMPTZ;
BEGIN
    -- Verrou advisory sur l'ID du billet (sérialisé sur la transaction)
    PERFORM pg_advisory_xact_lock(hashtext(p_ticket_id::text));

    -- Lecture du statut actuel (après le lock, donc cohérent)
    SELECT status, checked_in_at
    INTO v_current_status, v_checked_at
    FROM tickets
    WHERE id = p_ticket_id
    FOR UPDATE;

    IF v_current_status IS NULL THEN
        RETURN jsonb_build_object('error', 'TICKET_NOT_FOUND');
    END IF;

    IF v_current_status = 'UTILISE' THEN
        RETURN jsonb_build_object(
            'already_used', true,
            'checked_in_at', v_checked_at
        );
    END IF;

    IF v_current_status != 'VALIDE' THEN
        RETURN jsonb_build_object('error', 'INVALID_STATUS', 'status', v_current_status);
    END IF;

    -- Compostage
    UPDATE tickets
    SET status = 'UTILISE',
        checked_in_at = now(),
        checked_in_by = p_controller_id,
        updated_at = now()
    WHERE id = p_ticket_id;

    RETURN jsonb_build_object(
        'already_used', false,
        'checked_in_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION atomic_ticket_checkin(UUID, UUID) TO service_role;
REVOKE EXECUTE ON FUNCTION atomic_ticket_checkin(UUID, UUID) FROM PUBLIC, anon, authenticated;
