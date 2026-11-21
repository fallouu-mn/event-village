-- ============================================================================
-- EVENT VILLAGE — LOT 12a, migration 02 : catalogue des commandes (établissements, produits, options, plat du jour,
-- produits réglementés, zones de livraison)
-- ============================================================================
-- Relevé de l'existant (lecture seule, 21/11, rapport § 2) : products et product_categories rattachés à la partenaire
-- seule ; aucun établissement, aucun horaire, aucune option, aucune zone de livraison ; plat du jour sans portions ;
-- aucun produit réglementé ; prix en centimes possibles.
-- Décisions du client (18/11) : vente par les établissements de la partenaire (restaurant, bar, espace, et boutique),
-- dans leurs horaires (lot 11a : venue_opening_hours) ; livraison par la partenaire seule, zones avec frais fixes et
-- minimum de commande ; retrait sur place ; commande sur place (table ou zone) ; acompte de 30 % réglable par la
-- partenaire ; paiement à la remise si la partenaire l'accepte ; plat du jour avec portions par jour ; produits
-- réglementés (alcool, tabac) affichés avec leur prix, jamais commandés en ligne (case de la partenaire + vérification
-- par l'administration).
--  1. venues : sorte BOUTIQUE ajoutée ; réglages de vente de l'établissement (vente ouverte, modes de remise, acompte
--     accepté et son pourcentage, paiement à la remise, durée de préparation), écrits par order_venue_settings_set ;
--  2. products : établissement (même partenaire, déclencheur), prix en F CFA entiers (contrainte NOT VALID : les
--     anciennes lignes ne sont pas réécrites, toute nouvelle écriture est contrôlée), réglementé (case de la partenaire,
--     sorte ALCOOL ou TABAC) et décision de l'administration (regulated_admin), écrite seulement par
--     order_product_regulation_decide (drapeau event_village.product_regulation) ; product_regulated(produit) =
--     case de la partenaire OU décision de l'administration (jamais l'une sans l'autre ne libère un produit) ;
--  3. product_options : suppléments d'un produit (prix ajouté par unité, F CFA entiers) ;
--  4. product_daily_portions : portions d'un plat du jour par jour (Dakar), vendues sous verrou (migration 04) ;
--     écrites seulement par order_daily_portions_set (portions) et les fonctions de commande (ventes) ;
--  5. order_delivery_zones : zones de livraison d'un établissement, frais fixes et minimum de commande ;
--  6. lecture : options, portions et zones lisibles quand leur produit ou établissement l'est ; aucune écriture REST.
-- Rejouable : CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, DROP … IF EXISTS puis ADD, CREATE OR REPLACE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Établissements : sorte BOUTIQUE, réglages de vente
-- ----------------------------------------------------------------------------
ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_kind_chk;
ALTER TABLE public.venues ADD CONSTRAINT venues_kind_chk CHECK (kind IN ('RESTAURANT', 'BAR', 'ESPACE', 'BOUTIQUE'));

ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS orders_open BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS order_modes TEXT[] NOT NULL DEFAULT ARRAY['RETRAIT']::text[];
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS order_deposit_allowed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS order_deposit_percent INTEGER;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS order_pay_on_handover BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS order_prep_minutes INTEGER;

ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_order_modes_chk;
ALTER TABLE public.venues ADD CONSTRAINT venues_order_modes_chk CHECK (
    cardinality(order_modes) BETWEEN 1 AND 3
    AND order_modes <@ ARRAY['LIVRAISON', 'RETRAIT', 'SUR_PLACE']::text[]);
ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_order_deposit_chk;
ALTER TABLE public.venues ADD CONSTRAINT venues_order_deposit_chk CHECK (
    order_deposit_percent IS NULL OR order_deposit_percent BETWEEN 10 AND 90);
ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_order_prep_chk;
ALTER TABLE public.venues ADD CONSTRAINT venues_order_prep_chk CHECK (
    order_prep_minutes IS NULL OR order_prep_minutes BETWEEN 10 AND 240);

COMMENT ON COLUMN public.venues.orders_open IS
    'Lot 12a : l''établissement prend des commandes (choix de la partenaire ; service ouvert par features.orders_enabled).';
COMMENT ON COLUMN public.venues.order_deposit_percent IS
    'Lot 12a : acompte demandé (10 à 90 %) quand order_deposit_allowed ; vide = réglage orders.deposit_default_percent.';
