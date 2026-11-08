-- ============================================================================
-- Lot 9, tâche 9.0 (M2) : outil d'invitations du partenaire (contrat 3.2, 3.3, 5.1, L1 à L17, AR15, AM4).
--
-- Une invitation est une ligne numéro d'un envoi (L4). Le billet va au compte du numéro s'il est ACTIF et vérifié
-- (L6) ; sinon il reste sans porteur, verrouillé, avec un transfert PENDING sans expéditeur (L3), réclamé par le
-- mécanisme de transfert existant une fois le numéro vérifié.
--
-- Recopies (dernière définition, signature identique, seuls changements indiqués devant chaque fonction) :
--   tickets_sale_decision_set()  : 20261106000001_lot8_canaux.sql:105-134
--   ticket_transfer_accept(jsonb) : 20261105000007_lot7_confirmation.sql:284-390
--   ticket_transfers_incoming(jsonb) : 20261103000005_lot6_billetterie.sql:295-348
--   participants_export(jsonb)   : 20261102000005_lot5_pilotage.sql:897-963
-- Nouvelles : ticket_invitation_create, ticket_invitation_cancel, ticket_invitations_list,
-- events_invitation_expiry_sync (trigger d'échéance).
-- Ordre des verrous (3.3) : création events FOR SHARE, catégorie FOR UPDATE, INSERT ; annulation events FOR SHARE,
-- catégorie FOR NO KEY UPDATE, transferts, billet.
-- Sans BEGIN ni COMMIT, rejouable, aucune reprise de données.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Billet sans porteur admis pour une invitation en attente (L3)
-- ----------------------------------------------------------------------------
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_holder_or_counter;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_holder_or_counter
    CHECK (user_id IS NOT NULL OR sale_channel IN ('COUNTER', 'INVITATION'));


-- ----------------------------------------------------------------------------
-- 2. Transfert sans expéditeur (L3)
-- ----------------------------------------------------------------------------
ALTER TABLE public.ticket_transfers ALTER COLUMN from_user_id DROP NOT NULL;

COMMENT ON COLUMN public.ticket_transfers.from_user_id IS
    'Lot 9 (L3) : NULL pour une invitation d''un organisateur en attente de réclamation, le partenaire ne détenant jamais le billet.';


-- ----------------------------------------------------------------------------
-- 3. Registre : INVITATION_RECEIVED (catalogue lib/notifications/catalog.ts)
-- ----------------------------------------------------------------------------
INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission)
VALUES ('INVITATION_RECEIVED', 'ESSENTIAL', NULL, ARRAY['SMS'], 'ANY', 'ALLOW', FALSE, NULL)
ON CONFLICT (type) DO NOTHING;


-- ============================================================================
-- 4. tickets_sale_decision_set (recopie de 20261106000001_lot8_canaux.sql:105-134)
-- Changement : branche INVITATION, avant le cas CATEGORIE (invariant t5, t6).
-- ============================================================================
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
    IF NEW.sale_channel = 'INVITATION' THEN
        NEW.sale_decision := jsonb_build_object('source', 'INVITATION', 'sale_online', v_online,
                                                'sale_counter', v_counter, 'decided_at', now());
        RETURN NEW;
    END IF;
    NEW.sale_decision := jsonb_build_object('source', 'CATEGORIE', 'sale_online', v_online,
                                            'sale_counter', v_counter, 'decided_at', now());
    RETURN NEW;
END;
$$;


-- ============================================================================
-- 5. ticket_transfer_accept (recopie de 20261105000007_lot7_confirmation.sql:284-390)
-- Changement (L3) : TRANSFER_CLAIMED_SENDER et le bloc I4 seulement s'il existe un expéditeur.
-- ============================================================================
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
    IF tr.status::text <> 'PENDING' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_PENDING', 'message', 'Ce transfert n''est plus en attente.');
    END IF;
    IF tr.expires_at <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_EXPIRED', 'message', 'Ce transfert a expiré (délai de 48 h dépassé).');
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
                WHEN 'TRANSFER_EXPIRED' THEN 'Ce transfert a expiré (délai de 48 h dépassé).'
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
                              'claimed_at', v_claimed_at);
END;
$$;


