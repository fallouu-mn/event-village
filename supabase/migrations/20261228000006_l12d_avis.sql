-- ============================================================================
-- EVENT VILLAGE — LOT 12d, migration 06 : avis du livreur, du client absent, des signalements, des fermetures, de la pause
-- ============================================================================
-- Décision du client : chaque étape importante sur tous les canaux (cloche, notification du téléphone, email, SMS d'un
-- segment GSM-7 au pire cas) ; cloche et notification du téléphone pour les petites étapes. Règle de nuit de la
-- finition 4 (notification_types.night_policy : SEND part tout de suite, DEFER reporte SMS et push à la fin de la nuit).
-- Textes dans lib/notifications/catalog.ts (sans mot technique, prénom et initiale seulement pour nommer une personne,
-- lien vers l'objet exact).
--  livreur : ORDER_COURIER_REMOVED (retiré de l'équipe, A7 : cloche, téléphone ; DEFER), ORDER_COURIER_RETURN (client
--            toujours absent après 30 minutes : rapporter la commande ; cloche, téléphone ; SEND) ;
--  partenaire : ORDER_COURIER_ANSWERED (réponse d'un livreur à l'invitation, A6 : cloche, téléphone ; DEFER),
--            ORDER_CLIENT_ABSENT_PRO (client absent signalé par le livreur ; SEND), ORDER_ABSENCE_DECIDED_PRO (décision de
--            l'équipe ; DEFER), ORDER_ISSUE_PRO (signalement du client ; SEND), ORDER_CLOSURE_ORDERS (commandes prévues
--            pendant une fermeture posée ; SEND), ORDER_PAUSE_ENDED (fin de la pause des commandes ; SEND) : cloche et
--            téléphone ;
--  client : ORDER_CLIENT_ABSENT (le livreur n'a pas pu le joindre : 4 canaux ; SEND), ORDER_ABSENCE_DECIDED (décision
--            de l'équipe, montant rendu : 4 canaux ; DEFER), ORDER_ISSUE_CLOSED (signalement traité : cloche, téléphone ;
--            DEFER) ;
--  administration (droit refunds.manage) : ADMIN_ORDER_ABSENT (absence à décider) et ADMIN_ORDER_ISSUE (signalements,
--            un avis par heure au plus) : cloche et email ; DEFER.
-- Rejouable : ON CONFLICT DO UPDATE. Aucun BEGIN ni COMMIT.
-- ============================================================================

INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission, night_policy) VALUES
    ('ORDER_COURIER_ANSWERED',    'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH'],                'PARTNER', 'BLOCK', FALSE, NULL,             'DEFER'),
    ('ORDER_COURIER_REMOVED',     'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH'],                'CLIENT',  'ALLOW', FALSE, NULL,             'DEFER'),
    ('ORDER_COURIER_RETURN',      'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH'],                'CLIENT',  'ALLOW', FALSE, NULL,             'SEND'),
    ('ORDER_CLIENT_ABSENT',       'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'],  'CLIENT',  'ALLOW', FALSE, NULL,             'SEND'),
    ('ORDER_CLIENT_ABSENT_PRO',   'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH'],                'PARTNER', 'ALLOW', FALSE, NULL,             'SEND'),
    ('ORDER_ABSENCE_DECIDED',     'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH','EMAIL','SMS'],  'CLIENT',  'ALLOW', FALSE, NULL,             'DEFER'),
    ('ORDER_ABSENCE_DECIDED_PRO', 'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH'],                'PARTNER', 'ALLOW', FALSE, NULL,             'DEFER'),
    ('ORDER_ISSUE_PRO',           'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH'],                'PARTNER', 'ALLOW', FALSE, NULL,             'SEND'),
    ('ORDER_ISSUE_CLOSED',        'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH'],                'CLIENT',  'ALLOW', FALSE, NULL,             'DEFER'),
    ('ORDER_CLOSURE_ORDERS',      'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH'],                'PARTNER', 'BLOCK', FALSE, NULL,             'SEND'),
    ('ORDER_PAUSE_ENDED',         'ESSENTIAL', NULL, ARRAY['IN_APP','PUSH'],                'PARTNER', 'BLOCK', FALSE, NULL,             'SEND'),
    ('ADMIN_ORDER_ABSENT',        'ESSENTIAL', NULL, ARRAY['IN_APP','EMAIL'],               'ADMIN',   'BLOCK', FALSE, 'refunds.manage', 'DEFER'),
    ('ADMIN_ORDER_ISSUE',         'ESSENTIAL', NULL, ARRAY['IN_APP','EMAIL'],               'ADMIN',   'BLOCK', FALSE, 'refunds.manage', 'DEFER')
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission,
    night_policy = EXCLUDED.night_policy;