COMMENT ON COLUMN public.venues.order_pay_on_handover IS
    'Lot 12a : paiement à la livraison ou au retrait accepté ; noté sur la commande, jamais compté comme encaissé.';

-- ----------------------------------------------------------------------------
-- 2. Produits : établissement, prix entiers, produits réglementés
-- ----------------------------------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.venues(id) ON DELETE RESTRICT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_regulated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS regulated_kind TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS regulated_admin BOOLEAN;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS regulated_checked_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS regulated_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_venue_id ON public.products(venue_id);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_regulated_kind_chk;
ALTER TABLE public.products ADD CONSTRAINT products_regulated_kind_chk CHECK (
    regulated_kind IS NULL OR regulated_kind IN ('ALCOOL', 'TABAC'));
-- Prix en F CFA entiers, 10 000 000 au plus : les anciennes lignes ne sont pas réécrites (NOT VALID), toute écriture
-- nouvelle est contrôlée
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_price_franc_chk;
ALTER TABLE public.products ADD CONSTRAINT products_price_franc_chk CHECK (price = trunc(price) AND price <= 10000000) NOT VALID;

COMMENT ON COLUMN public.products.is_regulated IS
    'Lot 12a : case de la partenaire « produit réglementé » (alcool, tabac) : affiché avec son prix, jamais commandé, payé ni livré en ligne.';
COMMENT ON COLUMN public.products.regulated_admin IS
    'Lot 12a : décision de l''administration (vrai = réglementé ; faux = vérifié, non réglementé ; vide = pas encore vérifié). Écrite seulement par order_product_regulation_decide.';

