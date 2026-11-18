-- ============================================================================
-- EVENT VILLAGE — LOT 10a, migration 07 : messages du parcours de réservation d'une salle
-- ============================================================================
-- Consigne du lot 10a (point 8) : cloche, push et email ; SMS seulement pour la réservation confirmée, le rappel du
-- solde, le délai de paiement dépassé, l'annulation et le remboursement ; règles de nuit et de plafond existantes
-- (envoyeur des notifications, famille ESSENTIAL). Textes dans lib/notifications/catalog.ts.
--  1. types d'avis (canaux) : HALL_RESERVATION_CONFIRMED (client, SMS), HALL_RESERVATION_REQUESTED (« Nouvelle
--     réservation », salle), HALL_BALANCE_PAID, HALL_BALANCE_REMINDER (SMS), HALL_PAYMENT_DEADLINE_PASSED (SMS),
--     HALL_RESERVATION_CANCELLED (client, SMS), HALL_RESERVATION_CANCELLED_PRO (salle), HALL_PAYMENT_REFUNDED (SMS),
--     HALL_VALIDATION_DECIDED (salle) ;
--  2. trg_hall_reservations_notify retiré : il annonçait une « demande » dès l'attente de 15 minutes et une annulation
--     à chaque attente échue ; les avis partent désormais des fonctions du parcours (migrations 04 à 06) ;
--  3. trg_payments_other_success : un paiement de salle n'envoie plus l'avis générique « Paiement confirmé » (l'avis
--     de la salle le remplace). Condition recopiée de 20261103000006_lot6_pros_admin.sql:978-984.
-- Rejouable : ON CONFLICT DO UPDATE, DROP TRIGGER IF EXISTS puis CREATE.
-- ============================================================================

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('HALL_RESERVATION_CONFIRMED',     'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL),
    ('HALL_RESERVATION_REQUESTED',     'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL'],       'PARTNER', 'BLOCK', FALSE, NULL),
    ('HALL_BALANCE_PAID',              'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL'],       'ANY',     'BLOCK', FALSE, NULL),
    ('HALL_BALANCE_REMINDER',          'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL),
    ('HALL_PAYMENT_DEADLINE_PASSED',   'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL),
    ('HALL_RESERVATION_CANCELLED',     'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL),
    ('HALL_RESERVATION_CANCELLED_PRO', 'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL'],       'PARTNER', 'ALLOW', FALSE, NULL),
    ('HALL_PAYMENT_REFUNDED',          'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL),
    ('HALL_VALIDATION_DECIDED',        'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL'],       'PARTNER', 'ALLOW', FALSE, NULL)
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;

DROP TRIGGER IF EXISTS trg_hall_reservations_notify ON public.hall_reservations;

DROP TRIGGER IF EXISTS trg_payments_other_success ON public.payments;
CREATE TRIGGER trg_payments_other_success
    AFTER UPDATE OF status ON public.payments
    FOR EACH ROW
    WHEN (NEW.status::text = 'SUCCESS' AND OLD.status::text IS DISTINCT FROM 'SUCCESS'
          AND NEW.payment_target::text NOT IN ('TICKET', 'HALL_RESERVATION') AND NEW.client_id IS NOT NULL)
    EXECUTE FUNCTION public.notif_payments_other_success();
