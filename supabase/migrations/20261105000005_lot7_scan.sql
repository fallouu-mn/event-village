-- ============================================================================
-- EVENT VILLAGE — LOT 7 (7.2 serveur, 7.1 (p)) : scan idempotent, version du secret sous verrou,
-- encaissement rejouable, chiffres du contrôleur, saisie manuelle en deux temps, devis du guichet
-- ============================================================================
-- Contrat : scratchpad/lot7-design.md, section 2 (M5), 3.3, 6.1 ; décisions D3, D32, D39 à D43, D53.
-- Migration rejouable (IF NOT EXISTS, CREATE OR REPLACE, DROP … IF EXISTS) ; aucune migration gelée modifiée.
--  1. ticket_scans.secret_version (version du secret présentée ou contrôlée) et ticket_scans.client_key
--     (clé d'idempotence de la lecture, propre au scanneur, index unique partiel).
--  2. scan_log : deux paramètres de plus en dernier (p_secret_version, p_client_key), par défaut NULL ; les
--     appels nommés à 9 arguments restent valides.
--  3. ticket_scan (recopie intégrale de 20261102000002_lot5_dette.sql:743-861) :
--     0.  verrou consultatif par (scanneur, clé) quand une clé est fournie ;
--     1 bis. rejeu : une ligne du même scanneur avec la même clé rend le verdict d'origine, sans nouvelle
--         ligne, même si le code a expiré entre-temps ;
--     5.  le code (totp_ok) ET la version du secret présentée sont contrôlés sous le verrou du billet ; un
--         code refusé dit d'abord le statut d'annulation (event_cancelled, cancelled, refunded), sinon
--         qr_expired (D3) ; version absente : refus (fail-closed, D32). Ferme la course de (p) : la route
--         lit le secret sans verrou, une rotation validée avant le verrou change la version ;
--     already_used et valid renvoient ticket.checked_in_at et ticket.checked_in_by_me.
--  4. ticket_cash_checkin (recopie intégrale de 20261101000011_lot4_caisse.sql:95-181) : rejeu par le même
--     scanneur d'un encaissement fait → verdict d'origine (valid, replayed) ; version du secret du scan
--     comparée sous le verrou du billet (CASH_QR_OUTDATED, statut avant version) ; la ligne acceptée
--     recopie secret_version.
--  5. controller_scan_stats, 6. ticket_manual_lookup, 7. counter_sale_quote : nouvelles RPC service_role.
-- ============================================================================

-- ── 1. Colonnes du journal des scans ────────────────────────────────────────
ALTER TABLE public.ticket_scans
    ADD COLUMN IF NOT EXISTS secret_version integer NULL CHECK (secret_version IS NULL OR secret_version >= 1);
ALTER TABLE public.ticket_scans
    ADD COLUMN IF NOT EXISTS client_key text NULL CHECK (client_key IS NULL OR client_key ~ '^[A-Za-z0-9_-]{8,100}$');
CREATE UNIQUE INDEX IF NOT EXISTS uq_ticket_scans_client_key
    ON public.ticket_scans (scanner_id, client_key) WHERE client_key IS NOT NULL;
COMMENT ON COLUMN public.ticket_scans.secret_version IS
    'Lot 7 (M5) : version du secret du billet présentée par le QR (égale à tickets.security_version quand elle correspondait, contrôlée sous le verrou du billet) ; NULL pour une saisie manuelle ou un guichet.';
COMMENT ON COLUMN public.ticket_scans.client_key IS
    'Lot 7 (M5, D39) : clé d''idempotence de la lecture (en-tête Idempotency-Key), unique par scanneur ; un rejeu rend le verdict d''origine.';

-- ── 2. scan_log : version et clé ────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.scan_log(uuid, uuid, uuid, text, boolean, text, boolean, text, numeric);
CREATE OR REPLACE FUNCTION public.scan_log(p_ticket uuid, p_event uuid, p_scanner uuid, p_result text, p_accepted boolean,
                                           p_method text, p_identity boolean, p_hash text, p_amount numeric DEFAULT NULL,
                                           p_secret_version integer DEFAULT NULL, p_client_key text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO public.ticket_scans (ticket_id, event_id, scanner_id, result, accepted, method, identity_verified, payload_hash, amount_due,
                                     secret_version, client_key)
    VALUES (p_ticket, p_event, p_scanner, p_result, p_accepted, p_method, COALESCE(p_identity, FALSE), p_hash, p_amount,
            p_secret_version, p_client_key)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- ── 3. Scan ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ticket_scan(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_scanner uuid := (p->>'scanner_id')::uuid;
    v_event uuid := (p->>'event_id')::uuid;
    v_method text := COALESCE(p->>'method', 'QR');
    v_identity boolean := COALESCE((p->>'identity_verified')::boolean, FALSE);
    v_hash text := NULLIF(p->>'payload_hash', '');
    v_pre text := NULLIF(p->>'pre_result', '');
    v_key text := NULLIF(btrim(COALESCE(p->>'client_key', '')), '');
    v_version integer;
    v_ticket_id uuid;
    t record;
    s record;
    v_problem text;
    v_pay_status text;
    v_order_status text;
    v_scope text;
    v_scan uuid;
    v_info jsonb;
    v_reply jsonb;
    v_checked_at timestamptz;
    v_checked_by uuid;
BEGIN
    IF v_method NOT IN ('QR', 'MANUAL') THEN
        RAISE EXCEPTION 'ticket_scan : méthode % inconnue', v_method;
    END IF;
    -- Clé d'idempotence : facultative pour la RPC (seed, appels internes), obligatoire pour la route
    IF v_key IS NOT NULL AND v_key !~ '^[A-Za-z0-9_-]{8,100}$' THEN
        RETURN jsonb_build_object('http', 400, 'code', 'IDEMPOTENCY_KEY_REQUIRED');
    END IF;
    -- Version du secret présentée (QR seulement) ; absente ou illisible : NULL, refusée à l'étape 5 (D32)
    IF v_method = 'QR' AND COALESCE(p->>'secret_version', '') ~ '^[1-9][0-9]{0,8}$' THEN
        v_version := (p->>'secret_version')::integer;
    END IF;
    -- 0. Deux envois simultanés de la même clé par le même scanneur : sérialisés
    IF v_key IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('scan:' || COALESCE(v_scanner::text, '') || ':' || v_key));
    END IF;
    -- 1. Droit du scanneur sur l'événement, avant toute lecture du billet ou du code
    --    (refus journalisé sans la clé : il n'est pas rejouable et ne bloque pas une lecture ultérieure)
    IF v_scanner IS NULL OR v_event IS NULL OR NOT public.scan_scanner_authorized(v_scanner, v_event) THEN
        PERFORM public.scan_log(NULL, v_event, v_scanner, 'forbidden', FALSE, v_method, v_identity, v_hash, NULL, v_version, NULL);
        RETURN jsonb_build_object('http', 403, 'code', 'SCAN_FORBIDDEN');
    END IF;
    -- 1 bis. Rejeu de la même lecture (réponse perdue, relance automatique) : verdict d'origine, aucune ligne
    IF v_key IS NOT NULL THEN
        SELECT * INTO s FROM public.ticket_scans WHERE scanner_id = v_scanner AND client_key = v_key;
        IF FOUND THEN
            v_reply := jsonb_build_object('result', s.result, 'scan_id', s.id, 'replayed', TRUE,
                                          'consumed', s.consumed_at IS NOT NULL);
            IF s.amount_due IS NOT NULL THEN
                v_reply := v_reply || jsonb_build_object('amount_due', s.amount_due);
            END IF;
            -- Le billet n'est rendu que si la réponse d'origine le rendait (jamais pour un billet introuvable,
            -- d'un autre événement, ou une lecture refusée avant le billet)
            IF s.ticket_id IS NOT NULL AND s.result NOT IN ('invalid', 'wrong_event', 'dynamic_qr_required', 'manual_entry_refused', 'forbidden') THEN
                SELECT jsonb_build_object('id', tk.id, 'ticket_number', tk.ticket_number, 'category', c.name,
                                          'holder', CASE WHEN tk.user_id IS NULL THEN 'Vente au guichet'
                                                         ELSE btrim(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) END,
                                          'price', tk.price, 'is_manual_entry', s.method = 'MANUAL',
                                          'checked_in_at', tk.checked_in_at,
                                          'checked_in_by_me', tk.checked_in_by IS NOT DISTINCT FROM v_scanner)
                  INTO v_info
                  FROM public.tickets tk
                  JOIN public.ticket_categories c ON c.id = tk.category_id
                  LEFT JOIN public.users u ON u.id = tk.user_id
                 WHERE tk.id = s.ticket_id;
                IF v_info IS NOT NULL THEN
                    v_reply := v_reply || jsonb_build_object('ticket', v_info);
                END IF;
            END IF;
            RETURN v_reply;
        END IF;
    END IF;
    -- 2. Refus décidé avant la base (payload qui n'est pas un QR dynamique)
    IF v_pre IS NOT NULL THEN
        v_scan := public.scan_log(NULL, v_event, v_scanner, v_pre, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
        RETURN jsonb_build_object('result', v_pre, 'scan_id', v_scan);
    END IF;
    -- 3. Saisie manuelle : périmètre réglé et pièce d'identité vérifiée
    IF v_method = 'MANUAL' THEN
        v_scope := public.fin_setting_text('access.manual_entry_scope');
        IF NOT v_identity
           OR (v_scope = 'ASSIGNED_CONTROLLER' AND NOT EXISTS (
                   SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_scanner)) THEN
            v_scan := public.scan_log(NULL, v_event, v_scanner, 'manual_entry_refused', FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
            RETURN jsonb_build_object('result', 'manual_entry_refused', 'scan_id', v_scan);
        END IF;
        SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = upper(btrim(p->>'ticket_number'));
    ELSE
        v_ticket_id := NULLIF(p->>'ticket_id', '')::uuid;
    END IF;
    -- 4. Billet de l'événement (aucune donnée sinon), sous verrou
    SELECT tk.*, c.name AS category_name, u.first_name, u.last_name
      INTO t
      FROM public.tickets tk
      JOIN public.ticket_categories c ON c.id = tk.category_id
      LEFT JOIN public.users u ON u.id = tk.user_id
     WHERE tk.id = v_ticket_id
       FOR UPDATE OF tk;
    IF NOT FOUND THEN
        v_scan := public.scan_log(NULL, v_event, v_scanner, 'invalid', FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
        RETURN jsonb_build_object('result', 'invalid', 'scan_id', v_scan);
    END IF;
    IF t.event_id <> v_event THEN
        v_scan := public.scan_log(t.id, v_event, v_scanner, 'wrong_event', FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
        RETURN jsonb_build_object('result', 'wrong_event', 'scan_id', v_scan);
    END IF;
    v_info := jsonb_build_object('id', t.id, 'ticket_number', t.ticket_number, 'category', t.category_name,
                                 'holder', CASE WHEN t.user_id IS NULL THEN 'Vente au guichet' ELSE btrim(COALESCE(t.first_name, '') || ' ' || COALESCE(t.last_name, '')) END, 'price', t.price,
                                 'is_manual_entry', v_method = 'MANUAL');
    -- 5. Code dynamique (calculé hors base avec la clé maître) et version du secret, lus sous le verrou du
    --    billet : une rotation (transfert, annulation, remboursement, régénération) validée avant le verrou
    --    rend le code présenté périmé. Statut d'annulation contrôlé avant la version (D3).
    IF v_method = 'QR' AND (NOT COALESCE((p->>'totp_ok')::boolean, FALSE) OR v_version IS DISTINCT FROM t.security_version) THEN
        v_problem := CASE
            WHEN (SELECT e.status::text FROM public.events e WHERE e.id = v_event) = 'ANNULE' THEN 'event_cancelled'
            WHEN t.status::text = 'ANNULE' THEN 'cancelled'
            WHEN t.status::text IN ('REMBOURSE', 'REMBOURSEMENT_EN_COURS') THEN 'refunded'
            ELSE 'qr_expired' END;
        v_scan := public.scan_log(t.id, v_event, v_scanner, v_problem, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'ticket', v_info);
    END IF;
    -- 6. Événement : statut et fenêtre
    v_problem := public.scan_event_problem(v_event);
    IF v_problem IS NOT NULL THEN
        v_scan := public.scan_log(t.id, v_event, v_scanner, v_problem, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'ticket', v_info);
    END IF;
    -- 7. Billet
    v_problem := CASE t.status::text
        WHEN 'VALIDE' THEN NULL
        WHEN 'UTILISE' THEN 'already_used'
        WHEN 'ANNULE' THEN 'cancelled'
        WHEN 'REMBOURSE' THEN 'refunded'
        WHEN 'REMBOURSEMENT_EN_COURS' THEN 'refunded'
        ELSE 'invalid' END;
    IF v_problem IS NOT NULL THEN
        v_scan := public.scan_log(t.id, v_event, v_scanner, v_problem, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan,
                                  'ticket', v_info || jsonb_build_object('checked_in_at', t.checked_in_at,
                                                                         'checked_in_by_me', t.checked_in_by IS NOT DISTINCT FROM v_scanner));
    END IF;
    -- 8. Paiement
    IF t.price > 0 THEN
        IF t.payment_id IS NOT NULL THEN
            SELECT status::text INTO v_pay_status FROM public.payments WHERE id = t.payment_id;
        END IF;
        IF v_pay_status IS NULL OR v_pay_status NOT IN ('SUCCESS', 'PARTIAL') THEN
            IF t.order_id IS NOT NULL THEN
                SELECT payment_status::text INTO v_order_status FROM public.orders WHERE id = t.order_id;
            END IF;
            IF t.payment_id IS NULL AND v_order_status IS NOT NULL AND v_order_status <> 'SUCCESS' THEN
                v_scan := public.scan_log(t.id, v_event, v_scanner, 'cash_required', FALSE, v_method, v_identity, v_hash, t.price, v_version, v_key);
                RETURN jsonb_build_object('result', 'cash_required', 'scan_id', v_scan, 'amount_due', t.price, 'consumed', FALSE, 'ticket', v_info);
            END IF;
            IF v_order_status IS DISTINCT FROM 'SUCCESS' THEN
                v_scan := public.scan_log(t.id, v_event, v_scanner, 'payment_required', FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
                RETURN jsonb_build_object('result', 'payment_required', 'scan_id', v_scan, 'ticket', v_info);
            END IF;
        END IF;
    END IF;
    -- 9. Compostage (une seule ligne modifiée, sous verrou)
    UPDATE public.tickets SET status = 'UTILISE', checked_in_at = now(), checked_in_by = v_scanner, updated_at = now()
     WHERE id = t.id AND status = 'VALIDE';
    IF NOT FOUND THEN
        SELECT checked_in_at, checked_in_by INTO v_checked_at, v_checked_by FROM public.tickets WHERE id = t.id;
        v_scan := public.scan_log(t.id, v_event, v_scanner, 'already_used', FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
        RETURN jsonb_build_object('result', 'already_used', 'scan_id', v_scan,
                                  'ticket', v_info || jsonb_build_object('checked_in_at', v_checked_at,
                                                                         'checked_in_by_me', v_checked_by IS NOT DISTINCT FROM v_scanner));
    END IF;
    v_scan := public.scan_log(t.id, v_event, v_scanner, 'valid', TRUE, v_method, v_identity, v_hash, NULL, v_version, v_key);
    RETURN jsonb_build_object('result', 'valid', 'scan_id', v_scan,
                              'ticket', v_info || jsonb_build_object('checked_in_at', now(), 'checked_in_by_me', TRUE));
END;
$$;

-- ── 4. Encaissement d'un billet « à régler sur place » + compostage ────────────
CREATE OR REPLACE FUNCTION public.ticket_cash_checkin(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_scan_id uuid := (p->>'scan_id')::uuid;
    v_scanner uuid := (p->>'scanner_id')::uuid;
    v_event uuid := (p->>'event_id')::uuid;
    s record;
    t record;
    o record;
    sh record;
    prev record;
    v_problem text;
    v_amount numeric;
    v_payment uuid;
    v_partner uuid;
    v_accepted uuid;
BEGIN
    SELECT * INTO s FROM public.ticket_scans WHERE id = v_scan_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('result', 'invalid', 'code', 'CASH_SCAN_INVALID');
    END IF;
    IF s.result <> 'cash_required' OR s.scanner_id IS DISTINCT FROM v_scanner OR s.event_id IS DISTINCT FROM v_event THEN
        RETURN jsonb_build_object('result', 'invalid', 'code', 'CASH_SCAN_INVALID');
    END IF;
    IF s.consumed_at IS NOT NULL THEN
        -- Lot 7 (D40) : rejeu par le même scanneur d'un encaissement fait (réponse perdue) → verdict d'origine,
        -- sans aucune écriture ; sinon refus (scan consommé autrement)
        SELECT py.id, py.amount, py.shift_id INTO prev
          FROM public.payments py
         WHERE py.ticket_id = s.ticket_id AND py.metadata->>'source' = 'CASH_CHECKIN' AND py.metadata->>'scan_id' = s.id::text
         ORDER BY py.created_at, py.id
         LIMIT 1;
        IF FOUND THEN
            SELECT x.id INTO v_accepted FROM public.ticket_scans x WHERE x.ticket_id = s.ticket_id AND x.accepted LIMIT 1;
            RETURN jsonb_build_object('result', 'valid', 'amount', prev.amount, 'payment_id', prev.id, 'scan_id', v_accepted,
                                      'shift_id', prev.shift_id, 'replayed', TRUE);
        END IF;
        RETURN jsonb_build_object('result', 'already_used', 'code', 'CASH_ALREADY_PROCESSED');
    END IF;
    IF s.created_at < now() - interval '5 minutes' THEN
        RETURN jsonb_build_object('result', 'cash_required', 'code', 'CASH_SCAN_EXPIRED');
    END IF;
    SELECT * INTO t FROM public.tickets WHERE id = s.ticket_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('result', 'invalid', 'code', 'CASH_SCAN_INVALID');
    END IF;
    -- Lot 7 : version du secret du scan comparée sous le verrou du billet (rotation entre le scan et
    -- l'encaissement) ; statut d'annulation dit avant la version (D3)
    IF s.method = 'QR' AND s.secret_version IS DISTINCT FROM t.security_version THEN
        v_problem := CASE
            WHEN (SELECT e.status::text FROM public.events e WHERE e.id = t.event_id) = 'ANNULE' THEN 'event_cancelled'
            WHEN t.status::text = 'ANNULE' THEN 'cancelled'
            WHEN t.status::text IN ('REMBOURSE', 'REMBOURSEMENT_EN_COURS') THEN 'refunded'
            ELSE 'qr_expired' END;
        RETURN jsonb_build_object('result', v_problem, 'code', 'CASH_QR_OUTDATED');
    END IF;
    IF t.status::text <> 'VALIDE' THEN
        RETURN jsonb_build_object('result', CASE t.status::text WHEN 'UTILISE' THEN 'already_used' WHEN 'ANNULE' THEN 'cancelled' ELSE 'refunded' END,
                                  'code', 'CASH_TICKET_STATUS');
    END IF;
    IF t.order_id IS NULL OR t.payment_id IS NOT NULL THEN
        RETURN jsonb_build_object('result', 'invalid', 'code', 'CASH_ALREADY_PAID');
    END IF;
    SELECT * INTO o FROM public.orders WHERE id = t.order_id FOR UPDATE;
    IF o.payment_status::text = 'SUCCESS' THEN
        RETURN jsonb_build_object('result', 'invalid', 'code', 'CASH_ALREADY_PAID');
    END IF;
    v_problem := public.scan_event_problem(v_event);
    IF v_problem IS NOT NULL THEN
        RETURN jsonb_build_object('result', v_problem, 'code', 'CASH_EVENT_CLOSED');
    END IF;
    IF NOT public.shift_can_handle_cash(v_scanner, v_event) THEN
        RETURN jsonb_build_object('result', 'cash_required', 'code', 'CASH_FORBIDDEN');
    END IF;
    SELECT * INTO sh FROM public.controller_shifts
     WHERE controller_id = v_scanner AND event_id = v_event AND status = 'OUVERT' FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('result', 'cash_required', 'code', 'CASH_NO_OPEN_SHIFT');
    END IF;

    v_amount := t.price;
    SELECT partner_id INTO v_partner FROM public.events WHERE id = v_event;
    INSERT INTO public.payments (transaction_id, client_id, partner_id, order_id, ticket_id, event_id, payment_target, amount, currency,
                                 payment_method, is_platform_payment, offline_payment_method, aggregator, facial_amount,
                                 aggregator_fee, service_fee, gross_event_village_revenue, net_event_village_revenue,
                                 partner_payout_amount, status, paid_at, shift_id, metadata)
    VALUES ('TX-CASH-' || upper(replace(gen_random_uuid()::text, '-', '')), t.user_id, v_partner, o.id, t.id, v_event, 'TICKET',
            v_amount, 'XOF', 'ESPECES', FALSE, 'ESPECES', NULL, v_amount, 0, 0, 0, 0, 0, 'SUCCESS', now(), sh.id,
            jsonb_build_object('source', 'CASH_CHECKIN', 'scan_id', s.id))
    RETURNING id INTO v_payment;

    UPDATE public.tickets
       SET payment_id = v_payment, status = 'UTILISE', checked_in_at = now(), checked_in_by = v_scanner, updated_at = now()
     WHERE id = t.id AND status = 'VALIDE';
    UPDATE public.orders
       SET paid_amount = paid_amount + v_amount,
           balance_amount = GREATEST(total_amount - (paid_amount + v_amount), 0),
           payment_status = CASE WHEN NOT EXISTS (
                   SELECT 1 FROM public.tickets x WHERE x.order_id = o.id AND x.payment_id IS NULL AND x.id <> t.id)
               THEN 'SUCCESS'::payment_status_enum ELSE 'PARTIAL'::payment_status_enum END,
           updated_at = now()
     WHERE id = o.id;
    UPDATE public.controller_shifts SET expected_cash_total = expected_cash_total + v_amount, updated_at = now() WHERE id = sh.id;
    UPDATE public.ticket_scans SET consumed_at = now() WHERE id = s.id;
    INSERT INTO public.ticket_scans (ticket_id, event_id, scanner_id, result, accepted, method, identity_verified, payload_hash, shift_id, amount_due,
                                     secret_version)
    VALUES (t.id, v_event, v_scanner, 'valid', TRUE, s.method, s.identity_verified, s.payload_hash, sh.id, v_amount,
            s.secret_version)
    RETURNING id INTO v_accepted;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_scanner, 'CAISSE', 'CASH_COLLECTED', 'payments', v_payment,
            jsonb_build_object('ticket_id', t.id, 'order_id', o.id, 'shift_id', sh.id, 'amount', v_amount, 'scan_id', v_accepted));
    RETURN jsonb_build_object('result', 'valid', 'amount', v_amount, 'payment_id', v_payment, 'scan_id', v_accepted, 'shift_id', sh.id,
                              'replayed', FALSE);
END;
$$;

-- ── 5. Chiffres et historique du contrôleur (D42) ───────────────────────────
-- Porte nommée : entrées acceptées de l'événement à cette porte (point d'entrée figé sur la ligne au scan) ;
-- sans porte : entrées acceptées par ce scanneur. Refus du scanneur hors « forbidden » et hors cash_required
-- encaissé (même règle que le pilotage). Historique sans nom de porteur.
CREATE OR REPLACE FUNCTION public.controller_scan_stats(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_scanner uuid := public.try_uuid(p->>'scanner_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_limit integer := 20;
    v_entry text;
    v_door bigint;
    v_mine bigint;
    v_refused bigint;
    v_by_result jsonb;
    v_recent jsonb;
BEGIN
    IF COALESCE(p->>'limit', '') ~ '^[0-9]{1,6}$' THEN
        v_limit := least(greatest((p->>'limit')::integer, 1), 50);
    END IF;
    IF v_scanner IS NULL OR v_event IS NULL OR NOT public.scan_scanner_authorized(v_scanner, v_event) THEN
        RETURN jsonb_build_object('ok', false, 'http', 404, 'code', 'NOT_FOUND');
    END IF;
    SELECT NULLIF(btrim(ec.entry_point), '') INTO v_entry
      FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_scanner;

    SELECT count(*) FILTER (WHERE sc.accepted),
           count(*) FILTER (WHERE NOT sc.accepted AND sc.result <> 'forbidden'
                                  AND NOT (sc.result = 'cash_required' AND sc.consumed_at IS NOT NULL))
      INTO v_mine, v_refused
      FROM public.ticket_scans sc
     WHERE sc.event_id = v_event AND sc.scanner_id = v_scanner;

    IF v_entry IS NULL THEN
        v_door := v_mine;
    ELSE
        SELECT count(*) INTO v_door
          FROM public.ticket_scans sc
         WHERE sc.event_id = v_event AND sc.accepted AND sc.entry_point = v_entry;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('result', x.result, 'count', x.n) ORDER BY x.n DESC, x.result), '[]'::jsonb)
      INTO v_by_result
      FROM (SELECT sc.result, count(*) AS n
              FROM public.ticket_scans sc
             WHERE sc.event_id = v_event AND sc.scanner_id = v_scanner AND NOT sc.accepted AND sc.result <> 'forbidden'
               AND NOT (sc.result = 'cash_required' AND sc.consumed_at IS NOT NULL)
             GROUP BY sc.result) x;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('scan_id', r.id, 'at', r.created_at, 'result', r.result, 'method', r.method,
                                                 'ticket_number', r.ticket_number, 'category', r.category)
                              ORDER BY r.created_at DESC, r.id DESC), '[]'::jsonb)
      INTO v_recent
      FROM (SELECT sc.id, sc.created_at, sc.result, sc.method, tk.ticket_number, c.name AS category
              FROM public.ticket_scans sc
              LEFT JOIN public.tickets tk ON tk.id = sc.ticket_id
              LEFT JOIN public.ticket_categories c ON c.id = COALESCE(sc.category_id, tk.category_id)
             WHERE sc.event_id = v_event AND sc.scanner_id = v_scanner AND sc.result <> 'forbidden'
             ORDER BY sc.created_at DESC, sc.id DESC
             LIMIT v_limit) r;

    RETURN jsonb_build_object('ok', true, 'entry_point', v_entry, 'door_entries', v_door, 'my_entries', v_mine,
                              'my_refusals', v_refused, 'refusals_by_result', v_by_result, 'recent', v_recent);
END;
$$;

-- ── 6. Saisie manuelle, premier temps : vérification sans compostage (D43, D88) ─
-- Droit sur l'événement et périmètre access.manual_entry_scope comme ticket_scan (étapes 1 et 3) ; le numéro
-- est tickets.ticket_number ; `preview` = résultat qu'aurait le scan (événement, statut, paiement), sans
-- verrou, sans ligne ticket_scans ; chaque vérification (et chaque refus de droit) est journalisée dans
-- audit_logs, le numéro haché.
CREATE OR REPLACE FUNCTION public.ticket_manual_lookup(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_scanner uuid := public.try_uuid(p->>'scanner_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_number text := upper(btrim(COALESCE(p->>'ticket_number', '')));
    v_hash text;
    v_scope text;
    t record;
    v_found boolean := FALSE;
    v_preview text;
    v_pay_status text;
    v_order_status text;
BEGIN
    IF v_scanner IS NULL OR v_event IS NULL OR v_number = '' THEN
        RETURN jsonb_build_object('ok', false, 'http', 400, 'code', 'INVALID_INPUT');
    END IF;
    v_hash := encode(sha256(convert_to(v_number, 'UTF8')), 'hex');
    v_scope := public.fin_setting_text('access.manual_entry_scope');
    IF NOT public.scan_scanner_authorized(v_scanner, v_event)
       OR (v_scope = 'ASSIGNED_CONTROLLER' AND NOT EXISTS (
               SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_scanner)) THEN
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
        VALUES (v_scanner, 'CONTROLE', 'MANUAL_LOOKUP', 'tickets', NULL,
                jsonb_build_object('event_id', v_event, 'found', NULL, 'refused', 'SCAN_FORBIDDEN', 'ticket_number_hash', v_hash));
        RETURN jsonb_build_object('ok', false, 'http', 403, 'code', 'SCAN_FORBIDDEN');
    END IF;

    SELECT tk.id, tk.event_id, tk.ticket_number, tk.status::text AS status, tk.price, tk.payment_id, tk.order_id, tk.user_id,
           c.name AS category_name, u.first_name, u.last_name
      INTO t
      FROM public.tickets tk
      JOIN public.ticket_categories c ON c.id = tk.category_id
      LEFT JOIN public.users u ON u.id = tk.user_id
     WHERE tk.ticket_number = v_number;
    IF FOUND THEN
        v_found := t.event_id = v_event;
    END IF;
    IF NOT v_found THEN
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
        VALUES (v_scanner, 'CONTROLE', 'MANUAL_LOOKUP', 'tickets', NULL,
                jsonb_build_object('event_id', v_event, 'found', false, 'ticket_number_hash', v_hash));
        RETURN jsonb_build_object('ok', true, 'found', false);
    END IF;

    -- Résultat qu'aurait le scan (étapes 6 à 8 de ticket_scan), sans rien écrire
    v_preview := public.scan_event_problem(v_event);
    IF v_preview IS NULL THEN
        v_preview := CASE t.status
            WHEN 'VALIDE' THEN NULL
            WHEN 'UTILISE' THEN 'already_used'
            WHEN 'ANNULE' THEN 'cancelled'
            WHEN 'REMBOURSE' THEN 'refunded'
            WHEN 'REMBOURSEMENT_EN_COURS' THEN 'refunded'
            ELSE 'invalid' END;
    END IF;
    IF v_preview IS NULL AND t.price > 0 THEN
        IF t.payment_id IS NOT NULL THEN
            SELECT status::text INTO v_pay_status FROM public.payments WHERE id = t.payment_id;
        END IF;
        IF v_pay_status IS NULL OR v_pay_status NOT IN ('SUCCESS', 'PARTIAL') THEN
            IF t.order_id IS NOT NULL THEN
                SELECT payment_status::text INTO v_order_status FROM public.orders WHERE id = t.order_id;
            END IF;
            IF t.payment_id IS NULL AND v_order_status IS NOT NULL AND v_order_status <> 'SUCCESS' THEN
                v_preview := 'cash_required';
            ELSIF v_order_status IS DISTINCT FROM 'SUCCESS' THEN
                v_preview := 'payment_required';
            END IF;
        END IF;
    END IF;
    v_preview := COALESCE(v_preview, 'valid');

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_scanner, 'CONTROLE', 'MANUAL_LOOKUP', 'tickets', t.id,
            jsonb_build_object('event_id', v_event, 'found', true, 'ticket_number_hash', v_hash));
    RETURN jsonb_build_object('ok', true, 'found', true, 'ticket', jsonb_build_object(
        'ticket_number', t.ticket_number,
        'holder', CASE WHEN t.user_id IS NULL THEN 'Vente au guichet' ELSE btrim(COALESCE(t.first_name, '') || ' ' || COALESCE(t.last_name, '')) END,
        'category', t.category_name,
        'status', t.status,
        'preview', v_preview));
END;
$$;

-- ── 7. Devis du guichet (D53) : mêmes contrôles que counter_sale, sans écriture ni verrou ─
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
    -- Contrôles de vente de counter_sale (lot 2, hors fenêtre de vente en ligne et visibilité)
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

-- ── 8. Privilèges : service_role uniquement ─────────────────────────────────
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.scan_log(uuid, uuid, uuid, text, boolean, text, boolean, text, numeric, integer, text)',
        'public.ticket_scan(jsonb)',
        'public.ticket_cash_checkin(jsonb)',
        'public.controller_scan_stats(jsonb)',
        'public.ticket_manual_lookup(jsonb)',
        'public.counter_sale_quote(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
