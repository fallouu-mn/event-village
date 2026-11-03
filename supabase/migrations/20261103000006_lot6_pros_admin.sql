-- ============================================================================
-- EVENT VILLAGE — LOT 6, TÂCHE 6.6 : notifications des professionnels et de l'administration
-- (contrat J2.1 à J2.13, G2 ; décisions 19, 20, 39, 41, 42, 44)
-- ============================================================================
-- Chaque avis est mis en file (notif_enqueue, notif_enqueue_admins, migration 20261103000002) dans la
-- transaction du fait métier qui le déclenche ; l'envoyeur unique le livre ensuite. Plus aucune écriture
-- directe dans public.notifications (seule notification_outbox_mark en écrit).
--
--  J2.1  shift_close (recopie de 20261102000002_lot5_dette.sql:230-348) : l'INSERT dans notifications
--        devient SHIFT_DISCREPANCY (écart non nul, au partenaire) ; SHIFT_CLOSED_BY_OTHER au contrôleur
--        quand un tiers ferme sa caisse ; la réponse remplace alert_id par alert_queued.
--  J2.2  trg_cashouts_notify : remboursements, retraits, alertes admin et signaux admin_signals.
--  J2.3  fin_alert_superadmins (recopie de 20261101000004_lot3_grand_livre.sql:78-92, signature inchangée) :
--        l'audit reste, la notification devient ADMIN_FINANCE_DEBT (destinataires par permission).
--  J2.4  trg_event_controllers_notify et notif_upsert_aggregated_sms : un avis in-app et push par
--        affectation, un SMS regroupé par transaction ; rappels contrôleur annulés au retrait.
--  J2.5  trg_partners_notify : inscription (accusé et alerte admin), validation, refus, suspension,
--        réactivation.
--  J2.6  partner_status_set : statuts partenaire et compte synchronisés, sessions révoquées.
--  J2.7  trg_partners_subscription : SUBSCRIPTION_ACTIVATED.
--  J2.8  activate_partner_trial (recopie de 0008_partner_auth_production.sql) : TRIAL_STARTED.
--  J2.9  on_auth_user_password_changed : PASSWORD_CHANGED.
--  J2.10 trg_payments_other_success : PAYMENT_SUCCESS (paiements hors billetterie).
--  J2.11 trg_hall_reservations_notify, trg_sponsored_promotions_notify.
--  J2.12 notification_controller_activated : CONTROLLER_ACTIVATED.
--
-- Clés d'idempotence (Conventions) : identifiants du fait métier ; txid_current() seulement pour le SMS
-- regroupé des affectations et pour les changements de statut d'un partenaire (exception documentée).
-- Les triggers ignorent les suppressions en cascade (technique de 20261102000003_lot5_cycle.sql:316).
-- Privilèges (règle 1A.3) : chaque fonction, triggers compris, SECURITY DEFINER, search_path = public,
-- volatilité explicite, REVOKE ALL FROM PUBLIC, anon, authenticated puis GRANT EXECUTE TO service_role.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Outil interne : données d'un événement pour template_data (contrat G2 : event_id, title, start_at ISO,
-- location, city). Objet vide si l'événement n'existe pas.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_pros_event_data(p_event uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((
        SELECT jsonb_strip_nulls(jsonb_build_object(
            'event_id', e.id,
            'title', e.title,
            'start_at', to_char(public.event_start_at(e.id) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'location', e.location,
            'city', e.city))
          FROM public.events e WHERE e.id = p_event
    ), '{}'::jsonb)
$$;


-- ----------------------------------------------------------------------------
-- J2.4 — SMS regroupé : une ligne par compte et par transaction, les événements s'ajoutent à
-- template_data.events tant que la ligne est PENDING.
-- p = { type, key, user_id, event_id?, actor_id?, data, event, now? } ; renvoie le nombre de lignes créées
-- ou complétées. Mêmes contrôles initiaux que notif_enqueue pour le canal SMS.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_upsert_aggregated_sms(p jsonb)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type     text := p->>'type';
    v_key      text := NULLIF(btrim(COALESCE(p->>'key', '')), '');
    v_user     uuid := NULLIF(p->>'user_id', '')::uuid;
    v_event    uuid := NULLIF(p->>'event_id', '')::uuid;
    v_actor    uuid := NULLIF(p->>'actor_id', '')::uuid;
    v_data     jsonb := COALESCE(p->'data', '{}'::jsonb);
    v_item     jsonb := p->'event';
    v_family   text;
    v_topic    text;
    v_channels text[];
    v_policy   text;
    v_sync     boolean;
    v_now      timestamptz;
    v_ustatus  text;
    v_uphone   text;
    v_blocked  boolean;
    v_pref     boolean;
    v_status   text := 'PENDING';
    v_reason   text;
    v_decision jsonb;
    v_n        integer;
BEGIN
    SELECT t.family, t.topic, t.channels, t.suspended_policy, t.sync_only
      INTO v_family, v_topic, v_channels, v_policy, v_sync
      FROM public.notification_types t WHERE t.type = v_type;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'NT001', MESSAGE = format('Type de notification inconnu : %s.', COALESCE(v_type, '(vide)'));
    END IF;
    IF v_sync THEN
        RAISE EXCEPTION USING ERRCODE = 'NT002',
            MESSAGE = format('Le type %s est un envoi synchrone : il se journalise par notification_sync_log.', v_type);
    END IF;
    IF NOT ('SMS' = ANY (v_channels)) THEN
        RAISE EXCEPTION USING ERRCODE = 'NT001', MESSAGE = format('Le type %s n''a pas de canal SMS.', v_type);
    END IF;
    v_now := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    IF v_now < now() - interval '1 minute' THEN
        RAISE EXCEPTION USING ERRCODE = 'NT003', MESSAGE = 'Horloge refusée : une heure dans le passé n''est jamais acceptée.';
    END IF;
    IF v_key IS NULL OR v_user IS NULL OR v_item IS NULL OR jsonb_typeof(v_item) <> 'object' THEN
        RAISE EXCEPTION USING ERRCODE = 'NT004', MESSAGE = 'SMS regroupé incomplet (clé, compte ou événement absent).';
    END IF;

    SELECT u.status::text, u.phone INTO v_ustatus, v_uphone FROM public.users u WHERE u.id = v_user;
    v_blocked := public.notif_account_blocked(v_user);
    IF v_family = 'OPTIONAL' THEN
        v_pref := public.notif_preference_enabled(v_user, v_topic, 'SMS');
    END IF;

    IF v_blocked AND v_policy = 'BLOCK' THEN
        v_status := 'SKIPPED'; v_reason := 'ACCOUNT_SUSPENDED';
    ELSIF v_family = 'OPTIONAL' AND v_pref IS FALSE THEN
        v_status := 'SKIPPED'; v_reason := 'PREFERENCE_DISABLED';
    ELSIF v_uphone IS NULL OR btrim(v_uphone) = '' THEN
        v_status := 'SKIPPED'; v_reason := 'NO_PHONE';
    END IF;
    IF v_status = 'SKIPPED' THEN
        v_decision := jsonb_strip_nulls(jsonb_build_object(
            'at', v_now, 'stage', 'ENQUEUE', 'outcome', 'SKIP', 'reason', v_reason,
            'family', v_family, 'topic', v_topic,
            'account', jsonb_build_object('status', v_ustatus, 'blocked', v_blocked),
            'preference', CASE WHEN v_family = 'OPTIONAL' THEN jsonb_build_object('topic', v_topic, 'channel', 'SMS', 'enabled', COALESCE(v_pref, TRUE)) END
        ));
    END IF;

    IF jsonb_typeof(v_data->'events') IS DISTINCT FROM 'array' THEN
        v_data := jsonb_set(v_data, '{events}', jsonb_build_array(v_item));
    END IF;

    INSERT INTO public.notification_outbox AS o (
        idempotency_key, group_key, type, family, topic, channel, origin,
        recipient_user_id, event_id, actor_id, template_data, status, reason,
        attempts, max_attempts, due_at, next_attempt_at, finished_at, decision
    ) VALUES (
        v_key || ':SMS', v_key, v_type, v_family, v_topic, 'SMS', 'OUTBOX',
        v_user, v_event, v_actor, v_data, v_status, v_reason,
        0, 5, v_now, v_now, CASE WHEN v_status = 'SKIPPED' THEN v_now END, v_decision
    )
    ON CONFLICT (idempotency_key) DO UPDATE
       SET template_data = jsonb_set(o.template_data, '{events}',
                                     COALESCE(o.template_data->'events', '[]'::jsonb) || jsonb_build_array(v_item))
     WHERE o.status = 'PENDING';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
END;
$$;


-- ----------------------------------------------------------------------------
-- J2.1 — shift_close (recopie intégrale de 20261102000002_lot5_dette.sql:230-348). Seul le bloc d'alerte
-- change : SHIFT_DISCREPANCY au partenaire (écart non nul), SHIFT_CLOSED_BY_OTHER au contrôleur quand la
-- caisse est fermée par le partenaire ou un admin ; la réponse donne alert_queued au lieu de alert_id.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shift_close(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shift uuid := public.try_uuid(p->>'shift_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_just text := NULLIF(btrim(COALESCE(p->>'justification', '')), '');
    v_pin_salt text := NULLIF(p->>'pin_salt', '');
    v_pin_hash text := NULLIF(p->>'pin_hash', '');
    sh record;
    pin record;
    v_role text;
    v_declared numeric;
    v_disc numeric;
    v_cosigned boolean := FALSE;
    v_partner_user uuid;
    v_event_title text;
    v_ctrl_name text;
    v_event_data jsonb;
    v_alert_queued boolean := FALSE;
    v_created integer := 0;
BEGIN
    IF v_shift IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande de clôture incomplète.');
    END IF;
    SELECT * INTO sh FROM public.controller_shifts WHERE id = v_shift FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_FOUND', 'message', 'Session de caisse introuvable.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status = 'ACTIF') THEN
        v_role := CASE
            WHEN sh.controller_id = v_actor THEN 'CAISSE'
            WHEN EXISTS (SELECT 1 FROM public.partners pa WHERE pa.id = sh.partner_id AND pa.user_id = v_actor) THEN 'PARTENAIRE'
            WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role IN ('ADMIN', 'SUPERADMIN')) THEN 'ADMIN'
        END;
    END IF;
    IF v_role IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_FOUND', 'message', 'Session de caisse introuvable.');
    END IF;
    IF sh.status <> 'OUVERT' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_OPEN', 'status', sh.status,
                                  'message', 'Cette session de caisse est déjà clôturée.');
    END IF;
    IF jsonb_typeof(p->'declared_cash_total') IS DISTINCT FROM 'number' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DECLARED', 'message', 'Le montant déclaré doit être un nombre entier de francs, positif ou nul.');
    END IF;
    v_declared := (p->>'declared_cash_total')::numeric;
    IF v_declared < 0 OR v_declared <> trunc(v_declared) OR v_declared > 9999999999 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DECLARED', 'message', 'Le montant déclaré doit être un nombre entier de francs, positif ou nul.');
    END IF;

    v_disc := v_declared - sh.expected_cash_total;   -- total attendu relu sous verrou
    IF v_disc <> 0 THEN
        IF v_just IS NULL OR char_length(v_just) < 10 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'JUSTIFICATION_REQUIRED', 'expected', sh.expected_cash_total,
                                      'declared', v_declared, 'discrepancy', v_disc,
                                      'message', 'Un écart de caisse doit être justifié (10 caractères au moins).');
        END IF;
        IF char_length(v_just) > 1000 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_JUSTIFICATION', 'message', 'La justification est limitée à 1 000 caractères.');
        END IF;
        IF v_pin_salt IS NULL OR v_pin_hash IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PIN_REQUIRED', 'expected', sh.expected_cash_total,
                                      'declared', v_declared, 'discrepancy', v_disc,
                                      'message', 'Le code PIN régisseur est obligatoire pour co-signer une clôture avec écart.');
        END IF;
        SELECT pin_hash, pin_salt INTO pin FROM public.event_regisseur_pins WHERE event_id = sh.event_id FOR SHARE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PIN_NOT_SET', 'message', 'Aucun code PIN régisseur n''a été généré pour cet événement.');
        END IF;
        IF pin.pin_salt IS DISTINCT FROM v_pin_salt OR pin.pin_hash IS DISTINCT FROM v_pin_hash THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PIN_INVALID', 'message', 'Code PIN régisseur incorrect.');
        END IF;
        v_cosigned := TRUE;
    END IF;

    UPDATE public.controller_shifts
       SET status = 'CLOTURE',
           declared_cash_total = v_declared,
           discrepancy_amount = v_disc,
           discrepancy_justification = CASE WHEN v_disc <> 0 THEN v_just END,
           closed_at = now(),
           closed_by = v_actor,
           closing_confirmed_by_pin = v_cosigned,
           updated_at = now()
     WHERE id = sh.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, v_role, 'SHIFT_CLOSED', 'controller_shifts', sh.id,
            jsonb_build_object('event_id', sh.event_id, 'expected', sh.expected_cash_total, 'declared', v_declared,
                               'discrepancy', v_disc, 'pin_cosigned', v_cosigned, 'closed_by_role', v_role));

    SELECT title INTO v_event_title FROM public.events WHERE id = sh.event_id;
    SELECT NULLIF(btrim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '') INTO v_ctrl_name
      FROM public.users WHERE id = sh.controller_id;
    v_event_data := public.notif_pros_event_data(sh.event_id);

    -- Lot 6 (J2.1) : alerte d'écart au partenaire propriétaire, mise en file dans cette transaction.
    IF v_disc <> 0 THEN
        SELECT user_id INTO v_partner_user FROM public.partners WHERE id = sh.partner_id;
        IF v_partner_user IS NOT NULL THEN
            v_created := public.notif_enqueue(jsonb_build_object(
                'type', 'SHIFT_DISCREPANCY',
                'key', 'SHIFT_DISCREPANCY:' || sh.id::text,
                'user_id', v_partner_user,
                'event_id', sh.event_id,
                'shift_id', sh.id,
                'data', v_event_data || jsonb_build_object(
                    'shift_id', sh.id,
                    'controller_name', COALESCE(v_ctrl_name, 'votre contrôleur'),
                    'difference', v_disc,
                    'declared', v_declared,
                    'expected', sh.expected_cash_total,
                    'justification', v_just)
            ));
            v_alert_queued := v_created > 0;
        END IF;
    END IF;

    -- Lot 6 (J2.1) : caisse fermée par le partenaire ou un admin → avis au contrôleur de la caisse.
    IF v_role IN ('PARTENAIRE', 'ADMIN') THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'SHIFT_CLOSED_BY_OTHER',
            'key', 'SHIFT_CLOSED_BY_OTHER:' || sh.id::text,
            'user_id', sh.controller_id,
            'event_id', sh.event_id,
            'shift_id', sh.id,
            'data', v_event_data || jsonb_build_object(
                'shift_id', sh.id,
                'closed_by', CASE WHEN v_role = 'PARTENAIRE' THEN 'PARTNER' ELSE 'ADMIN' END,
                'declared', v_declared)
        ));
    END IF;

    RETURN jsonb_build_object('ok', true, 'shift_id', sh.id, 'event_id', sh.event_id, 'partner_id', sh.partner_id,
                              'expected', sh.expected_cash_total, 'declared', v_declared, 'discrepancy', v_disc,
                              'pin_cosigned', v_cosigned, 'closed_by', v_actor, 'closed_by_role', v_role,
                              'alert_queued', v_alert_queued, 'event_title', v_event_title, 'controller_name', v_ctrl_name,
                              'justification', CASE WHEN v_disc <> 0 THEN v_just END);
