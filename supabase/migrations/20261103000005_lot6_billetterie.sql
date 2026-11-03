-- ============================================================================
-- EVENT VILLAGE — LOT 6, TÂCHE 6.7 : billetterie, transferts et cycle de vie dans la boîte d'envoi
-- (contrat B3 avec l'amendement 2, J1, K1)
-- ============================================================================
-- Toute notification de la billetterie est mise en file (notif_enqueue, migration 20261103000002) dans la
-- transaction de l'action métier ; l'envoyeur unique la livre ensuite. Plus aucun envoi TypeScript.
--  B3   — transferts vers un numéro seulement, sans jeton : ticket_transfer_initiate (TRANSFER_OFFERED),
--         ticket_transfer_cancel (TRANSFER_CANCELLED), ticket_transfers_expire (TRANSFER_EXPIRED),
--         ticket_transfers_incoming (liste du destinataire), ticket_transfer_accept (réclamation par
--         identifiant, TRANSFER_CLAIMED_SENDER et TRANSFER_RECEIVED, rappels de l'ancien porteur annulés).
--  J1.1 — payment_confirm : PURCHASE_CONFIRMED (client, SMS au payeur) et NEW_ORDER (partenaire).
--  J1.2 — free_tickets_claim : FREE_TICKETS_CONFIRMED.
--  J1.3 — counter_sale : COUNTER_RECEIPT (reçu du guichet) ; réponse receipt_queued / receipt_refusal.
--  J1.4 — triggers sur tickets : FIRST_TICKET_SOLD (une fois par événement), TICKET_SCANNED.
--  J1.5 — trigger sur ticket_categories : CATEGORY_SOLD_OUT (clé avec le quota) puis EVENT_SOLD_OUT.
--  J1.6 — event_transition et event_cancel recopiées sans les appels à event_notify, puis event_notify
--         supprimée.
--  J1.7 — trigger d'historique trg_event_status_notify : soumission, refus, validation, publication par
--         l'admin, suspension, réactivation (partenaire et porteurs), annulation (porteurs).
--  J1.8 — event_update : events.notify_version, EVENT_CHANGED (IN_APP, PUSH ; SMS regroupé par porteur,
--         SKIPPED TITLE_ONLY pour un titre seul).
--  J1.9 — absorption de la file du lot 5 (bloc balisé « reprise ») puis suppression de la table et de ses
--         deux RPC.
-- Privilèges (règle 1A.3) : chaque fonction créée ou recréée, triggers compris : SECURITY DEFINER,
-- search_path = public, volatilité explicite, REVOKE ALL FROM PUBLIC, anon, authenticated, puis GRANT
-- EXECUTE TO service_role.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Données d'un événement pour les modèles (catalogue G2) : event_id, title, start_at, location, city.
-- Champs absents plutôt que nuls (l'envoyeur complète depuis l'événement à la réservation).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_event_data(p_event uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_strip_nulls(jsonb_build_object(
               'event_id', e.id,
               'title', e.title,
               'start_at', public.event_start_at(e.id),
               'location', e.location,
               'city', e.city))
      FROM public.events e
     WHERE e.id = p_event
$$;


-- ----------------------------------------------------------------------------
-- J1.8 — version des changements notifiés d'un événement (reprise : dernière version de la file du lot 5)
-- ----------------------------------------------------------------------------
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS notify_version INTEGER NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.events.notify_version IS
    'Lot 6 (J1.8) : version du dernier changement notifié aux porteurs (titre, dates, heures, lieu, ville, adresse). Clé EVENT_CHANGED:<event>:<porteur>:v<version>.';

DO $$
BEGIN
    IF to_regclass('public.event_change_notifications') IS NOT NULL THEN
        UPDATE public.events e
           SET notify_version = x.v
          FROM (SELECT n.event_id, max(n.version) AS v FROM public.event_change_notifications n GROUP BY n.event_id) x
         WHERE e.id = x.event_id AND e.notify_version < x.v;
    END IF;
END;
$$;


-- ============================================================================
-- B3 — transferts de billets vers un numéro, sans jeton
-- ============================================================================

-- Recopie de 20261102000002_lot5_dette.sql:86-146. Changements : le haché de jeton n'est plus exigé
-- (ignoré, colonne écrite NULL) ; cible email refusée (amendement 2) ; numéro normalisé exigé ;
-- TRANSFER_OFFERED mis en file (SMS au numéro, IN_APP et PUSH au compte dont le numéro vérifié est la cible).
CREATE OR REPLACE FUNCTION public.ticket_transfer_initiate(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ticket uuid := public.try_uuid(p->>'ticket_id');
    v_actor uuid := public.try_uuid(COALESCE(p->>'actor_id', p->>'from_user_id'));
    v_recipient text := NULLIF(btrim(COALESCE(p->>'recipient', p->>'to_phone_or_email', '')), '');
    v_expires timestamptz;
    t record;
    v_event_status text;
    v_event_title text;
    v_id uuid;
    v_target uuid;
    v_data jsonb;
BEGIN
    IF v_ticket IS NULL OR v_actor IS NULL OR v_recipient IS NULL OR char_length(v_recipient) > 254
       OR NULLIF(p->>'expires_at', '') IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande de transfert incomplète.');
    END IF;
    IF position('@' IN v_recipient) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RECIPIENT_PHONE_REQUIRED',
                                  'message', 'Le billet se transfère vers un numéro de téléphone.');
    END IF;
    IF v_recipient !~ '^\+221[0-9]{9}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Numéro du destinataire invalide.');
    END IF;
    v_expires := (p->>'expires_at')::timestamptz;
    IF v_expires <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Échéance du transfert invalide.');
    END IF;

    PERFORM 1 FROM public.ticket_transfers WHERE ticket_id = v_ticket AND status = 'PENDING' FOR UPDATE;
    SELECT * INTO t FROM public.tickets WHERE id = v_ticket FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_FOUND', 'message', 'Billet introuvable.');
    END IF;
    IF t.user_id IS DISTINCT FROM v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_OWNER', 'message', 'Vous n''êtes pas le porteur de ce billet.');
    END IF;
    IF t.status::text <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_TRANSFERABLE', 'status', t.status::text,
                                  'message', 'Seul un billet valide peut être transféré.');
    END IF;
    IF t.checked_in_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_USED', 'message', 'Ce billet a déjà servi à l''entrée.');
    END IF;
    SELECT status::text, title INTO v_event_status, v_event_title FROM public.events WHERE id = t.event_id;
    IF v_event_status IS NULL OR v_event_status NOT IN ('PUBLIE', 'VALIDE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ACTIVE', 'message', 'Cet événement n''accepte plus les transferts de billets.');
    END IF;

    -- Un transfert échu que le cron n'a pas encore traité ne bloque pas le porteur
    UPDATE public.ticket_transfers SET status = 'EXPIRED', expired_at = now()
     WHERE ticket_id = v_ticket AND status = 'PENDING' AND expires_at <= now();
    IF EXISTS (SELECT 1 FROM public.ticket_transfers WHERE ticket_id = v_ticket AND status = 'PENDING') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_PENDING', 'message', 'Ce billet est déjà engagé dans un transfert en attente.');
    END IF;

    INSERT INTO public.ticket_transfers (ticket_id, from_user_id, to_phone_or_email, status, claim_token_hash, expires_at)
    VALUES (v_ticket, v_actor, v_recipient, 'PENDING', NULL, v_expires)
    RETURNING id INTO v_id;
    UPDATE public.tickets SET transfer_locked = TRUE, updated_at = now() WHERE id = v_ticket;

    -- Offre au destinataire, même transaction : SMS au numéro (compté sur l'expéditeur), IN_APP et PUSH au
    -- compte dont le numéro vérifié par code est la cible (règle B2).
    v_data := COALESCE(public.notif_event_data(t.event_id), '{}'::jsonb)
              || jsonb_build_object('transfer_id', v_id, 'ticket_id', t.id, 'expires_at', v_expires, 'recipient_kind', 'PHONE');
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'TRANSFER_OFFERED', 'key', 'TRANSFER_OFFERED:' || v_id::text,
        'phone', v_recipient, 'actor_id', v_actor, 'event_id', t.event_id,
        'data', v_data, 'channels', jsonb_build_array('SMS')));
    SELECT u.id INTO v_target
      FROM public.users u
     WHERE u.phone = v_recipient AND u.id <> v_actor
       AND public.ticket_transfer_identity(v_recipient, u.id) = 'MATCH'
     ORDER BY u.id
     LIMIT 1;
    IF v_target IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'TRANSFER_OFFERED', 'key', 'TRANSFER_OFFERED:' || v_id::text,
            'user_id', v_target, 'actor_id', v_actor, 'event_id', t.event_id,
            'data', v_data, 'channels', jsonb_build_array('IN_APP', 'PUSH')));
    END IF;

    RETURN jsonb_build_object('ok', true, 'transfer_id', v_id, 'ticket_id', t.id, 'ticket_number', t.ticket_number,
                              'event_id', t.event_id, 'event_title', v_event_title, 'expires_at', v_expires,
                              'recipient_notification', 'QUEUED');
END;
$$;

