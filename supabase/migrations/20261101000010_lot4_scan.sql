-- ============================================================================
-- EVENT VILLAGE — LOT 4 : voie de scan unique, secret par billet, journal des tentatives (4.1 à 4.4, 4.9)
-- ============================================================================
--  - tickets.totp_secret : aléatoire, obligatoire, généré à l'émission (DEFAULT) et régénéré au
--    transfert. Le code affiché se calcule avec ce secret ET la clé TICKET_TOTP_MASTER_KEY (hors base) :
--    lire la colonne ne suffit pas à fabriquer un code.
--  - ticket_scans : une ligne par tentative de scan, acceptée ou refusée (empreinte du payload,
--    jamais le payload) ; service_role uniquement.
--  - ticket_scan : décide de tout sous verrou du billet, dans l'ordre du contrat : droit du scanneur
--    sur l'événement (avant toute vérification du code, aucune donnée de billet sinon), billet de
--    l'événement, code dynamique (calculé hors base, transmis en totp_ok), statut et fenêtre de
--    l'événement, statut du billet, paiement (encaissement requis pour un billet « à régler sur
--    place »), compostage conditionnel VALIDE → UTILISE. Remplace atomic_ticket_checkin (supprimée).
--  - ticket_transfer_claim : réclamation d'un transfert P2P en une transaction (propriétaire,
--    numéro, QR et secret régénérés) : l'ancien propriétaire ne peut plus entrer.
-- ============================================================================

-- ── Secret par billet ───────────────────────────────────────────────────────
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS totp_secret TEXT;
UPDATE public.tickets
   SET totp_secret = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
 WHERE totp_secret IS NULL OR totp_secret !~ '^[0-9a-f]{64}$';
ALTER TABLE public.tickets ALTER COLUMN totp_secret SET DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
ALTER TABLE public.tickets ALTER COLUMN totp_secret SET NOT NULL;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_totp_secret_hex;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_totp_secret_hex CHECK (totp_secret ~ '^[0-9a-f]{64}$');

