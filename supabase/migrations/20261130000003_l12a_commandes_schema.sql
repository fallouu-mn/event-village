-- ============================================================================
-- EVENT VILLAGE — LOT 12a, migration 03 : commandes (état, montants figés, étapes, codes, livreurs, garde, lecture)
-- ============================================================================
-- Relevé de l'existant (rapport § 2) : POST /api/orders/create calculait le total dans la route (aucun produit
-- réglementé, aucune partenaire vérifiée, quantités non bornées), la partenaire écrivait n'importe quel statut
-- (PATCH /api/partner/orders/[id]), la confirmation d'un paiement écrivait la commande « payée, confirmée » par un
-- chemin générique, l'échec d'un paiement l'annulait ; la partenaire lisait ses commandes par REST (orders_read).
--  1. orders : établissement, état détaillé order_state (seule source ; order_status, ancien type, en est dérivé),
--     mode de paiement (payment_type : INTEGRAL entier, ACOMPTE, DIFFERE à la remise), montants figés à la création
--     (articles, frais de zone, total, acompte, frais de service, commission), payé et remboursé, paiement sur place
--     (noté, jamais compté), coordonnées du client pour la commande (masquées 7 jours après la remise), heure prévue
--     et heure estimée de remise, heure de CHAQUE étape (reçue, acceptée, en préparation, prête, en route, remise),
--     code de remise (haché avec une clé secrète, essais limités), livreur, annulation ;
--  2. order_items : prix figés (prix du produit + suppléments), suppléments copiés, plat du jour (jour des portions) ;
--  3. order_state_history : chaque changement d'état (de, vers, heure, auteur) ;
--  4. partner_couriers : livreurs d'une partenaire (membres de son équipe) : invitation, acceptation, retrait ;
--  5. clé du code de remise (private.order_code_key, 32 octets tirés une fois) et order_code_hash : le code n'est
--     jamais gardé en clair ; même la lecture complète de la base ne permet pas de l'essayer hors de la base ;
--  6. garde : insertion, suppression et tout changement des commandes d'un établissement, de leurs lignes et de
--     l'historique refusés hors des fonctions en base (drapeau de transaction event_village.order_flow) ;
--     la table orders porte aussi les commandes de billets payés à l'entrée (lot 4 : tickets.order_id,
--     ticket_cash_checkin) : sans établissement ni état détaillé, elles restent écrites comme avant (rien ne change
--     pour la billetterie) ; aucune ne devient une commande d'établissement hors des fonctions en base ;
--  7. commandes de repas de l'ancien code (sans établissement, sans billet rattaché) : closes une fois (rapport § 9) ;
--  8. lecture : le client lit les siennes, l'administration avec son code ; la partenaire et le livreur ne lisent
--     plus rien par REST (routes serveur et fonctions en base seulement) ; aucune écriture REST.
-- Rejouable : ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS, DROP … IF EXISTS puis ADD, CREATE OR REPLACE,
-- mises à jour idempotentes, clé tirée une seule fois (ON CONFLICT DO NOTHING).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Commandes : colonnes
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.venues(id) ON DELETE RESTRICT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_state TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.order_delivery_zones(id) ON DELETE RESTRICT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS onsite_table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE RESTRICT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS onsite_label TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS asap BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS prep_minutes INTEGER;
-- Argent (F CFA entiers), figé à la création
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS goods_total NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deposit_percent INTEGER;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS first_goods NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS first_fee NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS service_fee_rate NUMERIC(5, 2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 2);
-- Argent encaissé en ligne (relu sur les paiements), remboursé, payé sur place (jamais compté)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_goods NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_fees NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS onsite_amount NUMERIC(12, 2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS onsite_recorded_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS onsite_recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
-- Coordonnées du client pour cette commande (livraison et retrait), masquées après la remise
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS contact_masked_at TIMESTAMPTZ;
-- Attentes
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS response_due_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_taken BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_released_at TIMESTAMPTZ;
-- Code de remise (haché), essais, nouveaux codes
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS code_hash TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS code_issued_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS code_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS code_resends INTEGER NOT NULL DEFAULT 0;
-- Livreur (membre de l'équipe de la partenaire)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
-- Heure de chaque étape (suivi en étapes)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS en_route_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS handed_over_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pickup_warned_at TIMESTAMPTZ;
-- Fin
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancel_origin TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS partner_fault BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_percent NUMERIC(5, 2);

CREATE INDEX IF NOT EXISTS idx_orders_venue_id ON public.orders(venue_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_state ON public.orders(order_state);
CREATE INDEX IF NOT EXISTS idx_orders_courier ON public.orders(courier_user_id) WHERE courier_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_client_state ON public.orders(client_id, order_state);

COMMENT ON COLUMN public.orders.order_state IS
    'Lot 12a : état détaillé, seule source (order_status est dérivé). EN_ATTENTE_PAIEMENT « En attente de paiement », RECUE « Reçue », ACCEPTEE « Acceptée », EN_PREPARATION « En préparation », PRETE « Prête », EN_ROUTE « En route », REMISE « Livrée » ou « Retirée » ou « Servie », NON_RETIREE « Non retirée », EXPIREE « Non payée à temps », REFUSEE « Refusée par l''établissement », SANS_REPONSE « Sans réponse de l''établissement », ANNULEE_CLIENT / ANNULEE_PARTENAIRE / ANNULEE_EV « Annulée ».';
COMMENT ON COLUMN public.orders.first_goods IS
    'Lot 12a : part de la commande payée en ligne au départ (entier : tout ; acompte : arrondi au franc supérieur du pourcentage ; à la remise : 0).';
COMMENT ON COLUMN public.orders.onsite_amount IS
    'Lot 12a : solde payé sur place, déclaré à la remise par la partenaire ou son livreur ; jamais une ligne de paiement ni une écriture au grand livre.';
COMMENT ON COLUMN public.orders.code_hash IS
    'Lot 12a : empreinte du code de remise (HMAC-SHA256 avec private.order_code_key) ; le code n''est jamais gardé en clair.';
COMMENT ON COLUMN public.orders.estimated_at IS
    'Lot 12a : heure estimée de la remise (livraison, retrait ou service), recalculée à l''acceptation, à la préparation et au départ du livreur.';

-- ----------------------------------------------------------------------------
-- 2. Lignes : prix figés, suppléments, plat du jour
-- ----------------------------------------------------------------------------
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS base_price NUMERIC(12, 2);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS portion_day DATE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS stock_managed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_l12a_chk;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_l12a_chk CHECK (
    quantity BETWEEN 1 AND 99
    AND total_price = unit_price * quantity
    AND jsonb_typeof(options) = 'array') NOT VALID;
COMMENT ON COLUMN public.order_items.unit_price IS
    'Prix unitaire fixé au moment de la commande (lot 12a : prix du produit + suppléments, relus en base, jamais envoyés par le navigateur).';

-- ----------------------------------------------------------------------------
-- 3. Historique des états
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_state_history (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    from_state TEXT,
    to_state TEXT NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    actor_role TEXT NOT NULL,
    note TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_state_history_order ON public.order_state_history(order_id, at);
COMMENT ON TABLE public.order_state_history IS
    'Lot 12a : chaque changement d''état d''une commande (de, vers, heure, auteur : CLIENT, PARTENAIRE, LIVREUR, ADMIN, SUPERADMIN, SYSTEM).';

-- ----------------------------------------------------------------------------
-- 4. Livreurs d'une partenaire
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_couriers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'PENDING',
    invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ,
    removed_at TIMESTAMPTZ,
    UNIQUE (partner_id, user_id)
);
ALTER TABLE public.partner_couriers DROP CONSTRAINT IF EXISTS partner_couriers_status_chk;
ALTER TABLE public.partner_couriers ADD CONSTRAINT partner_couriers_status_chk CHECK (status IN ('PENDING', 'ACTIVE', 'DECLINED', 'REMOVED'));
CREATE INDEX IF NOT EXISTS idx_partner_couriers_user ON public.partner_couriers(user_id);
COMMENT ON TABLE public.partner_couriers IS
    'Lot 12a : livreur d''une partenaire (membre de son équipe), invité par la partenaire et actif après son accord ; seul un livreur ACTIVE reçoit une commande à livrer. Service_role seul.';

-- ----------------------------------------------------------------------------
-- 5. Clé du code de remise
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS private.order_code_key (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    secret BYTEA NOT NULL CHECK (octet_length(secret) >= 32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE private.order_code_key FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO private.order_code_key (singleton, secret) VALUES (TRUE, extensions.gen_random_bytes(32))
ON CONFLICT (singleton) DO NOTHING;

-- Empreinte d'un code : HMAC-SHA256(commande:code, clé) ; la clé n'est lisible que par cette fonction
CREATE OR REPLACE FUNCTION public.order_code_hash(p_order_id uuid, p_code text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT encode(extensions.hmac(convert_to(p_order_id::text || ':' || p_code, 'UTF8'), k.secret, 'sha256'), 'hex')
      FROM private.order_code_key k WHERE k.singleton;
$$;

-- ----------------------------------------------------------------------------
-- 7. Commandes de l'ancien code : closes une fois (avant les contraintes ; drapeau posé : la garde existe déjà si la
--    migration est rejouée)
-- ----------------------------------------------------------------------------
SELECT set_config('event_village.order_flow', 'on', true);
UPDATE public.orders
   SET order_state = CASE
           WHEN order_status::text = 'LIVREE' THEN 'REMISE'
           WHEN order_status::text = 'REJETEE' THEN 'REFUSEE'
           WHEN order_status::text = 'EN_ATTENTE' AND payment_status::text <> 'SUCCESS' THEN 'EXPIREE'
           ELSE 'ANNULEE_EV' END,
       cancel_origin = CASE WHEN order_status::text NOT IN ('LIVREE', 'REJETEE')
                             AND NOT (order_status::text = 'EN_ATTENTE' AND payment_status::text <> 'SUCCESS') THEN 'EVENT_VILLAGE' END,
       cancel_reason = CASE WHEN order_status::text NOT IN ('LIVREE', 'REJETEE', 'ANNULEE')
                             AND NOT (order_status::text = 'EN_ATTENTE' AND payment_status::text <> 'SUCCESS')
                            THEN 'Ancienne commande, close à la refonte des commandes (lot 12a)' END,
       items_amount = subtotal,
       goods_total = subtotal + delivery_fee,
       closed_at = COALESCE(closed_at, now()),
       contact_masked_at = COALESCE(contact_masked_at, now()),
       delivery_address = NULL
 WHERE order_state IS NULL AND venue_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.order_id = orders.id);
SELECT set_config('event_village.order_flow', 'off', true);

-- Une commande d'établissement a toujours un état ; une commande de billets (lot 4) n'en a pas
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_venue_state_chk;
ALTER TABLE public.orders ADD CONSTRAINT orders_venue_state_chk CHECK (venue_id IS NULL OR order_state IS NOT NULL);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_state_chk;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_state_chk CHECK (order_state IN (
    'EN_ATTENTE_PAIEMENT', 'RECUE', 'ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE', 'REMISE',
    'NON_RETIREE', 'EXPIREE', 'REFUSEE', 'SANS_REPONSE', 'ANNULEE_CLIENT', 'ANNULEE_PARTENAIRE', 'ANNULEE_EV'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_open_has_venue_chk;
ALTER TABLE public.orders ADD CONSTRAINT orders_open_has_venue_chk CHECK (
    order_state NOT IN ('EN_ATTENTE_PAIEMENT', 'RECUE', 'ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE')
    OR (venue_id IS NOT NULL AND scheduled_for IS NOT NULL));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_money_chk;
ALTER TABLE public.orders ADD CONSTRAINT orders_money_chk CHECK (
    venue_id IS NULL OR (
        goods_total = items_amount + delivery_fee
        AND items_amount = subtotal
        AND first_goods >= 0 AND first_goods <= goods_total AND first_fee >= 0
        AND paid_goods >= 0 AND paid_goods <= goods_total AND paid_fees >= 0
        AND refunded_amount >= 0 AND refunded_amount <= paid_goods + paid_fees
        AND paid_amount = paid_goods + paid_fees
        AND balance_amount = goods_total - paid_goods
        AND (deposit_percent IS NULL OR deposit_percent BETWEEN 10 AND 90)
        AND (onsite_amount IS NULL OR (onsite_amount >= 1 AND onsite_amount = trunc(onsite_amount)))
        AND items_amount = trunc(items_amount) AND delivery_fee = trunc(delivery_fee)));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_cancel_origin_chk;
ALTER TABLE public.orders ADD CONSTRAINT orders_cancel_origin_chk CHECK (
    cancel_origin IS NULL OR cancel_origin IN ('CLIENT', 'PARTENAIRE', 'EVENT_VILLAGE', 'SANS_REPONSE'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_mode_chk;
ALTER TABLE public.orders ADD CONSTRAINT orders_mode_chk CHECK (
    venue_id IS NULL
    OR (delivery_mode::text = 'LIVRAISON' AND zone_id IS NOT NULL)
    OR (delivery_mode::text <> 'LIVRAISON' AND zone_id IS NULL AND delivery_fee = 0));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_code_chk;
ALTER TABLE public.orders ADD CONSTRAINT orders_code_chk CHECK (
    (code_hash IS NULL OR code_hash ~ '^[0-9a-f]{64}$') AND code_attempts >= 0 AND code_resends >= 0);

-- ----------------------------------------------------------------------------
-- 1 bis. Ancien état dérivé de l'état détaillé (lectures de l'ancien code)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.orders_state_derive()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Commande de billets (lot 4) : aucun état détaillé, son statut reste écrit par la caisse
    IF NEW.order_state IS NULL THEN
        RETURN NEW;
    END IF;
    NEW.order_status := CASE NEW.order_state
        WHEN 'EN_ATTENTE_PAIEMENT' THEN 'EN_ATTENTE'
        WHEN 'RECUE' THEN 'EN_ATTENTE'
        WHEN 'ACCEPTEE' THEN 'CONFIRMEE'
        WHEN 'EN_PREPARATION' THEN 'EN_PREPARATION'
        WHEN 'PRETE' THEN 'PRETE'
        WHEN 'EN_ROUTE' THEN 'EN_LIVRAISON'
        WHEN 'REMISE' THEN 'LIVREE'
        WHEN 'REFUSEE' THEN 'REJETEE'
        ELSE 'ANNULEE' END::public.order_status_enum;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.orders_state_derive() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Garde : écritures réservées aux fonctions en base
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.orders_flow_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_legacy boolean;
BEGIN
    IF current_setting('event_village.order_flow', true) = 'on' THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
    -- Commandes de billets (lot 4) et anciennes commandes sans établissement ni état : écritures inchangées, tant
    -- qu'elles ne deviennent pas des commandes d'établissement
    IF TG_TABLE_NAME = 'orders' THEN
        v_legacy := CASE TG_OP
            WHEN 'INSERT' THEN NEW.venue_id IS NULL AND NEW.order_state IS NULL
            WHEN 'DELETE' THEN OLD.venue_id IS NULL AND OLD.order_state IS NULL
            ELSE OLD.venue_id IS NULL AND OLD.order_state IS NULL AND NEW.venue_id IS NULL AND NEW.order_state IS NULL END;
    ELSIF TG_TABLE_NAME = 'order_items' THEN
        SELECT o.venue_id IS NULL AND o.order_state IS NULL INTO v_legacy
          FROM public.orders o WHERE o.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.order_id ELSE NEW.order_id END;
        IF TG_OP = 'UPDATE' AND NEW.order_id IS DISTINCT FROM OLD.order_id THEN
            v_legacy := FALSE;
        END IF;
    ELSE
        v_legacy := FALSE;
    END IF;
    IF COALESCE(v_legacy, FALSE) THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
    IF TG_OP = 'INSERT' THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = format('Une ligne de %s se crée seulement par les fonctions de commande.', TG_TABLE_NAME);
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = format('Une ligne de %s ne se supprime pas.', TG_TABLE_NAME);
    END IF;
    -- Seule la date de mise à jour peut changer hors des fonctions en base
    IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Une commande change seulement par les fonctions en base.';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.orders_flow_guard() FROM PUBLIC, anon, authenticated;

-- Ordre des déclencheurs BEFORE (alphabétique) : la garde, puis l'état dérivé
DROP TRIGGER IF EXISTS trg_0_orders_flow_guard ON public.orders;
CREATE TRIGGER trg_0_orders_flow_guard
    BEFORE INSERT OR UPDATE OR DELETE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.orders_flow_guard();
DROP TRIGGER IF EXISTS trg_a_orders_state_derive ON public.orders;
CREATE TRIGGER trg_a_orders_state_derive
    BEFORE INSERT OR UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.orders_state_derive();
DROP TRIGGER IF EXISTS trg_0_order_items_flow_guard ON public.order_items;
CREATE TRIGGER trg_0_order_items_flow_guard
    BEFORE INSERT OR UPDATE OR DELETE ON public.order_items
    FOR EACH ROW EXECUTE FUNCTION public.orders_flow_guard();
DROP TRIGGER IF EXISTS trg_0_order_state_history_guard ON public.order_state_history;
CREATE TRIGGER trg_0_order_state_history_guard
    BEFORE INSERT OR UPDATE OR DELETE ON public.order_state_history
    FOR EACH ROW EXECUTE FUNCTION public.orders_flow_guard();

-- Ancien état recalculé pour les commandes reprises
SELECT set_config('event_village.order_flow', 'on', true);
UPDATE public.orders SET order_state = order_state
 WHERE order_state IS NOT NULL AND order_status::text IS DISTINCT FROM (CASE order_state
         WHEN 'EN_ATTENTE_PAIEMENT' THEN 'EN_ATTENTE' WHEN 'RECUE' THEN 'EN_ATTENTE' WHEN 'ACCEPTEE' THEN 'CONFIRMEE'
         WHEN 'EN_PREPARATION' THEN 'EN_PREPARATION' WHEN 'PRETE' THEN 'PRETE' WHEN 'EN_ROUTE' THEN 'EN_LIVRAISON'
         WHEN 'REMISE' THEN 'LIVREE' WHEN 'REFUSEE' THEN 'REJETEE' ELSE 'ANNULEE' END);
SELECT set_config('event_village.order_flow', 'off', true);

-- Un produit vendu ne se supprime plus (ligne de commande, clé étrangère RESTRICT d'origine) ; une ligne ne peut pas
-- porter un produit réglementé (contrôle en base, en plus de la fonction de commande)
CREATE OR REPLACE FUNCTION public.order_items_regulated_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.product_regulated(NEW.product_id) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Un produit réglementé (alcool, tabac) ne se commande pas en ligne.';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.order_items_regulated_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_b_order_items_regulated_guard ON public.order_items;
CREATE TRIGGER trg_b_order_items_regulated_guard
    BEFORE INSERT ON public.order_items
    FOR EACH ROW EXECUTE FUNCTION public.order_items_regulated_guard();

-- ----------------------------------------------------------------------------
-- 8. Lecture : le client et l'administration ; ni la partenaire ni le livreur par REST ; aucune écriture REST
-- ----------------------------------------------------------------------------
-- orders_read (dernière définition : 20261103000001_lot6_dette.sql:187-197) ; changement : la partenaire propriétaire ne
-- lit plus par REST (routes serveur seulement)
DROP POLICY IF EXISTS "orders_read" ON public.orders;
CREATE POLICY "orders_read" ON public.orders
    FOR SELECT TO authenticated USING (
        (
            client_id = auth.uid()
            OR public.is_admin()
        )
        AND EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = auth.uid() AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME'))
    );
-- order_items_read (dernière définition : 0003_rls.sql:259-262) ; changement : par la règle de lecture de la commande
DROP POLICY IF EXISTS "order_items_read" ON public.order_items;
CREATE POLICY "order_items_read" ON public.order_items
    FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id));
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;

ALTER TABLE public.order_state_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_state_history_read" ON public.order_state_history;
CREATE POLICY "order_state_history_read" ON public.order_state_history
    FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_state_history.order_id));
ALTER TABLE public.partner_couriers ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.orders, public.order_items, public.order_state_history FROM anon, authenticated;
REVOKE ALL ON public.partner_couriers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.order_state_history TO authenticated;
GRANT ALL ON public.order_state_history, public.partner_couriers TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.order_state_history_id_seq TO service_role;

REVOKE ALL ON FUNCTION public.order_code_hash(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
