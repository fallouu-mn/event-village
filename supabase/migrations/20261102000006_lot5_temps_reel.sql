-- ============================================================================
-- EVENT VILLAGE — LOT 5 : temps réel (tâche 5.13, contrat O1, O2 et arbitrage A3/O)
-- ============================================================================
-- Idempotente : peut être rejouée sans effet de bord.
--  O1. Résumés publics tenus par triggers, seules données publiques diffusées par Realtime :
--      - public_event_state : une ligne par événement qui a été public au moins une fois (PUBLIE,
--        SUSPENDU, ANNULE, TERMINE, avec son statut) ; jamais de ligne pour BROUILLON, EN_ATTENTE, VALIDE ;
--      - public_category_stock : une ligne par catégorie active ET visible d'un événement public, stock en
--        tranches (AVAILABLE, LOW, SOLD_OUT ; restant seulement en LOW), réécrite seulement si la tranche
--        ou le restant en LOW change ;
--      - seuil access.low_stock_threshold (défaut 10, entier de 1 à 1000, SUPERADMIN seul par
--        finance_setting_set, historisé) ; un changement du seuil recalcule les tranches.
--  O2. admin_signals (EVENT_SUBMITTED à la transition vers EN_ATTENTE, PARTNER_REGISTERED à l'INSERT dans
--      partners), réservée aux admins ; publication supabase_realtime : public_event_state,
--      public_category_stock, event_status_history, controller_shifts, scan_incidents, admin_signals ;
--      controller_shifts.regisseur_pin_used (copie du haché du PIN, vidée au lot 4) supprimée avant
--      publication.
--      tickets reste publiée : totp_secret et qr_code ne sont plus lisibles par anon ni authenticated
--      (privilèges de colonne : la diffusion Realtime retire de la charge les colonnes que le rôle de
--      l'abonné ne peut pas lire). L'application lit tickets en service_role uniquement.
--  A3/O. ticket_categories reste publiée (le partenaire propriétaire suit ses catégories) : sold_quantity,
--      held_quantity et held_expires_at ne sont pas lisibles par anon ni authenticated (migration
--      20261102000001) ; le privilège des autres colonnes est réappliqué ici pour couvrir les colonnes
--      ajoutées depuis. Le stock public passe seulement par public_category_stock.
--  tickets.updated_at : une valeur posée explicitement par l'UPDATE est conservée (sinon now(), comme
--      avant) ; les tests temps réel identifient leurs messages par cet horodatage.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Réglage access.low_stock_threshold
-- ----------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, description) VALUES
    ('access.low_stock_threshold', '{"value": 10}', 'Stock public : une catégorie passe en « bientôt complet » (restant affiché) quand il lui reste ce nombre de places ou moins (entier de 1 à 1000)')
ON CONFLICT (key) DO NOTHING;

