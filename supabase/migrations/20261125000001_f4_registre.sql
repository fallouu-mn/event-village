-- ============================================================================
-- EVENT VILLAGE — FINITION 4 (messages : chaque étape annoncée), 1/5 : registre, sujets, nuit, réglages
-- ============================================================================
-- Décisions du client (19/11) : les notifications sont la base ; chaque étape importante prévient la bonne personne sur
-- les quatre canaux (SMS, email, cloche, push), le coût des SMS n'est plus un critère. Gardés : plafonds anti-abus,
-- préférences par sujet (facultatif désactivable, indispensable toujours).
--
-- 1. Deux sujets de préférence : SALES_SUMMARY (« Résumé du matin », partenaires) et AFTER_EVENT (« Après l'événement »).
-- 2. notification_types.night_policy : DEFER = message non urgent, dont le SMS et le push préparés pendant la plage de nuit
--    sont REPORTÉS à sa fin (notification_outbox_claim, migration 2/5) ; SEND = urgent, part tout de suite. Toute la famille
--    OPTIONAL est DEFER ; parmi les indispensables, seuls les avis sans urgence (décisions favorables de l'administration,
--    recettes, SMS des admins D1, retours de transfert, avis groupés) sont DEFER.
-- 3. Cinq types nouveaux : SALES_UPDATE_SMS (ventes groupées par SMS, 30 min), PARTNER_DAILY_SUMMARY (résumé de 9 h),
--    ENTRY_WELCOME (bienvenue à l'entrée), ENTRY_THANKS (merci, le lendemain à 11 h), PARTNER_REFUND_REQUESTS (demandes de
--    remboursement des clients, groupées).
-- 4. Canaux élargis (liste ci-dessous, type par type) ; registre = lib/notifications/catalog.ts (tests notif-modeles et
--    f4-registre).
-- 5. Réglages : plage de nuit 01:00 → 07:00 (heure de Dakar) et plafond quotidien des SMS facultatifs relevé à 20 000, si la
--    valeur est encore celle d'origine (22, 8, 700) ; une valeur choisie par un administrateur n'est jamais écrasée.
-- Recopies (dernière définition de main) : notification_preferences_get, notification_preference_set
-- (20261103000002_lot6_outbox.sql) ; seul changement : les deux sujets ajoutés.
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Sujets
-- ----------------------------------------------------------------------------
ALTER TABLE public.notification_types DROP CONSTRAINT IF EXISTS notification_types_topic_check;
ALTER TABLE public.notification_types DROP CONSTRAINT IF EXISTS notification_types_topic_chk;
ALTER TABLE public.notification_types ADD CONSTRAINT notification_types_topic_chk
    CHECK (topic IN ('REMINDERS', 'EVENT_UPDATES', 'PRO_ACTIVITY', 'SALES_SUMMARY', 'AFTER_EVENT'));

ALTER TABLE public.notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_topic_check;
ALTER TABLE public.notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_topic_chk;
ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_topic_chk
    CHECK (topic IN ('REMINDERS', 'EVENT_UPDATES', 'PRO_ACTIVITY', 'SALES_SUMMARY', 'AFTER_EVENT'));

-- ----------------------------------------------------------------------------
-- 2. Politique de nuit
-- ----------------------------------------------------------------------------
ALTER TABLE public.notification_types ADD COLUMN IF NOT EXISTS night_policy TEXT NOT NULL DEFAULT 'SEND';
ALTER TABLE public.notification_types DROP CONSTRAINT IF EXISTS notification_types_night_policy_chk;
ALTER TABLE public.notification_types ADD CONSTRAINT notification_types_night_policy_chk CHECK (night_policy IN ('SEND', 'DEFER'));
COMMENT ON COLUMN public.notification_types.night_policy IS
    'Finition 4 : DEFER = non urgent, SMS et push préparés pendant la plage de nuit (notif.sms_quiet_start / _end, heure de Dakar) reportés à sa fin ; SEND = urgent, part tout de suite.';

-- ----------------------------------------------------------------------------
-- 3. Types nouveaux (le registre n'accepte l'écriture que par migration)
-- ----------------------------------------------------------------------------
INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('SALES_UPDATE_SMS',        'OPTIONAL',  'PRO_ACTIVITY',  ARRAY['SMS'],                         'PARTNER', 'BLOCK', FALSE, NULL),
    ('PARTNER_DAILY_SUMMARY',   'OPTIONAL',  'SALES_SUMMARY', ARRAY['IN_APP','SMS','EMAIL','PUSH'], 'PARTNER', 'BLOCK', FALSE, NULL),
    ('ENTRY_WELCOME',           'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL','PUSH'], 'CLIENT',  'BLOCK', FALSE, NULL),
    ('ENTRY_THANKS',            'OPTIONAL',  'AFTER_EVENT',   ARRAY['IN_APP','SMS','EMAIL','PUSH'], 'CLIENT',  'BLOCK', FALSE, NULL),
    ('PARTNER_REFUND_REQUESTS', 'ESSENTIAL', NULL,            ARRAY['IN_APP','SMS','EMAIL','PUSH'], 'PARTNER', 'BLOCK', FALSE, NULL)
