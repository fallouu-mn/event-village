-- ============================================================================
-- EVENT VILLAGE — MIGRATION 20260906 : SUPPRESSION ATOMIQUE CONTRÔLEUR (SMART DELETE)
-- Protection contre la race condition multi-partenaires (Faille 3.3)
-- ============================================================================

CREATE OR REPLACE FUNCTION atomic_partner_remove_controller(
    p_partner_id UUID,
    p_controller_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_partner_events UUID[];
    v_remaining_count INT;
    v_new_role TEXT;
BEGIN
    -- Verrou advisory sérialisé sur le contrôleur pour éviter les suppressions concurrentes
    PERFORM pg_advisory_xact_lock(hashtext('smart_delete_' || p_controller_id::text));

    -- Verrou pessimiste FOR UPDATE sur le profil utilisateur
    PERFORM id FROM users WHERE id = p_controller_id FOR UPDATE;

    -- Récupérer tous les événements du partenaire courant
    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
    INTO v_partner_events
    FROM events
    WHERE partner_id = p_partner_id;

    -- Supprimer les affectations du partenaire courant
    IF array_length(v_partner_events, 1) > 0 THEN
        DELETE FROM event_controllers
        WHERE user_id = p_controller_id
          AND event_id = ANY(v_partner_events);
    END IF;

    -- Compter les affectations restantes sous verrou
    SELECT count(*)
    INTO v_remaining_count
    FROM event_controllers
    WHERE user_id = p_controller_id;

    -- Si 0 affectation restante, retirer CONTROLEUR de user_roles (le trigger sync users.role)
    IF v_remaining_count = 0 THEN
        DELETE FROM user_roles
        WHERE user_id = p_controller_id
          AND role = 'CONTROLEUR';
        v_new_role := 'CLIENT';
    ELSE
        v_new_role := 'CONTROLEUR';
    END IF;

    RETURN jsonb_build_object(
        'remaining_assignments', v_remaining_count,
        'is_exclusive', (v_remaining_count = 0),
        'new_role', v_new_role
    );
END;
$$;

GRANT EXECUTE ON FUNCTION atomic_partner_remove_controller(UUID, UUID) TO service_role;
REVOKE EXECUTE ON FUNCTION atomic_partner_remove_controller(UUID, UUID) FROM PUBLIC, anon, authenticated;
