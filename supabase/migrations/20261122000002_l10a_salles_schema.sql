-- ============================================================================
-- EVENT VILLAGE — LOT 10a, migration 02 : salles et réservations de salle (schéma, états, lecture)
-- ============================================================================
-- État des lieux du 18/11 (S1 à S6, C1 à C3) et décisions du client du lot 10a.
--  1. halls : statut de validation (EN_ATTENTE_VALIDATION, VALIDEE, REFUSEE, SUSPENDUE), acompte en pourcentage OU
--     montant fixe (jamais 0), règle d'annulation (SOUPLE, MODEREE, STRICTE), position (bornes du Sénégal, comme les
--     événements), prix en francs entiers jamais nuls (contrainte NOT VALID) ; prix par jour exigé pour être validée et
--     réservée ;
--     déclencheur trg_halls_validation_guard : le statut de validation n'est écrit que par hall_validation_decide
--     (drapeau de transaction event_village.hall_validation) ; une salle créée attend la validation si le réglage
--     halls.validation_required l'exige ; une salle refusée puis modifiée repart en attente ;
--  2. hall_reservations : état détaillé booking_state (seule source), montants figés à la réservation, échéance du
--     solde, fin de l'attente de paiement, règle d'annulation figée (cancellation_terms), annulation ;
--     status (ancien type) dérivé de booking_state par trg_a_hall_reservations_state ;
--  3. créneau hall_slot(dates, heures) : réservation à l'heure possible le même jour ; la contrainte d'exclusion
--     no_overlapping_hall_slots remplace no_overlapping_hall_reservations (dates seules) ; check_hall_availability
--     (recopie de 20261112000014_lot9quinquies_salles_concurrence.sql:25-44) compare les créneaux, sous le même verrou ;
--  4. lecture publique des salles : active et VALIDEE (sinon la partenaire propriétaire ou un admin) ; les routes publiques
--     et la réservation exigent en plus une partenaire VALIDE (la règle ne lit pas partners, refusée à anon) ;
--     lecture des réservations inchangée (client, partenaire propriétaire, admin avec le code administrateur).
-- Rejouable : ADD COLUMN IF NOT EXISTS, DROP … IF EXISTS puis ADD, CREATE OR REPLACE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Salles
-- ----------------------------------------------------------------------------
ALTER TABLE public.halls ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'EN_ATTENTE_VALIDATION';
ALTER TABLE public.halls ADD COLUMN IF NOT EXISTS validation_reason TEXT;
ALTER TABLE public.halls ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.halls ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;
ALTER TABLE public.halls ADD COLUMN IF NOT EXISTS deposit_mode TEXT NOT NULL DEFAULT 'POURCENTAGE';
ALTER TABLE public.halls ADD COLUMN IF NOT EXISTS deposit_value NUMERIC(12, 2);
ALTER TABLE public.halls ADD COLUMN IF NOT EXISTS cancellation_policy TEXT NOT NULL DEFAULT 'MODEREE';
ALTER TABLE public.halls ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.halls ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN public.halls.deposit_percentage IS
    'Ancien acompte (lot 0), plus lu depuis le lot 10a : voir deposit_mode et deposit_value.';
COMMENT ON COLUMN public.halls.deposit_value IS
    'Lot 10a : acompte en % du prix (POURCENTAGE, 1 à 100 ; vide = réglage halls.deposit_default_percent) ou en F CFA (MONTANT_FIXE, au moins 1, plafonné au prix).';

-- Acompte personnalisé de l'ancien modèle repris une fois (30 = ancien défaut, laissé au réglage)
UPDATE public.halls
   SET deposit_value = deposit_percentage
 WHERE deposit_value IS NULL AND deposit_mode = 'POURCENTAGE'
   AND deposit_percentage >= 1 AND deposit_percentage <= 100 AND deposit_percentage <> 30;

ALTER TABLE public.halls DROP CONSTRAINT IF EXISTS halls_validation_status_chk;
ALTER TABLE public.halls ADD CONSTRAINT halls_validation_status_chk
    CHECK (validation_status IN ('EN_ATTENTE_VALIDATION', 'VALIDEE', 'REFUSEE', 'SUSPENDUE'));
ALTER TABLE public.halls DROP CONSTRAINT IF EXISTS halls_deposit_chk;
ALTER TABLE public.halls ADD CONSTRAINT halls_deposit_chk CHECK (
    (deposit_mode = 'POURCENTAGE' AND (deposit_value IS NULL OR (deposit_value >= 1 AND deposit_value <= 100)))
    OR (deposit_mode = 'MONTANT_FIXE' AND deposit_value IS NOT NULL AND deposit_value >= 1 AND deposit_value = trunc(deposit_value)));
