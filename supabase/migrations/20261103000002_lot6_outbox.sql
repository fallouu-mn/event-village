-- ============================================================================
-- EVENT VILLAGE — LOT 6, TÂCHE 6.1 : boîte d'envoi unique (outbox transactionnelle)
-- (contrat B1, F1 premier temps, C1 à C6, D, E1 à E3, H2)
-- ============================================================================
-- B1  — users.phone_verified_at (seule preuve de possession du numéro) ; ticket_transfers.claim_token_hash
--       devient facultatif (le transfert ne passe plus par un jeton).
-- F1  — premier temps : notifications.channel devient un texte (les écrivains du lot 5 écrivent encore
--       'PUSH'::notification_channel_enum, accepté par la conversion d'affectation vers text ; le marquage
--       écrit déjà 'IN_APP'). Le second temps (données, CHECK, RLS d'écriture) est dans 20261103000007.
-- C1  — registre public.notification_types : routage SQL (famille, sujet, canaux, audience, politique
--       « compte suspendu », journal synchrone, permission admin). Les textes vivent dans
--       lib/notifications/catalog.ts ; un test impose l'égalité des deux listes.
-- C2  — public.notification_outbox : une ligne par canal et par destinataire, clé d'idempotence UNIQUE,
--       statuts PENDING, SENDING, SENT, FAILED, SKIPPED, CANCELLED, UNCERTAIN ; garde des statuts (NT409)
--       valable pour le service_role ; jamais publiée en temps réel ; service_role seul.
-- C5  — préférences (absence de ligne = activé) et abonnements push (plusieurs appareils par compte).
-- C6  — admin_signals : nouveaux types, un seul signal par objet pour eux.
-- D   — fonctions communes : notif_enqueue (mise en file dans la transaction de l'appelant),
--       notif_enqueue_admins, notification_sync_log (journal OTP et invitation, jamais le code),
--       notification_admin_alert, ticket_transfer_identity (amendement 2 : numéro seulement).
-- E1-3 — l'envoyeur unique : réservation par lots (FOR UPDATE SKIP LOCKED) avec revérification et
--       instantané de décision, marquage par jeton (relances 1, 5, 15, 60 min, 5 tentatives, alerte
--       admin), contrôle quotidien du volume de SMS.
-- H2  — préférences (lecture, écriture) et bouton d'essai du push (mise en file seulement).
--
-- Horloge (Conventions) : seules notif_enqueue, notification_outbox_claim, notification_outbox_mark et
-- notification_daily_checks acceptent p.now ; toute heure de plus d'une minute dans le passé est refusée.
-- Toute heure de décision (claimed_at, sent_at, finished_at, next_attempt_at, decision.at) est l'horloge de
-- l'envoyeur (v_now), jamais clock_timestamp().
-- Privilèges (règle 1A.3) : chaque fonction, triggers compris, SECURITY DEFINER, search_path = public,
-- REVOKE ALL FROM PUBLIC, anon, authenticated puis GRANT EXECUTE TO service_role.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- B1 — comptes et transferts
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
COMMENT ON COLUMN public.users.phone_verified_at IS
    'Lot 6 : date de la première vérification par code SMS du numéro du compte (verify-otp, activation contrôleur). Seule preuve de possession du numéro.';

ALTER TABLE public.ticket_transfers ALTER COLUMN claim_token_hash DROP NOT NULL;
COMMENT ON COLUMN public.ticket_transfers.claim_token_hash IS
    'Lot 6 : facultatif. Le transfert ne passe plus par un lien à jeton (le destinataire se connecte avec le numéro visé) ; les anciens hachés restent, inutilisés.';


-- ----------------------------------------------------------------------------
-- F1 (premier temps) — notifications.channel en texte
-- ----------------------------------------------------------------------------
ALTER TABLE public.notifications ALTER COLUMN channel DROP DEFAULT;
ALTER TABLE public.notifications ALTER COLUMN channel TYPE TEXT USING channel::text;


-- ----------------------------------------------------------------------------
-- C1 — registre des types
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_types (
    type             TEXT PRIMARY KEY CHECK (type ~ '^[A-Z][A-Z0-9_]+$'),
    family           TEXT NOT NULL CHECK (family IN ('ESSENTIAL', 'OPTIONAL')),
    topic            TEXT CHECK (topic IN ('REMINDERS', 'EVENT_UPDATES', 'PRO_ACTIVITY')),
    channels         TEXT[] NOT NULL CHECK (cardinality(channels) > 0 AND channels <@ ARRAY['IN_APP', 'SMS', 'EMAIL', 'PUSH']),
    audience         TEXT NOT NULL CHECK (audience IN ('CLIENT', 'PARTNER', 'CONTROLLER', 'ADMIN', 'ANY')),
    suspended_policy TEXT NOT NULL DEFAULT 'BLOCK' CHECK (suspended_policy IN ('BLOCK', 'ALLOW')),
    sync_only        BOOLEAN NOT NULL DEFAULT FALSE,
    admin_permission TEXT,
    CONSTRAINT notification_types_topic_family_chk CHECK ((family = 'OPTIONAL') = (topic IS NOT NULL)),
    CONSTRAINT notification_types_admin_permission_chk CHECK ((audience = 'ADMIN') OR admin_permission IS NULL)
);
COMMENT ON TABLE public.notification_types IS
    'Lot 6 (C1) : registre des types de notification (routage SQL). Les textes sont dans lib/notifications/catalog.ts ; égalité des deux listes imposée par tests/parcours/notif-modeles.test.ts. sync_only : OTP et invitation, journal seulement, jamais réservés par l''envoyeur.';
ALTER TABLE public.notification_types ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notification_types FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.notification_types FROM service_role;
GRANT SELECT ON TABLE public.notification_types TO service_role;

-- Table G2 du contrat (amendement 2 : plus d'EMAIL pour TRANSFER_OFFERED et TRANSFER_CANCELLED).
INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('PURCHASE_CONFIRMED',         'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL'],         'CLIENT',     'ALLOW', FALSE, NULL),
    ('FREE_TICKETS_CONFIRMED',     'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL'],         'CLIENT',     'BLOCK', FALSE, NULL),
    ('COUNTER_RECEIPT',            'ESSENTIAL', NULL,            ARRAY['SMS'],                          'ANY',        'ALLOW', FALSE, NULL),
    ('TRANSFER_OFFERED',           'ESSENTIAL', NULL,            ARRAY['SMS','IN_APP','PUSH'],          'CLIENT',     'BLOCK', FALSE, NULL),
    ('TRANSFER_CANCELLED',         'ESSENTIAL', NULL,            ARRAY['SMS','IN_APP','PUSH'],          'CLIENT',     'BLOCK', FALSE, NULL),
    ('TRANSFER_EXPIRED',           'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH'],                'CLIENT',     'BLOCK', FALSE, NULL),
    ('TRANSFER_CLAIMED_SENDER',    'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH'],                'CLIENT',     'BLOCK', FALSE, NULL),
    ('TRANSFER_RECEIVED',          'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH'],                'CLIENT',     'BLOCK', FALSE, NULL),
    ('TICKET_SCANNED',             'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH'],                'CLIENT',     'BLOCK', FALSE, NULL),
    ('EVENT_CANCELLED',            'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL','PUSH'],  'CLIENT',     'ALLOW', FALSE, NULL),
    ('EVENT_SUSPENDED_HOLDER',     'OPTIONAL',  'EVENT_UPDATES', ARRAY['IN_APP','PUSH'],                'CLIENT',     'BLOCK', FALSE, NULL),
    ('EVENT_REACTIVATED_HOLDER',   'OPTIONAL',  'EVENT_UPDATES', ARRAY['IN_APP','PUSH'],                'CLIENT',     'BLOCK', FALSE, NULL),
    ('EVENT_CHANGED',              'OPTIONAL',  'EVENT_UPDATES', ARRAY['IN_APP','PUSH','SMS'],          'CLIENT',     'BLOCK', FALSE, NULL),
    ('REMINDER_J1',                'OPTIONAL',  'REMINDERS',     ARRAY['IN_APP','PUSH','SMS','EMAIL'],  'CLIENT',     'BLOCK', FALSE, NULL),
    ('REMINDER_H3',                'OPTIONAL',  'REMINDERS',     ARRAY['IN_APP','PUSH','SMS'],          'CLIENT',     'BLOCK', FALSE, NULL),
    ('REFUND_REQUESTED',           'ESSENTIAL', NULL,            ARRAY['IN_APP'],                       'CLIENT',     'ALLOW', FALSE, NULL),
    ('REFUND_PAID',                'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL','PUSH'],  'CLIENT',     'ALLOW', FALSE, NULL),
    ('PASSWORD_CHANGED',           'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL'],         'ANY',        'BLOCK', FALSE, NULL),
    ('PUSH_TEST',                  'ESSENTIAL', NULL,            ARRAY['PUSH'],                         'ANY',        'BLOCK', FALSE, NULL),
    ('EVENT_VALIDATED',            'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL','PUSH'],  'PARTNER',    'BLOCK', FALSE, NULL),
    ('EVENT_REJECTED',             'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL','PUSH'],  'PARTNER',    'BLOCK', FALSE, NULL),
    ('EVENT_SUSPENDED',            'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL','PUSH'],  'PARTNER',    'BLOCK', FALSE, NULL),
    ('EVENT_REACTIVATED',          'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL','PUSH'],  'PARTNER',    'BLOCK', FALSE, NULL),
    ('EVENT_PUBLISHED_BY_ADMIN',   'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH'],                'PARTNER',    'BLOCK', FALSE, NULL),
    ('FIRST_TICKET_SOLD',          'OPTIONAL',  'PRO_ACTIVITY',  ARRAY['IN_APP','PUSH','SMS','EMAIL'],  'PARTNER',    'BLOCK', FALSE, NULL),
    ('NEW_ORDER',                  'OPTIONAL',  'PRO_ACTIVITY',  ARRAY['IN_APP'],                       'PARTNER',    'BLOCK', FALSE, NULL),
    ('CATEGORY_SOLD_OUT',          'OPTIONAL',  'PRO_ACTIVITY',  ARRAY['IN_APP','PUSH','SMS','EMAIL'],  'PARTNER',    'BLOCK', FALSE, NULL),
    ('EVENT_SOLD_OUT',             'OPTIONAL',  'PRO_ACTIVITY',  ARRAY['IN_APP','PUSH','SMS','EMAIL'],  'PARTNER',    'BLOCK', FALSE, NULL),
    ('SHIFT_DISCREPANCY',          'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','PUSH'],          'PARTNER',    'ALLOW', FALSE, NULL),
    ('WITHDRAWAL_PAID',            'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL','PUSH'],  'ANY',        'ALLOW', FALSE, NULL),
    ('WITHDRAWAL_REJECTED',        'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL','PUSH'],  'ANY',        'ALLOW', FALSE, NULL),
    ('WITHDRAWAL_UNCERTAIN',       'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','PUSH'],          'ANY',        'ALLOW', FALSE, NULL),
    ('CANCEL_REFUNDS_DONE',        'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL','PUSH'],        'PARTNER',    'ALLOW', FALSE, NULL),
    ('CANCEL_REFUNDS_BLOCKED',     'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL','PUSH'],        'PARTNER',    'ALLOW', FALSE, NULL),
    ('PARTNER_REGISTERED_ACK',     'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'PARTNER',    'BLOCK', FALSE, NULL),
    ('PARTNER_VALIDATED',          'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL'],         'PARTNER',    'BLOCK', FALSE, NULL),
    ('PARTNER_REJECTED',           'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL'],         'PARTNER',    'BLOCK', FALSE, NULL),
    ('PARTNER_SUSPENDED',          'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL'],         'PARTNER',    'ALLOW', FALSE, NULL),
    ('PARTNER_REACTIVATED',        'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL'],         'PARTNER',    'BLOCK', FALSE, NULL),
    ('TRIAL_STARTED',              'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS'],                 'PARTNER',    'BLOCK', FALSE, NULL),
    ('SUBSCRIPTION_ACTIVATED',     'ESSENTIAL', NULL,            ARRAY['IN_APP'],                       'PARTNER',    'ALLOW', FALSE, NULL),
    ('PAYMENT_SUCCESS',            'ESSENTIAL', NULL,            ARRAY['IN_APP'],                       'CLIENT',     'ALLOW', FALSE, NULL),
    ('HALL_RESERVATION_REQUESTED', 'ESSENTIAL', NULL,            ARRAY['IN_APP'],                       'PARTNER',    'BLOCK', FALSE, NULL),
    ('HALL_RESERVATION_CONFIRMED', 'ESSENTIAL', NULL,            ARRAY['IN_APP'],                       'CLIENT',     'BLOCK', FALSE, NULL),
    ('HALL_RESERVATION_CANCELLED', 'ESSENTIAL', NULL,            ARRAY['IN_APP'],                       'ANY',        'BLOCK', FALSE, NULL),
    ('PROMOTION_DECIDED',          'ESSENTIAL', NULL,            ARRAY['IN_APP'],                       'PARTNER',    'BLOCK', FALSE, NULL),
    ('CONTROLLER_ASSIGNED',        'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','SMS'],          'CONTROLLER', 'BLOCK', FALSE, NULL),
    ('CONTROLLER_UNASSIGNED',      'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','SMS'],          'CONTROLLER', 'BLOCK', FALSE, NULL),
    ('CONTROLLER_REMINDER',        'OPTIONAL',  'REMINDERS',     ARRAY['IN_APP','PUSH','SMS'],          'CONTROLLER', 'BLOCK', FALSE, NULL),
    ('SHIFT_CLOSED_BY_OTHER',      'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH'],                'CONTROLLER', 'ALLOW', FALSE, NULL),
    ('CONTROLLER_ACTIVATED',       'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS'],                 'CONTROLLER', 'BLOCK', FALSE, NULL),
    ('ADMIN_EVENT_SUBMITTED',      'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','EMAIL'],        'ADMIN',      'BLOCK', FALSE, 'events.read'),
    ('ADMIN_PARTNER_REGISTERED',   'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','EMAIL'],        'ADMIN',      'BLOCK', FALSE, 'partners.read'),
    ('ADMIN_REFUND_TO_RETRY',      'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','EMAIL'],        'ADMIN',      'BLOCK', FALSE, 'refunds.manage'),
    ('ADMIN_CASHOUT_UNCERTAIN',    'ESSENTIAL', NULL,            ARRAY['IN_APP','PUSH','EMAIL'],        'ADMIN',      'BLOCK', FALSE, 'refunds.manage'),
    ('ADMIN_WITHDRAWAL_REJECTED',  'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'ADMIN',      'BLOCK', FALSE, 'refunds.manage'),
    ('ADMIN_FINANCE_DEBT',         'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'ADMIN',      'BLOCK', FALSE, 'payments.read'),
    ('ADMIN_NOTIFICATION_FAILED',  'ESSENTIAL', NULL,            ARRAY['IN_APP'],                       'ADMIN',      'BLOCK', FALSE, 'notifications.read'),
    ('ADMIN_SMS_DAILY_THRESHOLD',  'ESSENTIAL', NULL,            ARRAY['IN_APP','EMAIL'],               'ADMIN',      'BLOCK', FALSE, 'notifications.read'),
    ('ADMIN_SMS_CAP_GLOBAL',       'ESSENTIAL', NULL,            ARRAY['IN_APP'],                       'ADMIN',      'BLOCK', FALSE, 'notifications.read'),
    ('ADMIN_SMS_CAP_NON_OTP',      'ESSENTIAL', NULL,            ARRAY['IN_APP'],                       'ADMIN',      'BLOCK', FALSE, 'notifications.read'),
    ('OTP_LOGIN',                  'ESSENTIAL', NULL,            ARRAY['SMS'],                          'ANY',        'ALLOW', TRUE,  NULL),
    ('OTP_REGISTER',               'ESSENTIAL', NULL,            ARRAY['SMS'],                          'ANY',        'ALLOW', TRUE,  NULL),
    ('OTP_PASSWORD_RESET',         'ESSENTIAL', NULL,            ARRAY['SMS'],                          'ANY',        'ALLOW', TRUE,  NULL),
    ('OTP_WITHDRAWAL',             'ESSENTIAL', NULL,            ARRAY['SMS'],                          'ANY',        'ALLOW', TRUE,  NULL),
    ('OTP_AUTH_HOOK',              'ESSENTIAL', NULL,            ARRAY['SMS'],                          'ANY',        'ALLOW', TRUE,  NULL),
    ('CONTROLLER_INVITE',          'ESSENTIAL', NULL,            ARRAY['SMS'],                          'ANY',        'ALLOW', TRUE,  NULL)
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission;


-- ----------------------------------------------------------------------------
-- C2 — boîte d'envoi
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_outbox (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key     TEXT NOT NULL,
    group_key           TEXT NOT NULL,
    type                TEXT NOT NULL REFERENCES public.notification_types(type),
    family              TEXT NOT NULL CHECK (family IN ('ESSENTIAL', 'OPTIONAL')),
    topic               TEXT,
    channel             TEXT NOT NULL CHECK (channel IN ('IN_APP', 'SMS', 'EMAIL', 'PUSH')),
    origin              TEXT NOT NULL DEFAULT 'OUTBOX' CHECK (origin IN ('OUTBOX', 'SYNC_LOG')),
    recipient_user_id   UUID REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_phone     TEXT CHECK (recipient_phone IS NULL OR recipient_phone ~ '^\+221[0-9]{9}$'),
    recipient_email     TEXT CHECK (recipient_email IS NULL OR (char_length(recipient_email) <= 254 AND position('@' IN recipient_email) > 1)),
    event_id            UUID REFERENCES public.events(id) ON DELETE SET NULL,
    actor_id            UUID REFERENCES public.users(id) ON DELETE SET NULL,
    shift_id            UUID REFERENCES public.controller_shifts(id) ON DELETE SET NULL,
    template_data       JSONB NOT NULL DEFAULT '{}'::jsonb,
    status              TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED', 'CANCELLED', 'UNCERTAIN')),
    reason              TEXT,
    reason_detail       TEXT CHECK (reason_detail IS NULL OR char_length(reason_detail) <= 500),
    attempts            INTEGER NOT NULL DEFAULT 0,
    max_attempts        INTEGER NOT NULL DEFAULT 5,
    due_at              TIMESTAMPTZ NOT NULL,
    next_attempt_at     TIMESTAMPTZ NOT NULL,
    claimed_at          TIMESTAMPTZ,
    claim_token         UUID,
    sent_at             TIMESTAMPTZ,
    finished_at         TIMESTAMPTZ,
    provider_message_id TEXT,
    notification_id     UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
    decision            JSONB,
    manual_retries      INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT notification_outbox_idempotency_key_key UNIQUE (idempotency_key),
    CONSTRAINT notification_outbox_recipient_chk CHECK (recipient_user_id IS NOT NULL OR recipient_phone IS NOT NULL OR recipient_email IS NOT NULL),
    CONSTRAINT notification_outbox_user_channel_chk CHECK (channel NOT IN ('IN_APP', 'PUSH') OR recipient_user_id IS NOT NULL),
    CONSTRAINT notification_outbox_attempts_chk CHECK (max_attempts BETWEEN 1 AND 5 AND attempts BETWEEN 0 AND max_attempts),
    CONSTRAINT notification_outbox_reason_chk CHECK (status IN ('PENDING', 'SENDING', 'SENT') OR (reason IS NOT NULL AND btrim(reason) <> '')),
    CONSTRAINT notification_outbox_sending_chk CHECK (status <> 'SENDING' OR (claimed_at IS NOT NULL AND claim_token IS NOT NULL)),
    CONSTRAINT notification_outbox_sent_chk CHECK (status <> 'SENT' OR sent_at IS NOT NULL),
    CONSTRAINT notification_outbox_sync_chk CHECK (origin <> 'SYNC_LOG' OR status IN ('SENT', 'FAILED', 'UNCERTAIN', 'SKIPPED')),
    CONSTRAINT notification_outbox_no_secret_chk CHECK (NOT (template_data ?| ARRAY['code', 'otp', 'otp_code', 'token', 'claim_token', 'claim_url', 'password', 'secret', 'pin', 'qr_code', 'totp_secret']))
);
COMMENT ON TABLE public.notification_outbox IS
    'Lot 6 (C2) : boîte d''envoi unique. Une ligne par canal et par destinataire, écrite dans la transaction de l''action métier (notif_enqueue) ; un seul envoyeur (notification_outbox_claim / _mark). Jamais publiée en temps réel ; service_role seul.';
COMMENT ON COLUMN public.notification_outbox.decision IS
    'Lot 6 (C3) : instantané de décision écrit à l''insertion (SKIPPED) ou à la réservation, complété par le marquage (delivery) : préférence, compte, événement, porteur, plage de silence. Base des invariants (m)(n)(o).';

CREATE INDEX IF NOT EXISTS idx_outbox_due        ON public.notification_outbox (next_attempt_at) WHERE status = 'PENDING' AND origin = 'OUTBOX';
CREATE INDEX IF NOT EXISTS idx_outbox_sending    ON public.notification_outbox (claimed_at)      WHERE status = 'SENDING';
CREATE INDEX IF NOT EXISTS idx_outbox_event      ON public.notification_outbox (event_id, type, status);
CREATE INDEX IF NOT EXISTS idx_outbox_recipient  ON public.notification_outbox (recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbox_group      ON public.notification_outbox (group_key);
CREATE INDEX IF NOT EXISTS idx_outbox_stats      ON public.notification_outbox (channel, status, sent_at);
CREATE INDEX IF NOT EXISTS idx_outbox_admin_list ON public.notification_outbox (created_at DESC, id DESC);
-- Lot 5 conservé : un seul SMS de changement en attente par porteur et par événement (regroupement)
CREATE UNIQUE INDEX IF NOT EXISTS uq_outbox_event_change_pending_sms ON public.notification_outbox (event_id, recipient_user_id)
    WHERE type = 'EVENT_CHANGED' AND channel = 'SMS' AND status = 'PENDING';

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;   -- aucune politique : service_role seul
REVOKE ALL ON TABLE public.notification_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.notification_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.notification_outbox_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- Garde des statuts, valable pour le service_role : une ligne terminée (SENT, SKIPPED, CANCELLED,
-- UNCERTAIN) ne change plus de statut, de clé ni de destinataire ; une ligne FAILED ne repart (PENDING)
-- que par la relance manuelle (GUC de transaction notif.manual_retry = on, posée par notification_retry).
CREATE OR REPLACE FUNCTION public.notification_outbox_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status IN ('SENT', 'SKIPPED', 'CANCELLED', 'UNCERTAIN', 'FAILED') THEN
        IF NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
           OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id
           OR NEW.recipient_phone IS DISTINCT FROM OLD.recipient_phone
           OR NEW.recipient_email IS DISTINCT FROM OLD.recipient_email THEN
            RAISE EXCEPTION USING ERRCODE = 'NT409', MESSAGE = 'Une notification terminée ne change plus.';
        END IF;
    END IF;
    IF OLD.status IN ('SENT', 'SKIPPED', 'CANCELLED', 'UNCERTAIN') AND NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION USING ERRCODE = 'NT409', MESSAGE = 'Une notification terminée ne change plus.';
    END IF;
    IF OLD.status = 'FAILED' AND NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status <> 'PENDING' OR COALESCE(current_setting('notif.manual_retry', true), '') <> 'on' THEN
            RAISE EXCEPTION USING ERRCODE = 'NT409',
                MESSAGE = 'Une notification en échec ne repart que par une relance manuelle.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_outbox_updated_at ON public.notification_outbox;
CREATE TRIGGER trg_notification_outbox_updated_at
    BEFORE UPDATE ON public.notification_outbox
    FOR EACH ROW EXECUTE FUNCTION public.notification_outbox_set_updated_at();

DROP TRIGGER IF EXISTS trg_notification_outbox_guard ON public.notification_outbox;
CREATE TRIGGER trg_notification_outbox_guard
    BEFORE UPDATE ON public.notification_outbox
    FOR EACH ROW EXECUTE FUNCTION public.notification_outbox_guard();


-- ----------------------------------------------------------------------------
-- C5 — préférences et abonnements push
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    topic      TEXT NOT NULL CHECK (topic IN ('REMINDERS', 'EVENT_UPDATES', 'PRO_ACTIVITY')),
    channel    TEXT NOT NULL CHECK (channel IN ('IN_APP', 'SMS', 'EMAIL', 'PUSH')),
    enabled    BOOLEAN NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, topic, channel)
);
COMMENT ON TABLE public.notification_preferences IS
    'Lot 6 (C5) : préférences des notifications optionnelles, par sujet et par canal. Absence de ligne = activé. Les indispensables ne se désactivent pas.';
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notification_preferences FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.notification_preferences TO service_role;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint        TEXT NOT NULL UNIQUE CHECK (char_length(endpoint) <= 2048 AND endpoint ~ '^https?://'),
    p256dh          TEXT NOT NULL CHECK (p256dh ~ '^[A-Za-z0-9_-]{87}$'),
    auth            TEXT NOT NULL CHECK (auth ~ '^[A-Za-z0-9_-]{22}$'),
    vapid_key_id    TEXT NOT NULL CHECK (vapid_key_id ~ '^[A-Za-z0-9_-]{16}$'),
    user_agent      TEXT CHECK (user_agent IS NULL OR char_length(user_agent) <= 200),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    failure_count   INTEGER NOT NULL DEFAULT 0
);
COMMENT ON TABLE public.push_subscriptions IS
    'Lot 6 (C5) : abonnements push web (plusieurs appareils par compte, endpoint unique réattribué au dernier compte inscrit). Supprimés sur 404 ou 410 du service push, ou si la clé VAPID a changé.';
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions (user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;


-- ----------------------------------------------------------------------------
-- C6 — admin_signals (lot 5) : nouveaux types, un seul signal par objet pour eux
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_signals DROP CONSTRAINT IF EXISTS admin_signals_kind_check;
ALTER TABLE public.admin_signals ADD CONSTRAINT admin_signals_kind_check
    CHECK (kind IN ('EVENT_SUBMITTED', 'PARTNER_REGISTERED', 'NOTIFICATION_FAILED', 'SMS_DAILY_THRESHOLD', 'CASHOUT_UNCERTAIN', 'REFUND_TO_RETRY'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_signals_lot6 ON public.admin_signals (kind, ref_id)
    WHERE kind IN ('NOTIFICATION_FAILED', 'SMS_DAILY_THRESHOLD', 'CASHOUT_UNCERTAIN', 'REFUND_TO_RETRY');


-- ----------------------------------------------------------------------------
-- D — fonctions communes (internes)
-- ----------------------------------------------------------------------------

-- Début d'un événement à l'heure de Dakar (pendant d'event_end_at).
CREATE OR REPLACE FUNCTION public.event_start_at(p_event uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT ((e.start_date + e.start_time) AT TIME ZONE 'Africa/Dakar')
      FROM public.events e WHERE e.id = p_event
$$;

-- Plage de silence des SMS optionnels (heure de Dakar) : début = fin → aucune plage ; début < fin → plage
-- dans la journée ; sinon la plage passe minuit.
CREATE OR REPLACE FUNCTION public.notif_in_quiet_hours(p_at timestamptz, p_start integer, p_end integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE
        WHEN p_start = p_end THEN false
        WHEN p_start < p_end THEN h >= p_start AND h < p_end
        ELSE h >= p_start OR h < p_end
    END
      FROM (SELECT extract(hour FROM (p_at AT TIME ZONE 'Africa/Dakar'))::integer AS h) x
$$;

-- Réglage entier de platform_settings ({"value": n}) : NULL si la clé manque ou si la valeur n'est pas un
-- entier. Jamais de défaut caché : l'appelant écrit SETTING_MISSING.
CREATE OR REPLACE FUNCTION public.notif_setting_int(p_key text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    -- CASE imbriqués : la conversion numérique n'est évaluée que pour une valeur JSON numérique (l'ordre
    -- d'évaluation d'un AND n'est pas garanti).
    SELECT CASE WHEN jsonb_typeof(s.value -> 'value') = 'number' THEN
               CASE WHEN (s.value ->> 'value')::numeric = trunc((s.value ->> 'value')::numeric)
                     AND abs((s.value ->> 'value')::numeric) <= 2147483647
                    THEN (s.value ->> 'value')::numeric::integer
               END
           END
      FROM public.platform_settings s WHERE s.key = p_key
$$;

-- Compte bloqué pour les envois : SUSPENDU, SUPPRIME, ou partenaire du compte SUSPENDU (pas « <> ACTIF » :
-- un compte EN_ATTENTE reçoit ses messages).
CREATE OR REPLACE FUNCTION public.notif_account_blocked(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((SELECT u.status::text IN ('SUSPENDU', 'SUPPRIME') FROM public.users u WHERE u.id = p_user), false)
        OR EXISTS (SELECT 1 FROM public.partners pa WHERE pa.user_id = p_user AND pa.status::text = 'SUSPENDU')
$$;

-- Préférence d'un sujet optionnel sur un canal : activée sans ligne.
CREATE OR REPLACE FUNCTION public.notif_preference_enabled(p_user uuid, p_topic text, p_channel text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((SELECT np.enabled FROM public.notification_preferences np
                      WHERE np.user_id = p_user AND np.topic = p_topic AND np.channel = p_channel), TRUE)
$$;

-- Destinataires admin : comptes ACTIF avec SUPERADMIN dans user_roles, ou ADMIN avec la permission (NULL :
-- tout ADMIN). Seule source des destinataires admin (users.role n'est plus lu).
CREATE OR REPLACE FUNCTION public.notif_admin_recipients(p_permission text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id
      FROM public.users u
     WHERE u.status::text = 'ACTIF'
       AND (
            EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role::text = 'SUPERADMIN')
         OR (
            EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role::text = 'ADMIN')
            AND (p_permission IS NULL
                 OR EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = u.id AND ap.permission = p_permission))
         )
       )
     ORDER BY u.id
$$;

-- Lecture d'un horodatage saisi dans des données (template_data) : NULL si illisible, jamais d'exception
-- (une donnée mal formée ne bloque pas la réservation des autres lignes).
CREATE OR REPLACE FUNCTION public.notif_try_timestamptz(p_value text)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_value IS NULL OR btrim(p_value) = '' THEN
        RETURN NULL;
    END IF;
    RETURN p_value::timestamptz;
EXCEPTION
    WHEN data_exception THEN
        RETURN NULL;   -- donnée illisible : l'appelant décide explicitement (rappel annulé EVENT_RESCHEDULED)
END;
$$;

-- Règle d'identité du transfert (B2, amendement 2) : la cible est un numéro normalisé ; le compte ACTIF dont
-- users.phone est la cible et dont le numéro est vérifié par code → MATCH ; numéro non vérifié →
-- PHONE_NOT_VERIFIED ; sinon (autre compte, email, compte non actif) → NO_MATCH.
CREATE OR REPLACE FUNCTION public.ticket_transfer_identity(p_target text, p_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE
        WHEN p_target IS NULL OR p_target !~ '^\+221[0-9]{9}$' THEN 'NO_MATCH'
        WHEN NOT EXISTS (SELECT 1 FROM public.users u
                          WHERE u.id = p_user AND u.status::text = 'ACTIF' AND u.phone = p_target) THEN 'NO_MATCH'
        WHEN EXISTS (SELECT 1 FROM public.users u
                      WHERE u.id = p_user AND u.phone = p_target AND u.phone_verified_at IS NOT NULL) THEN 'MATCH'
        ELSE 'PHONE_NOT_VERIFIED'
    END
$$;

-- Mise en file dans la transaction de l'appelant (D). p = { type, key, user_id?, phone?, email?, event_id?,
-- actor_id?, shift_id?, data, due_at?, channels?, skip?, now? } ; renvoie le nombre de lignes créées.
-- Une ligne par canal du registre (∩ p.channels) ; IN_APP et PUSH seulement avec un compte. Statut initial :
-- motif fourni (skip) ; compte bloqué sous politique BLOCK → SKIPPED ACCOUNT_SUSPENDED ; optionnel et
-- préférence désactivée → SKIPPED PREFERENCE_DISABLED ; SMS sans numéro → NO_PHONE ; EMAIL sans adresse
-- réelle → NO_REAL_EMAIL ; sinon PENDING. Le numéro et l'email du compte ne sont pas recopiés (résolus à
-- l'envoi). ON CONFLICT DO NOTHING : un rejeu (rpcWithRetry) ne crée rien.
CREATE OR REPLACE FUNCTION public.notif_enqueue(p jsonb)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type      text := p->>'type';
    v_key       text := NULLIF(btrim(COALESCE(p->>'key', '')), '');
    v_family    text;
    v_topic     text;
    v_channels  text[];
    v_policy    text;
    v_sync      boolean;
    v_now       timestamptz;
    v_due       timestamptz;
    v_user      uuid := NULLIF(p->>'user_id', '')::uuid;
    v_phone     text := NULLIF(btrim(COALESCE(p->>'phone', '')), '');
    v_email     text := NULLIF(btrim(COALESCE(p->>'email', '')), '');
    v_event     uuid := NULLIF(p->>'event_id', '')::uuid;
    v_actor     uuid := NULLIF(p->>'actor_id', '')::uuid;
    v_shift     uuid := NULLIF(p->>'shift_id', '')::uuid;
    v_data      jsonb := COALESCE(p->'data', '{}'::jsonb);
    v_wanted    text[];
    v_ustatus   text;
    v_uphone    text;
    v_uemail    text;
    v_blocked   boolean := false;
    v_ch        text;
    v_status    text;
    v_reason    text;
    v_pref      boolean;
    v_decision  jsonb;
    v_mail      text;
    v_n         integer;
    v_created   integer := 0;
BEGIN
    SELECT t.family, t.topic, t.channels, t.suspended_policy, t.sync_only
      INTO v_family, v_topic, v_channels, v_policy, v_sync
      FROM public.notification_types t WHERE t.type = v_type;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'NT001', MESSAGE = format('Type de notification inconnu : %s.', COALESCE(v_type, '(vide)'));
    END IF;
    IF v_sync THEN
        RAISE EXCEPTION USING ERRCODE = 'NT002',
            MESSAGE = format('Le type %s est un envoi synchrone : il se journalise par notification_sync_log.', v_type);
    END IF;
    v_now := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    IF v_now < now() - interval '1 minute' THEN
        RAISE EXCEPTION USING ERRCODE = 'NT003', MESSAGE = 'Horloge refusée : une heure dans le passé n''est jamais acceptée.';
    END IF;
    IF v_key IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'NT004', MESSAGE = 'Clé de notification absente.';
    END IF;
    IF v_user IS NULL AND v_phone IS NULL AND v_email IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'NT004', MESSAGE = 'Destinataire de la notification absent.';
    END IF;
    v_due := COALESCE(NULLIF(p->>'due_at', '')::timestamptz, v_now);

    IF jsonb_typeof(p->'channels') = 'array' THEN
        v_wanted := ARRAY(SELECT jsonb_array_elements_text(p->'channels'));
    END IF;

    IF v_user IS NOT NULL THEN
        SELECT u.status::text, u.phone, u.email INTO v_ustatus, v_uphone, v_uemail FROM public.users u WHERE u.id = v_user;
        v_blocked := public.notif_account_blocked(v_user);
    END IF;

    FOREACH v_ch IN ARRAY v_channels LOOP
        CONTINUE WHEN v_wanted IS NOT NULL AND NOT (v_ch = ANY (v_wanted));
        CONTINUE WHEN v_ch IN ('IN_APP', 'PUSH') AND v_user IS NULL;

        v_status := 'PENDING';
        v_reason := NULL;
        v_pref := NULL;
        IF v_family = 'OPTIONAL' AND v_user IS NOT NULL THEN
            v_pref := public.notif_preference_enabled(v_user, v_topic, v_ch);
        END IF;
        v_mail := COALESCE(v_email, v_uemail);

        IF jsonb_typeof(p->'skip') = 'object' AND NULLIF(btrim(COALESCE(p->'skip'->>v_ch, '')), '') IS NOT NULL THEN
            v_status := 'SKIPPED';
            v_reason := btrim(p->'skip'->>v_ch);
        ELSIF v_blocked AND v_policy = 'BLOCK' THEN
            v_status := 'SKIPPED';
            v_reason := 'ACCOUNT_SUSPENDED';
        ELSIF v_family = 'OPTIONAL' AND v_pref IS FALSE THEN
            v_status := 'SKIPPED';
            v_reason := 'PREFERENCE_DISABLED';
        ELSIF v_ch = 'SMS' AND v_phone IS NULL AND (v_uphone IS NULL OR btrim(v_uphone) = '') THEN
            v_status := 'SKIPPED';
            v_reason := 'NO_PHONE';
        ELSIF v_ch = 'EMAIL' AND (v_mail IS NULL OR position('@' IN v_mail) <= 1 OR v_mail ~* '^[0-9]+@eventvillage\.sn$') THEN
            v_status := 'SKIPPED';
            v_reason := 'NO_REAL_EMAIL';
        END IF;

        v_decision := NULL;
        IF v_status = 'SKIPPED' THEN
            v_decision := jsonb_strip_nulls(jsonb_build_object(
                'at', v_now, 'stage', 'ENQUEUE', 'outcome', 'SKIP', 'reason', v_reason,
                'family', v_family, 'topic', v_topic,
                'account', CASE WHEN v_user IS NULL THEN NULL ELSE jsonb_build_object('status', v_ustatus, 'blocked', v_blocked) END,
                'preference', CASE WHEN v_family = 'OPTIONAL' THEN jsonb_build_object('topic', v_topic, 'channel', v_ch, 'enabled', COALESCE(v_pref, TRUE)) END
            ));
        END IF;

        INSERT INTO public.notification_outbox (
            idempotency_key, group_key, type, family, topic, channel, origin,
            recipient_user_id, recipient_phone, recipient_email, event_id, actor_id, shift_id,
            template_data, status, reason, attempts, max_attempts, due_at, next_attempt_at, finished_at, decision
        ) VALUES (
            v_key || ':' || v_ch, v_key, v_type, v_family, v_topic, v_ch, 'OUTBOX',
            v_user, v_phone, v_email, v_event, v_actor, v_shift,
            v_data, v_status, v_reason, 0, 5, v_due, v_due,
            CASE WHEN v_status = 'SKIPPED' THEN v_now END, v_decision
        )
        ON CONFLICT DO NOTHING;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_created := v_created + v_n;
    END LOOP;
    RETURN v_created;
END;
$$;

-- Mise en file pour chaque destinataire admin de la permission du type : clé type:ref:admin.
-- p = { type, ref, data, event_id?, now? }.
CREATE OR REPLACE FUNCTION public.notif_enqueue_admins(p jsonb)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type    text := p->>'type';
    v_ref     text := NULLIF(btrim(COALESCE(p->>'ref', '')), '');
    v_perm    text;
    v_admin   uuid;
    v_created integer := 0;
BEGIN
    SELECT t.admin_permission INTO v_perm FROM public.notification_types t WHERE t.type = v_type;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'NT001', MESSAGE = format('Type de notification inconnu : %s.', COALESCE(v_type, '(vide)'));
    END IF;
    IF v_ref IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'NT004', MESSAGE = 'Référence de l''alerte absente.';
    END IF;
    FOR v_admin IN SELECT x.admin_id FROM public.notif_admin_recipients(v_perm) AS x(admin_id) LOOP
        v_created := v_created + public.notif_enqueue(jsonb_strip_nulls(jsonb_build_object(
            'type', v_type,
            'key', v_type || ':' || v_ref || ':' || v_admin::text,
            'user_id', v_admin,
            'event_id', p->'event_id',
            'data', COALESCE(p->'data', '{}'::jsonb),
            'now', p->'now'
        )));
    END LOOP;
    RETURN v_created;
END;
$$;

-- Passage à FAILED d'une ligne (marquage ou reprise) : alerte ADMIN_NOTIFICATION_FAILED aux admins qui ont
-- notifications.read et signal admin_signals (un par ligne). Jamais pour l'alerte elle-même.
CREATE OR REPLACE FUNCTION public.notif_failed_alert(p_id uuid, p_type text, p_channel text, p_reason text, p_attempts integer, p_now timestamptz)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_type = 'ADMIN_NOTIFICATION_FAILED' THEN
        RETURN;
    END IF;
    PERFORM public.notif_enqueue_admins(jsonb_build_object(
        'type', 'ADMIN_NOTIFICATION_FAILED',
        'ref', p_id::text,
        'data', jsonb_build_object('outbox_id', p_id, 'failed_type', p_type, 'channel', p_channel, 'reason', p_reason, 'attempts', p_attempts),
        'now', p_now
    ));
    INSERT INTO public.admin_signals (kind, ref_id) VALUES ('NOTIFICATION_FAILED', p_id) ON CONFLICT DO NOTHING;
END;
$$;


-- ----------------------------------------------------------------------------
-- D — RPC du journal synchrone et des alertes de plafond
-- ----------------------------------------------------------------------------

-- Journal des envois synchrones (OTP, invitation d'un contrôleur) : ligne origin = SYNC_LOG, statut final,
-- template_data = { purpose } seulement (jamais le code ni le lien), clé <type>:<ref>:SMS.
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
        WHEN 'OTP_AUTH_HOOK' THEN 'AUTH_HOOK'
        WHEN 'CONTROLLER_INVITE' THEN 'CONTROLLER_SETUP'
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

-- Alerte de plafond SMS (lib/sms/sms-guard.ts, raiseCapAlert) : mise en file pour les admins, une fois par
-- jour (la clé porte le jour).
CREATE OR REPLACE FUNCTION public.notification_admin_alert(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type text := p->>'type';
    v_ref  text := p->>'ref';
    v_n    integer;
BEGIN
    IF v_type IS NULL OR v_type NOT IN ('ADMIN_SMS_CAP_GLOBAL', 'ADMIN_SMS_CAP_NON_OTP') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TYPE', 'message', 'Type d''alerte inconnu.');
    END IF;
    IF v_ref IS NULL OR v_ref !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Jour de l''alerte invalide (AAAA-MM-JJ).');
    END IF;
    v_n := public.notif_enqueue_admins(jsonb_build_object('type', v_type, 'ref', v_ref, 'data', COALESCE(p->'data', '{}'::jsonb)));
    RETURN jsonb_build_object('ok', true, 'created', v_n);
END;
$$;


-- ----------------------------------------------------------------------------
-- E1 — réservation par lots, revérification et instantané de décision
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notification_outbox_claim(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now         timestamptz;
    v_limit       integer;
    v_only_ids    uuid[];
    v_only_events uuid[];
    v_token       uuid := gen_random_uuid();
    r             record;
    v_ustatus     text;
    v_uphone      text;
    v_uemail      text;
    v_ufirst      text;
    v_blocked     boolean;
    v_pref        boolean;
    v_pref_json   jsonb;
    v_found_event boolean;
    v_estatus     text;
    v_etitle      text;
    v_eloc        text;
    v_ecity       text;
    v_estart      timestamptz;
    v_emulti      boolean;
    v_event_json  jsonb;
    v_holder      jsonb;
    v_valid       uuid[];
    v_quiet       jsonb;
    v_qs          integer;
    v_qe          integer;
    v_in_quiet    boolean;
    v_sibling     text;
    v_phone       text;
    v_email       text;
    v_outcome     text;
    v_reason      text;
    v_tpl_start   timestamptz;
    v_decision    jsonb;
    v_claimed     jsonb := '[]'::jsonb;
    n_examined    integer := 0;
    n_skipped     integer := 0;
    n_cancelled   integer := 0;
    n_waiting     integer := 0;
    n_reclaimed   integer := 0;
    n_uncertain   integer := 0;
    n_failed      integer := 0;
BEGIN
    v_now := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    IF v_now < now() - interval '1 minute' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_NOW',
            'message', 'Horloge refusée : une heure dans le passé n''est jamais acceptée.');
    END IF;
    v_limit := LEAST(GREATEST(COALESCE(NULLIF(p->>'limit', '')::integer, 100), 1), 500);
    IF jsonb_typeof(p->'only_ids') = 'array' THEN
        v_only_ids := ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(p->'only_ids') AS x);
    END IF;
    IF jsonb_typeof(p->'only_event_ids') = 'array' THEN
        v_only_events := ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(p->'only_event_ids') AS x);
    END IF;

    -- 1. Reprise des lignes SENDING de plus de 10 minutes (envoyeur interrompu). Un SMS n'est jamais
    --    renvoyé : il devient UNCERTAIN. Les autres canaux repartent (IN_APP idempotent par notification_id,
    --    EMAIL par Idempotency-Key, PUSH par tag), ou passent FAILED à la dernière tentative.
    FOR r IN
        SELECT o.id, o.type, o.channel, o.attempts, o.max_attempts, o.claimed_at
          FROM public.notification_outbox o
         WHERE o.status = 'SENDING'
           AND o.claimed_at < v_now - interval '10 minutes'
           AND (v_only_ids IS NULL OR o.id = ANY (v_only_ids))
           AND (v_only_events IS NULL OR o.event_id = ANY (v_only_events))
         ORDER BY o.claimed_at, o.id
           FOR UPDATE SKIP LOCKED
    LOOP
        n_reclaimed := n_reclaimed + 1;
        IF r.channel = 'SMS' THEN
            UPDATE public.notification_outbox
               SET status = 'UNCERTAIN', reason = 'SENDING_INTERRUPTED',
                   reason_detail = 'Envoi interrompu après la réservation : issue inconnue, jamais renvoyé automatiquement.',
                   sent_at = r.claimed_at, finished_at = v_now
             WHERE id = r.id;
            n_uncertain := n_uncertain + 1;
        ELSIF r.attempts >= r.max_attempts THEN
            UPDATE public.notification_outbox
               SET status = 'FAILED', reason = 'SENDING_INTERRUPTED',
                   reason_detail = 'Envoi interrompu à la dernière tentative.', finished_at = v_now
             WHERE id = r.id;
            PERFORM public.notif_failed_alert(r.id, r.type, r.channel, 'SENDING_INTERRUPTED', r.attempts, v_now);
            n_failed := n_failed + 1;
        ELSE
            UPDATE public.notification_outbox
               SET status = 'PENDING', next_attempt_at = v_now, claim_token = NULL
             WHERE id = r.id;
        END IF;
    END LOOP;

    -- 2. Candidats dus, IN_APP d'abord (instantané), puis PUSH, EMAIL, SMS.
    FOR r IN
        SELECT o.id, o.idempotency_key, o.group_key, o.type, o.family, o.topic, o.channel,
               o.recipient_user_id, o.recipient_phone, o.recipient_email, o.event_id, o.actor_id, o.shift_id,
               o.template_data, o.attempts, o.max_attempts, o.due_at, t.suspended_policy
          FROM public.notification_outbox o
          JOIN public.notification_types t ON t.type = o.type
         WHERE o.status = 'PENDING' AND o.origin = 'OUTBOX' AND o.next_attempt_at <= v_now
           AND (v_only_ids IS NULL OR o.id = ANY (v_only_ids))
           AND (v_only_events IS NULL OR o.event_id = ANY (v_only_events))
         ORDER BY CASE o.channel WHEN 'IN_APP' THEN 1 WHEN 'PUSH' THEN 2 WHEN 'EMAIL' THEN 3 ELSE 4 END,
                  o.next_attempt_at, o.id
         LIMIT v_limit
           FOR UPDATE OF o SKIP LOCKED
    LOOP
        n_examined := n_examined + 1;
        v_outcome := 'SEND';
        v_reason := NULL;
        v_ustatus := NULL; v_uphone := NULL; v_uemail := NULL; v_ufirst := NULL;
        v_blocked := false;
        v_pref := NULL; v_pref_json := NULL;
        v_found_event := false;
        v_estatus := NULL; v_etitle := NULL; v_eloc := NULL; v_ecity := NULL; v_estart := NULL; v_emulti := false;
        v_event_json := NULL; v_holder := NULL; v_quiet := NULL; v_sibling := NULL;
        v_phone := NULL; v_email := NULL;

        IF r.recipient_user_id IS NOT NULL THEN
            SELECT u.status::text, u.phone, u.email, u.first_name
              INTO v_ustatus, v_uphone, v_uemail, v_ufirst
              FROM public.users u WHERE u.id = r.recipient_user_id;
            v_blocked := public.notif_account_blocked(r.recipient_user_id);
        END IF;
        v_phone := COALESCE(r.recipient_phone, NULLIF(btrim(COALESCE(v_uphone, '')), ''));
        v_email := COALESCE(r.recipient_email, v_uemail);

        IF r.family = 'OPTIONAL' THEN
            IF r.recipient_user_id IS NULL THEN
                v_pref := TRUE;
            ELSE
                v_pref := public.notif_preference_enabled(r.recipient_user_id, r.topic, r.channel);
            END IF;
            v_pref_json := jsonb_build_object('topic', r.topic, 'channel', r.channel, 'enabled', v_pref);
        END IF;

        IF r.event_id IS NOT NULL THEN
            SELECT e.status::text, e.title, e.location, e.city, public.event_start_at(e.id),
                   (e.end_date IS NOT NULL AND e.end_date > e.start_date)
              INTO v_estatus, v_etitle, v_eloc, v_ecity, v_estart, v_emulti
              FROM public.events e WHERE e.id = r.event_id;
            v_found_event := FOUND;
            IF v_found_event THEN
                v_event_json := jsonb_build_object('id', r.event_id, 'status', v_estatus, 'start_at', v_estart);
            END IF;
        END IF;

        -- Revérification : premier cas vrai.
        IF v_blocked AND r.suspended_policy = 'BLOCK' THEN
            v_outcome := 'SKIP'; v_reason := 'ACCOUNT_SUSPENDED';
        ELSIF r.family = 'OPTIONAL' AND v_pref IS FALSE THEN
            v_outcome := 'SKIP'; v_reason := 'PREFERENCE_DISABLED';
        END IF;

        IF v_outcome = 'SEND' AND r.type IN ('REMINDER_J1', 'REMINDER_H3', 'CONTROLLER_REMINDER') THEN
            v_tpl_start := public.notif_try_timestamptz(r.template_data->>'start_at');
            IF r.type = 'CONTROLLER_REMINDER'
               AND NOT EXISTS (SELECT 1 FROM public.event_controllers ec
                                WHERE ec.id::text = r.template_data->>'assignment_id'
                                  AND ec.user_id = r.recipient_user_id
                                  AND ec.event_id = r.event_id) THEN
                v_outcome := 'CANCEL'; v_reason := 'NO_LONGER_ASSIGNED';
            ELSIF NOT v_found_event OR v_estatus <> 'PUBLIE' THEN
                v_outcome := 'CANCEL'; v_reason := 'EVENT_NOT_PUBLISHED';
            ELSIF r.template_data ? 'start_at' AND v_tpl_start IS DISTINCT FROM v_estart THEN
                v_outcome := 'CANCEL'; v_reason := 'EVENT_RESCHEDULED';
            ELSIF v_estart <= v_now THEN
                v_outcome := 'CANCEL'; v_reason := 'EVENT_STARTED';
            ELSIF r.type IN ('REMINDER_J1', 'REMINDER_H3') THEN
                v_valid := ARRAY(SELECT t.id FROM public.tickets t
                                  WHERE t.event_id = r.event_id AND t.user_id = r.recipient_user_id
                                    AND t.status::text = 'VALIDE'
                                  ORDER BY t.id);
                v_holder := jsonb_build_object('valid_ticket_ids', to_jsonb(v_valid));
                IF cardinality(v_valid) = 0 THEN
                    v_outcome := 'SKIP'; v_reason := 'NO_VALID_TICKET';
                END IF;
            END IF;
        ELSIF v_outcome = 'SEND' AND r.type = 'EVENT_CHANGED' THEN
            IF NOT v_found_event OR v_estatus NOT IN ('VALIDE', 'PUBLIE', 'SUSPENDU') THEN
                v_outcome := 'CANCEL'; v_reason := 'NO_LONGER_RELEVANT';
            ELSIF r.recipient_user_id IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM public.tickets t
                                   WHERE t.event_id = r.event_id AND t.user_id = r.recipient_user_id
                                     AND (t.status::text = 'VALIDE' OR (v_emulti AND t.status::text = 'UTILISE'))) THEN
                v_outcome := 'SKIP'; v_reason := 'NO_VALID_TICKET';
            END IF;
        END IF;

        IF v_outcome = 'SEND' AND r.channel = 'SMS' THEN
            IF v_phone IS NULL THEN
                v_outcome := 'SKIP'; v_reason := 'NO_PHONE';
            ELSIF r.family = 'OPTIONAL' THEN
                v_qs := public.notif_setting_int('notif.sms_quiet_start');
                v_qe := public.notif_setting_int('notif.sms_quiet_end');
                IF v_qs IS NULL OR v_qe IS NULL THEN
                    v_outcome := 'SKIP'; v_reason := 'SETTING_MISSING';
                ELSE
                    v_in_quiet := public.notif_in_quiet_hours(v_now, v_qs, v_qe);
                    v_quiet := jsonb_build_object('start', v_qs, 'end', v_qe,
                        'hour', extract(hour FROM (v_now AT TIME ZONE 'Africa/Dakar'))::integer, 'in_quiet', v_in_quiet);
                    IF v_in_quiet THEN
                        v_outcome := 'SKIP'; v_reason := 'QUIET_HOURS';
                    END IF;
                END IF;
            END IF;

            -- Rappel en IF_NO_PUSH : le SMS attend le résultat de la ligne PUSH du même groupe tant qu'elle
            -- n'est pas terminale et au plus 15 min après l'échéance (amendement 7) ; dans le doute il part.
            IF v_outcome = 'SEND' AND r.type IN ('REMINDER_J1', 'REMINDER_H3', 'CONTROLLER_REMINDER')
               AND r.template_data->>'sms_policy' = 'IF_NO_PUSH' THEN
                SELECT s.status INTO v_sibling
                  FROM public.notification_outbox s
                 WHERE s.group_key = r.group_key AND s.channel = 'PUSH' AND s.id <> r.id
                 ORDER BY s.created_at, s.id LIMIT 1;
                IF v_sibling IS NULL THEN
                    v_sibling := 'ABSENT';
                END IF;
                IF v_sibling = 'SENT' THEN
                    v_outcome := 'SKIP'; v_reason := 'PUSH_DELIVERED';
                ELSIF v_sibling IN ('PENDING', 'SENDING') AND v_now < r.due_at + interval '15 minutes' THEN
                    v_outcome := 'WAIT';
                END IF;
            END IF;

            -- Affectation d'un compte invité il y a moins d'une heure : l'invitation a déjà prévenu.
            IF v_outcome = 'SEND' AND r.type = 'CONTROLLER_ASSIGNED'
               AND EXISTS (SELECT 1 FROM public.notification_outbox i
                            WHERE i.type = 'CONTROLLER_INVITE' AND i.status IN ('SENT', 'UNCERTAIN')
                              AND (i.recipient_user_id = r.recipient_user_id OR i.recipient_phone = v_phone)
                              AND COALESCE(i.sent_at, i.finished_at) > v_now - interval '1 hour') THEN
                v_outcome := 'SKIP'; v_reason := 'COVERED_BY_INVITATION';
            END IF;
        ELSIF v_outcome = 'SEND' AND r.channel = 'EMAIL' THEN
            IF v_email IS NULL OR position('@' IN v_email) <= 1 OR v_email ~* '^[0-9]+@eventvillage\.sn$' THEN
                v_outcome := 'SKIP'; v_reason := 'NO_REAL_EMAIL';
            END IF;
        END IF;

        IF v_outcome = 'SEND' AND r.attempts >= r.max_attempts THEN
            -- Garde : une ligne en attente qui a épuisé ses tentatives ne repart pas.
            v_outcome := 'FAIL';
            v_reason := CASE r.channel WHEN 'SMS' THEN 'SMS_PROVIDER_ERROR' WHEN 'EMAIL' THEN 'EMAIL_PROVIDER_ERROR'
                                       WHEN 'PUSH' THEN 'PUSH_PROVIDER_ERROR' ELSE 'TEMPLATE_ERROR' END;
        END IF;

        v_decision := jsonb_strip_nulls(jsonb_build_object(
            'at', v_now, 'stage', 'CLAIM', 'outcome', v_outcome, 'reason', v_reason,
            'family', r.family, 'topic', r.topic,
            'account', CASE WHEN r.recipient_user_id IS NULL THEN NULL ELSE jsonb_build_object('status', v_ustatus, 'blocked', v_blocked) END,
            'preference', v_pref_json,
            'event', v_event_json,
            'holder', v_holder,
            'quiet', v_quiet,
            'sms_policy', r.template_data->'sms_policy',
            'push_sibling', v_sibling
        ));

        IF v_outcome = 'SKIP' THEN
            UPDATE public.notification_outbox
               SET status = 'SKIPPED', reason = v_reason, finished_at = v_now, decision = v_decision
             WHERE id = r.id;
            n_skipped := n_skipped + 1;
        ELSIF v_outcome = 'CANCEL' THEN
            UPDATE public.notification_outbox
               SET status = 'CANCELLED', reason = v_reason, finished_at = v_now, decision = v_decision
             WHERE id = r.id;
            n_cancelled := n_cancelled + 1;
        ELSIF v_outcome = 'WAIT' THEN
            UPDATE public.notification_outbox
               SET next_attempt_at = v_now + interval '1 minute', decision = v_decision
             WHERE id = r.id;
            n_waiting := n_waiting + 1;
        ELSIF v_outcome = 'FAIL' THEN
            UPDATE public.notification_outbox
               SET status = 'FAILED', reason = v_reason,
                   reason_detail = 'Tentatives épuisées avant un nouvel envoi.', finished_at = v_now, decision = v_decision
             WHERE id = r.id;
            PERFORM public.notif_failed_alert(r.id, r.type, r.channel, v_reason, r.attempts, v_now);
            n_failed := n_failed + 1;
        ELSE
            UPDATE public.notification_outbox
               SET status = 'SENDING', attempts = attempts + 1, claimed_at = v_now, claim_token = v_token, decision = v_decision
             WHERE id = r.id;
            v_claimed := v_claimed || jsonb_build_array(jsonb_build_object(
                'id', r.id,
                'claim_token', v_token,
                'type', r.type,
                'channel', r.channel,
                'family', r.family,
                'topic', r.topic,
                'group_key', r.group_key,
                'idempotency_key', r.idempotency_key,
                'attempts', r.attempts + 1,
                'max_attempts', r.max_attempts,
                'due_at', r.due_at,
                'recipient', jsonb_build_object('user_id', r.recipient_user_id, 'phone', v_phone, 'email', v_email, 'first_name', v_ufirst),
                'event', CASE WHEN v_found_event THEN jsonb_build_object(
                             'id', r.event_id, 'title', v_etitle, 'start_at', v_estart, 'location', v_eloc, 'city', v_ecity)
                         END,
                'actor_id', r.actor_id,
                'shift_id', r.shift_id,
                'template_data', r.template_data
            ));
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'ok', true, 'now', v_now, 'claimed', v_claimed, 'examined', n_examined,
        'skipped', n_skipped, 'cancelled', n_cancelled, 'reclaimed', n_reclaimed,
        'uncertain', n_uncertain, 'waiting', n_waiting, 'failed', n_failed
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- E2 — marquage par jeton
-- ----------------------------------------------------------------------------
-- p = { now?, results: [ { id, claim_token, outcome: SENT | RETRY | FAILED | SKIPPED | UNCERTAIN, reason?,
-- detail?, provider_message_id?, retry_after_seconds?, in_app?: { type, title, content, metadata },
-- delivery? } ] }. Une ligne qui n'est plus SENDING avec ce jeton est ignorée (stale).
-- RETRY : attente 1, 5, 15, 60 min après les tentatives 1 à 4 (Retry-After du fournisseur pris s'il est
-- plus long, plafonné à 240 min) ; à la dernière tentative → FAILED. Tout passage à FAILED : alerte admin.
CREATE OR REPLACE FUNCTION public.notification_outbox_mark(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now       timestamptz;
    v_item      jsonb;
    v_id        uuid;
    v_token     uuid;
    v_outcome   text;
    v_reason    text;
    v_detail    text;
    v_provider  text;
    v_in_app    jsonb;
    v_nid       uuid;
    v_wait      numeric;
    v_after     numeric;
    v_decision  jsonb;
    r           record;
    n_marked    integer := 0;
    n_stale     integer := 0;
    v_failed    jsonb := '[]'::jsonb;
BEGIN
    v_now := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    IF v_now < now() - interval '1 minute' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_NOW',
            'message', 'Horloge refusée : une heure dans le passé n''est jamais acceptée.');
    END IF;
    IF p ? 'results' AND jsonb_typeof(p->'results') <> 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Résultats d''envoi illisibles.');
    END IF;
    -- Validation de tout le lot avant toute écriture.
    FOR v_item IN SELECT x FROM jsonb_array_elements(COALESCE(p->'results', '[]'::jsonb)) AS x LOOP
        IF jsonb_typeof(v_item) <> 'object'
           OR COALESCE(v_item->>'id', '') !~* '^[0-9a-f-]{36}$'
           OR COALESCE(v_item->>'claim_token', '') !~* '^[0-9a-f-]{36}$'
           OR COALESCE(v_item->>'outcome', '') NOT IN ('SENT', 'RETRY', 'FAILED', 'SKIPPED', 'UNCERTAIN') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Résultat d''envoi incomplet.');
        END IF;
    END LOOP;

    FOR v_item IN SELECT x FROM jsonb_array_elements(COALESCE(p->'results', '[]'::jsonb)) AS x LOOP
        v_id := (v_item->>'id')::uuid;
        v_token := (v_item->>'claim_token')::uuid;
        SELECT o.id, o.type, o.channel, o.status, o.claim_token, o.attempts, o.max_attempts,
               o.recipient_user_id, o.notification_id, o.decision
          INTO r
          FROM public.notification_outbox o WHERE o.id = v_id
           FOR UPDATE;
        IF NOT FOUND THEN
            n_stale := n_stale + 1;
            CONTINUE;
        END IF;
        IF r.status <> 'SENDING' OR r.claim_token IS DISTINCT FROM v_token THEN
            n_stale := n_stale + 1;
            CONTINUE;
        END IF;

        v_outcome := v_item->>'outcome';
        v_reason := NULLIF(btrim(COALESCE(v_item->>'reason', '')), '');
        v_detail := NULLIF(left(COALESCE(v_item->>'detail', ''), 500), '');
        v_provider := NULLIF(left(COALESCE(v_item->>'provider_message_id', ''), 200), '');
        v_decision := COALESCE(r.decision, '{}'::jsonb)
            || CASE WHEN jsonb_typeof(v_item->'delivery') = 'object' THEN jsonb_build_object('delivery', v_item->'delivery') ELSE '{}'::jsonb END;

        IF v_outcome = 'SENT' AND r.channel = 'IN_APP' AND r.notification_id IS NULL THEN
            v_in_app := v_item->'in_app';
            IF jsonb_typeof(v_in_app) <> 'object'
               OR NULLIF(btrim(COALESCE(v_in_app->>'type', '')), '') IS NULL
               OR NULLIF(btrim(COALESCE(v_in_app->>'title', '')), '') IS NULL
               OR NULLIF(btrim(COALESCE(v_in_app->>'content', '')), '') IS NULL THEN
                v_outcome := 'FAILED';
                v_reason := 'TEMPLATE_ERROR';
                v_detail := 'Notification de l''application sans type, titre ou contenu.';
            END IF;
        END IF;

        IF v_outcome = 'RETRY' AND r.attempts >= r.max_attempts THEN
            v_outcome := 'FAILED';
        END IF;
        IF v_outcome IN ('RETRY', 'FAILED') AND v_reason IS NULL THEN
            v_reason := CASE r.channel WHEN 'SMS' THEN 'SMS_PROVIDER_ERROR' WHEN 'EMAIL' THEN 'EMAIL_PROVIDER_ERROR'
                                       WHEN 'PUSH' THEN 'PUSH_PROVIDER_ERROR' ELSE 'TEMPLATE_ERROR' END;
        ELSIF v_outcome = 'UNCERTAIN' AND v_reason IS NULL THEN
            v_reason := 'PROVIDER_TIMEOUT';
        ELSIF v_outcome = 'SKIPPED' AND v_reason IS NULL THEN
            v_outcome := 'FAILED';
            v_reason := 'TEMPLATE_ERROR';
            v_detail := COALESCE(v_detail, 'Ligne écartée sans motif par l''envoyeur.');
        END IF;

        IF v_outcome = 'SENT' THEN
            v_nid := r.notification_id;
            IF r.channel = 'IN_APP' AND v_nid IS NULL THEN
                INSERT INTO public.notifications (user_id, type, title, content, channel, status, sent_at, metadata)
                VALUES (r.recipient_user_id, v_in_app->>'type', v_in_app->>'title', v_in_app->>'content', 'IN_APP', 'SENT', v_now,
                        CASE WHEN jsonb_typeof(v_in_app->'metadata') = 'object' THEN v_in_app->'metadata' ELSE '{}'::jsonb END)
                RETURNING id INTO v_nid;
            END IF;
            UPDATE public.notification_outbox
               SET status = 'SENT', sent_at = v_now, finished_at = v_now, provider_message_id = v_provider,
                   notification_id = v_nid, reason = NULL, reason_detail = NULL, decision = v_decision
             WHERE id = r.id;
        ELSIF v_outcome = 'RETRY' THEN
            v_wait := CASE r.attempts WHEN 1 THEN 60 WHEN 2 THEN 300 WHEN 3 THEN 900 WHEN 4 THEN 3600 ELSE 14400 END;
            v_after := NULL;
            IF COALESCE(v_item->>'retry_after_seconds', '') ~ '^[0-9]+(\.[0-9]+)?$' THEN
                v_after := LEAST((v_item->>'retry_after_seconds')::numeric, 14400);
            END IF;
            UPDATE public.notification_outbox
               SET status = 'PENDING', claim_token = NULL, reason = v_reason, reason_detail = v_detail,
                   next_attempt_at = v_now + make_interval(secs => GREATEST(v_wait, COALESCE(v_after, 0))::double precision),
                   decision = v_decision
             WHERE id = r.id;
        ELSIF v_outcome = 'FAILED' THEN
            UPDATE public.notification_outbox
               SET status = 'FAILED', reason = v_reason, reason_detail = v_detail, finished_at = v_now, decision = v_decision
             WHERE id = r.id;
            PERFORM public.notif_failed_alert(r.id, r.type, r.channel, v_reason, r.attempts, v_now);
            v_failed := v_failed || jsonb_build_array(r.id);
        ELSIF v_outcome = 'SKIPPED' THEN
            UPDATE public.notification_outbox
               SET status = 'SKIPPED', reason = v_reason, reason_detail = v_detail, finished_at = v_now, decision = v_decision
             WHERE id = r.id;
        ELSE -- UNCERTAIN : l'envoi est peut-être parti (et facturé) ; jamais renvoyé, jamais relancé.
            UPDATE public.notification_outbox
               SET status = 'UNCERTAIN', reason = v_reason, reason_detail = v_detail, provider_message_id = v_provider,
                   sent_at = v_now, finished_at = v_now, decision = v_decision
             WHERE id = r.id;
        END IF;
        n_marked := n_marked + 1;
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'marked', n_marked, 'stale', n_stale, 'failed_ids', v_failed);
END;
$$;


-- ----------------------------------------------------------------------------
-- E3 — contrôle quotidien du volume de SMS
-- ----------------------------------------------------------------------------
-- SMS du jour de Dakar de v_now : lignes SMS SENT ou UNCERTAIN (journaux OTP compris). Seuil
-- notif.sms_daily_alert (absent : aucune alerte, threshold null) ; une seule alerte et un seul signal par jour.
CREATE OR REPLACE FUNCTION public.notification_daily_checks(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now       timestamptz;
    v_day       date;
    v_day_txt   text;
    v_start     timestamptz;
    v_count     integer;
    v_threshold integer;
    v_prefix    text;
    v_first     uuid;
    v_n         integer;
    v_alerted   boolean := false;
BEGIN
    v_now := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    IF v_now < now() - interval '1 minute' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_NOW',
            'message', 'Horloge refusée : une heure dans le passé n''est jamais acceptée.');
    END IF;
    v_day := (v_now AT TIME ZONE 'Africa/Dakar')::date;
    v_day_txt := to_char(v_day, 'YYYY-MM-DD');
    v_start := v_day::timestamp AT TIME ZONE 'Africa/Dakar';

    SELECT count(*)::integer INTO v_count
      FROM public.notification_outbox o
     WHERE o.channel = 'SMS' AND o.status IN ('SENT', 'UNCERTAIN')
       AND COALESCE(o.sent_at, o.finished_at) >= v_start
       AND COALESCE(o.sent_at, o.finished_at) < v_start + interval '1 day';

    v_threshold := public.notif_setting_int('notif.sms_daily_alert');
    IF v_threshold IS NOT NULL AND v_count >= v_threshold THEN
        PERFORM pg_advisory_xact_lock(hashtext('notif.sms_daily_alert:' || v_day_txt));
        v_prefix := 'ADMIN_SMS_DAILY_THRESHOLD:' || v_day_txt || ':';
        IF NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                        WHERE o.type = 'ADMIN_SMS_DAILY_THRESHOLD'
                          AND left(o.idempotency_key, length(v_prefix)) = v_prefix) THEN
            v_n := public.notif_enqueue_admins(jsonb_build_object(
                'type', 'ADMIN_SMS_DAILY_THRESHOLD', 'ref', v_day_txt,
                'data', jsonb_build_object('day', v_day_txt, 'count', v_count, 'threshold', v_threshold),
                'now', v_now));
            IF v_n > 0 THEN
                SELECT o.id INTO v_first
                  FROM public.notification_outbox o
                 WHERE o.type = 'ADMIN_SMS_DAILY_THRESHOLD' AND left(o.idempotency_key, length(v_prefix)) = v_prefix
                 ORDER BY o.created_at, o.id LIMIT 1;
                INSERT INTO public.admin_signals (kind, ref_id) VALUES ('SMS_DAILY_THRESHOLD', v_first) ON CONFLICT DO NOTHING;
                v_alerted := true;
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object('ok', true, 'day', v_day_txt, 'sms_today', v_count, 'threshold', v_threshold, 'alerted', v_alerted);
END;
$$;


-- ----------------------------------------------------------------------------
-- H2 — préférences et bouton d'essai
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notification_preferences_get(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user   uuid;
    v_topics jsonb;
BEGIN
    IF COALESCE(p->>'user_id', '') !~* '^[0-9a-f-]{36}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Compte absent.');
    END IF;
    v_user := (p->>'user_id')::uuid;
    SELECT jsonb_agg(jsonb_build_object(
               'topic', t.topic,
               'channels', jsonb_build_object(
                   'IN_APP', public.notif_preference_enabled(v_user, t.topic, 'IN_APP'),
                   'SMS',    public.notif_preference_enabled(v_user, t.topic, 'SMS'),
                   'EMAIL',  public.notif_preference_enabled(v_user, t.topic, 'EMAIL'),
                   'PUSH',   public.notif_preference_enabled(v_user, t.topic, 'PUSH'))
           ) ORDER BY t.ord)
      INTO v_topics
      FROM (VALUES ('REMINDERS', 1), ('EVENT_UPDATES', 2), ('PRO_ACTIVITY', 3)) AS t(topic, ord);
    RETURN jsonb_build_object(
        'ok', true,
        'topics', COALESCE(v_topics, '[]'::jsonb),
        'is_partner', EXISTS (SELECT 1 FROM public.partners pa WHERE pa.user_id = v_user)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.notification_preference_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user    uuid;
    v_topic   text := p->>'topic';
    v_channel text := p->>'channel';
BEGIN
    IF COALESCE(p->>'user_id', '') !~* '^[0-9a-f-]{36}$'
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = (p->>'user_id')::uuid) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Compte absent.');
    END IF;
    v_user := (p->>'user_id')::uuid;
    IF v_topic IS NULL OR v_topic NOT IN ('REMINDERS', 'EVENT_UPDATES', 'PRO_ACTIVITY')
       OR v_channel IS NULL OR v_channel NOT IN ('IN_APP', 'SMS', 'EMAIL', 'PUSH')
       OR jsonb_typeof(p->'enabled') IS DISTINCT FROM 'boolean' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PREFERENCE',
            'message', 'Préférence inconnue : seuls les rappels, les changements d''un événement et l''activité des ventes se règlent, canal par canal.');
    END IF;
    INSERT INTO public.notification_preferences (user_id, topic, channel, enabled, updated_at)
    VALUES (v_user, v_topic, v_channel, (p->>'enabled')::boolean, now())
    ON CONFLICT (user_id, topic, channel) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();
    RETURN jsonb_build_object('ok', true);
END;
$$;

-- Bouton d'essai : met en file une ligne PUSH_TEST (clé à la minute : un double clic ne crée qu'une ligne).
-- Aucun envoi ici : l'envoyeur la prend au passage suivant.
CREATE OR REPLACE FUNCTION public.notification_test_push_enqueue(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid;
    v_now  timestamptz;
    v_key  text;
    v_n    integer;
BEGIN
    IF COALESCE(p->>'user_id', '') !~* '^[0-9a-f-]{36}$'
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = (p->>'user_id')::uuid) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Compte absent.');
    END IF;
    v_user := (p->>'user_id')::uuid;
    v_now := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    IF v_now < now() - interval '1 minute' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_NOW',
            'message', 'Horloge refusée : une heure dans le passé n''est jamais acceptée.');
    END IF;
    v_key := 'PUSH_TEST:' || v_user::text || ':' || to_char(v_now AT TIME ZONE 'Africa/Dakar', 'YYYYMMDDHH24MI');
    v_n := public.notif_enqueue(jsonb_build_object('type', 'PUSH_TEST', 'key', v_key, 'user_id', v_user, 'data', '{}'::jsonb, 'now', v_now));
    RETURN jsonb_build_object('ok', true, 'queued', true, 'created', v_n, 'group_key', v_key);
END;
$$;


-- ----------------------------------------------------------------------------
-- Privilèges (règle 1A.3) : service_role seul, triggers compris
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_sig text;
BEGIN
    FOREACH v_sig IN ARRAY ARRAY[
        'public.notification_outbox_set_updated_at()',
        'public.notification_outbox_guard()',
        'public.event_start_at(uuid)',
        'public.notif_in_quiet_hours(timestamptz, integer, integer)',
        'public.notif_setting_int(text)',
        'public.notif_account_blocked(uuid)',
        'public.notif_preference_enabled(uuid, text, text)',
        'public.notif_admin_recipients(text)',
        'public.notif_try_timestamptz(text)',
        'public.ticket_transfer_identity(text, uuid)',
        'public.notif_enqueue(jsonb)',
        'public.notif_enqueue_admins(jsonb)',
        'public.notif_failed_alert(uuid, text, text, text, integer, timestamptz)',
        'public.notification_sync_log(jsonb)',
        'public.notification_admin_alert(jsonb)',
        'public.notification_outbox_claim(jsonb)',
        'public.notification_outbox_mark(jsonb)',
        'public.notification_daily_checks(jsonb)',
        'public.notification_preferences_get(jsonb)',
        'public.notification_preference_set(jsonb)',
        'public.notification_test_push_enqueue(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
    END LOOP;
END;
$$;
