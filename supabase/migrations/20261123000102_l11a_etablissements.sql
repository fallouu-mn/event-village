-- ============================================================================
-- EVENT VILLAGE — LOT 11a, migration 02 : établissements (restaurant, bar, espace), horaires, zones et tables
-- ============================================================================
-- Décisions du client : un établissement est validé par l'administration avant d'être visible (réglage
-- tables.validation_required, activé), comme les salles ; zones, tables, capacité et horaires d'ouverture par jour ;
-- créneau de 2 h par défaut réglable par établissement ; réservation gratuite par défaut, acompte par personne
-- possible ; confirmation automatique ou acceptation manuelle au choix de l'établissement ; position (bornes du
-- Sénégal, comme les événements et les salles).
-- Avant ce lot, zones et tables étaient rattachées à la partenaire seule : n'importe quelle zone (même d'une autre
-- partenaire) était acceptée pour une table (clé étrangère seule).
--  1. public.venues : établissement d'une partenaire ; statut de validation écrit seulement par
--     venue_validation_decide (drapeau de transaction event_village.venue_validation, déclencheur
--     trg_venues_validation_guard) ; acompte par personne en F CFA entiers (100 à 1 000 000, vide = gratuit) ;
--     créneau 30 à 360 minutes par quart d'heure (vide = réglage tables.slot_minutes) ; confirmation AUTO ou MANUELLE ;
--  2. public.venue_opening_hours : plages par jour ISO (1 = lundi … 7 = dimanche) ; une fermeture avant l'ouverture
--     finit le lendemain (19:00-02:00) ; 00:00-24:00 = ouvert toute la journée ; écrites seulement par venue_hours_set
--     (migration 04) ; venue_open_covers(établissement, créneau) : le créneau entier est dans les plages (plages qui
--     se suivent réunies, y compris d'un jour à l'autre) ;
--  3. restaurant_zones.venue_id, restaurant_tables.venue_id : rattachement à un établissement ; déclencheur
--     trg_restaurant_venue_guard : établissement de la même partenaire, zone du même établissement, établissement
--     exigé pour une nouvelle zone ou table et jamais changé ensuite ; numéro de table unique par établissement ;
--  4. lecture : établissements actifs et validés pour tous (sinon la partenaire propriétaire ou un admin avec le
--     code) ; horaires, zones et tables lisibles quand leur établissement l'est ; aucune écriture REST (aucune
--     politique d'écriture, droits d'écriture retirés à anon et authenticated).
-- Tables d'un événement (lot 11c-a, 25/11) : le modèle d'abord prévu ici (event_id sur les zones et les tables des
-- établissements, même réservation) est ABANDONNÉ : l'annulation d'un événement, le remboursement au report et la
-- suspension de l'organisatrice ne traitent que les paiements de billets (payment_target TICKET), une table payée en
-- TABLE_RESERVATION n'aurait donc pas été remboursée. Une table d'un événement est un lot de N billets (migrations
-- 20261201000001 à …06, docs/lot11c-etat-des-lieux.md § 2.3). Commentaire seul : aucune instruction ne change.
-- Rejouable : CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, DROP … IF EXISTS puis ADD, CREATE OR REPLACE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Établissements
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
    kind TEXT NOT NULL DEFAULT 'RESTAURANT',
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    city TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    validation_status TEXT NOT NULL DEFAULT 'EN_ATTENTE_VALIDATION',
    validation_reason TEXT,
    validated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    validated_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    slot_minutes INTEGER,
    deposit_per_person NUMERIC(12, 2),
    confirmation_mode TEXT NOT NULL DEFAULT 'AUTO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.venues IS
    'Lot 11a : établissement (restaurant, bar, espace) d''une partenaire ; visible après validation par l''administration.';
COMMENT ON COLUMN public.venues.deposit_per_person IS
    'Lot 11a : acompte par personne en F CFA entiers (100 à 1 000 000) ; vide = réservation gratuite.';
COMMENT ON COLUMN public.venues.slot_minutes IS
    'Lot 11a : durée d''une réservation (30 à 360 minutes, par quart d''heure) ; vide = réglage tables.slot_minutes.';

CREATE INDEX IF NOT EXISTS idx_venues_partner_id ON public.venues(partner_id);

ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_kind_chk;
ALTER TABLE public.venues ADD CONSTRAINT venues_kind_chk CHECK (kind IN ('RESTAURANT', 'BAR', 'ESPACE'));
ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_validation_status_chk;
ALTER TABLE public.venues ADD CONSTRAINT venues_validation_status_chk
    CHECK (validation_status IN ('EN_ATTENTE_VALIDATION', 'VALIDEE', 'REFUSEE', 'SUSPENDUE'));
ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_confirmation_mode_chk;
ALTER TABLE public.venues ADD CONSTRAINT venues_confirmation_mode_chk CHECK (confirmation_mode IN ('AUTO', 'MANUELLE'));
ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_slot_chk;
ALTER TABLE public.venues ADD CONSTRAINT venues_slot_chk
    CHECK (slot_minutes IS NULL OR (slot_minutes BETWEEN 30 AND 360 AND slot_minutes % 15 = 0));
ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_deposit_chk;
ALTER TABLE public.venues ADD CONSTRAINT venues_deposit_chk CHECK (
    deposit_per_person IS NULL
    OR (deposit_per_person >= 100 AND deposit_per_person <= 1000000 AND deposit_per_person = trunc(deposit_per_person)));
ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_position_chk;
ALTER TABLE public.venues ADD CONSTRAINT venues_position_chk CHECK (
    (latitude IS NULL) = (longitude IS NULL)
    AND (latitude IS NULL OR (latitude BETWEEN 12.2 AND 16.8 AND longitude BETWEEN -17.6 AND -11.3)));
ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_name_chk;
ALTER TABLE public.venues ADD CONSTRAINT venues_name_chk CHECK (length(btrim(name)) BETWEEN 2 AND 120);

