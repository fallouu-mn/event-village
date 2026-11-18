-- ============================================================================
-- EVENT VILLAGE — LOT 11a, migration 03 : réservations de table (état, créneau, garde des écritures, lecture)
-- ============================================================================
-- État des lieux du 18/11 : T1 (réservation sans table, qui échappe à la règle anti-chevauchement), T5 (aucune
-- expiration), T6 (créneau de 2 h en dur), C1 et C2 (statut écrit librement par la partenaire ou une route, sans
-- verrou ni journal).
--  1. table_reservations : établissement, état détaillé booking_state (seule source), créneau propre à la
--     réservation (slot_minutes, figé à la création), montants figés (acompte par personne, acompte, frais, à payer,
--     commission), payé et remboursé, fin de l'attente de paiement, échéance de réponse, arrivée, absence,
--     annulation, paiement sur place (jamais un encaissement d'Event Village) ;
--     status (ancien type) dérivé de booking_state par trg_a_table_reservations_state ;
--  2. créneau slot = [date + heure, + slot_minutes) en heure de Dakar ; la contrainte d'exclusion
--     no_overlapping_table_slots (table_id =, slot &&) remplace no_overlapping_table_reservations (2 h en dur) ;
--     une réservation qui tient une table a toujours une table et un établissement (contrainte) ; une table réservée
--     ne peut plus être supprimée (clé étrangère RESTRICT au lieu de SET NULL) ;
--  3. garde trg_table_reservations_guard : insertion, suppression et tout changement d'état, d'argent, de table,
--     d'établissement, de date, d'heure, de nombre de personnes ou d'échéance refusés hors des fonctions en base
--     (drapeau de transaction event_village.table_booking) ; seules les demandes particulières restent modifiables ;
--  4. réservations de l'ancien code (sans établissement) : celles qui tenaient une table sont closes une fois
--     (« Non payée à temps » si elles attendaient, « Annulée par Event Village » si elles étaient confirmées) ;
--  5. lecture inchangée (client, partenaire propriétaire, admin avec le code administrateur) ; aucune écriture REST.
-- Rejouable : ADD COLUMN IF NOT EXISTS, DROP … IF EXISTS puis ADD, CREATE OR REPLACE, mises à jour idempotentes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Colonnes
-- ----------------------------------------------------------------------------
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.venues(id) ON DELETE RESTRICT;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS booking_state TEXT;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS slot_minutes INTEGER;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS deposit_per_person NUMERIC(12, 2);
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS service_fee_rate NUMERIC(5, 2);
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS service_fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 2);
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS confirmation_mode TEXT;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS response_due_at TIMESTAMPTZ;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS absent_at TIMESTAMPTZ;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS cancel_origin TEXT;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS refund_percent NUMERIC(5, 2);
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS onsite_amount NUMERIC(12, 2);
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS onsite_recorded_at TIMESTAMPTZ;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS onsite_recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.table_reservations ADD COLUMN IF NOT EXISTS slot TSRANGE
    GENERATED ALWAYS AS (tsrange(reservation_date + reservation_time,
                                 reservation_date + reservation_time + COALESCE(slot_minutes, 120) * interval '1 minute', '[)')) STORED;

CREATE INDEX IF NOT EXISTS idx_table_reservations_venue_id ON public.table_reservations(venue_id);
CREATE INDEX IF NOT EXISTS idx_table_reservations_booking_state ON public.table_reservations(booking_state);

COMMENT ON COLUMN public.table_reservations.booking_state IS
    'Lot 11a : état détaillé, seule source (status est dérivé). EN_ATTENTE_PAIEMENT « En attente de paiement », EN_ATTENTE_ACCEPTATION « En attente de réponse de l''établissement », CONFIRMEE « Confirmée », ARRIVEE « Client arrivé », ABSENT « Absent », EXPIREE « Non payée à temps », SANS_REPONSE « Sans réponse de l''établissement », REFUSEE « Refusée par l''établissement », ANNULEE_CLIENT / ANNULEE_ETABLISSEMENT / ANNULEE_EV « Annulée ».';
COMMENT ON COLUMN public.table_reservations.onsite_amount IS
    'Lot 11a (T4) : montant payé sur place, déclaré par l''établissement ; jamais une ligne de paiement ni une écriture au grand livre.';

