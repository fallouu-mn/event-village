-- ============================================================================
-- EVENT VILLAGE — LOT 9 TER : invités (contrat 3.1 n° 08, 3.4 F21 à F26, C.3.3 ; tâche 9t.17, consigne 3)
-- ============================================================================
-- Gratuits et invitations à la porte : nom de l'invité saisi par l'organisateur, liste des invités consultée par le
-- contrôleur, invitation validée à la porte avant toute réclamation (transfert ADMITTED, valeur posée seule par
-- 20261110000003_lot9ter_transfert_statut.sql), puis rattachée au compte de l'invité qui s'inscrit.
-- Rejouable : aucun BEGIN ni COMMIT ; ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS puis ADD, CREATE OR REPLACE,
-- privilèges réappliqués. DDL avant toute fonction ; aucune donnée reprise.
--  1. tickets.guest_name (texte, 1 à 60 caractères, INVITATION seulement, tickets_guest_name_chk) : jamais accordée à
--     anon ni authenticated (tickets est en privilèges de colonne, 20261102000006_lot5_temps_reel.sql:483-506 :
--     la colonne naît illisible par REST et Realtime).
--  2. ticket_transfers_admitted_chk : un transfert ADMITTED est une invitation (sans expéditeur) close avec claimed_at.
--  3. ticket_scans_method_check élargie à GUEST_LIST (posée seulement par 20261102000002_lot5_dette.sql:80, jamais
--     rejouée ; la branche GUEST_LIST de ticket_scan est écrite par 20261110000009_lot9ter_zones.sql, S-Z).
--  4. ticket_guest_list_search (nouvelle, F21) : recherche du contrôleur par 4 derniers chiffres ou numéro complet,
--     quota guest_list_search par contrôleur et par heure, audit GUEST_LIST_SEARCH sans chiffre ni nom.
--  5. ticket_invitation_guest_name_set (nouvelle, F22) : nom d'une invitation VALIDE, par billet, audit sans nom.
--  6. Recopies (une seule dans le lot, signature et type de retour identiques) :
--     F23 ticket_invitation_create  (base 20261109000009_lot9bis_messages.sql:1388-1547) : guest_names par numéro ;
--     F24 ticket_invitations_list   (base 20261109000008_lot9bis_cycle.sql:1697-1749)   : clé guest_name ;
--     F25 ticket_transfer_accept    (base 20261109000008_lot9bis_cycle.sql:1578-1688)   : rattachement d'un ADMITTED ;
--     F26 ticket_transfers_incoming (base 20261109000008_lot9bis_cycle.sql:2445-2500)   : ADMITTED listé, used.
-- Verrous (contrat 3.3) : F21 quota_counters puis lectures sans verrou ; F22 événement FOR SHARE puis billet FOR
-- UPDATE (même billet que le compostage : les deux se suivent) ; F25 événement, transfert, puis billet (inchangé).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- (1) DDL : nom de l'invité, transfert ADMITTED, méthode GUEST_LIST
-- ----------------------------------------------------------------------------
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS guest_name text;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_guest_name_chk;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_guest_name_chk CHECK (
    guest_name IS NULL OR (sale_channel = 'INVITATION' AND char_length(guest_name) BETWEEN 1 AND 60
                           AND guest_name = btrim(guest_name) AND guest_name !~ '[[:cntrl:]]'));
REVOKE SELECT (guest_name) ON TABLE public.tickets FROM anon, authenticated;   -- sans effet aujourd'hui, explicite
COMMENT ON COLUMN public.tickets.guest_name IS
    'Lot 9 ter (consigne 3) : nom de l''invité saisi par l''organisateur (INVITATION seulement). Jamais accordée à anon ni authenticated (REST et Realtime) : servie par ticket_invitations_list à la propriétaire et par ticket_guest_list_search (30 recherches par heure) au contrôleur.';