-- Recopie de 20261102000002_lot5_dette.sql:149-179. Changement : TRANSFER_CANCELLED mis en file (mêmes
-- canaux que l'offre) quand la cible est un numéro ; un ancien transfert vers un email n'a aucun canal.
CREATE OR REPLACE FUNCTION public.ticket_transfer_cancel(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transfer uuid := public.try_uuid(p->>'transfer_id');
    v_actor uuid := public.try_uuid(COALESCE(p->>'actor_id', p->>'from_user_id'));
    tr record;
    v_event uuid;
    v_target uuid;
    v_data jsonb;
    v_queued text := 'NONE';
BEGIN
    IF v_transfer IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande d''annulation incomplète.');
    END IF;
    SELECT * INTO tr FROM public.ticket_transfers WHERE id = v_transfer FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_FOUND', 'message', 'Transfert introuvable.');
    END IF;
    IF tr.from_user_id IS DISTINCT FROM v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_SENDER', 'message', 'Vous n''êtes pas l''émetteur de ce transfert.');
    END IF;
    IF tr.status::text <> 'PENDING' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_PENDING', 'status', tr.status::text,
                                  'message', 'Ce transfert n''est plus en attente.');
    END IF;
    PERFORM 1 FROM public.tickets WHERE id = tr.ticket_id FOR UPDATE;
    UPDATE public.ticket_transfers SET status = 'CANCELLED', cancelled_at = now() WHERE id = tr.id;
    UPDATE public.tickets SET transfer_locked = FALSE, updated_at = now() WHERE id = tr.ticket_id;

    IF tr.to_phone_or_email ~ '^\+221[0-9]{9}$' THEN
        SELECT event_id INTO v_event FROM public.tickets WHERE id = tr.ticket_id;
        v_data := COALESCE(public.notif_event_data(v_event), '{}'::jsonb)
                  || jsonb_build_object('transfer_id', tr.id, 'ticket_id', tr.ticket_id);
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'TRANSFER_CANCELLED', 'key', 'TRANSFER_CANCELLED:' || tr.id::text,
            'phone', tr.to_phone_or_email, 'actor_id', v_actor, 'event_id', v_event,
            'data', v_data, 'channels', jsonb_build_array('SMS')));
        SELECT u.id INTO v_target
          FROM public.users u
         WHERE u.phone = tr.to_phone_or_email AND u.id <> v_actor
           AND public.ticket_transfer_identity(tr.to_phone_or_email, u.id) = 'MATCH'
         ORDER BY u.id
         LIMIT 1;
        IF v_target IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'TRANSFER_CANCELLED', 'key', 'TRANSFER_CANCELLED:' || tr.id::text,
                'user_id', v_target, 'actor_id', v_actor, 'event_id', v_event,
                'data', v_data, 'channels', jsonb_build_array('IN_APP', 'PUSH')));
        END IF;
        v_queued := 'QUEUED';
    END IF;

    RETURN jsonb_build_object('ok', true, 'transfer_id', tr.id, 'ticket_id', tr.ticket_id, 'to_phone_or_email', tr.to_phone_or_email,
                              'recipient_notification', v_queued);
END;
$$;

-- Recopie de 20261102000002_lot5_dette.sql:182-217. Changement : TRANSFER_EXPIRED (IN_APP, PUSH) à
-- l'expéditeur de chaque transfert expiré, même transaction.
-- p : { limit? } (défaut 500). Les transferts en cours de réclamation (verrouillés) sont laissés au passage suivant.
CREATE OR REPLACE FUNCTION public.ticket_transfers_expire(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit integer := 500;
    v_expired jsonb;
    v_unlocked integer;
    r record;
BEGIN
    IF jsonb_typeof(p->'limit') = 'number' THEN
        v_limit := GREATEST(1, LEAST(5000, (p->>'limit')::numeric::integer));
    END IF;
    WITH due AS (
        SELECT id FROM public.ticket_transfers
         WHERE status = 'PENDING' AND expires_at <= now()
         ORDER BY expires_at, id
         LIMIT v_limit
           FOR UPDATE SKIP LOCKED
    ), upd AS (
        UPDATE public.ticket_transfers tt SET status = 'EXPIRED', expired_at = now()
          FROM due WHERE tt.id = due.id
        RETURNING tt.id, tt.ticket_id, tt.from_user_id, tt.to_phone_or_email
    ), unlocked AS (
        UPDATE public.tickets t SET transfer_locked = FALSE, updated_at = now()
          FROM upd WHERE t.id = upd.ticket_id AND t.transfer_locked
        RETURNING t.id
    )
    SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'ticket_id', u.ticket_id, 'from_user_id', u.from_user_id,
                                                         'to_phone_or_email', u.to_phone_or_email) ORDER BY u.id) FROM upd u), '[]'::jsonb),
           (SELECT count(*)::int FROM unlocked)
      INTO v_expired, v_unlocked;

    FOR r IN
        SELECT (x->>'id')::uuid AS id, (x->>'ticket_id')::uuid AS ticket_id, (x->>'from_user_id')::uuid AS from_user_id, t.event_id
          FROM jsonb_array_elements(v_expired) AS x
          JOIN public.tickets t ON t.id = (x->>'ticket_id')::uuid
    LOOP
        CONTINUE WHEN r.from_user_id IS NULL;
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'TRANSFER_EXPIRED', 'key', 'TRANSFER_EXPIRED:' || r.id::text,
            'user_id', r.from_user_id, 'event_id', r.event_id,
            'data', COALESCE(public.notif_event_data(r.event_id), '{}'::jsonb)
                    || jsonb_build_object('transfer_id', r.id, 'ticket_id', r.ticket_id)));
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'expired_count', jsonb_array_length(v_expired), 'unlocked_count', v_unlocked, 'expired', v_expired);
END;
$$;

-- Transferts entrants du compte (B3) : p = { actor_id } → { ok, items, phone_verification_required }.
-- items : transferts PENDING non échus dont la cible est le numéro vérifié du compte, triés par échéance ;
-- un numéro non vérifié ne montre aucun détail (seulement phone_verification_required).
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

-- Réclamation d'un transfert par son identifiant (B3) : p = { transfer_id, actor_id }. Refus dans l'ordre du
-- contrat ; transfert absent et cible d'un autre compte donnent la même réponse (aucune fuite d'existence).
-- Puis ticket_transfer_claim (lot 4, inchangée : identité du billet régénérée), avis à l'expéditeur et au
-- destinataire, rappels en attente de l'ancien porteur annulés s'il n'a plus de billet VALIDE (I4).
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
    v_event uuid;
    v_title text;
    v_data jsonb;
    v_claimed_at timestamptz;
