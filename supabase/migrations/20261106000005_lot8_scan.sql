-- ============================================================================
-- EVENT VILLAGE — LOT 8 (8.2 e) : mode « renvoi seulement » du scan, côté serveur
-- ============================================================================
-- Contrat : scratchpad/lot8-design.md, sections 2.8, 3.5 et 7.1 ; décisions L4, L42, L43, L44.
-- Migration rejouable (CREATE OR REPLACE) ; aucune migration gelée modifiée ; aucune contrainte SQL :
-- `not_processed` n'est jamais écrit dans ticket_scans.
--
-- ticket_scan : recopie intégrale de 20261105000005_lot7_scan.sql:63-245, même signature (L4 : `replay_only`
-- reste dans `p jsonb`), verrous inchangés. Seuls changements, repérés « Lot 8 » dans le corps :
--  - v_replay_only : lecture sans cast, toute valeur non `false` compte comme un renvoi ;
--  - clé absente en mode renvoi : refus 400 avant toute écriture ;
--  - étape 1 : en mode renvoi, pas de ligne `forbidden` (L43), le refus seul ;
--  - étape 1 bis : en mode renvoi, la ligne doit aussi porter sur cet événement. Pas en mode normal : la même
--    clé sur un autre événement y heurterait uq_ticket_scans_client_key ;
--  - étape 1 ter (nouvelle) : aucune ligne en mode renvoi, `not_processed` (L42). Les étapes 2 à 9, seules à
--    écrire ou à composter, sont inatteignables en mode renvoi.
-- Le verrou consultatif de l'étape 0 reste pris en mode renvoi : il sérialise un renvoi avec l'envoi d'origine
-- encore en cours, et le renvoi rend alors le verdict d'origine.
-- ============================================================================

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
    -- Lot 8 (8.2 e) : lecture sans cast ; toute valeur non `false` compte comme un renvoi, jamais un compostage
    v_replay_only boolean := COALESCE(p->>'replay_only', 'false') <> 'false';
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
    -- Lot 8 (8.2 e) : un renvoi sans clé ne désigne aucune lecture, refus avant toute écriture
    IF v_replay_only AND v_key IS NULL THEN
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
        -- Lot 8 (L43) : un renvoi n'écrit rien, pas même `forbidden`
        IF NOT v_replay_only THEN
            PERFORM public.scan_log(NULL, v_event, v_scanner, 'forbidden', FALSE, v_method, v_identity, v_hash, NULL, v_version, NULL);
        END IF;
        RETURN jsonb_build_object('http', 403, 'code', 'SCAN_FORBIDDEN');
    END IF;
    -- 1 bis. Rejeu de la même lecture (réponse perdue, relance automatique) : verdict d'origine, aucune ligne
    IF v_key IS NOT NULL THEN
        -- Lot 8 (8.2 e) : un renvoi est propre à l'événement demandé
        SELECT * INTO s FROM public.ticket_scans
         WHERE scanner_id = v_scanner AND client_key = v_key
           AND (NOT v_replay_only OR event_id = v_event);
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
    -- 1 ter. Lot 8 (L42) : renvoi sans ligne pour cette clé, rien n'a été traité et rien ne l'est ici. Le
    --        spectateur n'est plus devant le contrôleur : les étapes 2 à 9 ne sont jamais atteintes.
    IF v_replay_only THEN
        RETURN jsonb_build_object('result', 'not_processed', 'replayed', FALSE, 'code', 'REPLAY_NOT_FOUND');
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

-- ── Privilèges ──────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.ticket_scan(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_scan(jsonb) TO service_role;