ALTER TABLE public.halls DROP CONSTRAINT IF EXISTS halls_cancellation_policy_chk;
ALTER TABLE public.halls ADD CONSTRAINT halls_cancellation_policy_chk
    CHECK (cancellation_policy IN ('SOUPLE', 'MODEREE', 'STRICTE'));
ALTER TABLE public.halls DROP CONSTRAINT IF EXISTS halls_position_chk;
ALTER TABLE public.halls ADD CONSTRAINT halls_position_chk CHECK (
    (latitude IS NULL) = (longitude IS NULL)
    AND (latitude IS NULL OR (latitude BETWEEN 12.2 AND 16.8 AND longitude BETWEEN -17.6 AND -11.3)));
-- Prix en F CFA entiers, jamais 0. Le prix par jour est obligatoire pour être validée et réservée (hall_validation_decide,
-- hall_quote) : une salle sans prix n'est ni visible ni réservable.
ALTER TABLE public.halls DROP CONSTRAINT IF EXISTS halls_price_day_required_chk;
ALTER TABLE public.halls DROP CONSTRAINT IF EXISTS halls_price_chk;
ALTER TABLE public.halls ADD CONSTRAINT halls_price_chk CHECK (
    (price_per_day IS NULL OR (price_per_day >= 1 AND price_per_day = trunc(price_per_day)))
    AND (price_per_hour IS NULL OR (price_per_hour >= 1 AND price_per_hour = trunc(price_per_hour)))) NOT VALID;

CREATE OR REPLACE FUNCTION public.halls_validation_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Écriture par hall_validation_decide (drapeau de la transaction) : rien à corriger
    IF current_setting('event_village.hall_validation', true) = 'on' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
        NEW.validation_status := CASE WHEN public.fin_setting_bool('halls.validation_required')
                                      THEN 'EN_ATTENTE_VALIDATION' ELSE 'VALIDEE' END;
        NEW.validation_reason := NULL;
        NEW.validated_by := NULL;
        NEW.validated_at := CASE WHEN NEW.validation_status = 'VALIDEE' THEN now() END;
        RETURN NEW;
    END IF;
    -- Mise à jour par la partenaire ou par une route : statut et décision gardés ; une salle refusée puis modifiée
    -- repart en attente de validation (nouvel examen)
    NEW.validation_status := OLD.validation_status;
    NEW.validation_reason := OLD.validation_reason;
    NEW.validated_by := OLD.validated_by;
    NEW.validated_at := OLD.validated_at;
    IF OLD.validation_status = 'REFUSEE' THEN
        NEW.validation_status := 'EN_ATTENTE_VALIDATION';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.halls_validation_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_halls_validation_guard ON public.halls;
CREATE TRIGGER trg_halls_validation_guard
    BEFORE INSERT OR UPDATE ON public.halls
    FOR EACH ROW EXECUTE FUNCTION public.halls_validation_guard();

-- ----------------------------------------------------------------------------
-- 2. Réservations de salle
-- ----------------------------------------------------------------------------
-- Créneau [début, fin) en heure de Dakar (UTC toute l'année, sans heure d'été) : journée entière sans heures
CREATE OR REPLACE FUNCTION public.hall_slot(p_start_date date, p_end_date date, p_start_time time, p_end_time time)
RETURNS tsrange
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
    SELECT tsrange(p_start_date + COALESCE(p_start_time, time '00:00'),
                   CASE WHEN p_end_time IS NULL THEN (p_end_date + 1) + time '00:00' ELSE p_end_date + p_end_time END,
                   '[)');
$$;

ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS booking_state TEXT;
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS booking_mode TEXT;
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS units INTEGER;
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2);
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS price_amount NUMERIC(12, 2);
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS service_fee_rate NUMERIC(5, 2);
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS service_fee_amount NUMERIC(12, 2);
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 2);
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS deposit_price NUMERIC(12, 2);
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS deposit_service_fee NUMERIC(12, 2);
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS full_payment_required BOOLEAN;
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS balance_due_at TIMESTAMPTZ;
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS cancellation_policy TEXT;
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS cancellation_terms JSONB;
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS cancel_origin TEXT;
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS refund_percent NUMERIC(5, 2);
ALTER TABLE public.hall_reservations ADD COLUMN IF NOT EXISTS slot TSRANGE
    GENERATED ALWAYS AS (public.hall_slot(start_date, end_date, start_time, end_time)) STORED;

