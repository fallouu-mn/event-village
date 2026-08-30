-- ============================================================================
-- EVENT VILLAGE — MIGRATION 0009 : CONTRAINTE D'EXCLUSION & CONCURRENCE SALLES
-- ============================================================================
-- Description : Extension btree_gist et contrainte d'exclusion PostgreSQL native
--               pour garantir l'impossibilité physique de doubles réservations
--               de salle sur des dates chevauchantes sous forte concurrence.
-- Référence : Cahier des Charges V3.0 (§43-§45) & Directives Techniques M7
-- ============================================================================

-- 1. Activation de l'extension btree_gist pour supporter les types scalaires (UUID) dans GiST
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Contrainte d'exclusion native PostgreSQL sur (hall_id, daterange)
-- Empêche formellement deux réservations actives (EN_ATTENTE ou CONFIRMEE)
-- de se chevaucher sur la même salle, au niveau moteur PostgreSQL.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_hall_reservations'
    ) THEN
        ALTER TABLE public.hall_reservations
        ADD CONSTRAINT no_overlapping_hall_reservations
        EXCLUDE USING gist (
            hall_id WITH =,
            daterange(start_date, end_date, '[]') WITH &&
        )
        WHERE (status IN ('EN_ATTENTE', 'CONFIRMEE'));
    END IF;
END $$;

-- 3. Fonction atomique avec verrouillage pessimiste sur la salle (SELECT FOR UPDATE)
CREATE OR REPLACE FUNCTION public.create_hall_reservation_atomic(
    p_hall_id UUID,
    p_client_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_start_time TIME DEFAULT NULL,
    p_end_time TIME DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_moratorium_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_hall RECORD;
    v_diff_days INT;
    v_day_rate NUMERIC;
    v_total_amount NUMERIC;
    v_deposit_rate NUMERIC;
    v_deposit_amount NUMERIC;
    v_balance_amount NUMERIC;
    v_moratorium DATE;
    v_reservation RECORD;
    v_conflicting_id UUID;
BEGIN
    -- 1. Verrouillage pessimiste de la salle pour sérialiser les tentatives concurrentes
    SELECT * INTO v_hall
    FROM public.halls
    WHERE id = p_hall_id AND is_active = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Salle introuvable ou indisponible.');
    END IF;

    -- 2. Validation chronologique
    IF p_end_date < p_start_date THEN
        RETURN jsonb_build_object('success', false, 'error', 'La date de fin ne peut pas être antérieure à la date de début.');
    END IF;

    -- 3. Détection stricte de conflit de dates sous verrou
    SELECT id INTO v_conflicting_id
    FROM public.hall_reservations
    WHERE hall_id = p_hall_id
      AND status IN ('EN_ATTENTE', 'CONFIRMEE')
      AND NOT (p_end_date < start_date OR p_start_date > end_date)
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'La salle est déjà réservée pour cette période (dates conflictuelles).');
    END IF;

    -- 4. Calcul de la durée en jours et des montants financiers
    v_diff_days := GREATEST(1, (p_end_date - p_start_date) + 1);
    v_day_rate := COALESCE(v_hall.price_per_day, CASE WHEN v_hall.price_per_hour IS NOT NULL THEN v_hall.price_per_hour * 8 ELSE 100000 END);
    v_total_amount := v_day_rate * v_diff_days;

    v_deposit_rate := COALESCE(v_hall.deposit_percentage, 30.00);
    v_deposit_amount := ROUND((v_total_amount * v_deposit_rate) / 100.00);
    v_balance_amount := v_total_amount - v_deposit_amount;

    -- 5. Calcul du moratoire
    IF p_moratorium_date IS NOT NULL THEN
        v_moratorium := p_moratorium_date;
    ELSE
        v_moratorium := p_start_date - INTERVAL '7 days';
        IF v_moratorium < CURRENT_DATE THEN
            v_moratorium := CURRENT_DATE + INTERVAL '2 days';
        END IF;
    END IF;

    -- 6. Insertion de la réservation
    INSERT INTO public.hall_reservations (
        hall_id,
        partner_id,
        client_id,
        start_date,
        end_date,
        start_time,
        end_time,
        total_amount,
        deposit_amount,
        balance_amount,
        moratorium_date,
        status,
        payment_status,
        notes
    ) VALUES (
        p_hall_id,
        v_hall.partner_id,
        p_client_id,
        p_start_date,
        p_end_date,
        p_start_time,
        p_end_time,
        v_total_amount,
        v_deposit_amount,
        v_balance_amount,
        v_moratorium,
        'EN_ATTENTE',
        'PENDING',
        p_notes
    )
    RETURNING * INTO v_reservation;

    RETURN jsonb_build_object(
        'success', true,
        'reservation', to_jsonb(v_reservation)
    );
EXCEPTION
    WHEN exclusion_violation THEN
        RETURN jsonb_build_object('success', false, 'error', 'La salle est déjà réservée pour cette période (dates conflictuelles).');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
