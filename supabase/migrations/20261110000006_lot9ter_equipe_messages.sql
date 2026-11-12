-- ============================================================================
-- EVENT VILLAGE — LOT 9 TER : équipe et messages (contrat 3.1 n° 06, 3.4 F11 à F16, B.2.2 ; S-M, vague S2)
-- ============================================================================
-- Rejouable : aucun BEGIN ni COMMIT ; CREATE OR REPLACE, privilèges réappliqués. Le registre des types émis ici est
-- posé par 20261110000004_lot9ter_registre.sql (avant tout émetteur, K3).
-- Tâches fusionnées, dans l'ordre de leurs commits (section 10) :
--  9t.2 (consigne 0.2, fix(9t.2)) — détenteur actuel d'un billet transféré prévenu du remboursement :
--   6. ticket_refund_request (recopie F15, base 20261109000006_lot9bis_argent.sql:945-1188) : hors annulation de
--      l'événement, un billet remboursé à l'acheteur d'origine (CASHOUT) ou par l'organisateur (ORGANISATEUR) dont le
--      porteur actuel n'est pas le payeur et qui a un transfert CLAIMED avec expéditeur (règle R13) met en file
--      TICKET_REFUNDED_HOLDER au porteur (clé TICKET_REFUNDED_HOLDER:<billet>, données ticket_id et category) ; le
--      porteur d'un billet payé en espèces reçoit ce texte à la place de TICKET_CANCELLED CASH (B-D2). Verrous,
--      refus, codes, audit TICKET_REFUND_REQUESTED, montants, retours et rejeu « already » inchangés.
--  9t.5 (consigne 0.5, fix(9t.5)) — consentement d'un contrôleur déjà actif ailleurs (arbitrage 13, B-D5 à B-D8) :
--   1. Table partner_controllers (partner_id, user_id, first_seen_at) : lien durable « cette partenaire a déjà eu ce
--      contrôleur dans son équipe », jamais supprimé ; RLS sans politique, service_role seul, aucune clé étrangère
--      (K9 : aucun KEY SHARE sur users ou partners dans le chemin d'une affectation).
--   2. partner_controllers_link() (nouvelle, F11) + trigger trg_event_controllers_partner_link AFTER INSERT sur
--      event_controllers : toute insertion (route, RPC, acceptation d'une invitation, graine) pose le lien (x5).
--   3. partner_controller_known(p_partner, p_user) (nouvelle, F12) : lue par les routes invite et assignments.
--   7. controller_assignments_sync (recopie F16, base 20261109000008_lot9bis_cycle.sql:2223-2306) : un ajout vers
--      un événement d'une partenaire inconnue du contrôleur, pour un compte qui n'est pas temporaire, est refusé
--      CONTROLLER_CONSENT_REQUIRED avant toute écriture (B-D7).
--   8. Rétro-remplissage de partner_controllers (affectations, caisses, invitations acceptées, scans de contrôleur),
--      ON CONFLICT DO NOTHING : rejouable.
--  9t.10 (consigne 0.8, R95 reste, fix(9t.10)) — cloche aux admins events.read (B-D10 à B-D12) :
--   4. notif_event_status_admin_alert() (nouvelle, F13) + trigger trg_event_status_admin_alert AFTER INSERT sur
--      event_status_history : VALIDE → PUBLIE par la partenaire → ADMIN_EVENT_PUBLISHED ; EN_ATTENTE → BROUILLON par
--      la partenaire → ADMIN_EVENT_WITHDRAWN (cloche et email, aucun SMS) ; clé <type>:<historique>:<admin>. Rien
--      quand un admin agit. notif_event_status_changed non recopiée.
--   5. notif_ticket_categories_admin_update_alert() (nouvelle, F14) + trigger trg_ticket_categories_admin_update_alert
--      AFTER UPDATE OF price, sale_online, sale_counter (WHEN l'un d'eux change) sur ticket_categories : événement
--      VALIDE, PUBLIE ou SUSPENDU → ADMIN_EVENT_CHANGED parties PRICE et CHANNELS, une alerte par enregistrement,
--      clé <event>:catupd<catégorie>:tx<txid> (distincte de l'ajout …:cat<catégorie>). Une vente, une quantité, la
--      couleur ou la consigne ne déclenchent rien ; aucune alerte de désactivation (B-D12).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Table partner_controllers (9t.5 ; K9 : aucune clé étrangère)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_controllers (
    partner_id    uuid NOT NULL,
    user_id       uuid NOT NULL,
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT partner_controllers_pkey PRIMARY KEY (partner_id, user_id)
);
COMMENT ON TABLE public.partner_controllers IS
    'Lot 9 ter (0.5) : lien durable « cette partenaire a déjà eu ce contrôleur dans son équipe », posé à toute insertion dans event_controllers, jamais supprimé ; sans clé étrangère (aucun KEY SHARE sur users ou partners). Service_role seul.';
ALTER TABLE public.partner_controllers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.partner_controllers FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.partner_controllers TO service_role;


-- ----------------------------------------------------------------------------
-- 2. partner_controllers_link (nouvelle, F11) + trigger trg_event_controllers_partner_link — tâche 9t.5.
--    Lecture d'events sans verrou ; aucun audit (le lien suit une affectation déjà journalisée). Un upsert qui
--    rencontre une ligne existante ne déclenche pas AFTER INSERT : la ligne avait déjà son lien (x5).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_controllers_link()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.partner_controllers (partner_id, user_id)
    SELECT e.partner_id, NEW.user_id
      FROM public.events e
     WHERE e.id = NEW.event_id AND e.partner_id IS NOT NULL
    ON CONFLICT (partner_id, user_id) DO NOTHING;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_controllers_partner_link ON public.event_controllers;
CREATE TRIGGER trg_event_controllers_partner_link
    AFTER INSERT ON public.event_controllers
    FOR EACH ROW
    EXECUTE FUNCTION public.partner_controllers_link();


-- ----------------------------------------------------------------------------
-- 3. partner_controller_known (nouvelle, F12) — tâche 9t.5. Service_role seul (r3, bloc LOT9TER_RPCS).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_controller_known(p_partner uuid, p_user uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN p_partner IS NOT NULL AND p_user IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.partner_controllers pc WHERE pc.partner_id = p_partner AND pc.user_id = p_user);
END;
$$;


-- ----------------------------------------------------------------------------
-- 4. notif_event_status_admin_alert (nouvelle, F13) + trigger trg_event_status_admin_alert — tâche 9t.10 (R95).
--    Dans event_status_apply : événement (tenu) → historique → lecture partners sans verrou → boîte d'envoi.
--    Destinataires : SUPERADMIN et ADMIN actifs munis de events.read (notif_enqueue_admins, 20261103000002:598-624).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_event_status_admin_alert()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type text;
    v_company text;
BEGIN
    IF NEW.old_status IS NULL OR NEW.channel <> 'TRANSITION' OR NEW.actor_role <> 'PARTENAIRE' THEN
        RETURN NULL;
    END IF;
    IF NEW.old_status::text = 'VALIDE' AND NEW.new_status::text = 'PUBLIE' THEN
        v_type := 'ADMIN_EVENT_PUBLISHED';
    ELSIF NEW.old_status::text = 'EN_ATTENTE' AND NEW.new_status::text = 'BROUILLON' THEN
        v_type := 'ADMIN_EVENT_WITHDRAWN';
    ELSE
        RETURN NULL;
    END IF;
    SELECT pa.company_name INTO v_company
      FROM public.events e LEFT JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = NEW.event_id;
    PERFORM public.notif_enqueue_admins(jsonb_build_object(
        'type', v_type, 'ref', NEW.id::text, 'event_id', NEW.event_id,
        'data', COALESCE(public.notif_event_data(NEW.event_id), '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('company', v_company))));
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_status_admin_alert ON public.event_status_history;
CREATE TRIGGER trg_event_status_admin_alert
    AFTER INSERT ON public.event_status_history
    FOR EACH ROW
    EXECUTE FUNCTION public.notif_event_status_admin_alert();


-- ----------------------------------------------------------------------------
-- 5. notif_ticket_categories_admin_update_alert (nouvelle, F14) + trigger trg_ticket_categories_admin_update_alert
--    — tâche 9t.10 (R95). Dans ticket_category_update (un seul UPDATE, une alerte par enregistrement) : catégorie
--    (tenue) → lecture events, partners sans verrou → boîte d'envoi. Le chemin d'achat n'écrit ni price ni les
--    canaux : le trigger ne s'y exécute pas.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_ticket_categories_admin_update_alert()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status text;
    v_company text;
    v_changes text[] := ARRAY[]::text[];
BEGIN
    SELECT e.status::text, pa.company_name INTO v_status, v_company
      FROM public.events e LEFT JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = NEW.event_id;
    IF v_status IS NULL OR v_status NOT IN ('VALIDE', 'PUBLIE', 'SUSPENDU') THEN
        RETURN NULL;
    END IF;
    IF NEW.price IS DISTINCT FROM OLD.price THEN
        v_changes := array_append(v_changes, 'PRICE');
    END IF;
    IF NEW.sale_online IS DISTINCT FROM OLD.sale_online OR NEW.sale_counter IS DISTINCT FROM OLD.sale_counter THEN
        v_changes := array_append(v_changes, 'CHANNELS');
    END IF;
    IF cardinality(v_changes) = 0 THEN
        RETURN NULL;
    END IF;
    PERFORM public.notif_enqueue_admins(jsonb_build_object(
        'type', 'ADMIN_EVENT_CHANGED',
        'ref', NEW.event_id::text || ':catupd' || NEW.id::text || ':tx' || txid_current()::text,
        'event_id', NEW.event_id,
        'data', COALESCE(public.notif_event_data(NEW.event_id), '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
            'changes', to_jsonb(v_changes), 'category', NEW.name,
            'old_price', CASE WHEN 'PRICE' = ANY (v_changes) THEN OLD.price END,
            'new_price', CASE WHEN 'PRICE' = ANY (v_changes) THEN NEW.price END,
            'sale_online', CASE WHEN 'CHANNELS' = ANY (v_changes) THEN NEW.sale_online END,
            'sale_counter', CASE WHEN 'CHANNELS' = ANY (v_changes) THEN NEW.sale_counter END,
            'company', v_company))));
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_categories_admin_update_alert ON public.ticket_categories;
CREATE TRIGGER trg_ticket_categories_admin_update_alert
    AFTER UPDATE OF price, sale_online, sale_counter ON public.ticket_categories
    FOR EACH ROW
    WHEN (OLD.price IS DISTINCT FROM NEW.price OR OLD.sale_online IS DISTINCT FROM NEW.sale_online OR OLD.sale_counter IS DISTINCT FROM NEW.sale_counter)
    EXECUTE FUNCTION public.notif_ticket_categories_admin_update_alert();


-- ----------------------------------------------------------------------------
-- 6. ticket_refund_request (recopie F15, base 20261109000006_lot9bis_argent.sql:945-1188) — tâche 9t.2.
--    Changements, et seulement eux : DECLARE + v_payer, v_holder_notice, v_cat_name ; décision v_holder_notice juste
--    avant le journal (lecture sans verrou des transferts CLAIMED, lignes terminales ; p lu seulement si le billet a
--    un paiement, aucun record non assigné) ; bloc R22 sauté quand v_holder_notice ; bloc TICKET_REFUNDED_HOLDER
--    juste après le bloc R22, avant la branche AUCUN.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_refund_request(p_ticket_id uuid, p_actor uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key text := 'REFUND-TKT-' || p_ticket_id::text;
    v_payment_id uuid;
    v_category uuid;
    p record;
    t record;
    v_ref record;
    v_user record;
    v_blocked text;
    v_refund uuid;
    v_cashout uuid;
    v_share numeric;
    v_prev_amount numeric;
    v_prev_agg numeric;
    v_agg_share numeric;
    v_bearer text;
    v_apply jsonb;
    v_platform boolean;
    v_ev record;
    v_is_owner boolean;
    v_is_staff boolean;
    v_is_holder boolean;
    v_active boolean;
    v_as text;
    v_ctx text;
    v_mode text;
    v_amount numeric;
    v_tr record;
    v_data jsonb;
    v_target uuid;
    v_inv_phone text;
    v_payer uuid;
    v_holder_notice boolean := FALSE;
    v_cat_name text;
BEGIN
    SELECT payment_id, category_id INTO v_payment_id, v_category FROM public.tickets WHERE id = p_ticket_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_FOUND', 'message', 'Billet introuvable.');
    END IF;
    IF v_payment_id IS NOT NULL THEN
        SELECT * INTO p FROM public.payments WHERE id = v_payment_id FOR UPDATE;
    END IF;
    PERFORM 1 FROM public.ticket_categories WHERE id = v_category FOR NO KEY UPDATE;
    -- Lot 9 bis (R61, 3.3) : transferts en attente du billet avant le billet (ordre de ticket_transfer_accept)
    PERFORM 1 FROM public.ticket_transfers x
     WHERE x.ticket_id = p_ticket_id AND x.status::text = 'PENDING'
     ORDER BY x.id
       FOR UPDATE OF x;
    SELECT * INTO t FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    -- Lot 9 bis (R11, B21) : qui agit, sur quel événement (lecture sans verrou, comme event_transition)
    SELECT e.id, e.status::text AS status, pa.user_id AS owner_id INTO v_ev
      FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = t.event_id;
    v_is_owner := p_actor IS NOT NULL AND v_ev.owner_id IS NOT DISTINCT FROM p_actor;
    v_is_staff := p_actor IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles r
                                                   WHERE r.user_id = p_actor AND r.role::text IN ('ADMIN', 'SUPERADMIN'));
    v_is_holder := p_actor IS NOT NULL AND t.user_id IS NOT DISTINCT FROM p_actor;
    v_active := EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_actor AND u.status::text = 'ACTIF');

    SELECT * INTO v_ref FROM public.refunds WHERE refund_transaction_id = v_key;
    IF FOUND AND (v_is_owner OR v_is_staff OR v_is_holder) THEN
        RETURN jsonb_build_object('ok', true, 'already', true,
            'mode', CASE WHEN v_ref.settlement = 'ORGANISATEUR' THEN 'ORGANISATEUR' ELSE 'CASHOUT' END,
            'refund_id', v_ref.id, 'cashout_id', v_ref.cashout_id, 'amount', v_ref.amount);
    END IF;

    IF v_ev.status = 'ANNULE' THEN
        -- Contexte d'annulation (event_cancel) : aucune règle de date, l'acteur a été contrôlé par event_cancel
        v_ctx := 'CANCELLATION';
        v_as := CASE WHEN v_is_owner THEN 'OWNER' WHEN v_is_staff THEN 'ADMIN' END;
    ELSIF NOT v_active THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    ELSIF public.admin_can(p_actor, 'refunds.manage') THEN
        v_ctx := 'DIRECT';
        v_as := 'ADMIN';
    ELSIF v_is_owner THEN
        IF now() > public.event_end_at(v_ev.id) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'REFUND_CLOSED_AFTER_EVENT',
                'message', 'L’événement est terminé : seul Event Village peut encore rembourser ce billet. Contactez le support.');
        END IF;
        v_ctx := 'DIRECT';
        v_as := 'OWNER';
    ELSIF v_is_holder THEN
        -- Lot 9 bis (R32, B23) : le porteur, seulement quand un report de plus de 24 h lui ouvre le droit
        IF NOT public.ticket_postponement_refund_open(t.id) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'POSTPONEMENT_REFUND_CLOSED',
                'message', 'Ce billet n’ouvre pas de remboursement : l’événement n’a pas été reporté de plus de 24 h, ou il a commencé.');
        END IF;
        v_ctx := 'POSTPONEMENT';
        v_as := 'HOLDER';
    END IF;
    IF v_as IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN',
                                  'message', 'Remboursement réservé à l’organisateur ou à un administrateur habilité.');
    END IF;

    IF t.status::text <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_REFUNDABLE', 'status', t.status::text,
                                  'message', format('Billet %s : remboursement impossible.', t.status));
    END IF;

    -- Branche du billet et refus du paiement, décidés avant toute écriture
    IF v_payment_id IS NOT NULL THEN
        v_platform := p.is_platform_payment;
    END IF;
    IF COALESCE(t.price, 0) = 0 THEN
        -- Billet gratuit ou invitation : annulé, rien à rembourser
        v_mode := 'AUCUN';
        v_amount := 0;
    ELSIF NOT COALESCE(v_platform, FALSE) THEN
        -- Billet payé hors plateforme (espèces) : à rembourser par l'organisateur, aucun cashout
        v_mode := 'ORGANISATEUR';
        v_amount := t.price;
    ELSE
        IF p.status::text NOT IN ('SUCCESS', 'PARTIAL') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PAYMENT_NOT_REFUNDABLE', 'status', p.status::text,
                                      'message', 'Le paiement de ce billet ne peut pas être remboursé.');
        END IF;
        -- Part du paiement correspondant au billet, jamais au-delà du reste à rembourser
        SELECT COALESCE(sum(amount), 0), COALESCE(sum(aggregator_fee_share), 0) INTO v_prev_amount, v_prev_agg
          FROM public.refunds WHERE payment_id = p.id AND settlement = 'PLATEFORME';
        v_share := LEAST(t.price + t.service_fee, p.amount - v_prev_amount);
        IF v_share <= 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_REFUNDED', 'message', 'Ce paiement est déjà entièrement remboursé.');
        END IF;
        v_mode := 'CASHOUT';
        v_amount := v_share;
    END IF;

    -- Lot 9 ter (9t.2, consigne 0.2, B-D4) : porteur actuel d'un billet transféré et accepté (transfert CLAIMED avec
    -- expéditeur), qui n'est pas le payeur (règle R13), d'un billet remboursé à l'acheteur d'origine ou par
    -- l'organisateur, hors annulation de l'événement (les porteurs y reçoivent EVENT_CANCELLED). Lecture des transferts
    -- CLAIMED sans verrou (lignes terminales) ; p n'est lu que si le billet a un paiement.
    IF v_payment_id IS NOT NULL THEN
        v_payer := p.client_id;
    END IF;
    v_holder_notice := v_ctx <> 'CANCELLATION' AND v_mode IN ('CASHOUT', 'ORGANISATEUR')
        AND t.user_id IS NOT NULL AND t.user_id IS DISTINCT FROM v_payer
        AND EXISTS (SELECT 1 FROM public.ticket_transfers x
                     WHERE x.ticket_id = t.id AND x.status::text = 'CLAIMED' AND x.from_user_id IS NOT NULL);

    -- Lot 9 bis (B45, contrat 6.3) : journal dans la transaction ; un échec du journal annule le remboursement
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (p_actor, CASE v_as WHEN 'OWNER' THEN 'PARTENAIRE' WHEN 'ADMIN' THEN 'ADMIN' ELSE 'CLIENT' END,
            'TICKET_REFUND_REQUESTED', 'tickets', t.id,
            jsonb_build_object('as', v_as, 'context', v_ctx, 'reason', COALESCE(p_reason, 'Remboursement'),
                               'mode', v_mode, 'amount', v_amount, 'event_id', t.event_id, 'payment_id', v_payment_id));

    -- Lot 9 bis (R61, B24, B53) : le transfert en attente est annulé dans la même transaction, le billet déverrouillé ;
    -- le destinataire d'un vrai transfert (avec expéditeur) est prévenu (TRANSFER_REVOKED : SMS au numéro, in-app,
    -- push et email au compte vérifié de ce numéro). event_cancel a déjà révoqué les siens (contexte d'annulation).
    FOR v_tr IN
        UPDATE public.ticket_transfers x
           SET status = 'CANCELLED', cancelled_at = now()
         WHERE x.ticket_id = t.id AND x.status::text = 'PENDING'
        RETURNING x.id, x.from_user_id, x.to_phone_or_email
    LOOP
        IF v_ctx <> 'CANCELLATION' AND v_tr.from_user_id IS NOT NULL AND v_tr.to_phone_or_email ~ '^\+221[0-9]{9}$' THEN
            v_data := COALESCE(public.notif_event_data(t.event_id), '{}'::jsonb)
                      || jsonb_build_object('transfer_id', v_tr.id, 'ticket_id', t.id);
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'TRANSFER_REVOKED', 'key', 'TRANSFER_REVOKED:' || v_tr.id::text,
                'phone', v_tr.to_phone_or_email, 'actor_id', p_actor, 'event_id', t.event_id,
                'data', v_data, 'channels', jsonb_build_array('SMS')));
            SELECT u.id INTO v_target
              FROM public.users u
             WHERE u.phone = v_tr.to_phone_or_email AND u.id IS DISTINCT FROM v_tr.from_user_id
               AND public.ticket_transfer_identity(v_tr.to_phone_or_email, u.id) = 'MATCH'
             ORDER BY u.id
             LIMIT 1;
            IF v_target IS NOT NULL THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'TRANSFER_REVOKED', 'key', 'TRANSFER_REVOKED:' || v_tr.id::text,
                    'user_id', v_target, 'actor_id', p_actor, 'event_id', t.event_id,
                    'data', v_data, 'channels', jsonb_build_array('IN_APP', 'PUSH', 'EMAIL')));
            END IF;
        END IF;
        -- Invitation encore à réclamer (aucun expéditeur) : son numéro reçoit TICKET_CANCELLED ci-dessous (R22)
        IF v_tr.from_user_id IS NULL AND v_tr.to_phone_or_email ~ '^\+221[0-9]{9}$' THEN
            v_inv_phone := v_tr.to_phone_or_email;
        END IF;
    END LOOP;
    IF t.transfer_locked THEN
        UPDATE public.tickets SET transfer_locked = FALSE, updated_at = now() WHERE id = t.id;
    END IF;

    -- Lot 9 bis (R22, B73, N18) : billet gratuit, invitation ou payé en espèces annulé hors annulation de
    -- l'événement → TICKET_CANCELLED au porteur (in-app, SMS, email du registre) ou au numéro de l'invitation
    -- non réclamée (SMS) ; en contexte d'annulation, les porteurs ont EVENT_CANCELLED (trigger, M09).
    -- Lot 9 ter (9t.2, B-D2) : sauf quand le porteur actuel reçoit TICKET_REFUNDED_HOLDER (billet en espèces transféré).
    IF v_ctx <> 'CANCELLATION' AND v_mode IN ('AUCUN', 'ORGANISATEUR') AND (t.user_id IS NOT NULL OR v_inv_phone IS NOT NULL) AND NOT v_holder_notice THEN
        v_data := COALESCE(public.notif_event_data(t.event_id), '{}'::jsonb)
                  || jsonb_build_object('ticket_id', t.id,
                                        'kind', CASE WHEN v_mode = 'ORGANISATEUR' THEN 'CASH'
                                                     WHEN t.sale_channel = 'INVITATION' THEN 'INVITATION'
                                                     ELSE 'FREE' END);
        IF t.user_id IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'TICKET_CANCELLED', 'key', 'TICKET_CANCELLED:' || t.id::text,
                'user_id', t.user_id, 'actor_id', p_actor, 'event_id', t.event_id, 'data', v_data));
        ELSE
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'TICKET_CANCELLED', 'key', 'TICKET_CANCELLED:' || t.id::text,
                'phone', v_inv_phone, 'event_id', t.event_id, 'data', v_data, 'channels', jsonb_build_array('SMS')));
        END IF;
    END IF;

    -- Lot 9 ter (9t.2, consigne 0.2, N1) : le porteur actuel est prévenu (SMS, cloche, push, email du registre) ;
    -- l'acheteur d'origine garde REFUND_REQUESTED (trigger des versements). Une seule série : le rejeu « already »
    -- sort plus haut, et la clé TICKET_REFUNDED_HOLDER:<billet> est unique par canal.
    IF v_holder_notice THEN
        SELECT c.name INTO v_cat_name FROM public.ticket_categories c WHERE c.id = t.category_id;
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'TICKET_REFUNDED_HOLDER', 'key', 'TICKET_REFUNDED_HOLDER:' || t.id::text,
            'user_id', t.user_id, 'actor_id', p_actor, 'event_id', t.event_id,
            'data', COALESCE(public.notif_event_data(t.event_id), '{}'::jsonb)
                    || jsonb_build_object('ticket_id', t.id, 'category', v_cat_name)));
    END IF;

    IF v_mode = 'AUCUN' THEN
        UPDATE public.tickets SET status = 'ANNULE' WHERE id = t.id;
        UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = t.category_id;
        RETURN jsonb_build_object('ok', true, 'mode', 'AUCUN', 'amount', 0);
    END IF;

    IF v_mode = 'ORGANISATEUR' THEN
        INSERT INTO public.refunds (payment_id, ticket_id, refund_transaction_id, amount, reason, status, settlement, processed_by, kind, facial_part)
        VALUES (v_payment_id, t.id, v_key, t.price, COALESCE(p_reason, 'Remboursement'), 'PENDING', 'ORGANISATEUR', p_actor, 'TICKET_REFUND', t.price)
        RETURNING id INTO v_refund;
        UPDATE public.tickets SET status = 'ANNULE' WHERE id = t.id;
        UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = t.category_id;
        RETURN jsonb_build_object('ok', true, 'mode', 'ORGANISATEUR', 'refund_id', v_refund, 'amount', t.price);
    END IF;

    v_agg_share := CASE WHEN v_prev_amount + v_share >= p.amount THEN p.aggregator_fee - v_prev_agg
                        ELSE public.fin_round_2(p.aggregator_fee * v_share / p.amount) END;
    v_bearer := public.fin_setting_text('finance.cancellation_aggregator_fee_bearer');

    SELECT first_name, last_name INTO v_user FROM public.users WHERE id = p.client_id;
    v_blocked := CASE
        WHEN p.operator IS NULL THEN 'OPERATOR_UNKNOWN'
        WHEN p.payer_phone IS NULL THEN 'PHONE_UNKNOWN'
        WHEN NULLIF(btrim(v_user.first_name), '') IS NULL OR NULLIF(btrim(v_user.last_name), '') IS NULL THEN 'NAME_UNKNOWN'
        ELSE NULL END;

    INSERT INTO public.refunds (payment_id, ticket_id, refund_transaction_id, amount, reason, status, settlement, processed_by,
                                kind, facial_part, service_part, aggregator_fee_share, aggregator_fee_bearer, net_revenue_reversal)
    VALUES (p.id, t.id, v_key, v_share, COALESCE(p_reason, 'Remboursement'), 'PENDING', 'PLATEFORME', p_actor,
            'TICKET_REFUND', t.price, t.service_fee, v_agg_share, v_bearer,
            CASE WHEN v_bearer = 'ORGANISATEUR' THEN t.service_fee - v_agg_share ELSE t.service_fee END)
    RETURNING id INTO v_refund;
    INSERT INTO public.cashouts (kind, idempotency_key, payment_id, refund_id, ticket_id, beneficiary_user_id, operator, phone_number,
                                 first_name, last_name, amount, blocked_reason)
    VALUES ('TICKET_REFUND', v_key, p.id, v_refund, t.id, p.client_id, p.operator, p.payer_phone,
            NULLIF(btrim(v_user.first_name), ''), NULLIF(btrim(v_user.last_name), ''), v_share, v_blocked)
    RETURNING id INTO v_cashout;
    UPDATE public.refunds SET cashout_id = v_cashout WHERE id = v_refund;
    UPDATE public.tickets SET status = 'REMBOURSEMENT_EN_COURS' WHERE id = t.id;
    UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = t.category_id;
    v_apply := public.fin_refund_apply(v_refund);
    RETURN jsonb_build_object('ok', true, 'mode', 'CASHOUT', 'refund_id', v_refund, 'cashout_id', v_cashout,
                              'amount', v_share, 'blocked_reason', v_blocked, 'debt', COALESCE(v_apply->'debt', '0'::jsonb));
