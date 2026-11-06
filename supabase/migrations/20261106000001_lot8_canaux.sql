-- ============================================================================
-- EVENT VILLAGE — LOT 8, TÂCHE 8.0 : canaux de vente par catégorie (contrat 2.2, 2.4, décisions L5 à L14)
-- ============================================================================
-- « visible » mélangeait deux notions : affichée en ligne, et vendable au guichet. Chaque catégorie porte
-- désormais deux réglages explicites :
--  1. ticket_categories.sale_online : vendue en ligne. Source de vérité ; is_visible en reste le miroir, écrit
--     par trg_ticket_categories_channels (L5) : les migrations gelées du lot 7 recréent une politique sur
--     is_visible en test, la colonne ne peut pas être supprimée ;
--  2. ticket_categories.sale_counter : vendue au guichet, indépendante.
--
-- Contrôle en base :
--  - en ligne, dans ticket_sale_problems : checkout_create_payment et free_tickets_claim en héritent sous leur
--    verrou, sans recopie (L6) ; problème CATEGORY_NOT_SOLD_ONLINE sous le code de tête SALE_CHECK_FAILED (L7) ;
--  - au guichet, dans counter_sale et counter_sale_quote, par ticket_counter_channel_problems : code de tête
--    CATEGORY_NOT_SOLD_AT_COUNTER (L7). Le rejeu d'une vente déjà faite passe avant ce contrôle.
--
-- Décision figée à la vente, posée par triggers, sans recopier payment_confirm ni free_tickets_claim (L12) :
--  - stock_reservations.sale_online_at_checkout : décision du checkout, un paiement en cours pendant une coupure
--    reste honoré (L8) ;
--  - tickets.sale_decision (jsonb immuable, illisible par anon et authenticated) : source RESERVATION ou
--    CATEGORIE. Lignes existantes : REPRISE sans réécriture ; lignes futures sans trigger : SANS_DECISION, qui
--    sort en violation de l'invariant (t) (fail-closed).
--
-- Reprise sans changement de comportement : sale_online = is_visible, sale_counter = vrai par le défaut.
--
-- Fonctions recopiées en entier, à signature identique (une seule définition dans le lot, contrat 2.2). Base,
-- lignes et changements sont donnés en tête de chaque recopie. checkout_create_payment, free_tickets_claim et
-- pilotage_category_stats (RETURNS TABLE) ne sont pas recopiées.
--
-- Ordre imposé : tout le DDL sur ticket_categories avant la reprise, reprise en dernier (une écriture laisse un
-- événement en attente sur la contrainte différée, et ALTER TABLE lèverait 55006 au passage suivant).
-- Rejouable : ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, DROP … IF EXISTS, reprise gardée par IS DISTINCT
-- FROM : aucune ligne touchée au second passage. Aucun BEGIN ni COMMIT.
-- Privilèges (règle 1A.3) : SECURITY DEFINER, search_path = public, volatilité explicite ; aucun EXECUTE pour
-- PUBLIC, anon et authenticated, service_role seul. Aucune nouvelle aide RLS.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. ticket_categories : les deux canaux
-- ----------------------------------------------------------------------------
-- sale_counter reçoit vrai par le défaut, comme aujourd'hui, sans UPDATE. Privilège de colonne obligatoire :
-- anon et authenticated n'ont pas de SELECT de table (20261102000001_lot5_securite.sql:79-94), et la politique
-- publique lit sale_online.
ALTER TABLE public.ticket_categories ADD COLUMN IF NOT EXISTS sale_online boolean NOT NULL DEFAULT TRUE;
ALTER TABLE public.ticket_categories ADD COLUMN IF NOT EXISTS sale_counter boolean NOT NULL DEFAULT TRUE;
GRANT SELECT (sale_online, sale_counter) ON public.ticket_categories TO anon, authenticated;

COMMENT ON COLUMN public.ticket_categories.sale_online IS
    'Lot 8 (L5) : catégorie vendue en ligne. Source de vérité ; is_visible en est le miroir (trg_ticket_categories_channels).';
COMMENT ON COLUMN public.ticket_categories.sale_counter IS
    'Lot 8 : catégorie vendue au guichet. Sans aucun des deux canaux, elle n''est distribuée à personne (AR8).';


-- ----------------------------------------------------------------------------
-- 2. stock_reservations.sale_online_at_checkout : décision prise au checkout
-- ----------------------------------------------------------------------------
-- Lignes existantes à vrai : l'ancien contrôle is_visible les a laissées passer. Lignes futures à faux si le
-- trigger manquait (fail-closed).
ALTER TABLE public.stock_reservations ADD COLUMN IF NOT EXISTS sale_online_at_checkout boolean NOT NULL DEFAULT TRUE;
ALTER TABLE public.stock_reservations ALTER COLUMN sale_online_at_checkout SET DEFAULT FALSE;

COMMENT ON COLUMN public.stock_reservations.sale_online_at_checkout IS
    'Lot 8 (L12) : sale_online de la catégorie au checkout. Posé par trg_stock_reservations_sale_online, jamais par l''appelant.';

-- La catégorie est déjà verrouillée par checkout_create_payment : la valeur lue est celle du contrôle.
CREATE OR REPLACE FUNCTION public.stock_reservations_sale_online_set()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_online boolean;
BEGIN
    SELECT c.sale_online INTO v_online FROM public.ticket_categories c WHERE c.id = NEW.category_id;
    NEW.sale_online_at_checkout := COALESCE(v_online, FALSE);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_reservations_sale_online ON public.stock_reservations;
CREATE TRIGGER trg_stock_reservations_sale_online
    BEFORE INSERT ON public.stock_reservations
    FOR EACH ROW EXECUTE FUNCTION public.stock_reservations_sale_online_set();


-- ----------------------------------------------------------------------------
-- 3. tickets.sale_decision : décision figée à la vente
-- ----------------------------------------------------------------------------
-- Aucun UPDATE de masse : les billets existants prennent REPRISE par la valeur manquante de la colonne, sans
-- réécriture ni trigger. SET DEFAULT plutôt que DROP DEFAULT : les suites qui coupent les triggers de tickets
-- dans une transaction annulée y insèrent encore. Aucun GRANT : colonne illisible par anon et authenticated
-- (pas de SELECT de table, 20261102000006_lot5_temps_reel.sql:490-505), filtrée par Realtime.
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS sale_decision jsonb NOT NULL DEFAULT '{"source":"REPRISE"}'::jsonb;
ALTER TABLE public.tickets ALTER COLUMN sale_decision SET DEFAULT '{"source":"SANS_DECISION"}'::jsonb;

COMMENT ON COLUMN public.tickets.sale_decision IS
    'Lot 8 (L12) : canaux au moment de la vente (source RESERVATION, CATEGORIE ; REPRISE pour les billets antérieurs). Posé par trg_tickets_sale_decision, immuable.';

-- Billet payé en ligne : la décision est celle du checkout, lue sur sa réservation, même échue puis honorée, et
-- datée du checkout. Autres cas (guichet, gratuit, invitation) : réglages de la catégorie, déjà verrouillée par
-- counter_sale et free_tickets_claim. Catégorie introuvable : clés nulles, ce que l'invariant (t) refuse.
CREATE OR REPLACE FUNCTION public.tickets_sale_decision_set()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_online boolean;
    v_counter boolean;
    v_checkout boolean;
    v_checkout_at timestamptz;
