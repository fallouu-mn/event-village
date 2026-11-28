-- ============================================================================
-- EVENT VILLAGE — LOT « AVIS », PHASE 2, SOUS-LOTS 2f, 2g et D8 : parrainage, paiement non abouti, avis avant l'anonymisation
-- ============================================================================
-- Décisions du 27/11 :
--  D2 parrainage (écart A3) : filleul inscrit et commissions gagnées en cloche et notification (gains regroupés une fois
--     par jour), commissions disponibles en SMS, notification, cloche et email ;
--  D1 paiement non abouti (écart A4) : SMS, notification et cloche, une seule fois par panier, jamais si un autre paiement
--     du même panier a réussi ;
--  D8 avant l'anonymisation d'un compte par l'équipe : SMS et email juste avant (envoyés par AdminService.anonymizeUser,
--     lignes mises en file puis envoyées tout de suite, avant l'effacement du numéro et de l'adresse).
--
--  1. registre : REFERRAL_SIGNUP, REFERRAL_EARNED (petites étapes, reportées la nuit), REFERRAL_AVAILABLE (étape importante,
--     reportée la nuit : part à 9 h), PAYMENT_NOT_COMPLETED (sans email, D1 ; reporté la nuit), ACCOUNT_ANONYMIZATION_NOTICE
--     (SMS et email, part tout de suite, la nuit aussi) ;
--  2. filleul inscrit : private.notif_referral_signup, déclencheur nouveau sur referral_relationships (jamais le nom ni le
--     numéro du filleul) ;
--  3. notification_daily_checks (recopie de 20261125000003_f4_ventes.sql:382-564) : entre 9 h et 12 h (heure de Dakar), une
--     fois par jour et par parrain : commissions gagnées la veille (nombre, montant, délai avant disponibilité) et commissions
--     devenues disponibles depuis la veille à 9 h ; commissions annulées jamais annoncées ; au plus 200 parrains par passage ;
--  4. paiement non abouti : private.payment_cart_key (panier : billets = compte, événement, catégories et quantités, comme
--     payment_duplicate_of ; commande, réservation : l'objet payé ; abonnement : compte, pack et jour) ;
--     private.notif_payment_not_completed, à l'échec ou à l'expiration d'un paiement de la plateforme : un avis par panier
--     (clé du panier), dû 10 minutes plus tard, jamais si un autre paiement du panier a réussi depuis ;
--     private.notif_payment_cart_paid : un paiement du panier réussit → l'avis encore en attente est annulé (SUPERSEDED).
-- Aucune fonction de paiement ni de commission recopiée (déclencheurs nouveaux). Droits : fonctions private fermées à tous
-- les rôles de l'API ; notification_daily_checks inchangée (CREATE OR REPLACE). Sans BEGIN ni COMMIT, rejouable.
-- ============================================================================

-- 1. Registre
INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission, night_policy) VALUES
    ('REFERRAL_SIGNUP',              'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH'],               'CLIENT', 'BLOCK', FALSE, NULL, 'DEFER'),
    ('REFERRAL_EARNED',              'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH'],               'CLIENT', 'BLOCK', FALSE, NULL, 'DEFER'),
    ('REFERRAL_AVAILABLE',           'ESSENTIAL', NULL, ARRAY['IN_APP','SMS','EMAIL','PUSH'], 'CLIENT', 'BLOCK', FALSE, NULL, 'DEFER'),
    ('PAYMENT_NOT_COMPLETED',        'ESSENTIAL', NULL, ARRAY['IN_APP','SMS','PUSH'],         'ANY',    'BLOCK', FALSE, NULL, 'DEFER'),
    ('ACCOUNT_ANONYMIZATION_NOTICE', 'ESSENTIAL', NULL, ARRAY['SMS','EMAIL'],                 'ANY',    'ALLOW', FALSE, NULL, 'SEND')
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission,
    night_policy = EXCLUDED.night_policy;

