-- ============================================================================
-- EVENT VILLAGE — Correctifs de la contre-vérification de la finition 1 — T4 : hors de la plage du contrôle, le scanner ne
-- rend que le verdict (ni nom du porteur, ni numéro, ni catégorie du billet)
-- ============================================================================
-- 1. Recopie de ticket_manual_lookup (20261110000009_lot9ter_zones.sql) : après le droit et la porte, hors de la plage
--    (scan_event_problem non nul), refus « contrôle fermé » (409 CONTROL_CLOSED, problem, opens_at) sans lire le billet ;
--    vérification journalisée (MANUAL_LOOKUP, refused CONTROL_CLOSED, numéro haché). Un scanneur non autorisé reçoit
--    toujours 403 SCAN_FORBIDDEN, sans rien du billet (inchangé).
-- 2. Recopie de ticket_scan (20261115000003_finition1_controle.sql) : le verdict de refus pour contrôle fermé (étape 6,
--    et étape 5 quand le contrôle est fermé) ne porte plus `ticket` ; un renvoi ne rend le billet que si le contrôle est
--    ouvert et que la lecture d'origine n'était pas un refus « contrôle fermé ». Un scanneur non autorisé : 403 sans
--    billet (inchangé). Zone et porte du scanneur gardées (elles ne disent rien du billet).
-- Réservées au service_role. Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

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
    -- Lot 9 ter (9t.15)
    g record;
    v_zone_result text;
    v_redirect jsonb;
    v_ticket jsonb;
    -- cvf1 T4
    v_closed text;
    v_opens timestamptz;
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
    -- Lot 9 ter (9t.15) : porte de la vérification ; un problème de porte ne lit rien du billet et n'écrit rien
    SELECT * INTO g FROM public.scan_gate_context(v_scanner, v_event, public.try_uuid(p->>'gate_id'), p ? 'gate_id');
    IF g.problem IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'http', 409, 'code', g.problem);
    END IF;
    -- cvf1 T4 : hors de la plage du contrôle, le verdict seul (« contrôle fermé ») : le billet n'est pas lu, ni nom du
    -- porteur, ni numéro, ni catégorie (même règle que la recherche d'invités, finition 1 complément 10)
    v_closed := public.scan_event_problem(v_event);
    IF v_closed IS NOT NULL THEN
        SELECT w.opens_at INTO v_opens FROM public.scan_window(v_event) w;
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
        VALUES (v_scanner, 'CONTROLE', 'MANUAL_LOOKUP', 'tickets', NULL,
                jsonb_build_object('event_id', v_event, 'found', NULL, 'refused', 'CONTROL_CLOSED', 'problem', v_closed,
                                   'ticket_number_hash', v_hash));
        RETURN jsonb_build_object('ok', false, 'http', 409, 'code', 'CONTROL_CLOSED', 'problem', v_closed, 'opens_at', v_opens);
    END IF;

    SELECT tk.id, tk.event_id, tk.ticket_number, tk.status::text AS status, tk.price, tk.payment_id, tk.order_id, tk.user_id,
           tk.transfer_locked, tk.category_id, tk.sale_channel, tk.guest_name, c.name AS category_name, u.first_name, u.last_name
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
    IF v_preview IS NULL AND g.zone_kind = 'CONTROLE' THEN
        -- Lot 9 ter (9t.15) : porte de contrôle (étape 7 bis-zone) : jamais de compostage, ni transfert ni paiement
        IF t.status IN ('VALIDE', 'UTILISE') THEN
            SELECT vz.zone_result, vz.redirect_zones INTO v_zone_result, v_redirect
              FROM public.scan_zone_verdict(v_event, g.zone_id, 'CONTROLE', t.category_id, t.status) vz;
            v_preview := v_zone_result;
        ELSE
            v_preview := CASE t.status
                WHEN 'ANNULE' THEN 'cancelled'
                WHEN 'REMBOURSE' THEN 'refunded'
                WHEN 'REMBOURSEMENT_EN_COURS' THEN 'refunded'
                ELSE 'invalid' END;
        END IF;
    ELSE
        IF v_preview IS NULL THEN
            v_preview := CASE t.status
                WHEN 'VALIDE' THEN NULL
                WHEN 'UTILISE' THEN 'already_used'
                WHEN 'ANNULE' THEN 'cancelled'
                WHEN 'REMBOURSE' THEN 'refunded'
                WHEN 'REMBOURSEMENT_EN_COURS' THEN 'refunded'
                ELSE 'invalid' END;
        END IF;
        -- Lot 9 bis (R19, R44) : étape 7 bis de ticket_scan ; un transfert échu est expiré ici aussi (verrous :
        -- transferts du billet, puis billet).
        IF v_preview IS NULL AND t.transfer_locked THEN
            IF public.ticket_transfers_expire_due(t.id, FALSE) THEN
                v_preview := 'transfer_pending';
            END IF;
        END IF;
        IF v_preview IS NULL AND t.price > 0 THEN
            IF t.payment_id IS NOT NULL THEN
                SELECT status::text INTO v_pay_status FROM public.payments WHERE id = t.payment_id;
            END IF;
            IF v_pay_status IS NULL OR v_pay_status NOT IN ('SUCCESS', 'PARTIAL') THEN
                IF t.order_id IS NOT NULL THEN
                    SELECT payment_status::text INTO v_order_status FROM public.orders WHERE id = t.order_id;
                END IF;
                IF v_order_status IS DISTINCT FROM 'SUCCESS' THEN
                    v_preview := 'payment_required';
                END IF;
            END IF;
        END IF;
        -- Lot 9 ter (9t.15) : porte d'entrée qui n'admet pas la catégorie (étape 8 bis de ticket_scan)
        IF v_preview IS NULL AND g.zone_id IS NOT NULL THEN
            SELECT vz.zone_result, vz.redirect_zones INTO v_zone_result, v_redirect
              FROM public.scan_zone_verdict(v_event, g.zone_id, 'ENTREE', t.category_id, 'VALIDE') vz;
            IF v_zone_result = 'wrong_zone' THEN
                v_preview := 'wrong_zone';
            END IF;
        END IF;
    END IF;
    v_preview := COALESCE(v_preview, 'valid');

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_scanner, 'CONTROLE', 'MANUAL_LOOKUP', 'tickets', t.id,
            jsonb_build_object('event_id', v_event, 'found', true, 'ticket_number_hash', v_hash));
    v_ticket := jsonb_build_object(
        'ticket_number', t.ticket_number,
        -- Lot 9 ter (9t.17) : une invitation sans porteur est « {nom de l'invité} » ou « Invité », pas une vente au guichet
        'holder', CASE WHEN t.user_id IS NULL AND t.sale_channel = 'INVITATION' THEN COALESCE(t.guest_name, 'Invité')
                       WHEN t.user_id IS NULL THEN 'Vente au guichet'
                       ELSE btrim(COALESCE(t.first_name, '') || ' ' || COALESCE(t.last_name, '')) END,
        'category', t.category_name,
        'status', t.status,
        'preview', v_preview);
    IF v_preview IN ('wrong_zone', 'not_entered') THEN
        v_ticket := v_ticket || jsonb_build_object('redirect_zones', COALESCE(v_redirect, '[]'::jsonb));
    END IF;
    RETURN jsonb_build_object('ok', true, 'found', true, 'ticket', v_ticket);
END;
$$;

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
    -- Lot 9 ter (9t.15) : porte annoncée, contexte de porte et verdict de zone
    v_gate_given boolean := p ? 'gate_id';
    v_claimed uuid := public.try_uuid(p->>'gate_id');
    -- Lot 9 quater (E2 : AUD-14) : passage précédent du billet à ce contrôle de zone
    v_zone_last timestamptz;
    v_zone_passes integer;
    g record;
    v_ag record;
    v_zone_result text;
    v_redirect jsonb;
    v_zone jsonb;
    v_gate jsonb;
    v_kind text;
    -- Lot 9 ter (9t.16) : porte du premier compostage
    v_checked_gate text;
    -- Lot 9 ter (9t.17) : transfert d'invitation clos par la liste des invités
    v_invite uuid;
BEGIN
    IF v_method NOT IN ('QR', 'MANUAL', 'GUEST_LIST') THEN
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
            -- Lot 9 ter : une ligne de zone rend son verdict de zone (result NULL)
            v_reply := jsonb_build_object('result', COALESCE(s.result, s.zone_result), 'scan_id', s.id, 'replayed', TRUE,
                                          'consumed', s.consumed_at IS NOT NULL);
            IF s.amount_due IS NOT NULL THEN
                v_reply := v_reply || jsonb_build_object('amount_due', s.amount_due);
            END IF;
            -- Le billet n'est rendu que si la réponse d'origine le rendait (jamais pour un billet introuvable,
            -- d'un autre événement, ou une lecture refusée avant le billet). Lot 9 ter : COALESCE, sinon une ligne de
            -- zone (result NULL) perdrait son billet (NULL NOT IN … vaut NULL).
            -- cvf1 T4 : hors de la plage du contrôle (maintenant, ou au moment de la lecture d'origine), le verdict seul
            IF s.ticket_id IS NOT NULL AND COALESCE(s.result, s.zone_result) NOT IN ('invalid', 'wrong_event', 'dynamic_qr_required', 'manual_entry_refused', 'forbidden',
                                                                                   'event_not_open', 'event_ended', 'event_cancelled', 'event_suspended')
               AND public.scan_event_problem(s.event_id) IS NULL THEN
                SELECT tk.*, c.name AS category_name, c.scan_color, c.entry_instruction, u.first_name, u.last_name,
                       pay.id AS pay_id, pay.is_platform_payment AS pay_platform
                  INTO t
                  FROM public.tickets tk
                  JOIN public.ticket_categories c ON c.id = tk.category_id
                  LEFT JOIN public.users u ON u.id = tk.user_id
                  LEFT JOIN public.payments pay ON pay.id = tk.payment_id
                 WHERE tk.id = s.ticket_id;
                IF FOUND THEN
                    v_info := jsonb_build_object('id', t.id, 'ticket_number', t.ticket_number, 'category', t.category_name,
                                                 'holder', CASE WHEN t.user_id IS NULL AND t.sale_channel = 'INVITATION' THEN COALESCE(t.guest_name, 'Invité')
                                                                WHEN t.user_id IS NULL THEN 'Vente au guichet'
                                                                ELSE btrim(COALESCE(t.first_name, '') || ' ' || COALESCE(t.last_name, '')) END,
                                                 'price', t.price, 'is_manual_entry', s.method = 'MANUAL',
                                                 'checked_in_at', t.checked_in_at,
                                                 'checked_in_by_me', t.checked_in_by IS NOT DISTINCT FROM v_scanner,
                                                 'category_color', t.scan_color,
                                                 'origin', public.ticket_origin(t.sale_channel, t.price, t.pay_id IS NOT NULL AND NOT t.pay_platform),
                                                 'is_guest_list', s.method = 'GUEST_LIST');
                    -- Lot 9 ter (9t.16) : porte du compostage sur « déjà utilisé » et « accès autorisé » ; consigne sur
                    -- l'entrée validée seulement
                    IF COALESCE(s.result, s.zone_result) IN ('already_used', 'zone_ok') THEN
                        SELECT COALESCE(eg.name, NULLIF(btrim(a.entry_point), '')) INTO v_checked_gate
                          FROM public.ticket_scans a LEFT JOIN public.event_gates eg ON eg.id = a.gate_id
                         WHERE a.ticket_id = t.id AND a.accepted;
                        v_info := v_info || jsonb_build_object('checked_in_gate', v_checked_gate);
                    END IF;
                    IF s.result = 'valid' THEN
                        v_info := v_info || jsonb_build_object('entry_instruction', t.entry_instruction);
                    END IF;
                    -- Zone et porte de la ligne d'origine (zone NULL : zone implicite)
                    IF s.zone_id IS NULL THEN
                        v_zone := jsonb_build_object('id', NULL, 'name', 'Entrée', 'kind', 'ENTREE', 'implicit', TRUE);
                        v_kind := NULL;
                    ELSE
                        SELECT jsonb_build_object('id', z.id, 'name', z.name, 'kind', z.kind, 'implicit', FALSE), z.kind
                          INTO v_zone, v_kind
                          FROM public.event_zones z WHERE z.id = s.zone_id;
                    END IF;
                    SELECT jsonb_build_object('id', eg.id, 'name', eg.name) INTO v_gate
                      FROM public.event_gates eg WHERE eg.id = s.gate_id;
                    v_reply := v_reply || jsonb_build_object('ticket', v_info, 'zone', v_zone, 'gate', COALESCE(v_gate, 'null'::jsonb));
                    IF s.zone_result IN ('wrong_zone', 'not_entered') THEN
                        SELECT vz.redirect_zones INTO v_redirect
                          FROM public.scan_zone_verdict(s.event_id, s.zone_id, v_kind, t.category_id,
                                                        CASE WHEN s.zone_result = 'not_entered' OR v_kind = 'ENTREE' THEN 'VALIDE'
                                                             ELSE t.status::text END) vz;
                        v_reply := v_reply || jsonb_build_object('redirect_zones', COALESCE(v_redirect, '[]'::jsonb));
                    END IF;
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
    -- 1 ter bis. Lot 9 ter (9t.15) : porte du scan. Un problème de porte n'écrit aucune ligne ni aucun audit et ne
    --            lit rien du billet : la même clé reste utilisable une fois la porte corrigée (C-D3, C-D4).
    SELECT * INTO g FROM public.scan_gate_context(v_scanner, v_event, v_claimed, v_gate_given);
    IF g.problem IS NOT NULL THEN
        RETURN jsonb_build_object('http', 409, 'code', g.problem);
    END IF;
    v_zone := jsonb_build_object('id', g.zone_id, 'name', g.zone_name, 'kind', g.zone_kind, 'implicit', NOT g.configured);
    v_gate := CASE WHEN g.gate_id IS NULL THEN 'null'::jsonb ELSE jsonb_build_object('id', g.gate_id, 'name', g.gate_name) END;
    -- 2. Refus décidé avant la base (payload qui n'est pas un QR dynamique)
    IF v_pre IS NOT NULL THEN
        v_scan := public.scan_log_at(NULL, v_event, v_scanner, v_pre, NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', v_pre, 'scan_id', v_scan);
    END IF;
    -- 3. Saisie manuelle : périmètre réglé et pièce d'identité vérifiée. Lot 9 ter (9t.17) : même garde pour la
    --    validation par la liste des invités, qui désigne le billet par son identifiant.
    IF v_method IN ('MANUAL', 'GUEST_LIST') THEN
        v_scope := public.fin_setting_text('access.manual_entry_scope');
        IF NOT v_identity
           OR (v_scope = 'ASSIGNED_CONTROLLER' AND NOT EXISTS (
                   SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_scanner)) THEN
            v_scan := public.scan_log_at(NULL, v_event, v_scanner, 'manual_entry_refused', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', 'manual_entry_refused', 'scan_id', v_scan);
        END IF;
        IF v_method = 'MANUAL' THEN
            SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = upper(btrim(p->>'ticket_number'));
        ELSE
            v_ticket_id := public.try_uuid(p->>'ticket_id');
        END IF;
    ELSE
        v_ticket_id := NULLIF(p->>'ticket_id', '')::uuid;
    END IF;
    -- 4. Billet de l'événement (aucune donnée sinon), sous verrou. Lot 9 ter (9t.16) : couleur et consigne de la
    --    catégorie, paiement (origine du billet) lus sans verrou de plus.
    SELECT tk.*, c.name AS category_name, c.scan_color, c.entry_instruction, u.first_name, u.last_name,
           pay.id AS pay_id, pay.is_platform_payment AS pay_platform
      INTO t
      FROM public.tickets tk
      JOIN public.ticket_categories c ON c.id = tk.category_id
      LEFT JOIN public.users u ON u.id = tk.user_id
      LEFT JOIN public.payments pay ON pay.id = tk.payment_id
     WHERE tk.id = v_ticket_id
       FOR UPDATE OF tk;
    IF NOT FOUND THEN
        v_scan := public.scan_log_at(NULL, v_event, v_scanner, 'invalid', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', 'invalid', 'scan_id', v_scan);
    END IF;
    IF t.event_id <> v_event THEN
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'wrong_event', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', 'wrong_event', 'scan_id', v_scan);
    END IF;
    -- Lot 9 ter (9t.17) : la liste des invités ne valide qu'une invitation ; un autre billet désigné par son
    -- identifiant est une requête forgée : ligne invalid sans ticket_id, réponse sans billet
    IF v_method = 'GUEST_LIST' AND t.sale_channel IS DISTINCT FROM 'INVITATION' THEN
        v_scan := public.scan_log_at(NULL, v_event, v_scanner, 'invalid', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', 'invalid', 'scan_id', v_scan);
    END IF;
    v_info := jsonb_build_object('id', t.id, 'ticket_number', t.ticket_number, 'category', t.category_name,
                                 'holder', CASE WHEN t.user_id IS NULL AND t.sale_channel = 'INVITATION' THEN COALESCE(t.guest_name, 'Invité')
                                                WHEN t.user_id IS NULL THEN 'Vente au guichet'
                                                ELSE btrim(COALESCE(t.first_name, '') || ' ' || COALESCE(t.last_name, '')) END, 'price', t.price,
                                 'is_manual_entry', v_method = 'MANUAL',
                                 'category_color', t.scan_color,
                                 'origin', public.ticket_origin(t.sale_channel, t.price, t.pay_id IS NOT NULL AND NOT t.pay_platform),
                                 'is_guest_list', v_method = 'GUEST_LIST');
    -- 5. Code dynamique (calculé hors base avec la clé maître) et version du secret, lus sous le verrou du
    --    billet : une rotation (transfert, annulation, remboursement, régénération) validée avant le verrou
    --    rend le code présenté périmé. Statut d'annulation contrôlé avant la version (D3).
    IF v_method = 'QR' AND (NOT COALESCE((p->>'totp_ok')::boolean, FALSE) OR v_version IS DISTINCT FROM t.security_version) THEN
        v_problem := CASE
            WHEN (SELECT e.status::text FROM public.events e WHERE e.id = v_event) = 'ANNULE' THEN 'event_cancelled'
            WHEN t.status::text = 'ANNULE' THEN 'cancelled'
            WHEN t.status::text IN ('REMBOURSE', 'REMBOURSEMENT_EN_COURS') THEN 'refunded'
            ELSE 'qr_expired' END;
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, v_problem, NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        -- cvf1 T4 : hors de la plage du contrôle, le verdict seul (ni porteur, ni numéro, ni catégorie)
        IF public.scan_event_problem(v_event) IS NOT NULL THEN
            RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'zone', v_zone, 'gate', v_gate);
        END IF;
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
    END IF;
    -- 6. Événement : statut et fenêtre
    v_problem := public.scan_event_problem(v_event);
    IF v_problem IS NOT NULL THEN
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, v_problem, NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        -- cvf1 T4 : hors de la plage du contrôle, le verdict seul (ni porteur, ni numéro, ni catégorie)
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'zone', v_zone, 'gate', v_gate);
    END IF;
    -- Finition 1 (complément 12) : « Toutes les portes » de la propriétaire sur un événement à zones (scan_gate_context rend
    -- configured faux) : la porte retenue est la première porte d'entrée qui admet la catégorie du billet ; l'entrée porte
    -- cette porte et sa zone comme tout autre scan (invariant (x8)). Aucune porte d'entrée ne l'admet : GATE_REQUIRED,
    -- rien d'écrit. Contrôleurs et admins : inchangé (scan_gate_context ne rend configured faux que sans zone).
    IF NOT g.configured AND EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = v_event) THEN
        SELECT eg.id AS gate_id, eg.name AS gate_name, z.id AS zone_id, z.name AS zone_name INTO v_ag
          FROM public.event_gates eg
          JOIN public.event_zones z ON z.id = eg.zone_id
          JOIN public.zone_categories zc ON zc.zone_id = z.id
         WHERE z.event_id = v_event AND z.kind = 'ENTREE' AND zc.category_id = t.category_id
         ORDER BY z.position, lower(btrim(z.name)), lower(btrim(eg.name)), eg.id
         LIMIT 1;
        IF v_ag.gate_id IS NULL THEN
            RETURN jsonb_build_object('http', 409, 'code', 'GATE_REQUIRED');
        END IF;
        g.configured := TRUE;
        g.gate_id := v_ag.gate_id;
        g.gate_name := v_ag.gate_name;
        g.zone_id := v_ag.zone_id;
        g.zone_name := v_ag.zone_name;
        g.zone_kind := 'ENTREE';
        v_zone := jsonb_build_object('id', g.zone_id, 'name', g.zone_name, 'kind', g.zone_kind, 'implicit', FALSE);
        v_gate := jsonb_build_object('id', g.gate_id, 'name', g.gate_name);
    END IF;
    -- 7 bis-zone. Lot 9 ter (9t.15) : porte de CONTRÔLE. Refus rouges du billet d'abord (lignes et réponses de l'étape 7),
    --             puis verdict de zone ; jamais de compostage (ni 7 bis, ni 8, ni 9 : C-D5).
    IF g.zone_kind = 'CONTROLE' THEN
        v_problem := CASE t.status::text
            WHEN 'VALIDE' THEN NULL
            WHEN 'UTILISE' THEN NULL
            WHEN 'ANNULE' THEN 'cancelled'
            WHEN 'REMBOURSE' THEN 'refunded'
            WHEN 'REMBOURSEMENT_EN_COURS' THEN 'refunded'
            ELSE 'invalid' END;
        IF v_problem IS NOT NULL THEN
            v_scan := public.scan_log_at(t.id, v_event, v_scanner, v_problem, NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan,
                                      'ticket', v_info || jsonb_build_object('checked_in_at', t.checked_in_at,
                                                                             'checked_in_by_me', t.checked_in_by IS NOT DISTINCT FROM v_scanner),
                                      'zone', v_zone, 'gate', v_gate);
        END IF;
        SELECT vz.zone_result, vz.redirect_zones INTO v_zone_result, v_redirect
          FROM public.scan_zone_verdict(v_event, g.zone_id, 'CONTROLE', t.category_id, t.status::text) vz;
        IF v_zone_result IS NULL THEN
            RAISE EXCEPTION 'ticket_scan : verdict de zone absent pour le billet % (statut %)', t.id, t.status;
        END IF;
        IF v_zone_result = 'zone_ok' THEN
            -- Lot 9 quater (E2 : AUD-14) : billet déjà passé à ce contrôle de zone. Sans confirmation du contrôleur
            -- (p.confirm_zone_repeat), réponse « zone_already_passed » (écran orange « Déjà passé à {zone} à {heure} »),
            -- aucune ligne écrite ; confirmé (même personne, sortie aux toilettes), le passage est compté (ligne zone_ok).
            SELECT max(a.created_at), count(*)::integer INTO v_zone_last, v_zone_passes
              FROM public.ticket_scans a
             WHERE a.ticket_id = t.id AND a.zone_id = g.zone_id AND a.zone_result = 'zone_ok';
            IF v_zone_passes > 0 AND COALESCE(p->>'confirm_zone_repeat', 'false') <> 'true' THEN
                RETURN jsonb_build_object('result', 'zone_already_passed', 'scan_id', NULL, 'ticket', v_info,
                                          'zone', v_zone, 'gate', v_gate,
                                          'zone_last_pass_at', v_zone_last, 'zone_passes', v_zone_passes);
            END IF;
            -- Lot 9 ter (9t.16) : heure et porte de l'entrée (ligne acceptée, lue sous le verrou du billet)
            SELECT COALESCE(eg.name, NULLIF(btrim(a.entry_point), '')) INTO v_checked_gate
              FROM public.ticket_scans a LEFT JOIN public.event_gates eg ON eg.id = a.gate_id
             WHERE a.ticket_id = t.id AND a.accepted;
            v_scan := public.scan_log_at(t.id, v_event, v_scanner, NULL, v_zone_result, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', v_zone_result, 'scan_id', v_scan,
                                      'ticket', v_info || jsonb_build_object('checked_in_at', t.checked_in_at,
                                                                             'checked_in_by_me', t.checked_in_by IS NOT DISTINCT FROM v_scanner,
                                                                             'checked_in_gate', v_checked_gate),
                                      'zone', v_zone, 'gate', v_gate);
        END IF;
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, NULL, v_zone_result, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', v_zone_result, 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate,
                                  'redirect_zones', COALESCE(v_redirect, '[]'::jsonb));
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
        v_info := v_info || jsonb_build_object('checked_in_at', t.checked_in_at,
                                               'checked_in_by_me', t.checked_in_by IS NOT DISTINCT FROM v_scanner);
        IF v_problem = 'already_used' THEN
            -- Lot 9 ter (9t.16) : « Déjà utilisé à {heure}, {porte} » (ligne acceptée, lue sous le verrou du billet)
            SELECT COALESCE(eg.name, NULLIF(btrim(a.entry_point), '')) INTO v_checked_gate
              FROM public.ticket_scans a LEFT JOIN public.event_gates eg ON eg.id = a.gate_id
             WHERE a.ticket_id = t.id AND a.accepted;
            v_info := v_info || jsonb_build_object('checked_in_gate', v_checked_gate);
        END IF;
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, v_problem, NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
    END IF;
    -- 7 bis. Lot 9 bis (R19, R44) : billet engagé dans un transfert encore en attente → refusé, rien de composté.
    --        Un transfert échu est d'abord expiré ; un transfert tenu par une acceptation est sauté (SKIP LOCKED,
    --        X27) et compte comme en attente. Conditions imbriquées : aucun court-circuit garanti sur AND.
    --        Lot 9 ter (9t.17) : par la liste des invités, le transfert d'invitation du billet (PENDING, ou EXPIRED à la
    --        fin de l'événement alors que le contrôle reste ouvert) est pris sans attente ; un autre transfert en attente
    --        (d'un porteur), ou l'invitation tenue par une acceptation en cours (sautée), refuse transfer_pending.
    IF v_method = 'GUEST_LIST' THEN
        PERFORM public.ticket_transfers_expire_due(t.id, TRUE);
        SELECT x.id INTO v_invite
          FROM public.ticket_transfers x
         WHERE x.ticket_id = t.id AND x.from_user_id IS NULL AND x.status::text IN ('PENDING', 'EXPIRED')
         ORDER BY x.created_at DESC, x.id DESC
         LIMIT 1
           FOR UPDATE SKIP LOCKED;
        IF EXISTS (SELECT 1 FROM public.ticket_transfers x
                    WHERE x.ticket_id = t.id AND x.status = 'PENDING' AND x.id IS DISTINCT FROM v_invite) THEN
            v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'transfer_pending', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', 'transfer_pending', 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
        END IF;
    ELSIF t.transfer_locked THEN
        IF public.ticket_transfers_expire_due(t.id, TRUE) THEN
            v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'transfer_pending', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', 'transfer_pending', 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
        END IF;
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
            IF v_order_status IS DISTINCT FROM 'SUCCESS' THEN
                v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'payment_required', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
                RETURN jsonb_build_object('result', 'payment_required', 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
            END IF;
        END IF;
    END IF;
    -- 8 bis. Lot 9 ter (9t.15) : porte d'ENTRÉE explicite qui n'admet pas la catégorie → mauvaise zone (orange), après
    --        les refus rouges (déjà utilisé, annulé, transfert, paiement : C-D6) ; rien composté.
    IF g.zone_id IS NOT NULL AND g.zone_kind = 'ENTREE' THEN
        SELECT vz.zone_result, vz.redirect_zones INTO v_zone_result, v_redirect
          FROM public.scan_zone_verdict(v_event, g.zone_id, 'ENTREE', t.category_id, 'VALIDE') vz;
        IF v_zone_result = 'wrong_zone' THEN
            v_scan := public.scan_log_at(t.id, v_event, v_scanner, NULL, 'wrong_zone', FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
            RETURN jsonb_build_object('result', 'wrong_zone', 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate,
                                      'redirect_zones', COALESCE(v_redirect, '[]'::jsonb));
        END IF;
    END IF;
    -- 9. Compostage (une seule ligne modifiée, sous verrou). Lot 9 ter (9t.17) : une invitation validée par la liste
    --    est déverrouillée et son transfert clos ADMITTED (claimed_at = now(), heure de la ligne GUEST_LIST) dans la même
    --    transaction ; aucun avis (billet sans porteur).
    UPDATE public.tickets SET status = 'UTILISE', checked_in_at = now(), checked_in_by = v_scanner,
                              transfer_locked = CASE WHEN v_invite IS NOT NULL THEN FALSE ELSE transfer_locked END,
                              updated_at = now()
     WHERE id = t.id AND status = 'VALIDE';
    IF NOT FOUND THEN
        SELECT checked_in_at, checked_in_by INTO v_checked_at, v_checked_by FROM public.tickets WHERE id = t.id;
        SELECT COALESCE(eg.name, NULLIF(btrim(a.entry_point), '')) INTO v_checked_gate
          FROM public.ticket_scans a LEFT JOIN public.event_gates eg ON eg.id = a.gate_id
         WHERE a.ticket_id = t.id AND a.accepted;
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'already_used', NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', 'already_used', 'scan_id', v_scan,
                                  'ticket', v_info || jsonb_build_object('checked_in_at', v_checked_at,
                                                                         'checked_in_by_me', v_checked_by IS NOT DISTINCT FROM v_scanner,
                                                                         'checked_in_gate', v_checked_gate),
                                  'zone', v_zone, 'gate', v_gate);
    END IF;
    IF v_invite IS NOT NULL THEN
        UPDATE public.ticket_transfers SET status = 'ADMITTED', claimed_at = now() WHERE id = v_invite;
    END IF;
    v_scan := public.scan_log_at(t.id, v_event, v_scanner, 'valid', NULL, TRUE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
    RETURN jsonb_build_object('result', 'valid', 'scan_id', v_scan,
                              'ticket', v_info || jsonb_build_object('checked_in_at', now(), 'checked_in_by_me', TRUE,
                                                                     'entry_instruction', t.entry_instruction),
                              'zone', v_zone, 'gate', v_gate);
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_manual_lookup(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ticket_scan(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_manual_lookup(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ticket_scan(jsonb) TO service_role;