-- Produit réglementé : case de la partenaire OU décision de l'administration
CREATE OR REPLACE FUNCTION public.product_regulated(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((SELECT pr.is_regulated OR COALESCE(pr.regulated_admin, FALSE) FROM public.products pr WHERE pr.id = p_product_id), TRUE);
$$;

CREATE OR REPLACE FUNCTION public.products_order_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner uuid;
BEGIN
    -- Établissement de la même partenaire, jamais changé une fois posé (lignes de commande, recettes)
    IF NEW.venue_id IS NOT NULL THEN
        SELECT partner_id INTO v_partner FROM public.venues WHERE id = NEW.venue_id;
        IF v_partner IS DISTINCT FROM NEW.partner_id THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ce produit doit appartenir à un établissement de la même partenaire.';
        END IF;
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Un produit ne change pas de partenaire.';
        END IF;
        IF OLD.venue_id IS NOT NULL AND NEW.venue_id IS DISTINCT FROM OLD.venue_id THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Un produit ne change pas d''établissement.';
        END IF;
    END IF;
    -- Décision de l'administration : seulement par order_product_regulation_decide
    IF current_setting('event_village.product_regulation', true) IS DISTINCT FROM 'on' THEN
        IF TG_OP = 'INSERT' THEN
            NEW.regulated_admin := NULL;
            NEW.regulated_checked_by := NULL;
            NEW.regulated_checked_at := NULL;
        ELSIF NEW.regulated_admin IS DISTINCT FROM OLD.regulated_admin
              OR NEW.regulated_checked_by IS DISTINCT FROM OLD.regulated_checked_by
              OR NEW.regulated_checked_at IS DISTINCT FROM OLD.regulated_checked_at THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La vérification d''un produit réglementé se fait seulement par l''administration.';
        END IF;
    END IF;
    -- Une case « réglementé » cochée garde sa sorte ; décochée, la sorte est effacée
    IF NOT NEW.is_regulated THEN
        NEW.regulated_kind := NULL;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.products_order_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_products_order_guard ON public.products;
CREATE TRIGGER trg_products_order_guard
    BEFORE INSERT OR UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.products_order_guard();

-- ----------------------------------------------------------------------------
-- 3. Options (suppléments)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_delta NUMERIC(12, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_options_product_id ON public.product_options(product_id);
ALTER TABLE public.product_options DROP CONSTRAINT IF EXISTS product_options_chk;
ALTER TABLE public.product_options ADD CONSTRAINT product_options_chk CHECK (
    length(btrim(name)) BETWEEN 1 AND 80 AND price_delta >= 0 AND price_delta <= 1000000 AND price_delta = trunc(price_delta));
COMMENT ON TABLE public.product_options IS
    'Lot 12a : supplément d''un produit (prix ajouté par unité, F CFA entiers) ; prix figé sur la ligne de commande.';

-- ----------------------------------------------------------------------------
-- 4. Portions du plat du jour
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_daily_portions (
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    portions INTEGER NOT NULL,
    sold INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (product_id, day)
);
ALTER TABLE public.product_daily_portions DROP CONSTRAINT IF EXISTS product_daily_portions_chk;
ALTER TABLE public.product_daily_portions ADD CONSTRAINT product_daily_portions_chk CHECK (
    portions BETWEEN 0 AND 10000 AND sold >= 0 AND sold <= portions);
COMMENT ON TABLE public.product_daily_portions IS
    'Lot 12a : portions d''un plat du jour pour un jour (Dakar) ; vendues une seule fois par commande, rendues à l''annulation ; le plat s''arrête seul à la fin du jour.';

CREATE OR REPLACE FUNCTION public.product_daily_portions_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF current_setting('event_village.order_flow', true) = 'on' THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Les portions du plat du jour changent seulement par les fonctions en base.';
END;
$$;
REVOKE ALL ON FUNCTION public.product_daily_portions_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_product_daily_portions_guard ON public.product_daily_portions;
CREATE TRIGGER trg_product_daily_portions_guard
    BEFORE INSERT OR UPDATE OR DELETE ON public.product_daily_portions
    FOR EACH ROW EXECUTE FUNCTION public.product_daily_portions_guard();

-- ----------------------------------------------------------------------------
-- 5. Zones de livraison
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
    min_order NUMERIC(12, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_delivery_zones_venue_id ON public.order_delivery_zones(venue_id);
ALTER TABLE public.order_delivery_zones DROP CONSTRAINT IF EXISTS order_delivery_zones_chk;
ALTER TABLE public.order_delivery_zones ADD CONSTRAINT order_delivery_zones_chk CHECK (
    length(btrim(name)) BETWEEN 2 AND 80
    AND fee >= 0 AND fee <= 100000 AND fee = trunc(fee)
    AND min_order >= 0 AND min_order <= 10000000 AND min_order = trunc(min_order));
COMMENT ON TABLE public.order_delivery_zones IS
    'Lot 12a : zone de livraison d''un établissement (frais fixes et minimum de commande en F CFA, fixés par la partenaire).';

-- Une zone ne change jamais d'établissement
CREATE OR REPLACE FUNCTION public.order_delivery_zones_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.venue_id IS DISTINCT FROM OLD.venue_id THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Une zone de livraison ne change pas d''établissement.';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.order_delivery_zones_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_order_delivery_zones_guard ON public.order_delivery_zones;
CREATE TRIGGER trg_order_delivery_zones_guard
    BEFORE UPDATE ON public.order_delivery_zones
    FOR EACH ROW EXECUTE FUNCTION public.order_delivery_zones_guard();

-- ----------------------------------------------------------------------------
-- 6. Fonctions du catalogue (partenaire, administration)
-- ----------------------------------------------------------------------------
-- Réglages de vente d'un établissement, par sa partenaire (compte actif, fiche VALIDE) ; journal
CREATE OR REPLACE FUNCTION public.order_venue_settings_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_venue_id uuid := public.try_uuid(p->>'venue_id');
    v          record;
    v_modes    text[];
    v_pct      integer;
    v_prep     integer;
    v_old      jsonb;
    v_new      jsonb;
BEGIN
    SELECT ve.*, pa.user_id AS owner_id, pa.status::text AS partner_status INTO v
      FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id
     WHERE ve.id = v_venue_id FOR UPDATE OF ve;
    IF v_venue_id IS NULL OR NOT FOUND OR v_actor IS NULL OR v.owner_id <> v_actor
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_FOUND', 'message', 'Cet établissement n’existe pas ou n’est pas le vôtre.');
    END IF;
    IF v.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_VALIDATED', 'message', 'Votre fiche doit être validée pour modifier la vente.');
    END IF;
    BEGIN
        v_modes := CASE WHEN jsonb_typeof(p->'modes') = 'array' THEN ARRAY(SELECT DISTINCT jsonb_array_elements_text(p->'modes') ORDER BY 1) ELSE v.order_modes END;
        v_pct := CASE WHEN p ? 'deposit_percent' AND jsonb_typeof(p->'deposit_percent') <> 'null' THEN (p->>'deposit_percent')::int
                      WHEN p ? 'deposit_percent' THEN NULL ELSE v.order_deposit_percent END;
        v_prep := CASE WHEN p ? 'prep_minutes' AND jsonb_typeof(p->'prep_minutes') <> 'null' THEN (p->>'prep_minutes')::int
                       WHEN p ? 'prep_minutes' THEN NULL ELSE v.order_prep_minutes END;
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_SETTINGS', 'message', 'Un réglage de vente n’est pas valable.');
    END;
    IF cardinality(v_modes) NOT BETWEEN 1 AND 3 OR NOT (v_modes <@ ARRAY['LIVRAISON', 'RETRAIT', 'SUR_PLACE']::text[]) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MODES', 'message', 'Choisissez au moins un mode : livraison, retrait ou sur place.');
    END IF;
    IF v_pct IS NOT NULL AND v_pct NOT BETWEEN 10 AND 90 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DEPOSIT', 'message', 'L’acompte est compris entre 10 et 90 %.');
    END IF;
    IF v_prep IS NOT NULL AND v_prep NOT BETWEEN 10 AND 240 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PREP', 'message', 'La préparation dure de 10 à 240 minutes.');
    END IF;
    v_old := jsonb_build_object('orders_open', v.orders_open, 'modes', v.order_modes, 'deposit_allowed', v.order_deposit_allowed,
                                'deposit_percent', v.order_deposit_percent, 'pay_on_handover', v.order_pay_on_handover, 'prep_minutes', v.order_prep_minutes);
    UPDATE public.venues
       SET orders_open = CASE WHEN jsonb_typeof(p->'orders_open') = 'boolean' THEN (p->>'orders_open')::boolean ELSE orders_open END,
           order_modes = v_modes,
           order_deposit_allowed = CASE WHEN jsonb_typeof(p->'deposit_allowed') = 'boolean' THEN (p->>'deposit_allowed')::boolean ELSE order_deposit_allowed END,
           order_deposit_percent = v_pct,
           order_pay_on_handover = CASE WHEN jsonb_typeof(p->'pay_on_handover') = 'boolean' THEN (p->>'pay_on_handover')::boolean ELSE order_pay_on_handover END,
           order_prep_minutes = v_prep,
           updated_at = now()
     WHERE id = v.id
    RETURNING jsonb_build_object('orders_open', orders_open, 'modes', order_modes, 'deposit_allowed', order_deposit_allowed,
                                 'deposit_percent', order_deposit_percent, 'pay_on_handover', order_pay_on_handover, 'prep_minutes', order_prep_minutes)
      INTO v_new;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'VENUE_ORDER_SETTINGS_SET', 'venues', v.id, v_old, v_new);
    RETURN jsonb_build_object('ok', true, 'venue_id', v.id) || v_new;
END;
$$;

-- Portions du plat du jour pour aujourd'hui (Dakar), par la partenaire ; jamais sous ce qui est déjà vendu
CREATE OR REPLACE FUNCTION public.order_daily_portions_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor    uuid := public.try_uuid(p->>'actor_id');
    v_product  uuid := public.try_uuid(p->>'product_id');
    v_portions integer;
    v_day      date := public.hall_dakar_now()::date;
    pr         record;
    v_sold     integer;
BEGIN
    BEGIN
        v_portions := (p->>'portions')::int;
    EXCEPTION WHEN others THEN
        v_portions := NULL;
    END;
    IF v_portions IS NULL OR v_portions NOT BETWEEN 0 AND 10000 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PORTIONS', 'message', 'Indiquez un nombre de portions entre 0 et 10 000.');
    END IF;
    SELECT pd.*, pa.user_id AS owner_id, pa.status::text AS partner_status INTO pr
      FROM public.products pd JOIN public.partners pa ON pa.id = pd.partner_id WHERE pd.id = v_product;
    IF v_product IS NULL OR NOT FOUND OR v_actor IS NULL OR pr.owner_id <> v_actor
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_NOT_FOUND', 'message', 'Ce produit n’existe pas ou n’est pas le vôtre.');
    END IF;
    IF pr.partner_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_VALIDATED', 'message', 'Votre fiche doit être validée pour modifier la vente.');
    END IF;
    IF NOT pr.is_daily_special THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_DAILY_SPECIAL', 'message', 'Ce produit n’est pas un plat du jour.');
    END IF;
    -- Même verrou que la vente d'une portion
    PERFORM pg_advisory_xact_lock(hashtextextended('order_portions:' || v_product::text || ':' || v_day::text, 0));
    SELECT sold INTO v_sold FROM public.product_daily_portions WHERE product_id = v_product AND day = v_day;
    IF COALESCE(v_sold, 0) > v_portions THEN
        RETURN jsonb_build_object('ok', false, 'code', 'BELOW_SOLD',
            'message', format('%s portions sont déjà vendues aujourd’hui : indiquez au moins %s.', v_sold, v_sold));
    END IF;
    PERFORM set_config('event_village.order_flow', 'on', true);
    INSERT INTO public.product_daily_portions (product_id, day, portions, sold)
    VALUES (v_product, v_day, v_portions, 0)
    ON CONFLICT (product_id, day) DO UPDATE SET portions = EXCLUDED.portions, updated_at = now();
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'PRODUCT_DAILY_PORTIONS_SET', 'products', v_product,
            jsonb_build_object('day', v_day, 'portions', v_portions, 'sold', COALESCE(v_sold, 0)));
    RETURN jsonb_build_object('ok', true, 'product_id', v_product, 'day', v_day, 'portions', v_portions, 'sold', COALESCE(v_sold, 0));
END;
$$;

-- Vérification d'un produit par l'administration (droit partners.validate, ou SUPERADMIN) : réglementé ou non ;
-- motif obligatoire ; journal
CREATE OR REPLACE FUNCTION public.order_product_regulation_decide(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_product uuid := public.try_uuid(p->>'product_id');
    v_reason  text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'reason', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    v_value   boolean;
    pr        record;
BEGIN
    IF jsonb_typeof(p->'regulated') <> 'boolean' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DECISION', 'message', 'Indiquez si le produit est réglementé ou non.');
    END IF;
    v_value := (p->>'regulated')::boolean;
    IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
       OR NOT (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
               OR public.has_admin_permission(v_actor, 'partners.validate')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit de vérifier les produits.');
    END IF;
    IF v_reason IS NULL OR length(v_reason) < 3 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif de la vérification.');
    END IF;
    SELECT * INTO pr FROM public.products WHERE id = v_product FOR UPDATE;
    IF v_product IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_NOT_FOUND', 'message', 'Produit introuvable.');
    END IF;
    PERFORM set_config('event_village.product_regulation', 'on', true);
    UPDATE public.products
       SET regulated_admin = v_value, regulated_checked_by = v_actor, regulated_checked_at = now(), updated_at = now()
     WHERE id = pr.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, CASE WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN') THEN 'SUPERADMIN' ELSE 'ADMIN' END,
            'PRODUCT_REGULATION_DECIDED', 'products', pr.id,
            jsonb_build_object('regulated_admin', pr.regulated_admin), jsonb_build_object('regulated_admin', v_value),
            jsonb_build_object('reason', v_reason, 'partner_box', pr.is_regulated));
    RETURN jsonb_build_object('ok', true, 'product_id', pr.id, 'regulated_admin', v_value,
                              'regulated', pr.is_regulated OR v_value);
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Lecture et écritures
-- ----------------------------------------------------------------------------
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_daily_portions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_delivery_zones ENABLE ROW LEVEL SECURITY;

-- Les sous-requêtes passent par la règle de lecture du produit ou de l'établissement
DROP POLICY IF EXISTS "product_options_read" ON public.product_options;
CREATE POLICY "product_options_read" ON public.product_options
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.products pr WHERE pr.id = product_options.product_id));
DROP POLICY IF EXISTS "product_daily_portions_read" ON public.product_daily_portions;
CREATE POLICY "product_daily_portions_read" ON public.product_daily_portions
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.products pr WHERE pr.id = product_daily_portions.product_id));
DROP POLICY IF EXISTS "order_delivery_zones_read" ON public.order_delivery_zones;
CREATE POLICY "order_delivery_zones_read" ON public.order_delivery_zones
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.venues v WHERE v.id = order_delivery_zones.venue_id));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.product_options FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.product_daily_portions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.order_delivery_zones FROM anon, authenticated;
GRANT SELECT ON public.product_options, public.product_daily_portions, public.order_delivery_zones TO anon, authenticated;
GRANT ALL ON public.product_options, public.product_daily_portions, public.order_delivery_zones TO service_role;
-- Produits : plus aucune écriture REST (les routes serveur écrivent avec le rôle de service)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.products FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.product_regulated(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_venue_settings_set(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_daily_portions_set(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_product_regulation_decide(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_regulated(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_venue_settings_set(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_daily_portions_set(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_product_regulation_decide(jsonb) TO service_role;