ALTER TABLE public.ticket_transfers DROP CONSTRAINT IF EXISTS ticket_transfers_admitted_chk;
ALTER TABLE public.ticket_transfers ADD CONSTRAINT ticket_transfers_admitted_chk
    CHECK (status <> 'ADMITTED' OR (claimed_at IS NOT NULL AND from_user_id IS NULL));

ALTER TABLE public.ticket_scans DROP CONSTRAINT IF EXISTS ticket_scans_method_check;
ALTER TABLE public.ticket_scans ADD CONSTRAINT ticket_scans_method_check CHECK (method IN ('QR', 'MANUAL', 'COUNTER', 'GUEST_LIST'));


-- ----------------------------------------------------------------------------
-- (2) F21 ticket_guest_list_search (nouvelle)
-- ----------------------------------------------------------------------------
-- p = { scanner_id, event_id, query, limits: { per_scanner_hour } } → { ok, items, truncated }.
-- Ordre : forme (aucun quota), droit (scan_scanner_authorized et access.manual_entry_scope, comme ticket_manual_lookup ;
-- rien révélé, aucun quota), quota, lecture sans verrou, audit. Invitations VALIDE sans porteur dont le dernier
-- transfert d'invitation PENDING ou EXPIRED vise le numéro (4 derniers chiffres, ou numéro complet sous la forme
-- 9 chiffres ou 221 + 9 chiffres) ; groupe = (numéro, catégorie, nom) rendu sans numéro { guest_name, category,
-- ticket_count, ticket_ids triés } ; tri nom (sans casse, sans nom en dernier), catégorie, premier identifiant ;
-- 10 groupes au plus, truncated s'il en existe un onzième. Jamais de numéro, même masqué.
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