BEGIN
    IF v_transfer IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande incomplète.');
    END IF;
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

    v_claim := public.ticket_transfer_claim(tr.id, v_actor);
    IF NOT COALESCE((v_claim->>'ok')::boolean, false) THEN
        RETURN jsonb_build_object('ok', false, 'code', COALESCE(v_claim->>'code', 'TICKET_NOT_TRANSFERABLE'),
            'message', CASE v_claim->>'code'
                WHEN 'OWNER_CHANGED' THEN 'L''expéditeur n''est plus le propriétaire de ce billet.'
                WHEN 'TICKET_NOT_TRANSFERABLE' THEN 'Ce billet n''est plus transférable.'
                WHEN 'TRANSFER_NOT_PENDING' THEN 'Ce transfert n''est plus en attente.'
                WHEN 'TRANSFER_EXPIRED' THEN 'Ce transfert a expiré (délai de 48 h dépassé).'
                WHEN 'SELF_TRANSFER' THEN 'Vous êtes déjà le propriétaire de ce billet.'
                ELSE 'Ce transfert est introuvable.' END);
    END IF;

    SELECT t.event_id, e.title INTO v_event, v_title
      FROM public.tickets t JOIN public.events e ON e.id = t.event_id
     WHERE t.id = tr.ticket_id;
    SELECT x.claimed_at INTO v_claimed_at FROM public.ticket_transfers x WHERE x.id = tr.id;

    v_data := COALESCE(public.notif_event_data(v_event), '{}'::jsonb)
              || jsonb_build_object('transfer_id', tr.id, 'ticket_id', tr.ticket_id);
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'TRANSFER_CLAIMED_SENDER', 'key', 'TRANSFER_CLAIMED_SENDER:' || tr.id::text,
        'user_id', tr.from_user_id, 'event_id', v_event, 'data', v_data));
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'TRANSFER_RECEIVED', 'key', 'TRANSFER_RECEIVED:' || tr.id::text,
        'user_id', v_actor, 'event_id', v_event, 'data', v_data));

    -- I4 : l'ancien porteur sans billet VALIDE de l'événement ne reçoit plus les rappels en attente.
    IF NOT EXISTS (SELECT 1 FROM public.tickets t
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
-- J1.1 — payment_confirm (recopie de 20261102000003_lot5_cycle.sql:1002-1105)
-- Changements : montants et numéro du payeur lus avec le paiement ; branche CONFIRMED : PURCHASE_CONFIRMED
-- (compte du client, SMS au numéro payeur s'il est lisible, sinon au numéro du compte à l'envoi) et
-- NEW_ORDER au partenaire. La branche « refusé et remboursé » n'envoie rien ici (le cashout le fait).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.payment_confirm(p_payment_id uuid, p_source text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay record;
    v_res record;
    v_cat record;
    v_blocking text;
    v_cashout uuid;
    v_count integer;
    v_ticket_ids uuid[] := ARRAY[]::uuid[];
    v_new uuid[];
    v_event uuid;
    v_owner uuid;
    v_payer text;
    v_data jsonb;
BEGIN
    SELECT id, status::text AS status, client_id, payment_target::text AS payment_target,
           amount, service_fee, facial_amount, payer_phone
      INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('result', 'NOT_FOUND');
    END IF;
    IF v_pay.status = 'SUCCESS' THEN
        SELECT count(*) INTO v_count FROM public.tickets WHERE payment_id = p_payment_id;
        RETURN jsonb_build_object('result', 'ALREADY_CONFIRMED', 'ticket_count', v_count);
    END IF;
    IF v_pay.status IN ('REFUND_PENDING', 'REFUNDED', 'PARTIAL') THEN
        RETURN jsonb_build_object('result', 'REFUND_IN_PROGRESS', 'status', v_pay.status);
    END IF;
    IF v_pay.payment_target <> 'TICKET' THEN
        RETURN jsonb_build_object('result', 'NOT_TICKET');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.stock_reservations WHERE payment_id = p_payment_id) THEN
        RETURN jsonb_build_object('result', 'NO_ITEMS');
    END IF;

    PERFORM 1 FROM public.ticket_categories
     WHERE id IN (SELECT category_id FROM public.stock_reservations WHERE payment_id = p_payment_id)
     ORDER BY id FOR UPDATE;

    -- Le panier peut-il être honoré en entier ? (événement en vente, réservation active, ou stock libre si elle a échu)
    FOR v_res IN
        SELECT r.*, c.total_quantity, c.sold_quantity, c.held_quantity, c.name, e.status::text AS event_status
          FROM public.stock_reservations r
          JOIN public.ticket_categories c ON c.id = r.category_id
          JOIN public.events e ON e.id = c.event_id
         WHERE r.payment_id = p_payment_id
         ORDER BY r.category_id
    LOOP
        IF v_res.event_status = 'ANNULE' THEN
            v_blocking := format('événement annulé (%s)', v_res.name);
        ELSIF v_res.event_status = 'SUSPENDU' THEN
            v_blocking := format('événement suspendu (%s)', v_res.name);
        ELSIF v_res.event_status = 'TERMINE' THEN
            v_blocking := format('événement terminé (%s)', v_res.name);
        ELSIF v_res.status = 'ACTIVE' THEN
            CONTINUE;
        ELSIF v_res.status = 'CONVERTED' THEN
            v_blocking := format('réservation déjà convertie (%s)', v_res.name);
        ELSIF v_res.total_quantity - v_res.sold_quantity - v_res.held_quantity < v_res.quantity THEN
            v_blocking := format('plus de place « %s » après échéance de la réservation', v_res.name);
        END IF;
        EXIT WHEN v_blocking IS NOT NULL;
    END LOOP;

    IF v_blocking IS NOT NULL THEN
        UPDATE public.stock_reservations SET status = 'RELEASED', closed_at = now(), close_reason = 'REFUND'
         WHERE payment_id = p_payment_id AND status = 'ACTIVE';
        UPDATE public.payments
           SET status = 'REFUND_PENDING', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(),
               confirmed_source = p_source,
               metadata = metadata || jsonb_build_object('refund_reason', v_blocking)
         WHERE id = p_payment_id;
        v_cashout := public.refund_request(p_payment_id, 'Panier impossible à honorer : ' || v_blocking, 'REFUND');
        RETURN jsonb_build_object('result', 'REFUND_REQUIRED', 'reason', v_blocking, 'cashout_id', v_cashout);
    END IF;

    -- Conversion et émission (montants lus sur les réservations, jamais recalculés)
    FOR v_res IN SELECT * FROM public.stock_reservations WHERE payment_id = p_payment_id ORDER BY category_id LOOP
        -- held d'abord (trigger), puis sold : la contrainte sold + held <= total reste respectée
        UPDATE public.stock_reservations SET status = 'CONVERTED', closed_at = now(), close_reason = 'CONFIRMED' WHERE id = v_res.id;
        UPDATE public.ticket_categories SET sold_quantity = sold_quantity + v_res.quantity WHERE id = v_res.category_id;
        SELECT event_id INTO v_cat FROM public.ticket_categories WHERE id = v_res.category_id;
        WITH ins AS (
            INSERT INTO public.tickets (event_id, category_id, user_id, payment_id, ticket_number, price, service_fee, qr_code, status)
            SELECT v_cat.event_id, v_res.category_id, v_pay.client_id, p_payment_id,
                   'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
                   v_res.unit_price,
                   v_res.unit_service_fee,
                   'EV-QR-' || replace(gen_random_uuid()::text, '-', ''),
                   'VALIDE'
              FROM generate_series(1, v_res.quantity)
            RETURNING id
        )
        SELECT array_agg(id) INTO v_new FROM ins;
        v_ticket_ids := v_ticket_ids || v_new;
        v_event := v_cat.event_id;
    END LOOP;

    UPDATE public.payments
       SET status = 'SUCCESS', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(),
           confirmed_source = p_source, ticket_id = v_ticket_ids[1]
     WHERE id = p_payment_id;

    -- Lot 6 (J1.1) : confirmation d'achat et nouvelle commande, dans la transaction de la confirmation
    IF v_event IS NOT NULL THEN
        v_payer := CASE WHEN v_pay.payer_phone ~ '^[0-9]{9}$' THEN '+221' || v_pay.payer_phone END;
        v_data := COALESCE(public.notif_event_data(v_event), '{}'::jsonb);
        IF v_pay.client_id IS NOT NULL OR v_payer IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'PURCHASE_CONFIRMED', 'key', 'PURCHASE_CONFIRMED:' || p_payment_id::text,
                'user_id', v_pay.client_id, 'phone', v_payer, 'event_id', v_event,
                'data', v_data || jsonb_build_object(
                    'payment_id', p_payment_id,
                    'ticket_count', COALESCE(array_length(v_ticket_ids, 1), 0),
                    'service_fee', COALESCE(v_pay.service_fee, 0),
                    'total', v_pay.amount)));
        END IF;
        SELECT pa.user_id INTO v_owner
          FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
         WHERE e.id = v_event;
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'NEW_ORDER', 'key', 'NEW_ORDER:' || p_payment_id::text,
                'user_id', v_owner, 'event_id', v_event,
                'data', v_data || jsonb_build_object(
                    'payment_id', p_payment_id,
                    'ticket_count', COALESCE(array_length(v_ticket_ids, 1), 0),
                    'total', COALESCE(v_pay.facial_amount, v_pay.amount - COALESCE(v_pay.service_fee, 0)))));
        END IF;
    END IF;

    RETURN jsonb_build_object('result', 'CONFIRMED', 'ticket_ids', to_jsonb(v_ticket_ids), 'ticket_count', COALESCE(array_length(v_ticket_ids, 1), 0));
END;
$$;


-- ============================================================================
-- J1.2 — free_tickets_claim (recopie de 20261102000002_lot5_dette.sql:682-735)
-- Changement : FREE_TICKETS_CONFIRMED (compte qui réclame, quota SMS par compte), clé sur le plus petit
-- identifiant de billet émis.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.free_tickets_claim(p_user_id uuid, p_event_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_problems jsonb;
    v_item record;
    v_cat record;
    v_already integer;
    v_ticket_ids uuid[] := ARRAY[]::uuid[];
    v_new uuid[];
    v_first uuid;
BEGIN
    PERFORM 1 FROM public.ticket_categories
     WHERE id IN (SELECT (e->>'category_id')::uuid FROM jsonb_array_elements(p_items) e)
     ORDER BY id FOR UPDATE;

    FOR v_item IN SELECT (e->>'category_id')::uuid AS category_id, (e->>'quantity')::int AS quantity FROM jsonb_array_elements(p_items) e LOOP
        SELECT id, price, max_per_order, name INTO v_cat FROM public.ticket_categories WHERE id = v_item.category_id;
        IF FOUND AND v_cat.price <> 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NOT_FREE', 'message', format('La catégorie « %s » est payante.', v_cat.name));
        END IF;
    END LOOP;

    v_problems := public.ticket_sale_problems(p_event_id, p_items);
    IF jsonb_array_length(v_problems) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SALE_CHECK_FAILED', 'problems', v_problems);
    END IF;

    FOR v_item IN SELECT (e->>'category_id')::uuid AS category_id, (e->>'quantity')::int AS quantity FROM jsonb_array_elements(p_items) e LOOP
        SELECT c.id, c.event_id, c.max_per_order, c.name INTO v_cat FROM public.ticket_categories c WHERE c.id = v_item.category_id;
        SELECT count(*) INTO v_already FROM public.tickets
         WHERE user_id = p_user_id AND category_id = v_item.category_id AND status IN ('VALIDE', 'UTILISE');
        IF v_already + v_item.quantity > v_cat.max_per_order THEN
            RAISE EXCEPTION USING ERRCODE = 'EV409', MESSAGE = format('Limite de %s billet(s) gratuit(s) « %s » par compte atteinte.', v_cat.max_per_order, v_cat.name);
        END IF;
        UPDATE public.ticket_categories SET sold_quantity = sold_quantity + v_item.quantity WHERE id = v_item.category_id;
        WITH ins AS (
            INSERT INTO public.tickets (event_id, category_id, user_id, ticket_number, price, qr_code, status, sale_channel)
            SELECT v_cat.event_id, v_item.category_id, p_user_id,
                   'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
                   0, 'EV-QR-' || replace(gen_random_uuid()::text, '-', ''), 'VALIDE', 'FREE'
              FROM generate_series(1, v_item.quantity)
            RETURNING id
        )
        SELECT array_agg(id) INTO v_new FROM ins;
        v_ticket_ids := v_ticket_ids || v_new;
    END LOOP;

    -- Lot 6 (J1.2) : confirmation des billets gratuits, dans la même transaction
    -- Plus petit identifiant (ordre de l'uuid = ordre binaire de sa forme texte, indépendant de la collation)
    SELECT x INTO v_first FROM unnest(v_ticket_ids) AS x ORDER BY x LIMIT 1;
    IF v_first IS NOT NULL AND p_user_id IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'FREE_TICKETS_CONFIRMED', 'key', 'FREE_TICKETS_CONFIRMED:' || v_first::text,
            'user_id', p_user_id, 'actor_id', p_user_id, 'event_id', p_event_id,
            'data', COALESCE(public.notif_event_data(p_event_id), '{}'::jsonb)
                    || jsonb_build_object('ticket_count', cardinality(v_ticket_ids), 'ticket_id', v_first)));
    END IF;

    RETURN jsonb_build_object('ok', true, 'ticket_ids', to_jsonb(v_ticket_ids));
EXCEPTION WHEN SQLSTATE 'EV409' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FREE_LIMIT_REACHED', 'message', SQLERRM);
END;
$$;


