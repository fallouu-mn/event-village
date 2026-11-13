-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUATER : invitations et contrôle d'accès (D2, E1, E2)
-- ============================================================================
-- D2 (AUD-32) : au plus INVITATION_PER_ACCOUNT_DAY numéros invités (50) par compte et par jour, en plus des quotas par
--   événement et par numéro : une unité par numéro sur le compte de l'auteur (limits.per_account_day, 50 par défaut).
-- E1 (AUD-13) : sur la liste des invités, une invitation sans nom ne se trouve que par le numéro COMPLET (9 chiffres ou
--   221 + 9) ; les 4 derniers chiffres ne trouvent que les invitations nommées.
-- E2 (AUD-14) : un billet déjà passé à un contrôle de zone qui s'y présente de nouveau donne « zone_already_passed »
--   (heure du dernier passage, nombre de passages) sans rien écrire ; le contrôleur confirme qu'il s'agit de la même
--   personne (p.confirm_zone_repeat) et le passage est compté (ligne zone_ok, aucune valeur nouvelle dans les contraintes
--   gelées de ticket_scans) ; l'onglet Entrées montre les passages répétés par zone (repeats). Entrée principale :
--   inchangée (ni sortie ni réentrée).
-- Recopies (changement indiqué en commentaire dans chacune) : ticket_invitation_create (20261110000008:262-447),
--   ticket_guest_list_search (20261110000008:58-152), ticket_scan (20261110000009:903-1271), pilotage_compute_entries
--   (20261110000010:162-391). Droits inchangés (CREATE OR REPLACE ; service_role seul).
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. ticket_invitation_create (recopie de 20261110000008_lot9ter_invites.sql:262-447) — D2
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_invitation_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_category uuid := public.try_uuid(p->>'category_id');
    v_phones text[];
    v_quantity integer;
    v_per_event integer;
    v_per_phone integer;
    -- Lot 9 quater (D2 : AUD-32) : numéros invités par compte et par jour
    v_per_account integer;
    v_total integer;
    v_status text;
    a record;
    v_role text;
    v_category_name text;
    v_problems jsonb;
    v_rules jsonb;
    v_quota jsonb;
    v_end timestamptz;
    v_data jsonb;
    v_phone text;
    v_account uuid;
    v_new uuid[];
    v_masked text[] := ARRAY[]::text[];
    v_names_given boolean := COALESCE(jsonb_typeof(p->'guest_names'), 'null') <> 'null';
    v_names text[];
    v_name text;
