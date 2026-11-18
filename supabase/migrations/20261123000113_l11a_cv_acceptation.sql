-- ============================================================================
-- EVENT VILLAGE — LOT 11a, correctifs de la contre-vérification (docs/audit-lot11a.md), migration 113 : T5
-- ============================================================================
-- T5 (faible) : table_reservation_respond ne vérifiait que le compte de la partenaire (actif) : un établissement
-- suspendu par l'administration (« ne reçoit plus de nouvelles réservations »), ou une partenaire dont la fiche est
-- suspendue, acceptait encore une demande payée, confirmée aussitôt (audit 4.6a et 4.6b).
--  1. table_reservation_respond : recopie de 20261123000106_l11a_annulation.sql:259-314 ; changement : l'acceptation
--     refait les contrôles de table_reserve sur l'établissement et la partenaire (établissement actif et validé, ou
--     validation non exigée et ni refusé ni suspendu ; partenaire VALIDE) ; sinon la demande est refusée
--     (« Refusée par l'établissement », par le système) et le client remboursé en entier (table_close_apply, 100 %),
--     avec l'avis du refus. Le refus d'une demande par la partenaire reste possible dans tous les cas.
-- Rejouable : CREATE OR REPLACE, REVOKE et GRANT idempotents.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.table_reservation_respond(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_res_id uuid := public.try_uuid(p->>'reservation_id');
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_action text := upper(COALESCE(p->>'action', ''));
    v_reason text := NULLIF(left(btrim(regexp_replace(COALESCE(p->>'reason', ''), '[[:cntrl:]]', ' ', 'g')), 300), '');
    r        record;
BEGIN
    IF v_action NOT IN ('ACCEPTER', 'REFUSER') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ACTION', 'message', 'Choisissez d’accepter ou de refuser la demande.');
    END IF;
    IF v_res_id IS NULL OR public.table_lock_reservation(v_res_id) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    SELECT tr.*, pa.user_id AS owner_id INTO r
      FROM public.table_reservations tr JOIN public.partners pa ON pa.id = tr.partner_id
     WHERE tr.id = v_res_id FOR UPDATE OF tr;
    IF v_actor IS NULL OR v_actor <> r.owner_id
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND', 'message', 'Réservation introuvable.');
    END IF;
    IF r.booking_state = 'EN_ATTENTE_PAIEMENT' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_PAID', 'message', 'L’acompte n’est pas encore payé : la demande ne peut pas être acceptée.');
    END IF;
    IF r.booking_state <> 'EN_ATTENTE_ACCEPTATION' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_PENDING', 'message', 'Cette demande a déjà reçu une réponse.');
    END IF;
    IF r.response_due_at IS NOT NULL AND r.response_due_at <= now() THEN
        -- Délai dépassé : la demande est close tout de suite (comme le ferait la tâche planifiée)
        PERFORM public.table_close_apply(r.id, 'SANS_REPONSE', 'SANS_REPONSE', NULL, 'Pas de réponse de l’établissement à temps', 100);
        RETURN jsonb_build_object('ok', false, 'code', 'RESPONSE_TOO_LATE', 'message', 'Le délai de réponse est passé : la demande est annulée et le client remboursé.');
    END IF;
    IF v_action = 'REFUSER' THEN
        IF v_reason IS NULL OR length(v_reason) < 5 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif : il est envoyé au client.');
        END IF;
        RETURN public.table_close_apply(r.id, 'REFUSEE', NULL, v_actor, v_reason, 100);
    END IF;

    -- Contre-vérification de la 11a (T5) : l'acceptation refait les contrôles de l'établissement et de la partenaire
    -- (mêmes règles que table_reserve) ; sinon la demande est refusée et le client remboursé en entier
    IF NOT EXISTS (
        SELECT 1 FROM public.venues ve JOIN public.partners pa ON pa.id = ve.partner_id
         WHERE ve.id = r.venue_id AND ve.is_active AND pa.status::text = 'VALIDE'
           AND (ve.validation_status = 'VALIDEE'
                OR (NOT public.fin_setting_bool('tables.validation_required') AND ve.validation_status NOT IN ('REFUSEE', 'SUSPENDUE')))) THEN
        PERFORM public.table_close_apply(r.id, 'REFUSEE', NULL, NULL, 'L’établissement n’accepte plus de réservation pour le moment', 100);
        RETURN jsonb_build_object('ok', false, 'code', 'VENUE_NOT_AVAILABLE',
            'message', 'Cet établissement n’accepte plus de réservation pour le moment : la demande est refusée et le client remboursé en entier.');
    END IF;

    PERFORM set_config('event_village.table_booking', 'on', true);
    UPDATE public.table_reservations
       SET booking_state = 'CONFIRMEE', confirmed_at = now(), response_due_at = NULL, updated_at = now()
     WHERE id = r.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value)
    VALUES (v_actor, 'PARTENAIRE', 'TABLE_REQUEST_ACCEPTED', 'table_reservations', r.id,
            jsonb_build_object('booking_state', r.booking_state), jsonb_build_object('booking_state', 'CONFIRMEE'));
    PERFORM public.table_notify('TABLE_RESERVATION_CONFIRMED', r.id, 'CLIENT');
    RETURN jsonb_build_object('ok', true, 'reservation_id', r.id, 'booking_state', 'CONFIRMEE');
END;
$$;

REVOKE ALL ON FUNCTION public.table_reservation_respond(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.table_reservation_respond(jsonb) TO service_role;