-- 2. Filleul inscrit (cloche et notification au parrain)
CREATE OR REPLACE FUNCTION private.notif_referral_signup()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.sponsor_id IS NULL OR NEW.sponsor_id = NEW.referred_id THEN
        RETURN NULL;
    END IF;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'REFERRAL_SIGNUP', 'key', 'REFERRAL_SIGNUP:' || NEW.id::text,
        'user_id', NEW.sponsor_id, 'data', '{}'::jsonb));
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.notif_referral_signup() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_referral_signup_notify ON public.referral_relationships;
CREATE TRIGGER trg_referral_signup_notify
    AFTER INSERT ON public.referral_relationships
    FOR EACH ROW EXECUTE FUNCTION private.notif_referral_signup();

-- 3. notification_daily_checks (recopie de 20261125000003_f4_ventes.sql:382-564)
CREATE OR REPLACE FUNCTION public.notification_daily_checks(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now       timestamptz;
    v_day       date;
    v_day_txt   text;
    v_start     timestamptz;
    v_count     integer;
    v_cap       integer;
    v_used      integer;
    v_threshold integer;
    v_prefix    text;
    v_first     uuid;
    v_n         integer;
    v_alerted   boolean := false;
    v_funds     integer := 0;
    v_essential integer;
    v_essential_threshold integer;
    v_essential_alerted boolean := false;
    f           record;
BEGIN
    v_now := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    IF v_now < now() - interval '1 minute' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_NOW',
            'message', 'Horloge refusée : une heure dans le passé n''est jamais acceptée.');
    END IF;
    v_day := (v_now AT TIME ZONE 'Africa/Dakar')::date;
    v_day_txt := to_char(v_day, 'YYYY-MM-DD');
    v_start := v_day::timestamp AT TIME ZONE 'Africa/Dakar';

    SELECT count(*)::integer INTO v_count
      FROM public.notification_outbox o
     WHERE o.channel = 'SMS' AND o.status IN ('SENT', 'UNCERTAIN')
       AND COALESCE(o.sent_at, o.finished_at) >= v_start
       AND COALESCE(o.sent_at, o.finished_at) < v_start + interval '1 day';

    v_cap := public.notif_setting_int('notif.sms_optional_daily_cap');
    v_used := public.notif_sms_optional_used(v_day);
    IF v_cap IS NOT NULL AND v_cap > 0 THEN
        v_threshold := ceil((v_cap * 8)::numeric / 10)::integer;
    END IF;

    IF v_threshold IS NOT NULL AND v_used >= v_threshold THEN
        PERFORM pg_advisory_xact_lock(hashtext('notif.sms_optional_80:' || v_day_txt));
        v_prefix := 'ADMIN_SMS_OPTIONAL_80:' || v_day_txt || ':';
        IF NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                        WHERE o.type = 'ADMIN_SMS_OPTIONAL_80'
                          AND left(o.idempotency_key, length(v_prefix)) = v_prefix) THEN
            v_n := public.notif_enqueue_admins(jsonb_build_object(
                'type', 'ADMIN_SMS_OPTIONAL_80', 'ref', v_day_txt,
                'data', jsonb_build_object('day', v_day_txt, 'used', v_used, 'cap', v_cap, 'threshold', v_threshold,
                                           'percent', (100 * v_used::bigint / v_cap)::integer),
                'now', v_now));
            IF v_n > 0 THEN
                SELECT o.id INTO v_first
                  FROM public.notification_outbox o
                 WHERE o.type = 'ADMIN_SMS_OPTIONAL_80' AND left(o.idempotency_key, length(v_prefix)) = v_prefix
                 ORDER BY o.created_at, o.id LIMIT 1;
                INSERT INTO public.admin_signals (kind, ref_id) VALUES ('SMS_OPTIONAL_80', v_first) ON CONFLICT DO NOTHING;
                v_alerted := true;
            END IF;
        END IF;
    END IF;

    -- Lot 9 bis (R31, B81) : SMS indispensables du jour (file et journaux synchrones ; réservés, envoyés ou incertains),
    -- alerte ADMIN_SMS_DAILY_THRESHOLD aux admins notifications.read et signal SMS_DAILY_THRESHOLD au seuil réglable
    -- notif.sms_essential_daily_alert, une seule fois par jour (verrou et préfixe de clé du jour).
    SELECT count(*)::integer INTO v_essential
      FROM public.notification_outbox o
     WHERE o.channel = 'SMS' AND o.family = 'ESSENTIAL' AND o.status IN ('SENDING', 'SENT', 'UNCERTAIN')
       AND COALESCE(o.claimed_at, o.sent_at, o.finished_at) >= v_start
       AND COALESCE(o.claimed_at, o.sent_at, o.finished_at) < v_start + interval '1 day';
    v_essential_threshold := public.notif_setting_int('notif.sms_essential_daily_alert');
    IF v_essential_threshold IS NOT NULL AND v_essential_threshold > 0 AND v_essential >= v_essential_threshold THEN
        PERFORM pg_advisory_xact_lock(hashtext('notif.sms_essential_daily_alert:' || v_day_txt));
        v_prefix := 'ADMIN_SMS_DAILY_THRESHOLD:' || v_day_txt || ':';
        IF NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                        WHERE o.type = 'ADMIN_SMS_DAILY_THRESHOLD'
                          AND left(o.idempotency_key, length(v_prefix)) = v_prefix) THEN
            v_n := public.notif_enqueue_admins(jsonb_build_object(
                'type', 'ADMIN_SMS_DAILY_THRESHOLD', 'ref', v_day_txt,
                'data', jsonb_build_object('day', v_day_txt, 'count', v_essential, 'threshold', v_essential_threshold),
                'now', v_now));
            IF v_n > 0 THEN
                SELECT o.id INTO v_first
                  FROM public.notification_outbox o
                 WHERE o.type = 'ADMIN_SMS_DAILY_THRESHOLD' AND left(o.idempotency_key, length(v_prefix)) = v_prefix
                 ORDER BY o.created_at, o.id LIMIT 1;
                INSERT INTO public.admin_signals (kind, ref_id) VALUES ('SMS_DAILY_THRESHOLD', v_first) ON CONFLICT DO NOTHING;
                v_essential_alerted := true;
            END IF;
        END IF;
    END IF;

    -- Lot 9 bis (R72, B77) : recettes disponibles d'un événement terminé, une fois par événement
    FOR f IN
        SELECT e.id, pa.user_id AS owner_id
          FROM public.events e
          JOIN public.partners pa ON pa.id = e.partner_id
         WHERE e.status::text = 'TERMINE' AND pa.user_id IS NOT NULL
           AND public.event_end_at(e.id) > v_now - interval '30 days'
           AND EXISTS (SELECT 1 FROM public.finance_ledger l
                        WHERE l.event_id = e.id AND l.owner_id = pa.user_id AND l.account_kind = 'ORGANISATEUR'
                          AND l.entry_type = 'VENTE')
           AND NOT EXISTS (SELECT 1 FROM public.finance_ledger l
                            WHERE l.event_id = e.id AND l.owner_id = pa.user_id AND l.account_kind = 'ORGANISATEUR'
                              AND l.entry_type = 'VENTE' AND l.available_at > v_now)
           AND NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                            WHERE o.idempotency_key = 'FUNDS_AVAILABLE:' || e.id::text || ':IN_APP')
         ORDER BY e.id
         LIMIT 100
    LOOP
        v_funds := v_funds + public.notif_enqueue(jsonb_build_object(
            'type', 'FUNDS_AVAILABLE', 'key', 'FUNDS_AVAILABLE:' || f.id::text,
            'user_id', f.owner_id, 'event_id', f.id,
            'data', COALESCE(public.notif_event_data(f.id), '{}'::jsonb), 'now', v_now));
    END LOOP;

    -- Finition 4 (point 2) : résumé du matin à 9:00 (heure de Dakar), une fois par jour et par compte, ventes (en ligne et au
    -- guichet, billets payants), remboursements et entrées de la veille ; mis en file entre 9 h et 12 h (reprise après une
    -- panne de l'envoyeur), au plus 200 comptes par passage (le passage suivant continue : clé du jour).
    IF extract(hour FROM (v_now AT TIME ZONE 'Africa/Dakar')) >= 9 AND extract(hour FROM (v_now AT TIME ZONE 'Africa/Dakar')) < 12 THEN
        FOR f IN
            WITH yday AS (
                SELECT v_start - interval '1 day' AS a, v_start AS b, to_char(v_day - 1, 'YYYY-MM-DD') AS day_txt
            ), sold AS (
                SELECT pa.user_id AS owner_id, t.event_id, count(*)::integer AS n, COALESCE(sum(t.price), 0) AS amount
                  FROM public.tickets t JOIN public.events e ON e.id = t.event_id JOIN public.partners pa ON pa.id = e.partner_id, yday
                 WHERE t.created_at >= yday.a AND t.created_at < yday.b
                   AND t.sale_channel IN ('ONLINE', 'COUNTER') AND COALESCE(t.price, 0) > 0
                 GROUP BY pa.user_id, t.event_id
            ), refunded AS (
                SELECT pa.user_id AS owner_id, t.event_id, count(*)::integer AS n, COALESCE(sum(COALESCE(NULLIF(r.facial_part, 0), t.price)), 0) AS amount
                  FROM public.refunds r JOIN public.tickets t ON t.id = r.ticket_id
                  JOIN public.events e ON e.id = t.event_id JOIN public.partners pa ON pa.id = e.partner_id, yday
                 WHERE r.created_at >= yday.a AND r.created_at < yday.b AND COALESCE(t.price, 0) > 0
                 GROUP BY pa.user_id, t.event_id
            ), entered AS (
                SELECT pa.user_id AS owner_id, sc.event_id, count(*)::integer AS n, 0::numeric AS amount
                  FROM public.ticket_scans sc JOIN public.events e ON e.id = sc.event_id JOIN public.partners pa ON pa.id = e.partner_id, yday
                 WHERE sc.accepted AND sc.created_at >= yday.a AND sc.created_at < yday.b
                 GROUP BY pa.user_id, sc.event_id
            ), activity AS (
                SELECT owner_id, event_id, n AS sold_n, amount AS sold_amount, 0 AS refund_n, 0::numeric AS refund_amount, 0 AS entry_n FROM sold
                UNION ALL SELECT owner_id, event_id, 0, 0, n, amount, 0 FROM refunded
                UNION ALL SELECT owner_id, event_id, 0, 0, 0, 0, n FROM entered
            )
            SELECT a.owner_id, (SELECT day_txt FROM yday) AS day_txt,
                   sum(a.sold_n)::integer AS sold_count, sum(a.sold_amount) AS sold_amount,
                   sum(a.refund_n)::integer AS refund_count, sum(a.refund_amount) AS refund_amount,
                   sum(a.entry_n)::integer AS entry_count, count(DISTINCT a.event_id)::integer AS event_count,
                   (array_agg(DISTINCT a.event_id))[1] AS one_event
              FROM activity a
             WHERE a.owner_id IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                                WHERE o.group_key = 'PARTNER_DAILY_SUMMARY:' || a.owner_id::text || ':' || (SELECT day_txt FROM yday))
             GROUP BY a.owner_id
             ORDER BY a.owner_id
             LIMIT 200
        LOOP
            v_n := public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
                'type', 'PARTNER_DAILY_SUMMARY', 'key', 'PARTNER_DAILY_SUMMARY:' || f.owner_id::text || ':' || f.day_txt,
                'user_id', f.owner_id,
                'event_id', CASE WHEN f.event_count = 1 THEN f.one_event END,
                'data', (CASE WHEN f.event_count = 1 THEN COALESCE(public.notif_event_data(f.one_event), '{}'::jsonb) ELSE '{}'::jsonb END)
                        || jsonb_build_object('day', f.day_txt, 'sold_count', f.sold_count, 'sold_amount', f.sold_amount,
                                              'refund_count', f.refund_count, 'refund_amount', f.refund_amount,
                                              'entry_count', f.entry_count, 'event_count', f.event_count),
                'now', v_now)));
        END LOOP;
    END IF;

    -- Avis phase 2 (2f, décision D2) : parrainage, une fois par jour et par parrain entre 9 h et 12 h (heure de Dakar), au plus
    -- 200 parrains par passage (le passage suivant continue : clé du jour). Commissions annulées jamais annoncées.
    IF extract(hour FROM (v_now AT TIME ZONE 'Africa/Dakar')) >= 9 AND extract(hour FROM (v_now AT TIME ZONE 'Africa/Dakar')) < 12 THEN
        -- Commissions gagnées la veille : cloche et notification (nombre, montant, délai avant disponibilité)
        FOR f IN
            SELECT c.sponsor_id, count(*)::integer AS n, sum(c.amount) AS amount, to_char(v_day - 1, 'YYYY-MM-DD') AS day_txt
              FROM public.referral_commissions c
             WHERE c.kind = 'COMMISSION' AND c.status::text <> 'CANCELLED' AND c.amount > 0
               AND c.created_at >= v_start - interval '1 day' AND c.created_at < v_start
               AND NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                                WHERE o.group_key = 'REFERRAL_EARNED:' || c.sponsor_id::text || ':' || to_char(v_day - 1, 'YYYY-MM-DD'))
             GROUP BY c.sponsor_id
             ORDER BY c.sponsor_id
             LIMIT 200
        LOOP
            v_n := public.notif_enqueue(jsonb_build_object(
                'type', 'REFERRAL_EARNED', 'key', 'REFERRAL_EARNED:' || f.sponsor_id::text || ':' || f.day_txt,
                'user_id', f.sponsor_id, 'now', v_now,
                'data', jsonb_build_object('day', f.day_txt, 'count', f.n, 'amount', f.amount,
                                           'days', public.fin_setting_num('finance.referral_availability_days')::integer)));
        END LOOP;
        -- Commissions devenues disponibles depuis la veille à 9 h : quatre canaux, montant total
        FOR f IN
            SELECT c.sponsor_id, sum(c.amount) AS amount
              FROM public.referral_commissions c
             WHERE c.kind = 'COMMISSION' AND c.status::text <> 'CANCELLED' AND c.amount > 0 AND c.available_at IS NOT NULL
               AND c.available_at >= v_start + interval '9 hours' - interval '1 day' AND c.available_at < v_start + interval '9 hours'
               AND NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                                WHERE o.group_key = 'REFERRAL_AVAILABLE:' || c.sponsor_id::text || ':' || v_day_txt)
             GROUP BY c.sponsor_id
             ORDER BY c.sponsor_id
             LIMIT 200
        LOOP
            v_n := public.notif_enqueue(jsonb_build_object(
                'type', 'REFERRAL_AVAILABLE', 'key', 'REFERRAL_AVAILABLE:' || f.sponsor_id::text || ':' || v_day_txt,
                'user_id', f.sponsor_id, 'now', v_now,
                'data', jsonb_build_object('day', v_day_txt, 'amount', f.amount)));
        END LOOP;
    END IF;

    RETURN jsonb_build_object('ok', true, 'day', v_day_txt, 'sms_today', v_count,
        'optional_today', v_used, 'optional_cap', v_cap, 'optional_threshold', v_threshold, 'alerted', v_alerted,
        'essential_today', v_essential, 'essential_threshold', v_essential_threshold, 'essential_alerted', v_essential_alerted,
        'funds_available', v_funds);