-- ============================================================================
-- J1.3 — counter_sale (recopie de 20261102000002_lot5_dette.sql:544-679)
-- Changement : reçu COUNTER_RECEIPT mis en file si un numéro est fourni (quota par caisse) ; réponses (dont
-- le rejeu) : receipt_queued (ligne SMS en file ou déjà partie) et receipt_refusal (motif d'une ligne
-- SKIPPED dès l'insertion).
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
    -- Contrôles de vente du lot 2, hors fenêtre de vente en ligne et visibilité (vente sur place)
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
-- J1.4 — triggers sur tickets
-- ============================================================================

-- Premier billet vendu (en ligne ou au guichet ; gratuits et invitations exclus) : une fois par événement.
CREATE OR REPLACE FUNCTION public.notif_tickets_first_sale()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key text := 'FIRST_TICKET_SOLD:' || NEW.event_id::text;
    v_owner uuid;
BEGIN
    IF EXISTS (SELECT 1 FROM public.notification_outbox o WHERE o.group_key = v_key) THEN
        RETURN NULL;
    END IF;
    SELECT pa.user_id INTO v_owner
      FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = NEW.event_id;
    IF v_owner IS NULL THEN
        RETURN NULL;
    END IF;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'FIRST_TICKET_SOLD', 'key', v_key, 'user_id', v_owner, 'event_id', NEW.event_id,
        'data', COALESCE(public.notif_event_data(NEW.event_id), '{}'::jsonb)));
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_first_sale ON public.tickets;
CREATE TRIGGER trg_tickets_first_sale
    AFTER INSERT ON public.tickets
    FOR EACH ROW WHEN (NEW.sale_channel IN ('ONLINE', 'COUNTER'))
    EXECUTE FUNCTION public.notif_tickets_first_sale();

-- Billet contrôlé à l'entrée (ticket_scan, ticket_cash_checkin) : avis au porteur.
CREATE OR REPLACE FUNCTION public.notif_tickets_scanned()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'TICKET_SCANNED', 'key', 'TICKET_SCANNED:' || NEW.id::text,
        'user_id', NEW.user_id, 'event_id', NEW.event_id,
        'data', COALESCE(public.notif_event_data(NEW.event_id), '{}'::jsonb) || jsonb_build_object('ticket_id', NEW.id)));
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_scanned_notify ON public.tickets;
CREATE TRIGGER trg_tickets_scanned_notify
    AFTER UPDATE OF status ON public.tickets
    FOR EACH ROW WHEN (OLD.status::text = 'VALIDE' AND NEW.status::text = 'UTILISE' AND NEW.user_id IS NOT NULL
                       AND NEW.sale_channel IS DISTINCT FROM 'COUNTER')
    EXECUTE FUNCTION public.notif_tickets_scanned();


-- ============================================================================
-- J1.5 — catégorie complète, puis événement complet (remplace lib/payments/stock-notifications.ts)
-- Couvre payment_confirm, free_tickets_claim, counter_sale et une baisse de quota ; la clé porte le quota :
-- une hausse puis un nouvel épuisement prévient de nouveau.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notif_ticket_categories_sold_out()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner uuid;
    v_data jsonb;
    v_total bigint;
BEGIN
    SELECT pa.user_id INTO v_owner
      FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = NEW.event_id;
    IF v_owner IS NULL THEN
        RETURN NULL;
    END IF;
    v_data := COALESCE(public.notif_event_data(NEW.event_id), '{}'::jsonb);
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'CATEGORY_SOLD_OUT', 'key', 'CATEGORY_SOLD_OUT:' || NEW.id::text || ':' || NEW.total_quantity::text,
        'user_id', v_owner, 'event_id', NEW.event_id,
        'data', v_data || jsonb_build_object('category_id', NEW.id, 'category', NEW.name)));
    IF NOT EXISTS (SELECT 1 FROM public.ticket_categories c
                    WHERE c.event_id = NEW.event_id AND c.is_active AND c.sold_quantity < c.total_quantity) THEN
        SELECT COALESCE(sum(c.total_quantity), 0) INTO v_total
          FROM public.ticket_categories c WHERE c.event_id = NEW.event_id AND c.is_active;
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'EVENT_SOLD_OUT', 'key', 'EVENT_SOLD_OUT:' || NEW.event_id::text || ':' || v_total::text,
            'user_id', v_owner, 'event_id', NEW.event_id, 'data', v_data));
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_categories_sold_out ON public.ticket_categories;
CREATE TRIGGER trg_ticket_categories_sold_out
    AFTER UPDATE OF sold_quantity, total_quantity ON public.ticket_categories
    FOR EACH ROW WHEN (NEW.is_active AND NEW.sold_quantity >= NEW.total_quantity
                       AND (OLD.sold_quantity < OLD.total_quantity OR OLD.total_quantity <> NEW.total_quantity))
    EXECUTE FUNCTION public.notif_ticket_categories_sold_out();


-- ============================================================================
-- J1.6 — event_transition (recopie de 20261102000003_lot5_cycle.sql:338-478) : seuls les appels à
-- event_notify disparaissent (les avis sont mis en file par trg_event_status_notify, même transaction).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.event_transition(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_to_text text := p->>'to_status';
    v_to event_status;
    v_event uuid;
    v_actor uuid;
    v_reason text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    e record;
    a record;
    v_role text;
    v_reason_required boolean;
    v_role_missing boolean;
    v_missing jsonb := '[]'::jsonb;
    v_history uuid;
    v_owner uuid;
BEGIN
    IF v_to_text IS NULL OR NOT EXISTS (
        SELECT 1 FROM pg_enum WHERE enumtypid = 'public.event_status'::regtype AND enumlabel = v_to_text) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_STATUS', 'message', 'Statut demandé inconnu.');
    END IF;
    v_to := v_to_text::event_status;
    BEGIN
        v_event := (p->>'event_id')::uuid;
        v_actor := (p->>'actor_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END;
    IF v_event IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;

    SELECT id, partner_id, status, title, image_url, start_date, start_time INTO e
      FROM public.events WHERE id = v_event FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;

    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (a.is_owner OR a.is_staff) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'role_missing', true,
                                  'message', 'Vous n''êtes pas autorisé à changer le statut de cet événement.');
    END IF;
    IF NOT a.is_active THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n''est pas actif.');
    END IF;
    IF v_to = 'ANNULE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CANCELLATION_REQUIRED',
                                  'message', 'L''annulation passe par la procédure d''annulation, qui rembourse les acheteurs.');
    END IF;

    -- Règle de la table : le propriétaire agit comme partenaire, sinon l'admin comme admin
    IF a.is_owner THEN
        SELECT t.reason_required INTO v_reason_required FROM public.event_status_transitions t
         WHERE t.from_status = e.status AND t.to_status = v_to AND t.actor_kind = 'PARTENAIRE' AND t.channel = 'TRANSITION';
        IF FOUND THEN v_role := 'PARTENAIRE'; END IF;
    END IF;
    IF v_role IS NULL AND a.is_staff THEN
        SELECT t.reason_required INTO v_reason_required FROM public.event_status_transitions t
         WHERE t.from_status = e.status AND t.to_status = v_to AND t.actor_kind = 'ADMIN' AND t.channel = 'TRANSITION';
        IF FOUND THEN v_role := 'ADMIN'; END IF;
    END IF;
    IF v_role IS NULL THEN
        v_role_missing := EXISTS (SELECT 1 FROM public.event_status_transitions t
                                   WHERE t.from_status = e.status AND t.to_status = v_to AND t.channel <> 'CANCELLATION');
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'role_missing', v_role_missing,
            'message', CASE WHEN v_role_missing
                            THEN format('Votre rôle ne permet pas de passer cet événement de « %s » à « %s ».',
                                        public.event_status_label(e.status::text), public.event_status_label(v_to::text))
                            ELSE format('Un événement « %s » ne peut pas passer à « %s ».',
                                        public.event_status_label(e.status::text), public.event_status_label(v_to::text)) END);
    END IF;

    IF v_reason_required AND (v_reason IS NULL OR char_length(v_reason) < 3) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Un motif d''au moins 3 caractères est obligatoire.');
    END IF;

    IF e.status = 'BROUILLON' AND v_to = 'EN_ATTENTE' THEN
        IF NULLIF(btrim(COALESCE(e.image_url, '')), '') IS NULL THEN
            v_missing := v_missing || jsonb_build_object('field', 'image_url', 'message', 'Ajoutez une affiche à l''événement.');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.ticket_categories c WHERE c.event_id = v_event AND c.is_active) THEN
            v_missing := v_missing || jsonb_build_object('field', 'ticket_categories', 'message', 'Ajoutez au moins une catégorie de billets active.');
        END IF;
        IF jsonb_array_length(v_missing) > 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'SUBMIT_INCOMPLETE', 'missing', v_missing,
                                      'message', 'L''événement est incomplet : complétez-le avant de le soumettre.');
        END IF;
    END IF;
    IF v_to = 'PUBLIE' AND public.event_end_at(v_event) <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_ENDED', 'message', 'La fin de cet événement est passée : il ne peut plus être publié.');
    END IF;
    IF v_to = 'TERMINE' AND ((e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar') > now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_STARTED',
                                  'message', 'Un événement qui n''a pas commencé ne se termine pas : suspendez-le ou annulez-le.');
    END IF;

    v_history := public.event_status_apply(v_event, e.status, v_to, v_actor, v_role, v_reason, 'TRANSITION');

    -- Lot 6 : les avis (partenaire, porteurs, administrateurs) sont mis en file par le trigger
    -- trg_event_status_notify sur la ligne d'historique, dans cette même transaction.
    SELECT user_id INTO v_owner FROM public.partners WHERE id = e.partner_id;

    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'from', e.status::text, 'to', v_to::text,
                              'actor_role', v_role, 'reason', v_reason, 'history_id', v_history,
                              'title', e.title, 'partner_user_id', v_owner);
END;
$$;