END;
$$;


-- ----------------------------------------------------------------------------
-- J2.2 — trg_cashouts_notify : tout changement de statut ou de motif de blocage d'un cashout (écritures
-- de lib/payments/cashout.service.ts, du cron payments-reconcile, de l'annulation d'un événement et des
-- RPC refund_request, ticket_refund_request, withdrawal_request) met ses avis en file ici.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_cashouts_notify()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_refund        boolean := NEW.kind IN ('REFUND', 'EVENT_CANCELLATION_REFUND', 'TICKET_REFUND');
    v_status_new    boolean := TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status;
    v_blocked_new   boolean := NEW.status = 'A_ENVOYER' AND NEW.blocked_reason IS NOT NULL
                               AND (TG_OP = 'INSERT' OR OLD.blocked_reason IS NULL);
    v_event         uuid;
    v_event_data    jsonb := '{}'::jsonb;
    v_partner_user  uuid;
    v_user          uuid;
    v_phone         text;
    v_account_kind  text;
    v_money         jsonb;
    v_day           text := to_char(timezone('Africa/Dakar', now()), 'YYYY-MM-DD');
BEGIN
    IF NOT (v_status_new OR v_blocked_new) THEN
        RETURN NEW;
    END IF;

    -- Bénéficiaire : le compte s'il existe encore ; numéro du compte résolu à l'envoi, sinon le numéro
    -- du versement (9 chiffres) pour le SMS.
    IF NEW.beneficiary_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.beneficiary_user_id) THEN
        v_user := NEW.beneficiary_user_id;
    END IF;
    IF (v_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user AND NULLIF(btrim(COALESCE(u.phone, '')), '') IS NOT NULL))
       AND NEW.phone_number ~ '^[0-9]{9}$' THEN
        v_phone := '+221' || NEW.phone_number;
    END IF;

    -- Événement d'un remboursement : celui du paiement, sinon celui du billet.
    IF v_refund THEN
        SELECT p.event_id INTO v_event FROM public.payments p WHERE p.id = NEW.payment_id;
        IF v_event IS NULL AND NEW.ticket_id IS NOT NULL THEN
            SELECT t.event_id INTO v_event FROM public.tickets t WHERE t.id = NEW.ticket_id;
        END IF;
        IF v_event IS NOT NULL THEN
            v_event_data := public.notif_pros_event_data(v_event);
            SELECT pa.user_id INTO v_partner_user
              FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
             WHERE e.id = v_event;
        END IF;
    ELSE
        SELECT w.account_kind INTO v_account_kind FROM public.withdrawals w WHERE w.id = NEW.withdrawal_id;
    END IF;

    v_money := jsonb_strip_nulls(jsonb_build_object(
        'cashout_id', NEW.id, 'amount', NEW.amount, 'operator', NEW.operator, 'account_kind', v_account_kind));

    -- 1. Demande de remboursement d'un billet (création du cashout)
    IF TG_OP = 'INSERT' AND NEW.kind = 'TICKET_REFUND' AND v_user IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'REFUND_REQUESTED',
            'key', 'REFUND_REQUESTED:' || NEW.id::text,
            'user_id', v_user,
            'event_id', v_event,
            'data', v_event_data || jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount)
        ));
    END IF;

    -- 2. Remboursement bloqué (motif posé alors qu'il attend l'envoi)
    IF v_refund AND v_blocked_new THEN
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_REFUND_TO_RETRY',
            'ref', NEW.id::text || ':' || NEW.attempt_count::text || ':BLOQUE',
            'event_id', v_event,
            'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'cashout_status', 'BLOQUE',
                                       'blocked_reason', NEW.blocked_reason, 'kind', NEW.kind)
        ));
        INSERT INTO public.admin_signals (kind, ref_id) VALUES ('REFUND_TO_RETRY', NEW.id) ON CONFLICT DO NOTHING;
        IF NEW.kind = 'EVENT_CANCELLATION_REFUND' AND v_partner_user IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'CANCEL_REFUNDS_BLOCKED',
                'key', 'CANCEL_REFUNDS_BLOCKED:' || v_event::text || ':' || v_day,
                'user_id', v_partner_user,
                'event_id', v_event,
                'data', v_event_data
            ));
        END IF;
    END IF;

    IF NOT v_status_new OR TG_OP = 'INSERT' THEN
        RETURN NEW;
    END IF;

    -- 3. Statut final ou incertain
    IF NEW.status = 'CONFIRME' THEN
        IF v_refund THEN
            IF v_user IS NOT NULL OR v_phone IS NOT NULL THEN
                PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                    'type', 'REFUND_PAID',
                    'key', 'REFUND_PAID:' || NEW.id::text,
                    'user_id', v_user,
                    'phone', v_phone,
                    'event_id', v_event,
                    'data', v_event_data || v_money
                )));
            END IF;
            IF NEW.kind = 'EVENT_CANCELLATION_REFUND' AND v_event IS NOT NULL AND v_partner_user IS NOT NULL THEN
                -- Verrou par événement : deux confirmations concurrentes se voient (lecture après le verrou).
                PERFORM pg_advisory_xact_lock(hashtextextended('notif-cancel-refunds:' || v_event::text, 0));
                IF NOT EXISTS (
                    SELECT 1 FROM public.cashouts c JOIN public.payments p ON p.id = c.payment_id
                     WHERE p.event_id = v_event AND c.kind = 'EVENT_CANCELLATION_REFUND'
                       AND c.id <> NEW.id AND c.status <> 'CONFIRME'
                ) THEN
                    PERFORM public.notif_enqueue(jsonb_build_object(
                        'type', 'CANCEL_REFUNDS_DONE',
                        'key', 'CANCEL_REFUNDS_DONE:' || v_event::text,
                        'user_id', v_partner_user,
                        'event_id', v_event,
                        'data', v_event_data
                    ));
                END IF;
            END IF;
        ELSIF v_user IS NOT NULL OR v_phone IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                'type', 'WITHDRAWAL_PAID',
                'key', 'WITHDRAWAL_PAID:' || NEW.id::text,
                'user_id', v_user,
                'phone', v_phone,
                'data', v_money
            )));
        END IF;

    ELSIF NEW.status = 'ECHOUE' THEN
        IF v_refund THEN
            PERFORM public.notif_enqueue_admins(jsonb_build_object(
                'type', 'ADMIN_REFUND_TO_RETRY',
                'ref', NEW.id::text || ':' || NEW.attempt_count::text || ':ECHOUE',
                'event_id', v_event,
                'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'cashout_status', 'ECHOUE', 'kind', NEW.kind)
            ));
            INSERT INTO public.admin_signals (kind, ref_id) VALUES ('REFUND_TO_RETRY', NEW.id) ON CONFLICT DO NOTHING;
            IF NEW.kind = 'EVENT_CANCELLATION_REFUND' AND v_partner_user IS NOT NULL THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'CANCEL_REFUNDS_BLOCKED',
                    'key', 'CANCEL_REFUNDS_BLOCKED:' || v_event::text || ':' || v_day,
                    'user_id', v_partner_user,
                    'event_id', v_event,
                    'data', v_event_data
                ));
            END IF;
        ELSE
            IF v_user IS NOT NULL OR v_phone IS NOT NULL THEN
                PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                    'type', 'WITHDRAWAL_REJECTED',
                    'key', 'WITHDRAWAL_REJECTED:' || NEW.id::text,
                    'user_id', v_user,
                    'phone', v_phone,
                    'data', v_money
                )));
            END IF;
            PERFORM public.notif_enqueue_admins(jsonb_build_object(
                'type', 'ADMIN_WITHDRAWAL_REJECTED',
                'ref', NEW.id::text,
                'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount)
            ));
        END IF;

    ELSIF NEW.status = 'INCERTAIN' THEN
        IF NOT v_refund AND (v_user IS NOT NULL OR v_phone IS NOT NULL) THEN
            PERFORM public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                'type', 'WITHDRAWAL_UNCERTAIN',
                'key', 'WITHDRAWAL_UNCERTAIN:' || NEW.id::text || ':' || NEW.attempt_count::text,
                'user_id', v_user,
                'phone', v_phone,
                'data', v_money
            )));
        END IF;
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_CASHOUT_UNCERTAIN',
            'ref', NEW.id::text || ':' || NEW.attempt_count::text,
            'event_id', v_event,
            'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'kind', NEW.kind)
        ));
        INSERT INTO public.admin_signals (kind, ref_id) VALUES ('CASHOUT_UNCERTAIN', NEW.id) ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cashouts_notify ON public.cashouts;