ON CONFLICT (type) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Canaux élargis (les quatre canaux pour chaque étape importante)
-- ----------------------------------------------------------------------------
UPDATE public.notification_types AS t SET channels = v.channels
  FROM (VALUES
    -- Client : achat, sécurité, remboursement, billets qui reviennent, événements suspendus ou repris
    ('PURCHASE_CONFIRMED',            ARRAY['IN_APP','SMS','EMAIL','PUSH']),
    ('FREE_TICKETS_CONFIRMED',        ARRAY['IN_APP','SMS','EMAIL','PUSH']),
    ('PASSWORD_CHANGED',              ARRAY['IN_APP','SMS','EMAIL','PUSH']),
    ('EMAIL_CLAIMED_ELSEWHERE',       ARRAY['IN_APP','SMS','EMAIL','PUSH']),
    ('REFUND_REQUESTED',              ARRAY['IN_APP','SMS','EMAIL','PUSH']),
    ('TRANSFER_EXPIRED',              ARRAY['IN_APP','PUSH','EMAIL','SMS']),
    ('TRANSFER_CLAIMED_SENDER',       ARRAY['IN_APP','PUSH','EMAIL','SMS']),
    ('TRANSFER_DECLINED_SENDER',      ARRAY['IN_APP','PUSH','EMAIL','SMS']),
    ('TRANSFER_RECIPIENT_CHANGED',    ARRAY['IN_APP','PUSH','EMAIL','SMS']),
    ('EVENT_SUSPENDED_HOLDER',        ARRAY['IN_APP','PUSH','EMAIL','SMS']),
    ('EVENT_REACTIVATED_HOLDER',      ARRAY['IN_APP','PUSH','EMAIL','SMS']),
    ('TICKET_CANCELLED',              ARRAY['IN_APP','SMS','EMAIL','PUSH']),
    ('ACCOUNT_SUSPENDED',             ARRAY['IN_APP','SMS','EMAIL','PUSH']),
    ('ACCOUNT_REACTIVATED',           ARRAY['IN_APP','SMS','EMAIL','PUSH']),
    -- Organisatrice : validation, ventes, recettes, remboursements d'une annulation, équipe, caisse, porte
    ('EVENT_PUBLISHED_BY_ADMIN',      ARRAY['IN_APP','PUSH','EMAIL','SMS']),
    ('EVENT_SUBMITTED_ACK',           ARRAY['IN_APP','EMAIL','PUSH']),
    ('EVENT_FINISHED',                ARRAY['IN_APP','EMAIL','PUSH']),
    ('CLOSING_REPORT_READY',          ARRAY['IN_APP','EMAIL','PUSH']),
    ('FUNDS_AVAILABLE',               ARRAY['IN_APP','EMAIL','PUSH','SMS']),
    ('NEW_ORDER',                     ARRAY['IN_APP','PUSH']),
    ('CANCEL_REFUNDS_DONE',           ARRAY['IN_APP','EMAIL','PUSH','SMS']),
    ('CANCEL_REFUNDS_BLOCKED',        ARRAY['IN_APP','EMAIL','PUSH','SMS']),
    ('PARTNER_REGISTERED_ACK',        ARRAY['IN_APP','SMS','EMAIL','PUSH']),
    ('PARTNER_VALIDATED',             ARRAY['IN_APP','SMS','EMAIL','PUSH']),
    ('PARTNER_REJECTED',              ARRAY['IN_APP','SMS','EMAIL','PUSH']),
    ('PARTNER_SUSPENDED',             ARRAY['IN_APP','SMS','EMAIL','PUSH']),
    ('PARTNER_REACTIVATED',           ARRAY['IN_APP','SMS','EMAIL','PUSH']),
    ('TRIAL_STARTED',                 ARRAY['IN_APP','EMAIL','PUSH']),
    ('SUBSCRIPTION_ACTIVATED',        ARRAY['IN_APP','EMAIL','PUSH']),
    ('PAYMENT_SUCCESS',               ARRAY['IN_APP','EMAIL','PUSH']),
    ('PROMOTION_DECIDED',             ARRAY['IN_APP','EMAIL','PUSH','SMS']),
    ('CONTROLLER_INVITATION_ACCEPTED', ARRAY['IN_APP','PUSH','EMAIL','SMS']),
    ('CONTROLLER_INVITATION_DECLINED', ARRAY['IN_APP','PUSH','EMAIL','SMS']),
    ('CONTROLLER_INVITATION_EXPIRED', ARRAY['IN_APP','PUSH','EMAIL','SMS']),
    ('CONTROLLER_BECAME_ADMIN',       ARRAY['IN_APP','PUSH','EMAIL','SMS']),
    ('CASH_REFUND_MARKED_BY_ADMIN',   ARRAY['IN_APP','PUSH','EMAIL','SMS']),
    ('EVENT_CANCELLED_BY_ADMIN',      ARRAY['IN_APP','SMS','EMAIL','PUSH']),
    ('SCAN_REFUSALS_ALERT',           ARRAY['IN_APP','PUSH','EMAIL','SMS']),
    -- Contrôleur : statut, annulation et changement d'un événement contrôlé, caisse fermée par un tiers, compte activé
    ('CONTROLLER_EVENT_STATUS',       ARRAY['IN_APP','EMAIL','SMS','PUSH']),
    ('CONTROLLER_EVENT_CANCELLED',    ARRAY['IN_APP','SMS','EMAIL','PUSH']),
    ('CONTROLLER_EVENT_CHANGED',      ARRAY['IN_APP','SMS','EMAIL','PUSH']),
    ('CONTROLLER_ACTIVATED',          ARRAY['IN_APP','SMS','EMAIL','PUSH']),
    ('SHIFT_CLOSED_BY_OTHER',         ARRAY['IN_APP','PUSH','EMAIL','SMS'])
  ) AS v(type, channels)
 WHERE t.type = v.type AND t.channels IS DISTINCT FROM v.channels;