BEGIN
    SELECT c.sale_online, c.sale_counter INTO v_online, v_counter
      FROM public.ticket_categories c WHERE c.id = NEW.category_id;
    IF NEW.sale_channel = 'ONLINE' AND NEW.payment_id IS NOT NULL THEN
        SELECT r.sale_online_at_checkout, r.created_at INTO v_checkout, v_checkout_at
          FROM public.stock_reservations r
         WHERE r.payment_id = NEW.payment_id AND r.category_id = NEW.category_id;
        IF FOUND THEN
            NEW.sale_decision := jsonb_build_object('source', 'RESERVATION', 'sale_online', v_checkout,
                                                    'sale_counter', v_counter, 'decided_at', v_checkout_at);
            RETURN NEW;
        END IF;
    END IF;
    NEW.sale_decision := jsonb_build_object('source', 'CATEGORIE', 'sale_online', v_online,
                                            'sale_counter', v_counter, 'decided_at', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_sale_decision ON public.tickets;
CREATE TRIGGER trg_tickets_sale_decision
    BEFORE INSERT ON public.tickets
    FOR EACH ROW EXECUTE FUNCTION public.tickets_sale_decision_set();

CREATE OR REPLACE FUNCTION public.tickets_sale_decision_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'La décision de vente d''un billet ne se modifie pas.' USING ERRCODE = 'EV422';
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_sale_decision_guard ON public.tickets;
CREATE TRIGGER trg_tickets_sale_decision_guard
    BEFORE UPDATE OF sale_decision ON public.tickets
    FOR EACH ROW EXECUTE FUNCTION public.tickets_sale_decision_guard();


-- ----------------------------------------------------------------------------
-- 4. Miroir is_visible ↔ sale_online
-- ----------------------------------------------------------------------------
-- À l'insertion, les deux doivent être vrais pour vendre en ligne. En modification, sale_online gagne s'il change.
-- Ce trigger couvre tous les chemins d'écriture, dont l'écriture REST d'un admin (ticket_categories_admin_manage).
CREATE OR REPLACE FUNCTION public.ticket_categories_channels_sync()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.sale_online := NEW.sale_online AND NEW.is_visible;
        NEW.is_visible := NEW.sale_online;
    ELSIF NEW.sale_online IS DISTINCT FROM OLD.sale_online THEN
        NEW.is_visible := NEW.sale_online;
    ELSIF NEW.is_visible IS DISTINCT FROM OLD.is_visible THEN
        NEW.sale_online := NEW.is_visible;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_categories_channels ON public.ticket_categories;
CREATE TRIGGER trg_ticket_categories_channels
    BEFORE INSERT OR UPDATE OF is_visible, sale_online ON public.ticket_categories
    FOR EACH ROW EXECUTE FUNCTION public.ticket_categories_channels_sync();


-- ----------------------------------------------------------------------------
-- 5. Résumé public : sale_online ajouté à la liste UPDATE OF
-- ----------------------------------------------------------------------------
-- Recréation de 20261102000006_lot5_temps_reel.sql:390-395. UPDATE OF ne voit pas les colonnes changées par un
-- trigger BEFORE : sans cet ajout, UPDATE SET sale_online = false ne resynchroniserait rien.
DROP TRIGGER IF EXISTS trg_ticket_categories_public_summary_sync ON public.ticket_categories;
CREATE CONSTRAINT TRIGGER trg_ticket_categories_public_summary_sync
    AFTER INSERT OR DELETE OR UPDATE OF event_id, price, total_quantity, sold_quantity, held_quantity, is_active, is_visible, sale_online
    ON public.ticket_categories
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION public.ticket_categories_public_summary_sync();


-- ----------------------------------------------------------------------------
-- 6. Recopies (contrat 2.2)
-- ----------------------------------------------------------------------------

-- ============================================================================
-- ticket_sale_problems (recopie de 20261102000003_lot5_cycle.sql:894-960)
-- Changement : is_visible → sale_online ; code CATEGORY_NOT_VISIBLE → CATEGORY_NOT_SOLD_ONLINE, nouveau message.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ticket_sale_problems(p_event_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event record;
    v_item record;
    v_cat record;
    v_problems jsonb := '[]'::jsonb;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_array(jsonb_build_object('category_id', NULL, 'code', 'INVALID_ITEMS', 'message', 'Panier vide.'));
    END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(p_items)) <> (SELECT count(DISTINCT e->>'category_id') FROM jsonb_array_elements(p_items) e) THEN
        RETURN jsonb_build_array(jsonb_build_object('category_id', NULL, 'code', 'INVALID_ITEMS', 'message', 'Une catégorie apparaît plusieurs fois dans le panier.'));
    END IF;

    SELECT id, status INTO v_event FROM public.events WHERE id = p_event_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_array(jsonb_build_object('category_id', NULL, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.'));
    END IF;
    IF v_event.status::text <> 'PUBLIE' THEN
        v_problems := v_problems || jsonb_build_object('category_id', NULL, 'code', 'EVENT_NOT_PUBLISHED', 'message', 'Cet événement n''est pas ouvert à la vente.');
    END IF;
    -- Lot 5 (D7) : même fin que le cron et la fenêtre de scan (sans fin : début à 23:59, Africa/Dakar)
    IF public.event_end_at(p_event_id) <= now() THEN
        v_problems := v_problems || jsonb_build_object('category_id', NULL, 'code', 'EVENT_PAST', 'message', 'Cet événement est terminé.');
    END IF;

    FOR v_item IN
        SELECT (e->>'category_id')::uuid AS category_id, (e->>'quantity')::int AS quantity FROM jsonb_array_elements(p_items) e
    LOOP
        SELECT id, event_id, name, price, total_quantity, sold_quantity, held_quantity, is_active, sale_online, sale_start, sale_end, max_per_order
          INTO v_cat FROM public.ticket_categories WHERE id = v_item.category_id;
        IF NOT FOUND OR v_cat.event_id <> p_event_id THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_item.category_id, 'code', 'CATEGORY_NOT_FOUND', 'message', 'Catégorie introuvable pour cet événement.');
            CONTINUE;
        END IF;
        IF v_item.quantity IS NULL OR v_item.quantity < 1 THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'INVALID_QUANTITY', 'message', 'Quantité invalide.');
            CONTINUE;
        END IF;
        IF NOT v_cat.is_active THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'CATEGORY_INACTIVE', 'message', format('La catégorie « %s » n''est plus en vente.', v_cat.name));
        END IF;
        IF NOT v_cat.sale_online THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'CATEGORY_NOT_SOLD_ONLINE', 'message', format('La catégorie « %s » n''est pas vendue en ligne.', v_cat.name));
        END IF;
        IF v_cat.sale_start IS NOT NULL AND v_cat.sale_start > now() THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'SALE_NOT_STARTED', 'message', format('La vente de « %s » n''est pas encore ouverte.', v_cat.name));
        END IF;
        IF v_cat.sale_end IS NOT NULL AND v_cat.sale_end <= now() THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'SALE_CLOSED', 'message', format('La vente de « %s » est close.', v_cat.name));
        END IF;
        IF v_item.quantity > v_cat.max_per_order THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'MAX_PER_ORDER', 'message', format('Au plus %s billet(s) « %s » par commande.', v_cat.max_per_order, v_cat.name));
        END IF;
        IF v_cat.total_quantity - v_cat.sold_quantity - v_cat.held_quantity < v_item.quantity THEN
            v_problems := v_problems || jsonb_build_object('category_id', v_cat.id, 'code', 'INSUFFICIENT_STOCK', 'message', format('Plus assez de places « %s » disponibles.', v_cat.name));
        END IF;
    END LOOP;
    RETURN v_problems;
END;
$$;

-- ============================================================================
-- ticket_counter_channel_problems (nouvelle)
-- Lignes du panier appartenant à l'événement et non vendues au guichet. Une liste blanche sur
-- ticket_sale_problems ne peut pas servir : cette fonction ne connaît pas le canal d'appel. Une catégorie d'un
-- autre événement n'est pas citée ici : elle reste CATEGORY_NOT_FOUND. Lecture sous le verrou de counter_sale.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ticket_counter_channel_problems(p_event uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_problems jsonb;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RETURN '[]'::jsonb;
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('category_id', c.id, 'code', 'CATEGORY_NOT_SOLD_AT_COUNTER',
                                                 'message', format('La catégorie « %s » n''est pas vendue au guichet.', c.name))
                              ORDER BY c.id), '[]'::jsonb)
      INTO v_problems
      FROM public.ticket_categories c
     WHERE c.event_id = p_event AND NOT c.sale_counter
       AND c.id IN (SELECT public.try_uuid(e->>'category_id') FROM jsonb_array_elements(p_items) e);
    RETURN v_problems;
END;
$$;