CREATE TRIGGER trg_cashouts_notify
    AFTER INSERT OR UPDATE OF status, blocked_reason ON public.cashouts
    FOR EACH ROW EXECUTE FUNCTION public.notif_cashouts_notify();


-- ----------------------------------------------------------------------------
-- J2.3 — fin_alert_superadmins (recopie de 20261101000004_lot3_grand_livre.sql:78-92, même signature).
-- L'audit reste ; l'avis devient ADMIN_FINANCE_DEBT (permission payments.read, le SUPERADMIN reçoit tout).
-- Seul appelant : fin_ledger_debit (créance, p_object_type = 'finance_debts').
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fin_alert_superadmins(p_action text, p_title text, p_content text, p_object_type text, p_object_id uuid, p_metadata jsonb)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.audit_logs (user_role, action, object_type, object_id, metadata)
    VALUES ('SYSTEM', p_action, p_object_type, p_object_id, COALESCE(p_metadata, '{}'::jsonb));
    IF p_object_type = 'finance_debts' AND p_object_id IS NOT NULL THEN
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_FINANCE_DEBT',
            'ref', p_object_id::text,
            'data', COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('debt_id', p_object_id)
        ));
    ELSE
        -- Aucun modèle d'avis pour une autre alerte : l'audit est écrit, l'absence d'avis est signalée.
        RAISE WARNING 'fin_alert_superadmins : alerte % (%) journalisée sans avis (aucun modèle pour cet objet).', p_action, p_object_type;
    END IF;