END;
$$;

-- 4. Paiement non abouti
-- Clé du panier d'un paiement (NULL : pas un paiement de la plateforme d'un compte)
CREATE OR REPLACE FUNCTION private.payment_cart_key(p_payment uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE p.payment_target::text
               WHEN 'TICKET' THEN 'T:' || p.client_id::text || ':' || COALESCE(p.event_id::text, '-') || ':' || md5(COALESCE(
                   (SELECT string_agg(r.category_id::text || ':' || r.quantity, ',' ORDER BY r.category_id::text)
                      FROM public.stock_reservations r WHERE r.payment_id = p.id), p.id::text))
               WHEN 'ORDER' THEN 'O:' || COALESCE(p.order_id::text, p.id::text)
               WHEN 'HALL_RESERVATION' THEN 'H:' || COALESCE(p.hall_reservation_id::text, p.id::text)
               WHEN 'TABLE_RESERVATION' THEN 'R:' || COALESCE(p.table_reservation_id::text, p.id::text)
               WHEN 'SUBSCRIPTION' THEN 'S:' || p.client_id::text || ':' || COALESCE(p.subscription_plan_id::text, '-') || ':'
                                        || to_char(p.created_at AT TIME ZONE 'Africa/Dakar', 'YYYY-MM-DD')
               ELSE 'X:' || p.id::text
           END
      FROM public.payments p
     WHERE p.id = p_payment AND p.client_id IS NOT NULL AND p.is_platform_payment
$$;
REVOKE ALL ON FUNCTION private.payment_cart_key(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Échec ou expiration d'un paiement de la plateforme : un avis par panier, jamais si un autre paiement du panier a réussi
CREATE OR REPLACE FUNCTION private.notif_payment_not_completed()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cart   text := private.payment_cart_key(NEW.id);
    v_target text := NEW.payment_target::text;
    v_data   jsonb;
    v_number text;
BEGIN
    IF v_cart IS NULL OR v_target NOT IN ('TICKET', 'ORDER', 'HALL_RESERVATION', 'TABLE_RESERVATION', 'SUBSCRIPTION') THEN
        RETURN NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM public.payments y
                WHERE y.id <> NEW.id AND y.client_id = NEW.client_id AND y.status::text IN ('SUCCESS', 'PARTIAL')
                  AND COALESCE(y.paid_at, y.updated_at) >= NEW.created_at
                  AND private.payment_cart_key(y.id) = v_cart) THEN
        RETURN NULL;
    END IF;
    v_data := jsonb_build_object('payment_id', NEW.id, 'target', v_target, 'amount', NEW.amount);
    IF v_target = 'TICKET' AND NEW.event_id IS NOT NULL THEN
        v_data := v_data || COALESCE(public.notif_event_data(NEW.event_id), jsonb_build_object('event_id', NEW.event_id));
    ELSIF v_target = 'ORDER' AND NEW.order_id IS NOT NULL THEN
        SELECT o.order_number INTO v_number FROM public.orders o WHERE o.id = NEW.order_id;
        v_data := v_data || jsonb_strip_nulls(jsonb_build_object('order_id', NEW.order_id, 'order_number', v_number));
    ELSIF v_target = 'HALL_RESERVATION' AND NEW.hall_reservation_id IS NOT NULL THEN
        v_data := v_data || jsonb_build_object('reservation_id', NEW.hall_reservation_id);
    ELSIF v_target = 'TABLE_RESERVATION' AND NEW.table_reservation_id IS NOT NULL THEN
        v_data := v_data || jsonb_build_object('reservation_id', NEW.table_reservation_id);
    END IF;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'PAYMENT_NOT_COMPLETED', 'key', 'PAYMENT_NOT_COMPLETED:' || v_cart,
        'user_id', NEW.client_id, 'event_id', CASE WHEN v_target = 'TICKET' THEN NEW.event_id END,
        'data', v_data, 'due_at', now() + interval '10 minutes'));
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.notif_payment_not_completed() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_payments_not_completed_notify ON public.payments;
CREATE TRIGGER trg_payments_not_completed_notify
    AFTER UPDATE OF status ON public.payments
    FOR EACH ROW
    WHEN (NEW.status::text IN ('FAILED', 'EXPIRED') AND OLD.status::text NOT IN ('FAILED', 'EXPIRED', 'SUCCESS', 'PARTIAL', 'REFUNDED')
          AND NEW.is_platform_payment AND NEW.client_id IS NOT NULL AND NEW.amount > 0)
    EXECUTE FUNCTION private.notif_payment_not_completed();

-- Un paiement du panier réussit : l'avis « non abouti » encore en attente n'a plus lieu d'être
CREATE OR REPLACE FUNCTION private.notif_payment_cart_paid()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cart text := private.payment_cart_key(NEW.id);
BEGIN
    IF v_cart IS NOT NULL THEN
        UPDATE public.notification_outbox
           SET status = 'CANCELLED', reason = 'SUPERSEDED', finished_at = now()
         WHERE group_key = 'PAYMENT_NOT_COMPLETED:' || v_cart AND type = 'PAYMENT_NOT_COMPLETED' AND status = 'PENDING';
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.notif_payment_cart_paid() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_payments_cart_paid_notify ON public.payments;
CREATE TRIGGER trg_payments_cart_paid_notify
    AFTER UPDATE OF status ON public.payments
    FOR EACH ROW
    WHEN (NEW.status::text IN ('SUCCESS', 'PARTIAL') AND OLD.status::text NOT IN ('SUCCESS', 'PARTIAL')
          AND NEW.is_platform_payment AND NEW.client_id IS NOT NULL)
    EXECUTE FUNCTION private.notif_payment_cart_paid();