-- ============================================================================
-- counter_sale (recopie de 20261103000005_lot6_billetterie.sql:667-824)
-- Changement : contrôle du canal après le FOR UPDATE des catégories, avant la liste blanche. Le rejeu reste
-- avant : une vente déjà faite est rendue même si sale_counter est passé à faux depuis. Verrous inchangés.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.counter_sale(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_seller uuid := public.try_uuid(p->>'seller_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_items jsonb := p->'items';
    v_key text := NULLIF(btrim(COALESCE(p->>'idempotency_key', '')), '');
    v_phone text := NULLIF(btrim(COALESCE(p->>'buyer_phone', '')), '');
    v_store_key text;
    v_problems jsonb;
    v_channel jsonb;
    v_event_problem text;
    sh record;
    prev record;
    v_partner uuid;
    v_amount numeric := 0;
    v_payment uuid;
    v_tx text;
    v_item record;
    v_ticket uuid;
    v_scan uuid;
    v_ids uuid[] := ARRAY[]::uuid[];
    v_scans uuid[] := ARRAY[]::uuid[];
    v_rstatus text;
    v_rreason text;
BEGIN
    IF v_seller IS NULL OR v_event IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Vente incomplète : vendeur et événement requis.');
    END IF;
    IF v_key IS NULL OR v_key !~ '^[A-Za-z0-9_-]{8,100}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_KEY_REQUIRED', 'message', 'Clé d''idempotence obligatoire.');
    END IF;
    IF v_phone IS NOT NULL AND v_phone !~ '^7[05678][0-9]{7}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PHONE', 'message', 'Numéro de l''acheteur invalide.');
    END IF;
    v_store_key := 'COUNTER:' || v_seller::text || ':' || v_key;

    IF NOT public.fin_setting_bool('access.counter_sale_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'COUNTER_SALE_DISABLED', 'message', 'La vente au guichet est désactivée.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_seller AND u.status = 'ACTIF')
       OR NOT EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_seller) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_ASSIGNED', 'message', 'Vente réservée au contrôleur affecté à l''événement.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_seller AND ec.can_accept_cash) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_CASH_PERMISSION', 'message', 'Permission espèces requise.');
    END IF;

    -- Rejeu d'une vente déjà enregistrée (réponse identique, même si la caisse a été clôturée depuis)
    SELECT id, transaction_id, amount, shift_id, event_id INTO prev FROM public.payments WHERE idempotency_key = v_store_key;
    IF NOT FOUND THEN
        SELECT * INTO sh FROM public.controller_shifts
         WHERE controller_id = v_seller AND event_id = v_event AND status = 'OUVERT' FOR UPDATE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NO_OPEN_SHIFT', 'message', 'Ouvrez une caisse avant de vendre.');
        END IF;
        -- Deux appels simultanés avec la même clé : sérialisés par le verrou de la caisse
        SELECT id, transaction_id, amount, shift_id, event_id INTO prev FROM public.payments WHERE idempotency_key = v_store_key;
    END IF;
    IF prev.id IS NOT NULL THEN
        SELECT o.status, o.reason INTO v_rstatus, v_rreason
          FROM public.notification_outbox o WHERE o.idempotency_key = 'COUNTER_RECEIPT:' || prev.id::text || ':SMS';
        RETURN jsonb_build_object('ok', true, 'replayed', true, 'payment_id', prev.id, 'transaction_id', prev.transaction_id,
            'amount', prev.amount, 'shift_id', prev.shift_id, 'event_id', prev.event_id,
            'ticket_ids', COALESCE((SELECT jsonb_agg(t.id ORDER BY t.created_at, t.id) FROM public.tickets t WHERE t.payment_id = prev.id), '[]'::jsonb),
            'scan_ids', COALESCE((SELECT jsonb_agg(s.id ORDER BY s.created_at, s.id) FROM public.ticket_scans s
                                    JOIN public.tickets t ON t.id = s.ticket_id
                                   WHERE t.payment_id = prev.id AND s.accepted), '[]'::jsonb),
            'receipt_queued', v_rstatus IS NOT NULL AND v_rstatus NOT IN ('SKIPPED', 'CANCELLED'),
            'receipt_refusal', CASE WHEN v_rstatus = 'SKIPPED' THEN v_rreason END);
    END IF;

    v_event_problem := public.scan_event_problem(v_event);
    IF v_event_problem IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_CLOSED', 'result', v_event_problem,
                                  'message', 'Cet événement n''est pas ouvert à la vente au guichet.');
    END IF;
    IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ITEMS', 'message', 'Panier vide ou invalide.');
    END IF;
    PERFORM 1 FROM public.ticket_categories
     WHERE id IN (SELECT public.try_uuid(e->>'category_id') FROM jsonb_array_elements(v_items) e) ORDER BY id FOR UPDATE;
    -- Lot 8 (8.0) : canal contrôlé sous le verrou des catégories ; panier mixte refusé en entier
    v_channel := public.ticket_counter_channel_problems(v_event, v_items);
    IF jsonb_array_length(v_channel) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CATEGORY_NOT_SOLD_AT_COUNTER', 'problems', v_channel,
                                  'message', 'Une catégorie de ce panier n''est pas vendue au guichet.');
    END IF;
    -- Contrôles de vente du lot 2, hors fenêtre de vente en ligne et canal en ligne (vente sur place)
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_problems
      FROM jsonb_array_elements(public.ticket_sale_problems(v_event, v_items)) x
     WHERE x->>'code' IN ('INVALID_ITEMS', 'EVENT_NOT_FOUND', 'CATEGORY_NOT_FOUND', 'INVALID_QUANTITY', 'CATEGORY_INACTIVE',
                          'MAX_PER_ORDER', 'INSUFFICIENT_STOCK');
    IF jsonb_array_length(v_problems) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SALE_CHECK_FAILED', 'problems', v_problems,
                                  'message', 'Vente impossible : vérifiez les catégories et les quantités.');
    END IF;
    SELECT COALESCE(sum(c.price * (e->>'quantity')::int), 0) INTO v_amount
      FROM jsonb_array_elements(v_items) e JOIN public.ticket_categories c ON c.id = (e->>'category_id')::uuid;
    SELECT partner_id INTO v_partner FROM public.events WHERE id = v_event;
    v_tx := 'TX-GUICHET-' || upper(replace(gen_random_uuid()::text, '-', ''));

    INSERT INTO public.payments (transaction_id, client_id, partner_id, event_id, payment_target, amount, currency, payment_method,
                                 is_platform_payment, offline_payment_method, aggregator, facial_amount, aggregator_fee, service_fee,
                                 gross_event_village_revenue, net_event_village_revenue, partner_payout_amount, status, paid_at,
                                 shift_id, payer_phone, idempotency_key, metadata)
    VALUES (v_tx, NULL, v_partner, v_event, 'TICKET', v_amount, 'XOF',
            'ESPECES', FALSE, 'ESPECES', NULL, v_amount, 0, 0, 0, 0, 0, 'SUCCESS', now(), sh.id,
            v_phone, v_store_key, jsonb_build_object('source', 'COUNTER_SALE', 'seller_id', v_seller))
    RETURNING id INTO v_payment;

    FOR v_item IN
        SELECT (e->>'category_id')::uuid AS category_id, (e->>'quantity')::int AS quantity, c.price
          FROM jsonb_array_elements(v_items) e JOIN public.ticket_categories c ON c.id = (e->>'category_id')::uuid
    LOOP
        UPDATE public.ticket_categories SET sold_quantity = sold_quantity + v_item.quantity WHERE id = v_item.category_id;
        FOR i IN 1 .. v_item.quantity LOOP
            INSERT INTO public.tickets (event_id, category_id, user_id, payment_id, ticket_number, price, qr_code, status,
                                        sale_channel, checked_in_at, checked_in_by)
            VALUES (v_event, v_item.category_id, NULL, v_payment,
                    'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
                    v_item.price, 'EV-QR-' || replace(gen_random_uuid()::text, '-', ''), 'UTILISE',
                    'COUNTER', now(), v_seller)
            RETURNING id INTO v_ticket;
            -- Entrée immédiate : scan accepté du vendeur (le trigger ticket_scans_enrich recopie catégorie,
            -- rôle CONTROLEUR et point d'entrée de l'affectation)
            INSERT INTO public.ticket_scans (ticket_id, event_id, scanner_id, result, accepted, method, identity_verified,
                                             payload_hash, shift_id, amount_due)
            VALUES (v_ticket, v_event, v_seller, 'valid', TRUE, 'COUNTER', FALSE, NULL, sh.id, v_item.price)
            RETURNING id INTO v_scan;
            v_ids := v_ids || v_ticket;
            v_scans := v_scans || v_scan;
        END LOOP;
    END LOOP;
    UPDATE public.payments SET ticket_id = v_ids[1] WHERE id = v_payment;
    UPDATE public.controller_shifts SET expected_cash_total = expected_cash_total + v_amount, updated_at = now() WHERE id = sh.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_seller, 'CAISSE', 'COUNTER_SALE', 'payments', v_payment,
            jsonb_build_object('event_id', v_event, 'shift_id', sh.id, 'amount', v_amount, 'ticket_ids', to_jsonb(v_ids),
                               'scan_ids', to_jsonb(v_scans), 'buyer_phone_given', v_phone IS NOT NULL));

    -- Lot 6 (J1.3) : reçu SMS au numéro saisi, dans la transaction de la vente (aucun compte rattaché)
    IF v_phone IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'COUNTER_RECEIPT', 'key', 'COUNTER_RECEIPT:' || v_payment::text,
            'phone', '+221' || v_phone, 'event_id', v_event, 'shift_id', sh.id,
            'data', COALESCE(public.notif_event_data(v_event), '{}'::jsonb) || jsonb_build_object(
                'payment_id', v_payment, 'ticket_count', cardinality(v_ids), 'amount', v_amount,
                'reference', upper(left(v_payment::text, 8)))));
        SELECT o.status, o.reason INTO v_rstatus, v_rreason
          FROM public.notification_outbox o WHERE o.idempotency_key = 'COUNTER_RECEIPT:' || v_payment::text || ':SMS';
    END IF;

    RETURN jsonb_build_object('ok', true, 'replayed', false, 'payment_id', v_payment, 'transaction_id', v_tx,
                              'ticket_ids', to_jsonb(v_ids), 'scan_ids', to_jsonb(v_scans), 'amount', v_amount,
                              'shift_id', sh.id, 'event_id', v_event,
                              'receipt_queued', v_rstatus IS NOT NULL AND v_rstatus NOT IN ('SKIPPED', 'CANCELLED'),
                              'receipt_refusal', CASE WHEN v_rstatus = 'SKIPPED' THEN v_rreason END);