END;
$$;


-- ----------------------------------------------------------------------------
-- J2.4 — trg_event_controllers_notify : affectation (INSERT) et retrait (DELETE) d'un contrôleur.
-- Écritures couvertes : routes d'équipe (invite, assignments, [eventId], all), RPC
-- atomic_partner_remove_controller, lib/admin/admin.service.ts. UPDATE (point d'entrée, espèces) : aucun
-- avis (le rappel de la veille porte la valeur du moment).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_event_controllers_notify()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ev   jsonb;
    v_item jsonb;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_ev := public.notif_pros_event_data(NEW.event_id);
        v_item := jsonb_strip_nulls(jsonb_build_object('event_id', NEW.event_id, 'title', v_ev->>'title', 'start_at', v_ev->>'start_at'));
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'CONTROLLER_ASSIGNED',
            'key', 'CONTROLLER_ASSIGNED:' || NEW.id::text,
            'user_id', NEW.user_id,
            'event_id', NEW.event_id,
            'actor_id', NEW.created_by,
            'channels', jsonb_build_array('IN_APP', 'PUSH'),
            'data', v_ev || jsonb_build_object('assignment_id', NEW.id, 'entry_point', NEW.entry_point, 'can_accept_cash', NEW.can_accept_cash)
        ));
        PERFORM public.notif_upsert_aggregated_sms(jsonb_build_object(
            'type', 'CONTROLLER_ASSIGNED',
            'key', 'CONTROLLER_ASSIGNED_SMS:' || NEW.user_id::text || ':tx' || txid_current()::text,
            'user_id', NEW.user_id,
            'event_id', NEW.event_id,
            'actor_id', NEW.created_by,
            'event', v_item,
            'data', v_ev || jsonb_build_object('assignment_id', NEW.id, 'entry_point', NEW.entry_point,
                                               'can_accept_cash', NEW.can_accept_cash, 'events', jsonb_build_array(v_item))
        ));
        RETURN NEW;
    END IF;

    -- DELETE : une suppression en cascade (événement ou compte supprimé) ne prévient personne.
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = OLD.user_id)
       OR NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = OLD.event_id) THEN
        RETURN OLD;
    END IF;
    v_ev := public.notif_pros_event_data(OLD.event_id);
    v_item := jsonb_strip_nulls(jsonb_build_object('event_id', OLD.event_id, 'title', v_ev->>'title', 'start_at', v_ev->>'start_at'));
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'CONTROLLER_UNASSIGNED',
        'key', 'CONTROLLER_UNASSIGNED:' || OLD.id::text,
        'user_id', OLD.user_id,
        'event_id', OLD.event_id,
        'actor_id', OLD.created_by,
        'channels', jsonb_build_array('IN_APP', 'PUSH'),
        'data', v_ev || jsonb_build_object('assignment_id', OLD.id)
    ));
    PERFORM public.notif_upsert_aggregated_sms(jsonb_build_object(
        'type', 'CONTROLLER_UNASSIGNED',
        'key', 'CONTROLLER_UNASSIGNED_SMS:' || OLD.user_id::text || ':tx' || txid_current()::text,
        'user_id', OLD.user_id,
        'event_id', OLD.event_id,
        'actor_id', OLD.created_by,
        'event', v_item,
        'data', v_ev || jsonb_build_object('assignment_id', OLD.id, 'events', jsonb_build_array(v_item))
    ));
    -- Rappels de la veille encore en attente pour cette affectation : annulés dans la même transaction.
    UPDATE public.notification_outbox
       SET status = 'CANCELLED', reason = 'NO_LONGER_ASSIGNED', finished_at = now()
     WHERE type = 'CONTROLLER_REMINDER' AND status = 'PENDING'
       AND event_id = OLD.event_id AND recipient_user_id = OLD.user_id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_controllers_notify ON public.event_controllers;