-- ============================================================================
-- 6. ticket_transfers_incoming (recopie de 20261103000005_lot6_billetterie.sql:295-348)
-- Changement (AM4) : sender_display « L’organisateur de l’événement » si le transfert n'a pas d'expéditeur.
-- ============================================================================
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
                                               'location', e.location, 'city', e.city, 'image_url', e.image_url)
               ) ORDER BY tr.expires_at, tr.id), '[]'::jsonb)
          INTO v_items
          FROM public.ticket_transfers tr
          JOIN public.tickets t ON t.id = tr.ticket_id
          JOIN public.events e ON e.id = t.event_id
          LEFT JOIN public.ticket_categories c ON c.id = t.category_id
          LEFT JOIN public.users s ON s.id = tr.from_user_id
         WHERE tr.to_phone_or_email = v_phone AND tr.status::text = 'PENDING' AND tr.expires_at > now()
           AND tr.from_user_id IS DISTINCT FROM v_actor;
    ELSIF v_identity = 'PHONE_NOT_VERIFIED' THEN
        v_verify := EXISTS (SELECT 1 FROM public.ticket_transfers tr
                             WHERE tr.to_phone_or_email = v_phone AND tr.status::text = 'PENDING' AND tr.expires_at > now()
                               AND tr.from_user_id IS DISTINCT FROM v_actor);
    END IF;

    RETURN jsonb_build_object('ok', true, 'items', v_items, 'phone_verification_required', v_verify);
END;
$$;


-- ============================================================================
-- 7. participants_export (recopie de 20261102000005_lot5_pilotage.sql:897-963)
-- Changements (L13) : clé channel (libellé du canal) ; nom « Invitation en attente » pour une invitation sans
-- porteur (ligne 940 de la base) ; VOLATILE écrit explicitement (la base s'en remettait au défaut).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.participants_export(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_purpose text := NULLIF(btrim(COALESCE(p->>'purpose', '')), '');
    v_contacts boolean;
    v_code text;
    v_title text;
    v_rows jsonb;
    v_count integer;
    v_export uuid;
BEGIN
    v_code := public.pilotage_access(v_event, v_actor);
    IF v_code IS NOT NULL THEN
        RETURN public.pilotage_refusal(v_code);
    END IF;
    IF jsonb_typeof(p->'include_contacts') IS DISTINCT FROM 'boolean' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT',
                                  'message', 'Indiquez si le téléphone et l’email doivent figurer dans l’export.');
    END IF;
    v_contacts := (p->>'include_contacts')::boolean;
    IF v_contacts AND (v_purpose IS NULL OR v_purpose NOT IN ('URGENT_EVENT_INFO', 'SAFETY_AND_RECEPTION')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PURPOSE_REQUIRED',
            'message', 'Pour exporter le téléphone et l’email, choisissez une finalité : information urgente sur l’événement, ou sécurité et accueil.');
    END IF;
    IF NOT v_contacts THEN
        v_purpose := NULL;
    END IF;
    SELECT title INTO v_title FROM public.events WHERE id = v_event;

    -- Participants = billets VALIDE et UTILISE, invitations comprises ; ni paiement, ni prix, ni numéro de billet
    SELECT COALESCE(jsonb_agg(r.line ORDER BY r.sort_name NULLS LAST, r.category, r.created_at, r.id), '[]'::jsonb), count(*)
      INTO v_rows, v_count
      FROM (
          SELECT tk.id, tk.created_at, c.name AS category,
                 public.pilotage_display_name(u.first_name, u.last_name) AS sort_name,
                 jsonb_build_object(
                     'name', COALESCE(public.pilotage_display_name(u.first_name, u.last_name),
                                      CASE WHEN tk.user_id IS NULL AND tk.sale_channel = 'INVITATION' THEN 'Invitation en attente'
                                           WHEN tk.user_id IS NULL THEN 'Vente au guichet' ELSE 'Participant sans nom' END),
                     'category', c.name,
                     'channel', CASE tk.sale_channel WHEN 'ONLINE' THEN 'En ligne' WHEN 'FREE' THEN 'Gratuit'
                                     WHEN 'COUNTER' THEN 'Guichet' WHEN 'INVITATION' THEN 'Invitation' END,
                     'status', public.pilotage_ticket_status_label(tk.status::text),
                     'entered_at', CASE WHEN tk.status::text = 'UTILISE' THEN
                                       COALESCE(to_char(COALESCE(tk.checked_in_at, sc.created_at) AT TIME ZONE 'Africa/Dakar', 'DD/MM/YYYY HH24:MI'),
                                                'Entrée enregistrée')
                                   END)
                 || CASE WHEN v_contacts THEN jsonb_build_object('phone', u.phone, 'email', u.email) ELSE '{}'::jsonb END AS line
            FROM public.tickets tk
            JOIN public.ticket_categories c ON c.id = tk.category_id
            LEFT JOIN public.users u ON u.id = tk.user_id
            LEFT JOIN LATERAL (SELECT x.created_at FROM public.ticket_scans x
                                WHERE x.ticket_id = tk.id AND x.accepted ORDER BY x.created_at LIMIT 1) sc ON TRUE
           WHERE tk.event_id = v_event AND tk.status::text IN ('VALIDE', 'UTILISE')
      ) r;

    INSERT INTO public.participant_exports (event_id, actor_id, include_contacts, purpose, row_count)
    VALUES (v_event, v_actor, v_contacts, v_purpose, v_count)
    RETURNING id INTO v_export;

    RETURN jsonb_build_object('ok', true, 'export_id', v_export, 'event_id', v_event, 'title', v_title,
                              'include_contacts', v_contacts, 'purpose', v_purpose, 'row_count', v_count, 'rows', v_rows);