REVOKE ALL ON FUNCTION public.ticket_guest_list_search(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_guest_list_search(jsonb) TO service_role;


-- ----------------------------------------------------------------------------
-- (3) F22 ticket_invitation_guest_name_set (nouvelle)
-- ----------------------------------------------------------------------------
-- p = { actor_id, event_id, ticket_id, guest_name } → { ok, ticket_id, guest_name }. Nom absent, JSON null ou vide :
-- retiré. Droits de ticket_invitation_create (propriétaire, SUPERADMIN, ADMIN avec events.write ; tiers : 404).
-- Billet INVITATION de l'événement, VALIDE seulement ; ni user_id ni status touchés (aucune rotation du secret).
CREATE OR REPLACE FUNCTION public.ticket_invitation_guest_name_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_ticket uuid := public.try_uuid(p->>'ticket_id');
    v_name text;
    v_status text;
    a record;
    v_role text;
    t record;
    v_changed boolean;
BEGIN
    -- Étape 1 : forme (le chemin normal passe d'abord par Zod)
    IF v_actor IS NULL OR v_event IS NULL OR v_ticket IS NULL
       OR COALESCE(jsonb_typeof(p->'guest_name'), 'null') NOT IN ('null', 'string') THEN
        RETURN public.pilotage_refusal('INVALID_INPUT');
    END IF;
    v_name := NULLIF(btrim(p->>'guest_name'), '');
    IF v_name IS NOT NULL AND char_length(v_name) > 60 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'field', 'guest_name',
                                  'message', 'Le nom de l’invité ne doit pas dépasser 60 caractères.');
    END IF;
    IF v_name IS NOT NULL AND v_name ~ '[[:cntrl:]]' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'field', 'guest_name',
                                  'message', 'Le nom de l’invité contient un caractère non permis.');
    END IF;

    -- Étape 2 : événement verrouillé (FOR SHARE, comme ticket_invitation_create)
    SELECT e.status::text INTO v_status FROM public.events e WHERE e.id = v_event FOR SHARE;
    IF NOT FOUND THEN
        RETURN public.pilotage_refusal('EVENT_NOT_FOUND');
    END IF;

    -- Étape 3 : droits (bloc de ticket_invitation_create)
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
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
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit de modifier les invitations de cet événement.');
    END IF;
    v_role := CASE WHEN a.is_owner THEN 'PARTENAIRE' ELSE 'ADMIN' END;

    -- Étape 4 : billet d'invitation de cet événement, verrouillé (le compostage tient le même billet)
    SELECT tk.id, tk.status::text AS status INTO t
      FROM public.tickets tk
     WHERE tk.id = v_ticket AND tk.event_id = v_event AND tk.sale_channel = 'INVITATION'
       FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;

    -- Étape 5 : seule une invitation VALIDE se renomme
    IF t.status = 'UTILISE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_ALREADY_USED', 'message', 'Ce billet a déjà été utilisé : le nom ne peut plus être modifié.');
    END IF;
    IF t.status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_EDITABLE', 'message', 'Cette invitation ne peut plus être modifiée.');
    END IF;

    -- Étape 6 : nom seul (ni user_id ni status : trg_tickets_secret_guard n'est pas déclenché)
    UPDATE public.tickets SET guest_name = v_name, updated_at = now()
     WHERE id = v_ticket AND guest_name IS DISTINCT FROM v_name;
    v_changed := FOUND;

    -- Étape 7 : audit, jamais le nom (x12)
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, v_role, 'TICKET_INVITATION_GUEST_NAMED', 'tickets', v_ticket,
            jsonb_build_object('event_id', v_event, 'named', v_name IS NOT NULL, 'changed', v_changed));

    RETURN jsonb_build_object('ok', true, 'ticket_id', v_ticket, 'guest_name', v_name);
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_invitation_guest_name_set(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_invitation_guest_name_set(jsonb) TO service_role;


-- ----------------------------------------------------------------------------
-- (4) F23 ticket_invitation_create (recopie, 20261109000009_lot9bis_messages.sql:1388-1547)
-- ----------------------------------------------------------------------------
-- Lot 9 ter (9t.17) : p->'guest_names' facultatif (absent ou null : aucun nom), sinon tableau de même longueur que
-- phones, élément null ou chaîne, espaces ôtés, vide → sans nom, 60 caractères au plus, sans caractère de contrôle ;
-- refus INVALID_INPUT avant tout verrou et tout quota. Chaque billet d'un numéro reçoit son nom. Audit : named_count
-- ajouté quand guest_names est fourni (un envoi sans noms garde l'audit d'aujourd'hui). Le nom n'entre jamais dans
-- template_data (x12). Tout le reste à l'identique (verrous, quotas, SMS, réponse).
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
              FROM unnest(v_phones) AS x) q;
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

REVOKE ALL ON FUNCTION public.ticket_invitation_create(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_invitation_create(jsonb) TO service_role;


-- ----------------------------------------------------------------------------
-- (5) F24 ticket_invitations_list (recopie, 20261109000008_lot9bis_cycle.sql:1697-1749)
-- ----------------------------------------------------------------------------
-- p = { actor_id, event_id, page }. Lecture par pilotage_access, 50 par page, plus récentes d'abord.
-- Ni numéro de billet, ni QR, ni état « en attente » : même ligne avec ou sans compte. Lot 9 bis (R46) : invitation
-- refusée par son destinataire → « Refusée ». Lot 9 ter (9t.17) : clé guest_name (null sans nom), servie à la
-- propriétaire et aux admins qui lisent la liste ; jamais au journal ni dans un message.
CREATE OR REPLACE FUNCTION public.ticket_invitations_list(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_page integer := CASE WHEN COALESCE(p->>'page', '') ~ '^[0-9]{1,6}$' THEN GREATEST((p->>'page')::integer, 1) ELSE 1 END;
    v_page_size CONSTANT integer := 50;
    v_code text;
    v_items jsonb;
    v_total integer;
BEGIN
    v_code := public.pilotage_access(v_event, v_actor);
    IF v_code IS NOT NULL THEN
        RETURN public.pilotage_refusal(v_code);
    END IF;

    SELECT count(*) INTO v_total FROM public.tickets t WHERE t.event_id = v_event AND t.sale_channel = 'INVITATION';

    SELECT COALESCE(jsonb_agg(r.item ORDER BY r.created_at DESC, r.id DESC), '[]'::jsonb) INTO v_items
      FROM (
          SELECT t.id, t.created_at,
                 jsonb_build_object(
                     'ticket_id', t.id,
                     'category', c.name,
                     'created_at', t.created_at,
                     'price', t.price,
                     'channel', 'Invitation',
                     'status_label', CASE WHEN t.status::text = 'VALIDE' THEN 'Envoyée'
                                          WHEN t.status::text = 'UTILISE' THEN 'Entrée validée'
                                          WHEN x.status::text = 'DECLINED' THEN 'Refusée'
                                          ELSE 'Annulée' END,
                     'phone_masked', CASE WHEN COALESCE(x.to_phone_or_email, u.phone) IS NOT NULL
                                          THEN '+221***' || right(COALESCE(x.to_phone_or_email, u.phone), 2) END,
                     'can_cancel', t.status::text = 'VALIDE',
                     'guest_name', t.guest_name) AS item
            FROM public.tickets t
            JOIN public.ticket_categories c ON c.id = t.category_id
            LEFT JOIN public.users u ON u.id = t.user_id
            LEFT JOIN LATERAL (SELECT tr.to_phone_or_email, tr.status FROM public.ticket_transfers tr
                                WHERE tr.ticket_id = t.id AND tr.from_user_id IS NULL
                                ORDER BY tr.created_at LIMIT 1) x ON TRUE
           WHERE t.event_id = v_event AND t.sale_channel = 'INVITATION'
           ORDER BY t.created_at DESC, t.id DESC
           LIMIT v_page_size OFFSET (v_page - 1) * v_page_size
      ) r;

    RETURN jsonb_build_object('ok', true, 'items', v_items, 'page', v_page, 'page_size', v_page_size, 'total_count', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_invitations_list(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_invitations_list(jsonb) TO service_role;


-- ----------------------------------------------------------------------------
-- (6) F25 ticket_transfer_accept (recopie, 20261109000008_lot9bis_cycle.sql:1578-1688)
-- ----------------------------------------------------------------------------
-- Lot 9 ter (9t.17) : une invitation déjà validée à la porte par la liste des invités (transfert ADMITTED, billet
-- UTILISE sans porteur) est rattachée au compte qui la réclame : billet et transfert reçoivent le compte, numéro et
-- QR inchangés (trg_tickets_secret_guard avance security_version), aucun avis ; réponse already_used = vrai. Mêmes
-- refus et même ordre qu'un transfert PENDING (identité d'abord : un tiers reçoit TRANSFER_NOT_FOUND). Les
-- transferts PENDING suivent le chemin d'avant, réponse + already_used = faux.
CREATE OR REPLACE FUNCTION public.ticket_transfer_accept(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transfer uuid := public.try_uuid(p->>'transfer_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    tr record;
    v_identity text;
    v_claim jsonb;
    v_ticket uuid;
    v_event uuid;
    v_event_status text;
    v_title text;
    v_data jsonb;
    v_claimed_at timestamptz;
    v_number text;
BEGIN
    IF v_transfer IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande incomplète.');
    END IF;

    -- Lot 7 (D20) : l'événement du billet est verrouillé (FOR SHARE) avant le transfert. Le billet d'un
    -- transfert et l'événement d'un billet ne changent jamais : la lecture sans verrou suffit pour les trouver.
    SELECT x.ticket_id INTO v_ticket FROM public.ticket_transfers x WHERE x.id = v_transfer;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_FOUND', 'message', 'Ce transfert est introuvable.');
    END IF;
    SELECT t.event_id INTO v_event FROM public.tickets t WHERE t.id = v_ticket;
    SELECT ev.status::text INTO v_event_status FROM public.events ev WHERE ev.id = v_event FOR SHARE;

    SELECT * INTO tr FROM public.ticket_transfers WHERE id = v_transfer FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_FOUND', 'message', 'Ce transfert est introuvable.');
    END IF;
    v_identity := public.ticket_transfer_identity(tr.to_phone_or_email, v_actor);
    IF v_identity = 'PHONE_NOT_VERIFIED' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PHONE_NOT_VERIFIED', 'message', 'Confirmez d''abord votre numéro par un code SMS.');
    END IF;
    IF v_identity IS DISTINCT FROM 'MATCH' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_FOUND', 'message', 'Ce transfert est introuvable.');
    END IF;
    -- Lot 9 ter (9t.17) : invitation validée par la liste des invités, pas encore rattachée à un compte
    IF tr.status::text = 'ADMITTED' THEN
        IF tr.to_user_id IS NOT NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_PENDING', 'message', 'Ce transfert n''est plus en attente.');
        END IF;
        IF tr.expires_at <= now() THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_EXPIRED', 'message', 'Ce billet ne peut plus être accepté : le délai est dépassé.');
        END IF;
        IF v_event_status IS NULL OR v_event_status NOT IN ('PUBLIE', 'VALIDE') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ACTIVE', 'message', 'Cet événement n''accepte plus de transfert.');
        END IF;
        -- Ordre des verrous : événement, transfert, puis billet. Le billet d'abord : un billet déjà rattaché ne laisse
        -- aucune écriture derrière lui (x11 : porteur du billet = destinataire du transfert ADMITTED).
        PERFORM 1 FROM public.tickets WHERE id = tr.ticket_id FOR UPDATE;
        UPDATE public.tickets SET user_id = v_actor, updated_at = now() WHERE id = tr.ticket_id AND user_id IS NULL;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_PENDING', 'message', 'Ce transfert n''est plus en attente.');
        END IF;
        UPDATE public.ticket_transfers SET to_user_id = v_actor WHERE id = tr.id AND to_user_id IS NULL;
        SELECT t.ticket_number, e.title INTO v_number, v_title
          FROM public.tickets t JOIN public.events e ON e.id = t.event_id
         WHERE t.id = tr.ticket_id;
        RETURN jsonb_build_object('ok', true, 'transfer_id', tr.id, 'ticket_id', tr.ticket_id,
                                  'ticket_number', v_number, 'event_title', v_title,
                                  'claimed_at', tr.claimed_at, 'already_used', true);
    END IF;
    IF tr.status::text <> 'PENDING' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_PENDING', 'message', 'Ce transfert n''est plus en attente.');
    END IF;
    IF tr.expires_at <= now() THEN
        -- Lot 9 bis (R44) : le transfert échu est expiré pour de bon (billet rendu à l'expéditeur, avis du cron)
        PERFORM public.ticket_transfers_expire_due(tr.ticket_id, FALSE);
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_EXPIRED', 'message', 'Ce billet ne peut plus être accepté : le délai est dépassé.');
    END IF;
    IF tr.from_user_id = v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SELF_TRANSFER', 'message', 'Vous êtes déjà le propriétaire de ce billet.');
    END IF;
    -- Lot 7 (D20) : statut lu sous le verrou FOR SHARE pris plus haut. Contrôlé après l'identité (aucune
    -- fuite d'existence) et après l'état du transfert (un transfert révoqué par l'annulation reste
    -- TRANSFER_NOT_PENDING, comme au lot 6).
    IF v_event_status IS NULL OR v_event_status NOT IN ('PUBLIE', 'VALIDE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ACTIVE', 'message', 'Cet événement n''accepte plus de transfert.');
    END IF;

    v_claim := public.ticket_transfer_claim(tr.id, v_actor);
    IF NOT COALESCE((v_claim->>'ok')::boolean, false) THEN
        RETURN jsonb_build_object('ok', false, 'code', COALESCE(v_claim->>'code', 'TICKET_NOT_TRANSFERABLE'),
            'message', CASE v_claim->>'code'
                WHEN 'OWNER_CHANGED' THEN 'L''expéditeur n''est plus le propriétaire de ce billet.'
                WHEN 'TICKET_NOT_TRANSFERABLE' THEN 'Ce billet n''est plus transférable.'
                WHEN 'TRANSFER_NOT_PENDING' THEN 'Ce transfert n''est plus en attente.'
                WHEN 'TRANSFER_EXPIRED' THEN 'Ce billet ne peut plus être accepté : le délai est dépassé.'
                WHEN 'SELF_TRANSFER' THEN 'Vous êtes déjà le propriétaire de ce billet.'
                WHEN 'EVENT_NOT_ACTIVE' THEN 'Cet événement n''accepte plus de transfert.'
                ELSE 'Ce transfert est introuvable.' END);
    END IF;

    SELECT t.event_id, e.title INTO v_event, v_title
      FROM public.tickets t JOIN public.events e ON e.id = t.event_id
     WHERE t.id = tr.ticket_id;
    SELECT x.claimed_at INTO v_claimed_at FROM public.ticket_transfers x WHERE x.id = tr.id;

    v_data := COALESCE(public.notif_event_data(v_event), '{}'::jsonb)
              || jsonb_build_object('transfer_id', tr.id, 'ticket_id', tr.ticket_id);
    IF tr.from_user_id IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'TRANSFER_CLAIMED_SENDER', 'key', 'TRANSFER_CLAIMED_SENDER:' || tr.id::text,
            'user_id', tr.from_user_id, 'event_id', v_event, 'data', v_data));
    END IF;
    -- Lot 7 (7.9, D88) : nouveau numéro (le transfert le renouvelle) et catégorie du billet reçu, figés à
    -- l'émission ; champs absents plutôt que nuls.
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'TRANSFER_RECEIVED', 'key', 'TRANSFER_RECEIVED:' || tr.id::text,
        'user_id', v_actor, 'event_id', v_event,
        'data', v_data || jsonb_strip_nulls(jsonb_build_object(
            'ticket_number', v_claim->>'ticket_number',
            'category', (SELECT c.name FROM public.tickets t JOIN public.ticket_categories c ON c.id = t.category_id
                          WHERE t.id = tr.ticket_id)))));

    -- I4 : l'ancien porteur sans billet VALIDE de l'événement ne reçoit plus les rappels en attente.
    IF tr.from_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tickets t
                    WHERE t.event_id = v_event AND t.user_id = tr.from_user_id AND t.status::text = 'VALIDE') THEN
        UPDATE public.notification_outbox
           SET status = 'CANCELLED', reason = 'NO_LONGER_HOLDER', finished_at = now()
         WHERE event_id = v_event AND recipient_user_id = tr.from_user_id AND status = 'PENDING'
           AND type IN ('REMINDER_J1', 'REMINDER_H3');
    END IF;

    RETURN jsonb_build_object('ok', true, 'transfer_id', tr.id, 'ticket_id', tr.ticket_id,
                              'ticket_number', v_claim->>'ticket_number', 'event_title', v_title,
                              'claimed_at', v_claimed_at, 'already_used', false);
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_transfer_accept(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_transfer_accept(jsonb) TO service_role;


-- ----------------------------------------------------------------------------
-- (7) F26 ticket_transfers_incoming (recopie, 20261109000008_lot9bis_cycle.sql:2445-2500)
-- ----------------------------------------------------------------------------
-- Transferts entrants du compte (B3) : p = { actor_id } → { ok, items, phone_verification_required }.
-- items : transferts PENDING non échus dont la cible est le numéro vérifié du compte, triés par échéance ;
-- un numéro non vérifié ne montre aucun détail (seulement phone_verification_required). Lot 9 bis (R104) : `kind`
-- INVITATION (sans expéditeur) ou TRANSFER, pour que l'écran choisisse son texte. Lot 9 ter (9t.17) : aussi une
-- invitation déjà validée par la liste des invités et pas encore rattachée (ADMITTED, mêmes conditions que
-- ticket_transfer_accept : non échue, événement PUBLIE ou VALIDE) ; chaque élément porte used (ADMITTED) et
-- checked_in_at (heure de l'entrée, null pour un transfert en attente).
CREATE OR REPLACE FUNCTION public.ticket_transfers_incoming(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_phone text;
    v_identity text;
    v_items jsonb := '[]'::jsonb;
    v_verify boolean := false;
BEGIN
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande incomplète.');
    END IF;
    SELECT u.phone INTO v_phone FROM public.users u WHERE u.id = v_actor;
    IF v_phone IS NULL OR v_phone !~ '^\+221[0-9]{9}$' THEN
        RETURN jsonb_build_object('ok', true, 'items', v_items, 'phone_verification_required', false);
    END IF;
    v_identity := public.ticket_transfer_identity(v_phone, v_actor);

    IF v_identity = 'MATCH' THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                   'transfer_id', tr.id,
                   'kind', CASE WHEN tr.from_user_id IS NULL THEN 'INVITATION' ELSE 'TRANSFER' END,
                   'expires_at', tr.expires_at,
                   'sender_display', CASE
                       WHEN tr.from_user_id IS NULL THEN 'L’organisateur de l’événement'
                       WHEN btrim(COALESCE(s.first_name, '')) <> '' AND btrim(COALESCE(s.last_name, '')) <> ''
                           THEN btrim(s.first_name) || ' ' || upper(left(btrim(s.last_name), 1)) || '.'
                       WHEN btrim(COALESCE(s.first_name, '')) <> '' THEN upper(left(btrim(s.first_name), 1)) || '***'
                       WHEN btrim(COALESCE(s.last_name, '')) <> '' THEN upper(left(btrim(s.last_name), 1)) || '***'
                       ELSE 'Un utilisateur Event Village' END,
                   'ticket', jsonb_build_object('category_name', c.name, 'price', t.price),
                   'event', jsonb_build_object('id', e.id, 'title', e.title, 'start_date', e.start_date, 'start_time', e.start_time,
                                               'location', e.location, 'city', e.city, 'image_url', e.image_url),
                   'used', tr.status::text = 'ADMITTED',
                   'checked_in_at', CASE WHEN tr.status::text = 'ADMITTED' THEN t.checked_in_at END
               ) ORDER BY tr.expires_at, tr.id), '[]'::jsonb)
          INTO v_items
          FROM public.ticket_transfers tr
          JOIN public.tickets t ON t.id = tr.ticket_id
          JOIN public.events e ON e.id = t.event_id
          LEFT JOIN public.ticket_categories c ON c.id = t.category_id
          LEFT JOIN public.users s ON s.id = tr.from_user_id
         WHERE tr.to_phone_or_email = v_phone
           AND ((tr.status::text = 'PENDING' AND tr.expires_at > now())
                OR (tr.status::text = 'ADMITTED' AND tr.from_user_id IS NULL AND tr.to_user_id IS NULL
                    AND tr.expires_at > now() AND e.status::text IN ('PUBLIE', 'VALIDE')))
           AND tr.from_user_id IS DISTINCT FROM v_actor;
    ELSIF v_identity = 'PHONE_NOT_VERIFIED' THEN
        v_verify := EXISTS (SELECT 1 FROM public.ticket_transfers tr
                              JOIN public.tickets t ON t.id = tr.ticket_id
                              JOIN public.events e ON e.id = t.event_id
                             WHERE tr.to_phone_or_email = v_phone
                               AND ((tr.status::text = 'PENDING' AND tr.expires_at > now())
                                    OR (tr.status::text = 'ADMITTED' AND tr.from_user_id IS NULL AND tr.to_user_id IS NULL
                                        AND tr.expires_at > now() AND e.status::text IN ('PUBLIE', 'VALIDE')))
                               AND tr.from_user_id IS DISTINCT FROM v_actor);
    END IF;

    RETURN jsonb_build_object('ok', true, 'items', v_items, 'phone_verification_required', v_verify);
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_transfers_incoming(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_transfers_incoming(jsonb) TO service_role;