CREATE TRIGGER trg_event_controllers_notify
    AFTER INSERT OR DELETE ON public.event_controllers
    FOR EACH ROW EXECUTE FUNCTION public.notif_event_controllers_notify();


-- ----------------------------------------------------------------------------
-- J2.5 — trg_partners_notify : inscription et changements de statut d'un partenaire. Clés à txid : une
-- même instruction ne change le statut qu'une fois, un rejeu sans changement ne déclenche rien.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_partners_notify()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type   text;
    v_data   jsonb;
    v_old    text;
    v_new    text := NEW.status::text;
    v_tx     text := 'tx' || txid_current()::text;
BEGIN
    IF NEW.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id) THEN
        RETURN NEW;
    END IF;
    v_data := jsonb_build_object('partner_id', NEW.id, 'company', COALESCE(NULLIF(btrim(NEW.company_name), ''), 'votre structure'));

    IF TG_OP = 'INSERT' THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'PARTNER_REGISTERED_ACK',
            'key', 'PARTNER_REGISTERED_ACK:' || NEW.id::text,
            'user_id', NEW.user_id,
            'data', v_data
        ));
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_PARTNER_REGISTERED',
            'ref', NEW.id::text,
            'data', v_data
        ));
        RETURN NEW;
    END IF;

    v_old := OLD.status::text;
    IF v_new IS NOT DISTINCT FROM v_old THEN
        RETURN NEW;
    END IF;
    IF v_new = 'VALIDE' AND v_old IN ('EN_ATTENTE', 'REJETE') THEN
        v_type := 'PARTNER_VALIDATED';
    ELSIF v_new = 'VALIDE' AND v_old = 'SUSPENDU' THEN
        v_type := 'PARTNER_REACTIVATED';
    ELSIF v_new = 'REJETE' THEN
        v_type := 'PARTNER_REJECTED';
        v_data := v_data || jsonb_build_object('reason', COALESCE(NULLIF(btrim(NEW.rejection_reason), ''), 'motif non précisé'));
    ELSIF v_new = 'SUSPENDU' THEN
        v_type := 'PARTNER_SUSPENDED';
        v_data := v_data || jsonb_build_object('reason', COALESCE(NULLIF(btrim(NEW.suspended_reason), ''), 'motif non précisé'));
    ELSE
        RETURN NEW;   -- retour en attente : aucun avis
    END IF;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', v_type,
        'key', v_type || ':' || NEW.id::text || ':' || v_tx,
        'user_id', NEW.user_id,
        'data', v_data
    ));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partners_notify ON public.partners;