END;
$$;


-- ----------------------------------------------------------------------------
-- 7. controller_assignments_sync (recopie F16, base 20261109000008_lot9bis_cycle.sql:2223-2306) — tâche 9t.5.
--    Un seul ajout, juste après le refus EVENT_NOT_ELIGIBLE et avant le DELETE : CONTROLLER_CONSENT_REQUIRED quand
--    un événement ajouté appartient à une partenaire inconnue du contrôleur (partner_controller_known) et que le
--    compte n'est pas temporaire (lecture de auth.users, précédent 20261109000008:2204). Lectures sans verrou
--    (partner_controllers, auth.users, events) avant event_controllers : ordre du tableau 3.3 tenu. Les lignes
--    ajoutées gardent les colonnes de la base (gate_id NULL, gate_change_allowed FALSE, entry_point NULL).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.controller_assignments_sync(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_ctrl uuid := public.try_uuid(p->>'controller_id');
    v_partner uuid := public.try_uuid(p->>'partner_id');
    v_role text := COALESCE(NULLIF(p->>'actor_role', ''), 'PARTENAIRE');
    v_req jsonb;
    v_requested uuid[];
    v_current uuid[];
    v_added uuid[];
    v_removed uuid[];
    v_updated integer := 0;
BEGIN
    IF v_actor IS NULL OR v_ctrl IS NULL OR jsonb_typeof(p->'assignments') IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Affectations illisibles.');
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p->'assignments') a
                WHERE public.try_uuid(a->>'event_id') IS NULL
                   OR COALESCE(jsonb_typeof(a->'can_accept_cash'), 'null') NOT IN ('boolean', 'null')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Affectations illisibles.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_ctrl) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_NOT_FOUND', 'message', 'Contrôleur introuvable.');
    END IF;

    -- Une ligne par événement (la dernière l'emporte)
    SELECT COALESCE(jsonb_agg(jsonb_build_object('event_id', x.event_id, 'can_accept_cash', x.cash) ORDER BY x.event_id), '[]'::jsonb)
      INTO v_req
      FROM (SELECT DISTINCT ON (public.try_uuid(a->>'event_id')) public.try_uuid(a->>'event_id') AS event_id,
                   CASE WHEN jsonb_typeof(a->'can_accept_cash') = 'boolean' THEN (a->>'can_accept_cash')::boolean END AS cash
              FROM jsonb_array_elements(p->'assignments') WITH ORDINALITY AS t(a, o)
             ORDER BY public.try_uuid(a->>'event_id'), o DESC) x;
    SELECT COALESCE(array_agg((a->>'event_id')::uuid), ARRAY[]::uuid[]) INTO v_requested FROM jsonb_array_elements(v_req) a;

    IF EXISTS (SELECT 1 FROM unnest(v_requested) r(id) LEFT JOIN public.events e ON e.id = r.id
                WHERE e.id IS NULL OR (v_partner IS NOT NULL AND e.partner_id IS DISTINCT FROM v_partner)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_OWNED', 'message', 'Vous n''êtes pas propriétaire de tous les événements sélectionnés.');
    END IF;

    SELECT COALESCE(array_agg(ec.event_id), ARRAY[]::uuid[]) INTO v_current
      FROM public.event_controllers ec JOIN public.events e ON e.id = ec.event_id
     WHERE ec.user_id = v_ctrl AND (v_partner IS NULL OR e.partner_id = v_partner);
    SELECT COALESCE(array_agg(r.id ORDER BY r.id), ARRAY[]::uuid[]) INTO v_added FROM unnest(v_requested) r(id) WHERE NOT r.id = ANY (v_current);
    SELECT COALESCE(array_agg(c.id ORDER BY c.id), ARRAY[]::uuid[]) INTO v_removed FROM unnest(v_current) c(id) WHERE NOT c.id = ANY (v_requested);

    -- Seuls les événements confirmés (VALIDE ou PUBLIE) sont nouvellement affectés
    IF EXISTS (SELECT 1 FROM public.events e WHERE e.id = ANY (v_added) AND e.status::text NOT IN ('VALIDE', 'PUBLIE')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ELIGIBLE', 'message', 'Seuls les événements validés ou publiés peuvent être affectés.');
    END IF;

    -- Lot 9 ter (9t.5, consigne 0.5, B-D6 à B-D8) : une partenaire qui n'a jamais eu ce contrôleur dans son équipe
    -- ne l'affecte pas directement ; il accepte d'abord son invitation (R37). Compte temporaire jamais activé :
    -- inchangé (il consent par l'activation). Admin agissant : la partenaire de chaque événement ajouté.
    IF cardinality(v_added) > 0
       AND COALESCE((SELECT a.raw_user_meta_data->>'is_temporary_controller_account' FROM auth.users a WHERE a.id = v_ctrl), 'false') <> 'true'
       AND EXISTS (SELECT 1 FROM public.events e
                    WHERE e.id = ANY (v_added) AND NOT public.partner_controller_known(e.partner_id, v_ctrl)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_CONSENT_REQUIRED',
                                  'message', 'Ce contrôleur doit d’abord accepter votre invitation.');
    END IF;

    IF cardinality(v_removed) > 0 THEN
        DELETE FROM public.event_controllers WHERE user_id = v_ctrl AND event_id = ANY (v_removed);
    END IF;
    IF cardinality(v_added) > 0 THEN
        INSERT INTO public.event_controllers (event_id, user_id, can_accept_cash, created_by)
        SELECT (a->>'event_id')::uuid, v_ctrl, COALESCE((a->>'can_accept_cash')::boolean, FALSE), v_actor
          FROM jsonb_array_elements(v_req) a
         WHERE (a->>'event_id')::uuid = ANY (v_added);
    END IF;
    UPDATE public.event_controllers ec
       SET can_accept_cash = (a->>'can_accept_cash')::boolean
      FROM jsonb_array_elements(v_req) a
     WHERE ec.user_id = v_ctrl AND ec.event_id = (a->>'event_id')::uuid
       AND NOT ec.event_id = ANY (v_added)
       AND jsonb_typeof(a->'can_accept_cash') = 'boolean'
       AND ec.can_accept_cash IS DISTINCT FROM (a->>'can_accept_cash')::boolean;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, v_role, 'CONTROLLER_ASSIGNMENTS_UPDATED', 'event_controllers', v_ctrl,
            jsonb_build_object('event_ids', to_jsonb(v_current)),
            jsonb_build_object('event_ids', to_jsonb(v_requested), 'added', to_jsonb(v_added), 'removed', to_jsonb(v_removed),
                               'cash_updated', v_updated),
            jsonb_build_object('partner_id', v_partner, 'controller_id', v_ctrl));

    RETURN jsonb_build_object('ok', true, 'added', to_jsonb(v_added), 'removed', to_jsonb(v_removed), 'updated', v_updated);
END;
$$;


-- ----------------------------------------------------------------------------
-- 8. Rétro-remplissage de partner_controllers (9t.5, DML après toute la DDL ; rejouable par ON CONFLICT DO NOTHING).
--    Sources : event_controllers.created_at (20260904000002:11), controller_shifts.partner_id/controller_id/opened_at
--    (20260906000002:15-21), controller_invitations acceptées (20261109000008:180-191), scans d'un contrôleur
--    (ticket_scans.scanner_role, 20261101000013:21). Première date vue = la plus ancienne des sources.
-- ----------------------------------------------------------------------------
INSERT INTO public.partner_controllers (partner_id, user_id, first_seen_at)
SELECT x.partner_id, x.user_id, min(x.seen_at)
  FROM (SELECT e.partner_id, ec.user_id, ec.created_at AS seen_at
          FROM public.event_controllers ec JOIN public.events e ON e.id = ec.event_id
        UNION ALL
        SELECT s.partner_id, s.controller_id, s.opened_at FROM public.controller_shifts s
        UNION ALL
        SELECT ci.partner_id, ci.user_id, COALESCE(ci.responded_at, ci.created_at)
          FROM public.controller_invitations ci WHERE ci.status = 'ACCEPTED'
        UNION ALL
        SELECT e.partner_id, sc.scanner_id, sc.created_at
          FROM public.ticket_scans sc JOIN public.events e ON e.id = sc.event_id
         WHERE sc.scanner_role = 'CONTROLEUR' AND sc.scanner_id IS NOT NULL) x
 WHERE x.partner_id IS NOT NULL AND x.user_id IS NOT NULL
 GROUP BY x.partner_id, x.user_id
ON CONFLICT (partner_id, user_id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 9. Privilèges : RPC au service_role seul ; fonctions de trigger sans aucun droit d'exécution pour l'API
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.partner_controller_known(uuid, uuid)',
        'public.ticket_refund_request(uuid, uuid, text)',
        'public.controller_assignments_sync(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.partner_controllers_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_event_status_admin_alert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_ticket_categories_admin_update_alert() FROM PUBLIC, anon, authenticated;