-- ============================================================================
-- J1.6 — event_cancel (recopie de 20261102000003_lot5_cycle.sql:552-684) : seul l'appel à event_notify
-- disparaît ; holders_notified = nombre de porteurs distincts (avis EVENT_CANCELLED mis en file par
-- trg_event_status_notify, même transaction). Tout le reste à l'identique, dont la révocation des
-- transferts en attente et le déverrouillage des billets.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.event_cancel(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid;
    v_actor uuid;
    v_notice text := btrim(COALESCE(p->>'public_notice', ''));
    v_internal text := btrim(COALESCE(p->>'internal_reason', ''));
    v_confirm text := btrim(COALESCE(p->>'confirm_title', ''));
    e record;
    a record;
    r record;
    v_role text;
    v_cancellation uuid;
    v_reason text;
    v_cashout uuid;
    v_cashouts uuid[] := ARRAY[]::uuid[];
    v_res jsonb;
    v_holders uuid[];
    v_notified integer;
BEGIN
    BEGIN
        v_event := (p->>'event_id')::uuid;
        v_actor := (p->>'actor_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END;
    SELECT id, partner_id, status, title INTO e FROM public.events WHERE id = v_event FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (a.is_owner OR a.is_staff) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'role_missing', true,
                                  'message', 'Seuls l''organisateur de l''événement et les administrateurs peuvent l''annuler.');
    END IF;
    IF NOT a.is_active THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n''est pas actif.');
    END IF;
    IF a.is_owner AND EXISTS (SELECT 1 FROM public.event_status_transitions t
                               WHERE t.from_status = e.status AND t.to_status = 'ANNULE' AND t.actor_kind = 'PARTENAIRE' AND t.channel = 'CANCELLATION') THEN
        v_role := 'PARTENAIRE';
    ELSIF a.is_staff AND EXISTS (SELECT 1 FROM public.event_status_transitions t
                                  WHERE t.from_status = e.status AND t.to_status = 'ANNULE' AND t.actor_kind = 'ADMIN' AND t.channel = 'CANCELLATION') THEN
        v_role := 'ADMIN';
    END IF;
    IF v_role IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED',
            'message', CASE WHEN e.status = 'ANNULE' THEN 'Cet événement est déjà annulé.'
                            ELSE format('Un événement « %s » ne peut pas être annulé.', public.event_status_label(e.status::text)) END);
    END IF;
    IF v_confirm IS DISTINCT FROM btrim(e.title) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TITLE_MISMATCH',
                                  'message', 'Le titre saisi ne correspond pas au titre de l''événement.');
    END IF;
    IF char_length(v_notice) < 10 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PUBLIC_NOTICE_REQUIRED',
                                  'message', 'L''avis public doit comporter au moins 10 caractères.');
    END IF;
    IF char_length(v_internal) < 3 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INTERNAL_REASON_REQUIRED',
                                  'message', 'Le motif interne doit comporter au moins 3 caractères.');
    END IF;

    PERFORM 1 FROM public.ticket_categories WHERE event_id = v_event ORDER BY id FOR UPDATE;

    SELECT array_agg(DISTINCT t.user_id) INTO v_holders FROM public.tickets t
     WHERE t.event_id = v_event AND t.user_id IS NOT NULL AND t.status::text IN ('VALIDE', 'UTILISE');

    -- Une ligne restée d'une annulation non aboutie (statut non annulé) est remplacée
    INSERT INTO public.event_cancellations (event_id, cancelled_by, internal_reason, public_notice, cancelled_at, updated_at)
    VALUES (v_event, v_actor, v_internal, v_notice, now(), now())
    ON CONFLICT (event_id) DO UPDATE
       SET cancelled_by = EXCLUDED.cancelled_by, internal_reason = EXCLUDED.internal_reason,
           public_notice = EXCLUDED.public_notice, cancelled_at = EXCLUDED.cancelled_at, updated_at = now()
    RETURNING id INTO v_cancellation;

    PERFORM public.event_status_apply(v_event, e.status, 'ANNULE', v_actor, v_role, NULL, 'CANCELLATION');

    -- Transferts en attente révoqués
    UPDATE public.ticket_transfers SET status = 'CANCELLED', cancelled_at = now()
     WHERE status::text = 'PENDING' AND ticket_id IN (SELECT id FROM public.tickets WHERE event_id = v_event);
    UPDATE public.tickets SET transfer_locked = FALSE WHERE event_id = v_event AND transfer_locked;

    v_reason := format('Annulation de l''événement « %s »', e.title);

    -- Paiements en ligne : le reste dû au client (refund_request, lot 3)
    FOR r IN
        SELECT pay.id FROM public.payments pay
         WHERE pay.is_platform_payment AND pay.payment_target::text = 'TICKET'
           AND pay.status::text IN ('SUCCESS', 'PARTIAL') AND pay.amount > 0
           AND (pay.event_id = v_event
                OR pay.id IN (SELECT t.payment_id FROM public.tickets t WHERE t.event_id = v_event AND t.payment_id IS NOT NULL))
         ORDER BY pay.id
           FOR UPDATE OF pay
    LOOP
        v_cashout := public.refund_request(r.id, v_reason, 'EVENT_CANCELLATION_REFUND');
        IF v_cashout IS NOT NULL THEN
            v_cashouts := array_append(v_cashouts, v_cashout);
        END IF;
    END LOOP;

    -- Billets encore valables : espèces → remboursement par l'organisateur, gratuits et invitations
    -- → annulés (ticket_refund_request, lot 3) ; billet « à régler sur place » jamais payé → annulé.
    FOR r IN
        SELECT t.id, t.payment_id, t.order_id, t.price, t.category_id FROM public.tickets t
         WHERE t.event_id = v_event AND t.status::text = 'VALIDE'
         ORDER BY t.id
    LOOP
        IF r.payment_id IS NULL AND r.order_id IS NOT NULL AND COALESCE(r.price, 0) > 0 THEN
            UPDATE public.tickets SET status = 'ANNULE', updated_at = now() WHERE id = r.id AND status::text = 'VALIDE';
            UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = r.category_id;
        ELSE
            v_res := public.ticket_refund_request(r.id, v_actor, v_reason);
            IF COALESCE((v_res->>'ok')::boolean, false) AND v_res->>'cashout_id' IS NOT NULL THEN
                v_cashouts := array_append(v_cashouts, (v_res->>'cashout_id')::uuid);
            END IF;
        END IF;
    END LOOP;
    -- Reste (paiement déjà en remboursement, etc.) : aucun billet ne reste VALIDE sur un événement annulé
    UPDATE public.tickets SET status = 'ANNULE', updated_at = now() WHERE event_id = v_event AND status::text = 'VALIDE';

    -- Lot 6 : avis EVENT_CANCELLED aux porteurs mis en file par trg_event_status_notify (ligne d'historique
    -- de l'annulation, même transaction, porteurs lus avant toute modification des billets).
    v_notified := COALESCE(cardinality(v_holders), 0);

    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'cancellation_id', v_cancellation, 'actor_role', v_role,
                              'cashout_ids', to_jsonb(v_cashouts), 'holders_notified', v_notified, 'title', e.title);
END;
$$;

-- Plus aucun appelant (écriture directe dans la cloche remplacée par la boîte d'envoi).
DROP FUNCTION IF EXISTS public.event_notify(uuid[], text, text, jsonb);


-- ============================================================================
-- J1.7 — trigger d'historique : avis du cycle de vie (même transaction que event_status_apply, donc que
-- event_transition, event_cancel et events_finish_overdue)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notif_event_status_changed()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old text := NEW.old_status::text;
    v_new text := NEW.new_status::text;
    v_owner uuid;
    v_company text;
    v_data jsonb;
    v_notice text;
    h record;
BEGIN
    IF NEW.channel = 'CREATION' OR v_old IS NULL THEN
        RETURN NULL;
    END IF;
    v_data := public.notif_event_data(NEW.event_id);
    IF v_data IS NULL THEN
        RETURN NULL;   -- événement absent (cascade) : rien à prévenir
    END IF;
    SELECT pa.user_id, pa.company_name INTO v_owner, v_company
      FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = NEW.event_id;

    IF v_old = 'BROUILLON' AND v_new = 'EN_ATTENTE' THEN
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_EVENT_SUBMITTED', 'ref', NEW.id::text, 'event_id', NEW.event_id,
            'data', v_data || jsonb_strip_nulls(jsonb_build_object('company', v_company))));

    ELSIF v_old = 'EN_ATTENTE' AND v_new = 'BROUILLON' AND NEW.actor_role = 'ADMIN' THEN
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_REJECTED', 'key', 'EVENT_REJECTED:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id,
                'data', v_data || jsonb_strip_nulls(jsonb_build_object('reason', NEW.reason))));
        END IF;

    ELSIF v_old = 'EN_ATTENTE' AND v_new = 'VALIDE' THEN
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_VALIDATED', 'key', 'EVENT_VALIDATED:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id, 'data', v_data));
        END IF;

    ELSIF v_old = 'VALIDE' AND v_new = 'PUBLIE' AND NEW.actor_role = 'ADMIN' THEN
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_PUBLISHED_BY_ADMIN', 'key', 'EVENT_PUBLISHED_BY_ADMIN:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id, 'data', v_data));
        END IF;

    ELSIF v_old = 'PUBLIE' AND v_new = 'SUSPENDU' THEN
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_SUSPENDED', 'key', 'EVENT_SUSPENDED:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id,
                'data', v_data || jsonb_strip_nulls(jsonb_build_object('reason', NEW.reason))));
        END IF;
        FOR h IN
            SELECT DISTINCT t.user_id FROM public.tickets t
             WHERE t.event_id = NEW.event_id AND t.user_id IS NOT NULL AND t.status::text IN ('VALIDE', 'UTILISE')
             ORDER BY t.user_id
        LOOP
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_SUSPENDED_HOLDER', 'key', 'EVENT_SUSPENDED_HOLDER:' || NEW.id::text || ':' || h.user_id::text,
                'user_id', h.user_id, 'event_id', NEW.event_id, 'data', v_data));
        END LOOP;

    ELSIF v_old = 'SUSPENDU' AND v_new = 'PUBLIE' THEN
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_REACTIVATED', 'key', 'EVENT_REACTIVATED:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id, 'data', v_data));
        END IF;
        FOR h IN
            SELECT DISTINCT t.user_id FROM public.tickets t
             WHERE t.event_id = NEW.event_id AND t.user_id IS NOT NULL AND t.status::text IN ('VALIDE', 'UTILISE')
             ORDER BY t.user_id
        LOOP
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_REACTIVATED_HOLDER', 'key', 'EVENT_REACTIVATED_HOLDER:' || NEW.id::text || ':' || h.user_id::text,
                'user_id', h.user_id, 'event_id', NEW.event_id, 'data', v_data));
        END LOOP;

    ELSIF v_new = 'ANNULE' THEN
        -- Avis public écrit par event_cancel avant la transition ; porteurs lus avant toute modification des
        -- billets (event_cancel ne les annule qu'après) ; mode de remboursement par porteur.
        SELECT c.public_notice INTO v_notice FROM public.event_cancellations c WHERE c.event_id = NEW.event_id;
        FOR h IN
            SELECT DISTINCT t.user_id FROM public.tickets t
             WHERE t.event_id = NEW.event_id AND t.user_id IS NOT NULL AND t.status::text IN ('VALIDE', 'UTILISE')
             ORDER BY t.user_id
        LOOP
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_CANCELLED', 'key', 'EVENT_CANCELLED:' || NEW.event_id::text || ':' || h.user_id::text,
                'user_id', h.user_id, 'event_id', NEW.event_id,
                'data', v_data || jsonb_strip_nulls(jsonb_build_object(
                    'public_notice', NULLIF(btrim(COALESCE(v_notice, '')), ''),
                    'refund_mode', CASE
                        WHEN EXISTS (SELECT 1 FROM public.tickets t
                                       JOIN public.payments py ON py.id = t.payment_id
                                      WHERE t.event_id = NEW.event_id AND t.user_id = h.user_id
                                        AND t.status::text IN ('VALIDE', 'UTILISE') AND py.is_platform_payment
                                        AND COALESCE(t.price, 0) > 0) THEN 'AUTO'
                        WHEN EXISTS (SELECT 1 FROM public.tickets t
                                      WHERE t.event_id = NEW.event_id AND t.user_id = h.user_id
                                        AND t.status::text IN ('VALIDE', 'UTILISE') AND t.payment_id IS NULL
                                        AND t.order_id IS NOT NULL AND COALESCE(t.price, 0) > 0) THEN 'ORGANIZER'
                        ELSE 'NONE' END))));
        END LOOP;
    END IF;
    -- → TERMINE : aucun avis (les rappels en attente sont annulés par trg_notif_cancel_on_status).
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_status_notify ON public.event_status_history;
CREATE TRIGGER trg_event_status_notify
    AFTER INSERT ON public.event_status_history
    FOR EACH ROW EXECUTE FUNCTION public.notif_event_status_changed();