CREATE TRIGGER trg_partners_notify
    AFTER INSERT OR UPDATE OF status ON public.partners
    FOR EACH ROW EXECUTE FUNCTION public.notif_partners_notify();


-- ----------------------------------------------------------------------------
-- J2.6 — partner_status_set(p) : { partner_id, actor_id, status ∈ VALIDE | REJETE | SUSPENDU, reason? }.
-- Transitions : celles de la route du lot 5 (tout changement vers un statut différent). Le compte est
-- mis à jour AVANT la fiche : le trigger des avis voit déjà le compte réactivé (PARTNER_REACTIVATED,
-- politique BLOCK) ; à la suspension, l'avis part malgré tout (PARTNER_SUSPENDED, politique ALLOW).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_status_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner uuid := public.try_uuid(p->>'partner_id');
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_status  text := p->>'status';
    v_reason  text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    pa        record;
    v_revoked integer;
    v_row     record;
BEGIN
    IF v_partner IS NULL OR v_actor IS NULL OR v_status IS NULL OR v_status NOT IN ('VALIDE', 'REJETE', 'SUSPENDU') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande incomplète.');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.users u
         WHERE u.id = v_actor AND u.status::text = 'ACTIF'
           AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role::text IN ('ADMIN', 'SUPERADMIN'))
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Action réservée aux administrateurs.');
    END IF;
    SELECT * INTO pa FROM public.partners WHERE id = v_partner FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_FOUND', 'message', 'Partenaire introuvable.');
    END IF;
    IF pa.status::text = v_status THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'status', pa.status::text,
                                  'message', 'Le partenaire est déjà dans ce statut.');
    END IF;
    IF v_status IN ('REJETE', 'SUSPENDU') AND (v_reason IS NULL OR char_length(v_reason) < 3) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED',
                                  'message', 'Indiquez le motif (3 caractères au moins).');
    END IF;
    IF v_reason IS NOT NULL AND char_length(v_reason) > 1000 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Le motif est limité à 1 000 caractères.');
    END IF;

    -- Compte du partenaire (jamais un compte supprimé) : SUSPENDU à la suspension, ACTIF sinon.
    UPDATE public.users
       SET status = (CASE WHEN v_status = 'SUSPENDU' THEN 'SUSPENDU' ELSE 'ACTIF' END)::public.user_status,
           updated_at = now()
     WHERE id = pa.user_id AND status::text <> 'SUPPRIME';

    UPDATE public.partners
       SET status = v_status::public.partner_status,
           is_verified = (v_status = 'VALIDE'),
           rejection_reason = CASE WHEN v_status = 'REJETE' THEN v_reason ELSE rejection_reason END,
           suspended_reason = CASE
               WHEN v_status = 'SUSPENDU' THEN v_reason
               WHEN v_status = 'VALIDE' AND pa.status::text = 'SUSPENDU' THEN NULL
               ELSE suspended_reason END,
           updated_at = now()
     WHERE id = pa.id
     RETURNING status::text AS status, is_verified, rejection_reason, suspended_reason INTO v_row;

    IF v_status = 'SUSPENDU' THEN
        v_revoked := public.revoke_user_sessions(pa.user_id);
    END IF;

    RETURN jsonb_build_object(
        'ok', true, 'partner_id', pa.id, 'user_id', pa.user_id, 'old_status', pa.status::text,
        'status', v_row.status, 'is_verified', v_row.is_verified,
        'rejection_reason', v_row.rejection_reason, 'suspended_reason', v_row.suspended_reason,
        'sessions_revoked', v_revoked
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- J2.7 — trg_partners_subscription : nouvelle formule d'abonnement (l'INSERT de
-- lib/payments/confirmation.service.ts disparaît, agent Billetterie).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_partners_subscription()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan_name text;
    v_period    text;
    v_days      integer;