-- ----------------------------------------------------------------------------
-- 5. Politique de nuit des types
-- ----------------------------------------------------------------------------
UPDATE public.notification_types SET night_policy = 'DEFER' WHERE family = 'OPTIONAL' AND night_policy <> 'DEFER';
UPDATE public.notification_types SET night_policy = 'DEFER'
 WHERE night_policy <> 'DEFER' AND type IN (
    -- SMS des administrateurs (D1) : suit la plage réglée
    'ADMIN_REVIEW_SMS',
    -- décisions favorables ou sans délai de l'administration
    'EVENT_VALIDATED', 'EVENT_REJECTED', 'EVENT_PUBLISHED_BY_ADMIN', 'PARTNER_VALIDATED', 'PARTNER_REJECTED',
    'PARTNER_REACTIVATED', 'PROMOTION_DECIDED', 'CASH_REFUND_MARKED_BY_ADMIN',
    -- argent disponible, fin d'un événement, remboursements d'une annulation terminés
    'FUNDS_AVAILABLE', 'EVENT_FINISHED', 'CLOSING_REPORT_READY', 'CANCEL_REFUNDS_DONE',
    -- billet revenu à l'expéditeur, transfert accepté
    'TRANSFER_EXPIRED', 'TRANSFER_DECLINED_SENDER', 'TRANSFER_RECIPIENT_CHANGED', 'TRANSFER_CLAIMED_SENDER',
    -- équipe de contrôle
    'CONTROLLER_INVITATION_ACCEPTED', 'CONTROLLER_INVITATION_DECLINED', 'CONTROLLER_INVITATION_EXPIRED', 'CONTROLLER_BECAME_ADMIN',
    -- demandes de remboursement des clients, groupées
    'PARTNER_REFUND_REQUESTS');