BEGIN
    -- Étape 1 : forme (le chemin normal passe d'abord par Zod)
    IF v_actor IS NULL OR v_event IS NULL OR v_category IS NULL
       OR jsonb_typeof(p->'phones') IS DISTINCT FROM 'array'
       OR COALESCE(p->>'quantity', '') !~ '^[1-4]$'
       OR COALESCE(p->'limits'->>'per_event_hour', '') !~ '^[0-9]{1,9}$'
       OR COALESCE(p->'limits'->>'per_phone_day', '') !~ '^[0-9]{1,9}$' THEN
        RETURN public.pilotage_refusal('INVALID_INPUT');
    END IF;
    v_phones := ARRAY(SELECT jsonb_array_elements_text(p->'phones'));
    IF cardinality(v_phones) NOT BETWEEN 1 AND 10
       OR EXISTS (SELECT 1 FROM unnest(v_phones) AS x WHERE x IS NULL OR x !~ '^\+2217[05678][0-9]{7}$')
       OR (SELECT count(DISTINCT x) FROM unnest(v_phones) AS x) <> cardinality(v_phones) THEN
        RETURN public.pilotage_refusal('INVALID_INPUT');
    END IF;
    -- Lot 9 ter (9t.17) : noms des invités, un par numéro, contrôlés avant tout verrou et tout quota
    IF v_names_given THEN
        IF jsonb_typeof(p->'guest_names') <> 'array'
           OR jsonb_array_length(p->'guest_names') <> cardinality(v_phones)
           OR EXISTS (SELECT 1 FROM jsonb_array_elements(p->'guest_names') AS g(value)
                       WHERE jsonb_typeof(g.value) NOT IN ('null', 'string')) THEN
            RETURN public.pilotage_refusal('INVALID_INPUT');
        END IF;
        v_names := ARRAY(SELECT NULLIF(btrim(g.value #>> '{}'), '')
                           FROM jsonb_array_elements(p->'guest_names') WITH ORDINALITY AS g(value, ord)
                          ORDER BY g.ord);
        IF EXISTS (SELECT 1 FROM unnest(v_names) AS n WHERE n IS NOT NULL AND (char_length(n) > 60 OR n ~ '[[:cntrl:]]')) THEN
            RETURN public.pilotage_refusal('INVALID_INPUT');
        END IF;
    ELSE
        v_names := array_fill(NULL::text, ARRAY[cardinality(v_phones)]);
    END IF;
    v_quantity := (p->>'quantity')::integer;
    v_per_event := (p->'limits'->>'per_event_hour')::integer;
    v_per_phone := (p->'limits'->>'per_phone_day')::integer;
    v_per_account := CASE WHEN COALESCE(p->'limits'->>'per_account_day', '') ~ '^[0-9]{1,9}$'
                          THEN (p->'limits'->>'per_account_day')::integer ELSE 50 END;
    v_total := cardinality(v_phones) * v_quantity;

    -- Étape 2 : événement verrouillé (FOR SHARE : event_cancel et event_update attendent)
    SELECT e.status::text INTO v_status FROM public.events e WHERE e.id = v_event FOR SHARE;
    IF NOT FOUND THEN
        RETURN public.pilotage_refusal('EVENT_NOT_FOUND');
    END IF;

    -- Étape 3 : droits
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    -- Reste S3 (R2, B30) : event_actor_profile n'appelle plus « staff » qu'un admin muni d'events.write ; un admin
    -- sans cette permission garde le refus 403 FORBIDDEN du lot 9 (invitations:190), jamais un 404.
    IF NOT (a.is_owner OR a.is_staff)
       AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
        RETURN public.pilotage_refusal('EVENT_NOT_FOUND');
    END IF;
    IF NOT a.is_active THEN
        RETURN public.pilotage_refusal('ACCOUNT_NOT_ACTIVE');
    END IF;
    IF NOT a.is_owner
       AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN')
       AND NOT EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = v_actor AND ap.permission = 'events.write') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit d’envoyer des invitations pour cet événement.');
    END IF;
    v_role := CASE WHEN a.is_owner THEN 'PARTENAIRE' ELSE 'ADMIN' END;

    -- Étape 4 : statut, lu sous le verrou
    IF v_status NOT IN ('PUBLIE', 'VALIDE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ACTIVE', 'message', 'Cet événement n’accepte pas d’invitations pour le moment.');
    END IF;

    -- Étape 5 : catégorie de cet événement ; absente, l'étape 6 rend CATEGORY_NOT_FOUND
    SELECT c.name INTO v_category_name FROM public.ticket_categories c
     WHERE c.id = v_category AND c.event_id = v_event FOR UPDATE;

    -- Étape 6 : contrôles de vente en liste blanche, toute catégorie étant admise quels que soient ses canaux
    SELECT COALESCE(jsonb_agg(s.problem ORDER BY s.ord), '[]'::jsonb) INTO v_problems
      FROM jsonb_array_elements(public.ticket_sale_problems(v_event,
               jsonb_build_array(jsonb_build_object('category_id', v_category, 'quantity', v_total)))) WITH ORDINALITY AS s(problem, ord)
     WHERE s.problem->>'code' IN ('INVALID_ITEMS', 'EVENT_NOT_FOUND', 'CATEGORY_NOT_FOUND', 'INVALID_QUANTITY',
                                  'CATEGORY_INACTIVE', 'EVENT_PAST', 'INSUFFICIENT_STOCK');
    IF jsonb_array_length(v_problems) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SALE_CHECK_FAILED', 'message', 'Ces invitations ne peuvent pas être envoyées.', 'problems', v_problems);
    END IF;

    -- Étape 7 : quotas, tout ou rien ; une règle événement et une règle numéro par numéro (L4)
    SELECT jsonb_agg(q.rule) INTO v_rules
      FROM (SELECT jsonb_build_object('scope', 'invitation_event', 'bucket', v_event::text, 'window_secs', 3600, 'max', v_per_event) AS rule
              FROM unnest(v_phones)
            UNION ALL
            SELECT jsonb_build_object('scope', 'invitation_phone', 'bucket', x, 'window_secs', 86400, 'max', v_per_phone)
              FROM unnest(v_phones) AS x
            UNION ALL
            -- Lot 9 quater (D2 : AUD-32) : une unité par numéro invité, sur le compte de l'auteur, par jour
            SELECT jsonb_build_object('scope', 'invitation_account', 'bucket', v_actor::text, 'window_secs', 86400, 'max', v_per_account)
              FROM unnest(v_phones)) q;
    v_quota := public.quota_reserve(v_rules);
    IF NOT COALESCE((v_quota->>'allowed')::boolean, false) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'QUOTA_EXCEEDED', 'message', 'Limite d’invitations atteinte. Réessayez plus tard.',
                                  'scope', v_quota->>'scope', 'retry_after_seconds', (v_quota->>'retry_after_seconds')::integer);
    END IF;

    -- Étape 8 : stock, puis billets numéro par numéro
    UPDATE public.ticket_categories SET sold_quantity = sold_quantity + v_total WHERE id = v_category;
    v_end := public.event_end_at(v_event);
    v_data := COALESCE(public.notif_event_data(v_event), '{}'::jsonb);

    -- Lot 9 ter (9t.17) : numéro et nom de même rang
    FOR i IN 1 .. cardinality(v_phones) LOOP
        v_phone := v_phones[i];
        v_name := v_names[i];
        SELECT u.id INTO v_account
          FROM public.users u
         WHERE u.phone = v_phone AND public.ticket_transfer_identity(v_phone, u.id) = 'MATCH'
         ORDER BY u.id
         LIMIT 1;

        WITH ins AS (
            INSERT INTO public.tickets (event_id, category_id, user_id, ticket_number, price, qr_code, status, sale_channel, transfer_locked, guest_name)
            SELECT v_event, v_category, v_account,
                   'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
                   0, 'EV-QR-' || replace(gen_random_uuid()::text, '-', ''), 'VALIDE', 'INVITATION', v_account IS NULL, v_name
              FROM generate_series(1, v_quantity)
            RETURNING id
        )
        SELECT array_agg(id ORDER BY id) INTO v_new FROM ins;

        IF v_account IS NULL THEN
            INSERT INTO public.ticket_transfers (ticket_id, from_user_id, to_phone_or_email, status, claim_token_hash, expires_at)
            SELECT x, NULL, v_phone, 'PENDING', NULL, v_end FROM unnest(v_new) AS x;
        END IF;

        -- Étape 9 : un SMS par numéro, sans actor_id ni user_id (AR15), hors quota par compte
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'INVITATION_RECEIVED', 'key', 'INVITATION_RECEIVED:' || v_new[1]::text,
            'phone', v_phone, 'event_id', v_event,
            'data', v_data || jsonb_build_object('ticket_count', v_quantity, 'ticket_id', v_new[1]),
            'channels', jsonb_build_array('SMS')));
        -- Lot 9 bis (R79, B78 ; G.49, B97) : billets attribués à un compte vérifié → in-app, push et email au compte,
        -- sans acteur
        IF v_account IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'INVITATION_RECEIVED', 'key', 'INVITATION_RECEIVED:' || v_new[1]::text,
                'user_id', v_account, 'event_id', v_event,
                'data', v_data || jsonb_build_object('ticket_count', v_quantity, 'ticket_id', v_new[1]),
                'channels', jsonb_build_array('IN_APP', 'PUSH', 'EMAIL')));
        END IF;

        v_masked := v_masked || ('+221***' || right(v_phone, 2));
    END LOOP;

    -- Étape 10 : audit, numéros masqués ; lot 9 ter (9t.17) : nombre de numéros nommés, jamais les noms
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, v_role, 'TICKET_INVITATIONS_SENT', 'events', v_event,
            jsonb_build_object('category_id', v_category, 'category', v_category_name, 'phone_count', cardinality(v_phones),
                               'ticket_count', v_total, 'quantity', v_quantity, 'phones_masked', to_jsonb(v_masked))
            || CASE WHEN v_names_given
                    THEN jsonb_build_object('named_count', (SELECT count(*) FROM unnest(v_names) AS n WHERE n IS NOT NULL)::integer)
                    ELSE '{}'::jsonb END);

    RETURN jsonb_build_object('ok', true, 'ticket_count', v_total, 'phone_count', cardinality(v_phones));
