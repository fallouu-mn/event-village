-- ============================================================================
-- EVENT VILLAGE — LOT 11c-a, migration 06 : avis des tables d'un événement
-- ============================================================================
-- Chaque avis sur les quatre canaux (cloche, push, email, SMS d'un segment GSM-7 de 155 caractères au plus), textes sans
-- mot technique dans lib/notifications/catalog.ts ; règle de nuit de la finition 4 (notification_types.night_policy) :
--  - EVENT_TABLE_CONFIRMED (titulaire) : tout de suite (comme PURCHASE_CONFIRMED) ;
--  - EVENT_TABLE_SOLD (organisatrice, groupé par série de 30 minutes) : reporté la nuit, sauf événement qui commence dans
--    moins de 12 h (notif_event_soon, inchangé) ;
--  - EVENT_TABLE_SEATS_REMINDER (titulaire, la veille, facultatif : sujet « Rappels », préférences et plafond des SMS
--    facultatifs) : reporté la nuit ;
--  - ADMIN_EVENT_TABLES_CHANGED (administrateurs events.read) : type ou table ajouté, modifié ou supprimé après la
--    validation (migration 03) ; reporté la nuit.
--  1. types d'avis ; 2. event_table_seats_reminders : rappel la veille au titulaire qui a encore des places à envoyer
--     (appelé par la tâche des rappels, /api/cron/reminders ; une fois par vente, clé par vente).
-- Rejouable : ON CONFLICT DO UPDATE, CREATE OR REPLACE.
-- ============================================================================

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission, night_policy) VALUES
    ('EVENT_TABLE_CONFIRMED',      'ESSENTIAL', NULL,        ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL,          'SEND'),
    ('EVENT_TABLE_SOLD',           'ESSENTIAL', NULL,        ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'BLOCK', FALSE, NULL,          'DEFER'),
    ('EVENT_TABLE_SEATS_REMINDER', 'OPTIONAL',  'REMINDERS', ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL,          'DEFER'),
    ('ADMIN_EVENT_TABLES_CHANGED', 'ESSENTIAL', NULL,        ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'ADMIN',   'BLOCK', FALSE, 'events.read', 'DEFER')
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission,
    night_policy = EXCLUDED.night_policy;

-- p : now (facultatif, tests), only_event_ids (facultatif). La veille de l'événement (jour de Dakar), à partir de 10 h :
-- un avis par vente dont le titulaire garde encore au moins une place à envoyer en plus de la sienne.
CREATE OR REPLACE FUNCTION public.event_table_seats_reminders(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now     timestamptz := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    v_only    uuid[] := ARRAY(SELECT public.try_uuid(x) FROM jsonb_array_elements_text(COALESCE(p->'only_event_ids', '[]'::jsonb)) AS x);
    b         record;
    v_left    integer;
    v_created integer := 0;
BEGIN
    IF v_now < now() - interval '1 minute' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_NOW', 'message', 'Heure simulée dans le passé.');
    END IF;
    IF extract(hour FROM v_now AT TIME ZONE 'Africa/Dakar') < 10 THEN
        RETURN jsonb_build_object('ok', true, 'created', 0);
    END IF;
    FOR b IN
        SELECT bk.id, bk.holder_id, bk.event_id, bk.table_number
          FROM public.event_table_bookings bk
          JOIN public.events e ON e.id = bk.event_id
         WHERE bk.status = 'ACTIVE' AND e.status::text = 'PUBLIE'
           AND (cardinality(v_only) = 0 OR bk.event_id = ANY (v_only))
           AND (public.event_start_at(bk.event_id) AT TIME ZONE 'Africa/Dakar')::date = (v_now AT TIME ZONE 'Africa/Dakar')::date + 1
         ORDER BY bk.id
    LOOP
        SELECT count(*) INTO v_left FROM jsonb_array_elements(public.event_table_seats(b.id)) s WHERE s->>'state' = 'A_ENVOYER';
        IF v_left >= 2 THEN
            v_created := v_created + public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_TABLE_SEATS_REMINDER', 'key', 'EVENT_TABLE_SEATS_REMINDER:' || b.id::text,
                'user_id', b.holder_id, 'event_id', b.event_id, 'now', v_now,
                'data', COALESCE(public.notif_event_data(b.event_id), '{}'::jsonb)
                        || jsonb_build_object('booking_id', b.id, 'table_number', b.table_number, 'seats_left', v_left - 1)));
        END IF;
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'created', v_created);
END;
$$;

REVOKE ALL ON FUNCTION public.event_table_seats_reminders(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_table_seats_reminders(jsonb) TO service_role;
