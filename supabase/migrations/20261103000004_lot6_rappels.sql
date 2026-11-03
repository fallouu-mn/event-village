-- ============================================================================
-- EVENT VILLAGE — LOT 6 : rappels J-1, H-3 et rappel du contrôleur (tâche 6.5, contrat I2, I4)
-- ============================================================================
-- Idempotente : peut être rejouée sans effet de bord.
--  I2. RPC notification_reminders_schedule(p) : appelée toutes les 5 minutes par /api/cron/reminders
--      (lib/notifications/reminders.ts). Crée, à l'échéance seulement (fenêtre de 15 min, pas de
--      rattrapage), une ligne de boîte d'envoi par canal du registre et par compte :
--       - REMINDER_J1 la veille du début à notif.reminder_j1_hour (heure de Dakar) ;
--       - REMINDER_H3 au début moins notif.reminder_h3_hours ;
--       - CONTROLLER_REMINDER la veille du début à 18:00, une ligne par affectation.
--      Destinataires : porteurs d'au moins un billet VALIDE d'un événement PUBLIE (invitations comprises,
--      guichet sans porteur exclu, UTILISE exclu), billet émis ou reçu au plus tard à l'échéance. Clé
--      d'idempotence `<TYPE>:<event>:<user>:<début AAAAMMJJTHHMMZ>` : un second passage ne crée rien, et
--      un début modifié donne une nouvelle clé. Réglage notif.* absent ou invalide : exception (le cron
--      répond 500, visible) ; jamais de défaut caché.
--  I4. Annulation des rappels PENDING dans la transaction de leur cause :
--       - trg_notif_cancel_on_status (AFTER INSERT ON event_status_history) : SUSPENDU, ANNULE, TERMINE →
--         rappels CANCELLED EVENT_<statut> ; ANNULE et TERMINE → EVENT_CHANGED CANCELLED NO_LONGER_RELEVANT.
--         Couvre event_transition, event_cancel et events_finish_overdue (event_status_apply).
--       - trg_notif_cancel_on_reschedule (AFTER UPDATE OF start_date, start_time ON events) : rappels
--         CANCELLED EVENT_RESCHEDULED. Couvre event_update et toute écriture du service_role.
--       - trg_notif_cancel_on_holder_change (AFTER UPDATE OF user_id ON tickets) : l'ancien porteur qui n'a
--         plus de billet VALIDE de l'événement voit ses rappels J-1 et H-3 CANCELLED NO_LONGER_HOLDER.
--         Couvre ticket_transfer_claim, donc ticket_transfer_accept (B3), dans la même transaction.
--      Billet devenu UTILISE, annulé ou remboursé : revérification à l'envoi (notification_outbox_claim,
--      SKIPPED NO_VALID_TICKET). Réactivation : rien n'est recréé (la clé existe, pas de rattrapage).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- I2 — planification
-- ----------------------------------------------------------------------------
-- p = { now?, only_event_ids? } → { ok, now, created: { REMINDER_J1, REMINDER_H3, CONTROLLER_REMINDER },
-- events } ; `created` compte les lignes créées, `events` les événements dont une fenêtre était ouverte.
CREATE OR REPLACE FUNCTION public.notification_reminders_schedule(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tolerance  constant interval := interval '15 minutes';
    v_now        timestamptz;
    v_only       uuid[];
    v_key        text;
    v_j1_on      boolean;
    v_j1_hour    integer;
    v_h3_on      boolean;
    v_h3_hours   integer;
    v_j1_sms     text;
    v_h3_sms     text;
    e            record;
    h            record;
    c            record;
    v_start      timestamptz;
    v_start_key  text;
    v_due        timestamptz;
    v_base       jsonb;
    v_open       boolean;
    n_j1         integer := 0;
    n_h3         integer := 0;
    n_ctrl       integer := 0;
    n_events     integer := 0;
BEGIN
    -- Horloge : celle de l'appelant (tests, fumée) ou celle de la base ; jamais dans le passé.
    IF NULLIF(btrim(COALESCE(p->>'now', '')), '') IS NULL THEN
        v_now := now();
    ELSE
        v_now := public.notif_try_timestamptz(p->>'now');
        IF v_now IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_NOW', 'message', 'Horloge illisible.');
        END IF;
    END IF;
    IF v_now < now() - interval '1 minute' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_NOW',
            'message', 'Horloge refusée : une heure dans le passé n''est jamais acceptée.');
    END IF;
    IF jsonb_typeof(p->'only_event_ids') = 'array' THEN
        v_only := ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(p->'only_event_ids') AS x);
    END IF;

    -- Réglages : fin_setting lève si la clé manque (message qui nomme la clé) ; une valeur écrite hors
    -- bornes par le service_role lève aussi (jamais de défaut caché, décision 25).
    FOREACH v_key IN ARRAY ARRAY['notif.reminder_j1_enabled', 'notif.reminder_j1_hour', 'notif.reminder_h3_enabled',
                                 'notif.reminder_h3_hours', 'notif.j1_sms', 'notif.h3_sms'] LOOP
        IF NOT public.fin_setting_valid(v_key, public.fin_setting(v_key)) THEN
            RAISE EXCEPTION USING ERRCODE = 'NT010',
                MESSAGE = format('Réglage %s invalide : planification des rappels impossible.', v_key);
        END IF;
    END LOOP;
    v_j1_on    := public.fin_setting_bool('notif.reminder_j1_enabled');
    v_j1_hour  := public.fin_setting_num('notif.reminder_j1_hour')::integer;
    v_h3_on    := public.fin_setting_bool('notif.reminder_h3_enabled');
    v_h3_hours := public.fin_setting_num('notif.reminder_h3_hours')::integer;
    v_j1_sms   := public.fin_setting_text('notif.j1_sms');
    v_h3_sms   := public.fin_setting_text('notif.h3_sms');

    -- Événements candidats : PUBLIE, début futur, au plus le lendemain (heure de Dakar) : toute échéance
    -- (veille à l'heure réglée, veille à 18:00, début moins 12 h au plus) tombe au plus tard aujourd'hui.
    FOR e IN
        SELECT ev.id, ev.title, ev.location, ev.city, ev.start_date,
               ((ev.start_date + ev.start_time) AT TIME ZONE 'Africa/Dakar') AS start_at
          FROM public.events ev
         WHERE ev.status::text = 'PUBLIE'
           AND ev.start_date IS NOT NULL AND ev.start_time IS NOT NULL
           AND ev.start_date <= (v_now AT TIME ZONE 'Africa/Dakar')::date + 1
           AND ((ev.start_date + ev.start_time) AT TIME ZONE 'Africa/Dakar') > v_now
           AND (v_only IS NULL OR ev.id = ANY (v_only))
         ORDER BY ev.start_date, ev.id
    LOOP
        v_start := e.start_at;
        v_start_key := to_char(v_start AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MI"Z"');
        v_base := jsonb_build_object('event_id', e.id, 'title', e.title, 'start_at', v_start,
                                     'location', e.location, 'city', e.city);
        v_open := false;

        -- J-1 : la veille du début, à l'heure réglée.
        IF v_j1_on THEN
            v_due := ((e.start_date - 1) + make_time(v_j1_hour, 0, 0)) AT TIME ZONE 'Africa/Dakar';
            IF v_due <= v_now AND v_now < v_due + v_tolerance THEN
                v_open := true;
                FOR h IN
                    SELECT DISTINCT t.user_id
                      FROM public.tickets t
                     WHERE t.event_id = e.id AND t.status::text = 'VALIDE' AND t.user_id IS NOT NULL
                       AND t.created_at <= v_due
                       AND NOT EXISTS (SELECT 1 FROM public.ticket_transfers x
                                        WHERE x.ticket_id = t.id AND x.status::text = 'CLAIMED'
                                          AND x.to_user_id = t.user_id AND x.claimed_at > v_due)
                     ORDER BY t.user_id
                LOOP
                    n_j1 := n_j1 + public.notif_enqueue(jsonb_build_object(
                        'type', 'REMINDER_J1',
                        'key', 'REMINDER_J1:' || e.id || ':' || h.user_id || ':' || v_start_key,
                        'user_id', h.user_id,
                        'event_id', e.id,
                        'due_at', v_due,
                        'data', v_base || jsonb_build_object('sms_policy', v_j1_sms),
                        'skip', CASE WHEN v_j1_sms = 'NEVER' THEN jsonb_build_object('SMS', 'SMS_POLICY_NEVER') END,
                        'now', v_now));
                END LOOP;
            END IF;
        END IF;

        -- H-3 : au début moins le nombre d'heures réglé.
        IF v_h3_on THEN
            v_due := v_start - make_interval(hours => v_h3_hours);
            IF v_due <= v_now AND v_now < v_due + v_tolerance THEN
                v_open := true;
                FOR h IN
                    SELECT DISTINCT t.user_id
                      FROM public.tickets t
                     WHERE t.event_id = e.id AND t.status::text = 'VALIDE' AND t.user_id IS NOT NULL
                       AND t.created_at <= v_due
                       AND NOT EXISTS (SELECT 1 FROM public.ticket_transfers x
                                        WHERE x.ticket_id = t.id AND x.status::text = 'CLAIMED'
                                          AND x.to_user_id = t.user_id AND x.claimed_at > v_due)
                     ORDER BY t.user_id
                LOOP
                    n_h3 := n_h3 + public.notif_enqueue(jsonb_build_object(
                        'type', 'REMINDER_H3',
                        'key', 'REMINDER_H3:' || e.id || ':' || h.user_id || ':' || v_start_key,
                        'user_id', h.user_id,
                        'event_id', e.id,
                        'due_at', v_due,
                        'data', v_base || jsonb_build_object('sms_policy', v_h3_sms),
                        'skip', CASE WHEN v_h3_sms = 'NEVER' THEN jsonb_build_object('SMS', 'SMS_POLICY_NEVER') END,
                        'now', v_now));
                END LOOP;
            END IF;
        END IF;

        -- Rappel du contrôleur : la veille du début à 18:00, une ligne par affectation existante à
        -- l'échéance ; point d'entrée et permission espèces lus maintenant.
        v_due := ((e.start_date - 1) + time '18:00') AT TIME ZONE 'Africa/Dakar';
        IF v_due <= v_now AND v_now < v_due + v_tolerance THEN
            v_open := true;
            FOR c IN
                SELECT ec.id, ec.user_id, ec.entry_point, ec.can_accept_cash
                  FROM public.event_controllers ec
                 WHERE ec.event_id = e.id AND ec.created_at <= v_due
                 ORDER BY ec.user_id
            LOOP
                n_ctrl := n_ctrl + public.notif_enqueue(jsonb_build_object(
                    'type', 'CONTROLLER_REMINDER',
                    'key', 'CONTROLLER_REMINDER:' || e.id || ':' || c.user_id || ':' || v_start_key,
                    'user_id', c.user_id,
                    'event_id', e.id,
                    'due_at', v_due,
                    'data', jsonb_build_object(
                        'assignment_id', c.id, 'event_id', e.id, 'title', e.title, 'start_at', v_start,
                        'location', e.location, 'entry_point', NULLIF(btrim(COALESCE(c.entry_point, '')), ''),
                        'can_accept_cash', COALESCE(c.can_accept_cash, false)),
                    'now', v_now));
            END LOOP;
        END IF;

        IF v_open THEN
            n_events := n_events + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'ok', true, 'now', v_now,
        'created', jsonb_build_object('REMINDER_J1', n_j1, 'REMINDER_H3', n_h3, 'CONTROLLER_REMINDER', n_ctrl),
        'events', n_events);
END;
$$;

-- ----------------------------------------------------------------------------
-- I4 — annulation des rappels PENDING dans la transaction de la cause
-- ----------------------------------------------------------------------------

-- Transition vers SUSPENDU, ANNULE ou TERMINE (ligne d'historique écrite par event_status_apply).
CREATE OR REPLACE FUNCTION public.notif_cancel_on_status()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.notification_outbox
       SET status = 'CANCELLED', reason = 'EVENT_' || NEW.new_status::text, finished_at = now()
     WHERE event_id = NEW.event_id
       AND status = 'PENDING'
       AND type IN ('REMINDER_J1', 'REMINDER_H3', 'CONTROLLER_REMINDER');
    IF NEW.new_status::text IN ('ANNULE', 'TERMINE') THEN
        UPDATE public.notification_outbox
           SET status = 'CANCELLED', reason = 'NO_LONGER_RELEVANT', finished_at = now()
         WHERE event_id = NEW.event_id
           AND status = 'PENDING'
           AND type = 'EVENT_CHANGED';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_cancel_on_status ON public.event_status_history;
CREATE TRIGGER trg_notif_cancel_on_status
    AFTER INSERT ON public.event_status_history
    FOR EACH ROW
    WHEN (NEW.new_status::text IN ('SUSPENDU', 'ANNULE', 'TERMINE'))
    EXECUTE FUNCTION public.notif_cancel_on_status();

-- Début modifié (event_update ou toute écriture du service_role) : les rappels de l'ancienne date sont
-- annulés ; ceux de la nouvelle date viennent des passages suivants (nouvelle clé).
CREATE OR REPLACE FUNCTION public.notif_cancel_on_reschedule()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.notification_outbox
       SET status = 'CANCELLED', reason = 'EVENT_RESCHEDULED', finished_at = now()
     WHERE event_id = NEW.id
       AND status = 'PENDING'
       AND type IN ('REMINDER_J1', 'REMINDER_H3', 'CONTROLLER_REMINDER');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_cancel_on_reschedule ON public.events;
CREATE TRIGGER trg_notif_cancel_on_reschedule
    AFTER UPDATE OF start_date, start_time ON public.events
    FOR EACH ROW
    WHEN (OLD.start_date IS DISTINCT FROM NEW.start_date OR OLD.start_time IS DISTINCT FROM NEW.start_time)
    EXECUTE FUNCTION public.notif_cancel_on_reschedule();

-- Billet passé à un autre compte (réclamation d'un transfert) : l'ancien porteur qui n'a plus aucun billet
-- VALIDE de l'événement ne reçoit plus ses rappels. Le nouveau porteur reçoit les rappels à venir (I2).
-- Mise à NULL par la suppression du compte (cascade) : rien à faire, ses lignes disparaissent avec lui.
CREATE OR REPLACE FUNCTION public.notif_cancel_on_holder_change()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = OLD.user_id) THEN
        RETURN NEW;
    END IF;
    IF EXISTS (SELECT 1 FROM public.tickets t
                WHERE t.event_id = NEW.event_id AND t.user_id = OLD.user_id AND t.status::text = 'VALIDE') THEN
        RETURN NEW;
    END IF;
    UPDATE public.notification_outbox
       SET status = 'CANCELLED', reason = 'NO_LONGER_HOLDER', finished_at = now()
     WHERE event_id = NEW.event_id
       AND recipient_user_id = OLD.user_id
       AND status = 'PENDING'
       AND type IN ('REMINDER_J1', 'REMINDER_H3');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_cancel_on_holder_change ON public.tickets;
CREATE TRIGGER trg_notif_cancel_on_holder_change
    AFTER UPDATE OF user_id ON public.tickets
    FOR EACH ROW
    WHEN (OLD.user_id IS NOT NULL AND OLD.user_id IS DISTINCT FROM NEW.user_id)
    EXECUTE FUNCTION public.notif_cancel_on_holder_change();

-- ----------------------------------------------------------------------------
-- Privilèges : service_role uniquement (RPC et fonctions de triggers, règle 1A.3)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.notification_reminders_schedule(jsonb)',
        'public.notif_cancel_on_status()',
        'public.notif_cancel_on_reschedule()',
        'public.notif_cancel_on_holder_change()'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