-- Réservations de l'ancien code (aucune n'a pu être payée correctement) : état repris une fois
UPDATE public.hall_reservations
   SET booking_state = CASE
           WHEN payment_status::text = 'SUCCESS' AND status::text IN ('EN_ATTENTE', 'CONFIRMEE') THEN 'PAYEE'
           WHEN payment_status::text = 'PARTIAL' AND status::text IN ('EN_ATTENTE', 'CONFIRMEE') THEN 'ACOMPTE_PAYE'
           WHEN status::text = 'CONFIRMEE' THEN 'PAYEE'
           WHEN status::text = 'ANNULEE' AND payment_status::text IN ('SUCCESS', 'PARTIAL') THEN 'ANNULEE_SALLE'
           ELSE 'EXPIREE' END,
       paid_amount = CASE WHEN payment_status::text = 'SUCCESS' THEN total_amount ELSE paid_amount END
 WHERE booking_state IS NULL;

ALTER TABLE public.hall_reservations ALTER COLUMN booking_state SET NOT NULL;

ALTER TABLE public.hall_reservations DROP CONSTRAINT IF EXISTS hall_reservations_booking_state_chk;
ALTER TABLE public.hall_reservations ADD CONSTRAINT hall_reservations_booking_state_chk CHECK (booking_state IN (
    'EN_ATTENTE_PAIEMENT', 'ACOMPTE_PAYE', 'PAYEE', 'EXPIREE', 'DELAI_DEPASSE', 'ANNULEE_CLIENT', 'ANNULEE_SALLE', 'ANNULEE_EV'));
ALTER TABLE public.hall_reservations DROP CONSTRAINT IF EXISTS hall_reservations_mode_chk;
ALTER TABLE public.hall_reservations ADD CONSTRAINT hall_reservations_mode_chk CHECK (
    booking_mode IS NULL OR (booking_mode IN ('JOUR', 'HEURE') AND units >= 1));
ALTER TABLE public.hall_reservations DROP CONSTRAINT IF EXISTS hall_reservations_money_chk;
ALTER TABLE public.hall_reservations ADD CONSTRAINT hall_reservations_money_chk CHECK (
    paid_amount >= 0 AND refunded_amount >= 0 AND refunded_amount <= paid_amount AND paid_amount <= total_amount
    AND (price_amount IS NULL OR (price_amount >= 1 AND service_fee_amount >= 0 AND total_amount = price_amount + service_fee_amount
         AND deposit_price >= 1 AND deposit_price <= price_amount AND deposit_service_fee >= 0
         AND deposit_service_fee <= service_fee_amount AND deposit_amount = deposit_price + deposit_service_fee
         AND balance_amount = total_amount - deposit_amount)));
ALTER TABLE public.hall_reservations DROP CONSTRAINT IF EXISTS hall_reservations_policy_chk;
ALTER TABLE public.hall_reservations ADD CONSTRAINT hall_reservations_policy_chk CHECK (
    cancellation_policy IS NULL OR cancellation_policy IN ('SOUPLE', 'MODEREE', 'STRICTE'));
ALTER TABLE public.hall_reservations DROP CONSTRAINT IF EXISTS hall_reservations_cancel_origin_chk;
ALTER TABLE public.hall_reservations ADD CONSTRAINT hall_reservations_cancel_origin_chk CHECK (
    cancel_origin IS NULL OR cancel_origin IN ('CLIENT', 'SALLE', 'EVENT_VILLAGE', 'DELAI'));

COMMENT ON COLUMN public.hall_reservations.booking_state IS
    'Lot 10a : état détaillé, seule source (status est dérivé). EN_ATTENTE_PAIEMENT « En attente de paiement », ACOMPTE_PAYE « Acompte payé », PAYEE « Payée », EXPIREE « Non payée à temps », DELAI_DEPASSE « Délai de paiement dépassé », ANNULEE_CLIENT / ANNULEE_SALLE / ANNULEE_EV « Annulée ».';

