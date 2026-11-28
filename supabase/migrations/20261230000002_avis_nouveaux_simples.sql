-- ============================================================================
-- EVENT VILLAGE — LOT « AVIS », PHASE 2, SOUS-LOT 2c : avis nouveaux simples (écarts A2, A5, A8, A9, A10)
-- ============================================================================
-- Constats revérifiés dans le code le 27/11 :
--  A2 (élevé) : withdrawal_request (20261109000006_lot9bis_argent.sql) crée le retrait et son versement sans aucun avis ;
--      le premier avis est WITHDRAWAL_PAID, au versement. Personne n'est prévenu d'une demande faite à son insu.
--  A5 : partner_dossier_resubmit (20261109000004_lot9bis_droits.sql:685-707) pose partners.resubmitted_at et prévient les
--      administrateurs (ADMIN_PARTNER_RESUBMITTED), rien à la partenaire.
--  A8 : shift_discrepancy_validate (20261116000005_f2acv_ecart_caisse.sql:57-66) pose discrepancy_validated_at, rien au
--      contrôleur.
--  A9 : event_controller_gate_set, event_controller_settings_set, event_controller_set_cash, controller_assignments_sync,
--      event_controllers_add (20261116000004_f2acv_equipe_suspendue.sql) changent la porte ou le droit d'encaisser d'une
--      affectation sans avis au contrôleur.
--  A10 : inscription réussie sans bienvenue (la mise en file est faite par la route d'inscription, pas ici : les comptes
--      créés autrement, dont ceux des tests, ne la reçoivent pas).
--
-- Choix (consigne : un déclencheur nouveau plutôt qu'une énième recopie) — AUCUNE fonction existante recopiée :
--  1. registre : WITHDRAWAL_REQUESTED (étape importante : 4 canaux, part la nuit), PARTNER_RESUBMITTED_ACK,
--     SHIFT_DISCREPANCY_VALIDATED, CONTROLLER_POST_CHANGED, ACCOUNT_WELCOME (petites étapes : cloche et notification,
--     reportées la nuit, sauf événement à moins de 12 h par notif_event_soon) ;
--  2. A2 : private.notif_withdrawal_requested, déclencheur DIFFÉRÉ (fin de transaction) à l'insertion d'un retrait : le
--     versement est déjà créé et rattaché (lien vers la page du retrait). Cloche, notification, email tout de suite ; SMS
--     dû 2 minutes plus tard, jamais créé si le versement est déjà confirmé ;
--     private.notif_withdrawal_ack_paid : versement d'un retrait confirmé → le SMS d'accusé encore en attente est annulé
--     (SUPERSEDED) : pas deux SMS si le retrait est versé dans les 2 minutes (WITHDRAWAL_PAID suffit) ;
--  3. A5 : private.notif_partner_resubmitted, à chaque nouvelle date de dépôt du dossier complété ;
--  4. A8 : private.notif_shift_validated, quand l'écart d'une caisse est validé (organisatrice ou administrateur) ;
--  5. A9 : private.notif_controller_post_changed, déclencheur DIFFÉRÉ sur la porte ou le droit d'encaisser : un avis par
--     transaction (état final relu), rien pour une affectation créée dans la même transaction (CONTROLLER_ASSIGNED la
--     dit déjà), ni pour la porte choisie par le contrôleur lui-même (controller_gate_select : journal à son nom), ni
--     pour un événement terminé, annulé ou fini.
-- Droits : fonctions du schéma private fermées à tous les rôles de l'API. Sans BEGIN ni COMMIT, rejouable.
-- ============================================================================

-- 1. Registre
INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission, night_policy) VALUES
    ('WITHDRAWAL_REQUESTED',        'ESSENTIAL', NULL, ARRAY['IN_APP','SMS','EMAIL','PUSH'], 'ANY',        'ALLOW', FALSE, NULL, 'SEND'),
    ('PARTNER_RESUBMITTED_ACK',     'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH'],               'PARTNER',    'BLOCK', FALSE, NULL, 'DEFER'),
    ('SHIFT_DISCREPANCY_VALIDATED', 'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH'],               'CONTROLLER', 'BLOCK', FALSE, NULL, 'DEFER'),
    ('CONTROLLER_POST_CHANGED',     'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH'],               'CONTROLLER', 'BLOCK', FALSE, NULL, 'DEFER'),
    ('ACCOUNT_WELCOME',             'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH'],               'CLIENT',     'BLOCK', FALSE, NULL, 'DEFER')
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission,
    night_policy = EXCLUDED.night_policy;

-- 2. A2 : accusé de la demande de retrait (fin de la transaction de withdrawal_request)
CREATE OR REPLACE FUNCTION private.notif_withdrawal_requested()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    w        record;
    v_status text;
    v_key    text;
    v_data   jsonb;
