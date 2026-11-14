-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUINQUIES, correctifs de la contre-vérification, point 5 : réservations de salle simultanées
-- sans blocage mutuel
-- ============================================================================
-- Constat (run 177, tests/partner-halls-m7.test.ts, test 2) : deux réservations simultanées de la même salle sur des dates
--   qui se chevauchent ; l'une est refusée par « deadlock detected » (40P01) au lieu du refus de conflit de calendrier.
-- Cause : la contrainte d'exclusion no_overlapping_hall_reservations (0009_hall_reservations_exclusion.sql) vérifie le
--   conflit APRÈS avoir inséré l'entrée d'index. Quand deux insertions concurrentes qui se chevauchent ont toutes deux
--   inséré leur entrée avant de vérifier, chacune trouve l'entrée de l'autre, en cours, et attend la fin de l'autre
--   transaction : attente circulaire, PostgreSQL en annule une. Le déclencheur check_hall_availability (0002) ne voit
--   pas la ligne non validée de l'autre et ne sérialise rien. Aucun déclencheur sur partners n'intervient : le seul
--   déclencheur de l'insertion, trg_hall_reservations_notify (20261103000006), lit partners et met un avis en file
--   (notif_enqueue : INSERT … ON CONFLICT DO NOTHING sur une clé propre à la réservation), sans verrou partagé.
--   Fenêtre étroite : le blocage n'apparaît que si les deux entrées d'index précèdent les deux vérifications (vert aux
--   runs 174 et 176, rouge au run 177).
-- Correctif : check_hall_availability prend d'abord un verrou consultatif de transaction propre à la salle
--   (pg_advisory_xact_lock) : les réservations d'une même salle passent l'une après l'autre ; la seconde attend la fin de
--   la première, puis sa vérification (instantané neuf : fonction VOLATILE en lecture validée) voit la ligne validée et
--   lève le refus de conflit de calendrier. La contrainte d'exclusion reste la garantie finale.
-- Objets : recopie de check_hall_availability (0002_functions.sql:313-327) ; le déclencheur trg_check_hall_conflict
--   (0002_functions.sql:330-334) est inchangé.
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_hall_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
    -- Contre-vérification du lot 9 quinquies (point 5) : une réservation à la fois par salle (fin de transaction)
    PERFORM pg_advisory_xact_lock(hashtextextended('hall_reservations:' || NEW.hall_id::text, 0));
    IF EXISTS (
        SELECT 1 FROM public.hall_reservations
        WHERE hall_id = NEW.hall_id
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND status IN ('EN_ATTENTE', 'CONFIRMEE')
          AND NOT (NEW.end_date < start_date OR NEW.start_date > end_date)
    ) THEN
        RAISE EXCEPTION 'La salle est déjà réservée pour cette période (dates conflictuelles)';
    END IF;
    RETURN NEW;
END;
$$;