END;
$$;


-- ----------------------------------------------------------------------------
-- 2. ticket_guest_list_search (recopie de 20261110000008_lot9ter_invites.sql:58-152) — E1
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_guest_list_search(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_scanner uuid := public.try_uuid(p->>'scanner_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_digits text := regexp_replace(COALESCE(p->>'query', ''), '\D', '', 'g');
    v_kind text;
    v_suffix text;
    v_full text;
    v_max integer;
    v_scope text;
    v_quota jsonb;
    v_items jsonb;
    v_groups integer;
    v_tickets integer;
    v_truncated boolean;
BEGIN
    -- Étape 1 : forme ; aucun quota consommé
    IF v_scanner IS NULL OR v_event IS NULL
       OR COALESCE(p->'limits'->>'per_scanner_hour', '') !~ '^[0-9]{1,9}$' THEN
        RETURN jsonb_build_object('ok', false, 'http', 400, 'code', 'INVALID_INPUT');
    END IF;
    v_max := (p->'limits'->>'per_scanner_hour')::integer;
    IF v_digits ~ '^[0-9]{4}$' THEN
        v_kind := 'LAST4';
        v_suffix := v_digits;
    ELSIF v_digits ~ '^7[05678][0-9]{7}$' THEN
        v_kind := 'FULL';
        v_full := '+221' || v_digits;
    ELSIF v_digits ~ '^2217[05678][0-9]{7}$' THEN
        v_kind := 'FULL';
        v_full := '+' || v_digits;
    ELSE
        RETURN jsonb_build_object('ok', false, 'http', 400, 'code', 'INVALID_INPUT');
    END IF;

    -- Étape 2 : droit sur l'événement et périmètre de la saisie manuelle ; rien révélé, aucun quota
    v_scope := public.fin_setting_text('access.manual_entry_scope');
    IF NOT public.scan_scanner_authorized(v_scanner, v_event)
       OR (v_scope = 'ASSIGNED_CONTROLLER' AND NOT EXISTS (
               SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_scanner)) THEN
        RETURN jsonb_build_object('ok', false, 'http', 403, 'code', 'SCAN_FORBIDDEN');
    END IF;

    -- Étape 3 : quota par contrôleur et par heure (fenêtre fixe)
    v_quota := public.quota_reserve(jsonb_build_array(jsonb_build_object(
        'scope', 'guest_list_search', 'bucket', v_scanner::text, 'window_secs', 3600, 'max', v_max)));
    IF NOT COALESCE((v_quota->>'allowed')::boolean, false) THEN
        RETURN jsonb_build_object('ok', false, 'http', 429, 'code', 'GUEST_LIST_RATE_LIMITED',
                                  'retry_after_seconds', (v_quota->>'retry_after_seconds')::integer);
    END IF;

    -- Étape 4 : lecture sans verrou
    WITH inv AS (
        SELECT t.id, c.id AS category_id, c.name AS category, t.guest_name, x.to_phone_or_email AS phone
          FROM public.tickets t
          JOIN public.ticket_categories c ON c.id = t.category_id
          JOIN LATERAL (SELECT tr.to_phone_or_email FROM public.ticket_transfers tr
                         WHERE tr.ticket_id = t.id AND tr.from_user_id IS NULL AND tr.status::text IN ('PENDING', 'EXPIRED')
                         ORDER BY tr.created_at DESC, tr.id DESC
                         LIMIT 1) x ON TRUE
         WHERE t.event_id = v_event AND t.sale_channel = 'INVITATION' AND t.status::text = 'VALIDE' AND t.user_id IS NULL
           AND CASE WHEN v_kind = 'LAST4' THEN right(x.to_phone_or_email, 4) = v_suffix
                    ELSE x.to_phone_or_email = v_full END
           -- Lot 9 quater (E1 : AUD-13) : une invitation sans nom ne se trouve que par le numéro complet
           AND (v_kind = 'FULL' OR NULLIF(btrim(COALESCE(t.guest_name, '')), '') IS NOT NULL)
    ), grp AS (
        SELECT i.guest_name, i.category, count(*)::integer AS ticket_count, array_agg(i.id ORDER BY i.id) AS ids
          FROM inv i
         GROUP BY i.phone, i.category_id, i.category, i.guest_name
    ), ranked AS (
        SELECT g.guest_name, g.category, g.ticket_count, g.ids,
               row_number() OVER (ORDER BY lower(g.guest_name) NULLS LAST, g.category, g.ids[1]) AS rn
          FROM grp g
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('guest_name', r.guest_name, 'category', r.category,
                                                 'ticket_count', r.ticket_count, 'ticket_ids', to_jsonb(r.ids))
                              ORDER BY r.rn) FILTER (WHERE r.rn <= 10), '[]'::jsonb),
           (count(*) FILTER (WHERE r.rn <= 10))::integer,
           COALESCE(sum(r.ticket_count) FILTER (WHERE r.rn <= 10), 0)::integer,
           count(*) > 10
      INTO v_items, v_groups, v_tickets, v_truncated
      FROM ranked r;

    -- Étape 5 : audit, ni chiffres ni nom (x12)
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_scanner, 'CONTROLE', 'GUEST_LIST_SEARCH', 'events', v_event,
            jsonb_build_object('query_kind', v_kind, 'groups', v_groups, 'tickets', v_tickets, 'truncated', v_truncated));

    RETURN jsonb_build_object('ok', true, 'items', v_items, 'truncated', v_truncated);