-- ============================================================================
-- J1.8 — event_update (recopie de 20261102000004_lot5_edition.sql:481-805)
-- Changements : events.notify_version incrémentée quand un champ notifié change ; pour chaque porteur,
-- EVENT_CHANGED en IN_APP et PUSH (clé de la version), SMS regroupé (la ligne SMS PENDING du porteur pour
-- l'événement reçoit l'union des champs et les nouvelles valeurs, sinon une ligne est créée), titre seul :
-- ligne SMS SKIPPED TITLE_ONLY. Plus aucune écriture dans la cloche ni dans la file du lot 5.
-- Réponse inchangée : sms_queued = lignes SMS PENDING créées ou regroupées.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.event_update(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_patch jsonb := p->'patch';
    v_expected timestamptz;
    e public.events%ROWTYPE;
    a record;
    v_key text;
    v_forbidden text[] := ARRAY['status', 'services', 'gallery_urls', 'ticket_categories', 'slug', 'partner_id', 'is_featured',
                                'featured_until', 'id', 'created_at', 'updated_at'];
    v_allowed text[] := ARRAY['title', 'category', 'description', 'start_date', 'start_time', 'end_date', 'end_time', 'location',
                              'city', 'latitude', 'longitude', 'image_url', 'capacity', 'program', 'practical_info'];
    n_title text;
    n_category event_category;
    n_description text;
    n_start_date date;
    n_start_time time;
    n_end_date date;
    n_end_time time;
    n_location text;
    n_city text;
    n_lat double precision;
    n_lng double precision;
    n_image text;
    n_capacity integer;
    n_program jsonb;
    n_practical jsonb;
    v_post boolean;
    v_has_sales boolean;
    v_start_changed boolean;
    v_dates_changed boolean;
    v_new_start timestamptz;
    v_old_end timestamptz;
    v_new_end timestamptz;
    v_engaged integer;
    v_quota integer;
    v_late jsonb;
    v_late_names text;
    v_changed text[] := ARRAY[]::text[];
    v_labels text[] := ARRAY[]::text[];
    v_sms boolean := false;
    v_holders uuid[];
    v_notified integer := 0;
    v_sms_queued integer := 0;
    v_version integer;
    v_row jsonb;
    v_holder uuid;
    v_nkey text;
    v_data jsonb;
    v_pending_id uuid;
    v_pending_data jsonb;
BEGIN
    IF v_event IS NULL THEN
        RETURN public.event_edit_refusal('EVENT_NOT_FOUND', 'Événement introuvable.');
    END IF;
    IF v_patch IS NULL OR jsonb_typeof(v_patch) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les modifications de l''événement sont illisibles.');
    END IF;
    BEGIN
        v_expected := (p->>'expected_updated_at')::timestamptz;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
        v_expected := NULL;
    END;
    IF v_expected IS NULL THEN
        RETURN public.event_edit_refusal('EXPECTED_VERSION_REQUIRED', 'Version de l''événement manquante : rechargez la page puis recommencez.');
    END IF;

    SELECT * INTO e FROM public.events WHERE id = v_event FOR UPDATE;
    IF NOT FOUND THEN
        RETURN public.event_edit_refusal('EVENT_NOT_FOUND', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT a.is_owner THEN
        IF a.is_staff THEN
            RETURN public.event_edit_refusal('ADMIN_CANNOT_EDIT', 'Seul l''organisateur modifie son événement ; l''administration agit par les changements de statut.');
        END IF;
        RETURN public.event_edit_refusal('EVENT_NOT_FOUND', 'Événement introuvable.');
    END IF;
    IF NOT a.is_active THEN
        RETURN public.event_edit_refusal('ACCOUNT_NOT_ACTIVE', 'Votre compte n''est pas actif.');
    END IF;

    SELECT k INTO v_key FROM jsonb_object_keys(v_patch) AS k
     WHERE k = ANY (v_forbidden) OR k <> ALL (v_allowed)
     ORDER BY k LIMIT 1;
    IF v_key IS NOT NULL THEN
        RETURN public.event_edit_refusal('FIELD_NOT_EDITABLE', 'Ce champ ne se modifie pas depuis le formulaire de l''événement.', v_key);
    END IF;

    IF e.status::text = 'EN_ATTENTE' THEN
        RETURN public.event_edit_refusal('WITHDRAW_TO_EDIT', 'L''événement est en cours de validation : retirez-le de la validation pour le modifier.');
    END IF;
    IF e.status::text IN ('TERMINE', 'ANNULE') THEN
        RETURN public.event_edit_refusal('EVENT_LOCKED', 'Un événement terminé ou annulé ne peut plus être modifié.');
    END IF;
    IF e.updated_at IS DISTINCT FROM v_expected THEN
        RETURN public.event_edit_refusal('EDIT_CONFLICT', 'L''événement a été modifié entre-temps : rechargez la page pour voir la dernière version.');
    END IF;
    v_post := e.status::text IN ('VALIDE', 'PUBLIE', 'SUSPENDU');

    -- Nouvelles valeurs (colonnes absentes du patch : inchangées)
    n_title := e.title; n_category := e.category; n_description := e.description;
    n_start_date := e.start_date; n_start_time := e.start_time; n_end_date := e.end_date; n_end_time := e.end_time;
    n_location := e.location; n_city := e.city; n_lat := e.latitude; n_lng := e.longitude; n_image := e.image_url;
    n_capacity := e.capacity; n_program := e.program; n_practical := e.practical_info;
    BEGIN
        IF v_patch ? 'title' THEN n_title := btrim(v_patch->>'title'); END IF;
        v_key := 'category';
        IF v_patch ? 'category' THEN n_category := (v_patch->>'category')::event_category; END IF;
        v_key := NULL;
        IF v_patch ? 'description' THEN n_description := NULLIF(btrim(COALESCE(v_patch->>'description', '')), ''); END IF;
        IF v_patch ? 'start_date' THEN n_start_date := (v_patch->>'start_date')::date; END IF;
        IF v_patch ? 'start_time' THEN n_start_time := (v_patch->>'start_time')::time; END IF;
        IF v_patch ? 'end_date' THEN n_end_date := NULLIF(v_patch->>'end_date', '')::date; END IF;
        IF v_patch ? 'end_time' THEN n_end_time := NULLIF(v_patch->>'end_time', '')::time; END IF;
        IF v_patch ? 'location' THEN n_location := btrim(v_patch->>'location'); END IF;
        IF v_patch ? 'city' THEN n_city := btrim(v_patch->>'city'); END IF;
        IF v_patch ? 'latitude' THEN n_lat := (v_patch->>'latitude')::double precision; END IF;
        IF v_patch ? 'longitude' THEN n_lng := (v_patch->>'longitude')::double precision; END IF;
        IF v_patch ? 'image_url' THEN n_image := NULLIF(btrim(COALESCE(v_patch->>'image_url', '')), ''); END IF;
        IF v_patch ? 'capacity' THEN n_capacity := (v_patch->>'capacity')::integer; END IF;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
        IF v_key = 'category' THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une catégorie d''événement dans la liste.', 'category');
        END IF;
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Une valeur modifiée est illisible.');
    END;
    IF v_patch ? 'program' THEN
        n_program := CASE jsonb_typeof(v_patch->'program') WHEN 'array' THEN v_patch->'program' WHEN 'null' THEN '[]'::jsonb END;
        IF n_program IS NULL OR jsonb_array_length(n_program) > 50 THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Le programme compte 50 lignes au plus.', 'program');
        END IF;
    END IF;
    IF v_patch ? 'practical_info' THEN
        n_practical := CASE jsonb_typeof(v_patch->'practical_info') WHEN 'object' THEN v_patch->'practical_info' WHEN 'null' THEN '{}'::jsonb END;
        IF n_practical IS NULL THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Les informations pratiques sont illisibles.', 'practical_info');
        END IF;
    END IF;
    -- Heure renvoyée par le formulaire en HH:mm : identique à la minute près = inchangée (R29)
    IF n_start_time IS NOT NULL AND e.start_time IS NOT NULL AND to_char(n_start_time, 'HH24:MI') = to_char(e.start_time, 'HH24:MI') THEN
        n_start_time := e.start_time;
    END IF;
    IF n_end_time IS NOT NULL AND e.end_time IS NOT NULL AND to_char(n_end_time, 'HH24:MI') = to_char(e.end_time, 'HH24:MI') THEN
        n_end_time := e.end_time;
    END IF;

    -- Défense : bornes de F1 (déjà contrôlées par le schéma partagé), sur les seuls champs envoyés
    IF v_patch ? 'title' AND (n_title IS NULL OR char_length(n_title) < 3 OR char_length(n_title) > 120) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le titre compte de 3 à 120 caractères.', 'title');
    END IF;
    IF v_patch ? 'category' AND n_category IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une catégorie d''événement dans la liste.', 'category');
    END IF;
    IF v_patch ? 'description' AND n_description IS NOT NULL AND char_length(n_description) > 5000 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La description ne dépasse pas 5 000 caractères.', 'description');
    END IF;
    IF v_patch ? 'location' AND (n_location IS NULL OR char_length(n_location) < 2 OR char_length(n_location) > 200) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le lieu compte de 2 à 200 caractères.', 'location');
    END IF;
    IF v_patch ? 'city' AND (n_city IS NULL OR char_length(n_city) < 2 OR char_length(n_city) > 80) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La ville compte de 2 à 80 caractères.', 'city');
    END IF;
    IF n_start_date IS NULL OR n_start_time IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La date et l''heure de début sont obligatoires.', 'start_date');
    END IF;
    IF n_lat IS NOT NULL AND (n_lat < -90 OR n_lat > 90) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La latitude est comprise entre -90 et 90.', 'latitude');
    END IF;
    IF n_lng IS NOT NULL AND (n_lng < -180 OR n_lng > 180) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La longitude est comprise entre -180 et 180.', 'longitude');
    END IF;
    IF n_capacity IS NOT NULL AND (n_capacity < 1 OR n_capacity > 100000) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La jauge est un nombre entier de 1 à 100 000.', 'capacity');
    END IF;
    IF n_image IS DISTINCT FROM e.image_url AND NOT public.event_poster_path_ok(n_image, e.partner_id) THEN
        RETURN public.event_edit_refusal('IMAGE_ORIGIN_INVALID', 'L''affiche doit être déposée depuis le formulaire de l''événement.', 'image_url');
    END IF;

    -- Dates (Africa/Dakar) : début dans le futur s'il change, fin après le début
    v_start_changed := n_start_date IS DISTINCT FROM e.start_date OR n_start_time IS DISTINCT FROM e.start_time;
    v_dates_changed := v_start_changed OR n_end_date IS DISTINCT FROM e.end_date OR n_end_time IS DISTINCT FROM e.end_time;
    IF n_end_time IS NOT NULL AND n_end_date IS NULL THEN
        RETURN public.event_edit_refusal('END_DATE_REQUIRED', 'Indiquez la date de fin pour l''heure de fin saisie.', 'end_date');
    END IF;
    v_new_start := (n_start_date + n_start_time) AT TIME ZONE 'Africa/Dakar';
    IF v_start_changed AND v_new_start <= now() THEN
        RETURN public.event_edit_refusal('EVENT_START_PAST', 'Le nouveau début de l''événement doit être dans le futur (heure de Dakar).', 'start_date');
    END IF;
    v_old_end := public.event_end_from(e.start_date, e.end_date, e.end_time);
    v_new_end := public.event_end_from(n_start_date, n_end_date, n_end_time);
    IF v_dates_changed AND n_end_date IS NOT NULL AND v_new_end <= v_new_start THEN
        RETURN public.event_edit_refusal('EVENT_END_BEFORE_START', 'La fin de l''événement doit être postérieure à son début.',
                                         CASE WHEN n_end_time IS NOT NULL THEN 'end_time' ELSE 'end_date' END);
    END IF;

    PERFORM 1 FROM public.ticket_categories WHERE event_id = v_event ORDER BY id FOR UPDATE;
    v_has_sales := public.event_has_sales(v_event);

    -- Verrouillés dès qu'il y a des ventes : catégorie d'événement, jauge supprimée ou sous vendus + réservés
    IF v_has_sales AND n_category IS DISTINCT FROM e.category THEN
        RETURN public.event_edit_refusal('LOCKED_AFTER_SALES', 'La catégorie de l''événement ne change plus : des billets ont été vendus ou réservés.', 'category');
    END IF;
    IF n_capacity IS DISTINCT FROM e.capacity THEN
        SELECT COALESCE(sum(c.sold_quantity + c.held_quantity), 0)::int,
               COALESCE(sum(c.total_quantity) FILTER (WHERE c.is_active), 0)::int
          INTO v_engaged, v_quota
          FROM public.ticket_categories c WHERE c.event_id = v_event;
        IF v_has_sales AND n_capacity IS NULL THEN
            RETURN public.event_edit_refusal('LOCKED_AFTER_SALES', 'La jauge ne peut plus être supprimée : des billets ont été vendus ou réservés.', 'capacity');
        END IF;
        IF v_has_sales AND n_capacity < v_engaged THEN
            RETURN public.event_edit_refusal('LOCKED_AFTER_SALES',
                format('La jauge ne peut pas descendre sous %s : billets vendus et paiements en cours compris.', v_engaged), 'capacity');
        END IF;
        IF n_capacity IS NOT NULL AND n_capacity < v_quota THEN
            RETURN public.event_edit_refusal('CAPACITY_BELOW_QUOTAS',
                format('La jauge ne peut pas descendre sous la somme des quotas des catégories actives (%s) : baissez d''abord les quotas.', v_quota), 'capacity');
        END IF;
    END IF;

    -- Une fin de vente ne dépasse jamais la fin de l'événement
    IF v_dates_changed THEN
        SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'sale_end', c.sale_end) ORDER BY c.name, c.id),
               string_agg(format('« %s »', c.name), ', ' ORDER BY c.name, c.id)
          INTO v_late, v_late_names
          FROM public.ticket_categories c
         WHERE c.event_id = v_event AND c.sale_end IS NOT NULL AND c.sale_end > v_new_end;
        IF v_late IS NOT NULL THEN
            RETURN public.event_edit_refusal('SALE_END_AFTER_EVENT',
                format('La fin de vente de %s dépasse la nouvelle fin de l''événement : avancez d''abord la fin de vente.', v_late_names),
                CASE WHEN v_patch ? 'end_time' THEN 'end_time' WHEN v_patch ? 'end_date' THEN 'end_date' ELSE 'start_date' END,
                jsonb_build_object('categories', v_late));
        END IF;
    END IF;

    -- Champs notifiés (après publication) : titre, dates et heures, lieu, ville, adresse
    IF v_post THEN
        IF n_title IS DISTINCT FROM e.title THEN
            v_changed := array_append(v_changed, 'title'); v_labels := array_append(v_labels, 'le titre');
        END IF;
        IF n_start_date IS DISTINCT FROM e.start_date OR n_end_date IS DISTINCT FROM e.end_date THEN
            IF n_start_date IS DISTINCT FROM e.start_date THEN v_changed := array_append(v_changed, 'start_date'); END IF;
            IF n_end_date IS DISTINCT FROM e.end_date THEN v_changed := array_append(v_changed, 'end_date'); END IF;
            v_labels := array_append(v_labels, 'la date');
        END IF;
        IF n_start_time IS DISTINCT FROM e.start_time OR n_end_time IS DISTINCT FROM e.end_time THEN
            IF n_start_time IS DISTINCT FROM e.start_time THEN v_changed := array_append(v_changed, 'start_time'); END IF;
            IF n_end_time IS DISTINCT FROM e.end_time THEN v_changed := array_append(v_changed, 'end_time'); END IF;
            v_labels := array_append(v_labels, 'l''horaire');
        END IF;
        IF n_location IS DISTINCT FROM e.location OR n_city IS DISTINCT FROM e.city
           OR NULLIF(btrim(COALESCE(n_practical->>'address', '')), '') IS DISTINCT FROM NULLIF(btrim(COALESCE(e.practical_info->>'address', '')), '') THEN
            IF n_location IS DISTINCT FROM e.location THEN v_changed := array_append(v_changed, 'location'); END IF;
            IF n_city IS DISTINCT FROM e.city THEN v_changed := array_append(v_changed, 'city'); END IF;
            IF NULLIF(btrim(COALESCE(n_practical->>'address', '')), '') IS DISTINCT FROM NULLIF(btrim(COALESCE(e.practical_info->>'address', '')), '') THEN
                v_changed := array_append(v_changed, 'address');
            END IF;
            v_labels := array_append(v_labels, 'le lieu');
        END IF;
        v_sms := EXISTS (SELECT 1 FROM unnest(v_changed) AS f WHERE f <> 'title');
    END IF;
    v_version := e.notify_version + CASE WHEN cardinality(v_changed) > 0 THEN 1 ELSE 0 END;

    UPDATE public.events
       SET title = n_title, category = n_category, description = n_description,
           start_date = n_start_date, start_time = n_start_time, end_date = n_end_date, end_time = n_end_time,
           location = n_location, city = n_city, latitude = n_lat, longitude = n_lng, image_url = n_image,
           capacity = n_capacity, program = n_program, practical_info = n_practical, notify_version = v_version,
           updated_at = now()
     WHERE id = v_event;

    -- Fonds : une fin qui recule repousse la disponibilité des crédits VENTE pas encore disponibles ; jamais d'avancement
    IF v_new_end > v_old_end THEN
        UPDATE public.finance_ledger l
           SET available_at = GREATEST(l.available_at, public.fin_payout_available_at(l.payment_id))
         WHERE l.entry_type = 'VENTE' AND l.available_at > now()
           AND l.payment_id IN (SELECT py.id FROM public.payments py WHERE py.event_id = v_event);
    END IF;

    -- Porteurs prévenus : billets VALIDE (et UTILISE pour un événement de plusieurs jours), comptes non supprimés
    IF cardinality(v_changed) > 0 THEN
        SELECT array_agg(DISTINCT t.user_id) INTO v_holders
          FROM public.tickets t JOIN public.users u ON u.id = t.user_id
         WHERE t.event_id = v_event AND t.user_id IS NOT NULL AND u.status::text <> 'SUPPRIME'
           AND (t.status::text = 'VALIDE'
                OR (t.status::text = 'UTILISE' AND n_end_date IS NOT NULL AND n_end_date > n_start_date));
        v_notified := COALESCE(cardinality(v_holders), 0);
    END IF;
    IF v_notified > 0 THEN
        -- Données du modèle EVENT_CHANGED (valeurs d'après la modification, nouvelles valeurs des champs changés)
        v_data := jsonb_strip_nulls(jsonb_build_object(
            'event_id', v_event, 'title', n_title, 'start_at', v_new_start, 'location', n_location, 'city', n_city,
            'changed_fields', to_jsonb(v_changed),
            'new_start_at', CASE WHEN v_start_changed THEN v_new_start END,
            'new_end_at', CASE WHEN 'end_date' = ANY (v_changed) OR 'end_time' = ANY (v_changed) THEN v_new_end END,
            'new_location', CASE WHEN 'location' = ANY (v_changed) THEN n_location END,
            'new_address', CASE WHEN 'address' = ANY (v_changed) THEN NULLIF(btrim(COALESCE(n_practical->>'address', '')), '') END,
            'new_city', CASE WHEN 'city' = ANY (v_changed) THEN n_city END,
            'old_title', CASE WHEN 'title' = ANY (v_changed) THEN e.title END));
        FOREACH v_holder IN ARRAY v_holders LOOP
            v_nkey := 'EVENT_CHANGED:' || v_event::text || ':' || v_holder::text || ':v' || v_version::text;
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                'data', v_data, 'channels', jsonb_build_array('IN_APP', 'PUSH')));

            -- SMS regroupé : la ligne en attente du porteur pour cet événement reçoit l'union des champs
            v_pending_id := NULL;
            SELECT o.id, o.template_data INTO v_pending_id, v_pending_data
              FROM public.notification_outbox o
             WHERE o.event_id = v_event AND o.recipient_user_id = v_holder
               AND o.type = 'EVENT_CHANGED' AND o.channel = 'SMS' AND o.status = 'PENDING'
             ORDER BY o.created_at, o.id
             LIMIT 1
               FOR UPDATE;
            IF v_pending_id IS NOT NULL THEN
                UPDATE public.notification_outbox
                   SET template_data = (v_pending_data - 'migrated_from') || v_data || jsonb_build_object('changed_fields', (
                           SELECT COALESCE(jsonb_agg(f ORDER BY f), '[]'::jsonb)
                             FROM (SELECT jsonb_array_elements_text(COALESCE(v_pending_data->'changed_fields', '[]'::jsonb)) AS f
                                   UNION
                                   SELECT unnest(v_changed)) x))
                 WHERE id = v_pending_id;
                IF v_sms THEN
                    v_sms_queued := v_sms_queued + 1;
                END IF;
            END IF;
            IF v_sms AND v_pending_id IS NULL THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                    'data', v_data, 'channels', jsonb_build_array('SMS')));
                IF EXISTS (SELECT 1 FROM public.notification_outbox o
                            WHERE o.idempotency_key = v_nkey || ':SMS' AND o.status = 'PENDING') THEN
                    v_sms_queued := v_sms_queued + 1;
                END IF;
            ELSIF NOT v_sms THEN
                -- Titre seul : aucun SMS, trace SKIPPED (le SMS déjà en attente porte le nouveau titre)
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                    'data', v_data, 'channels', jsonb_build_array('SMS'),
                    'skip', jsonb_build_object('SMS', 'TITLE_ONLY')));
            END IF;
        END LOOP;
    END IF;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', CASE WHEN v_post THEN 'EVENT_LIVE_UPDATED' ELSE 'EVENT_UPDATED' END, 'EVENT', v_event,
            jsonb_build_object('status', e.status::text,
                               'fields', (SELECT COALESCE(jsonb_agg(k ORDER BY k), '[]'::jsonb) FROM jsonb_object_keys(v_patch) AS k),
                               'notified_fields', to_jsonb(v_changed), 'notified_holders', v_notified, 'sms_queued', v_sms_queued,
                               'end_moved_later', v_new_end > v_old_end));

    SELECT to_jsonb(ev) INTO v_row FROM public.events ev WHERE ev.id = v_event;
    RETURN jsonb_build_object('ok', true, 'event', v_row, 'notified_holders', v_notified, 'sms_queued', v_sms_queued,
                              'changed_fields', to_jsonb(v_changed));
