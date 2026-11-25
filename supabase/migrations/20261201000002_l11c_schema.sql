-- ============================================================================
-- EVENT VILLAGE — LOT 11c-a, migration 02 : schéma des tables d'un événement
-- ============================================================================
-- Modèle validé (docs/lot11c-etat-des-lieux.md, décisions du client du 25/11) : une table d'événement est un lot de N
-- billets, vendu par le moteur des billets (paiement de cible TICKET). Rien de restaurant_tables, table_reservations,
-- events.services ni des réglages tables.* n'est repris.
--  1. ticket_categories : un TYPE de table est une catégorie kind = 'TABLE' :
--     seats_per_unit (2 à 20 places par table), prix = prix TOTAL de la table (> 0), included_text (ce qui est compris,
--     200 caractères), onsite_note (minimum sur place : texte seulement, 120 caractères, jamais encaissé), payment_mode
--     (FULL, DEPOSIT, NONE : CDC §54 ; seul FULL est accepté par les fonctions de ce lot) ; total_quantity = nombre de
--     tables du type (tenu par event_tables_save), sold_quantity et held_quantity comptent des TABLES.
--     Un type de table n'est jamais vendu comme billet : sale_online et sale_counter faux (contrainte). La fiche, le
--     catalogue, la carte, le prix d'appel, l'achat de billets (ticket_sale_problems : CATEGORY_NOT_SOLD_ONLINE), la
--     caisse et les billets gratuits l'ignorent donc sans changement ; le dernier rempart est le déclencheur des billets.
--     Une catégorie de billets garde kind = 'TICKET', une place par billet.
--  2. event_tables : les tables d'un événement (type, numéro unique 1 à 999 par événement, zone facultative, position
--     sur le plan : mêmes bornes que les tables du lot 11b) ; event_zones reçoit la position de son rectangle sur le
--     plan ; event_table_plans : plan montré ou non aux clients.
--  3. stock_reservations.event_table_id : l'attente de paiement d'une table PRÉCISE ; une seule attente active par
--     table (index unique partiel).
--  4. event_table_bookings : la vente d'une table (un paiement = une table, titulaire = le compte qui a payé, places et
--     numéro figés) ; une seule vente active par table (index unique partiel) ; tickets.event_table_booking_id relie les
--     N billets à leur table.
--  5. Gardes d'écriture (rejet même par la clé de service) : event_tables, event_table_plans, event_table_bookings et
--     les types de tables ne s'écrivent que par les fonctions du lot (drapeau de transaction event_village.event_tables)
--     ; un billet d'un type de table n'est émis que par payment_confirm (drapeau event_village.event_table_sale) et
--     relié à une vente du même type ; le type, les places et le lien d'un billet à sa table ne changent plus.
--     Suppression en cascade d'un événement (brouillon supprimé) : admise.
--  6. Lecture : RLS active, aucune politique, aucun droit pour anon ni authenticated (tout passe par le serveur).
-- Rejouable : ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS puis ADD, CREATE TABLE IF NOT EXISTS, CREATE INDEX IF
-- NOT EXISTS, DROP TRIGGER IF EXISTS puis CREATE, CREATE OR REPLACE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Types de tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.ticket_categories ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'TICKET';
ALTER TABLE public.ticket_categories ADD COLUMN IF NOT EXISTS seats_per_unit smallint NOT NULL DEFAULT 1;
ALTER TABLE public.ticket_categories ADD COLUMN IF NOT EXISTS included_text text;
ALTER TABLE public.ticket_categories ADD COLUMN IF NOT EXISTS onsite_note text;
ALTER TABLE public.ticket_categories ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'FULL';
ALTER TABLE public.ticket_categories DROP CONSTRAINT IF EXISTS ticket_categories_kind_chk;
ALTER TABLE public.ticket_categories ADD CONSTRAINT ticket_categories_kind_chk CHECK (
    kind IN ('TICKET', 'TABLE')
    AND payment_mode IN ('FULL', 'DEPOSIT', 'NONE')
    AND (kind = 'TABLE' OR (seats_per_unit = 1 AND included_text IS NULL AND onsite_note IS NULL AND payment_mode = 'FULL'))
    AND (kind = 'TICKET' OR (seats_per_unit BETWEEN 2 AND 20 AND price > 0 AND NOT sale_online AND NOT sale_counter))
    AND (included_text IS NULL OR char_length(included_text) BETWEEN 1 AND 200)
    AND (onsite_note IS NULL OR char_length(onsite_note) BETWEEN 1 AND 120));