-- État ancien dérivé de l'état détaillé (contrainte d'exclusion et code existant). Écriture de l'ancien état seul
-- (insertion sans état détaillé, ou changement de status sans changement de booking_state) : l'état détaillé en est
-- déduit, une attente de paiement reçoit l'échéance de halls.hold_minutes.
CREATE OR REPLACE FUNCTION public.hall_reservations_state()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.booking_state IS NULL)
       OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.booking_state IS NOT DISTINCT FROM OLD.booking_state) THEN
        NEW.booking_state := CASE NEW.status::text
            WHEN 'EN_ATTENTE' THEN 'EN_ATTENTE_PAIEMENT'
            WHEN 'CONFIRMEE' THEN CASE WHEN NEW.payment_status::text = 'PARTIAL' THEN 'ACOMPTE_PAYE' ELSE 'PAYEE' END
            WHEN 'TERMINEE' THEN 'PAYEE'
            ELSE CASE WHEN COALESCE(NEW.paid_amount, 0) > 0 THEN 'ANNULEE_SALLE' ELSE 'EXPIREE' END END;
        IF NEW.booking_state = 'EN_ATTENTE_PAIEMENT' AND NEW.hold_expires_at IS NULL THEN
            NEW.hold_expires_at := now() + make_interval(mins => public.fin_setting_num('halls.hold_minutes')::int);
        END IF;
    END IF;
    NEW.status := CASE NEW.booking_state
        WHEN 'EN_ATTENTE_PAIEMENT' THEN 'EN_ATTENTE'
        WHEN 'ACOMPTE_PAYE' THEN 'CONFIRMEE'
        WHEN 'PAYEE' THEN 'CONFIRMEE'
        ELSE 'ANNULEE' END::public.reservation_status;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.hall_reservations_state() FROM PUBLIC, anon, authenticated;

-- Nom en « trg_a_… » : déclenché avant trg_check_hall_conflict (ordre alphabétique des déclencheurs BEFORE)
DROP TRIGGER IF EXISTS trg_a_hall_reservations_state ON public.hall_reservations;
CREATE TRIGGER trg_a_hall_reservations_state
    BEFORE INSERT OR UPDATE ON public.hall_reservations
    FOR EACH ROW EXECUTE FUNCTION public.hall_reservations_state();

-- Ancien état recalculé pour les réservations reprises (une réservation non payée de l'ancien code rend la date)
UPDATE public.hall_reservations
   SET booking_state = booking_state
 WHERE status::text IS DISTINCT FROM (CASE booking_state WHEN 'EN_ATTENTE_PAIEMENT' THEN 'EN_ATTENTE'
                                                         WHEN 'ACOMPTE_PAYE' THEN 'CONFIRMEE'
                                                         WHEN 'PAYEE' THEN 'CONFIRMEE' ELSE 'ANNULEE' END);

-- ----------------------------------------------------------------------------
-- 3. Créneaux : exclusion et verrou
-- ----------------------------------------------------------------------------
ALTER TABLE public.hall_reservations DROP CONSTRAINT IF EXISTS no_overlapping_hall_reservations;
ALTER TABLE public.hall_reservations DROP CONSTRAINT IF EXISTS no_overlapping_hall_slots;
ALTER TABLE public.hall_reservations ADD CONSTRAINT no_overlapping_hall_slots
    EXCLUDE USING gist (hall_id WITH =, slot WITH &&)
    WHERE (status IN ('EN_ATTENTE', 'CONFIRMEE'));

-- Recopie de 20261112000014_lot9quinquies_salles_concurrence.sql:25-44 ; changements : créneaux (hall_slot) au lieu
-- des dates seules, rien à vérifier pour une réservation qui ne tient pas la date.
CREATE OR REPLACE FUNCTION public.check_hall_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
    IF NEW.status::text NOT IN ('EN_ATTENTE', 'CONFIRMEE') THEN
        RETURN NEW;
    END IF;
    -- Contre-vérification du lot 9 quinquies (point 5) : une réservation à la fois par salle (fin de transaction)
    PERFORM pg_advisory_xact_lock(hashtextextended('hall_reservations:' || NEW.hall_id::text, 0));
    IF EXISTS (
        SELECT 1 FROM public.hall_reservations
        WHERE hall_id = NEW.hall_id
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND status IN ('EN_ATTENTE', 'CONFIRMEE')
          AND slot && public.hall_slot(NEW.start_date, NEW.end_date, NEW.start_time, NEW.end_time)
    ) THEN
        RAISE EXCEPTION 'La salle est déjà réservée pour cette période (dates conflictuelles)';
    END IF;
    RETURN NEW;
END;
$$;

-- Colonnes du créneau et de l'état ajoutées : le changement d'état seul (booking_state) déclenche le contrôle
DROP TRIGGER IF EXISTS trg_check_hall_conflict ON public.hall_reservations;
CREATE TRIGGER trg_check_hall_conflict
    BEFORE INSERT OR UPDATE OF hall_id, start_date, end_date, start_time, end_time, status, booking_state ON public.hall_reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.check_hall_availability();

-- ----------------------------------------------------------------------------
-- 4. Lecture
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "halls_read_public" ON public.halls;
CREATE POLICY "halls_read_public" ON public.halls
    FOR SELECT USING (
        (is_active = TRUE AND validation_status = 'VALIDEE')
        OR public.is_partner_owner(partner_id)
        OR public.is_admin());
