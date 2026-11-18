-- Finition 3d (recours et suppléance), point 4a — remboursement en espèces marqué par un admin, à la place de
-- l'organisatrice (fiche suspendue ou non : « à tout moment »).
--
-- 1. Type d'avis CASH_REFUND_MARKED_BY_ADMIN : l'organisatrice est prévenue (cloche, push, email), avec le motif.
-- 2. public.event_cash_refund_mark_admin(p jsonb) { event_id, payment_id, actor_id, reason } : admin ACTIF muni de
--    refunds.manage (SUPERADMIN compris), revérifié ici ; motif de 3 à 500 caractères ; événement ANNULE ; vente au guichet
--    de cet événement (mêmes conditions que event_cash_refund_mark de l'organisatrice) ; marque posée par l'admin (le
--    motif est la note), journal CASH_REFUND_MARKED (rôle de l'admin, motif, by_admin), avis à l'organisatrice, dans la
--    même transaction. Second appel : ALREADY_MARKED et la marque existante, aucun second avis. Le client ne reçoit rien
--    de plus que si l'organisatrice avait marqué (aucun avis dans les deux cas). La fonction de l'organisatrice
--    (event_cash_refund_mark) ne change pas : elle refuse toujours un admin.
--
-- Sans BEGIN ni COMMIT ; rejouable (ON CONFLICT, CREATE OR REPLACE, REVOKE et GRANT idempotents).

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('CASH_REFUND_MARKED_BY_ADMIN', 'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL'], 'PARTNER', 'ALLOW', FALSE, NULL)
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;

CREATE OR REPLACE FUNCTION public.event_cash_refund_mark_admin(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event   uuid := public.try_uuid(p->>'event_id');
    v_payment uuid := public.try_uuid(p->>'payment_id');
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_reason  text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    v_status  text;
    v_owner   uuid;
    v_amount  numeric;
    v_role    text;
    m         record;
BEGIN
    IF v_actor IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
       OR NOT public.admin_can(v_actor, 'refunds.manage') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN',
                                  'message', 'Action réservée à un administrateur actif muni de « Gérer les remboursements ».');
    END IF;
    IF v_reason IS NULL OR char_length(v_reason) < 3 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Indiquez le motif (3 caractères au moins).');
    END IF;
    IF char_length(v_reason) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Le motif est limité à 500 caractères.');
    END IF;
    SELECT e.status::text, pa.user_id INTO v_status, v_owner
      FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = v_event;
    IF v_event IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF v_status <> 'ANNULE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_CANCELLED',
                                  'message', 'La liste des espèces à rembourser n’existe que pour un événement annulé.');
    END IF;
    SELECT pay.amount INTO v_amount
      FROM public.payments pay
     WHERE pay.id = v_payment AND pay.event_id = v_event AND NOT pay.is_platform_payment
       AND pay.payment_target::text = 'TICKET' AND pay.status::text = 'SUCCESS' AND pay.amount > 0;
    IF v_payment IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PAYMENT_NOT_FOUND', 'message', 'Vente introuvable dans la liste des espèces à rembourser.');
    END IF;
    v_role := CASE WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN')
                   THEN 'SUPERADMIN' ELSE 'ADMIN' END;

    SELECT * INTO m FROM public.event_cash_refund_marks WHERE payment_id = v_payment;
    IF NOT FOUND THEN
        BEGIN
            INSERT INTO public.event_cash_refund_marks (payment_id, event_id, marked_by, note)
            VALUES (v_payment, v_event, v_actor, v_reason)
            RETURNING * INTO m;
            INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
            VALUES (v_actor, v_role, 'CASH_REFUND_MARKED', 'payments', v_payment,
                    jsonb_build_object('event_id', v_event, 'payment_id', v_payment, 'amount', v_amount, 'note', v_reason,
                                       'reason', v_reason, 'by_admin', true));
            IF v_owner IS NOT NULL THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'CASH_REFUND_MARKED_BY_ADMIN', 'key', 'CASH_REFUND_MARKED_BY_ADMIN:' || v_payment::text,
                    'user_id', v_owner, 'event_id', v_event, 'actor_id', v_actor,
                    'data', COALESCE(public.notif_event_data(v_event), '{}'::jsonb) || jsonb_build_object(
                        'payment_id', v_payment, 'reference', upper(left(v_payment::text, 8)), 'amount', v_amount, 'reason', v_reason)));
            END IF;
            RETURN jsonb_build_object('ok', true,
                'mark', jsonb_build_object('payment_id', m.payment_id, 'refunded_at', m.marked_at, 'refunded_by_id', m.marked_by,
                                           'refunded_by', (SELECT NULLIF(btrim(concat_ws(' ', u.first_name, u.last_name)), '')
                                                             FROM public.users u WHERE u.id = m.marked_by),
                                           'note', m.note));
        EXCEPTION WHEN unique_violation THEN
            -- Course sur la clé primaire : la marque concurrente fait foi (lue ci-dessous)
            SELECT * INTO m FROM public.event_cash_refund_marks WHERE payment_id = v_payment;
        END;
    END IF;
    RETURN jsonb_build_object('ok', true, 'code', 'ALREADY_MARKED',
        'message', 'Cette vente est déjà marquée remboursée.',
        'mark', jsonb_build_object('payment_id', m.payment_id, 'refunded_at', m.marked_at, 'refunded_by_id', m.marked_by,
                                   'refunded_by', (SELECT NULLIF(btrim(concat_ws(' ', u.first_name, u.last_name)), '')
                                                     FROM public.users u WHERE u.id = m.marked_by),
                                   'note', m.note));
END;
$$;
REVOKE ALL ON FUNCTION public.event_cash_refund_mark_admin(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_cash_refund_mark_admin(jsonb) TO service_role;
