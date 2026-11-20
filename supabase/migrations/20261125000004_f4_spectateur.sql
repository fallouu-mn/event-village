-- ============================================================================
-- EVENT VILLAGE — FINITION 4, 4/5 : le spectateur, à l'entrée et le lendemain
-- ============================================================================
-- Décision du client (19/11, point 3) :
--  - à l'entrée, « Bienvenue à {titre} ! Bonne soirée avec {organisateur}. » sur les quatre canaux, une fois par spectateur
--    et par événement (ENTRY_WELCOME, indispensable, clé ENTRY_WELCOME:<compte>:<événement>) ;
--  - le lendemain à 11:00 (heure de Dakar), « Merci d'être venu à {titre}… » avec le lien de l'événement, sur les quatre
--    canaux, désactivable (ENTRY_THANKS, sujet AFTER_EVENT, clé ENTRY_THANKS:<compte>:<événement>). « Le lendemain » : 11:00
--    le jour qui suit le début ; si l'événement n'est pas fini une heure avant, 11:00 le jour qui suit la fin (événement de
--    plusieurs jours). Annulé à l'envoi si l'événement est annulé (notification_outbox_claim, migration 2/5).
-- Au premier passage d'un spectateur, la bienvenue remplace l'avis « Entrée validée » (TICKET_SCANNED) de ce billet : un
-- seul message ; les billets suivants du même porteur (amis entrés avec ses billets) gardent l'avis « Entrée validée »
-- groupé par commande (lot 9 bis, R78), inchangé.
--
-- Recopie : notif_tickets_scanned (20261109000009_lot9bis_messages.sql:1561, dernière définition de main) ; trigger
-- trg_tickets_scanned_notify inchangé (porteur avec compte, hors guichet). Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notif_tickets_scanned()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group text;
    v_count integer;
    -- Finition 4 (point 3) : bienvenue et merci du lendemain
    v_welcome  integer;
    v_org      text;
    v_start    timestamptz;
    v_end      timestamptz;
    v_thanks   timestamptz;
BEGIN
    -- Finition 4 (point 3) : premier passage du porteur à cet événement → bienvenue (une seule fois, clé unique par canal)
    SELECT COALESCE(NULLIF(btrim(pa.company_name), ''), 'l''organisateur'), public.event_start_at(e.id), public.event_end_at(e.id)
      INTO v_org, v_start, v_end
      FROM public.events e LEFT JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = NEW.event_id;
    v_welcome := public.notif_enqueue(jsonb_build_object(
        'type', 'ENTRY_WELCOME', 'key', 'ENTRY_WELCOME:' || NEW.user_id::text || ':' || NEW.event_id::text,
        'user_id', NEW.user_id, 'event_id', NEW.event_id,
        'data', COALESCE(public.notif_event_data(NEW.event_id), '{}'::jsonb)
                || jsonb_build_object('organizer', v_org, 'ticket_id', NEW.id, 'entered_at', now())));
    IF v_welcome > 0 THEN
        v_thanks := ((((v_start AT TIME ZONE 'Africa/Dakar')::date + 1) + time '11:00') AT TIME ZONE 'Africa/Dakar');
        IF v_end IS NOT NULL AND v_thanks < v_end + interval '1 hour' THEN
            v_thanks := ((((v_end AT TIME ZONE 'Africa/Dakar')::date + 1) + time '11:00') AT TIME ZONE 'Africa/Dakar');
        END IF;
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'ENTRY_THANKS', 'key', 'ENTRY_THANKS:' || NEW.user_id::text || ':' || NEW.event_id::text,
            'user_id', NEW.user_id, 'event_id', NEW.event_id, 'due_at', GREATEST(v_thanks, now()),
            'data', COALESCE(public.notif_event_data(NEW.event_id), '{}'::jsonb) || jsonb_build_object('organizer', v_org)));
        -- la bienvenue tient lieu d'« Entrée validée » pour ce billet
        RETURN NULL;
    END IF;

    SELECT o.group_key,
           CASE WHEN o.template_data->>'ticket_count' ~ '^[0-9]{1,6}$' THEN (o.template_data->>'ticket_count')::integer ELSE 1 END
      INTO v_group, v_count
      FROM public.notification_outbox o
     WHERE o.type = 'TICKET_SCANNED' AND o.channel = 'IN_APP' AND o.status = 'PENDING'
       AND o.recipient_user_id = NEW.user_id AND o.event_id = NEW.event_id
       AND (o.template_data->>'payment_id') IS NOT DISTINCT FROM NEW.payment_id::text
     ORDER BY o.created_at, o.id
     LIMIT 1
       FOR UPDATE;
    IF v_group IS NOT NULL THEN
        UPDATE public.notification_outbox
           SET template_data = jsonb_set(template_data, '{ticket_count}', to_jsonb(v_count + 1))
         WHERE group_key = v_group AND type = 'TICKET_SCANNED' AND status = 'PENDING';
        RETURN NULL;
    END IF;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'TICKET_SCANNED', 'key', 'TICKET_SCANNED:' || NEW.id::text,
        'user_id', NEW.user_id, 'event_id', NEW.event_id, 'due_at', now() + interval '2 minutes',
        'data', COALESCE(public.notif_event_data(NEW.event_id), '{}'::jsonb)
                || jsonb_strip_nulls(jsonb_build_object('ticket_id', NEW.id, 'payment_id', NEW.payment_id, 'ticket_count', 1))));
    RETURN NULL;
END;
$$;