END;
$$;


-- ============================================================================
-- 8. ticket_invitation_create (nouvelle, contrat 5.1)
-- p = { actor_id, event_id, category_id, phones[], quantity, limits: { per_event_hour, per_phone_day } }.
-- Droits : propriétaire, SUPERADMIN, ou ADMIN avec events.write (lu sur user_roles et admin_permissions, L15).
-- Quotas réservés après les droits et le stock (AR15), dans la même transaction : un refus ne consomme rien.
-- Réponse identique avec ou sans compte (L7). SMS sans actor_id ni user_id (AR15).
-- ============================================================================
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
    IF NOT (a.is_owner OR a.is_staff) THEN
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

    FOREACH v_phone IN ARRAY v_phones LOOP
        SELECT u.id INTO v_account
          FROM public.users u
         WHERE u.phone = v_phone AND public.ticket_transfer_identity(v_phone, u.id) = 'MATCH'
         ORDER BY u.id
         LIMIT 1;

        WITH ins AS (
            INSERT INTO public.tickets (event_id, category_id, user_id, ticket_number, price, qr_code, status, sale_channel, transfer_locked)
            SELECT v_event, v_category, v_account,
                   'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
                   0, 'EV-QR-' || replace(gen_random_uuid()::text, '-', ''), 'VALIDE', 'INVITATION', v_account IS NULL
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

        v_masked := v_masked || ('+221***' || right(v_phone, 2));
    END LOOP;

    -- Étape 10 : audit, numéros masqués
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, v_role, 'TICKET_INVITATIONS_SENT', 'events', v_event,
            jsonb_build_object('category_id', v_category, 'category', v_category_name, 'phone_count', cardinality(v_phones),
                               'ticket_count', v_total, 'quantity', v_quantity, 'phones_masked', to_jsonb(v_masked)));

    RETURN jsonb_build_object('ok', true, 'ticket_count', v_total, 'phone_count', cardinality(v_phones));
END;
$$;


-- ============================================================================
-- 9. ticket_invitation_cancel (nouvelle, contrat 5.1, L11)
-- p = { actor_id, event_id, ticket_id }. Mêmes droits que la création, statut de l'événement non contrôlé.
-- Billet ANNULE, transferts PENDING annulés, stock rendu, audit, aucune notification.
-- La catégorie est prise en NO KEY UPDATE : un scan tient son billet et prend KEY SHARE sur la catégorie (3.3).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ticket_invitation_cancel(p jsonb)
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
    a record;
    v_role text;
    v_ticket_event uuid;
    v_channel text;
    v_category uuid;
    v_status text;