COMMENT ON COLUMN public.ticket_categories.kind IS
    'Lot 11c-a : TICKET (une place par billet) ou TABLE (type de table d''un événement : une unité = une table de seats_per_unit places, vendue par event_table_checkout et payment_confirm, jamais comme billet).';
COMMENT ON COLUMN public.ticket_categories.payment_mode IS
    'Lot 11c-a : mode de paiement d''un type de table (CDC §54) : FULL (en entier), DEPOSIT (acompte), NONE (aucun paiement immédiat). Seul FULL est accepté au lot 11c-a.';
CREATE INDEX IF NOT EXISTS ticket_categories_event_kind_idx ON public.ticket_categories (event_id, kind);

-- ----------------------------------------------------------------------------
-- 2. Tables, zones du plan, plan montré
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_tables (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id      uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    category_id   uuid NOT NULL,
    number        integer NOT NULL,
    zone_id       uuid,
    plan_x        numeric(5, 2),
    plan_y        numeric(5, 2),
    plan_shape    text NOT NULL DEFAULT 'RONDE',
    plan_rotation smallint NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT event_tables_number_chk CHECK (number BETWEEN 1 AND 999),
    CONSTRAINT event_tables_plan_chk CHECK (
        (plan_x IS NULL) = (plan_y IS NULL)
        AND (plan_x IS NULL OR (plan_x BETWEEN 0 AND 100 AND plan_y BETWEEN 0 AND 100))
        AND plan_shape IN ('RONDE', 'CARREE', 'RECTANGLE')
        AND plan_rotation BETWEEN 0 AND 345 AND plan_rotation % 15 = 0),
    CONSTRAINT event_tables_event_number_key UNIQUE (event_id, number) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT event_tables_event_id_id_key UNIQUE (event_id, id),
    CONSTRAINT event_tables_category_fk FOREIGN KEY (event_id, category_id)
        REFERENCES public.ticket_categories (event_id, id) ON DELETE CASCADE,
    CONSTRAINT event_tables_zone_fk FOREIGN KEY (event_id, zone_id)
        REFERENCES public.event_zones (event_id, id) ON DELETE SET NULL (zone_id)
);
CREATE INDEX IF NOT EXISTS event_tables_category_idx ON public.event_tables (category_id);
COMMENT ON TABLE public.event_tables IS
    'Lot 11c-a : tables d''un événement (type = ticket_categories kind TABLE, numéro unique par événement, zone et position du plan facultatives). Écrites par event_tables_save seulement.';

ALTER TABLE public.event_zones ADD COLUMN IF NOT EXISTS plan_x numeric(5, 2);
ALTER TABLE public.event_zones ADD COLUMN IF NOT EXISTS plan_y numeric(5, 2);
ALTER TABLE public.event_zones ADD COLUMN IF NOT EXISTS plan_w numeric(5, 2);
ALTER TABLE public.event_zones ADD COLUMN IF NOT EXISTS plan_h numeric(5, 2);
ALTER TABLE public.event_zones DROP CONSTRAINT IF EXISTS event_zones_plan_chk;
ALTER TABLE public.event_zones ADD CONSTRAINT event_zones_plan_chk CHECK (
    num_nulls(plan_x, plan_y, plan_w, plan_h) IN (0, 4)
    AND (plan_x IS NULL OR (plan_x BETWEEN 0 AND 100 AND plan_y BETWEEN 0 AND 100
                            AND plan_w BETWEEN 5 AND 100 AND plan_h BETWEEN 5 AND 100
                            AND plan_x + plan_w <= 100 AND plan_y + plan_h <= 100)));