-- ----------------------------------------------------------------------------
-- 4. Réservations de l'ancien code : état repris une fois (avant la garde)
-- ----------------------------------------------------------------------------
UPDATE public.table_reservations
   SET booking_state = CASE
           WHEN status::text = 'EN_ATTENTE' THEN 'EXPIREE'
           WHEN status::text = 'CONFIRMEE' THEN 'ANNULEE_EV'
           WHEN status::text = 'TERMINEE' THEN 'ARRIVEE'
           WHEN status::text = 'REJETEE' THEN 'REFUSEE'
           ELSE 'ANNULEE_EV' END,
       cancel_origin = CASE WHEN status::text IN ('CONFIRMEE', 'ANNULEE') THEN 'EVENT_VILLAGE' END,
       cancel_reason = CASE WHEN status::text = 'CONFIRMEE' THEN 'Ancienne réservation, close à la refonte des tables (lot 11a)' END,
       total_amount = deposit_amount + service_fee_amount,
       -- T4 : un paiement hors plateforme n'a jamais été un encaissement
       payment_status = CASE WHEN NOT is_platform_payment AND payment_status::text = 'SUCCESS' THEN 'PENDING'::public.payment_status_enum
                             ELSE payment_status END
 WHERE booking_state IS NULL;

ALTER TABLE public.table_reservations ALTER COLUMN booking_state SET NOT NULL;

ALTER TABLE public.table_reservations DROP CONSTRAINT IF EXISTS table_reservations_booking_state_chk;
ALTER TABLE public.table_reservations ADD CONSTRAINT table_reservations_booking_state_chk CHECK (booking_state IN (
    'EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_ACCEPTATION', 'CONFIRMEE', 'ARRIVEE', 'ABSENT', 'EXPIREE', 'SANS_REPONSE', 'REFUSEE',
    'ANNULEE_CLIENT', 'ANNULEE_ETABLISSEMENT', 'ANNULEE_EV'));
ALTER TABLE public.table_reservations DROP CONSTRAINT IF EXISTS table_reservations_holds_table_chk;
ALTER TABLE public.table_reservations ADD CONSTRAINT table_reservations_holds_table_chk CHECK (
    booking_state NOT IN ('EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_ACCEPTATION', 'CONFIRMEE')
    OR (table_id IS NOT NULL AND venue_id IS NOT NULL));
ALTER TABLE public.table_reservations DROP CONSTRAINT IF EXISTS table_reservations_money_chk;
ALTER TABLE public.table_reservations ADD CONSTRAINT table_reservations_money_chk CHECK (
    paid_amount >= 0 AND refunded_amount >= 0 AND refunded_amount <= paid_amount AND paid_amount <= total_amount
    AND total_amount = deposit_amount + service_fee_amount
    AND (deposit_per_person IS NULL OR deposit_amount = deposit_per_person * guest_count)
    AND (onsite_amount IS NULL OR (onsite_amount >= 1 AND onsite_amount = trunc(onsite_amount))));
ALTER TABLE public.table_reservations DROP CONSTRAINT IF EXISTS table_reservations_slot_chk;
ALTER TABLE public.table_reservations ADD CONSTRAINT table_reservations_slot_chk CHECK (
    slot_minutes IS NULL OR (slot_minutes BETWEEN 30 AND 360 AND slot_minutes % 15 = 0));
ALTER TABLE public.table_reservations DROP CONSTRAINT IF EXISTS table_reservations_mode_chk;
ALTER TABLE public.table_reservations ADD CONSTRAINT table_reservations_mode_chk CHECK (
    confirmation_mode IS NULL OR confirmation_mode IN ('AUTO', 'MANUELLE'));
ALTER TABLE public.table_reservations DROP CONSTRAINT IF EXISTS table_reservations_cancel_origin_chk;
ALTER TABLE public.table_reservations ADD CONSTRAINT table_reservations_cancel_origin_chk CHECK (
    cancel_origin IS NULL OR cancel_origin IN ('CLIENT', 'ETABLISSEMENT', 'EVENT_VILLAGE', 'SANS_REPONSE'));

-- Une table réservée ne disparaît plus (sa réservation échapperait à la règle anti-chevauchement)
ALTER TABLE public.table_reservations DROP CONSTRAINT IF EXISTS table_reservations_table_id_fkey;
ALTER TABLE public.table_reservations ADD CONSTRAINT table_reservations_table_id_fkey
    FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id) ON DELETE RESTRICT;

