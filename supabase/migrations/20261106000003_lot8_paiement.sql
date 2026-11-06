-- ============================================================================
-- EVENT VILLAGE — LOT 8, TÂCHES 8.2 a et b : double paiement, ordre unique des verrous (contrat 2.3, 2.6, 6.1,
-- 6.2, L30 à L34, AR4)
-- ============================================================================
-- Double paiement (8.2 a) : le second paiement réussi d'un même panier est remboursé par le module de cashout
-- existant (kind REFUND, frais d'agrégateur à la charge d'Event Village), avec un avis REFUND_PAID au client et
-- une alerte ADMIN_DUPLICATE_PAYMENT. Le paiement passe à REFUND_PENDING sans passer par SUCCESS : ni VENTE, ni
-- commission, ni billet. Le contrôle se fait sous le verrou de l'événement : aucune course entre deux confirmations.
--
-- Ordre unique dans payment_confirm et event_cancel :
--     events (FOR NO KEY UPDATE) → paiements (par id) → catégories (par id) → transferts → billets.
-- Le cycle réel passe par la clé étrangère vers events : une transaction tient une catégorie ou un billet et
-- veut FOR KEY SHARE sur l'événement, pendant qu'event_cancel tient l'événement FOR UPDATE et attend cette
-- catégorie ou ce billet. FOR NO KEY UPDATE ne bloque pas FOR KEY SHARE, et reste en conflit avec le FOR SHARE
-- de ticket_transfer_accept (D20 tient).
--
-- Conséquence (L34) : deux confirmations d'un même événement se sérialisent (avant : par catégorie).
-- Hors de ce fichier, aucune fonction ne change d'ordre (contrat 2.3) ; points ouverts PO3 et PO4.
--
-- Rejouable : CREATE OR REPLACE ; aucun BEGIN ni COMMIT de transaction. Dépend de 20261105000003 et 20261105000007.
-- Privilèges (règle 1A.3) : SECURITY DEFINER, search_path = public, volatilité explicite ; service_role seul.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Type de notification de l'alerte (L32) : aucun nouveau kind dans admin_signals (AR2)
-- ----------------------------------------------------------------------------
INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission)
VALUES ('ADMIN_DUPLICATE_PAYMENT', 'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL'], 'ADMIN', 'BLOCK', FALSE, 'refunds.manage')
ON CONFLICT (type) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2. payment_duplicate_of(uuid) (nouvelle, L30) : paiement déjà réglé dont p_payment_id serait le double
-- ----------------------------------------------------------------------------
-- Même panier : mêmes catégories et mêmes quantités (lues sur stock_reservations, jamais sur
-- metadata.checkout_items), même compte, même événement, plateforme, billetterie. Le paiement conservé Y est
-- réglé (SUCCESS, PARTIAL) et X a été créé avant la confirmation de Y, sans borne de durée : un rachat fait après
-- la confirmation n'est jamais touché. Un paiement entièrement remboursé ne compte plus.
CREATE OR REPLACE FUNCTION public.payment_duplicate_of(p_payment_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH x AS (
        SELECT p.id, p.client_id, p.event_id, p.created_at,
               (SELECT array_agg(r.category_id::text || ':' || r.quantity ORDER BY r.category_id::text)
                  FROM public.stock_reservations r WHERE r.payment_id = p.id) AS panier
          FROM public.payments p
         WHERE p.id = p_payment_id AND p.client_id IS NOT NULL
           AND p.payment_target::text = 'TICKET' AND p.is_platform_payment
    )
    SELECT y.id
      FROM x
      JOIN public.payments y
        ON y.id <> x.id AND y.client_id = x.client_id AND y.event_id = x.event_id
       AND y.payment_target::text = 'TICKET' AND y.is_platform_payment
       AND y.status::text IN ('SUCCESS', 'PARTIAL')
       AND x.created_at < y.paid_at
     WHERE x.panier = (SELECT array_agg(r.category_id::text || ':' || r.quantity ORDER BY r.category_id::text)
                         FROM public.stock_reservations r WHERE r.payment_id = y.id)
     ORDER BY y.paid_at, y.id
     LIMIT 1
$$;
COMMENT ON FUNCTION public.payment_duplicate_of(uuid) IS
    'Lot 8 (8.2 a, L30) : id du paiement déjà réglé pour le même panier, ou NULL. Appelée par payment_confirm sous le verrou de l''événement.';


-- ============================================================================
-- 3. payment_confirm (recopie intégrale de 20261105000007_lot7_confirmation.sql:57-197)
-- Changement (8.2 b) : avant le verrou du paiement, lecture sans verrou de son statut et de son événement
-- (event_id et panier ne changent pas après la création), puis verrou de l'événement, sauf statut final : un
-- rejeu de webhook n'attend pas une annulation. NOT_FOUND et NOT_TICKET inchangés. Le reste relit sous
-- FOR UPDATE, à l'identique.
-- Changements (8.2 a) : après la boucle du panier, contrôle du double paiement, si rien d'autre ne bloque. Dans
-- la branche de remboursement : metadata.duplicate_of, motif « Paiement en double du même panier », alerte
-- ADMIN_DUPLICATE_PAYMENT, duplicate_of dans le résultat. Le corps sans double est inchangé, résultat compris.
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
    v_seen text;
    v_lock_event uuid;
    v_duplicate uuid;
BEGIN
    -- Lot 8 (8.2 b) : événement d'abord (ordre unique, contrat 2.3)
    SELECT p.status::text, COALESCE(p.event_id,
             (SELECT c.event_id FROM public.stock_reservations r
                JOIN public.ticket_categories c ON c.id = r.category_id
               WHERE r.payment_id = p.id LIMIT 1))
      INTO v_seen, v_lock_event
      FROM public.payments p WHERE p.id = p_payment_id AND p.payment_target::text = 'TICKET';
    IF v_lock_event IS NOT NULL AND v_seen NOT IN ('SUCCESS', 'PARTIAL', 'REFUNDED', 'REFUND_PENDING') THEN
        PERFORM 1 FROM public.events WHERE id = v_lock_event FOR NO KEY UPDATE;
    END IF;

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

    -- Lot 8 (8.2 a) : second paiement réussi d'un même panier, sous le verrou de l'événement
    IF v_blocking IS NULL THEN
        v_duplicate := public.payment_duplicate_of(p_payment_id);
        IF v_duplicate IS NOT NULL THEN
            v_blocking := format('paiement en double du panier déjà réglé (%s)', v_duplicate);
        END IF;
    END IF;

    IF v_blocking IS NOT NULL THEN
        UPDATE public.stock_reservations SET status = 'RELEASED', closed_at = now(), close_reason = 'REFUND'
         WHERE payment_id = p_payment_id AND status = 'ACTIVE';
        UPDATE public.payments
           SET status = 'REFUND_PENDING', provider_status = 'SUCCESS', provider_final = TRUE, paid_at = now(),
               confirmed_source = p_source,
               metadata = metadata || jsonb_build_object('refund_reason', v_blocking)
                          || CASE WHEN v_duplicate IS NULL THEN '{}'::jsonb
                                  ELSE jsonb_build_object('duplicate_of', v_duplicate) END
         WHERE id = p_payment_id;
        IF v_duplicate IS NULL THEN
            v_cashout := public.refund_request(p_payment_id, 'Panier impossible à honorer : ' || v_blocking, 'REFUND');
            RETURN jsonb_build_object('result', 'REFUND_REQUIRED', 'reason', v_blocking, 'cashout_id', v_cashout);
        END IF;
        v_cashout := public.refund_request(p_payment_id, 'Paiement en double du même panier', 'REFUND');
        PERFORM public.notif_enqueue_admins(jsonb_build_object('type', 'ADMIN_DUPLICATE_PAYMENT', 'ref', p_payment_id, 'event_id', v_lock_event,
            'data', jsonb_build_object('payment_id', p_payment_id, 'duplicate_of', v_duplicate, 'amount', v_pay.amount)));
        RETURN jsonb_build_object('result', 'REFUND_REQUIRED', 'reason', v_blocking, 'cashout_id', v_cashout, 'duplicate_of', v_duplicate);
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
            -- Lot 7 (7.9, D87) : catégories, quantités et 10 premiers numéros figés à l'émission
            -- (ticket_count vient de notif_ticket_lines : même valeur que la longueur de v_ticket_ids).
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'PURCHASE_CONFIRMED', 'key', 'PURCHASE_CONFIRMED:' || p_payment_id::text,
                'user_id', v_pay.client_id, 'phone', v_payer, 'event_id', v_event,
                'data', v_data || public.notif_ticket_lines(v_ticket_ids) || jsonb_build_object(
                    'payment_id', p_payment_id,
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
-- 4. event_cancel (recopie intégrale de 20261105000003_lot7_securite.sql:97-239)
-- Changements (8.2 b) : l'événement est pris FOR NO KEY UPDATE au lieu de FOR UPDATE ; juste avant le verrou
-- des catégories, tous les paiements de l'événement sont verrouillés dans l'ordre des identifiants, tous
-- statuts et hors plateforme compris (ticket_refund_request verrouille aussi les paiements en espèces). La
-- boucle des remboursements reste telle quelle : son second verrou est sans effet. Aucune autre instruction ne
-- reverrouille events, et event_status_apply n'écrit que status et updated_at : pas de montée de verrou.
-- Ordre final : events → paiements → catégories → transferts → billets.
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
    SELECT id, partner_id, status, title INTO e FROM public.events WHERE id = v_event FOR NO KEY UPDATE;
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

    -- Lot 8 (8.2 b) : paiements avant catégories (ordre unique, contrat 2.3)
    PERFORM 1 FROM public.payments pay
     WHERE pay.event_id = v_event
        OR pay.id IN (SELECT t.payment_id FROM public.tickets t WHERE t.event_id = v_event AND t.payment_id IS NOT NULL)
     ORDER BY pay.id FOR UPDATE OF pay;

    PERFORM 1 FROM public.ticket_categories WHERE event_id = v_event ORDER BY id FOR UPDATE;

    -- Lot 7 (D20) : transferts en attente puis billets de l'événement verrouillés avant la lecture des
    -- porteurs (même ordre que ticket_transfer_initiate et ticket_transfer_claim : transfert, puis billet).
    PERFORM 1 FROM public.ticket_transfers x
     WHERE x.status::text = 'PENDING'
       AND x.ticket_id IN (SELECT t.id FROM public.tickets t WHERE t.event_id = v_event)
     ORDER BY x.id
       FOR UPDATE OF x;
    PERFORM 1 FROM public.tickets t WHERE t.event_id = v_event ORDER BY t.id FOR UPDATE OF t;

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


-- ============================================================================
-- Privilèges : service_role uniquement (règle 1A.3)
-- ============================================================================
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.payment_duplicate_of(uuid)',
        'public.payment_confirm(uuid, text)',
        'public.event_cancel(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
