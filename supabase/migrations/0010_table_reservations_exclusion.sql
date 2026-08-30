-- ============================================================================
-- EVENT VILLAGE — MIGRATION 0010 : CONTRAINTE D'EXCLUSION & CONCURRENCE TABLES
-- ============================================================================

-- 1. Extension btree_gist
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Contrainte d'exclusion native PostgreSQL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_table_reservations'
    ) THEN
        ALTER TABLE public.table_reservations
        ADD CONSTRAINT no_overlapping_table_reservations
        EXCLUDE USING gist (
            table_id WITH =,
            tsrange(
                (reservation_date + reservation_time)::TIMESTAMP,
                (reservation_date + reservation_time)::TIMESTAMP + INTERVAL '2 hours',
                '[]'
            ) WITH &&
        )
        WHERE (status IN ('EN_ATTENTE', 'CONFIRMEE'));
    END IF;
END $$;

-- 3. Fonction atomique avec verrouillage pessimiste
CREATE OR REPLACE FUNCTION public.create_table_reservation_atomic(
    p_table_id UUID,
    p_client_id UUID,
    p_reservation_date DATE,
    p_reservation_time TIME,
    p_guest_count INT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_table RECORD;
    v_reservation RECORD;
    v_conflicting_id UUID;
BEGIN
    -- Verrouillage pessimiste de la table (verrou de ligne)
    SELECT * INTO v_table
    FROM public.restaurant_tables
    WHERE id = p_table_id AND is_active = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Table introuvable ou indisponible.');
    END IF;

    -- Vérification conflit (pas de chevauchement dans la fenêtre de 2h)
    SELECT id INTO v_conflicting_id
    FROM public.table_reservations
    WHERE table_id = p_table_id
      AND status IN ('EN_ATTENTE', 'CONFIRMEE')
      AND (
          tsrange(
              (reservation_date + reservation_time)::TIMESTAMP,
              (reservation_date + reservation_time)::TIMESTAMP + INTERVAL '2 hours',
              '[]'
          ) && tsrange(
              (p_reservation_date + p_reservation_time)::TIMESTAMP,
              (p_reservation_date + p_reservation_time)::TIMESTAMP + INTERVAL '2 hours',
              '[]'
          )
      )
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'La table est déjà réservée pour cette période (dates conflictuelles).');
    END IF;

    -- Vérification de la capacité (optionnel mais bon sens)
    IF p_guest_count > v_table.capacity THEN
        RETURN jsonb_build_object('success', false, 'error', 'Le nombre d''invités dépasse la capacité de la table.');
    END IF;

    -- Insertion de la réservation
    INSERT INTO public.table_reservations (
        partner_id,
        table_id,
        zone_id,
        client_id,
        reservation_date,
        reservation_time,
        guest_count,
        status,
        payment_status,
        special_requests,
        deposit_amount,
        is_platform_payment
    ) VALUES (
        v_table.partner_id,
        p_table_id,
        v_table.zone_id,
        p_client_id,
        p_reservation_date,
        p_reservation_time,
        p_guest_count,
        'EN_ATTENTE',
        'PENDING',
        p_notes,
        0,
        false
    )
    RETURNING * INTO v_reservation;

    RETURN jsonb_build_object(
        'success', true,
        'reservation', to_jsonb(v_reservation)
    );
EXCEPTION
    WHEN exclusion_violation THEN
        RETURN jsonb_build_object('success', false, 'error', 'La table est déjà réservée pour cette période (dates conflictuelles).');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
