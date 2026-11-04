-- ============================================================================
-- EVENT VILLAGE — LOT 7, TÂCHE 7.0 c : sécurité (contrat M3, décisions D20, D21, D23)
-- ============================================================================
--  1. ticket_category_private_read(uuid) : 7e aide RLS (D21). Les politiques de ticket_categories ne lisent
--     plus public.users sous le rôle de l'appelant : anon n'a plus besoin du privilège SELECT sur users pour
--     lire le catalogue public.
--  2. ticket_categories_read_public recréée : branche publique inchangée, branches propriétaire et admin
--     (compte ni SUSPENDU ni SUPPRIME) par l'aide.
--  3. ticket_categories_admin_manage recréée TO authenticated, même prédicat (is_admin() et compte actif),
--     la sous-requête sur users remplacée par l'aide.
--  4. event_cancel (recopie de 20261103000005_lot6_billetterie.sql:1063-1196) : transferts PENDING puis
--     billets de l'événement verrouillés (ORDER BY id FOR UPDATE) avant la lecture des porteurs (D20).
--  5. ticket_transfer_accept (recopie de 20261103000005_lot6_billetterie.sql:354-435) : l'événement du
--     billet est verrouillé FOR SHARE avant le transfert ; un événement ni PUBLIE ni VALIDE refuse
--     (EVENT_NOT_ACTIVE). Le verrou précède celui du transfert : une acceptation en cours fait attendre
--     event_cancel, et une annulation en cours fait attendre l'acceptation, qui lit alors ANNULE (plus
--     d'interblocage entre les deux, D20).
--  6. ticket_transfer_claim (recopie de 20261101000010_lot4_scan.sql:254-283, encore appelée par
--     ticket_transfer_accept) : même contrôle du statut de l'événement, en lecture simple.
--  7. notification_channel_enum supprimé (D23) : plus aucune colonne ni aucun corps de fonction ne le cite.
-- Rejouable : CREATE OR REPLACE, DROP POLICY IF EXISTS, DROP TYPE IF EXISTS ; aucun BEGIN ni COMMIT.
-- Privilèges (règle 1A.3) : SECURITY DEFINER, search_path = public, volatilité explicite ; RPC réservées
-- au service_role ; seule exception, l'aide RLS (exécutable par anon et authenticated).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Aide RLS : lecture privée des catégories d'un événement (D21, M3.1)
-- ----------------------------------------------------------------------------
-- Vrai si l'appelant est le propriétaire de l'événement ou un administrateur, et que son compte n'est ni
-- SUSPENDU ni SUPPRIME. Faux pour anon (auth.uid() nul). La lecture de public.users se fait avec les droits
-- du propriétaire de la fonction : la politique ne dépend plus du privilège SELECT de l'appelant sur users.
CREATE OR REPLACE FUNCTION public.ticket_category_private_read(p_event uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT (EXISTS (SELECT 1 FROM public.events e
                     WHERE e.id = p_event AND public.is_partner_owner(e.partner_id))
            OR public.is_admin())
       AND EXISTS (SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid() AND u.status::text NOT IN ('SUSPENDU', 'SUPPRIME'))
$$;

COMMENT ON FUNCTION public.ticket_category_private_read(uuid) IS
    'Lot 7 (D21) : aide RLS de ticket_categories. Vrai pour le propriétaire de l''événement ou un administrateur dont le compte n''est ni SUSPENDU ni SUPPRIME ; lit public.users avec les droits du propriétaire de la fonction.';

REVOKE ALL ON FUNCTION public.ticket_category_private_read(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_category_private_read(uuid) TO anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 2. ticket_categories_read_public (dernière définition : 20261103000001_lot6_dette.sql:145-161)
-- ----------------------------------------------------------------------------
-- Branche publique inchangée (catégorie active et visible d'un événement public, sans condition de compte) ;
-- branches propriétaire et admin, avec le compte actif, par l'aide. Aucune clause TO : le catalogue public
-- est lu par anon.
DROP POLICY IF EXISTS "ticket_categories_read_public" ON public.ticket_categories;
CREATE POLICY "ticket_categories_read_public" ON public.ticket_categories
    FOR SELECT USING (
        (ticket_categories.is_active AND ticket_categories.is_visible
            AND EXISTS (SELECT 1 FROM public.events_public_status s WHERE s.id = ticket_categories.event_id))
        OR public.ticket_category_private_read(ticket_categories.event_id)
    );


-- ----------------------------------------------------------------------------
-- 3. ticket_categories_admin_manage (dernière définition : 20261103000001_lot6_dette.sql:163-175)
-- ----------------------------------------------------------------------------
-- Prédicat actuel : is_admin() et compte ni SUSPENDU ni SUPPRIME. La sous-requête sur users est remplacée
-- par l'aide (qui vaut is_admin() et compte actif dès que is_admin() est vrai). TO authenticated : la
-- politique FOR ALL ne s'évalue plus pour le SELECT de anon.
DROP POLICY IF EXISTS "ticket_categories_admin_manage" ON public.ticket_categories;
CREATE POLICY "ticket_categories_admin_manage" ON public.ticket_categories
    FOR ALL
    TO authenticated
    USING (
        public.is_admin()
        AND public.ticket_category_private_read(ticket_categories.event_id)
    )
    WITH CHECK (
        public.is_admin()
        AND public.ticket_category_private_read(ticket_categories.event_id)
    );


-- ============================================================================
-- 4. event_cancel (recopie intégrale de 20261103000005_lot6_billetterie.sql:1063-1196)
-- Seul changement (D20) : après le verrou des catégories et avant la lecture des porteurs, les transferts
-- en attente des billets de l'événement puis les billets eux-mêmes sont verrouillés, dans l'ordre des
-- identifiants. Une réclamation qui n'a pas encore verrouillé l'événement attend donc la fin de
-- l'annulation, et les porteurs lus sont ceux du moment de l'annulation. L'ordre événements → catégories →
-- paiements reste celui du lot 6 (D9, point ouvert).
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
-- 5. ticket_transfer_accept (recopie intégrale de 20261103000005_lot6_billetterie.sql:354-435)
-- Changements (D20) :
--  - avant tout verrou sur le transfert : lecture simple du billet du transfert et de son événement, puis
--    verrou FOR SHARE de la ligne de l'événement ; un transfert introuvable rend TRANSFER_NOT_FOUND comme
--    avant ;
--  - après les contrôles d'identité (aucune fuite d'existence pour un autre compte) et d'état du transfert
--    (un transfert révoqué reste TRANSFER_NOT_PENDING, tests/parcours/dette-annulation-transferts.test.ts:240) :
--    événement ni PUBLIE ni VALIDE → EVENT_NOT_ACTIVE (même code que ticket_transfer_initiate).
-- Le reste à l'identique. La migration 20261105000007 (tâche 7.9) recopie cette version.
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
-- 6. ticket_transfer_claim (recopie intégrale de 20261101000010_lot4_scan.sql:254-283)
-- Changements : volatilité explicite (VOLATILE, valeur par défaut d'avant) ; après le verrou du billet,
-- événement ni PUBLIE ni VALIDE → EVENT_NOT_ACTIVE (lecture simple : ticket_transfer_accept, seul
-- appelant, tient déjà l'événement FOR SHARE). L'identité régénérée du billet (numéro, QR, secret,
-- security_version + 1) est inchangée.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ticket_transfer_claim(p_transfer_id uuid, p_recipient uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
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
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_TRANSFERABLE'); END IF;
    -- Lot 7 (D20) : aucun transfert réclamé sur un événement annulé, suspendu ou terminé
    IF COALESCE((SELECT ev.status::text FROM public.events ev WHERE ev.id = t.event_id), '') NOT IN ('PUBLIE', 'VALIDE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ACTIVE');
    END IF;
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


-- ----------------------------------------------------------------------------
-- 7. notification_channel_enum (D23) : plus aucune colonne (notifications.channel est en TEXT depuis
--    20261103000002_lot6_outbox.sql:51) ni aucun corps de fonction ne le cite. Sans CASCADE : une
--    dépendance oubliée ferait échouer la migration au lieu de supprimer un objet en silence.
-- ----------------------------------------------------------------------------
DROP TYPE IF EXISTS public.notification_channel_enum;


-- ============================================================================
-- Privilèges : service_role uniquement pour les RPC recréées (règle 1A.3). L'aide RLS a son propre bloc
-- (section 1).
-- ============================================================================
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.event_cancel(jsonb)',
        'public.ticket_transfer_accept(jsonb)',
        'public.ticket_transfer_claim(uuid, uuid)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
