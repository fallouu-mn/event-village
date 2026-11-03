-- ============================================================================
-- Lot 6, tâche 6.8 — supervision admin des notifications (contrat L2)
-- ============================================================================
-- RPC lues par les routes /api/admin/notifications/** (verifyAdminAuth + requireActiveSession) :
--   - admin_notifications_list(p)  : liste filtrée et paginée, destinataire masqué, compteurs par statut ;
--   - admin_notification_detail(p) : une ligne sans claim_token ; journal OTP réduit à { purpose } ;
--   - admin_notifications_stats(p) : par jour et par canal, SMS du mois et du jour, seuil d'alerte ;
--   - notification_retry(p)        : relance d'une ligne FAILED de la boîte d'envoi, permission
--                                    notifications.write vérifiée aussi ici (défense en profondeur), audit.
-- La boîte d'envoi n'est jamais lue par un client : service_role seul (privilèges ci-dessous).
-- Jours et mois : ceux de Dakar (Africa/Dakar). Aucune donnée de code ni de lien d'un journal OTP n'est
-- renvoyée (la contrainte notification_outbox_no_secret_chk l'interdit déjà ; le détail réduit en plus
-- template_data à { purpose } pour origin = 'SYNC_LOG').
-- ============================================================================

-- ----------------------------------------------------------------------------
-- admin_notifications_list(p)
-- p = { status?, channel?, type?, from? (AAAA-MM-JJ), to? (AAAA-MM-JJ), q?, page (>= 1), page_size (1..50,
--       défaut 20) }. Statut, canal et type validés contre les listes fermées (registre pour le type) ;
--       période en jours de Dakar, bornes incluses, sur created_at ; q : identifiant (ligne, compte ou
--       événement), numéro exact (+221XXXXXXXXX ou 9 chiffres), ou texte cherché dans l'email du
--       destinataire et le titre de l'événement.
-- Réponse { ok, items, page, page_size, total, counts } ; tri created_at DESC, id DESC ; `counts` : nombre
-- de lignes par statut sous les autres filtres (onglets de statut).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_notifications_list(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status   text;
    v_channel  text;
    v_type     text;
    v_from     date;
    v_to       date;
    v_from_ts  timestamptz;
    v_to_ts    timestamptz;
    v_q        text;
    v_q_uuid   uuid;
    v_q_phone  text;
    v_q_like   text;
    v_page     integer;
    v_size     integer;
    v_total    bigint;
    v_counts   jsonb;
    v_items    jsonb;
    v_bad      jsonb := jsonb_build_object('ok', false, 'code', 'INVALID_FILTER',
                            'message', 'Filtre inconnu : choisissez un statut, un canal, un type ou une période de la liste.');
BEGIN
    IF p IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object' THEN
        RETURN v_bad;
    END IF;

    v_status := NULLIF(p->>'status', '');
    IF v_status IS NOT NULL AND v_status NOT IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED', 'CANCELLED', 'UNCERTAIN') THEN
        RETURN v_bad;
    END IF;
    v_channel := NULLIF(p->>'channel', '');
    IF v_channel IS NOT NULL AND v_channel NOT IN ('IN_APP', 'SMS', 'EMAIL', 'PUSH') THEN
        RETURN v_bad;
    END IF;
    v_type := NULLIF(p->>'type', '');
    IF v_type IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.notification_types t WHERE t.type = v_type) THEN
        RETURN v_bad;
    END IF;

    -- Période : AAAA-MM-JJ, date réelle (un 30 février est refusé, sans exception remontée).
    BEGIN
        IF NULLIF(p->>'from', '') IS NOT NULL THEN
            IF (p->>'from') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
                RETURN v_bad;
            END IF;
            v_from := (p->>'from')::date;
            IF to_char(v_from, 'YYYY-MM-DD') <> (p->>'from') THEN
                RETURN v_bad;
            END IF;
        END IF;
        IF NULLIF(p->>'to', '') IS NOT NULL THEN
            IF (p->>'to') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
                RETURN v_bad;
            END IF;
            v_to := (p->>'to')::date;
            IF to_char(v_to, 'YYYY-MM-DD') <> (p->>'to') THEN
                RETURN v_bad;
            END IF;
        END IF;
    EXCEPTION
        WHEN data_exception THEN
            RETURN v_bad;
    END;
    IF v_from IS NOT NULL AND v_to IS NOT NULL AND v_from > v_to THEN
        RETURN v_bad;
    END IF;
    v_from_ts := CASE WHEN v_from IS NOT NULL THEN v_from::timestamp AT TIME ZONE 'Africa/Dakar' END;
    v_to_ts   := CASE WHEN v_to IS NOT NULL THEN (v_to + 1)::timestamp AT TIME ZONE 'Africa/Dakar' END;

    v_q := NULLIF(btrim(COALESCE(p->>'q', '')), '');
    IF v_q IS NOT NULL THEN
        IF char_length(v_q) > 100 THEN
            RETURN v_bad;
        END IF;
        IF v_q ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            v_q_uuid := v_q::uuid;
        ELSIF regexp_replace(v_q, '[\s.-]', '', 'g') ~ '^(\+221)?[0-9]{9}$' THEN
            v_q_phone := '+221' || right(regexp_replace(v_q, '[\s.-]', '', 'g'), 9);
        ELSE
            v_q_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
        END IF;
    END IF;

    IF COALESCE(p->>'page', '1') !~ '^[1-9][0-9]{0,5}$' THEN
        RETURN v_bad;
    END IF;
    v_page := COALESCE(p->>'page', '1')::integer;
    IF COALESCE(p->>'page_size', '20') !~ '^[1-9][0-9]?$' THEN
        RETURN v_bad;
    END IF;
    v_size := COALESCE(p->>'page_size', '20')::integer;
    IF v_size > 50 THEN
        RETURN v_bad;
    END IF;

    WITH base AS (
        SELECT o.id, o.created_at, o.type, o.channel, o.status, o.reason, o.attempts, o.sent_at, o.origin,
               o.recipient_user_id, o.recipient_phone, o.recipient_email,
               e.title AS event_title, u.first_name, u.last_name
          FROM public.notification_outbox o
          LEFT JOIN public.events e ON e.id = o.event_id
          LEFT JOIN public.users u ON u.id = o.recipient_user_id
         WHERE (v_channel IS NULL OR o.channel = v_channel)
           AND (v_type IS NULL OR o.type = v_type)
           AND (v_from_ts IS NULL OR o.created_at >= v_from_ts)
           AND (v_to_ts IS NULL OR o.created_at < v_to_ts)
           AND (v_q IS NULL
                OR (v_q_uuid IS NOT NULL AND (o.id = v_q_uuid OR o.recipient_user_id = v_q_uuid OR o.event_id = v_q_uuid))
                OR (v_q_phone IS NOT NULL AND (o.recipient_phone = v_q_phone OR u.phone = v_q_phone))
                OR (v_q_like IS NOT NULL AND (o.recipient_email ILIKE v_q_like ESCAPE '\' OR e.title ILIKE v_q_like ESCAPE '\')))
    ),
    filtered AS (
        SELECT * FROM base WHERE v_status IS NULL OR base.status = v_status
    ),
    page_rows AS (
        SELECT * FROM filtered
         ORDER BY filtered.created_at DESC, filtered.id DESC
         LIMIT v_size OFFSET (v_page - 1)::bigint * v_size
    ),
    by_status AS (
        SELECT base.status, count(*) AS n FROM base GROUP BY base.status
    )
    SELECT
        (SELECT count(*) FROM filtered),
        (SELECT jsonb_build_object(
                    'PENDING',   COALESCE(max(n) FILTER (WHERE status = 'PENDING'), 0),
                    'SENDING',   COALESCE(max(n) FILTER (WHERE status = 'SENDING'), 0),
                    'SENT',      COALESCE(max(n) FILTER (WHERE status = 'SENT'), 0),
                    'FAILED',    COALESCE(max(n) FILTER (WHERE status = 'FAILED'), 0),
                    'SKIPPED',   COALESCE(max(n) FILTER (WHERE status = 'SKIPPED'), 0),
                    'CANCELLED', COALESCE(max(n) FILTER (WHERE status = 'CANCELLED'), 0),
                    'UNCERTAIN', COALESCE(max(n) FILTER (WHERE status = 'UNCERTAIN'), 0))
           FROM by_status),
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', r.id,
                    'created_at', r.created_at,
                    'type', r.type,
                    'channel', r.channel,
                    'status', r.status,
                    'reason', r.reason,
                    'attempts', r.attempts,
                    'origin', r.origin,
                    -- Destinataire masqué : numéro (SMS) « +221 77 *** ** 45 », email « aw***@domaine », sinon le
                    -- nom du compte (prénom et initiale) ; jamais d'endpoint push ni de coordonnée complète.
                    'recipient_masked', CASE
                        WHEN r.recipient_phone IS NOT NULL AND (r.channel = 'SMS' OR r.recipient_user_id IS NULL) THEN
                            '+221 ' || substr(r.recipient_phone, 5, 2) || ' *** ** ' || right(r.recipient_phone, 2)
                        WHEN r.recipient_email IS NOT NULL AND (r.channel = 'EMAIL' OR r.recipient_user_id IS NULL) THEN
                            left(substring(r.recipient_email FROM '^(.*)@[^@]*$'),
                                 CASE WHEN char_length(substring(r.recipient_email FROM '^(.*)@[^@]*$')) > 2 THEN 2 ELSE 1 END)
                            || '***@' || substring(r.recipient_email FROM '@([^@]*)$')
                        WHEN r.recipient_user_id IS NOT NULL THEN
                            COALESCE(public.pilotage_display_name(r.first_name, left(NULLIF(btrim(r.last_name), ''), 1) || '.'),
                                     'Compte sans nom')
                        ELSE 'Destinataire inconnu'
                    END,
                    'event_title', r.event_title,
                    'sent_at', r.sent_at,
                    'can_retry', (r.status = 'FAILED' AND r.origin = 'OUTBOX')
                ) ORDER BY r.created_at DESC, r.id DESC), '[]'::jsonb)
           FROM page_rows r)
      INTO v_total, v_counts, v_items;

    RETURN jsonb_build_object(
        'ok', true,
        'items', v_items,
        'page', v_page,
        'page_size', v_size,
        'total', v_total,
        'counts', v_counts
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- admin_notification_detail(p)
-- p = { id } → { ok, item } : toutes les colonnes de la ligne sauf claim_token, plus le destinataire
-- (compte, nom, numéro et email réels), le titre et le statut de l'événement, can_retry. Journal
-- synchrone (origin = 'SYNC_LOG' : OTP, invitation) : template_data réduit à { purpose }, quel que soit
-- son contenu. Ligne absente → NOT_FOUND.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_notification_detail(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id     uuid;
    o        public.notification_outbox%ROWTYPE;
    v_first  text;
    v_last   text;
    v_uphone text;
    v_umail  text;
    v_etitle text;
    v_estat  text;
    v_data   jsonb;
    v_mail   text;
BEGIN
    IF p IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object'
       OR COALESCE(p->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Notification introuvable.');
    END IF;
    v_id := (p->>'id')::uuid;

    SELECT * INTO o FROM public.notification_outbox WHERE id = v_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Notification introuvable.');
    END IF;

    IF o.recipient_user_id IS NOT NULL THEN
        SELECT u.first_name, u.last_name, u.phone, u.email INTO v_first, v_last, v_uphone, v_umail
          FROM public.users u WHERE u.id = o.recipient_user_id;
    END IF;
    IF o.event_id IS NOT NULL THEN
        SELECT e.title, e.status::text INTO v_etitle, v_estat FROM public.events e WHERE e.id = o.event_id;
    END IF;

    IF o.origin = 'SYNC_LOG' THEN
        v_data := CASE WHEN jsonb_typeof(o.template_data -> 'purpose') = 'string'
                       THEN jsonb_build_object('purpose', o.template_data -> 'purpose')
                       ELSE '{}'::jsonb END;
    ELSE
        v_data := o.template_data;
    END IF;

    -- Email réel seulement (les adresses techniques <chiffres>@eventvillage.sn ne sont jamais montrées).
    v_mail := COALESCE(o.recipient_email,
                       CASE WHEN v_umail IS NOT NULL AND v_umail !~* '^[0-9]+@eventvillage\.sn$' THEN v_umail END);

    RETURN jsonb_build_object(
        'ok', true,
        'item', (to_jsonb(o) - 'claim_token' - 'template_data') || jsonb_build_object(
            'template_data', v_data,
            'recipient', jsonb_build_object(
                'user_id', o.recipient_user_id,
                'display_name', CASE WHEN o.recipient_user_id IS NOT NULL
                                     THEN COALESCE(public.pilotage_display_name(v_first, v_last), 'Compte sans nom') END,
                'phone', COALESCE(o.recipient_phone, v_uphone),
                'email', v_mail
            ),
            'event_title', v_etitle,
            'event_status', v_estat,
            'can_retry', (o.status = 'FAILED' AND o.origin = 'OUTBOX')
        )
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- admin_notifications_stats(p)
-- p = { days (1..31, défaut 14), now? (jamais dans le passé) } →
-- { ok, by_day: [{ day, channel, sent, failed, skipped, uncertain, cancelled }], sms_month: { month, sent,
--   uncertain, otp }, sms_today, threshold }.
-- Jour d'une ligne terminée : COALESCE(sent_at, finished_at, created_at) à Dakar. SMS du jour et du mois :
-- SENT + UNCERTAIN (un envoi incertain est peut-être facturé), journaux OTP compris (même règle que
-- notification_daily_checks). otp = journaux OTP_* de ces SMS. threshold = notif.sms_daily_alert (NULL si
-- le réglage est absent ou illisible).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_notifications_stats(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now         timestamptz;
    v_days        integer;
    v_today       date;
    v_first_day   date;
    v_from_ts     timestamptz;
    v_to_ts       timestamptz;
    v_day_start   timestamptz;
    v_month       date;
    v_month_start timestamptz;
    v_month_end   timestamptz;
    v_by_day      jsonb;
    v_m_sent      bigint;
    v_m_unc       bigint;
    v_m_otp       bigint;
    v_today_n     bigint;
BEGIN
    IF p IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER', 'message', 'Période des statistiques invalide.');
    END IF;
    IF COALESCE(p->>'days', '14') !~ '^[1-9][0-9]?$' OR COALESCE(p->>'days', '14')::integer > 31 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FILTER',
            'message', 'Période des statistiques invalide : de 1 à 31 jours.');
    END IF;
    v_days := COALESCE(p->>'days', '14')::integer;

    v_now := public.notif_try_timestamptz(p->>'now');
    IF NULLIF(p->>'now', '') IS NOT NULL AND v_now IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_NOW', 'message', 'Horloge illisible.');
    END IF;
    v_now := COALESCE(v_now, now());
    IF v_now < now() - interval '1 minute' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_NOW',
            'message', 'Horloge refusée : une heure dans le passé n''est jamais acceptée.');
    END IF;

    v_today     := (v_now AT TIME ZONE 'Africa/Dakar')::date;
    v_first_day := v_today - (v_days - 1);
    v_from_ts   := v_first_day::timestamp AT TIME ZONE 'Africa/Dakar';
    v_to_ts     := (v_today + 1)::timestamp AT TIME ZONE 'Africa/Dakar';
    v_day_start := v_today::timestamp AT TIME ZONE 'Africa/Dakar';
    v_month     := date_trunc('month', v_today::timestamp)::date;
    v_month_start := v_month::timestamp AT TIME ZONE 'Africa/Dakar';
    v_month_end   := (v_month + interval '1 month')::timestamp AT TIME ZONE 'Africa/Dakar';

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'day', to_char(d.day, 'YYYY-MM-DD'),
               'channel', d.channel,
               'sent', d.sent, 'failed', d.failed, 'skipped', d.skipped, 'uncertain', d.uncertain, 'cancelled', d.cancelled
           ) ORDER BY d.day DESC, d.channel), '[]'::jsonb)
      INTO v_by_day
      FROM (
            SELECT (COALESCE(o.sent_at, o.finished_at, o.created_at) AT TIME ZONE 'Africa/Dakar')::date AS day,
                   o.channel,
                   count(*) FILTER (WHERE o.status = 'SENT')      AS sent,
                   count(*) FILTER (WHERE o.status = 'FAILED')    AS failed,
                   count(*) FILTER (WHERE o.status = 'SKIPPED')   AS skipped,
                   count(*) FILTER (WHERE o.status = 'UNCERTAIN') AS uncertain,
                   count(*) FILTER (WHERE o.status = 'CANCELLED') AS cancelled
              FROM public.notification_outbox o
             WHERE o.status IN ('SENT', 'FAILED', 'SKIPPED', 'UNCERTAIN', 'CANCELLED')
               AND COALESCE(o.sent_at, o.finished_at, o.created_at) >= v_from_ts
               AND COALESCE(o.sent_at, o.finished_at, o.created_at) <  v_to_ts
             GROUP BY 1, 2
           ) d;

    -- SMS du jour de Dakar (même règle que notification_daily_checks).
    SELECT count(*)
      INTO v_today_n
      FROM public.notification_outbox o
     WHERE o.channel = 'SMS'
       AND o.status IN ('SENT', 'UNCERTAIN')
       AND COALESCE(o.sent_at, o.finished_at) >= v_day_start
       AND COALESCE(o.sent_at, o.finished_at) <  v_to_ts;

    -- SMS du mois de Dakar.
    SELECT count(*) FILTER (WHERE o.status = 'SENT'),
           count(*) FILTER (WHERE o.status = 'UNCERTAIN'),
           count(*) FILTER (WHERE o.origin = 'SYNC_LOG' AND o.type LIKE 'OTP\_%')
      INTO v_m_sent, v_m_unc, v_m_otp
      FROM public.notification_outbox o
     WHERE o.channel = 'SMS'
       AND o.status IN ('SENT', 'UNCERTAIN')
       AND COALESCE(o.sent_at, o.finished_at) >= v_month_start
       AND COALESCE(o.sent_at, o.finished_at) <  v_month_end;

    RETURN jsonb_build_object(
        'ok', true,
        'days', v_days,
        'by_day', v_by_day,
        'sms_month', jsonb_build_object('month', to_char(v_month, 'YYYY-MM'), 'sent', v_m_sent, 'uncertain', v_m_unc, 'otp', v_m_otp),
        'sms_today', v_today_n,
        'threshold', public.notif_setting_int('notif.sms_daily_alert')
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- notification_retry(p)
-- p = { id, actor_id } : acteur ACTIF, SUPERADMIN ou ADMIN avec notifications.write (mêmes règles que
-- notif_admin_recipients, user_roles et admin_permissions ; users.role n'est pas lu), sinon FORBIDDEN ;
-- ligne absente NOT_FOUND ; statut autre que FAILED, ou journal synchrone (un code à usage unique ne se
-- renvoie jamais), NOT_RETRYABLE ; sinon la ligne repart : PENDING, attempts = 0, next_attempt_at = now(),
-- motif effacé, manual_retries + 1, journal audit_logs NOTIFICATION_RETRY. La garde des statuts
-- (trg_notification_outbox_guard) n'admet FAILED → PENDING que sous la GUC de transaction
-- notif.manual_retry = on, posée ici le temps de la seule mise à jour.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notification_retry(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id    uuid;
    v_actor uuid;
    v_role  text;
    o       public.notification_outbox%ROWTYPE;
    v_not_retryable text := 'Seule une notification en échec peut être relancée.';
BEGIN
    IF p IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object'
       OR COALESCE(p->>'actor_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN',
            'message', 'Relance réservée aux administrateurs qui ont la permission notifications.write.');
    END IF;
    v_actor := (p->>'actor_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.notif_admin_recipients('notifications.write') AS r(uid) WHERE r.uid = v_actor) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN',
            'message', 'Relance réservée aux administrateurs qui ont la permission notifications.write.');
    END IF;

    IF COALESCE(p->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Notification introuvable.');
    END IF;
    v_id := (p->>'id')::uuid;

    SELECT * INTO o FROM public.notification_outbox WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Notification introuvable.');
    END IF;
    IF o.status <> 'FAILED' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_RETRYABLE', 'message', v_not_retryable);
    END IF;
    IF o.origin <> 'OUTBOX' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_RETRYABLE',
            'message', 'Un code à usage unique ne se renvoie pas : la personne doit en demander un nouveau.');
    END IF;

    PERFORM set_config('notif.manual_retry', 'on', true);
    BEGIN
        UPDATE public.notification_outbox
           SET status          = 'PENDING',
               attempts        = 0,
               next_attempt_at = now(),
               reason          = NULL,
               reason_detail   = NULL,
               claimed_at      = NULL,
               claim_token     = NULL,
               finished_at     = NULL,
               manual_retries  = manual_retries + 1
         WHERE id = v_id;
    EXCEPTION
        WHEN unique_violation THEN
            -- Index uq_outbox_event_change_pending_sms : un SMS de changement plus récent attend déjà
            -- pour ce porteur et cet événement ; il porte l'information à jour.
            PERFORM set_config('notif.manual_retry', 'off', true);
            RETURN jsonb_build_object('ok', false, 'code', 'NOT_RETRYABLE',
                'message', 'Un message plus récent sur ce changement est déjà en attente : cette notification ne repart pas.');
    END;
    PERFORM set_config('notif.manual_retry', 'off', true);

    SELECT CASE WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN')
                THEN 'SUPERADMIN' ELSE 'ADMIN' END
      INTO v_role;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, v_role, 'NOTIFICATION_RETRY', 'notification_outbox', v_id,
            jsonb_build_object('status', o.status, 'reason', o.reason, 'attempts', o.attempts),
            jsonb_build_object('status', 'PENDING', 'attempts', 0),
            jsonb_build_object('type', o.type, 'channel', o.channel, 'manual_retries', o.manual_retries + 1));

    RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- Privilèges (règle 1A.3) : service_role seul
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_sig text;
BEGIN
    FOREACH v_sig IN ARRAY ARRAY[
        'public.admin_notifications_list(jsonb)',
        'public.admin_notification_detail(jsonb)',
        'public.admin_notifications_stats(jsonb)',
        'public.notification_retry(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
    END LOOP;
END;
$$;