-- Validation (reprise de 20261101000009_lot4_reglages_acces.sql, plus le seuil de stock)
CREATE OR REPLACE FUNCTION public.fin_setting_valid(p_key text, v jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    n numeric;
BEGIN
    IF v IS NULL THEN RETURN FALSE; END IF;
    IF p_key IN ('finance.payout_hold_enabled', 'finance.withdrawal_bank_enabled', 'access.counter_sale_enabled') THEN
        RETURN jsonb_typeof(v) = 'boolean';
    END IF;
    IF p_key = 'access.manual_entry_scope' THEN
        RETURN jsonb_typeof(v) = 'string' AND (v #>> '{}') IN ('ASSIGNED_CONTROLLER', 'STAFF');
    END IF;
    IF p_key = 'finance.cancellation_aggregator_fee_bearer' THEN
        RETURN jsonb_typeof(v) = 'string' AND (v #>> '{}') IN ('EVENT_VILLAGE', 'ORGANISATEUR');
    END IF;
    IF jsonb_typeof(v) <> 'number' THEN RETURN FALSE; END IF;
    n := (v #>> '{}')::numeric;
    RETURN CASE p_key
        WHEN 'finance.service_fee_rate' THEN n >= 0 AND n <= 50
        WHEN 'finance.aggregator_fee_rate.WAVE' THEN n >= 0 AND n <= 10
        WHEN 'finance.aggregator_fee_rate.ORANGE_MONEY' THEN n >= 0 AND n <= 10
        WHEN 'finance.payout_delay_hours' THEN n = trunc(n) AND n >= 0 AND n <= 720
        WHEN 'finance.withdrawal_fee_rate' THEN n >= 0 AND n <= 10
        WHEN 'finance.withdrawal_min_amount' THEN n = trunc(n) AND n >= 0 AND n <= 10000000
        WHEN 'finance.referral_availability_days' THEN n = trunc(n) AND n >= 7 AND n <= 14
        WHEN 'access.scan_window_before_hours' THEN n = trunc(n) AND n >= 0 AND n <= 48
        WHEN 'access.scan_window_after_hours' THEN n = trunc(n) AND n >= 0 AND n <= 48
        WHEN 'access.low_stock_threshold' THEN n = trunc(n) AND n >= 1 AND n <= 1000
        ELSE FALSE END;
END;
$$;

-- Écriture (reprise de 20261101000009_lot4_reglages_acces.sql, plus le seuil de stock dans la liste des clés)
CREATE OR REPLACE FUNCTION public.finance_setting_set(p_key text, p_value jsonb, p_actor uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb := p_value->'value';
BEGIN
    IF p_key IS NULL OR p_key NOT IN (
        'finance.service_fee_rate', 'finance.aggregator_fee_rate.WAVE', 'finance.aggregator_fee_rate.ORANGE_MONEY',
        'finance.cancellation_aggregator_fee_bearer', 'finance.payout_hold_enabled', 'finance.payout_delay_hours',
        'finance.withdrawal_fee_rate', 'finance.withdrawal_min_amount', 'finance.withdrawal_bank_enabled',
        'finance.referral_availability_days', 'access.manual_entry_scope', 'access.scan_window_before_hours',
        'access.scan_window_after_hours', 'access.counter_sale_enabled', 'access.low_stock_threshold') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_KEY', 'message', 'Réglage inconnu.');
    END IF;
    IF p_actor IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_roles r JOIN public.users u ON u.id = r.user_id
         WHERE r.user_id = p_actor AND r.role = 'SUPERADMIN' AND u.status = 'ACTIF'
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Seul un SUPERADMIN actif modifie les réglages financiers et d''accès.');
    END IF;
    IF NOT public.fin_setting_valid(p_key, v) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_VALUE', 'message', format('Valeur refusée pour %s : %s', p_key, COALESCE(v::text, 'absente')));
    END IF;
    PERFORM set_config('finance.change_reason', COALESCE(p_reason, ''), true);
    INSERT INTO public.platform_settings (key, value, updated_by, updated_at)
    VALUES (p_key, jsonb_build_object('value', v), p_actor, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
    RETURN jsonb_build_object('ok', true, 'key', p_key, 'value', v);
END;
$$;

-- Seuil courant. La valeur est validée à l'écriture (finance_setting_set) ; une ligne absente donne le
-- défaut du contrat (10), comme GET /api/events/[id].
CREATE OR REPLACE FUNCTION public.low_stock_threshold()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb;
    n numeric;
BEGIN
    SELECT s.value->'value' INTO v FROM public.platform_settings s WHERE s.key = 'access.low_stock_threshold';
    IF v IS NULL THEN RETURN 10; END IF;
    IF jsonb_typeof(v) <> 'number' THEN RETURN 10; END IF;
    n := (v #>> '{}')::numeric;
    IF n <> trunc(n) OR n < 1 OR n > 1000 THEN RETURN 10; END IF;
    RETURN n::integer;
END;
$$;

-- ----------------------------------------------------------------------------
-- O1 — tables de résumé public
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.public_event_state (
    event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE')),
    title TEXT NOT NULL,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    location TEXT,
    city TEXT,
    image_url TEXT,
    min_price NUMERIC(12, 2),
    has_purchasable BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.public_event_state IS
    'Lot 5 (O1) : résumé public d''un événement déjà publié (statut public, titre, dates, lieu, affiche, prix « à partir de » des catégories actives et visibles, catégorie achetable selon le statut et le stock). Tenue par triggers, lisible par tous, diffusée par Realtime.';

CREATE TABLE IF NOT EXISTS public.public_category_stock (
    category_id UUID PRIMARY KEY REFERENCES public.ticket_categories(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    availability TEXT NOT NULL CHECK (availability IN ('AVAILABLE', 'LOW', 'SOLD_OUT')),
    remaining_hint INTEGER CHECK (remaining_hint IS NULL OR remaining_hint > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT public_category_stock_hint_low CHECK ((availability = 'LOW') = (remaining_hint IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_public_category_stock_event ON public.public_category_stock (event_id);
COMMENT ON TABLE public.public_category_stock IS
    'Lot 5 (O1) : stock public en tranches d''une catégorie active et visible d''un événement public (AVAILABLE, LOW avec le restant, SOLD_OUT), sans aucun volume de vente. Tenue par triggers, lisible par tous, diffusée par Realtime.';

ALTER TABLE public.public_event_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_event_state_read" ON public.public_event_state;
CREATE POLICY "public_event_state_read" ON public.public_event_state
    FOR SELECT TO anon, authenticated USING (TRUE);
REVOKE ALL ON TABLE public.public_event_state FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_event_state TO anon, authenticated;
GRANT ALL ON TABLE public.public_event_state TO service_role;

ALTER TABLE public.public_category_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_category_stock_read" ON public.public_category_stock;
CREATE POLICY "public_category_stock_read" ON public.public_category_stock
    FOR SELECT TO anon, authenticated USING (TRUE);
REVOKE ALL ON TABLE public.public_category_stock FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_category_stock TO anon, authenticated;
GRANT ALL ON TABLE public.public_category_stock TO service_role;

-- Tranche d'une catégorie : restant = quota − vendus − en cours de paiement (même calcul que
-- GET /api/events/[id]) ; SOLD_OUT à 0, LOW si 0 < restant ≤ seuil (restant diffusé), AVAILABLE sinon.
-- La ligne n'existe que pour une catégorie active et visible d'un événement public ; elle n'est réécrite
-- que si la tranche ou le restant en LOW change. Le verrou de la ligne n'est pris que pour une écriture.
CREATE OR REPLACE FUNCTION public.public_category_stock_sync(p_category_id uuid, p_threshold integer DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid;
    v_total integer;
    v_sold integer;
    v_held integer;
    v_active boolean;
    v_visible boolean;
    v_status text;
    v_threshold integer;
    v_remaining integer;
    v_availability text;
    v_hint integer;
BEGIN
    IF p_category_id IS NULL THEN RETURN; END IF;
    SELECT tc.event_id, tc.total_quantity, tc.sold_quantity, tc.held_quantity, tc.is_active, tc.is_visible, e.status::text
      INTO v_event, v_total, v_sold, v_held, v_active, v_visible, v_status
      FROM public.ticket_categories tc
      JOIN public.events e ON e.id = tc.event_id
     WHERE tc.id = p_category_id;
    IF NOT FOUND THEN
        DELETE FROM public.public_category_stock WHERE category_id = p_category_id;
        RETURN;
    END IF;
    IF NOT (COALESCE(v_active, FALSE) AND COALESCE(v_visible, FALSE)
            AND v_status IN ('PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE')) THEN
        DELETE FROM public.public_category_stock WHERE category_id = p_category_id;
        RETURN;
    END IF;

    v_threshold := COALESCE(p_threshold, public.low_stock_threshold());
    v_remaining := GREATEST(COALESCE(v_total, 0) - COALESCE(v_sold, 0) - COALESCE(v_held, 0), 0);
    IF v_remaining = 0 THEN
        v_availability := 'SOLD_OUT';
        v_hint := NULL;
    ELSIF v_remaining <= v_threshold THEN
        v_availability := 'LOW';
        v_hint := v_remaining;
    ELSE
        v_availability := 'AVAILABLE';
        v_hint := NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM public.public_category_stock s WHERE s.category_id = p_category_id) THEN
        UPDATE public.public_category_stock
           SET event_id = v_event, availability = v_availability, remaining_hint = v_hint, updated_at = now()
         WHERE category_id = p_category_id
           AND (event_id IS DISTINCT FROM v_event
                OR availability IS DISTINCT FROM v_availability
                OR remaining_hint IS DISTINCT FROM v_hint);
    ELSE
        INSERT INTO public.public_category_stock (category_id, event_id, availability, remaining_hint, updated_at)
        VALUES (p_category_id, v_event, v_availability, v_hint, now())
        ON CONFLICT (category_id) DO UPDATE
           SET event_id = EXCLUDED.event_id, availability = EXCLUDED.availability,
               remaining_hint = EXCLUDED.remaining_hint, updated_at = EXCLUDED.updated_at;
    END IF;
END;
$$;

-- Résumé public d'un événement : ligne créée ou mise à jour pour un statut public, jamais pour un statut
-- non public ; réécrite seulement si une valeur change.
CREATE OR REPLACE FUNCTION public.public_event_state_sync(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status text;
    v_title text;
    v_start_date date;
    v_start_time time;
    v_location text;
    v_city text;
    v_image text;
    v_start timestamptz;
    v_end timestamptz;
    v_min numeric;
    v_any boolean;
    v_has boolean;
BEGIN
    IF p_event_id IS NULL THEN RETURN; END IF;
    SELECT e.status::text, e.title, e.start_date, e.start_time, e.location, e.city, e.image_url
      INTO v_status, v_title, v_start_date, v_start_time, v_location, v_city, v_image
      FROM public.events e
     WHERE e.id = p_event_id;
    IF NOT FOUND THEN
        DELETE FROM public.public_event_state WHERE event_id = p_event_id;
        RETURN;
    END IF;
    IF v_status NOT IN ('PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE') THEN
        DELETE FROM public.public_event_state WHERE event_id = p_event_id;
        RETURN;
    END IF;

    v_start := CASE WHEN v_start_date IS NULL THEN NULL
                    ELSE (v_start_date + COALESCE(v_start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar' END;
    v_end := public.event_end_at(p_event_id);
    SELECT min(tc.price),
           COALESCE(bool_or(GREATEST(COALESCE(tc.total_quantity, 0) - COALESCE(tc.sold_quantity, 0) - COALESCE(tc.held_quantity, 0), 0) > 0), FALSE)
      INTO v_min, v_any
      FROM public.ticket_categories tc
     WHERE tc.event_id = p_event_id AND tc.is_active AND tc.is_visible;
    -- Achat possible d'après le statut et le stock ; les dates de vente et la fin sont évaluées par l'API.
    v_has := (v_status = 'PUBLIE') AND COALESCE(v_any, FALSE);

    IF EXISTS (SELECT 1 FROM public.public_event_state s WHERE s.event_id = p_event_id) THEN
        UPDATE public.public_event_state
           SET status = v_status, title = v_title, start_at = v_start, end_at = v_end, location = v_location,
               city = v_city, image_url = v_image, min_price = v_min, has_purchasable = v_has, updated_at = now()
         WHERE event_id = p_event_id
           AND (status, title, start_at, end_at, location, city, image_url, min_price, has_purchasable)
               IS DISTINCT FROM (v_status, v_title, v_start, v_end, v_location, v_city, v_image, v_min, v_has);
    ELSE
        INSERT INTO public.public_event_state
               (event_id, status, title, start_at, end_at, location, city, image_url, min_price, has_purchasable, updated_at)
        VALUES (p_event_id, v_status, v_title, v_start, v_end, v_location, v_city, v_image, v_min, v_has, now())
        ON CONFLICT (event_id) DO UPDATE
           SET status = EXCLUDED.status, title = EXCLUDED.title, start_at = EXCLUDED.start_at, end_at = EXCLUDED.end_at,
               location = EXCLUDED.location, city = EXCLUDED.city, image_url = EXCLUDED.image_url,
               min_price = EXCLUDED.min_price, has_purchasable = EXCLUDED.has_purchasable, updated_at = EXCLUDED.updated_at;
    END IF;
END;
$$;

-- Triggers de contrainte différés : le résumé est calculé une fois, sur l'état final, à la validation de la
-- transaction (une confirmation de paiement libère la réservation puis compte la vente : aucun état
-- intermédiaire n'est diffusé) ; les lignes de résumé ne sont verrouillées qu'à ce moment. Ordre des écritures
-- identique partout (stock des catégories, puis résumé de l'événement) pour ne pas croiser les verrous.
CREATE OR REPLACE FUNCTION public.events_public_summary_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_category uuid;
    v_threshold integer;
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        v_threshold := public.low_stock_threshold();
        FOR v_category IN SELECT tc.id FROM public.ticket_categories tc WHERE tc.event_id = NEW.id ORDER BY tc.id LOOP
            PERFORM public.public_category_stock_sync(v_category, v_threshold);
        END LOOP;
    END IF;
    PERFORM public.public_event_state_sync(NEW.id);
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ticket_categories_public_summary_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.public_category_stock_sync(OLD.id);
        PERFORM public.public_event_state_sync(OLD.event_id);
        RETURN NULL;
    END IF;
    PERFORM public.public_category_stock_sync(NEW.id);
    IF TG_OP = 'UPDATE' THEN
        IF OLD.event_id IS DISTINCT FROM NEW.event_id THEN
            PERFORM public.public_event_state_sync(OLD.event_id);
        END IF;
    END IF;
    PERFORM public.public_event_state_sync(NEW.event_id);
    RETURN NULL;
END;
$$;

-- Changement du seuil : les tranches existantes sont recalculées dans la même transaction.
CREATE OR REPLACE FUNCTION public.low_stock_threshold_resync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_category uuid;
    v_threshold integer;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.value IS NOT DISTINCT FROM OLD.value THEN
            RETURN NULL;
        END IF;
    END IF;
    v_threshold := public.low_stock_threshold();
    FOR v_category IN SELECT s.category_id FROM public.public_category_stock s ORDER BY s.category_id LOOP
        PERFORM public.public_category_stock_sync(v_category, v_threshold);
    END LOOP;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_public_summary_sync ON public.events;
CREATE CONSTRAINT TRIGGER trg_events_public_summary_sync
    AFTER UPDATE OF status, title, start_date, start_time, end_date, end_time, location, city, image_url ON public.events
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION public.events_public_summary_sync();

DROP TRIGGER IF EXISTS trg_ticket_categories_public_summary_sync ON public.ticket_categories;
CREATE CONSTRAINT TRIGGER trg_ticket_categories_public_summary_sync
    AFTER INSERT OR DELETE OR UPDATE OF event_id, price, total_quantity, sold_quantity, held_quantity, is_active, is_visible
    ON public.ticket_categories
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION public.ticket_categories_public_summary_sync();

DROP TRIGGER IF EXISTS trg_low_stock_threshold_resync ON public.platform_settings;
CREATE TRIGGER trg_low_stock_threshold_resync
    AFTER INSERT OR UPDATE OF value ON public.platform_settings
    FOR EACH ROW WHEN (NEW.key = 'access.low_stock_threshold')
    EXECUTE FUNCTION public.low_stock_threshold_resync();

-- Reprise : événements déjà publics et leurs catégories
DO $$
DECLARE
    v_event uuid;
    v_category uuid;
    v_threshold integer := public.low_stock_threshold();
BEGIN
    FOR v_category IN
        SELECT tc.id FROM public.ticket_categories tc JOIN public.events e ON e.id = tc.event_id
         WHERE e.status::text IN ('PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE')
         ORDER BY tc.id
    LOOP
        PERFORM public.public_category_stock_sync(v_category, v_threshold);
    END LOOP;
    FOR v_event IN
        SELECT e.id FROM public.events e WHERE e.status::text IN ('PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE') ORDER BY e.id
    LOOP
        PERFORM public.public_event_state_sync(v_event);
    END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- O2 — signaux de l'administration
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL CHECK (kind IN ('EVENT_SUBMITTED', 'PARTNER_REGISTERED')),
    ref_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_signals_created ON public.admin_signals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_signals_kind_ref ON public.admin_signals (kind, ref_id);
COMMENT ON TABLE public.admin_signals IS
    'Lot 5 (O2) : signaux temps réel de l''administration (événement soumis à validation, partenaire inscrit), identifiant de l''objet seulement. Écrite par triggers, lisible par les admins.';

ALTER TABLE public.admin_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_signals_admin_read" ON public.admin_signals;
CREATE POLICY "admin_signals_admin_read" ON public.admin_signals
    FOR SELECT TO authenticated USING (public.is_admin());
REVOKE ALL ON TABLE public.admin_signals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_signals TO authenticated;
GRANT ALL ON TABLE public.admin_signals TO service_role;

CREATE OR REPLACE FUNCTION public.admin_signal_event_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.admin_signals (kind, ref_id) VALUES ('EVENT_SUBMITTED', NEW.event_id);
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_signal_partner_registered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.admin_signals (kind, ref_id) VALUES ('PARTNER_REGISTERED', NEW.id);
    RETURN NULL;
END;
$$;

-- Soumission = toute ligne d'historique vers EN_ATTENTE (event_transition, seule voie : garde D3)
DROP TRIGGER IF EXISTS trg_admin_signal_event_submitted ON public.event_status_history;
CREATE TRIGGER trg_admin_signal_event_submitted
    AFTER INSERT ON public.event_status_history
    FOR EACH ROW WHEN (NEW.new_status = 'EN_ATTENTE'::event_status)
    EXECUTE FUNCTION public.admin_signal_event_submitted();

DROP TRIGGER IF EXISTS trg_admin_signal_partner_registered ON public.partners;
CREATE TRIGGER trg_admin_signal_partner_registered
    AFTER INSERT ON public.partners
    FOR EACH ROW EXECUTE FUNCTION public.admin_signal_partner_registered();

-- ----------------------------------------------------------------------------
-- O2 — tickets : colonnes secrètes illisibles pour les rôles API (REST et Realtime)
-- ----------------------------------------------------------------------------
-- Grep des lectures de tickets (git grep -n "from('tickets')" -- app components hooks lib) : toutes
-- passent par getServiceRoleClient() ; le navigateur ne lit tickets que par Realtime (Mes billets :
-- status, checked_in_at, transfer_locked ; scanner : status). anon ne reçoit plus aucun privilège de
-- lecture (la RLS ne lui rendait déjà aucune ligne) ; authenticated garde toutes les autres colonnes.
-- Une colonne ajoutée plus tard à tickets doit recevoir son GRANT SELECT (colonne) explicite.
REVOKE SELECT ON TABLE public.tickets FROM anon, authenticated;
REVOKE SELECT (totp_secret, qr_code) ON TABLE public.tickets FROM anon, authenticated;
DO $$
DECLARE
    v_cols text;
BEGIN
    SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position) INTO v_cols
      FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.table_name = 'tickets'
       AND c.column_name NOT IN ('totp_secret', 'qr_code');
    IF v_cols IS NULL THEN
        RAISE EXCEPTION 'tickets : aucune colonne à accorder';
    END IF;
    EXECUTE format('GRANT SELECT (%s) ON TABLE public.tickets TO authenticated', v_cols);
END;
$$;

-- A3/O — ticket_categories : privilège de colonne réappliqué (colonnes ajoutées depuis 20261102000001)
DO $$
DECLARE
    v_cols text;
BEGIN
    SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position) INTO v_cols
      FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.table_name = 'ticket_categories'
       AND c.column_name NOT IN ('sold_quantity', 'held_quantity', 'held_expires_at');
    IF v_cols IS NULL THEN
        RAISE EXCEPTION 'ticket_categories : aucune colonne à accorder';
    END IF;
    EXECUTE format('GRANT SELECT (%s) ON TABLE public.ticket_categories TO anon, authenticated', v_cols);
END;
$$;

-- tickets.updated_at : valeur explicite conservée, sinon now() (comportement de handle_updated_at)
CREATE OR REPLACE FUNCTION public.tickets_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
        NEW.updated_at := now();
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_tickets_updated_at ON public.tickets;
CREATE TRIGGER trg_tickets_updated_at BEFORE UPDATE ON public.tickets
    FOR EACH ROW EXECUTE FUNCTION public.tickets_touch_updated_at();

-- ----------------------------------------------------------------------------
-- O2 — controller_shifts : plus de colonne du haché du PIN avant publication
-- ----------------------------------------------------------------------------
-- regisseur_pin_used : vidée par 20261101000011_lot4_caisse.sql, plus lue ni écrite (lib/shifts,
-- shift_open, shift_close). RLS SELECT : contrôleur de la caisse, partenaire propriétaire, admins.
ALTER TABLE public.controller_shifts DROP COLUMN IF EXISTS regisseur_pin_used;

-- ----------------------------------------------------------------------------
-- O2 — publication supabase_realtime
-- ----------------------------------------------------------------------------
-- RLS vérifiée pour chaque table ajoutée :
--   public_event_state, public_category_stock : SELECT pour tous (données publiques seulement) ;
--   event_status_history : partenaire propriétaire et admins (20261102000003) ;
--   controller_shifts : contrôleur de la caisse, partenaire propriétaire, admins (20260906000002,
--     20261101000011) ;
--   scan_incidents : partenaire propriétaire et admins (20261102000002) ;
--   admin_signals : admins.
-- payments reste hors publication (20261102000001).
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['public_event_state', 'public_category_stock', 'event_status_history',
                             'controller_shifts', 'scan_incidents', 'admin_signals'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- Privilèges des fonctions
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    -- Fonctions internes : service_role uniquement
    FOREACH f IN ARRAY ARRAY[
        'public.fin_setting_valid(text, jsonb)',
        'public.finance_setting_set(text, jsonb, uuid, text)',
        'public.low_stock_threshold()',
        'public.public_category_stock_sync(uuid, integer)',
        'public.public_event_state_sync(uuid)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
    -- Fonctions de triggers : aucun EXECUTE pour anon ni authenticated ; service_role le garde (contrôle 1A.3 de
    -- supabase/hotfix/2026-10-31-lot1a/03-verification.sql : toute fonction de public hors liste blanche reste
    -- exécutable par service_role)
    FOREACH f IN ARRAY ARRAY[
        'public.events_public_summary_sync()',
        'public.ticket_categories_public_summary_sync()',
        'public.low_stock_threshold_resync()',
        'public.admin_signal_event_submitted()',
        'public.admin_signal_partner_registered()',
        'public.tickets_touch_updated_at()'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