-- ── Journal des tentatives ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ticket_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE RESTRICT,
    event_id UUID REFERENCES public.events(id) ON DELETE RESTRICT,
    scanner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    result TEXT NOT NULL CHECK (result IN (
        'valid', 'already_used', 'invalid', 'cancelled', 'refunded', 'wrong_event', 'event_cancelled', 'event_ended',
        'event_suspended', 'event_not_open', 'payment_required', 'cash_required', 'qr_expired', 'dynamic_qr_required',
        'manual_entry_refused', 'forbidden')),
    accepted BOOLEAN NOT NULL DEFAULT FALSE,
    method TEXT NOT NULL CHECK (method IN ('QR', 'MANUAL')),
    identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
    payload_hash TEXT CHECK (payload_hash IS NULL OR payload_hash ~ '^[0-9a-f]{64}$'),
    shift_id UUID REFERENCES public.controller_shifts(id) ON DELETE RESTRICT,
    amount_due NUMERIC(12,2),
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ticket_scans_accepted_valid CHECK (NOT accepted OR result = 'valid')
);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_ticket ON public.ticket_scans (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_event ON public.ticket_scans (event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_scanner ON public.ticket_scans (scanner_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ticket_scans_one_accepted ON public.ticket_scans (ticket_id) WHERE accepted;
ALTER TABLE public.ticket_scans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ticket_scans FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ticket_scans TO service_role;
COMMENT ON TABLE public.ticket_scans IS
    'Lot 4 : une ligne par tentative de scan (acceptée ou refusée), empreinte du payload, saisie manuelle et pièce vérifiée. Service_role uniquement.';

-- ── Outils ──────────────────────────────────────────────────────────────────
-- Droit de scanner un événement : contrôleur affecté, partenaire propriétaire, ou admin (compte ACTIF)
CREATE OR REPLACE FUNCTION public.scan_scanner_authorized(p_scanner uuid, p_event uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_scanner AND u.status = 'ACTIF')
       AND (EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = p_event AND ec.user_id = p_scanner)
         OR EXISTS (SELECT 1 FROM public.events e JOIN public.partners p ON p.id = e.partner_id WHERE e.id = p_event AND p.user_id = p_scanner)
         OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_scanner AND r.role IN ('ADMIN', 'SUPERADMIN')))
$$;

-- Fenêtre de scan : début − access.scan_window_before_hours, fin (fin_event_end) + access.scan_window_after_hours
CREATE OR REPLACE FUNCTION public.scan_window(p_event uuid)
RETURNS TABLE (opens_at timestamptz, closes_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT ((e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar')
               - make_interval(hours => public.fin_setting_num('access.scan_window_before_hours')::int),
           public.fin_event_end(e.id) + make_interval(hours => public.fin_setting_num('access.scan_window_after_hours')::int)
      FROM public.events e WHERE e.id = p_event
$$;

-- Contrôle de l'événement au moment du scan ou de l'encaissement (NULL si tout va bien)
CREATE OR REPLACE FUNCTION public.scan_event_problem(p_event uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status text;
    w record;
BEGIN
    SELECT status::text INTO v_status FROM public.events WHERE id = p_event;
    IF v_status IS NULL THEN RETURN 'invalid'; END IF;
    IF v_status = 'ANNULE' THEN RETURN 'event_cancelled'; END IF;
    IF v_status = 'TERMINE' THEN RETURN 'event_ended'; END IF;
    IF v_status = 'SUSPENDU' THEN RETURN 'event_suspended'; END IF;
    IF v_status <> 'PUBLIE' THEN RETURN 'event_not_open'; END IF;
    SELECT * INTO w FROM public.scan_window(p_event);
    IF now() < w.opens_at THEN RETURN 'event_not_open'; END IF;
    IF now() > w.closes_at THEN RETURN 'event_ended'; END IF;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.scan_log(p_ticket uuid, p_event uuid, p_scanner uuid, p_result text, p_accepted boolean,
                                           p_method text, p_identity boolean, p_hash text, p_amount numeric DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO public.ticket_scans (ticket_id, event_id, scanner_id, result, accepted, method, identity_verified, payload_hash, amount_due)
    VALUES (p_ticket, p_event, p_scanner, p_result, p_accepted, p_method, COALESCE(p_identity, FALSE), p_hash, p_amount)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- ── Scan ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ticket_scan(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
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
    v_ticket_id uuid;
    t record;
    v_problem text;
    v_pay_status text;
    v_order_status text;
    v_scope text;
    v_scan uuid;
    v_info jsonb;
BEGIN
    IF v_method NOT IN ('QR', 'MANUAL') THEN
        RAISE EXCEPTION 'ticket_scan : méthode % inconnue', v_method;
    END IF;
    -- 1. Droit du scanneur sur l'événement, avant toute lecture du billet ou du code
    IF v_scanner IS NULL OR v_event IS NULL OR NOT public.scan_scanner_authorized(v_scanner, v_event) THEN
        PERFORM public.scan_log(NULL, v_event, v_scanner, 'forbidden', FALSE, v_method, v_identity, v_hash);
        RETURN jsonb_build_object('http', 403, 'code', 'SCAN_FORBIDDEN');
    END IF;
    -- 2. Refus décidé avant la base (payload qui n'est pas un QR dynamique)
    IF v_pre IS NOT NULL THEN
        v_scan := public.scan_log(NULL, v_event, v_scanner, v_pre, FALSE, v_method, v_identity, v_hash);
        RETURN jsonb_build_object('result', v_pre, 'scan_id', v_scan);
    END IF;
    -- 3. Saisie manuelle : périmètre réglé et pièce d'identité vérifiée
    IF v_method = 'MANUAL' THEN
        v_scope := public.fin_setting_text('access.manual_entry_scope');
        IF NOT v_identity
           OR (v_scope = 'ASSIGNED_CONTROLLER' AND NOT EXISTS (
                   SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_scanner)) THEN
            v_scan := public.scan_log(NULL, v_event, v_scanner, 'manual_entry_refused', FALSE, v_method, v_identity, v_hash);
            RETURN jsonb_build_object('result', 'manual_entry_refused', 'scan_id', v_scan);
        END IF;
        SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = upper(btrim(p->>'ticket_number'));
    ELSE
        v_ticket_id := NULLIF(p->>'ticket_id', '')::uuid;
    END IF;
    -- 4. Billet de l'événement (aucune donnée sinon)
    SELECT tk.*, c.name AS category_name, u.first_name, u.last_name
      INTO t
      FROM public.tickets tk
      JOIN public.ticket_categories c ON c.id = tk.category_id
      JOIN public.users u ON u.id = tk.user_id
     WHERE tk.id = v_ticket_id
       FOR UPDATE OF tk;
    IF NOT FOUND THEN
        v_scan := public.scan_log(NULL, v_event, v_scanner, 'invalid', FALSE, v_method, v_identity, v_hash);
        RETURN jsonb_build_object('result', 'invalid', 'scan_id', v_scan);
    END IF;
    IF t.event_id <> v_event THEN
        v_scan := public.scan_log(t.id, v_event, v_scanner, 'wrong_event', FALSE, v_method, v_identity, v_hash);
        RETURN jsonb_build_object('result', 'wrong_event', 'scan_id', v_scan);
    END IF;
    v_info := jsonb_build_object('id', t.id, 'ticket_number', t.ticket_number, 'category', t.category_name,
                                 'holder', btrim(COALESCE(t.first_name, '') || ' ' || COALESCE(t.last_name, '')), 'price', t.price,
                                 'is_manual_entry', v_method = 'MANUAL');
    -- 5. Code dynamique (calculé hors base avec la clé maître)
    IF v_method = 'QR' AND NOT COALESCE((p->>'totp_ok')::boolean, FALSE) THEN
        v_scan := public.scan_log(t.id, v_event, v_scanner, 'qr_expired', FALSE, v_method, v_identity, v_hash);
        RETURN jsonb_build_object('result', 'qr_expired', 'scan_id', v_scan, 'ticket', v_info);
    END IF;
    -- 6. Événement : statut et fenêtre
    v_problem := public.scan_event_problem(v_event);
    IF v_problem IS NOT NULL THEN
        v_scan := public.scan_log(t.id, v_event, v_scanner, v_problem, FALSE, v_method, v_identity, v_hash);
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
        v_scan := public.scan_log(t.id, v_event, v_scanner, v_problem, FALSE, v_method, v_identity, v_hash);
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'ticket', v_info || jsonb_build_object('checked_in_at', t.checked_in_at));
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
                v_scan := public.scan_log(t.id, v_event, v_scanner, 'cash_required', FALSE, v_method, v_identity, v_hash, t.price);
                RETURN jsonb_build_object('result', 'cash_required', 'scan_id', v_scan, 'amount_due', t.price, 'ticket', v_info);
            END IF;
            IF v_order_status IS DISTINCT FROM 'SUCCESS' THEN
                v_scan := public.scan_log(t.id, v_event, v_scanner, 'payment_required', FALSE, v_method, v_identity, v_hash);
                RETURN jsonb_build_object('result', 'payment_required', 'scan_id', v_scan, 'ticket', v_info);
            END IF;
        END IF;
    END IF;
    -- 9. Compostage (une seule ligne modifiée, sous verrou)
    UPDATE public.tickets SET status = 'UTILISE', checked_in_at = now(), checked_in_by = v_scanner, updated_at = now()
     WHERE id = t.id AND status = 'VALIDE';
    IF NOT FOUND THEN
        v_scan := public.scan_log(t.id, v_event, v_scanner, 'already_used', FALSE, v_method, v_identity, v_hash);
        RETURN jsonb_build_object('result', 'already_used', 'scan_id', v_scan, 'ticket', v_info);
    END IF;
    v_scan := public.scan_log(t.id, v_event, v_scanner, 'valid', TRUE, v_method, v_identity, v_hash);
    RETURN jsonb_build_object('result', 'valid', 'scan_id', v_scan, 'ticket', v_info);
END;
$$;

DROP FUNCTION IF EXISTS public.atomic_ticket_checkin(uuid, uuid);

-- ── Transfert P2P : réclamation atomique, identité du billet régénérée ──────
CREATE OR REPLACE FUNCTION public.ticket_transfer_claim(p_transfer_id uuid, p_recipient uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    tr record;
    t record;
    v_number text;
BEGIN
    SELECT * INTO tr FROM public.ticket_transfers WHERE id = p_transfer_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_FOUND'); END IF;
    IF tr.status::text <> 'PENDING' THEN RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_PENDING', 'status', tr.status::text); END IF;
    IF tr.expires_at <= now() THEN RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_EXPIRED'); END IF;
    IF tr.from_user_id = p_recipient THEN RETURN jsonb_build_object('ok', false, 'code', 'SELF_TRANSFER'); END IF;
    SELECT * INTO t FROM public.tickets WHERE id = tr.ticket_id FOR UPDATE;
    IF t.user_id <> tr.from_user_id THEN RETURN jsonb_build_object('ok', false, 'code', 'OWNER_CHANGED'); END IF;
    IF t.status::text <> 'VALIDE' THEN RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_TRANSFERABLE', 'status', t.status::text); END IF;
    v_number := 'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    UPDATE public.ticket_transfers SET status = 'CLAIMED', to_user_id = p_recipient, claimed_at = now() WHERE id = tr.id;
    UPDATE public.tickets
       SET user_id = p_recipient,
           ticket_number = v_number,
           qr_code = 'EV-QR-' || replace(gen_random_uuid()::text, '-', ''),
           totp_secret = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
           transfer_locked = FALSE,
           security_version = security_version + 1,
           updated_at = now()
     WHERE id = t.id;
    RETURN jsonb_build_object('ok', true, 'ticket_id', t.id, 'ticket_number', v_number, 'previous_owner', tr.from_user_id);
END;
$$;

-- Privilèges : service_role uniquement
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.scan_scanner_authorized(uuid, uuid)',
        'public.scan_window(uuid)',
        'public.scan_event_problem(uuid)',
        'public.scan_log(uuid, uuid, uuid, text, boolean, text, boolean, text, numeric)',
        'public.ticket_scan(jsonb)',
        'public.ticket_transfer_claim(uuid, uuid)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