DROP TRIGGER IF EXISTS trg_venues_updated_at ON public.venues;
CREATE TRIGGER trg_venues_updated_at BEFORE UPDATE ON public.venues
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.venues_validation_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Écriture par venue_validation_decide (drapeau de la transaction) : rien à corriger
    IF current_setting('event_village.venue_validation', true) = 'on' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
        NEW.validation_status := CASE WHEN public.fin_setting_bool('tables.validation_required')
                                      THEN 'EN_ATTENTE_VALIDATION' ELSE 'VALIDEE' END;
        NEW.validation_reason := NULL;
        NEW.validated_by := NULL;
        NEW.validated_at := CASE WHEN NEW.validation_status = 'VALIDEE' THEN now() END;
        RETURN NEW;
    END IF;
    -- La partenaire d'un établissement ne change jamais (réservations, recettes)
    IF NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
        RAISE EXCEPTION 'Un établissement ne change pas de partenaire.';
    END IF;
    -- Mise à jour par la partenaire ou par une route : statut et décision gardés ; un établissement refusé puis
    -- modifié repart en attente de validation (nouvel examen)
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
REVOKE ALL ON FUNCTION public.venues_validation_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_venues_validation_guard ON public.venues;
CREATE TRIGGER trg_venues_validation_guard
    BEFORE INSERT OR UPDATE ON public.venues
    FOR EACH ROW EXECUTE FUNCTION public.venues_validation_guard();

-- ----------------------------------------------------------------------------
-- 2. Horaires d'ouverture
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.venue_opening_hours (
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    weekday SMALLINT NOT NULL,
    opens_at TIME NOT NULL,
    closes_at TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (venue_id, weekday, opens_at)
);

COMMENT ON TABLE public.venue_opening_hours IS
    'Lot 11a : plages d''ouverture par jour ISO (1 = lundi … 7 = dimanche) ; closes_at < opens_at = fermeture le lendemain ; 00:00-24:00 = toute la journée.';

ALTER TABLE public.venue_opening_hours DROP CONSTRAINT IF EXISTS venue_opening_hours_chk;
ALTER TABLE public.venue_opening_hours ADD CONSTRAINT venue_opening_hours_chk CHECK (
    weekday BETWEEN 1 AND 7 AND opens_at < time '24:00' AND closes_at <> opens_at
    AND EXTRACT(SECOND FROM opens_at) = 0 AND EXTRACT(SECOND FROM closes_at) = 0);

-- Plage d'un jour en heures de Dakar (sans fuseau) : [jour + ouverture, jour (+1 si nuit) + fermeture)
CREATE OR REPLACE FUNCTION public.venue_range(p_day date, p_opens time, p_closes time)
RETURNS tsrange
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
    SELECT tsrange(p_day + p_opens,
                   CASE WHEN p_closes > p_opens THEN p_day + p_closes ELSE (p_day + 1) + p_closes END,
                   '[)');
$$;

-- Le créneau entier est-il dans les heures d'ouverture ? Plages de la veille au lendemain réunies (range_agg réunit
-- les plages qui se suivent : 19:00-24:00 puis 00:00-02:00 forment une seule plage).
CREATE OR REPLACE FUNCTION public.venue_open_covers(p_venue_id uuid, p_slot tsrange)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((
        SELECT range_agg(public.venue_range(g.day, h.opens_at, h.closes_at)) @> p_slot
          FROM (SELECT gs::date AS day
                  FROM generate_series((lower(p_slot)::date - 1)::timestamp, upper(p_slot)::date::timestamp, interval '1 day') AS gs) AS g
          JOIN public.venue_opening_hours h ON h.venue_id = p_venue_id AND h.weekday = EXTRACT(ISODOW FROM g.day)
    ), FALSE);
$$;