END;
$$;


-- ----------------------------------------------------------------------------
-- 3. ticket_scan (recopie de 20261110000009_lot9ter_zones.sql:903-1271) — E2
-- ----------------------------------------------------------------------------
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
            IF s.ticket_id IS NOT NULL AND COALESCE(s.result, s.zone_result) NOT IN ('invalid', 'wrong_event', 'dynamic_qr_required', 'manual_entry_refused', 'forbidden') THEN
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
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
    END IF;
    -- 6. Événement : statut et fenêtre
    v_problem := public.scan_event_problem(v_event);
    IF v_problem IS NOT NULL THEN
        v_scan := public.scan_log_at(t.id, v_event, v_scanner, v_problem, NULL, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key, g.gate_id, g.zone_id);
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'ticket', v_info, 'zone', v_zone, 'gate', v_gate);
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


-- ----------------------------------------------------------------------------
-- 4. pilotage_compute_entries (recopie de 20261110000010_lot9ter_pilotage.sql:162-391) — E2, passages répétés
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pilotage_compute_entries(p_event uuid, p_with_names boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_configured boolean;
    v_views jsonb;
    v_guests jsonb;
BEGIN
    v_configured := EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = p_event);

    -- Origine du billet d'une ligne lue par jointure sur les tables, par la seule clé primaire de tickets (une
    -- condition sur tk.event_id dans la jointure faisait choisir l'index par événement, relu pour chaque ligne) et
    -- de payments, et non par jointure entre les deux CTE : sous une estimation d'une ligne (billets insérés depuis la dernière
    -- analyse), le planificateur joignait s et k par boucle imbriquée, refaite pour chacune des 4 origines
    -- (25 millions de comparaisons pour 5 000 entrées, 7,8 s au run 132 ; 9t.18 T6).
    WITH s AS MATERIALIZED (
        SELECT sc.id, sc.ticket_id, sc.category_id, sc.gate_id, sc.zone_id, sc.entry_point, sc.accepted, sc.method,
               sc.result, sc.zone_result, sc.created_at,
               public.scan_is_refusal(sc.accepted, sc.result, sc.zone_result, sc.consumed_at) AS refused,
               CASE WHEN tk.event_id = p_event THEN
                   public.ticket_origin(tk.sale_channel, tk.price, pay.id IS NOT NULL AND NOT pay.is_platform_payment)
               END AS origin
          FROM public.ticket_scans sc
          LEFT JOIN public.tickets tk ON tk.id = sc.ticket_id
          LEFT JOIN public.payments pay ON pay.id = tk.payment_id
         WHERE sc.event_id = p_event
    ), k AS MATERIALIZED (
        SELECT tk.id, tk.category_id, tk.status::text AS status,
               tk.status::text IN ('VALIDE', 'UTILISE') AS expected,
               public.ticket_origin(tk.sale_channel, tk.price, pay.id IS NOT NULL AND NOT pay.is_platform_payment) AS origin
          FROM public.tickets tk
          LEFT JOIN public.payments pay ON pay.id = tk.payment_id
         WHERE tk.event_id = p_event
    ), t AS (
        SELECT count(*) FILTER (WHERE s.accepted) AS total,
               count(*) FILTER (WHERE s.accepted AND s.method = 'COUNTER') AS counter,
               count(*) FILTER (WHERE s.accepted AND s.method = 'GUEST_LIST') AS guest_list,
               count(*) FILTER (WHERE s.refused) AS refused,
               count(DISTINCT s.ticket_id) FILTER (WHERE s.zone_result = 'zone_ok') AS zone_checks
          FROM s
    ), sz AS (
        SELECT s.zone_id,
               count(*) FILTER (WHERE s.accepted) AS entered,
               count(DISTINCT s.ticket_id) FILTER (WHERE s.zone_result = 'zone_ok') AS checked,
               -- Lot 9 quater (E2) : passages confirmés au-delà du premier, billet par billet
               count(*) FILTER (WHERE s.zone_result = 'zone_ok')
                 - count(DISTINCT s.ticket_id) FILTER (WHERE s.zone_result = 'zone_ok') AS repeats,
               count(*) FILTER (WHERE s.refused) AS refused
          FROM s
         GROUP BY s.zone_id
    ), kz AS (
        -- billets comptés par catégorie avant la jointure aux zones (aucune boucle billet × zone_categories)
        SELECT zc.zone_id,
               sum(kc.expected_all)::bigint AS expected_all,
               sum(kc.expected_used)::bigint AS expected_used
          FROM (SELECT k.category_id,
                       count(*) FILTER (WHERE k.expected) AS expected_all,
                       count(*) FILTER (WHERE k.status = 'UTILISE') AS expected_used
                  FROM k
                 GROUP BY k.category_id) kc
          JOIN public.zone_categories zc ON zc.event_id = p_event AND zc.category_id = kc.category_id
         GROUP BY zc.zone_id
    ), zones AS (
        SELECT 0 AS part, z.position AS zpos, lower(z.name) AS zname, z.id AS zid,
               jsonb_build_object(
                   'zone_id', z.id,
                   'name', z.name,
                   'kind', z.kind,
                   'implicit', FALSE,
                   'expected', CASE WHEN z.kind = 'ENTREE' THEN COALESCE(kz.expected_all, 0) ELSE COALESCE(kz.expected_used, 0) END,
                   'entered', CASE WHEN z.kind = 'ENTREE' THEN COALESCE(sz.entered, 0) END,
                   'checked', CASE WHEN z.kind = 'CONTROLE' THEN COALESCE(sz.checked, 0) END,
                   'repeats', CASE WHEN z.kind = 'CONTROLE' THEN COALESCE(sz.repeats, 0) END,
                   'refused', COALESCE(sz.refused, 0)) AS line
          FROM public.event_zones z
          LEFT JOIN sz ON sz.zone_id = z.id
          LEFT JOIN kz ON kz.zone_id = z.id
         WHERE z.event_id = p_event
        UNION ALL
        SELECT 1, 0, '', NULL::uuid,
               jsonb_build_object(
                   'zone_id', NULL::uuid,
                   'name', 'Zone non précisée',
                   'kind', NULL::text,
                   'implicit', FALSE,
                   'expected', NULL::bigint,
                   'entered', sz.entered,
                   'checked', NULL::bigint,
                   'refused', sz.refused)
          FROM sz
         WHERE sz.zone_id IS NULL AND sz.entered > 0
    ), sg AS (
        SELECT s.gate_id,
               count(*) FILTER (WHERE s.accepted) AS accepted,
               count(*) FILTER (WHERE s.refused) AS refused
          FROM s
         WHERE s.gate_id IS NOT NULL
         GROUP BY s.gate_id
    ), gates AS (
        SELECT z.position AS zpos, lower(z.name) AS zname, lower(g.name) AS gname, g.id AS gid,
               jsonb_build_object(
                   'gate_key', g.id::text,
                   'gate_id', g.id,
                   'name', g.name,
                   'zone_id', z.id,
                   'zone_name', z.name,
                   'accepted', COALESCE(sg.accepted, 0),
                   'refused', COALESCE(sg.refused, 0),
                   'controllers_assigned', (SELECT count(*) FROM public.event_controllers ec
                                             WHERE ec.event_id = p_event AND ec.gate_id = g.id)) AS line
          FROM public.event_gates g
          JOIN public.event_zones z ON z.id = g.zone_id
          LEFT JOIN sg ON sg.gate_id = g.id
         WHERE g.event_id = p_event
    ), eps AS (
        SELECT u.ep, sum(u.accepted) AS accepted, sum(u.refused) AS refused
          FROM (
              SELECT s.entry_point AS ep,
                     count(*) FILTER (WHERE s.accepted) AS accepted,
                     count(*) FILTER (WHERE s.refused) AS refused
                FROM s
               WHERE s.gate_id IS NULL
               GROUP BY s.entry_point
              UNION ALL
              SELECT DISTINCT ec.entry_point, 0::bigint, 0::bigint
                FROM public.event_controllers ec
               WHERE ec.event_id = p_event AND ec.gate_id IS NULL AND ec.entry_point IS NOT NULL
          ) u
         GROUP BY u.ep
    ), quarters AS (
        SELECT date_bin(interval '15 minutes', s.created_at AT TIME ZONE 'Africa/Dakar', timestamp '2000-01-01 00:00:00') AS q,
               count(*) FILTER (WHERE s.accepted) AS accepted,
               count(*) FILTER (WHERE s.refused) AS refused
          FROM s
         GROUP BY 1
    ), reasons AS (
        SELECT COALESCE(s.result, s.zone_result) AS result, count(*) AS n
          FROM s
         WHERE s.refused
         GROUP BY 1
    )
    SELECT jsonb_build_object(
               'configured', v_configured,
               'totals', jsonb_build_object('total', t.total, 'counter', t.counter, 'guest_list', t.guest_list,
                                            'refused', t.refused, 'zone_checks', t.zone_checks),
               'by_zone', CASE WHEN v_configured THEN
                              COALESCE((SELECT jsonb_agg(zones.line ORDER BY zones.part, zones.zpos, zones.zname, zones.zid) FROM zones), '[]'::jsonb)
                          ELSE jsonb_build_array(jsonb_build_object(
                              'zone_id', NULL::uuid,
                              'name', 'Entrée',
                              'kind', 'ENTREE',
                              'implicit', TRUE,
                              'expected', (SELECT count(*) FROM k WHERE k.expected),
                              'entered', t.total,
                              'checked', NULL::bigint,
                              'refused', t.refused)) END,
               'by_gate', COALESCE((SELECT jsonb_agg(gates.line ORDER BY gates.zpos, gates.zname, gates.gname, gates.gid) FROM gates), '[]'::jsonb)
                       || COALESCE((SELECT jsonb_agg(jsonb_build_object(
                                        'gate_key', 'ep:' || COALESCE(eps.ep, ''),
                                        'gate_id', NULL::uuid,
                                        'name', eps.ep,
                                        'zone_id', NULL::uuid,
                                        'zone_name', NULL::text,
                                        'accepted', eps.accepted,
                                        'refused', eps.refused,
                                        'controllers_assigned', (SELECT count(*) FROM public.event_controllers ec
                                                                  WHERE ec.event_id = p_event AND ec.gate_id IS NULL
                                                                    AND ec.entry_point IS NOT DISTINCT FROM eps.ep))
                                    ORDER BY eps.accepted DESC, eps.ep NULLS LAST) FROM eps), '[]'::jsonb),
               'by_category', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object('category_id', c.id, 'name', c.name,
                                                       'expected', COALESCE(ke.n, 0), 'accepted', COALESCE(ka.n, 0))
                                    ORDER BY c.created_at, c.name, c.id)
                     FROM public.ticket_categories c
                     LEFT JOIN (SELECT k.category_id, count(*) AS n FROM k WHERE k.expected GROUP BY k.category_id) ke ON ke.category_id = c.id
                     LEFT JOIN (SELECT s.category_id, count(*) AS n FROM s WHERE s.accepted GROUP BY s.category_id) ka ON ka.category_id = c.id
                    WHERE c.event_id = p_event), '[]'::jsonb),
               'by_origin', (
                   SELECT jsonb_agg(jsonb_build_object(
                              'origin', o.origin,
                              'label', public.ticket_origin_label(o.origin),
                              'expected', COALESCE(ko.n, 0),
                              'entered', COALESCE(so.n, 0))
                          ORDER BY o.ord)
                     FROM (VALUES ('ONLINE', 1), ('COUNTER', 2), ('FREE', 3), ('INVITATION', 4)) AS o(origin, ord)
                     LEFT JOIN (SELECT k.origin, count(*) AS n FROM k WHERE k.expected GROUP BY k.origin) ko ON ko.origin = o.origin
                     LEFT JOIN (SELECT s.origin, count(*) AS n FROM s WHERE s.accepted AND s.origin IS NOT NULL GROUP BY s.origin) so
                            ON so.origin = o.origin),
               'by_quarter', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object('start', quarters.q AT TIME ZONE 'Africa/Dakar', 'accepted', quarters.accepted,
                                                       'refused', quarters.refused)
                                    ORDER BY quarters.q)
                     FROM quarters), '[]'::jsonb),
               'refusals_by_reason', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object('result', reasons.result, 'label', public.pilotage_scan_result_label(reasons.result),
                                                       'count', reasons.n)
                                    ORDER BY reasons.n DESC, reasons.result)
                     FROM reasons), '[]'::jsonb),
               'guest_list_count', t.guest_list)
      INTO v_views
      FROM t;

    -- Validations par la liste des invités (200 dernières) ; le nom de l'invité à la seule propriétaire
    SELECT COALESCE(jsonb_agg(x.line ORDER BY x.at DESC, x.id DESC), '[]'::jsonb)
      INTO v_guests
      FROM (
          SELECT sc.id, sc.created_at AS at,
                 jsonb_build_object(
                     'scan_id', sc.id,
                     'at', sc.created_at,
                     'category', c.name,
                     'gate', COALESCE(g.name, sc.entry_point),
                     'zone', z.name,
                     'controller', COALESCE(public.pilotage_display_name(u.first_name, u.last_name), 'Compte sans nom'),
                     'guest_name', CASE WHEN p_with_names THEN tk.guest_name END) AS line
            FROM public.ticket_scans sc
            LEFT JOIN public.tickets tk ON tk.id = sc.ticket_id
            LEFT JOIN public.ticket_categories c ON c.id = COALESCE(sc.category_id, tk.category_id)
            LEFT JOIN public.event_gates g ON g.id = sc.gate_id
            LEFT JOIN public.event_zones z ON z.id = sc.zone_id
            LEFT JOIN public.users u ON u.id = sc.scanner_id
           WHERE sc.event_id = p_event AND sc.accepted AND sc.method = 'GUEST_LIST'
           ORDER BY sc.created_at DESC, sc.id DESC
           LIMIT 200
      ) x;

    RETURN (v_views - 'guest_list_count')
        || jsonb_build_object('guest_list', jsonb_build_object('count', v_views->'guest_list_count', 'items', v_guests));
END;
$$;