BEGIN
    SELECT x.id, x.user_id, x.net_amount, x.operator, x.account_kind, x.cashout_id, x.withdrawal_method::text AS method
      INTO w
      FROM public.withdrawals x WHERE x.id = NEW.id;
    IF NOT FOUND OR w.user_id IS NULL THEN
        RETURN NULL;
    END IF;
    v_key := 'WITHDRAWAL_REQUESTED:' || w.id::text;
    v_data := jsonb_strip_nulls(jsonb_build_object(
        'withdrawal_id', w.id, 'cashout_id', w.cashout_id, 'amount', w.net_amount, 'operator', w.operator,
        'account_kind', w.account_kind, 'method', w.method));
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'WITHDRAWAL_REQUESTED', 'key', v_key, 'user_id', w.user_id, 'data', v_data,
        'channels', jsonb_build_array('IN_APP', 'PUSH', 'EMAIL')));
    -- SMS dû dans 2 minutes ; jamais si le versement est déjà confirmé (WITHDRAWAL_PAID part seul)
    SELECT c.status::text INTO v_status FROM public.cashouts c WHERE c.id = w.cashout_id;
    IF v_status IS DISTINCT FROM 'CONFIRME' THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'WITHDRAWAL_REQUESTED', 'key', v_key, 'user_id', w.user_id, 'data', v_data,
            'channels', jsonb_build_array('SMS'), 'due_at', now() + interval '2 minutes'));
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.notif_withdrawal_requested() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_withdrawal_requested_notify ON public.withdrawals;
CREATE CONSTRAINT TRIGGER trg_withdrawal_requested_notify
    AFTER INSERT ON public.withdrawals
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION private.notif_withdrawal_requested();

-- Versement d'un retrait confirmé : le SMS d'accusé encore en attente n'a plus lieu d'être (un seul SMS)
CREATE OR REPLACE FUNCTION private.notif_withdrawal_ack_paid()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.withdrawal_id IS NOT NULL THEN
        UPDATE public.notification_outbox
           SET status = 'CANCELLED', reason = 'SUPERSEDED', finished_at = now()
         WHERE type = 'WITHDRAWAL_REQUESTED' AND channel = 'SMS' AND status = 'PENDING'
           AND idempotency_key = 'WITHDRAWAL_REQUESTED:' || NEW.withdrawal_id::text || ':SMS';
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.notif_withdrawal_ack_paid() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_cashouts_withdrawal_ack_paid ON public.cashouts;
CREATE TRIGGER trg_cashouts_withdrawal_ack_paid
    AFTER UPDATE OF status ON public.cashouts
    FOR EACH ROW
    WHEN (NEW.kind::text = 'WITHDRAWAL' AND NEW.status::text = 'CONFIRME' AND OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION private.notif_withdrawal_ack_paid();

-- 3. A5 : dossier complété envoyé (accusé à la partenaire)
CREATE OR REPLACE FUNCTION private.notif_partner_resubmitted()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.user_id IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'PARTNER_RESUBMITTED_ACK',
            'key', 'PARTNER_RESUBMITTED_ACK:' || NEW.id::text || ':' || to_char(NEW.resubmitted_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS'),
            'user_id', NEW.user_id,
            'data', jsonb_strip_nulls(jsonb_build_object('partner_id', NEW.id, 'company', NULLIF(btrim(COALESCE(NEW.company_name, '')), '')))));
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.notif_partner_resubmitted() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_partner_resubmitted_notify ON public.partners;
CREATE TRIGGER trg_partner_resubmitted_notify
    AFTER UPDATE OF resubmitted_at ON public.partners
    FOR EACH ROW
    WHEN (NEW.resubmitted_at IS NOT NULL AND NEW.resubmitted_at IS DISTINCT FROM OLD.resubmitted_at)
    EXECUTE FUNCTION private.notif_partner_resubmitted();

-- 4. A8 : écart de caisse validé (avis au contrôleur)
CREATE OR REPLACE FUNCTION private.notif_shift_validated()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_data  jsonb := public.notif_event_data(NEW.event_id);
    v_owner uuid;