-- ----------------------------------------------------------------------------
-- 3. Zones et tables rattachées à un établissement
-- ----------------------------------------------------------------------------
ALTER TABLE public.restaurant_zones ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.venues(id) ON DELETE RESTRICT;
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.venues(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_restaurant_zones_venue_id ON public.restaurant_zones(venue_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_venue_id ON public.restaurant_tables(venue_id);

-- Numéro de table unique par établissement (et non plus par partenaire : deux établissements ont chacun leur « 1 »)
ALTER TABLE public.restaurant_tables DROP CONSTRAINT IF EXISTS uq_partner_table_number;
ALTER TABLE public.restaurant_tables DROP CONSTRAINT IF EXISTS uq_venue_table_number;
ALTER TABLE public.restaurant_tables ADD CONSTRAINT uq_venue_table_number UNIQUE (venue_id, table_number);
ALTER TABLE public.restaurant_tables DROP CONSTRAINT IF EXISTS restaurant_tables_capacity_chk;
ALTER TABLE public.restaurant_tables ADD CONSTRAINT restaurant_tables_capacity_chk
    CHECK (capacity <= 50 AND min_capacity <= capacity) NOT VALID;

CREATE OR REPLACE FUNCTION public.restaurant_venue_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_zone record;
BEGIN
    IF TG_OP = 'INSERT' AND NEW.venue_id IS NULL THEN
        RAISE EXCEPTION 'Choisissez l''établissement de cette %.', CASE WHEN TG_TABLE_NAME = 'restaurant_zones' THEN 'zone' ELSE 'table' END;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.venue_id IS NOT NULL AND NEW.venue_id IS DISTINCT FROM OLD.venue_id THEN
        RAISE EXCEPTION 'Une zone ou une table ne change pas d''établissement.';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
        RAISE EXCEPTION 'Une zone ou une table ne change pas de partenaire.';
    END IF;
    IF NEW.venue_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.venues v WHERE v.id = NEW.venue_id AND v.partner_id = NEW.partner_id) THEN
        RAISE EXCEPTION 'Cet établissement n''est pas le vôtre.';
    END IF;
    -- Deux IF imbriqués : une zone n'a pas de colonne zone_id (pas d'évaluation court-circuitée en PL/pgSQL)
    IF TG_TABLE_NAME = 'restaurant_tables' THEN
        IF NEW.zone_id IS NOT NULL THEN
            SELECT z.venue_id, z.partner_id INTO v_zone FROM public.restaurant_zones z WHERE z.id = NEW.zone_id;
            IF NOT FOUND OR v_zone.partner_id <> NEW.partner_id OR v_zone.venue_id IS DISTINCT FROM NEW.venue_id THEN
                RAISE EXCEPTION 'Cette zone n''appartient pas à cet établissement.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.restaurant_venue_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_restaurant_zones_venue_guard ON public.restaurant_zones;
CREATE TRIGGER trg_restaurant_zones_venue_guard
    BEFORE INSERT OR UPDATE ON public.restaurant_zones
    FOR EACH ROW EXECUTE FUNCTION public.restaurant_venue_guard();
DROP TRIGGER IF EXISTS trg_restaurant_tables_venue_guard ON public.restaurant_tables;
CREATE TRIGGER trg_restaurant_tables_venue_guard
    BEFORE INSERT OR UPDATE ON public.restaurant_tables
    FOR EACH ROW EXECUTE FUNCTION public.restaurant_venue_guard();

-- ----------------------------------------------------------------------------
-- 4. Lecture et écritures
-- ----------------------------------------------------------------------------
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_opening_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venues_read" ON public.venues;
CREATE POLICY "venues_read" ON public.venues
    FOR SELECT USING (
        (is_active = TRUE AND validation_status = 'VALIDEE')
        OR public.is_partner_owner(partner_id)
        OR public.is_admin());

-- Les sous-requêtes sur venues passent par sa propre règle : lisibles quand l'établissement l'est
DROP POLICY IF EXISTS "venue_opening_hours_read" ON public.venue_opening_hours;
CREATE POLICY "venue_opening_hours_read" ON public.venue_opening_hours
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_opening_hours.venue_id));

DROP POLICY IF EXISTS "restaurant_zones_read" ON public.restaurant_zones;
CREATE POLICY "restaurant_zones_read" ON public.restaurant_zones
    FOR SELECT USING (
        (is_active = TRUE AND venue_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.venues v WHERE v.id = restaurant_zones.venue_id AND v.is_active AND v.validation_status = 'VALIDEE'))
        OR public.is_partner_owner(partner_id)
        OR public.is_admin());

DROP POLICY IF EXISTS "restaurant_tables_read" ON public.restaurant_tables;
CREATE POLICY "restaurant_tables_read" ON public.restaurant_tables
    FOR SELECT USING (
        (is_active = TRUE AND venue_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.venues v WHERE v.id = restaurant_tables.venue_id AND v.is_active AND v.validation_status = 'VALIDEE'))
        OR public.is_partner_owner(partner_id)
        OR public.is_admin());

-- Aucune écriture REST : les routes serveur écrivent avec le rôle de service, les fonctions en base font le reste
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.venues FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.venue_opening_hours FROM anon, authenticated;
GRANT SELECT ON public.venues TO anon, authenticated;
GRANT SELECT ON public.venue_opening_hours TO anon, authenticated;
GRANT ALL ON public.venues TO service_role;
GRANT ALL ON public.venue_opening_hours TO service_role;

REVOKE ALL ON FUNCTION public.venue_range(date, time, time) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.venue_open_covers(uuid, tsrange) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.venue_range(date, time, time) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_open_covers(uuid, tsrange) TO service_role;