END;
$$;

-- ============================================================================
-- counter_sale_quote (recopie de 20261105000005_lot7_scan.sql:537-596)
-- Changement : même contrôle du canal que counter_sale, avant la liste blanche. Reste STABLE, sans verrou.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.counter_sale_quote(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_seller uuid := public.try_uuid(p->>'seller_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_items jsonb := p->'items';
    v_event_problem text;
    v_problems jsonb;
    v_channel jsonb;
    v_lines jsonb;
    v_total numeric;
BEGIN
    IF v_seller IS NULL OR v_event IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Devis incomplet : vendeur et événement requis.');
    END IF;
    IF NOT public.fin_setting_bool('access.counter_sale_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'COUNTER_SALE_DISABLED', 'message', 'La vente au guichet est désactivée.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_seller AND u.status = 'ACTIF')
       OR NOT EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_seller) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_ASSIGNED', 'message', 'Vente réservée au contrôleur affecté à l''événement.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_seller AND ec.can_accept_cash) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_CASH_PERMISSION', 'message', 'Permission espèces requise.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.controller_shifts sh
                    WHERE sh.controller_id = v_seller AND sh.event_id = v_event AND sh.status = 'OUVERT') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_OPEN_SHIFT', 'message', 'Ouvrez une caisse avant de vendre.');
    END IF;
    v_event_problem := public.scan_event_problem(v_event);
    IF v_event_problem IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_CLOSED', 'result', v_event_problem,
                                  'message', 'Cet événement n''est pas ouvert à la vente au guichet.');
    END IF;
    IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ITEMS', 'message', 'Panier vide ou invalide.');
    END IF;
    -- Lot 8 (8.0) : même refus que counter_sale, aucun total
    v_channel := public.ticket_counter_channel_problems(v_event, v_items);
    IF jsonb_array_length(v_channel) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CATEGORY_NOT_SOLD_AT_COUNTER', 'problems', v_channel,
                                  'message', 'Une catégorie de ce panier n''est pas vendue au guichet.');
    END IF;
    -- Contrôles de vente de counter_sale (lot 2, hors fenêtre de vente en ligne et canal en ligne)
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_problems
      FROM jsonb_array_elements(public.ticket_sale_problems(v_event, v_items)) x
     WHERE x->>'code' IN ('INVALID_ITEMS', 'EVENT_NOT_FOUND', 'CATEGORY_NOT_FOUND', 'INVALID_QUANTITY', 'CATEGORY_INACTIVE',
                          'MAX_PER_ORDER', 'INSUFFICIENT_STOCK');
    IF jsonb_array_length(v_problems) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ITEMS', 'problems', v_problems,
                                  'message', 'Vente impossible : vérifiez les catégories et les quantités.');
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('category_id', c.id, 'name', c.name, 'unit_price', c.price,
                                                 'quantity', (e.x->>'quantity')::integer,
                                                 'amount', c.price * (e.x->>'quantity')::integer) ORDER BY e.ord), '[]'::jsonb),
           COALESCE(sum(c.price * (e.x->>'quantity')::integer), 0)
      INTO v_lines, v_total
      FROM jsonb_array_elements(v_items) WITH ORDINALITY AS e(x, ord)
      JOIN public.ticket_categories c ON c.id = public.try_uuid(e.x->>'category_id');
    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'total', v_total, 'lines', v_lines);
END;
$$;