CREATE TABLE IF NOT EXISTS public.event_table_plans (
    event_id     uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    plan_enabled boolean NOT NULL DEFAULT FALSE,
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. Attente de paiement d'une table précise
-- ----------------------------------------------------------------------------
ALTER TABLE public.stock_reservations ADD COLUMN IF NOT EXISTS event_table_id uuid REFERENCES public.event_tables(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS stock_reservations_one_active_table
    ON public.stock_reservations (event_table_id) WHERE status = 'ACTIVE' AND event_table_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. Ventes de tables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_table_bookings (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id       uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
    event_table_id uuid NOT NULL REFERENCES public.event_tables(id) ON DELETE RESTRICT,
    category_id    uuid NOT NULL REFERENCES public.ticket_categories(id) ON DELETE RESTRICT,
    payment_id     uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
    holder_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    seats          smallint NOT NULL,
    table_number   integer NOT NULL,
    status         text NOT NULL DEFAULT 'ACTIVE',
    refund_origin  text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    refunded_at    timestamptz,
    CONSTRAINT event_table_bookings_payment_key UNIQUE (payment_id),
    CONSTRAINT event_table_bookings_seats_chk CHECK (seats BETWEEN 2 AND 20),
    CONSTRAINT event_table_bookings_status_chk CHECK (
        status IN ('ACTIVE', 'REFUNDED')
        AND (status = 'ACTIVE') = (refunded_at IS NULL)
        AND (status = 'ACTIVE') = (refund_origin IS NULL)
        AND (refund_origin IS NULL OR refund_origin IN ('EVENT_CANCELLED', 'POSTPONEMENT', 'PAYMENT_REFUND')))
);
CREATE UNIQUE INDEX IF NOT EXISTS event_table_bookings_one_active
    ON public.event_table_bookings (event_table_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS event_table_bookings_event_idx ON public.event_table_bookings (event_id);
CREATE INDEX IF NOT EXISTS event_table_bookings_holder_idx ON public.event_table_bookings (holder_id);
COMMENT ON TABLE public.event_table_bookings IS
    'Lot 11c-a : vente d''une table d''événement (un paiement = une table ; titulaire = le compte qui a payé ; N billets reliés par tickets.event_table_booking_id). Une seule vente active par table. Écrite par payment_confirm et les fonctions de remboursement du lot seulement.';

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS event_table_booking_id uuid REFERENCES public.event_table_bookings(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS tickets_event_table_booking_idx ON public.tickets (event_table_booking_id) WHERE event_table_booking_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. Gardes d'écriture
-- ----------------------------------------------------------------------------
-- Drapeau des fonctions du lot (transaction locale)
CREATE OR REPLACE FUNCTION public.event_tables_writing()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT COALESCE(current_setting('event_village.event_tables', true), '') = 'on'
$$;

-- event_tables, event_table_plans, event_table_bookings : rien hors des fonctions du lot ; une suppression en cascade
-- d'un événement supprimé (brouillon) est admise.
CREATE OR REPLACE FUNCTION public.event_tables_write_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.event_tables_writing() THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
    IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = OLD.event_id) THEN
        RETURN OLD;
    END IF;
    -- Zone d'accès supprimée par event_zones_save : la table perd seulement sa zone (ON DELETE SET NULL (zone_id))
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'event_tables'
       AND (to_jsonb(NEW) ->> 'zone_id') IS NULL AND (to_jsonb(OLD) ->> 'zone_id') IS NOT NULL
       AND (to_jsonb(NEW) - 'zone_id') = (to_jsonb(OLD) - 'zone_id') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'EVT11', MESSAGE = format('%s : écriture réservée aux fonctions des tables d''un événement.', TG_TABLE_NAME);
END;
$$;

DROP TRIGGER IF EXISTS trg_0_event_tables_guard ON public.event_tables;
CREATE TRIGGER trg_0_event_tables_guard
    BEFORE INSERT OR UPDATE OR DELETE ON public.event_tables
    FOR EACH ROW EXECUTE FUNCTION public.event_tables_write_guard();
DROP TRIGGER IF EXISTS trg_0_event_table_plans_guard ON public.event_table_plans;
CREATE TRIGGER trg_0_event_table_plans_guard
    BEFORE INSERT OR UPDATE OR DELETE ON public.event_table_plans
    FOR EACH ROW EXECUTE FUNCTION public.event_tables_write_guard();
DROP TRIGGER IF EXISTS trg_0_event_table_bookings_guard ON public.event_table_bookings;
CREATE TRIGGER trg_0_event_table_bookings_guard
    BEFORE INSERT OR UPDATE OR DELETE ON public.event_table_bookings
    FOR EACH ROW EXECUTE FUNCTION public.event_tables_write_guard();

-- Types de tables : créés, modifiés et supprimés par les fonctions du lot seulement ; le moteur des billets ne touche que
-- sold_quantity et held_quantity (vente, attente, remboursement). Le genre d'une catégorie ne change jamais ; places et
-- prix d'un type ne changent plus dès la première vente ou attente (même par les fonctions du lot).
CREATE OR REPLACE FUNCTION public.ticket_categories_table_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.kind = 'TABLE' AND NOT public.event_tables_writing() THEN
            RAISE EXCEPTION USING ERRCODE = 'EVT11', MESSAGE = 'ticket_categories : un type de table se crée par les fonctions des tables d''un événement.';
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN
        IF OLD.kind = 'TABLE' AND NOT public.event_tables_writing()
           AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = OLD.event_id) THEN
            RAISE EXCEPTION USING ERRCODE = 'EVT11', MESSAGE = 'ticket_categories : un type de table se supprime par les fonctions des tables d''un événement.';
        END IF;
        RETURN OLD;
    END IF;
    IF NEW.kind IS DISTINCT FROM OLD.kind THEN
        RAISE EXCEPTION USING ERRCODE = 'EVT11', MESSAGE = 'ticket_categories : le genre d''une catégorie (billet ou table) ne change pas.';
    END IF;
    IF NEW.kind = 'TABLE' THEN
        IF (NEW.price IS DISTINCT FROM OLD.price OR NEW.seats_per_unit IS DISTINCT FROM OLD.seats_per_unit)
           AND (OLD.sold_quantity > 0 OR OLD.held_quantity > 0) THEN
            RAISE EXCEPTION USING ERRCODE = 'EVT12', MESSAGE = 'ticket_categories : prix et places d''un type de table figés dès la première vente.';
        END IF;
        IF NOT public.event_tables_writing()
           AND (ROW(NEW.name, NEW.description, NEW.price, NEW.total_quantity, NEW.max_per_order, NEW.sale_start, NEW.sale_end,
                    NEW.sale_online, NEW.sale_counter, NEW.is_active, NEW.scan_color, NEW.entry_instruction, NEW.seats_per_unit,
                    NEW.included_text, NEW.onsite_note, NEW.payment_mode, NEW.event_id)
                IS DISTINCT FROM
                ROW(OLD.name, OLD.description, OLD.price, OLD.total_quantity, OLD.max_per_order, OLD.sale_start, OLD.sale_end,
                    OLD.sale_online, OLD.sale_counter, OLD.is_active, OLD.scan_color, OLD.entry_instruction, OLD.seats_per_unit,
                    OLD.included_text, OLD.onsite_note, OLD.payment_mode, OLD.event_id)) THEN
            RAISE EXCEPTION USING ERRCODE = 'EVT11', MESSAGE = 'ticket_categories : un type de table se modifie par les fonctions des tables d''un événement.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_0_ticket_categories_table_guard ON public.ticket_categories;
CREATE TRIGGER trg_0_ticket_categories_table_guard
    BEFORE INSERT OR UPDATE OR DELETE ON public.ticket_categories
    FOR EACH ROW EXECUTE FUNCTION public.ticket_categories_table_guard();

-- Billets : un billet d'un type de table n'est émis que par payment_confirm, relié à une vente active du même type et
-- du même événement ; le lien à la table, le type et l'événement d'un billet relié ne changent plus.
CREATE OR REPLACE FUNCTION public.tickets_event_table_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_kind text;
    b record;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.event_table_booking_id IS DISTINCT FROM OLD.event_table_booking_id
           OR (OLD.event_table_booking_id IS NOT NULL
               AND (NEW.category_id IS DISTINCT FROM OLD.category_id OR NEW.event_id IS DISTINCT FROM OLD.event_id
                    OR NEW.payment_id IS DISTINCT FROM OLD.payment_id)) THEN
            RAISE EXCEPTION USING ERRCODE = 'EVT11', MESSAGE = 'tickets : le lien d''un billet à sa table ne change pas.';
        END IF;
        RETURN NEW;
    END IF;
    SELECT c.kind INTO v_kind FROM public.ticket_categories c WHERE c.id = NEW.category_id;
    IF NEW.event_table_booking_id IS NULL THEN
        IF v_kind = 'TABLE' THEN
            RAISE EXCEPTION USING ERRCODE = 'EVT11', MESSAGE = 'tickets : une place d''une table ne s''émet qu''avec la vente de sa table.';
        END IF;
        RETURN NEW;
    END IF;
    SELECT * INTO b FROM public.event_table_bookings WHERE id = NEW.event_table_booking_id;
    IF COALESCE(current_setting('event_village.event_table_sale', true), '') <> 'on'
       OR NOT FOUND OR b.status <> 'ACTIVE' OR b.category_id IS DISTINCT FROM NEW.category_id
       OR b.event_id IS DISTINCT FROM NEW.event_id OR b.payment_id IS DISTINCT FROM NEW.payment_id THEN
        RAISE EXCEPTION USING ERRCODE = 'EVT11', MESSAGE = 'tickets : une place d''une table ne s''émet qu''avec la vente de sa table.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_0_tickets_event_table_guard ON public.tickets;
CREATE TRIGGER trg_0_tickets_event_table_guard
    BEFORE INSERT OR UPDATE OF event_table_booking_id, category_id, event_id, payment_id ON public.tickets
    FOR EACH ROW EXECUTE FUNCTION public.tickets_event_table_guard();

-- Attente d'un type de table : toujours sur une table précise, posée par les fonctions du lot
CREATE OR REPLACE FUNCTION public.stock_reservations_table_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_kind text;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.event_table_id IS DISTINCT FROM OLD.event_table_id OR NEW.category_id IS DISTINCT FROM OLD.category_id THEN
            RAISE EXCEPTION USING ERRCODE = 'EVT11', MESSAGE = 'stock_reservations : la table d''une attente ne change pas.';
        END IF;
        RETURN NEW;
    END IF;
    SELECT c.kind INTO v_kind FROM public.ticket_categories c WHERE c.id = NEW.category_id;
    IF (v_kind = 'TABLE') <> (NEW.event_table_id IS NOT NULL)
       OR (NEW.event_table_id IS NOT NULL AND (NOT public.event_tables_writing() OR NEW.quantity <> 1
            OR NOT EXISTS (SELECT 1 FROM public.event_tables t WHERE t.id = NEW.event_table_id AND t.category_id = NEW.category_id))) THEN
        RAISE EXCEPTION USING ERRCODE = 'EVT11', MESSAGE = 'stock_reservations : une table s''attend par les fonctions des tables d''un événement, une à la fois.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_0_stock_reservations_table_guard ON public.stock_reservations;
CREATE TRIGGER trg_0_stock_reservations_table_guard
    BEFORE INSERT OR UPDATE OF event_table_id, category_id ON public.stock_reservations
    FOR EACH ROW EXECUTE FUNCTION public.stock_reservations_table_guard();

-- ----------------------------------------------------------------------------
-- 6. Lecture : par le serveur seulement
-- ----------------------------------------------------------------------------
ALTER TABLE public.event_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_table_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_table_bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.event_tables, public.event_table_plans, public.event_table_bookings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.event_tables, public.event_table_plans, public.event_table_bookings TO service_role;

REVOKE ALL ON FUNCTION public.event_tables_writing() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_tables_writing() TO service_role;
REVOKE ALL ON FUNCTION public.event_tables_write_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ticket_categories_table_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tickets_event_table_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stock_reservations_table_guard() FROM PUBLIC, anon, authenticated;