BEGIN
    IF NEW.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id) THEN
        RETURN NEW;
    END IF;
    SELECT sp.name, sp.billing_period INTO v_plan_name, v_period FROM public.subscription_plans sp WHERE sp.id = NEW.subscription_plan_id;
    v_days := CASE
        WHEN NEW.trial_ends_at IS NOT NULL AND NEW.trial_ends_at > now()
            THEN ceil(extract(epoch FROM (NEW.trial_ends_at - now())) / 86400)::integer
        WHEN upper(COALESCE(v_period, '')) IN ('YEARLY', 'ANNUAL', 'ANNUEL') THEN 365
        ELSE 30
    END;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'SUBSCRIPTION_ACTIVATED',
        'key', 'SUBSCRIPTION_ACTIVATED:' || NEW.id::text || ':' || NEW.subscription_plan_id::text || ':'
               || COALESCE(floor(extract(epoch FROM NEW.trial_ends_at))::bigint::text, 'sans-echeance'),
        'user_id', NEW.user_id,
        'data', jsonb_build_object('partner_id', NEW.id, 'plan_id', NEW.subscription_plan_id,
                                   'plan', COALESCE(v_plan_name, 'Event Village'), 'days', v_days)
    ));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partners_subscription ON public.partners;
CREATE TRIGGER trg_partners_subscription
    AFTER UPDATE OF subscription_plan_id ON public.partners
    FOR EACH ROW
    WHEN (NEW.subscription_plan_id IS DISTINCT FROM OLD.subscription_plan_id AND NEW.subscription_plan_id IS NOT NULL)
    EXECUTE FUNCTION public.notif_partners_subscription();


-- ----------------------------------------------------------------------------
-- J2.8 — activate_partner_trial (recopie intégrale de 0008_partner_auth_production.sql:27-108).
-- Changements : TRIAL_STARTED mis en file à la première activation ; l'affectation partners.status =
-- 'ACTIF' est retirée (valeur absente de l'énumération partner_status : toute première activation
-- échouait en 22P02, d'où le repli JavaScript de la route, supprimé) ; le compte n'est remis ACTIF que
-- s'il était EN_ATTENTE (jamais un compte suspendu ou supprimé) ; la réponse donne le statut réel de la
-- fiche ; SECURITY DEFINER, search_path et volatilité explicites.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_partner_trial(p_partner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner RECORD;
    v_trial_days INT := 60;
    v_started_at TIMESTAMPTZ;
    v_ends_at TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_partner FROM public.partners WHERE id = p_partner_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Partenaire introuvable');
    END IF;

    -- Si la période d'essai a déjà été démarrée, on ne la recalcule PAS (IDEMPOTENCE STRICTE)
    IF v_partner.trial_started_at IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'is_new_activation', false,
            'trial_started_at', v_partner.trial_started_at,
            'trial_ends_at', v_partner.trial_ends_at,
            'status', v_partner.status
        );
    END IF;

    -- Durée : 90 jours si Founder, sinon 60 jours Standard
    IF v_partner.is_founder = TRUE THEN
        v_trial_days := 90;
    ELSE
        v_trial_days := 60;
    END IF;

    v_started_at := now();
    v_ends_at := now() + (v_trial_days || ' days')::INTERVAL;

    -- Mise à jour du partenaire et synchronisation de son compte utilisateur
    UPDATE public.partners
    SET
        trial_started_at = v_started_at,
        trial_ends_at = v_ends_at,
        updated_at = now()
    WHERE id = p_partner_id;

    UPDATE public.users
    SET
        status = 'ACTIF',
        updated_at = now()
    WHERE id = v_partner.user_id AND status::text = 'EN_ATTENTE';

    -- Journal d'audit de la première activation
    INSERT INTO public.audit_logs (
        user_id,
        user_role,
        action,
        object_type,
        object_id,
        new_value,
        metadata
    ) VALUES (
        v_partner.user_id,
        'PARTENAIRE',
        'FIRST_ACTIVATION',
        'partners',
        p_partner_id,
        jsonb_build_object('trial_days', v_trial_days, 'trial_ends_at', v_ends_at),
        jsonb_build_object('is_founder', v_partner.is_founder)
    );

    -- Lot 6 (J2.8) : avis de début d'essai (in-app, SMS), une fois par partenaire.
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'TRIAL_STARTED',
        'key', 'TRIAL_STARTED:' || p_partner_id::text,
        'user_id', v_partner.user_id,
        'data', jsonb_build_object('partner_id', p_partner_id, 'days', v_trial_days)
    ));

    RETURN jsonb_build_object(
        'success', true,
        'is_new_activation', true,
        'trial_days', v_trial_days,
        'trial_started_at', v_started_at,
        'trial_ends_at', v_ends_at,
        'status', v_partner.status
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- J2.9 — mot de passe défini ou modifié (réinitialisation par le navigateur, profil du contrôleur,
-- activation d'un contrôleur) : trigger sur auth.users. Clé : compte et instant de la modification.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_on_password_changed()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.id) THEN
        RETURN NEW;
    END IF;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'PASSWORD_CHANGED',
        'key', 'PASSWORD_CHANGED:' || NEW.id::text || ':'
               || COALESCE(floor(extract(epoch FROM NEW.updated_at) * 1000000)::bigint::text, 'tx' || txid_current()::text),
        'user_id', NEW.id,
        'data', '{}'::jsonb
    ));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_password_changed ON auth.users;
CREATE TRIGGER on_auth_user_password_changed
    AFTER UPDATE OF encrypted_password ON auth.users
    FOR EACH ROW
    WHEN (OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password)
    EXECUTE FUNCTION public.notif_on_password_changed();


-- ----------------------------------------------------------------------------
-- J2.10 — paiement confirmé hors billetterie (salle, table, abonnement…) : PAYMENT_SUCCESS au client
-- (l'INSERT de lib/payments/confirmation.service.ts disparaît, agent Billetterie).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_payments_other_success()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.client_id) THEN
        RETURN NEW;
    END IF;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'PAYMENT_SUCCESS',
        'key', 'PAYMENT_SUCCESS:' || NEW.id::text,
        'user_id', NEW.client_id,
        'data', jsonb_build_object('payment_id', NEW.id, 'amount', NEW.amount)
    ));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_other_success ON public.payments;
CREATE TRIGGER trg_payments_other_success
    AFTER UPDATE OF status ON public.payments
    FOR EACH ROW
    WHEN (NEW.status::text = 'SUCCESS' AND OLD.status::text IS DISTINCT FROM 'SUCCESS'
          AND NEW.payment_target::text <> 'TICKET' AND NEW.client_id IS NOT NULL)
    EXECUTE FUNCTION public.notif_payments_other_success();