BEGIN
    IF v_actor IS NULL OR v_event IS NULL OR v_ticket IS NULL THEN
        RETURN public.pilotage_refusal('INVALID_INPUT');
    END IF;

    PERFORM 1 FROM public.events e WHERE e.id = v_event FOR SHARE;
    IF NOT FOUND THEN
        RETURN public.pilotage_refusal('EVENT_NOT_FOUND');
    END IF;

    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (a.is_owner OR a.is_staff) THEN
        RETURN public.pilotage_refusal('EVENT_NOT_FOUND');
    END IF;
    IF NOT a.is_active THEN
        RETURN public.pilotage_refusal('ACCOUNT_NOT_ACTIVE');
    END IF;
    IF NOT a.is_owner
       AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN')
       AND NOT EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = v_actor AND ap.permission = 'events.write') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit d’annuler les invitations de cet événement.');
    END IF;
    v_role := CASE WHEN a.is_owner THEN 'PARTENAIRE' ELSE 'ADMIN' END;

    -- Catégorie et événement d'un billet ne changent jamais : la lecture sans verrou suffit
    SELECT t.event_id, t.sale_channel, t.category_id INTO v_ticket_event, v_channel, v_category
      FROM public.tickets t WHERE t.id = v_ticket;
    IF NOT FOUND OR v_ticket_event <> v_event OR v_channel <> 'INVITATION' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;

    PERFORM 1 FROM public.ticket_categories c WHERE c.id = v_category FOR NO KEY UPDATE;
    PERFORM 1 FROM public.ticket_transfers x WHERE x.ticket_id = v_ticket AND x.status = 'PENDING' FOR UPDATE;
    SELECT t.status::text INTO v_status FROM public.tickets t WHERE t.id = v_ticket FOR UPDATE;

    IF v_status = 'UTILISE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_ALREADY_USED', 'message', 'Ce billet a déjà été scanné : l’invitation ne peut plus être annulée.');
    END IF;
    IF v_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_CANCELLABLE', 'message', 'Cette invitation ne peut plus être annulée.');
    END IF;

    UPDATE public.ticket_transfers SET status = 'CANCELLED', cancelled_at = now()
     WHERE ticket_id = v_ticket AND status = 'PENDING';
    UPDATE public.tickets SET status = 'ANNULE', transfer_locked = FALSE, updated_at = now() WHERE id = v_ticket;
    UPDATE public.ticket_categories SET sold_quantity = sold_quantity - 1 WHERE id = v_category;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, v_role, 'TICKET_INVITATION_CANCELLED', 'tickets', v_ticket,
            jsonb_build_object('event_id', v_event, 'category_id', v_category));

    RETURN jsonb_build_object('ok', true);
END;
$$;


-- ============================================================================
-- 10. ticket_invitations_list (nouvelle, contrat 5.1, L7, L14)
-- p = { actor_id, event_id, page }. Lecture par pilotage_access (tout admin), 50 par page, plus récentes d'abord.
-- Ni numéro de billet, ni QR, ni état « en attente » : même ligne avec ou sans compte.
-- ============================================================================
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
                     'status_label', CASE t.status::text WHEN 'VALIDE' THEN 'Envoyée' WHEN 'UTILISE' THEN 'Entrée validée' ELSE 'Annulée' END,
                     'phone_masked', CASE WHEN COALESCE(x.to_phone_or_email, u.phone) IS NOT NULL
                                          THEN '+221***' || right(COALESCE(x.to_phone_or_email, u.phone), 2) END,
                     'can_cancel', t.status::text = 'VALIDE') AS item
            FROM public.tickets t
            JOIN public.ticket_categories c ON c.id = t.category_id
            LEFT JOIN public.users u ON u.id = t.user_id
            LEFT JOIN LATERAL (SELECT tr.to_phone_or_email FROM public.ticket_transfers tr
                                WHERE tr.ticket_id = t.id AND tr.from_user_id IS NULL
                                ORDER BY tr.created_at LIMIT 1) x ON TRUE
           WHERE t.event_id = v_event AND t.sale_channel = 'INVITATION'
           ORDER BY t.created_at DESC, t.id DESC
           LIMIT v_page_size OFFSET (v_page - 1) * v_page_size
      ) r;

    RETURN jsonb_build_object('ok', true, 'items', v_items, 'page', v_page, 'page_size', v_page_size, 'total_count', v_total);
END;
$$;


-- ============================================================================
-- 11. Échéance d'une invitation en attente, recalée au report de date (L8)
-- Dans la transaction qui tient l'événement (3.3 : events puis transferts). Seules les invitations (expéditeur NULL)
-- bougent, et seulement si la nouvelle fin reste postérieure à leur création (chk_ticket_transfers_dates).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.events_invitation_expiry_sync()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_end timestamptz := public.event_end_at(NEW.id);
BEGIN
    UPDATE public.ticket_transfers tr
       SET expires_at = v_end
     WHERE tr.status = 'PENDING' AND tr.from_user_id IS NULL
       AND tr.ticket_id IN (SELECT t.id FROM public.tickets t WHERE t.event_id = NEW.id)
       AND v_end > tr.created_at
       AND tr.expires_at IS DISTINCT FROM v_end;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_invitation_expiry ON public.events;
CREATE TRIGGER trg_events_invitation_expiry
    AFTER UPDATE OF start_date, start_time, end_date, end_time ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.events_invitation_expiry_sync();


-- ============================================================================
-- Privilèges : service_role uniquement (règle 1A.3)
-- ============================================================================
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.tickets_sale_decision_set()',
        'public.ticket_transfer_accept(jsonb)',
        'public.ticket_transfers_incoming(jsonb)',
        'public.participants_export(jsonb)',
        'public.ticket_invitation_create(jsonb)',
        'public.ticket_invitation_cancel(jsonb)',
        'public.ticket_invitations_list(jsonb)',
        'public.events_invitation_expiry_sync()'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
