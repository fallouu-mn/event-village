-- ============================================================================
-- EVENT VILLAGE — LOT 9 TER : registre des notifications (contrat 3.1 ligne 04, B.2.1, section 11.1 ; S-M, vague S1)
-- ============================================================================
-- Registre public.notification_types aligné sur lib/notifications/catalog.ts (même commit fix(9t.registre) ; égalité
-- imposée par tests/parcours/notif-modeles.test.ts et notif-outbox.test.ts), AVANT tout émetteur du lot (06 : F13, F14,
-- F15 ; 10 : F44). Les 4 types nouveaux de TOUT le lot :
--   - TICKET_REFUNDED_HOLDER (9t.2, consigne 0.2) : détenteur actuel d'un billet transféré puis remboursé ;
--   - ADMIN_EVENT_PUBLISHED, ADMIN_EVENT_WITHDRAWN (9t.10, R95) : publication et retrait de la validation par
--     l'organisatrice, aux admins munis de events.read ;
--   - SCAN_REFUSALS_ALERT (9t.18, section D) : refus en série à une porte, à la partenaire ; aucun SMS (D-P3).
-- ADMIN_EVENT_CHANGED : registre inchangé (parties PRICE et CHANNELS au catalogue seulement).
-- Contraintes du registre respectées (20261103000002_lot6_outbox.sql:57-68) : famille ESSENTIAL ⇒ topic NULL ;
-- admin_permission non nul ⇒ audience ADMIN. Règle G.49 : les 4 types déclarent EMAIL.
-- Rejouable : ON CONFLICT (type) DO UPDATE gardé par IS DISTINCT FROM (aucune écriture au rejeu). Aucune autre ligne
-- touchée. Aucune fonction : rien à accorder. Aucun BEGIN ni COMMIT.
-- ============================================================================

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission) VALUES
    ('TICKET_REFUNDED_HOLDER', 'ESSENTIAL', NULL, ARRAY['SMS','IN_APP','PUSH','EMAIL'], 'CLIENT',  'ALLOW', FALSE, NULL),
    ('ADMIN_EVENT_PUBLISHED',  'ESSENTIAL', NULL, ARRAY['IN_APP','EMAIL'],              'ADMIN',   'BLOCK', FALSE, 'events.read'),
    ('ADMIN_EVENT_WITHDRAWN',  'ESSENTIAL', NULL, ARRAY['IN_APP','EMAIL'],              'ADMIN',   'BLOCK', FALSE, 'events.read'),
    ('SCAN_REFUSALS_ALERT',    'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL'],       'PARTNER', 'BLOCK', FALSE, NULL)
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission
WHERE (notification_types.family, notification_types.topic, notification_types.channels, notification_types.audience,
       notification_types.suspended_policy, notification_types.sync_only, notification_types.admin_permission)
      IS DISTINCT FROM
      (EXCLUDED.family, EXCLUDED.topic, EXCLUDED.channels, EXCLUDED.audience,
       EXCLUDED.suspended_policy, EXCLUDED.sync_only, EXCLUDED.admin_permission);