-- ----------------------------------------------------------------------------
-- J2.11 — réservations de salle et mises en avant (les INSERT de lib/halls/hall.service.ts et de
-- app/api/admin/promotions/route.ts disparaissent).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_hall_reservations_notify()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner_user uuid;
    v_data         jsonb;
BEGIN
    SELECT pa.user_id INTO v_partner_user FROM public.partners pa WHERE pa.id = NEW.partner_id;
    v_data := jsonb_strip_nulls(jsonb_build_object(
        'reservation_id', NEW.id,
        'hall_name', (SELECT h.name FROM public.halls h WHERE h.id = NEW.hall_id),
        'start_date', NEW.start_date,
        'end_date', NEW.end_date));

    IF TG_OP = 'INSERT' THEN
        IF v_partner_user IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'HALL_RESERVATION_REQUESTED',
                'key', 'HALL_RESERVATION_REQUESTED:' || NEW.id::text,
                'user_id', v_partner_user,
                'data', v_data
            ));
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;
    IF NEW.status::text = 'CONFIRMEE' THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'HALL_RESERVATION_CONFIRMED',
            'key', 'HALL_RESERVATION_CONFIRMED:' || NEW.id::text,
            'user_id', NEW.client_id,
            'data', v_data
        ));
    ELSIF NEW.status::text = 'ANNULEE' THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'HALL_RESERVATION_CANCELLED',
            'key', 'HALL_RESERVATION_CANCELLED:' || NEW.id::text || ':' || NEW.client_id::text,
            'user_id', NEW.client_id,
            'data', v_data || jsonb_build_object('recipient_role', 'CLIENT')
        ));
        IF v_partner_user IS NOT NULL AND v_partner_user <> NEW.client_id THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'HALL_RESERVATION_CANCELLED',
                'key', 'HALL_RESERVATION_CANCELLED:' || NEW.id::text || ':' || v_partner_user::text,
                'user_id', v_partner_user,
                'data', v_data || jsonb_build_object('recipient_role', 'PARTNER')
            ));
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hall_reservations_notify ON public.hall_reservations;
CREATE TRIGGER trg_hall_reservations_notify
    AFTER INSERT OR UPDATE OF status ON public.hall_reservations
    FOR EACH ROW EXECUTE FUNCTION public.notif_hall_reservations_notify();

CREATE OR REPLACE FUNCTION public.notif_sponsored_promotions_notify()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner_user uuid;
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('APPROUVEE', 'REFUSEE') THEN
        RETURN NEW;
    END IF;
    SELECT pa.user_id INTO v_partner_user FROM public.partners pa WHERE pa.id = NEW.partner_id;
    IF v_partner_user IS NULL THEN
        RETURN NEW;
    END IF;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'PROMOTION_DECIDED',
        'key', 'PROMOTION_DECIDED:' || NEW.id::text || ':' || NEW.status,
        'user_id', v_partner_user,
        'event_id', NEW.event_id,
        'data', public.notif_pros_event_data(NEW.event_id) || jsonb_strip_nulls(jsonb_build_object(
            'promotion_id', NEW.id, 'status', NEW.status,
            'reason', CASE WHEN NEW.status = 'REFUSEE' THEN NULLIF(btrim(COALESCE(NEW.admin_notes, '')), '') END))
    ));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sponsored_promotions_notify ON public.sponsored_promotions;
CREATE TRIGGER trg_sponsored_promotions_notify
    AFTER UPDATE OF status ON public.sponsored_promotions
    FOR EACH ROW EXECUTE FUNCTION public.notif_sponsored_promotions_notify();


-- ----------------------------------------------------------------------------
-- J2.12 — notification_controller_activated(p) : { user_id } → CONTROLLER_ACTIVATED (in-app, SMS), une
-- fois par compte. Appelée par app/api/controller/setup/route.ts après la consommation du code et la pose
-- du mot de passe (GoTrue, hors transaction : exception documentée).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notification_controller_activated(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := public.try_uuid(p->>'user_id');
    v_n    integer;
BEGIN
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Compte absent.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND', 'message', 'Compte introuvable.');
    END IF;
    v_n := public.notif_enqueue(jsonb_build_object(
        'type', 'CONTROLLER_ACTIVATED',
        'key', 'CONTROLLER_ACTIVATED:' || v_user::text,
        'user_id', v_user,
        'data', '{}'::jsonb
    ));
    RETURN jsonb_build_object('ok', true, 'created', v_n);
END;
$$;


-- ----------------------------------------------------------------------------
-- Privilèges (règle 1A.3) : toute fonction de cette migration, triggers compris, au seul service_role.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.notif_pros_event_data(uuid)',
        'public.notif_upsert_aggregated_sms(jsonb)',
        'public.shift_close(jsonb)',
        'public.notif_cashouts_notify()',
        'public.fin_alert_superadmins(text, text, text, text, uuid, jsonb)',
        'public.notif_event_controllers_notify()',
        'public.notif_partners_notify()',
        'public.partner_status_set(jsonb)',
        'public.notif_partners_subscription()',
        'public.activate_partner_trial(uuid)',
        'public.notif_on_password_changed()',
        'public.notif_payments_other_success()',
        'public.notif_hall_reservations_notify()',
        'public.notif_sponsored_promotions_notify()',
        'public.notification_controller_activated(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.partner_status_set(jsonb) IS
    'Lot 6 (J2.6) : validation, refus, suspension ou réactivation d''un partenaire ; partners.status et users.status dans la même transaction, sessions révoquées à la suspension, avis par trg_partners_notify. Service_role uniquement.';
COMMENT ON FUNCTION public.notif_upsert_aggregated_sms(jsonb) IS
    'Lot 6 (J2.4) : SMS regroupé par compte et par transaction (clé à txid) ; les événements s''ajoutent à template_data.events tant que la ligne est PENDING. Interne, service_role uniquement.';
COMMENT ON FUNCTION public.notification_controller_activated(jsonb) IS
    'Lot 6 (J2.12) : avis CONTROLLER_ACTIVATED (in-app, SMS), une fois par compte. Service_role uniquement.';