-- ----------------------------------------------------------------------------
-- 6. Réglages : nuit 01:00 → 07:00, plafond des SMS facultatifs relevé (seulement les valeurs d'origine)
-- ----------------------------------------------------------------------------
UPDATE public.platform_settings SET value = '{"value": 1}',
       description = 'Début de la plage de nuit, heure de Dakar (entier de 0 à 23 ; début = fin : aucune plage). Un SMS ou un push non urgent préparé pendant la plage est reporté à sa fin.'
 WHERE key = 'notif.sms_quiet_start' AND value = '{"value": 22}'::jsonb;
UPDATE public.platform_settings SET value = '{"value": 7}',
       description = 'Fin de la plage de nuit, heure de Dakar (entier de 0 à 23 ; début = fin : aucune plage). Les messages reportés partent à cette heure.'
 WHERE key = 'notif.sms_quiet_end' AND value = '{"value": 8}'::jsonb;
UPDATE public.platform_settings SET value = '{"value": 20000}',
       description = 'Nombre maximal de SMS facultatifs (rappels, ventes, résumés, remerciements) envoyés par jour de Dakar ; au-delà : non envoyés par SMS (entier de 0 à 1 000 000 ; 0 : aucun SMS facultatif)'
 WHERE key = 'notif.sms_optional_daily_cap' AND value = '{"value": 700}'::jsonb;

-- ----------------------------------------------------------------------------
-- 7. Préférences : les deux sujets nouveaux (recopies de 20261103000002_lot6_outbox.sql)
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
      FROM (VALUES ('REMINDERS', 1), ('EVENT_UPDATES', 2), ('AFTER_EVENT', 3), ('PRO_ACTIVITY', 4), ('SALES_SUMMARY', 5)) AS t(topic, ord);
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
    IF v_topic IS NULL OR v_topic NOT IN ('REMINDERS', 'EVENT_UPDATES', 'PRO_ACTIVITY', 'SALES_SUMMARY', 'AFTER_EVENT')
       OR v_channel IS NULL OR v_channel NOT IN ('IN_APP', 'SMS', 'EMAIL', 'PUSH')
       OR jsonb_typeof(p->'enabled') IS DISTINCT FROM 'boolean' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PREFERENCE',
            'message', 'Préférence inconnue : seuls les rappels, les changements d''un événement, les messages après l''événement, l''activité des ventes et le résumé du matin se règlent, canal par canal.');
    END IF;
    INSERT INTO public.notification_preferences (user_id, topic, channel, enabled, updated_at)
    VALUES (v_user, v_topic, v_channel, (p->>'enabled')::boolean, now())
    ON CONFLICT (user_id, topic, channel) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();
    RETURN jsonb_build_object('ok', true);
END;
$$;
