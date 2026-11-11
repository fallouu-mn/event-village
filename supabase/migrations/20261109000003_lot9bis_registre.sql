-- ============================================================================
-- EVENT VILLAGE — LOT 9 BIS : registre des notifications (contrat M03, sections 3.1 et 11 ; S-D, vague S2)
-- ============================================================================
-- Registre public.notification_types aligné sur lib/notifications/catalog.ts (même commit ; égalité imposée par
-- tests/parcours/notif-modeles.test.ts et notif-outbox.test.ts) AVANT tout émetteur du lot (vague S3) :
--   - 26 types nouveaux (11.1, N1 à N26), dont EMAIL_VERIFICATION (journal synchrone, EMAIL seul) ;
--   - types modifiés (11.2) : EVENT_CHANGED indispensable sans sujet (R14), INVITATION_RECEIVED au compte (R79),
--     TICKET_SCANNED regroupé (R78), TRIAL_STARTED sans SMS (R31), PHONE_CHANGED par email (M22), et canal EMAIL
--     pour tout type indispensable non synchrone adressé à un compte (G.49, B97 ; exclus : PUSH_TEST, COUNTER_RECEIPT,
--     synchrones), et pour les optionnels qui ont le push (G.50) ; G.49 annule l'amendement 2 du lot 6
--     (EMAIL de TRANSFER_OFFERED et TRANSFER_CANCELLED).
-- Base : 20261103000002_lot6_outbox.sql:77-147 (table G2), 20261105000002_lot7_sms.sql:41-46,
-- 20261105000007_lot7_confirmation.sql:397-399, 20261106000003_lot8_paiement.sql:31-33,
-- 20261108000002_lot9_invitations.sql:41-43, 20261108000004_lot9_compte.sql:30-33. Ces fichiers sont gelés : la
-- valeur finale de chaque type modifié est posée ici par ON CONFLICT (type) DO UPDATE (rejouable, sans effet au rejeu).
-- Les rejeux de migrations gelées (migration-lot6…9-rejouable) réécrivent l'ancienne valeur dans une transaction
-- annulée : sans effet durable.
--
-- Index de la boîte d'envoi (fusion et compteur des émetteurs de la vague S3) :
--   - uq_outbox_event_change_pending_sms_phone : un SMS de changement en attente par numéro seul (R12, R26) ;
--   - uq_outbox_event_change_pending_email : un email de changement en attente par compte (R26, G.49) ;
--   - uq_outbox_controller_change_pending_sms : un SMS de changement en attente par contrôleur (R33) ;
--   - idx_outbox_tickets_scanned_pending : recherche de l'avis de scan en attente d'une commande, NON unique (la
--     fusion se fait par SELECT … FOR UPDATE, D-msg D14 ; un index unique pourrait échouer sur des lignes en base) ;
--   - idx_outbox_sms_essential_day : compteur des SMS indispensables du jour (R31, notification_daily_checks).
-- Reprise : les lignes EVENT_CHANGED encore PENDING passent ESSENTIAL sans sujet (la réservation lit la famille de
-- la ligne), gardée par IS DISTINCT FROM.
-- DDL avant DML. Aucune fonction : rien à accorder. Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Index de la boîte d'envoi (DDL)
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_outbox_event_change_pending_sms_phone
    ON public.notification_outbox (event_id, recipient_phone)
    WHERE type = 'EVENT_CHANGED' AND channel = 'SMS' AND status = 'PENDING' AND recipient_user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_outbox_event_change_pending_email
    ON public.notification_outbox (event_id, recipient_user_id)
    WHERE type = 'EVENT_CHANGED' AND channel = 'EMAIL' AND status = 'PENDING';

CREATE UNIQUE INDEX IF NOT EXISTS uq_outbox_controller_change_pending_sms
    ON public.notification_outbox (event_id, recipient_user_id)
    WHERE type = 'CONTROLLER_EVENT_CHANGED' AND channel = 'SMS' AND status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_outbox_tickets_scanned_pending
    ON public.notification_outbox (recipient_user_id, event_id, channel, (template_data->>'payment_id'))
    WHERE type = 'TICKET_SCANNED' AND status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_outbox_sms_essential_day
    ON public.notification_outbox ((COALESCE(claimed_at, sent_at, finished_at)))
    WHERE channel = 'SMS' AND family = 'ESSENTIAL';


