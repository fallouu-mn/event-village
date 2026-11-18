-- ============================================================================
-- EVENT VILLAGE — LOT 11a, correctifs de la contre-vérification (docs/audit-lot11a.md), migration 112 : T3
-- ============================================================================
-- T3 (moyenne) : table_reservation_cancel appliquait la règle du client (acompte rendu jusqu'à
-- tables.cancel_free_hours avant l'heure, rien ensuite) aussi à une demande « En attente de réponse » : une demande
-- payée que l'établissement n'avait jamais acceptée, annulée par le client à 1 h 30 de l'heure, ne rendait rien et
-- l'établissement gardait l'acompte (audit 3.3b : 0 F rendu sur 21 000 F).
--  1. table_reservation_cancel : recopie de 20261123000106_l11a_annulation.sql:194-257 ; changement : une demande
--     « En attente de réponse » annulée par le client est remboursée en entier (100 %), quelle que soit l'heure ; la
--     règle des 2 h ne vaut que pour une réservation confirmée.
-- Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.table_reservation_cancel(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_res_id uuid := public.try_uuid(p->>'reservation_id');
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_origin text := upper(COALESCE(p->>'origin', ''));
    v_reason text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'reason', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    r        record;
    v_pct    numeric;
    v_state  text;
BEGIN
    IF v_origin NOT IN ('CLIENT', 'ETABLISSEMENT', 'EVENT_VILLAGE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ORIGIN', 'message', 'Annulation refusée.');
    END IF;
    IF v_res_id IS NULL OR public.table_lock_reservation(v_res_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    SELECT tr.*, pa.user_id AS owner_id INTO r
      FROM public.table_reservations tr JOIN public.partners pa ON pa.id = tr.partner_id
     WHERE tr.id = v_res_id FOR UPDATE OF tr;

    -- Droits : le client sur la sienne, l'établissement sur celles de ses établissements, Event Village avec le droit
    -- des remboursements (ou la modération des services pour une demande jamais payée)
    IF v_origin = 'CLIENT' AND (v_actor IS NULL OR v_actor <> r.client_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    IF v_origin = 'ETABLISSEMENT' AND (v_actor IS NULL OR v_actor <> r.owner_id
        OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    IF v_origin = 'EVENT_VILLAGE' AND (v_actor IS NULL
        OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
        OR NOT (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text = 'SUPERADMIN')
                OR public.has_admin_permission(v_actor, 'refunds.manage')
                OR (r.paid_amount = 0 AND r.booking_state IN ('EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_ACCEPTATION')
                    AND public.has_admin_permission(v_actor, 'events.write')))) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit d’annuler cette réservation.');
    END IF;
    IF v_origin IN ('ETABLISSEMENT', 'EVENT_VILLAGE') AND (v_reason IS NULL OR length(v_reason) < 5) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif : il est envoyé au client.');
    END IF;
    IF r.booking_state NOT IN ('EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_ACCEPTATION', 'CONFIRMEE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_CANCELLABLE', 'message', 'Cette réservation est déjà annulée ou terminée.');
    END IF;
    IF v_origin IN ('CLIENT', 'ETABLISSEMENT') AND lower(r.slot) <= public.hall_dakar_now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_STARTED', 'message', 'L’heure de la réservation est passée : elle ne peut plus être annulée.');
    END IF;
    IF v_origin = 'EVENT_VILLAGE' AND upper(r.slot) <= public.hall_dakar_now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_ENDED', 'message', 'La réservation est terminée : elle ne peut plus être annulée.');
    END IF;

    -- Contre-vérification de la 11a (T3) : une demande que l'établissement n'a pas encore acceptée est rendue en entier,
    -- quelle que soit l'heure ; la règle des tables.cancel_free_hours ne vaut que pour une réservation confirmée
    v_pct := CASE WHEN v_origin = 'CLIENT' AND r.booking_state <> 'EN_ATTENTE_ACCEPTATION'
                  THEN public.table_client_refund_percent(lower(r.slot), public.hall_dakar_now(), public.fin_setting_num('tables.cancel_free_hours'))
                  ELSE 100 END;
    v_state := CASE v_origin WHEN 'CLIENT' THEN 'ANNULEE_CLIENT' WHEN 'ETABLISSEMENT' THEN 'ANNULEE_ETABLISSEMENT' ELSE 'ANNULEE_EV' END;
    RETURN public.table_close_apply(r.id, v_state, v_origin, v_actor, COALESCE(v_reason, 'Annulation par le client'), v_pct)
           || jsonb_build_object('cancel_free_hours', public.fin_setting_num('tables.cancel_free_hours'));
END;
$$;

REVOKE ALL ON FUNCTION public.table_reservation_cancel(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.table_reservation_cancel(jsonb) TO service_role;
