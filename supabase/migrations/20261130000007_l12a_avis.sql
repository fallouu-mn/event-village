-- ============================================================================
-- EVENT VILLAGE — LOT 12a, migration 07 : avis des étapes d'une commande
-- ============================================================================
-- Décision du client : chaque étape annoncée sur les 4 canaux (cloche, push, email, SMS d'un segment au pire cas), règle
-- de nuit de la finition 4 respectée (notification_types.night_policy : SEND = part tout de suite, la nuit aussi ;
-- DEFER = SMS et push préparés la nuit reportés à la fin de la plage). Complément du 21/11 : chaque avis mène directement
-- à la commande concernée (lien de lib/notifications/catalog.ts) et dit quoi faire ensuite. Textes dans le catalogue,
-- sans mot technique.
--  1. types d'avis (canaux, classement de nuit) :
--     client : ORDER_RECEIVED (reçue), ORDER_ACCEPTED (acceptée), ORDER_PREPARING (en préparation), ORDER_READY (prête ;
--              retrait : code), ORDER_ON_THE_WAY (en route : code), ORDER_HANDED_OVER (livrée, retirée ou servie),
--              ORDER_CANCELLED (annulée, refusée, sans réponse, non payée à temps), ORDER_PAYMENT_REFUNDED (paiement
--              arrivé trop tard, remboursé), ORDER_REFUND_PAID (remboursement versé), ORDER_PICKUP_REMINDER (commande
--              à retirer bientôt close), ORDER_NOT_COLLECTED (non retirée) : SEND (le client attend sa commande en ce
--              moment) ; envoi immédiat ORDER_HANDOVER_CODE (code de remise, SMS) ;
--     partenaire : ORDER_NEW (à accepter) et ORDER_CANCELLED_PRO : SEND ; ORDER_HANDED_OVER_PRO (remise par le
--              livreur) : DEFER ;
--     livreur : ORDER_COURIER_ASSIGNED, ORDER_COURIER_CANCELLED : SEND ; ORDER_COURIER_INVITED (cloche, push, email,
--              jamais de SMS : numéro saisi par la partenaire) : DEFER ;
--  2. trg_payments_other_success : un paiement de commande n'envoie plus l'avis générique « Paiement confirmé » (l'avis
--     de la commande le remplace). Condition recopiée de 20261123000108_l11a_messages.sql:41-47 ;
--  3. code de remise : jamais dans la boîte d'envoi (contrainte notification_outbox_no_secret_chk, lot 6) ; envoyé
--     tout de suite par la route serveur (SMS ORDER_HANDOVER_CODE, envoi immédiat comme les codes à usage unique),
--     journalisé sans le code par notification_sync_log : recopie de 20261120000005_f3d_numero_admin.sql:58-124,
--     changement : type ORDER_HANDOVER_CODE (objet ORDER_HANDOVER). ORDER_ON_THE_WAY n'a donc que la cloche, le push
--     et l'email dans la boîte d'envoi (son SMS est le code) ; ORDER_READY d'un retrait de même.
-- Rejouable : ON CONFLICT DO UPDATE, DROP TRIGGER IF EXISTS puis CREATE, CREATE OR REPLACE.
-- ============================================================================

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission, night_policy) VALUES
    ('ORDER_RECEIVED',          'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_ACCEPTED',          'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_PREPARING',         'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_READY',             'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_ON_THE_WAY',        'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL'],       'CLIENT',  'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_HANDED_OVER',       'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_CANCELLED',         'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL, 'SEND'),
    ('ORDER_PAYMENT_REFUNDED',  'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL, 'SEND'),
    ('ORDER_REFUND_PAID',       'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL, 'SEND'),
    ('ORDER_PICKUP_REMINDER',   'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_NOT_COLLECTED',     'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL, 'SEND'),
    ('ORDER_NEW',               'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_CANCELLED_PRO',     'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'ALLOW', FALSE, NULL, 'SEND'),
    ('ORDER_HANDED_OVER_PRO',   'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'BLOCK', FALSE, NULL, 'DEFER'),
    ('ORDER_COURIER_ASSIGNED',  'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_COURIER_CANCELLED', 'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL, 'SEND'),
    ('ORDER_COURIER_INVITED',   'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL'],       'CLIENT',  'BLOCK', FALSE, NULL, 'DEFER'),
    ('ORDER_HANDOVER_CODE',     'ESSENTIAL', NULL, ARRAY['SMS'],                         'ANY',     'ALLOW', TRUE,  NULL, 'SEND')
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission,
    night_policy = EXCLUDED.night_policy;

DROP TRIGGER IF EXISTS trg_payments_other_success ON public.payments;
CREATE TRIGGER trg_payments_other_success
    AFTER UPDATE OF status ON public.payments
    FOR EACH ROW
    WHEN (NEW.status::text = 'SUCCESS' AND OLD.status::text IS DISTINCT FROM 'SUCCESS'
          AND NEW.payment_target::text NOT IN ('TICKET', 'HALL_RESERVATION', 'TABLE_RESERVATION', 'ORDER') AND NEW.client_id IS NOT NULL)
    EXECUTE FUNCTION public.notif_payments_other_success();

-- Le trigger de nettoyage prévu au départ du lot n'existe plus : le code n'entre jamais dans la boîte d'envoi.
DROP TRIGGER IF EXISTS trg_notification_outbox_order_code ON public.notification_outbox;
DROP FUNCTION IF EXISTS public.notification_outbox_order_code();

-- Recopie de 20261120000005_f3d_numero_admin.sql:58-124 ; changement : ORDER_HANDOVER_CODE journalisé (sans le code).
CREATE OR REPLACE FUNCTION public.notification_sync_log(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type    text := p->>'type';
    v_ref     text := NULLIF(btrim(COALESCE(p->>'ref', '')), '');
    v_phone   text := NULLIF(btrim(COALESCE(p->>'phone', '')), '');
    v_user    uuid := NULLIF(p->>'user_id', '')::uuid;
    v_actor   uuid := NULLIF(p->>'actor_id', '')::uuid;
    v_outcome text := p->>'outcome';
    v_reason  text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    v_purpose text;
    v_key     text;
    v_id      uuid;
    v_now     timestamptz := now();
BEGIN
    v_purpose := CASE v_type
        WHEN 'OTP_LOGIN' THEN 'LOGIN'
        WHEN 'OTP_REGISTER' THEN 'REGISTER'
        WHEN 'OTP_PASSWORD_RESET' THEN 'PASSWORD_RESET'
        WHEN 'OTP_WITHDRAWAL' THEN 'WITHDRAWAL'
        WHEN 'OTP_PHONE_CHANGE' THEN 'PHONE_CHANGE'
        WHEN 'OTP_AUTH_HOOK' THEN 'AUTH_HOOK'
        WHEN 'CONTROLLER_INVITE' THEN 'CONTROLLER_SETUP'
        -- Lot 9 quinquies (A2, A3) : lien d'activation d'un compte créé par un admin ; code administrateur
        WHEN 'ACCOUNT_ACTIVATION' THEN 'ACCOUNT_ACTIVATION'
        WHEN 'OTP_ADMIN' THEN 'ADMIN_STEP_UP'
        -- Finition 3d (point 2a) : code au nouveau numéro d'un administrateur
        WHEN 'OTP_ADMIN_PHONE' THEN 'ADMIN_PHONE_CHANGE'
        -- Lot 12a : code de remise d'une commande (retrait, livraison, nouveau code)
        WHEN 'ORDER_HANDOVER_CODE' THEN 'ORDER_HANDOVER'
    END;
    IF v_purpose IS NULL OR NOT EXISTS (SELECT 1 FROM public.notification_types t WHERE t.type = v_type AND t.sync_only) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TYPE',
            'message', 'Seuls les codes à usage unique et les invitations se journalisent ici.');
    END IF;
    IF v_ref IS NULL OR v_outcome IS NULL OR v_outcome NOT IN ('SENT', 'FAILED', 'UNCERTAIN', 'SKIPPED')
       OR (v_phone IS NULL AND v_user IS NULL)
       OR (v_phone IS NOT NULL AND v_phone !~ '^\+221[0-9]{9}$')
       OR (v_outcome <> 'SENT' AND v_reason IS NULL) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Journal d''envoi incomplet.');
    END IF;

    v_key := v_type || ':' || v_ref;
    INSERT INTO public.notification_outbox (
        idempotency_key, group_key, type, family, topic, channel, origin,
        recipient_user_id, recipient_phone, actor_id, template_data, status, reason,
        attempts, max_attempts, due_at, next_attempt_at, sent_at, finished_at, provider_message_id, decision
    ) VALUES (
        v_key || ':SMS', v_key, v_type, 'ESSENTIAL', NULL, 'SMS', 'SYNC_LOG',
        v_user, v_phone, v_actor, jsonb_build_object('purpose', v_purpose), v_outcome,
        CASE WHEN v_outcome = 'SENT' THEN NULL ELSE v_reason END,
        CASE WHEN v_outcome = 'SKIPPED' THEN 0 ELSE 1 END, 5, v_now, v_now,
        CASE WHEN v_outcome IN ('SENT', 'UNCERTAIN') THEN v_now END, v_now,
        NULLIF(left(COALESCE(p->>'provider_message_id', ''), 200), ''),
        jsonb_build_object('at', v_now, 'stage', 'SYNC', 'outcome', v_outcome)
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        SELECT o.id INTO v_id FROM public.notification_outbox o WHERE o.idempotency_key = v_key || ':SMS';
    END IF;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

