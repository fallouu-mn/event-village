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
--              à retirer bientôt close), ORDER_NOT_COLLECTED (non retirée), ORDER_CODE (nouveau code) : SEND (le client
--              attend sa commande en ce moment) ;
--     partenaire : ORDER_NEW (à accepter) et ORDER_CANCELLED_PRO : SEND ; ORDER_HANDED_OVER_PRO (remise par le
--              livreur) : DEFER ;
--     livreur : ORDER_COURIER_ASSIGNED, ORDER_COURIER_CANCELLED : SEND ; ORDER_COURIER_INVITED (cloche, push, email,
--              jamais de SMS : numéro saisi par la partenaire) : DEFER ;
--  2. trg_payments_other_success : un paiement de commande n'envoie plus l'avis générique « Paiement confirmé » (l'avis
--     de la commande le remplace). Condition recopiée de 20261123000108_l11a_messages.sql:41-47 ;
--  3. trg_notification_outbox_order_code : le code de remise d'un avis de commande est effacé des données de la file
--     dès que la ligne est terminée (envoyée, en échec, sautée, annulée ou incertaine) ; la cloche ne l'a jamais reçu
--     (order_notify) : il n'est jamais gardé en clair après l'envoi.
-- Rejouable : ON CONFLICT DO UPDATE, DROP TRIGGER IF EXISTS puis CREATE, CREATE OR REPLACE.
-- ============================================================================

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission, night_policy) VALUES
    ('ORDER_RECEIVED',          'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_ACCEPTED',          'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_PREPARING',         'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_READY',             'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_ON_THE_WAY',        'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_HANDED_OVER',       'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_CANCELLED',         'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL, 'SEND'),
    ('ORDER_PAYMENT_REFUNDED',  'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL, 'SEND'),
    ('ORDER_REFUND_PAID',       'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL, 'SEND'),
    ('ORDER_PICKUP_REMINDER',   'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_NOT_COLLECTED',     'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL, 'SEND'),
    ('ORDER_CODE',              'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_NEW',               'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_CANCELLED_PRO',     'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'ALLOW', FALSE, NULL, 'SEND'),
    ('ORDER_HANDED_OVER_PRO',   'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'BLOCK', FALSE, NULL, 'DEFER'),
    ('ORDER_COURIER_ASSIGNED',  'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL, 'SEND'),
    ('ORDER_COURIER_CANCELLED', 'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL, 'SEND'),
    ('ORDER_COURIER_INVITED',   'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL'],       'CLIENT',  'BLOCK', FALSE, NULL, 'DEFER')
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

CREATE OR REPLACE FUNCTION public.notification_outbox_order_code()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.type LIKE 'ORDER\_%' AND NEW.template_data ? 'code'
       AND NEW.status IN ('SENT', 'FAILED', 'SKIPPED', 'CANCELLED', 'UNCERTAIN') THEN
        NEW.template_data := NEW.template_data - 'code';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notification_outbox_order_code() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notification_outbox_order_code ON public.notification_outbox;
CREATE TRIGGER trg_notification_outbox_order_code
    BEFORE INSERT OR UPDATE ON public.notification_outbox
    FOR EACH ROW EXECUTE FUNCTION public.notification_outbox_order_code();