END;
$$;


-- ============================================================================
-- J1.9 — absorption de la file des SMS de changement du lot 5 dans la boîte d'envoi
-- Une ligne SMS par ligne reprise, clé EVENT_CHANGED:<event>:<porteur>:v<version>:SMS ; statut selon la
-- table du contrat (PENDING repris, SENDING → UNCERTAIN, SENT repris, NOT_REQUIRED → SKIPPED TITLE_ONLY,
-- REFUSED NO_PHONE → SKIPPED MIGRATED_NO_PHONE, autres refus et FAILED → FAILED MIGRATED_FAILED,
-- CANCELLED → NO_LONGER_RELEVANT, SUPERSEDED → SUPERSEDED). Instantané d'une ligne envoyée : étape
-- MIGRATION, préférence activée et plage de silence vide (aucune des deux règles n'existait au lot 5).
-- ============================================================================
-- reprise:debut
INSERT INTO public.notification_outbox (
    idempotency_key, group_key, type, family, topic, channel, origin,
    recipient_user_id, event_id, template_data, status, reason, reason_detail,
    attempts, max_attempts, due_at, next_attempt_at, claimed_at, sent_at, finished_at, decision, created_at
)
SELECT 'EVENT_CHANGED:' || n.event_id::text || ':' || n.user_id::text || ':v' || n.version::text || ':SMS',
       'EVENT_CHANGED:' || n.event_id::text || ':' || n.user_id::text || ':v' || n.version::text,
       'EVENT_CHANGED', 'OPTIONAL', 'EVENT_UPDATES', 'SMS', 'OUTBOX',
       n.user_id, n.event_id,
       jsonb_build_object('changed_fields', to_jsonb(n.changed_fields), 'migrated_from', 'event_change_notifications'),
       CASE n.sms_status
           WHEN 'PENDING' THEN 'PENDING'
           WHEN 'SENDING' THEN 'UNCERTAIN'
           WHEN 'SENT' THEN 'SENT'
           WHEN 'NOT_REQUIRED' THEN 'SKIPPED'
           WHEN 'REFUSED' THEN CASE WHEN n.sms_code = 'NO_PHONE' THEN 'SKIPPED' ELSE 'FAILED' END
           WHEN 'FAILED' THEN 'FAILED'
           ELSE 'CANCELLED'
       END,
       CASE n.sms_status
           WHEN 'PENDING' THEN NULL
           WHEN 'SENDING' THEN 'MIGRATED_WHILE_SENDING'
           WHEN 'SENT' THEN NULL
           WHEN 'NOT_REQUIRED' THEN 'TITLE_ONLY'
           WHEN 'REFUSED' THEN CASE WHEN n.sms_code = 'NO_PHONE' THEN 'MIGRATED_NO_PHONE' ELSE 'MIGRATED_FAILED' END
           WHEN 'FAILED' THEN 'MIGRATED_FAILED'
           WHEN 'SUPERSEDED' THEN 'SUPERSEDED'
           ELSE 'NO_LONGER_RELEVANT'
       END,
       CASE WHEN (n.sms_status = 'REFUSED' AND n.sms_code IS DISTINCT FROM 'NO_PHONE') OR n.sms_status = 'FAILED'
            THEN left(COALESCE(NULLIF(btrim(n.sms_code), ''), 'inconnu'), 500) END,
       LEAST(GREATEST(n.attempts, 0), 5), 5,
       n.created_at,
       COALESCE(n.next_attempt_at, n.created_at),
       CASE WHEN n.sms_status = 'SENDING' THEN n.claimed_at END,
       CASE n.sms_status
           WHEN 'SENT' THEN COALESCE(n.sent_at, n.updated_at)
           WHEN 'SENDING' THEN COALESCE(n.claimed_at, n.updated_at)
       END,
       CASE WHEN n.sms_status <> 'PENDING' THEN n.updated_at END,
       CASE WHEN n.sms_status = 'SENT' THEN jsonb_build_object(
                'at', COALESCE(n.sent_at, n.updated_at), 'stage', 'MIGRATION', 'outcome', 'SEND',
                'migrated_from', 'event_change_notifications', 'family', 'OPTIONAL', 'topic', 'EVENT_UPDATES',
                'preference', jsonb_build_object('topic', 'EVENT_UPDATES', 'channel', 'SMS', 'enabled', true),
                'quiet', jsonb_build_object('start', 0, 'end', 0, 'in_quiet', false))
       END,
       n.created_at
  FROM public.event_change_notifications n
 ORDER BY n.created_at, n.id
ON CONFLICT DO NOTHING;
-- reprise:fin

DROP FUNCTION IF EXISTS public.event_change_notifications_claim(jsonb);
DROP FUNCTION IF EXISTS public.event_change_notifications_mark(jsonb);
DROP TABLE IF EXISTS public.event_change_notifications;


-- ============================================================================
-- Privilèges : service_role uniquement (règle 1A.3, triggers compris)
-- ============================================================================
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.notif_event_data(uuid)',
        'public.ticket_transfer_initiate(jsonb)',
        'public.ticket_transfer_cancel(jsonb)',
        'public.ticket_transfers_expire(jsonb)',
        'public.ticket_transfers_incoming(jsonb)',
        'public.ticket_transfer_accept(jsonb)',
        'public.payment_confirm(uuid, text)',
        'public.free_tickets_claim(uuid, uuid, jsonb)',
        'public.counter_sale(jsonb)',
        'public.event_transition(jsonb)',
        'public.event_cancel(jsonb)',
        'public.event_update(jsonb)',
        'public.notif_tickets_first_sale()',
        'public.notif_tickets_scanned()',
        'public.notif_ticket_categories_sold_out()',
        'public.notif_event_status_changed()'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