BEGIN
    IF v_data IS NULL OR NEW.controller_id IS NULL THEN
        RETURN NULL;
    END IF;
    SELECT pa.user_id INTO v_owner FROM public.partners pa WHERE pa.id = NEW.partner_id;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'SHIFT_DISCREPANCY_VALIDATED', 'key', 'SHIFT_DISCREPANCY_VALIDATED:' || NEW.id::text,
        'user_id', NEW.controller_id, 'event_id', NEW.event_id, 'shift_id', NEW.id,
        'data', v_data || jsonb_build_object(
            'shift_id', NEW.id,
            'by', CASE WHEN NEW.discrepancy_validated_by IS NOT DISTINCT FROM v_owner THEN 'PARTNER' ELSE 'ADMIN' END)));
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.notif_shift_validated() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_shift_validated_notify ON public.controller_shifts;
CREATE TRIGGER trg_shift_validated_notify
    AFTER UPDATE OF discrepancy_validated_at ON public.controller_shifts
    FOR EACH ROW
    WHEN (OLD.discrepancy_validated_at IS NULL AND NEW.discrepancy_validated_at IS NOT NULL)
    EXECUTE FUNCTION private.notif_shift_validated();

-- 5. A9 : porte ou droit d'encaisser changé après l'affectation (fin de transaction, état final relu). Contre-vérification
-- (observation 2) : chaque mise à jour différée garde son propre OLD ; seule la PREMIÈRE de la transaction pour une
-- affectation (dont l'OLD est l'état de départ) décide, les suivantes ne font rien : porte A → B → A, aucun avis.
CREATE OR REPLACE FUNCTION private.notif_controller_post_changed()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cur       record;
    v_gate    boolean;
    v_cash    boolean;
    v_status  text;
    v_data    jsonb;
    v_gname   text;
    v_changes jsonb := '[]'::jsonb;
BEGIN
    -- Affectation créée dans cette même transaction : l'avis d'affectation dit déjà la porte et l'encaissement
    IF OLD.created_at >= now() THEN
        RETURN NULL;
    END IF;
    -- Une seule décision par affectation et par transaction, prise sur l'état de départ (OLD de la première mise à jour)
    IF position(',' || NEW.id::text || ',' IN COALESCE(current_setting('event_village.post_changed', true), '')) > 0 THEN
        RETURN NULL;
    END IF;
    PERFORM set_config('event_village.post_changed',
                       COALESCE(NULLIF(current_setting('event_village.post_changed', true), ''), ',') || NEW.id::text || ',', true);
    SELECT ec.id, ec.event_id, ec.user_id, ec.gate_id, ec.can_accept_cash INTO cur
      FROM public.event_controllers ec WHERE ec.id = NEW.id;
    IF NOT FOUND THEN
        RETURN NULL;   -- affectation retirée dans la même transaction (CONTROLLER_UNASSIGNED)
    END IF;
    v_gate := cur.gate_id IS DISTINCT FROM OLD.gate_id;
    v_cash := cur.can_accept_cash IS DISTINCT FROM OLD.can_accept_cash;
    IF NOT (v_gate OR v_cash) THEN
        RETURN NULL;   -- revenu à l'état de départ
    END IF;
    -- Porte choisie par le contrôleur lui-même (controller_gate_select, journal à son nom) : rien à lui dire
    IF v_gate AND NOT v_cash AND EXISTS (SELECT 1 FROM public.audit_logs a
                                          WHERE a.object_id = cur.id AND a.user_id = cur.user_id AND a.created_at >= now()) THEN
        RETURN NULL;
    END IF;
    SELECT e.status::text INTO v_status FROM public.events e WHERE e.id = cur.event_id;
    IF v_status IS NULL OR v_status NOT IN ('VALIDE', 'PUBLIE', 'SUSPENDU') OR now() >= public.event_end_at(cur.event_id) THEN
        RETURN NULL;
    END IF;
    v_data := public.notif_event_data(cur.event_id);
    IF v_data IS NULL THEN
        RETURN NULL;
    END IF;
    SELECT NULLIF(btrim(g.name), '') INTO v_gname FROM public.event_gates g WHERE g.id = cur.gate_id;
    IF v_gate THEN v_changes := v_changes || '["GATE"]'::jsonb; END IF;
    IF v_cash THEN v_changes := v_changes || '["CASH"]'::jsonb; END IF;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'CONTROLLER_POST_CHANGED', 'key', 'CONTROLLER_POST_CHANGED:' || cur.id::text || ':' || txid_current()::text,
        'user_id', cur.user_id, 'event_id', cur.event_id,
        'data', v_data || jsonb_build_object('assignment_id', cur.id, 'gate_name', v_gname, 'can_accept_cash', cur.can_accept_cash, 'changes', v_changes)));
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.notif_controller_post_changed() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_controller_post_changed_notify ON public.event_controllers;
CREATE CONSTRAINT TRIGGER trg_controller_post_changed_notify
    AFTER UPDATE OF gate_id, can_accept_cash ON public.event_controllers
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    WHEN (OLD.gate_id IS DISTINCT FROM NEW.gate_id OR OLD.can_accept_cash IS DISTINCT FROM NEW.can_accept_cash)
    EXECUTE FUNCTION private.notif_controller_post_changed();
