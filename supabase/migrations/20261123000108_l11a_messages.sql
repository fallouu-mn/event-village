-- ============================================================================
-- EVENT VILLAGE — LOT 11a, migration 08 : messages du parcours de réservation d'une table
-- ============================================================================
-- Décision du client : chaque étape prévient la bonne personne sur TOUS les canaux (cloche, push, email, SMS) ; règles
-- de nuit et anti-abus gardées (envoyeur des notifications : les SMS indispensables partent tout de suite, plafond et
-- alerte du jour ; le rappel est optionnel, sujet « Rappels » : préférences du client, plafond des SMS optionnels,
-- aucun SMS optionnel la nuit). Textes dans lib/notifications/catalog.ts, sans aucun mot technique.
--  1. types d'avis (canaux) :
--     client : TABLE_RESERVATION_CONFIRMED, TABLE_REQUEST_SENT, TABLE_REQUEST_REFUSED, TABLE_REQUEST_EXPIRED,
--              TABLE_HOLD_EXPIRED, TABLE_RESERVATION_CANCELLED, TABLE_NO_SHOW, TABLE_PAYMENT_REFUNDED,
--              TABLE_REMINDER (optionnel, sujet REMINDERS) ;
--     établissement : TABLE_NEW_RESERVATION, TABLE_REQUEST_TO_ANSWER, TABLE_RESERVATION_CANCELLED_PRO,
--              VENUE_VALIDATION_DECIDED ;
--     administrateurs (droit partners.validate) : ADMIN_VENUE_SUBMITTED (cloche, push, email ; le SMS passe par le
--              SMS groupé ADMIN_REVIEW_SMS, migration 07) ;
--     le remboursement versé est annoncé par REFUND_PAID (versements, inchangé) ;
--  2. trg_payments_other_success : un paiement de table n'envoie plus l'avis générique « Paiement confirmé » (l'avis
--     de la table le remplace). Condition recopiée de 20261122000007_l10a_messages.sql:34-39.
-- Rejouable : ON CONFLICT DO UPDATE, DROP TRIGGER IF EXISTS puis CREATE.
-- ============================================================================

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('TABLE_RESERVATION_CONFIRMED',     'ESSENTIAL', NULL,        ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL),
    ('TABLE_REQUEST_SENT',              'ESSENTIAL', NULL,        ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL),
    ('TABLE_REQUEST_REFUSED',           'ESSENTIAL', NULL,        ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL),
    ('TABLE_REQUEST_EXPIRED',           'ESSENTIAL', NULL,        ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL),
    ('TABLE_HOLD_EXPIRED',              'ESSENTIAL', NULL,        ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL),
    ('TABLE_RESERVATION_CANCELLED',     'ESSENTIAL', NULL,        ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL),
    ('TABLE_NO_SHOW',                   'ESSENTIAL', NULL,        ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL),
    ('TABLE_PAYMENT_REFUNDED',          'ESSENTIAL', NULL,        ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'ALLOW', FALSE, NULL),
    ('TABLE_REMINDER',                  'OPTIONAL',  'REMINDERS', ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'CLIENT',  'BLOCK', FALSE, NULL),
    ('TABLE_NEW_RESERVATION',           'ESSENTIAL', NULL,        ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'BLOCK', FALSE, NULL),
    ('TABLE_REQUEST_TO_ANSWER',         'ESSENTIAL', NULL,        ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'BLOCK', FALSE, NULL),
    ('TABLE_RESERVATION_CANCELLED_PRO', 'ESSENTIAL', NULL,        ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'ALLOW', FALSE, NULL),
    ('VENUE_VALIDATION_DECIDED',        'ESSENTIAL', NULL,        ARRAY['IN_APP','PUSH','EMAIL','SMS'], 'PARTNER', 'ALLOW', FALSE, NULL),
    ('ADMIN_VENUE_SUBMITTED',           'ESSENTIAL', NULL,        ARRAY['IN_APP','PUSH','EMAIL'],       'ADMIN',   'BLOCK', FALSE, 'partners.validate')
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;

DROP TRIGGER IF EXISTS trg_payments_other_success ON public.payments;
CREATE TRIGGER trg_payments_other_success
    AFTER UPDATE OF status ON public.payments
    FOR EACH ROW
    WHEN (NEW.status::text = 'SUCCESS' AND OLD.status::text IS DISTINCT FROM 'SUCCESS'
          AND NEW.payment_target::text NOT IN ('TICKET', 'HALL_RESERVATION', 'TABLE_RESERVATION') AND NEW.client_id IS NOT NULL)
    EXECUTE FUNCTION public.notif_payments_other_success();