-- ----------------------------------------------------------------------------
-- 1 bis. Ancien état dérivé de l'état détaillé (contrainte d'exclusion, lectures de l'ancien code)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.table_reservations_state()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.status := CASE NEW.booking_state
        WHEN 'EN_ATTENTE_PAIEMENT' THEN 'EN_ATTENTE'
        WHEN 'EN_ATTENTE_ACCEPTATION' THEN 'EN_ATTENTE'
        WHEN 'CONFIRMEE' THEN 'CONFIRMEE'
        WHEN 'ARRIVEE' THEN 'CONFIRMEE'
        WHEN 'REFUSEE' THEN 'REJETEE'
        ELSE 'ANNULEE' END::public.reservation_status;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.table_reservations_state() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Garde : écritures réservées aux fonctions en base (C1, C2)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.table_reservations_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF current_setting('event_village.table_booking', true) = 'on' THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
    IF TG_OP = 'INSERT' THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Une réservation de table se crée seulement par la fonction de réservation.';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Une réservation de table ne se supprime pas.';
    END IF;
    -- Seules les demandes particulières (et la date de mise à jour) se modifient hors des fonctions en base
    -- (slot : colonne générée, recalculée après les déclencheurs BEFORE)
    IF (to_jsonb(NEW) - 'special_requests' - 'updated_at' - 'slot') IS DISTINCT FROM (to_jsonb(OLD) - 'special_requests' - 'updated_at' - 'slot') THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'L''état d''une réservation de table change seulement par les fonctions en base.';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.table_reservations_guard() FROM PUBLIC, anon, authenticated;

-- Ordre des déclencheurs BEFORE (alphabétique) : la garde, puis l'état dérivé
DROP TRIGGER IF EXISTS trg_0_table_reservations_guard ON public.table_reservations;
CREATE TRIGGER trg_0_table_reservations_guard
    BEFORE INSERT OR UPDATE OR DELETE ON public.table_reservations
    FOR EACH ROW EXECUTE FUNCTION public.table_reservations_guard();
DROP TRIGGER IF EXISTS trg_a_table_reservations_state ON public.table_reservations;
CREATE TRIGGER trg_a_table_reservations_state
    BEFORE INSERT OR UPDATE ON public.table_reservations
    FOR EACH ROW EXECUTE FUNCTION public.table_reservations_state();

-- Ancien état recalculé pour les réservations reprises
SELECT set_config('event_village.table_booking', 'on', true);
UPDATE public.table_reservations
   SET booking_state = booking_state
 WHERE status::text IS DISTINCT FROM (CASE booking_state
         WHEN 'EN_ATTENTE_PAIEMENT' THEN 'EN_ATTENTE' WHEN 'EN_ATTENTE_ACCEPTATION' THEN 'EN_ATTENTE'
         WHEN 'CONFIRMEE' THEN 'CONFIRMEE' WHEN 'ARRIVEE' THEN 'CONFIRMEE' WHEN 'REFUSEE' THEN 'REJETEE' ELSE 'ANNULEE' END);
SELECT set_config('event_village.table_booking', 'off', true);

-- ----------------------------------------------------------------------------
-- 2. Créneaux : exclusion
-- ----------------------------------------------------------------------------
ALTER TABLE public.table_reservations DROP CONSTRAINT IF EXISTS no_overlapping_table_reservations;
ALTER TABLE public.table_reservations DROP CONSTRAINT IF EXISTS no_overlapping_table_slots;
ALTER TABLE public.table_reservations ADD CONSTRAINT no_overlapping_table_slots
    EXCLUDE USING gist (table_id WITH =, slot WITH &&)
    WHERE (status IN ('EN_ATTENTE', 'CONFIRMEE'));

-- ----------------------------------------------------------------------------
-- 5. Lecture (inchangée : client, partenaire propriétaire, admin avec le code) ; aucune écriture REST
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "table_reservations_read" ON public.table_reservations;
CREATE POLICY "table_reservations_read" ON public.table_reservations
    FOR SELECT USING (
        client_id = auth.uid()
        OR public.is_partner_owner(partner_id)
        OR public.is_admin());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.table_reservations FROM anon, authenticated;

-- L'ancienne fonction (0010) ne vérifiait ni l'établissement, ni l'heure, ni la partenaire : retirée
DROP FUNCTION IF EXISTS public.create_table_reservation_atomic(uuid, uuid, date, time, integer, text);