-- ----------------------------------------------------------------------------
-- 2. Registre : types nouveaux (11.1) et types modifiés (11.2), valeur finale du lot
-- ----------------------------------------------------------------------------
INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    -- 11.1 : types nouveaux (N1 à N26)
    ('REFUND_DELAYED',             'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL','PUSH'],  'CLIENT',     'ALLOW', FALSE, NULL),
    ('WITHDRAWAL_DELAYED',         'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL','PUSH'],  'ANY',        'ALLOW', FALSE, NULL),
    ('ADMIN_CASHOUT_TO_RESUME',    'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','EMAIL'],        'ADMIN',      'BLOCK', FALSE, 'refunds.manage'),
    ('PAYMENT_REFUND_STARTED',     'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL','PUSH'],  'CLIENT',     'ALLOW', FALSE, NULL),
    ('ADMIN_PARTNER_RESUBMITTED',  'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','EMAIL'],        'ADMIN',      'BLOCK', FALSE, 'partners.read'),
    ('EVENT_CLOSED_HOLDER',        'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL','PUSH'],  'CLIENT',     'ALLOW', FALSE, NULL),
    ('EVENT_CLOSED_BY_ADMIN',      'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL','PUSH'],  'PARTNER',    'BLOCK', FALSE, NULL),
    ('SHIFT_OPEN_AT_END',          'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','SMS','EMAIL'],  'PARTNER',    'ALLOW', FALSE, NULL),
    ('TRANSFER_REVOKED',           'ESSENTIAL', NULL,            ARRAY['SMS','IN_APP','PUSH','EMAIL'],  'CLIENT',     'BLOCK', FALSE, NULL),
    ('TRANSFER_DECLINED_SENDER',   'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','EMAIL'],        'CLIENT',     'BLOCK', FALSE, NULL),
    ('TRANSFER_RECIPIENT_CHANGED', 'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','EMAIL'],        'CLIENT',     'BLOCK', FALSE, NULL),
    ('CONTROLLER_INVITATION',      'ESSENTIAL', NULL,            ARRAY['SMS','IN_APP','PUSH','EMAIL'],  'CLIENT',     'BLOCK', FALSE, NULL),
    ('EVENT_CANCELLED_BY_ADMIN',   'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL'],         'PARTNER',    'ALLOW', FALSE, NULL),
    ('ADMIN_EVENT_CANCELLED',      'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'ADMIN',      'BLOCK', FALSE, 'events.read'),
    ('CONTROLLER_EVENT_CANCELLED', 'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL'],         'CONTROLLER', 'BLOCK', FALSE, NULL),
    ('CONTROLLER_EVENT_CHANGED',   'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL'],         'CONTROLLER', 'BLOCK', FALSE, NULL),
    ('CONTROLLER_EVENT_STATUS',    'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'CONTROLLER', 'BLOCK', FALSE, NULL),
    ('TICKET_CANCELLED',           'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL'],         'ANY',        'ALLOW', FALSE, NULL),
    ('ACCOUNT_SUSPENDED',          'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL'],         'ANY',        'ALLOW', FALSE, NULL),
    ('ACCOUNT_REACTIVATED',        'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL'],         'ANY',        'ALLOW', FALSE, NULL),
    ('ADMIN_EVENT_CHANGED',        'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'ADMIN',      'BLOCK', FALSE, 'events.read'),
    ('EVENT_SUBMITTED_ACK',        'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'PARTNER',    'BLOCK', FALSE, NULL),
    ('EVENT_FINISHED',             'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'PARTNER',    'ALLOW', FALSE, NULL),
    ('CLOSING_REPORT_READY',       'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'PARTNER',    'ALLOW', FALSE, NULL),
    ('FUNDS_AVAILABLE',            'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'PARTNER',    'BLOCK', FALSE, NULL),
    ('EMAIL_VERIFICATION',         'ESSENTIAL', NULL,            ARRAY['EMAIL'],                        'ANY',        'ALLOW', TRUE,  NULL),
    -- 11.2 : types modifiés par le texte ou la règle
    ('EVENT_CHANGED',              'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','SMS','EMAIL'],  'CLIENT',     'BLOCK', FALSE, NULL),
    ('INVITATION_RECEIVED',        'ESSENTIAL', NULL,            ARRAY['SMS','IN_APP','PUSH','EMAIL'],  'ANY',        'ALLOW', FALSE, NULL),
    ('TICKET_SCANNED',             'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','EMAIL'],        'CLIENT',     'BLOCK', FALSE, NULL),
    ('TRIAL_STARTED',              'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'PARTNER',    'BLOCK', FALSE, NULL),
    ('PHONE_CHANGED',              'ESSENTIAL', NULL,            ARRAY['SMS','EMAIL'],                  'ANY',        'ALLOW', FALSE, NULL),
    ('CONTROLLER_ASSIGNED',        'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','SMS','EMAIL'],  'CONTROLLER', 'BLOCK', FALSE, NULL),
    ('CONTROLLER_UNASSIGNED',      'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','SMS','EMAIL'],  'CONTROLLER', 'BLOCK', FALSE, NULL),
    -- 11.2 : canal EMAIL seul ajouté (G.50 : optionnels réglables qui ont le push)
    ('EVENT_SUSPENDED_HOLDER',     'OPTIONAL',  'EVENT_UPDATES', ARRAY['IN_APP','PUSH','EMAIL'],        'CLIENT',     'BLOCK', FALSE, NULL),
    ('EVENT_REACTIVATED_HOLDER',   'OPTIONAL',  'EVENT_UPDATES', ARRAY['IN_APP','PUSH','EMAIL'],        'CLIENT',     'BLOCK', FALSE, NULL),
    ('REMINDER_H3',                'OPTIONAL',  'REMINDERS',     ARRAY['IN_APP','PUSH','SMS','EMAIL'],  'CLIENT',     'BLOCK', FALSE, NULL),
    ('CONTROLLER_REMINDER',        'OPTIONAL',  'REMINDERS',     ARRAY['IN_APP','PUSH','SMS','EMAIL'],  'CONTROLLER', 'BLOCK', FALSE, NULL),
    -- 11.2 : canal EMAIL seul ajouté (G.49 : indispensables non synchrones adressés à un compte)
    ('TRANSFER_OFFERED',           'ESSENTIAL', NULL,            ARRAY['SMS','IN_APP','PUSH','EMAIL'],  'CLIENT',     'BLOCK', FALSE, NULL),
    ('TRANSFER_CANCELLED',         'ESSENTIAL', NULL,            ARRAY['SMS','IN_APP','PUSH','EMAIL'],  'CLIENT',     'BLOCK', FALSE, NULL),
    ('TRANSFER_EXPIRED',           'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','EMAIL'],        'CLIENT',     'BLOCK', FALSE, NULL),
    ('TRANSFER_CLAIMED_SENDER',    'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','EMAIL'],        'CLIENT',     'BLOCK', FALSE, NULL),
    ('REFUND_REQUESTED',           'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'CLIENT',     'ALLOW', FALSE, NULL),
    ('EVENT_PUBLISHED_BY_ADMIN',   'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','EMAIL'],        'PARTNER',    'BLOCK', FALSE, NULL),
    ('SHIFT_DISCREPANCY',          'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','PUSH','EMAIL'],  'PARTNER',    'ALLOW', FALSE, NULL),
    ('SUBSCRIPTION_ACTIVATED',     'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'PARTNER',    'ALLOW', FALSE, NULL),
    ('PROMOTION_DECIDED',          'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'PARTNER',    'BLOCK', FALSE, NULL),
    ('HALL_RESERVATION_REQUESTED', 'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'PARTNER',    'BLOCK', FALSE, NULL),
    ('WITHDRAWAL_UNCERTAIN',       'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','PUSH','EMAIL'],  'ANY',        'ALLOW', FALSE, NULL),
    ('PAYMENT_SUCCESS',            'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'CLIENT',     'ALLOW', FALSE, NULL),
    ('HALL_RESERVATION_CONFIRMED', 'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'CLIENT',     'BLOCK', FALSE, NULL),
    ('HALL_RESERVATION_CANCELLED', 'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'ANY',        'BLOCK', FALSE, NULL),
    ('SHIFT_CLOSED_BY_OTHER',      'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','EMAIL'],        'CONTROLLER', 'ALLOW', FALSE, NULL),
    ('CONTROLLER_ACTIVATED',       'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL'],         'CONTROLLER', 'BLOCK', FALSE, NULL),
    ('ADMIN_NOTIFICATION_FAILED',  'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'ADMIN',      'BLOCK', FALSE, 'notifications.read'),
    ('ADMIN_SMS_CAP_GLOBAL',       'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'ADMIN',      'BLOCK', FALSE, 'notifications.read'),
    ('ADMIN_SMS_CAP_NON_OTP',      'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'ADMIN',      'BLOCK', FALSE, 'notifications.read')
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;


-- ----------------------------------------------------------------------------
-- 3. Reprise : changements en attente reclassés indispensables (R14 ; la réservation lit la famille de la ligne)
-- ----------------------------------------------------------------------------
UPDATE public.notification_outbox
   SET family = 'ESSENTIAL', topic = NULL
 WHERE type = 'EVENT_CHANGED' AND status = 'PENDING'
   AND (family IS DISTINCT FROM 'ESSENTIAL' OR topic IS NOT NULL);