-- ============================================================================
-- ticket_category_normalize (recopie de 20261102000004_lot5_edition.sql:213-279)
-- Changement : clés sale_online et sale_counter acceptées ; is_visible gardé comme alias en entrée, résolu ici
-- (sale_online, sinon is_visible, sinon vrai) ; la sortie porte sale_online et sale_counter, plus is_visible.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ticket_category_normalize(p_cat jsonb, p_event_end timestamptz, p_prefix text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prefix text := COALESCE(p_prefix, '');
    v_key text;
    v_name text;
    v_desc text;
    v_price numeric;
    v_total integer;
    v_max integer;
    v_start timestamptz;
    v_end timestamptz;
    v_online boolean;
    v_counter boolean;
    v_active boolean;
BEGIN
    IF p_cat IS NULL OR jsonb_typeof(p_cat) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Catégorie de billets illisible.', NULLIF(rtrim(v_prefix, '.'), ''));
    END IF;
    SELECT k INTO v_key FROM jsonb_object_keys(p_cat) AS k
     WHERE k <> ALL (ARRAY['name', 'description', 'price', 'total_quantity', 'max_per_order', 'sale_start', 'sale_end', 'sale_online', 'sale_counter', 'is_visible', 'is_active'])
     ORDER BY k LIMIT 1;
    IF v_key IS NOT NULL THEN
        RETURN public.event_edit_refusal('FIELD_NOT_EDITABLE', 'Ce champ de la catégorie de billets n''est pas accepté.', v_prefix || v_key);
    END IF;
    BEGIN
        v_name := btrim(p_cat->>'name');
        v_desc := NULLIF(btrim(COALESCE(p_cat->>'description', '')), '');
        v_price := (p_cat->>'price')::numeric;
        v_total := (p_cat->>'total_quantity')::integer;
        v_max := COALESCE((p_cat->>'max_per_order')::integer, 10);
        v_start := NULLIF(p_cat->>'sale_start', '')::timestamptz;
        v_end := NULLIF(p_cat->>'sale_end', '')::timestamptz;
        v_online := COALESCE((p_cat->>'sale_online')::boolean, (p_cat->>'is_visible')::boolean, true);
        v_counter := COALESCE((p_cat->>'sale_counter')::boolean, true);
        v_active := COALESCE((p_cat->>'is_active')::boolean, true);
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Une valeur de la catégorie de billets est illisible.', NULLIF(rtrim(v_prefix, '.'), ''));
    END;
    IF v_name IS NULL OR char_length(v_name) < 1 OR char_length(v_name) > 60 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le nom de la catégorie compte de 1 à 60 caractères.', v_prefix || 'name');
    END IF;
    IF v_desc IS NOT NULL AND char_length(v_desc) > 300 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La description de la catégorie ne dépasse pas 300 caractères.', v_prefix || 'description');
    END IF;
    IF v_price IS NULL OR v_price < 0 OR v_price > 10000000 OR v_price <> trunc(v_price) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le prix est un montant entier de 0 à 10 000 000 F CFA.', v_prefix || 'price');
    END IF;
    IF v_total IS NULL OR v_total < 1 OR v_total > 100000 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le quota est un nombre entier de 1 à 100 000 billets.', v_prefix || 'total_quantity');
    END IF;
    IF v_max < 1 OR v_max > 50 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le maximum par commande est un nombre entier de 1 à 50.', v_prefix || 'max_per_order');
    END IF;
    IF v_start IS NOT NULL AND v_end IS NOT NULL AND v_start >= v_end THEN
        RETURN public.event_edit_refusal('SALE_DATES_INVALID', 'La fin de vente doit être postérieure au début de vente.', v_prefix || 'sale_end');
    END IF;
    IF v_end IS NOT NULL AND p_event_end IS NOT NULL AND v_end > p_event_end THEN
        RETURN public.event_edit_refusal('SALE_END_AFTER_EVENT', 'La fin de vente ne peut pas dépasser la fin de l''événement.', v_prefix || 'sale_end');
    END IF;
    RETURN jsonb_build_object('ok', true, 'name', v_name, 'description', v_desc, 'price', v_price, 'total_quantity', v_total,
                              'max_per_order', v_max, 'sale_start', v_start, 'sale_end', v_end,
                              'sale_online', v_online, 'sale_counter', v_counter, 'is_active', v_active);
END;
$$;

-- ============================================================================
-- event_create (recopie de 20261102000004_lot5_edition.sql:287-476)
-- Changement : INSERT de sale_online et sale_counter à la place de is_visible (miroir écrit par le trigger).
-- p : { actor_id, event: { title, category, description?, start_date, start_time, end_date?, end_time?,
--       location, city, latitude?, longitude?, image_url?, capacity?, program?, practical_info? },
--       ticket_categories?: [ { name, description?, price, total_quantity, max_per_order?, sale_start?,
--       sale_end?, sale_online?, sale_counter?, is_visible?, is_active? } ] }
-- Contrôles de forme faits en amont par lib/validations/event.ts ; ceux-ci les répètent en défense.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.event_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_ev jsonb := p->'event';
    v_cats jsonb := COALESCE(p->'ticket_categories', '[]'::jsonb);
    v_partner record;
    v_key text;
    v_title text;
    v_category event_category;
    v_description text;
    v_start_date date;
    v_start_time time;
    v_end_date date;
    v_end_time time;
    v_location text;
    v_city text;
    v_lat double precision;
    v_lng double precision;
    v_image text;
    v_capacity integer;
    v_program jsonb;
    v_practical jsonb;
    v_start timestamptz;
    v_end timestamptz;
    v_cat jsonb;
    v_norm jsonb;
    v_idx integer;
    v_names text[] := ARRAY[]::text[];
    v_normalized jsonb := '[]'::jsonb;
    v_active_sum integer := 0;
    v_slug text;
    v_event_id uuid;
    v_row jsonb;
BEGIN
    IF v_actor IS NULL THEN
        RETURN public.event_edit_refusal('PARTNER_NOT_FOUND', 'Seul un organisateur disposant d''un profil partenaire peut créer un événement.');
    END IF;
    SELECT pa.id, pa.status::text AS status, u.status::text AS user_status INTO v_partner
      FROM public.partners pa JOIN public.users u ON u.id = pa.user_id
     WHERE pa.user_id = v_actor;
    IF NOT FOUND THEN
        RETURN public.event_edit_refusal('PARTNER_NOT_FOUND', 'Seul un organisateur disposant d''un profil partenaire peut créer un événement.');
    END IF;
    IF v_partner.user_status <> 'ACTIF' THEN
        RETURN public.event_edit_refusal('ACCOUNT_NOT_ACTIVE', 'Votre compte n''est pas actif.');
    END IF;
    IF v_partner.status <> 'VALIDE' THEN
        RETURN public.event_edit_refusal('PARTNER_NOT_VALIDATED', 'Votre profil d''organisateur doit être validé avant de créer un événement.');
    END IF;

    IF v_ev IS NULL OR jsonb_typeof(v_ev) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les informations de l''événement sont illisibles.');
    END IF;
    IF jsonb_typeof(v_cats) <> 'array' OR jsonb_array_length(v_cats) > 50 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les catégories de billets sont illisibles (50 au plus).', 'ticket_categories');
    END IF;
    SELECT k INTO v_key FROM jsonb_object_keys(v_ev) AS k
     WHERE k <> ALL (ARRAY['title', 'category', 'description', 'start_date', 'start_time', 'end_date', 'end_time', 'location', 'city',
                           'latitude', 'longitude', 'image_url', 'capacity', 'program', 'practical_info'])
     ORDER BY k LIMIT 1;
    IF v_key IS NOT NULL THEN
        RETURN public.event_edit_refusal('FIELD_NOT_EDITABLE', 'Ce champ ne peut pas être fourni à la création d''un événement.', v_key);
    END IF;

    BEGIN
        v_title := btrim(v_ev->>'title');
        v_key := 'category';
        v_category := (v_ev->>'category')::event_category;
        v_key := NULL;
        v_description := NULLIF(btrim(COALESCE(v_ev->>'description', '')), '');
        v_start_date := (v_ev->>'start_date')::date;
        v_start_time := (v_ev->>'start_time')::time;
        v_end_date := NULLIF(v_ev->>'end_date', '')::date;
        v_end_time := NULLIF(v_ev->>'end_time', '')::time;
        v_location := btrim(v_ev->>'location');
        v_city := btrim(v_ev->>'city');
        v_lat := (v_ev->>'latitude')::double precision;
        v_lng := (v_ev->>'longitude')::double precision;
        v_image := NULLIF(btrim(COALESCE(v_ev->>'image_url', '')), '');
        v_capacity := (v_ev->>'capacity')::integer;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
        IF v_key = 'category' THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une catégorie d''événement dans la liste.', 'category');
        END IF;
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Une valeur de l''événement est illisible.');
    END;
    v_program := COALESCE(v_ev->'program', '[]'::jsonb);
    v_practical := COALESCE(v_ev->'practical_info', '{}'::jsonb);

    IF v_title IS NULL OR char_length(v_title) < 3 OR char_length(v_title) > 120 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le titre compte de 3 à 120 caractères.', 'title');
    END IF;
    IF v_category IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une catégorie d''événement dans la liste.', 'category');
    END IF;
    IF v_description IS NOT NULL AND char_length(v_description) > 5000 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La description ne dépasse pas 5 000 caractères.', 'description');
    END IF;
    IF v_location IS NULL OR char_length(v_location) < 2 OR char_length(v_location) > 200 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le lieu compte de 2 à 200 caractères.', 'location');
    END IF;
    IF v_city IS NULL OR char_length(v_city) < 2 OR char_length(v_city) > 80 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La ville compte de 2 à 80 caractères.', 'city');
    END IF;
    IF v_lat IS NOT NULL AND (v_lat < -90 OR v_lat > 90) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La latitude est comprise entre -90 et 90.', 'latitude');
    END IF;
    IF v_lng IS NOT NULL AND (v_lng < -180 OR v_lng > 180) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La longitude est comprise entre -180 et 180.', 'longitude');
    END IF;
    IF v_capacity IS NOT NULL AND (v_capacity < 1 OR v_capacity > 100000) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La jauge est un nombre entier de 1 à 100 000.', 'capacity');
    END IF;
    IF NOT public.event_poster_path_ok(v_image, v_partner.id) THEN
        RETURN public.event_edit_refusal('IMAGE_ORIGIN_INVALID', 'L''affiche doit être déposée depuis le formulaire de l''événement.', 'image_url');
    END IF;
    IF jsonb_typeof(v_program) <> 'array' OR jsonb_array_length(v_program) > 50 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le programme compte 50 lignes au plus.', 'program');
    END IF;
    IF jsonb_typeof(v_practical) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les informations pratiques sont illisibles.', 'practical_info');
    END IF;

    IF v_end_time IS NOT NULL AND v_end_date IS NULL THEN
        RETURN public.event_edit_refusal('END_DATE_REQUIRED', 'Indiquez la date de fin pour l''heure de fin saisie.', 'end_date');
    END IF;
    v_start := (v_start_date + v_start_time) AT TIME ZONE 'Africa/Dakar';
    IF v_start <= now() THEN
        RETURN public.event_edit_refusal('EVENT_START_PAST', 'Le début de l''événement doit être dans le futur (heure de Dakar).', 'start_date');
    END IF;
    v_end := public.event_end_from(v_start_date, v_end_date, v_end_time);
    IF v_end_date IS NOT NULL AND v_end <= v_start THEN
        RETURN public.event_edit_refusal('EVENT_END_BEFORE_START', 'La fin de l''événement doit être postérieure à son début.',
                                         CASE WHEN v_end_time IS NOT NULL THEN 'end_time' ELSE 'end_date' END);
    END IF;

    -- Catégories : toutes contrôlées avant la moindre écriture (tout ou rien)
    FOR v_cat, v_idx IN SELECT x.e, (x.o - 1)::int FROM jsonb_array_elements(v_cats) WITH ORDINALITY AS x(e, o) LOOP
        v_norm := public.ticket_category_normalize(v_cat, v_end, format('ticket_categories.%s.', v_idx));
        IF (v_norm->>'ok')::boolean IS NOT TRUE THEN
            RETURN v_norm;
        END IF;
        IF lower(v_norm->>'name') = ANY (v_names) THEN
            RETURN public.event_edit_refusal('CATEGORY_NAME_TAKEN',
                format('Deux catégories portent le nom « %s » : chaque nom doit être unique.', v_norm->>'name'),
                format('ticket_categories.%s.name', v_idx));
        END IF;
        v_names := array_append(v_names, lower(v_norm->>'name'));
        IF (v_norm->>'is_active')::boolean THEN
            v_active_sum := v_active_sum + (v_norm->>'total_quantity')::integer;
        END IF;
        v_normalized := v_normalized || jsonb_build_array(v_norm);
    END LOOP;
    IF v_capacity IS NOT NULL AND v_active_sum > v_capacity THEN
        RETURN public.event_edit_refusal('QUOTA_ABOVE_CAPACITY',
            format('La somme des quotas des catégories actives (%s) dépasse la jauge (%s).', v_active_sum, v_capacity), 'capacity');
    END IF;

    v_slug := btrim(regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'), '-');
    IF v_slug = '' THEN v_slug := 'evenement'; END IF;
    v_slug := left(v_slug, 60) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

    -- Statut forcé à BROUILLON par trg_events_force_draft, historique NULL → BROUILLON par trg_events_log_creation
    INSERT INTO public.events (partner_id, title, slug, category, description, start_date, start_time, end_date, end_time,
                               location, city, latitude, longitude, image_url, gallery_urls, capacity, program, practical_info, services)
    VALUES (v_partner.id, v_title, v_slug, v_category, v_description, v_start_date, v_start_time, v_end_date, v_end_time,
            v_location, v_city, v_lat, v_lng, v_image, '{}', v_capacity, v_program, v_practical,
            '{"ticketing": true, "tableBooking": false, "communication": false}'::jsonb)
    RETURNING id INTO v_event_id;

    INSERT INTO public.ticket_categories (event_id, name, description, price, total_quantity, sold_quantity, max_per_order,
                                          sale_start, sale_end, sale_online, sale_counter, is_active)
    SELECT v_event_id, c->>'name', c->>'description', (c->>'price')::numeric, (c->>'total_quantity')::integer, 0,
           (c->>'max_per_order')::integer, (c->>'sale_start')::timestamptz, (c->>'sale_end')::timestamptz,
           (c->>'sale_online')::boolean, (c->>'sale_counter')::boolean, (c->>'is_active')::boolean
      FROM jsonb_array_elements(v_normalized) AS c;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'EVENT_CREATED', 'EVENT', v_event_id,
            jsonb_build_object('categories', jsonb_array_length(v_normalized)));

    SELECT to_jsonb(ev) INTO v_row FROM public.events ev WHERE ev.id = v_event_id;
    RETURN jsonb_build_object('ok', true, 'event_id', v_event_id, 'event', v_row);
END;
$$;

-- ============================================================================
-- ticket_category_create (recopie de 20261102000004_lot5_edition.sql:849-903)
-- Changement : INSERT de sale_online et sale_counter à la place de is_visible (miroir écrit par le trigger).
-- p : { event_id, actor_id, category: { name, description?, price, total_quantity, max_per_order?, sale_start?,
--       sale_end?, sale_online?, sale_counter?, is_visible?, is_active? } } → { ok, category }
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ticket_category_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_guard jsonb;
    v_capacity integer;
    v_norm jsonb;
    v_sum integer;
    v_id uuid;
    v_row jsonb;
BEGIN
    v_guard := public.ticket_category_guard(v_event, v_actor);
    IF (v_guard->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_guard;
    END IF;
    SELECT capacity INTO v_capacity FROM public.events WHERE id = v_event;
    v_norm := public.ticket_category_normalize(p->'category', public.event_end_at(v_event), '');
    IF (v_norm->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_norm;
    END IF;
    IF EXISTS (SELECT 1 FROM public.ticket_categories c
                WHERE c.event_id = v_event AND lower(btrim(c.name)) = lower(v_norm->>'name')) THEN
        RETURN public.event_edit_refusal('CATEGORY_NAME_TAKEN',
            format('Une catégorie « %s » existe déjà pour cet événement : choisissez un autre nom.', v_norm->>'name'), 'name');
    END IF;
    IF v_capacity IS NOT NULL AND (v_norm->>'is_active')::boolean THEN
        SELECT COALESCE(sum(c.total_quantity), 0)::int INTO v_sum
          FROM public.ticket_categories c WHERE c.event_id = v_event AND c.is_active;
        IF v_sum + (v_norm->>'total_quantity')::int > v_capacity THEN
            RETURN public.event_edit_refusal('QUOTA_ABOVE_CAPACITY',
                format('La somme des quotas des catégories actives (%s) dépasserait la jauge de l''événement (%s).',
                       v_sum + (v_norm->>'total_quantity')::int, v_capacity), 'total_quantity');
        END IF;
    END IF;

    INSERT INTO public.ticket_categories (event_id, name, description, price, total_quantity, sold_quantity, max_per_order,
                                          sale_start, sale_end, sale_online, sale_counter, is_active)
    VALUES (v_event, v_norm->>'name', v_norm->>'description', (v_norm->>'price')::numeric, (v_norm->>'total_quantity')::int, 0,
            (v_norm->>'max_per_order')::int, (v_norm->>'sale_start')::timestamptz, (v_norm->>'sale_end')::timestamptz,
            (v_norm->>'sale_online')::boolean, (v_norm->>'sale_counter')::boolean, (v_norm->>'is_active')::boolean)
    RETURNING id INTO v_id;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'CATEGORY_CREATED', 'TICKET_CATEGORY', v_id,
            jsonb_build_object('event_id', v_event, 'name', v_norm->>'name', 'price', v_norm->'price', 'total_quantity', v_norm->'total_quantity'));

    SELECT to_jsonb(c) INTO v_row FROM public.ticket_categories c WHERE c.id = v_id;
    RETURN jsonb_build_object('ok', true, 'category', v_row);
END;
$$;

-- ============================================================================
-- ticket_category_update (recopie de 20261102000004_lot5_edition.sql:907-1043)
-- Changement : clés sale_online et sale_counter acceptées ; is_visible gardé comme alias, sale_online gagne si
-- les deux sont fournis ; UPDATE de sale_online et sale_counter (miroir écrit par le trigger) ; audit old/new
-- avec les deux canaux.
-- p : { event_id, category_id, actor_id, patch: { name?, description?, price?, total_quantity?, max_per_order?,
--       sale_start?, sale_end?, sale_online?, sale_counter?, is_visible?, is_active? } } → { ok, category }
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ticket_category_update(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_category uuid := public.try_uuid(p->>'category_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_patch jsonb := p->'patch';
    v_guard jsonb;
    v_capacity integer;
    c public.ticket_categories%ROWTYPE;
    v_key text;
    n_name text;
    n_desc text;
    n_price numeric;
    n_total integer;
    n_max integer;
    n_start timestamptz;
    n_end timestamptz;
    n_online boolean;
    n_counter boolean;
    n_active boolean;
    v_sum integer;
    v_row jsonb;
BEGIN
    IF v_patch IS NULL OR jsonb_typeof(v_patch) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les modifications de la catégorie sont illisibles.');
    END IF;
    v_guard := public.ticket_category_guard(v_event, v_actor);
    IF (v_guard->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_guard;
    END IF;
    SELECT * INTO c FROM public.ticket_categories WHERE id = v_category AND event_id = v_event;
    IF NOT FOUND THEN
        RETURN public.event_edit_refusal('CATEGORY_NOT_FOUND', 'Catégorie de billets introuvable pour cet événement.');
    END IF;
    SELECT k INTO v_key FROM jsonb_object_keys(v_patch) AS k
     WHERE k <> ALL (ARRAY['name', 'description', 'price', 'total_quantity', 'max_per_order', 'sale_start', 'sale_end', 'sale_online', 'sale_counter', 'is_visible', 'is_active'])
     ORDER BY k LIMIT 1;
    IF v_key IS NOT NULL THEN
        RETURN public.event_edit_refusal('FIELD_NOT_EDITABLE', 'Ce champ de la catégorie de billets ne se modifie pas.', v_key);
    END IF;

    n_name := c.name; n_desc := c.description; n_price := c.price; n_total := c.total_quantity; n_max := c.max_per_order;
    n_start := c.sale_start; n_end := c.sale_end; n_online := c.sale_online; n_counter := c.sale_counter; n_active := c.is_active;
    BEGIN
        IF v_patch ? 'name' THEN n_name := btrim(v_patch->>'name'); END IF;
        IF v_patch ? 'description' THEN n_desc := NULLIF(btrim(COALESCE(v_patch->>'description', '')), ''); END IF;
        IF v_patch ? 'price' THEN n_price := (v_patch->>'price')::numeric; END IF;
        IF v_patch ? 'total_quantity' THEN n_total := (v_patch->>'total_quantity')::integer; END IF;
        IF v_patch ? 'max_per_order' THEN n_max := (v_patch->>'max_per_order')::integer; END IF;
        IF v_patch ? 'sale_start' THEN n_start := NULLIF(v_patch->>'sale_start', '')::timestamptz; END IF;
        IF v_patch ? 'sale_end' THEN n_end := NULLIF(v_patch->>'sale_end', '')::timestamptz; END IF;
        IF v_patch ? 'is_visible' THEN n_online := (v_patch->>'is_visible')::boolean; END IF;
        IF v_patch ? 'sale_online' THEN n_online := (v_patch->>'sale_online')::boolean; END IF;
        IF v_patch ? 'sale_counter' THEN n_counter := (v_patch->>'sale_counter')::boolean; END IF;
        IF v_patch ? 'is_active' THEN n_active := (v_patch->>'is_active')::boolean; END IF;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Une valeur modifiée de la catégorie est illisible.');
    END;
    IF n_name IS NULL OR char_length(n_name) < 1 OR char_length(n_name) > 60 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le nom de la catégorie compte de 1 à 60 caractères.', 'name');
    END IF;
    IF n_desc IS NOT NULL AND char_length(n_desc) > 300 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La description de la catégorie ne dépasse pas 300 caractères.', 'description');
    END IF;
    IF n_price IS NULL OR n_price < 0 OR n_price > 10000000 OR n_price <> trunc(n_price) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le prix est un montant entier de 0 à 10 000 000 F CFA.', 'price');
    END IF;
    IF n_total IS NULL OR n_total < 1 OR n_total > 100000 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le quota est un nombre entier de 1 à 100 000 billets.', 'total_quantity');
    END IF;
    IF n_max IS NULL OR n_max < 1 OR n_max > 50 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le maximum par commande est un nombre entier de 1 à 50.', 'max_per_order');
    END IF;
    IF n_online IS NULL OR n_counter IS NULL OR n_active IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Indiquez oui ou non pour les canaux de vente et la mise en vente.',
                                         CASE WHEN n_online IS NULL THEN CASE WHEN v_patch ? 'sale_online' THEN 'sale_online' ELSE 'is_visible' END
                                              WHEN n_counter IS NULL THEN 'sale_counter' ELSE 'is_active' END);
    END IF;

    -- Prix : modifiable seulement sans billet ni réservation en cours
    IF n_price <> c.price AND public.ticket_category_has_sales(c.id) THEN
        RETURN public.event_edit_refusal('PRICE_LOCKED_AFTER_SALES',
            'Le prix de cette catégorie est verrouillé : des billets ont été vendus ou réservés. Créez une nouvelle catégorie pour un autre tarif.', 'price');
    END IF;
    -- Quota : jamais sous les vendus, ni sous vendus + réservés (paiements en cours)
    IF n_total < c.sold_quantity THEN
        RETURN public.event_edit_refusal('QUOTA_BELOW_SOLD',
            format('Le quota ne peut pas descendre sous les %s billet(s) déjà vendus.', c.sold_quantity), 'total_quantity');
    END IF;
    IF n_total < c.sold_quantity + c.held_quantity THEN
        RETURN public.event_edit_refusal('QUOTA_BELOW_HELD',
            format('Le quota ne peut pas descendre sous %s : %s billet(s) vendus et %s en cours de paiement.',
                   c.sold_quantity + c.held_quantity, c.sold_quantity, c.held_quantity), 'total_quantity');
    END IF;
    -- Somme des quotas des catégories actives ≤ jauge (contrôlée quand le quota monte ou que la catégorie est activée)
    SELECT capacity INTO v_capacity FROM public.events WHERE id = v_event;
    IF v_capacity IS NOT NULL AND n_active AND (n_total > c.total_quantity OR NOT c.is_active) THEN
        SELECT COALESCE(sum(o.total_quantity), 0)::int INTO v_sum
          FROM public.ticket_categories o WHERE o.event_id = v_event AND o.is_active AND o.id <> c.id;
        IF v_sum + n_total > v_capacity THEN
            RETURN public.event_edit_refusal('QUOTA_ABOVE_CAPACITY',
                format('La somme des quotas des catégories actives (%s) dépasserait la jauge de l''événement (%s).', v_sum + n_total, v_capacity),
                'total_quantity');
        END IF;
    END IF;
    -- Nom unique dans l'événement, sans tenir compte de la casse
    IF lower(n_name) IS DISTINCT FROM lower(btrim(c.name)) AND EXISTS (
        SELECT 1 FROM public.ticket_categories o
         WHERE o.event_id = v_event AND o.id <> c.id AND lower(btrim(o.name)) = lower(n_name)) THEN
        RETURN public.event_edit_refusal('CATEGORY_NAME_TAKEN',
            format('Une catégorie « %s » existe déjà pour cet événement : choisissez un autre nom.', n_name), 'name');
    END IF;
    -- Dates de vente : début < fin ≤ fin de l'événement
    IF (v_patch ? 'sale_start' OR v_patch ? 'sale_end') AND n_start IS NOT NULL AND n_end IS NOT NULL AND n_start >= n_end THEN
        RETURN public.event_edit_refusal('SALE_DATES_INVALID', 'La fin de vente doit être postérieure au début de vente.', 'sale_end');
    END IF;
    IF v_patch ? 'sale_end' AND n_end IS NOT NULL AND n_end > public.event_end_at(v_event) THEN
        RETURN public.event_edit_refusal('SALE_END_AFTER_EVENT', 'La fin de vente ne peut pas dépasser la fin de l''événement.', 'sale_end');
    END IF;

    UPDATE public.ticket_categories
       SET name = n_name, description = n_desc, price = n_price, total_quantity = n_total, max_per_order = n_max,
           sale_start = n_start, sale_end = n_end, sale_online = n_online, sale_counter = n_counter, is_active = n_active, updated_at = now()
     WHERE id = c.id;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'CATEGORY_UPDATED', 'TICKET_CATEGORY', c.id,
            jsonb_build_object('event_id', v_event,
                               'fields', (SELECT COALESCE(jsonb_agg(k ORDER BY k), '[]'::jsonb) FROM jsonb_object_keys(v_patch) AS k),
                               'old', jsonb_build_object('price', c.price, 'total_quantity', c.total_quantity, 'is_active', c.is_active, 'is_visible', c.is_visible, 'sale_online', c.sale_online, 'sale_counter', c.sale_counter),
                               'new', jsonb_build_object('price', n_price, 'total_quantity', n_total, 'is_active', n_active, 'is_visible', n_online, 'sale_online', n_online, 'sale_counter', n_counter)));

    SELECT to_jsonb(x) INTO v_row FROM public.ticket_categories x WHERE x.id = c.id;
    RETURN jsonb_build_object('ok', true, 'category', v_row);
END;
$$;

-- ============================================================================
-- public_category_stock_sync (recopie de 20261102000006_lot5_temps_reel.sql:181-244)
-- Changement : lit sale_online à la place de is_visible.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.public_category_stock_sync(p_category_id uuid, p_threshold integer DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid;
    v_total integer;
    v_sold integer;
    v_held integer;
    v_active boolean;
    v_online boolean;
    v_status text;
    v_threshold integer;
    v_remaining integer;
    v_availability text;
    v_hint integer;
BEGIN
    IF p_category_id IS NULL THEN RETURN; END IF;
    SELECT tc.event_id, tc.total_quantity, tc.sold_quantity, tc.held_quantity, tc.is_active, tc.sale_online, e.status::text
      INTO v_event, v_total, v_sold, v_held, v_active, v_online, v_status
      FROM public.ticket_categories tc
      JOIN public.events e ON e.id = tc.event_id
     WHERE tc.id = p_category_id;
    IF NOT FOUND THEN
        DELETE FROM public.public_category_stock WHERE category_id = p_category_id;
        RETURN;
    END IF;
    IF NOT (COALESCE(v_active, FALSE) AND COALESCE(v_online, FALSE)
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

-- ============================================================================
-- public_event_state_sync (recopie de 20261102000006_lot5_temps_reel.sql:248-310)
-- Changement : filtre sur sale_online à la place de is_visible.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.public_event_state_sync(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
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
     WHERE tc.event_id = p_event_id AND tc.is_active AND tc.sale_online;
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

-- ============================================================================
-- pilotage_sales (recopie de 20261102000005_lot5_pilotage.sql:419-509)
-- Changement : jointure sur ticket_categories pour servir sale_online et sale_counter ; is_visible reste dans la
-- réponse. pilotage_category_stats n'est pas recopiée : son RETURNS TABLE imposerait un DROP FUNCTION.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pilotage_sales(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_code text;
    v_by_category jsonb;
    v_first date;
    v_last date;
    v_sale_start date;
    v_today date := (now() AT TIME ZONE 'Africa/Dakar')::date;
    v_end_day date;
    v_from date;
    v_to date;
    v_by_day jsonb;
BEGIN
    v_code := public.pilotage_access(v_event, v_actor);
    IF v_code IS NOT NULL THEN
        RETURN public.pilotage_refusal(v_code);
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'category_id', x.category_id,
               'name', x.name,
               'price', x.price,
               'is_active', x.is_active,
               'is_visible', x.is_visible,
               'sale_online', tc.sale_online,
               'sale_counter', tc.sale_counter,
               'total', x.total,
               'sold', x.sold,
               'sold_online', x.sold_online,
               'sold_cash', x.sold_cash,
               'sold_unpaid', x.sold_unpaid,
               'invitations', x.invitations,
               'in_payment', x.in_payment,
               -- Une catégorie inactive ne se vend plus : aucun restant
               'remaining', CASE WHEN x.is_active THEN x.total - x.sold - x.invitations - x.in_payment ELSE 0 END,
               'revenue_online', x.revenue_online,
               -- Contrôle : le compteur de stock en base suit-il les billets ?
               'sold_quantity_mismatch', x.sold_quantity IS DISTINCT FROM (x.sold + x.invitations)::integer)
             ORDER BY x.created_at, x.name, x.category_id), '[]'::jsonb)
      INTO v_by_category
      FROM public.pilotage_category_stats(v_event) x
      JOIN public.ticket_categories tc ON tc.id = x.category_id;

    SELECT min((tk.created_at AT TIME ZONE 'Africa/Dakar')::date), max((tk.created_at AT TIME ZONE 'Africa/Dakar')::date)
      INTO v_first, v_last
      FROM public.tickets tk
     WHERE tk.event_id = v_event AND tk.status::text IN ('VALIDE', 'UTILISE') AND tk.sale_channel IS DISTINCT FROM 'INVITATION';
    SELECT min((c.sale_start AT TIME ZONE 'Africa/Dakar')::date) INTO v_sale_start
      FROM public.ticket_categories c WHERE c.event_id = v_event AND c.is_active;
    v_end_day := (public.event_end_at(v_event) AT TIME ZONE 'Africa/Dakar')::date;

    v_by_day := '[]'::jsonb;
    IF v_first IS NOT NULL THEN
        -- Période : du début des ventes (ou de la première vente) à aujourd'hui, borné à la fin de l'événement
        v_from := LEAST(v_first, COALESCE(v_sale_start, v_first));
        v_to := GREATEST(v_last, LEAST(v_today, COALESCE(v_end_day, v_today)));
        IF v_to - v_from > 1000 THEN
            v_from := LEAST(v_first, v_to - 1000);
        END IF;
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                   'day', to_char(g.d, 'YYYY-MM-DD'),
                   'sold', COALESCE(x.sold, 0),
                   'sold_online', COALESCE(x.online, 0),
                   'sold_cash', COALESCE(x.cash, 0),
                   'revenue_online', COALESCE(x.revenue_online, 0))
                 ORDER BY g.d), '[]'::jsonb)
          INTO v_by_day
          FROM (SELECT gs::date AS d FROM generate_series(v_from::timestamp, v_to::timestamp, interval '1 day') gs) g
          LEFT JOIN (
              SELECT (tk.created_at AT TIME ZONE 'Africa/Dakar')::date AS d,
                     count(*) AS sold,
                     count(*) FILTER (WHERE pay.is_platform_payment) AS online,
                     count(*) FILTER (WHERE pay.id IS NOT NULL AND NOT pay.is_platform_payment) AS cash,
                     COALESCE(sum(tk.price) FILTER (WHERE pay.is_platform_payment), 0) AS revenue_online
                FROM public.tickets tk
                LEFT JOIN public.payments pay ON pay.id = tk.payment_id
               WHERE tk.event_id = v_event AND tk.status::text IN ('VALIDE', 'UTILISE')
                 AND tk.sale_channel IS DISTINCT FROM 'INVITATION'
               GROUP BY 1
          ) x ON x.d = g.d;
    END IF;

    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'by_category', v_by_category, 'by_day', v_by_day,
                              'computed_at', now());
