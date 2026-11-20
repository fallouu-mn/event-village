-- ============================================================================
-- EVENT VILLAGE — FINITION 4, 5/5 : SMS ajoutés et textes justes (données)
-- ============================================================================
-- Décision du client (19/11, point 4) : SMS des refus en série à une porte, au plus un par porte et par 15 minutes (la
-- cloche, le push et l'email gardent la cadence réglée de l'alerte, scan_refusal_alert_settings). Point 5 : la cloche et le
-- SMS d'un second refus d'une demande de partenaire disent la suite (le dossier a déjà été complété une fois : contacter le
-- support) ; la donnée resubmitted est transmise au modèle.
-- Recopies (dernière définition de main, seuls changements commentés « Finition 4 ») :
--   scan_refusal_alert (20261110000010_lot9ter_pilotage.sql:887) ; notif_partners_notify (20261103000006_lot6_pros_admin.sql:625).
-- Trigger et droits inchangés (CREATE OR REPLACE). Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

-- Recopie : 20261110000010_lot9ter_pilotage.sql:887
CREATE OR REPLACE FUNCTION public.scan_refusal_alert()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    s record;
    v_gate_key text;
    v_prefix text;
    v_now timestamptz;
    v_n integer;
    v_owner uuid;
    v_gate text;
    v_zone text;
BEGIN
    IF NOT public.scan_alert_refusal(NEW.result, NEW.zone_result) THEN
        RETURN NULL;
    END IF;
    v_gate_key := CASE WHEN NEW.gate_id IS NOT NULL THEN NEW.gate_id::text ELSE 'ep:' || COALESCE(NEW.entry_point, '') END;
    -- une seule décision à la fois par (événement, porte) : le comptage suivant voit les refus déjà validés
    PERFORM pg_advisory_xact_lock(hashtextextended('scan_refusal_alert:' || NEW.event_id::text || ':' || v_gate_key, 0));
    SELECT * INTO s FROM public.scan_refusal_alert_settings();
    v_now := clock_timestamp();
    SELECT count(*) INTO v_n FROM public.ticket_scans sc
     WHERE sc.event_id = NEW.event_id AND NOT sc.accepted
       AND sc.created_at > v_now - make_interval(mins => s.minutes)
       AND (CASE WHEN sc.gate_id IS NOT NULL THEN sc.gate_id::text ELSE 'ep:' || COALESCE(sc.entry_point, '') END) = v_gate_key
       AND public.scan_alert_refusal(sc.result, sc.zone_result);
    IF v_n < s.threshold THEN
        RETURN NULL;
    END IF;
    v_prefix := 'SCAN_REFUSALS_ALERT:' || NEW.event_id::text || ':' || md5(v_gate_key) || ':';
    IF EXISTS (SELECT 1 FROM public.notification_outbox o
                WHERE o.event_id = NEW.event_id AND o.type = 'SCAN_REFUSALS_ALERT'
                  AND left(o.group_key, length(v_prefix)) = v_prefix
                  AND o.created_at > v_now - make_interval(mins => s.minutes)) THEN
        RETURN NULL;
    END IF;
    SELECT p.user_id INTO v_owner FROM public.events e JOIN public.partners p ON p.id = e.partner_id WHERE e.id = NEW.event_id;
    IF v_owner IS NULL THEN
        -- aucun destinataire (événement sans compte partenaire) : rien à mettre en file, le scan n'en dépend pas
        RETURN NULL;
    END IF;
    IF NEW.gate_id IS NOT NULL THEN
        SELECT g.name, z.name INTO v_gate, v_zone
          FROM public.event_gates g JOIN public.event_zones z ON z.id = g.zone_id WHERE g.id = NEW.gate_id;
    ELSE
        v_gate := COALESCE(NULLIF(btrim(NEW.entry_point), ''), 'Point d’entrée non précisé');
    END IF;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'SCAN_REFUSALS_ALERT',
        'key', v_prefix || floor(extract(epoch FROM v_now) / (s.minutes * 60))::bigint,
        'user_id', v_owner,
        'event_id', NEW.event_id,
        'data', COALESCE(public.notif_event_data(NEW.event_id), '{}'::jsonb)
                || jsonb_build_object('gate_name', v_gate, 'zone_name', v_zone, 'refused_count', v_n,
                                      'window_minutes', s.minutes, 'threshold', s.threshold),
        -- Finition 4 (point 4) : SMS au plus un par porte et par 15 minutes (lignes SMS de même préfixe, toute issue)
        'channels', CASE WHEN EXISTS (SELECT 1 FROM public.notification_outbox o
                                       WHERE o.event_id = NEW.event_id AND o.type = 'SCAN_REFUSALS_ALERT' AND o.channel = 'SMS'
                                         AND left(o.group_key, length(v_prefix)) = v_prefix
                                         AND o.created_at > v_now - interval '15 minutes')
                         THEN jsonb_build_array('IN_APP', 'PUSH', 'EMAIL')
                         ELSE jsonb_build_array('IN_APP', 'PUSH', 'EMAIL', 'SMS') END));
    RETURN NULL;
END;
$$;


-- Recopie : 20261103000006_lot6_pros_admin.sql:625
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
        -- Finition 4 (point 5) : second refus (dossier déjà complété une fois, lot 9 bis R54) : le message dit la suite
        v_data := v_data || jsonb_build_object('resubmitted', NEW.resubmitted_at IS NOT NULL);
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