END;
$$;


-- ----------------------------------------------------------------------------
-- 7. ticket_categories_read_public (dernière définition : 20261105000003_lot7_securite.sql:60-66)
-- ----------------------------------------------------------------------------
-- sale_online à la place de is_visible. Si le miroir était un jour désactivé, la RLS et le contrôle de vente ne
-- pourraient pas diverger. Aucune clause TO : le catalogue public est lu par anon.
DROP POLICY IF EXISTS "ticket_categories_read_public" ON public.ticket_categories;
CREATE POLICY "ticket_categories_read_public" ON public.ticket_categories
    FOR SELECT USING (
        (ticket_categories.is_active AND ticket_categories.sale_online
            AND EXISTS (SELECT 1 FROM public.events_public_status s WHERE s.id = ticket_categories.event_id))
        OR public.ticket_category_private_read(ticket_categories.event_id)
    );


-- ----------------------------------------------------------------------------
-- 8. Privilèges : service_role uniquement
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.stock_reservations_sale_online_set()',
        'public.tickets_sale_decision_set()',
        'public.tickets_sale_decision_guard()',
        'public.ticket_categories_channels_sync()',
        'public.ticket_sale_problems(uuid, jsonb)',
        'public.ticket_counter_channel_problems(uuid, jsonb)',
        'public.counter_sale(jsonb)',
        'public.counter_sale_quote(jsonb)',
        'public.ticket_category_normalize(jsonb, timestamptz, text)',
        'public.event_create(jsonb)',
        'public.ticket_category_create(jsonb)',
        'public.ticket_category_update(jsonb)',
        'public.public_category_stock_sync(uuid, integer)',
        'public.public_event_state_sync(uuid)',
        'public.pilotage_sales(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;


-- ----------------------------------------------------------------------------
-- 9. Contrôle avant reprise
-- ----------------------------------------------------------------------------
-- Les contraintes NOT VALID ne couvrent pas les lignes anciennes, mais l'UPDATE de la reprise les recontrôle sur
-- les lignes qu'il réécrit : une ligne hors règle ferait échouer la migration sur une erreur Postgres brute. Le
-- contrôle porte sur ces lignes seules, et l'arrêt dit quoi corriger, avant toute écriture.
DO $$
DECLARE
    v_max integer;
    v_price integer;
BEGIN
    SELECT count(*) FILTER (WHERE max_per_order NOT BETWEEN 1 AND 50),
           count(*) FILTER (WHERE price <> trunc(price))
      INTO v_max, v_price
      FROM public.ticket_categories
     WHERE sale_online IS DISTINCT FROM is_visible AND NOT is_visible;
    IF v_max > 0 OR v_price > 0 THEN
        RAISE EXCEPTION 'Reprise des canaux de vente arrêtée : % catégorie(s) masquée(s) avec un maximum par commande hors de 1 à 50, % avec un prix décimal. Corrigez ces lignes, puis relancez la migration.', v_max, v_price;
    END IF;
END;
$$;


-- ----------------------------------------------------------------------------
-- 10. Reprise, en dernier sur cette table
-- ----------------------------------------------------------------------------
-- sale_online = is_visible : seules les lignes masquées sont réécrites, et au second passage aucune ne l'est (la
-- garde évite 55006, le rejeu se fait deux fois dans une même transaction). SET CONSTRAINTS vide les événements en
-- attente de trg_ticket_categories_public_summary_sync avant la fin de la migration.
-- reprise:debut
UPDATE public.ticket_categories SET sale_online = FALSE WHERE sale_online IS DISTINCT FROM is_visible AND NOT is_visible;
-- reprise:fin
SET CONSTRAINTS ALL IMMEDIATE;
