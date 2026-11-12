-- ============================================================================
-- EVENT VILLAGE — LOT 9 TER : tableau de bord des entrées, alerte de refus, clôture et export
-- (contrat 3.1 n° 10, 3.4 F40 à F49, 5.D D.1.2 ; arbitrage 21 ; X8, X9 ; rectifications 1 à 5 de D)
-- ============================================================================
-- Tâche : 9t.18 (consigne 4 : tableau de bord des entrées ; consigne 3 : validations par la liste « à part ») ;
-- libellés des motifs de zone pour la section C. Après 02 (ticket_origin, scan_is_refusal, réglages), 04 (type
-- SCAN_REFUSALS_ALERT au registre), 08 (tickets.guest_name, méthode GUEST_LIST) et 09 (zones, portes, verdicts).
-- Rejouable : aucun BEGIN ni COMMIT ; CREATE OR REPLACE, DROP TRIGGER IF EXISTS puis CREATE, privilèges réappliqués.
-- Aucun DDL de table, aucune donnée reprise.
--  1. Nouvelles (LANGUAGE sql) : ticket_origin_label (F40), scan_alert_refusal (F41).
--  2. Recopie pilotage_scan_result_label (F49) : base 20261109000008_lot9bis_cycle.sql:1755-1781, 17 branches
--     inchangées à l'octet ; ajout de wrong_zone « Mauvaise zone », not_entered « Pas encore entré », zone_ok
--     « Accès autorisé ».
--  3. Nouvelle scan_refusal_alert_settings (F42) : seuil et durée de l'alerte (défauts 10 et 5, bornes 3 à 500 et
--     1 à 60, patron low_stock_threshold()).
--  4. Nouvelle pilotage_compute_entries (F43) : source unique des vues figées des entrées (tableau de bord et
--     clôture) ; une seule lecture du journal de l'événement (refus par scan_is_refusal, une fois par ligne) et des
--     billets (origine par ticket_origin, une fois par billet) ; l'origine d'une entrée est lue par la clé primaire
--     du billet, jamais par jointure entre CTE (boucle imbriquée sous statistiques périmées, 9t.18 T6).
--  5. Recopie pilotage_compute_overview (F45) : base 20261102000005_lot5_pilotage.sql:212-301 ; refus par
--     scan_is_refusal, compteur guest_list ; tickets.*, entries.total, entries.counter, attendance_rate, revenue.*
--     inchangés (invariant (l)).
--  6. Recopie pilotage_entries (F46) : base 20261102000005_lot5_pilotage.sql:513-701 ; total, counter, refused et
--     vues figées lus dans pilotage_compute_entries ; by_scanner gagne gate et active ; tentatives multiples sans
--     les lignes de zone (rectification 3) ; clés nouvelles configured, by_zone, by_gate (débit et contrôleurs
--     actifs par porte), by_origin, guest_list, zone_checks, rate, controllers, alert_settings, alerts.
--  7. Recopie pilotage_closing (F47) : base 20261102000005_lot5_pilotage.sql:789-893 ; seul ajout : entries (vues
--     figées, aucun nom d'invité, aucune clé « en direct »).
--  8. Nouvelle scan_refusal_alert (F44) + trigger trg_ticket_scans_refusal_alert AFTER INSERT ON ticket_scans
--     (refus seulement) : verrou consultatif par (événement, porte), comptage à clock_timestamp(), au plus une alerte
--     SCAN_REFUSALS_ALERT par porte et par durée, à la propriétaire seule (cloche, push, email ; aucun SMS).
--  9. Recopie participants_export (F48) : base 20261109000004_lot9bis_droits.sql:186-266 ; « Invité, entré par la
--     liste » ; origin (ticket_origin_label ∘ ticket_origin) au lieu de channel ; zone et gate de l'entrée.
-- 10. Privilèges : service_role seul ; fonction de trigger : REVOKE seulement.
-- Verrous : aucune fonction de lecture ne verrouille ; le trigger d'alerte prend un verrou consultatif de
-- transaction après l'insertion d'un refus (dernière instruction verrouillante du scan, amendement 2 de D), puis
-- n'écrit que dans notification_outbox (notif_enqueue). Aucun cycle.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. F40 ticket_origin_label (nouvelle) : libellé d'une origine (libellés de l'export d'avant le lot)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_origin_label(p_origin text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE p_origin
        WHEN 'ONLINE' THEN 'En ligne'
        WHEN 'COUNTER' THEN 'Guichet'
        WHEN 'FREE' THEN 'Gratuit'
        WHEN 'INVITATION' THEN 'Invitation'
    END
$$;

-- ----------------------------------------------------------------------------
-- 1 bis. F41 scan_alert_refusal (nouvelle) : refus compté pour l'alerte (billet ou zone seulement). Exclus : valid,
-- zone_ok, forbidden et manual_entry_refused (droits du contrôleur), cash_required (encaissement), event_cancelled,
-- event_ended, event_suspended, event_not_open (état et horaires de l'événement).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scan_alert_refusal(p_result text, p_zone_result text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(p_zone_result IN ('wrong_zone', 'not_entered'), FALSE)
        OR COALESCE(p_result IN ('already_used', 'invalid', 'cancelled', 'refunded', 'wrong_event', 'payment_required',
                                 'qr_expired', 'dynamic_qr_required', 'transfer_pending'), FALSE)
$$;

-- ----------------------------------------------------------------------------
-- 2. F49 pilotage_scan_result_label (recopie, 20261109000008_lot9bis_cycle.sql:1755-1781) : motifs de zone
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pilotage_scan_result_label(p_result text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE p_result
        WHEN 'valid' THEN 'Entrée validée'
        WHEN 'already_used' THEN 'Billet déjà utilisé'
        WHEN 'invalid' THEN 'Billet invalide'
        WHEN 'cancelled' THEN 'Billet annulé'
        WHEN 'refunded' THEN 'Billet remboursé'
        WHEN 'wrong_event' THEN 'Billet d’un autre événement'
        WHEN 'event_cancelled' THEN 'Événement annulé'
        WHEN 'event_ended' THEN 'Événement terminé'
        WHEN 'event_suspended' THEN 'Événement suspendu'
        WHEN 'event_not_open' THEN 'Contrôle pas encore ouvert'
        WHEN 'payment_required' THEN 'Paiement requis'
        WHEN 'cash_required' THEN 'Encaissement requis'
        WHEN 'qr_expired' THEN 'QR expiré'
        WHEN 'dynamic_qr_required' THEN 'QR dynamique requis'
        WHEN 'manual_entry_refused' THEN 'Saisie manuelle refusée'
        WHEN 'forbidden' THEN 'Scanneur non autorisé sur cet événement'
        WHEN 'transfer_pending' THEN 'Transfert en cours'
        WHEN 'wrong_zone' THEN 'Mauvaise zone'
        WHEN 'not_entered' THEN 'Pas encore entré'
        WHEN 'zone_ok' THEN 'Accès autorisé'
        ELSE 'Autre refus' END
$$;


-- ----------------------------------------------------------------------------
-- 3. F42 scan_refusal_alert_settings (nouvelle) : seuil et durée de l'alerte de refus. La valeur est validée à
-- l'écriture (finance_setting_set, fin_setting_valid de 02) ; une ligne absente ou hors bornes donne le défaut.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scan_refusal_alert_settings(OUT threshold integer, OUT minutes integer)
RETURNS record
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb;
    n numeric;
BEGIN
    threshold := 10;
    minutes := 5;
    SELECT s.value->'value' INTO v FROM public.platform_settings s WHERE s.key = 'access.refusal_alert_threshold';
    IF v IS NOT NULL AND jsonb_typeof(v) = 'number' THEN
        n := (v #>> '{}')::numeric;
        IF n = trunc(n) AND n >= 3 AND n <= 500 THEN
            threshold := n::integer;
        END IF;
    END IF;
    v := NULL;
    SELECT s.value->'value' INTO v FROM public.platform_settings s WHERE s.key = 'access.refusal_alert_minutes';
    IF v IS NOT NULL AND jsonb_typeof(v) = 'number' THEN
        n := (v #>> '{}')::numeric;
        IF n = trunc(n) AND n >= 1 AND n <= 60 THEN
            minutes := n::integer;
        END IF;
    END IF;
END;
$$;


-- ----------------------------------------------------------------------------
-- 4. F43 pilotage_compute_entries (nouvelle) : vues figées des entrées d'un événement, partagées par le tableau de
-- bord (pilotage_entries) et la clôture (pilotage_closing). Fonction interne (service_role seul) : l'appelant a
-- passé pilotage_access. Aucun verrou. Le nom de l'invité n'est rendu qu'avec p_with_names (propriétaire).
--  - totals : entrées acceptées, dont guichet (COUNTER) et liste des invités (GUEST_LIST), refus (scan_is_refusal),
--    billets contrôlés en zone de contrôle (zone_ok, billets distincts) ;
--  - billets attendus : VALIDE et UTILISE (même filtre que pilotage_compute_overview), origine par ticket_origin ;
--  - by_zone : sans zone, une zone implicite « Entrée » ; avec zones, ENTREE (attendus = billets des catégories
--    admises, entrés = lignes acceptées de la zone), CONTROLE (attendus = billets UTILISE des catégories admises,
--    contrôlés = billets distincts zone_ok), puis « Zone non précisée » s'il existe des entrées sans zone ;
--  - by_gate : portes (même sans scan), puis lignes sans porte par point d'entrée exact (même construction que
--    by_entry_point) ; sans zone, by_gate = by_entry_point ;
--  - by_category, by_origin (ordre fixe ONLINE, COUNTER, FREE, INVITATION), by_quarter, refusals_by_reason
--    (motif = result, sinon zone_result), guest_list (200 dernières validations par la liste).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pilotage_compute_entries(p_event uuid, p_with_names boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_configured boolean;
    v_views jsonb;
    v_guests jsonb;
BEGIN
    v_configured := EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = p_event);

    -- Origine du billet d'une ligne lue par jointure sur les tables, par la seule clé primaire de tickets (une
    -- condition sur tk.event_id dans la jointure faisait choisir l'index par événement, relu pour chaque ligne) et
    -- de payments, et non par jointure entre les deux CTE : sous une estimation d'une ligne (billets insérés depuis la dernière
    -- analyse), le planificateur joignait s et k par boucle imbriquée, refaite pour chacune des 4 origines
    -- (25 millions de comparaisons pour 5 000 entrées, 7,8 s au run 132 ; 9t.18 T6).
    WITH s AS MATERIALIZED (
        SELECT sc.id, sc.ticket_id, sc.category_id, sc.gate_id, sc.zone_id, sc.entry_point, sc.accepted, sc.method,
               sc.result, sc.zone_result, sc.created_at,
               public.scan_is_refusal(sc.accepted, sc.result, sc.zone_result, sc.consumed_at) AS refused,
               CASE WHEN tk.event_id = p_event THEN
                   public.ticket_origin(tk.sale_channel, tk.price, pay.id IS NOT NULL AND NOT pay.is_platform_payment)
               END AS origin
          FROM public.ticket_scans sc
          LEFT JOIN public.tickets tk ON tk.id = sc.ticket_id
          LEFT JOIN public.payments pay ON pay.id = tk.payment_id
         WHERE sc.event_id = p_event
    ), k AS MATERIALIZED (
        SELECT tk.id, tk.category_id, tk.status::text AS status,
               tk.status::text IN ('VALIDE', 'UTILISE') AS expected,
               public.ticket_origin(tk.sale_channel, tk.price, pay.id IS NOT NULL AND NOT pay.is_platform_payment) AS origin
          FROM public.tickets tk
          LEFT JOIN public.payments pay ON pay.id = tk.payment_id
         WHERE tk.event_id = p_event
    ), t AS (
        SELECT count(*) FILTER (WHERE s.accepted) AS total,
               count(*) FILTER (WHERE s.accepted AND s.method = 'COUNTER') AS counter,
               count(*) FILTER (WHERE s.accepted AND s.method = 'GUEST_LIST') AS guest_list,
               count(*) FILTER (WHERE s.refused) AS refused,
               count(DISTINCT s.ticket_id) FILTER (WHERE s.zone_result = 'zone_ok') AS zone_checks
          FROM s
    ), sz AS (
        SELECT s.zone_id,
               count(*) FILTER (WHERE s.accepted) AS entered,
               count(DISTINCT s.ticket_id) FILTER (WHERE s.zone_result = 'zone_ok') AS checked,
               count(*) FILTER (WHERE s.refused) AS refused
          FROM s
         GROUP BY s.zone_id
    ), kz AS (
        -- billets comptés par catégorie avant la jointure aux zones (aucune boucle billet × zone_categories)
        SELECT zc.zone_id,
               sum(kc.expected_all)::bigint AS expected_all,
               sum(kc.expected_used)::bigint AS expected_used
          FROM (SELECT k.category_id,
                       count(*) FILTER (WHERE k.expected) AS expected_all,
                       count(*) FILTER (WHERE k.status = 'UTILISE') AS expected_used
                  FROM k
                 GROUP BY k.category_id) kc
          JOIN public.zone_categories zc ON zc.event_id = p_event AND zc.category_id = kc.category_id
         GROUP BY zc.zone_id
    ), zones AS (
        SELECT 0 AS part, z.position AS zpos, lower(z.name) AS zname, z.id AS zid,
               jsonb_build_object(
                   'zone_id', z.id,
                   'name', z.name,
                   'kind', z.kind,
                   'implicit', FALSE,
                   'expected', CASE WHEN z.kind = 'ENTREE' THEN COALESCE(kz.expected_all, 0) ELSE COALESCE(kz.expected_used, 0) END,
                   'entered', CASE WHEN z.kind = 'ENTREE' THEN COALESCE(sz.entered, 0) END,
                   'checked', CASE WHEN z.kind = 'CONTROLE' THEN COALESCE(sz.checked, 0) END,
                   'refused', COALESCE(sz.refused, 0)) AS line
          FROM public.event_zones z
          LEFT JOIN sz ON sz.zone_id = z.id
          LEFT JOIN kz ON kz.zone_id = z.id
         WHERE z.event_id = p_event
        UNION ALL
        SELECT 1, 0, '', NULL::uuid,
               jsonb_build_object(
                   'zone_id', NULL::uuid,
                   'name', 'Zone non précisée',
                   'kind', NULL::text,
                   'implicit', FALSE,
                   'expected', NULL::bigint,
                   'entered', sz.entered,
                   'checked', NULL::bigint,
                   'refused', sz.refused)
          FROM sz
         WHERE sz.zone_id IS NULL AND sz.entered > 0
    ), sg AS (
        SELECT s.gate_id,
               count(*) FILTER (WHERE s.accepted) AS accepted,
               count(*) FILTER (WHERE s.refused) AS refused
          FROM s
         WHERE s.gate_id IS NOT NULL
         GROUP BY s.gate_id
    ), gates AS (
        SELECT z.position AS zpos, lower(z.name) AS zname, lower(g.name) AS gname, g.id AS gid,
               jsonb_build_object(
                   'gate_key', g.id::text,
                   'gate_id', g.id,
                   'name', g.name,
                   'zone_id', z.id,
                   'zone_name', z.name,
                   'accepted', COALESCE(sg.accepted, 0),
                   'refused', COALESCE(sg.refused, 0),
                   'controllers_assigned', (SELECT count(*) FROM public.event_controllers ec
                                             WHERE ec.event_id = p_event AND ec.gate_id = g.id)) AS line
          FROM public.event_gates g
          JOIN public.event_zones z ON z.id = g.zone_id
          LEFT JOIN sg ON sg.gate_id = g.id
         WHERE g.event_id = p_event
    ), eps AS (
        SELECT u.ep, sum(u.accepted) AS accepted, sum(u.refused) AS refused
          FROM (
              SELECT s.entry_point AS ep,
                     count(*) FILTER (WHERE s.accepted) AS accepted,
                     count(*) FILTER (WHERE s.refused) AS refused
                FROM s
               WHERE s.gate_id IS NULL
               GROUP BY s.entry_point
              UNION ALL
              SELECT DISTINCT ec.entry_point, 0::bigint, 0::bigint
                FROM public.event_controllers ec
               WHERE ec.event_id = p_event AND ec.gate_id IS NULL AND ec.entry_point IS NOT NULL
          ) u
         GROUP BY u.ep
    ), quarters AS (
        SELECT date_bin(interval '15 minutes', s.created_at AT TIME ZONE 'Africa/Dakar', timestamp '2000-01-01 00:00:00') AS q,
               count(*) FILTER (WHERE s.accepted) AS accepted,
               count(*) FILTER (WHERE s.refused) AS refused
          FROM s
         GROUP BY 1
    ), reasons AS (
        SELECT COALESCE(s.result, s.zone_result) AS result, count(*) AS n
          FROM s
         WHERE s.refused
         GROUP BY 1
    )
    SELECT jsonb_build_object(
               'configured', v_configured,
               'totals', jsonb_build_object('total', t.total, 'counter', t.counter, 'guest_list', t.guest_list,
                                            'refused', t.refused, 'zone_checks', t.zone_checks),
               'by_zone', CASE WHEN v_configured THEN
                              COALESCE((SELECT jsonb_agg(zones.line ORDER BY zones.part, zones.zpos, zones.zname, zones.zid) FROM zones), '[]'::jsonb)
                          ELSE jsonb_build_array(jsonb_build_object(
                              'zone_id', NULL::uuid,
                              'name', 'Entrée',
                              'kind', 'ENTREE',
                              'implicit', TRUE,
                              'expected', (SELECT count(*) FROM k WHERE k.expected),
                              'entered', t.total,
                              'checked', NULL::bigint,
                              'refused', t.refused)) END,
               'by_gate', COALESCE((SELECT jsonb_agg(gates.line ORDER BY gates.zpos, gates.zname, gates.gname, gates.gid) FROM gates), '[]'::jsonb)
                       || COALESCE((SELECT jsonb_agg(jsonb_build_object(
                                        'gate_key', 'ep:' || COALESCE(eps.ep, ''),
                                        'gate_id', NULL::uuid,
                                        'name', eps.ep,
                                        'zone_id', NULL::uuid,
                                        'zone_name', NULL::text,
                                        'accepted', eps.accepted,
                                        'refused', eps.refused,
                                        'controllers_assigned', (SELECT count(*) FROM public.event_controllers ec
                                                                  WHERE ec.event_id = p_event AND ec.gate_id IS NULL
                                                                    AND ec.entry_point IS NOT DISTINCT FROM eps.ep))
                                    ORDER BY eps.accepted DESC, eps.ep NULLS LAST) FROM eps), '[]'::jsonb),
               'by_category', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object('category_id', c.id, 'name', c.name,
                                                       'expected', COALESCE(ke.n, 0), 'accepted', COALESCE(ka.n, 0))
                                    ORDER BY c.created_at, c.name, c.id)
                     FROM public.ticket_categories c
                     LEFT JOIN (SELECT k.category_id, count(*) AS n FROM k WHERE k.expected GROUP BY k.category_id) ke ON ke.category_id = c.id
                     LEFT JOIN (SELECT s.category_id, count(*) AS n FROM s WHERE s.accepted GROUP BY s.category_id) ka ON ka.category_id = c.id
                    WHERE c.event_id = p_event), '[]'::jsonb),
               'by_origin', (
                   SELECT jsonb_agg(jsonb_build_object(
                              'origin', o.origin,
                              'label', public.ticket_origin_label(o.origin),
                              'expected', COALESCE(ko.n, 0),
                              'entered', COALESCE(so.n, 0))
                          ORDER BY o.ord)
                     FROM (VALUES ('ONLINE', 1), ('COUNTER', 2), ('FREE', 3), ('INVITATION', 4)) AS o(origin, ord)
                     LEFT JOIN (SELECT k.origin, count(*) AS n FROM k WHERE k.expected GROUP BY k.origin) ko ON ko.origin = o.origin
                     LEFT JOIN (SELECT s.origin, count(*) AS n FROM s WHERE s.accepted AND s.origin IS NOT NULL GROUP BY s.origin) so
                            ON so.origin = o.origin),
               'by_quarter', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object('start', quarters.q AT TIME ZONE 'Africa/Dakar', 'accepted', quarters.accepted,
                                                       'refused', quarters.refused)
                                    ORDER BY quarters.q)
                     FROM quarters), '[]'::jsonb),
               'refusals_by_reason', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object('result', reasons.result, 'label', public.pilotage_scan_result_label(reasons.result),
                                                       'count', reasons.n)
                                    ORDER BY reasons.n DESC, reasons.result)
                     FROM reasons), '[]'::jsonb),
               'guest_list_count', t.guest_list)
      INTO v_views
      FROM t;

    -- Validations par la liste des invités (200 dernières) ; le nom de l'invité à la seule propriétaire
    SELECT COALESCE(jsonb_agg(x.line ORDER BY x.at DESC, x.id DESC), '[]'::jsonb)
      INTO v_guests
      FROM (
          SELECT sc.id, sc.created_at AS at,
                 jsonb_build_object(
                     'scan_id', sc.id,
                     'at', sc.created_at,
                     'category', c.name,
                     'gate', COALESCE(g.name, sc.entry_point),
                     'zone', z.name,
                     'controller', COALESCE(public.pilotage_display_name(u.first_name, u.last_name), 'Compte sans nom'),
                     'guest_name', CASE WHEN p_with_names THEN tk.guest_name END) AS line
            FROM public.ticket_scans sc
            LEFT JOIN public.tickets tk ON tk.id = sc.ticket_id
            LEFT JOIN public.ticket_categories c ON c.id = COALESCE(sc.category_id, tk.category_id)
            LEFT JOIN public.event_gates g ON g.id = sc.gate_id
            LEFT JOIN public.event_zones z ON z.id = sc.zone_id
            LEFT JOIN public.users u ON u.id = sc.scanner_id
           WHERE sc.event_id = p_event AND sc.accepted AND sc.method = 'GUEST_LIST'
           ORDER BY sc.created_at DESC, sc.id DESC
           LIMIT 200
      ) x;

    RETURN (v_views - 'guest_list_count')
        || jsonb_build_object('guest_list', jsonb_build_object('count', v_views->'guest_list_count', 'items', v_guests));
END;
$$;


-- ----------------------------------------------------------------------------
-- 5. F45 pilotage_compute_overview (recopie, 20261102000005_lot5_pilotage.sql:212-301) : refus par
-- scan_is_refusal (une ligne zone_ok n'est ni une entrée ni un refus), compteur guest_list dans entries
-- ----------------------------------------------------------------------------
-- pilotage_compute_overview(event_id) → { tickets, entries, revenue } (contrat U)
CREATE OR REPLACE FUNCTION public.pilotage_compute_overview(p_event uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_declared integer;
    t record;
    c record;
    s record;
    f record;
    v_cash numeric;
    v_refund_org numeric;
    v_den bigint;
BEGIN
    SELECT capacity INTO v_declared FROM public.events WHERE id = p_event;

    -- Billets (agrégats sans GROUP BY : une ligne, toujours affectée)
    SELECT count(*) FILTER (WHERE tk.sale_channel IS DISTINCT FROM 'INVITATION') AS sold,
           count(*) FILTER (WHERE tk.sale_channel = 'INVITATION') AS invitations,
           count(*) FILTER (WHERE tk.sale_channel IS DISTINCT FROM 'INVITATION' AND pay.is_platform_payment) AS online,
           count(*) FILTER (WHERE tk.sale_channel IS DISTINCT FROM 'INVITATION' AND pay.id IS NOT NULL
                              AND NOT pay.is_platform_payment) AS cash,
           count(*) FILTER (WHERE tk.sale_channel IS DISTINCT FROM 'INVITATION' AND pay.id IS NULL AND tk.price > 0) AS unpaid,
           count(*) FILTER (WHERE tk.sale_channel IS DISTINCT FROM 'INVITATION' AND pay.id IS NULL AND tk.price = 0) AS free
      INTO t
      FROM public.tickets tk
      LEFT JOIN public.payments pay ON pay.id = tk.payment_id
     WHERE tk.event_id = p_event AND tk.status::text IN ('VALIDE', 'UTILISE');

    SELECT COALESCE(sum(x.total) FILTER (WHERE x.is_active), 0) AS capacity,
           COALESCE(sum(x.in_payment), 0) AS in_payment,
           COALESCE(sum(x.total - x.sold - x.invitations - x.in_payment) FILTER (WHERE x.is_active), 0) AS remaining
      INTO c
      FROM public.pilotage_category_stats(p_event) x;

    SELECT count(*) FILTER (WHERE sc.accepted) AS total,
           count(*) FILTER (WHERE sc.accepted AND sc.method = 'COUNTER') AS counter,
           count(*) FILTER (WHERE public.scan_is_refusal(sc.accepted, sc.result, sc.zone_result, sc.consumed_at)) AS refused,
           count(*) FILTER (WHERE sc.accepted AND sc.method = 'GUEST_LIST') AS guest_list
      INTO s
      FROM public.ticket_scans sc
     WHERE sc.event_id = p_event;

    SELECT COALESCE(sum(l.amount), 0) AS online,
           COALESCE(sum(l.amount) FILTER (WHERE l.entry_type = 'VENTE'), 0) AS gross,
           COALESCE(-sum(l.amount) FILTER (WHERE l.entry_type = 'REMBOURSEMENT'), 0) AS refunded
      INTO f
      FROM public.finance_ledger l
     WHERE l.event_id = p_event AND l.account_kind = 'ORGANISATEUR' AND l.entry_type IN ('VENTE', 'REMBOURSEMENT');

    SELECT COALESCE(sum(pay.amount), 0) INTO v_cash
      FROM public.payments pay
     WHERE pay.id IN (SELECT x.id FROM public.payments x WHERE x.event_id = p_event
                      UNION
                      SELECT tk.payment_id FROM public.tickets tk WHERE tk.event_id = p_event AND tk.payment_id IS NOT NULL)
       AND NOT pay.is_platform_payment AND pay.status::text = 'SUCCESS';

    SELECT COALESCE(sum(rf.amount), 0) INTO v_refund_org
      FROM public.refunds rf
      JOIN public.tickets tk ON tk.id = rf.ticket_id
     WHERE tk.event_id = p_event AND rf.settlement = 'ORGANISATEUR' AND rf.status::text IS DISTINCT FROM 'FAILED';

    v_den := t.sold + t.invitations;

    RETURN jsonb_build_object(
        'tickets', jsonb_build_object(
            'sold', t.sold,
            'invitations', t.invitations,
            'capacity', c.capacity,
            'in_payment', c.in_payment,
            'remaining', c.remaining,
            'declared_capacity', v_declared,
            'capacity_exceeded', COALESCE(v_declared IS NOT NULL AND c.capacity > v_declared, false),
            'by_channel', jsonb_build_object('online', t.online, 'cash', t.cash, 'unpaid', t.unpaid, 'free', t.free)),
        'entries', jsonb_build_object(
            'total', s.total,
            'counter', s.counter,
            'refused', s.refused,
            'guest_list', s.guest_list,
            'attendance_rate', CASE WHEN v_den > 0 THEN round(s.total::numeric / v_den, 4) END),
        'revenue', jsonb_build_object(
            'online', f.online,
            'online_gross', f.gross,
            'cash', v_cash,
            'refunded', f.refunded + v_refund_org,
            'refunded_online', f.refunded,
            'refunded_cash_organizer', v_refund_org));
END;
$$;


-- ----------------------------------------------------------------------------
-- 6. F46 pilotage_entries (recopie, 20261102000005_lot5_pilotage.sql:513-701) : vues figées de
-- pilotage_compute_entries, clés « en direct » (débit, contrôleurs actifs, alertes), porte et activité par
-- contrôleur, tentatives multiples sans les lignes de zone
-- ----------------------------------------------------------------------------
-- Entrées : total, par contrôleur, par point d'entrée, par catégorie, par quart d'heure, refus par
-- motif, tentatives multiples, incidents techniques par contrôleur
CREATE OR REPLACE FUNCTION public.pilotage_entries(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_code text;
    a record;
    s record;
    v_by_scanner jsonb;
    v_by_entry jsonb;
    v_by_category jsonb;
    v_by_quarter jsonb;
    v_refusals jsonb;
    v_repeated jsonb;
    v_incidents jsonb;
    v jsonb;
    st record;
    v_active uuid[];
    v_by_gate jsonb;
    v_rate jsonb;
    v_controllers jsonb;
    v_alerts jsonb;
BEGIN
    v_code := public.pilotage_access(v_event, v_actor);
    IF v_code IS NOT NULL THEN
        RETURN public.pilotage_refusal(v_code);
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);

    -- Lot 9 ter (9t.18) : vues figées, une seule source avec la clôture ; le nom de l'invité à la seule propriétaire
    v := public.pilotage_compute_entries(v_event, a.is_owner);
    v_by_category := v->'by_category';
    v_by_quarter := v->'by_quarter';
    v_refusals := v->'refusals_by_reason';

    SELECT count(*) FILTER (WHERE sc.result = 'cash_required' AND NOT sc.accepted AND sc.consumed_at IS NULL) AS cash_pending
      INTO s
      FROM public.ticket_scans sc
     WHERE sc.event_id = v_event;

    -- Lot 9 ter : comptes actifs sur l'événement (un scan hors « scanneur non autorisé », ou un incident, dans les
    -- 10 dernières minutes)
    v_active := ARRAY(
        SELECT sc.scanner_id FROM public.ticket_scans sc
         WHERE sc.event_id = v_event AND sc.result IS DISTINCT FROM 'forbidden' AND sc.created_at > now() - interval '10 minutes'
        UNION
        SELECT i.scanner_id FROM public.scan_incidents i
         WHERE i.event_id = v_event AND i.occurred_at > now() - interval '10 minutes');

    -- Par contrôleur (scanneurs et comptes qui ont déclaré un incident)
    WITH scans AS (
        SELECT sc.scanner_id,
               count(*) FILTER (WHERE sc.accepted) AS accepted,
               count(*) FILTER (WHERE public.scan_is_refusal(sc.accepted, sc.result, sc.zone_result, sc.consumed_at)) AS refused,
               max(sc.created_at) AS last_at,
               (array_agg(sc.scanner_role ORDER BY sc.created_at DESC, sc.id DESC))[1] AS role
          FROM public.ticket_scans sc
         WHERE sc.event_id = v_event
         GROUP BY sc.scanner_id
    ), inc AS (
        SELECT i.scanner_id, count(*) AS n, max(i.occurred_at) AS last_at
          FROM public.scan_incidents i
         WHERE i.event_id = v_event
         GROUP BY i.scanner_id
    ), ids AS (
        SELECT scanner_id FROM scans UNION SELECT scanner_id FROM inc
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'scanner_id', ids.scanner_id,
               'name', COALESCE(public.pilotage_display_name(u.first_name, u.last_name), 'Compte sans nom'),
               'role', COALESCE(scans.role, CASE WHEN ec.id IS NOT NULL THEN 'CONTROLEUR' END),
               'entry_point', ec.entry_point,
               'assigned', ec.id IS NOT NULL,
               'accepted', COALESCE(scans.accepted, 0),
               'refused', COALESCE(scans.refused, 0),
               'incidents', COALESCE(inc.n, 0),
               'last_activity_at', scans.last_at,
               'last_incident_at', inc.last_at,
               'gate', COALESCE(g.name, ec.entry_point),
               'active', ids.scanner_id = ANY (v_active))
             ORDER BY COALESCE(scans.accepted, 0) DESC, ids.scanner_id), '[]'::jsonb)
      INTO v_by_scanner
      FROM ids
      LEFT JOIN scans ON scans.scanner_id = ids.scanner_id
      LEFT JOIN inc ON inc.scanner_id = ids.scanner_id
      LEFT JOIN public.users u ON u.id = ids.scanner_id
      LEFT JOIN public.event_controllers ec ON ec.event_id = v_event AND ec.user_id = ids.scanner_id
      LEFT JOIN public.event_gates g ON g.id = ec.gate_id;

    -- Par point d'entrée (celui du moment du scan) ; les points d'entrée des affectations figurent même sans scan
    SELECT COALESCE(jsonb_agg(jsonb_build_object('entry_point', x.ep, 'accepted', x.accepted, 'refused', x.refused)
             ORDER BY x.accepted DESC, x.ep NULLS LAST), '[]'::jsonb)
      INTO v_by_entry
      FROM (
          SELECT u.ep, sum(u.accepted) AS accepted, sum(u.refused) AS refused
            FROM (
                SELECT sc.entry_point AS ep,
                       count(*) FILTER (WHERE sc.accepted) AS accepted,
                       count(*) FILTER (WHERE public.scan_is_refusal(sc.accepted, sc.result, sc.zone_result, sc.consumed_at)) AS refused
                  FROM public.ticket_scans sc
                 WHERE sc.event_id = v_event
                 GROUP BY sc.entry_point
                UNION ALL
                SELECT DISTINCT ec.entry_point, 0::bigint, 0::bigint
                  FROM public.event_controllers ec
                 WHERE ec.event_id = v_event AND ec.entry_point IS NOT NULL
            ) u
           GROUP BY u.ep
      ) x;

    -- Par catégorie, flux par quart d'heure et refus par motif : vues figées de pilotage_compute_entries (plus haut)

    -- Tentatives multiples : au moins 2 tentatives sur le même billet en 10 minutes, ou une tentative
    -- already_used ; le cash_required consommé par un encaissement n'est pas une tentative, ni (lot 9 ter) une
    -- ligne de zone (contrôle d'un billet déjà entré, mauvaise zone, pas encore entré). Le numéro du
    -- billet n'est rendu qu'au partenaire propriétaire.
    WITH att AS (
        SELECT sc.id, sc.ticket_id, sc.result, sc.created_at,
               lag(sc.created_at) OVER (PARTITION BY sc.ticket_id ORDER BY sc.created_at, sc.id) AS prev_at
          FROM public.ticket_scans sc
         WHERE sc.event_id = v_event AND sc.ticket_id IS NOT NULL
           AND NOT (sc.result = 'cash_required' AND sc.consumed_at IS NOT NULL)
           AND sc.zone_result IS NULL
    ), agg AS (
        SELECT att.ticket_id, count(*) AS attempts,
               bool_or(att.result = 'already_used') AS any_used,
               bool_or(att.prev_at IS NOT NULL AND att.created_at - att.prev_at <= interval '10 minutes') AS close_pair,
               min(att.created_at) AS first_at,
               max(att.created_at) AS last_at,
               (array_agg(att.result ORDER BY att.created_at DESC, att.id DESC))[1] AS last_result
          FROM att
         GROUP BY att.ticket_id
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'ticket_id', agg.ticket_id,
               'ticket_number', CASE WHEN a.is_owner THEN tk.ticket_number END,
               'category', c.name,
               'attempts', agg.attempts,
               'last_result', agg.last_result,
               'last_result_label', public.pilotage_scan_result_label(agg.last_result),
               'first_at', agg.first_at,
               'last_at', agg.last_at,
               'entered_at', tk.checked_in_at)
             ORDER BY agg.last_at DESC, agg.ticket_id), '[]'::jsonb)
      INTO v_repeated
      FROM agg
      JOIN public.tickets tk ON tk.id = agg.ticket_id
      LEFT JOIN public.ticket_categories c ON c.id = tk.category_id
     WHERE agg.any_used OR agg.close_pair;

    -- Incidents techniques (scan_incidents) par contrôleur et par type, pour cet événement seulement
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'scanner_id', x.scanner_id,
               'name', COALESCE(public.pilotage_display_name(u.first_name, u.last_name), 'Compte sans nom'),
               'kind', x.kind,
               'count', x.n,
               'last_at', x.last_at)
             ORDER BY x.n DESC, x.scanner_id, x.kind), '[]'::jsonb)
      INTO v_incidents
      FROM (SELECT i.scanner_id, i.kind, count(*) AS n, max(i.occurred_at) AS last_at
              FROM public.scan_incidents i WHERE i.event_id = v_event GROUP BY i.scanner_id, i.kind) x
      LEFT JOIN public.users u ON u.id = x.scanner_id;

    -- Lot 9 ter : par porte, avec le débit des 5 dernières minutes et les contrôleurs actifs de la porte (une porte,
    -- sinon le point d'entrée exact des lignes et des affectations sans porte)
    SELECT COALESCE(jsonb_agg(gl.g || jsonb_build_object(
               'rate_per_minute', round((
                   SELECT count(*) FROM public.ticket_scans sc
                    WHERE sc.event_id = v_event AND sc.accepted AND sc.created_at > now() - interval '5 minutes'
                      AND CASE WHEN gl.g->>'gate_id' IS NOT NULL THEN sc.gate_id = (gl.g->>'gate_id')::uuid
                               ELSE sc.gate_id IS NULL AND sc.entry_point IS NOT DISTINCT FROM gl.g->>'name' END) / 5.0, 1),
               'controllers_active', (
                   SELECT count(*) FROM public.event_controllers ec
                    WHERE ec.event_id = v_event AND ec.user_id = ANY (v_active)
                      AND CASE WHEN gl.g->>'gate_id' IS NOT NULL THEN ec.gate_id = (gl.g->>'gate_id')::uuid
                               ELSE ec.gate_id IS NULL AND ec.entry_point IS NOT DISTINCT FROM gl.g->>'name' END))
             ORDER BY gl.ord), '[]'::jsonb)
      INTO v_by_gate
      FROM jsonb_array_elements(v->'by_gate') WITH ORDINALITY AS gl(g, ord);

    -- Lot 9 ter : débit (moyenne des 5 dernières minutes ; entrées de chaque minute sur 30 minutes, heure de Dakar)
    SELECT jsonb_build_object(
               'window_minutes', 5,
               'per_minute', round((SELECT count(*) FROM public.ticket_scans sc
                                     WHERE sc.event_id = v_event AND sc.accepted AND sc.created_at > now() - interval '5 minutes') / 5.0, 1),
               'by_minute', COALESCE(jsonb_agg(jsonb_build_object('start', m.m AT TIME ZONE 'Africa/Dakar', 'accepted', COALESCE(x.n, 0))
                                               ORDER BY m.m), '[]'::jsonb))
      INTO v_rate
      FROM generate_series(date_trunc('minute', now()) - interval '29 minutes', date_trunc('minute', now()), interval '1 minute') AS m(m)
      LEFT JOIN (SELECT date_trunc('minute', sc.created_at) AS m, count(*) AS n
                   FROM public.ticket_scans sc
                  WHERE sc.event_id = v_event AND sc.accepted AND sc.created_at >= date_trunc('minute', now()) - interval '29 minutes'
                  GROUP BY 1) x ON x.m = m.m;

    -- Lot 9 ter : contrôleurs affectés et actifs (un propriétaire ou un admin qui scanne n'est pas compté)
    SELECT jsonb_build_object('window_minutes', 10, 'assigned', count(*), 'active', count(*) FILTER (WHERE ec.user_id = ANY (v_active)))
      INTO v_controllers
      FROM public.event_controllers ec
     WHERE ec.event_id = v_event;

    -- Lot 9 ter : portes au seuil de l'alerte de refus (même clé de porte et mêmes refus que le trigger)
    SELECT * INTO st FROM public.scan_refusal_alert_settings();
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'gate_key', x.gate_key,
               'name', x.name,
               'zone_name', x.zone_name,
               'refused', x.n,
               'window_minutes', st.minutes,
               'threshold', st.threshold)
             ORDER BY x.n DESC, x.gate_key), '[]'::jsonb)
      INTO v_alerts
      FROM (
          SELECT CASE WHEN sc.gate_id IS NOT NULL THEN sc.gate_id::text ELSE 'ep:' || COALESCE(sc.entry_point, '') END AS gate_key,
                 COALESCE(max(g.name), NULLIF(btrim(max(sc.entry_point)), ''), 'Point d’entrée non précisé') AS name,
                 max(z.name) AS zone_name,
                 count(*) AS n
            FROM public.ticket_scans sc
            LEFT JOIN public.event_gates g ON g.id = sc.gate_id
            LEFT JOIN public.event_zones z ON z.id = g.zone_id
           WHERE sc.event_id = v_event AND NOT sc.accepted
             AND sc.created_at > now() - make_interval(mins => st.minutes)
             AND public.scan_alert_refusal(sc.result, sc.zone_result)
           GROUP BY 1
          HAVING count(*) >= st.threshold
      ) x;

    RETURN jsonb_build_object(
        'ok', true,
        'event_id', v_event,
        'total', v->'totals'->'total',
        'counter', v->'totals'->'counter',
        'refused', v->'totals'->'refused',
        'cash_pending', s.cash_pending,
        'by_scanner', v_by_scanner,
        'by_entry_point', v_by_entry,
        'by_category', v_by_category,
        'by_quarter', v_by_quarter,
        'refusals_by_reason', v_refusals,
        'repeated_attempts', v_repeated,
        'incidents', v_incidents)
        || jsonb_build_object(
        'configured', v->'configured',
        'by_zone', v->'by_zone',
        'by_gate', v_by_gate,
        'by_origin', v->'by_origin',
        'guest_list', v->'guest_list',
        'zone_checks', v->'totals'->'zone_checks',
        'rate', v_rate,
        'controllers', v_controllers,
        'alert_settings', jsonb_build_object('threshold', st.threshold, 'minutes', st.minutes),
        'alerts', v_alerts,
        'computed_at', now());
END;
$$;


-- ----------------------------------------------------------------------------
-- 7. F47 pilotage_closing (recopie, 20261102000005_lot5_pilotage.sql:789-893) : seul ajout, entries (vues figées
-- de pilotage_compute_entries, sans nom d'invité ni clé « en direct »), source unique de l'onglet, de la fenêtre
-- et du PDF de clôture
-- ----------------------------------------------------------------------------
-- Clôture : absents (nombre en direct, liste après la fin), Z de caisse, montant net et disponibilité des fonds
CREATE OR REPLACE FUNCTION public.pilotage_closing(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_code text;
    e record;
    v_absent_count bigint;
    v_after_end boolean;
    v_list jsonb;
    v_z jsonb;
    v_summary jsonb;
    v_from timestamptz;
    v_to timestamptz;
BEGIN
    v_code := public.pilotage_access(v_event, v_actor);
    IF v_code IS NOT NULL THEN
        RETURN public.pilotage_refusal(v_code);
    END IF;
    SELECT id, partner_id, status INTO e FROM public.events WHERE id = v_event;

    SELECT count(*) INTO v_absent_count FROM public.tickets tk
     WHERE tk.event_id = v_event AND tk.status::text = 'VALIDE';
    v_after_end := e.status::text = 'TERMINE' OR public.event_end_at(v_event) <= now();
    IF v_after_end THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                   'name', COALESCE(public.pilotage_display_name(u.first_name, u.last_name), 'Participant sans nom'),
                   'category', c.name,
                   'category_id', c.id)
                 ORDER BY public.pilotage_display_name(u.first_name, u.last_name) NULLS LAST, c.name, tk.id), '[]'::jsonb)
          INTO v_list
          FROM public.tickets tk
          JOIN public.ticket_categories c ON c.id = tk.category_id
          LEFT JOIN public.users u ON u.id = tk.user_id
         WHERE tk.event_id = v_event AND tk.status::text = 'VALIDE';
    END IF;

    -- Z de caisse par caisse : déclaré hors fonds, attendu, écart, détail par source et par catégorie
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'shift_id', s.id,
               'controller_id', s.controller_id,
               'controller_name', public.pilotage_display_name(u.first_name, u.last_name),
               'status', s.status::text,
               'opened_at', s.opened_at,
               'closed_at', s.closed_at,
               'opening_float', s.opening_float_amount,
               'expected', s.expected_cash_total,
               'declared', CASE WHEN s.status = 'OUVERT' THEN NULL ELSE s.declared_cash_total END,
               'difference', CASE WHEN s.status = 'OUVERT' THEN NULL ELSE s.discrepancy_amount END,
               'justification', s.discrepancy_justification,
               'pin_cosigned', COALESCE(s.closing_confirmed_by_pin, false),
               'by_source', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object('source', src.source, 'count', src.n, 'amount', src.amount) ORDER BY src.source DESC)
                     FROM (SELECT CASE WHEN pay.metadata->>'source' = 'COUNTER_SALE' THEN 'GUICHET' ELSE 'SCAN' END AS source,
                                  count(*) AS n, sum(pay.amount) AS amount
                             FROM public.payments pay
                            WHERE pay.shift_id = s.id AND NOT pay.is_platform_payment AND pay.status::text = 'SUCCESS'
                            GROUP BY 1) src), '[]'::jsonb),
               'by_category', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object('category_id', cat.category_id, 'name', cat.name, 'count', cat.n, 'amount', cat.amount)
                                    ORDER BY cat.name, cat.category_id)
                     FROM (SELECT tk.category_id, c.name, count(*) AS n, sum(tk.price) AS amount
                             FROM public.payments pay
                             JOIN public.tickets tk ON tk.payment_id = pay.id
                             JOIN public.ticket_categories c ON c.id = tk.category_id
                            WHERE pay.shift_id = s.id AND NOT pay.is_platform_payment AND pay.status::text = 'SUCCESS'
                            GROUP BY tk.category_id, c.name) cat), '[]'::jsonb))
             ORDER BY s.opened_at, s.id), '[]'::jsonb)
      INTO v_z
      FROM public.controller_shifts s
      LEFT JOIN public.users u ON u.id = s.controller_id
     WHERE s.event_id = v_event;

    v_summary := public.finance_partner_summary(e.partner_id, v_event);
    SELECT min(l.available_at), max(l.available_at) INTO v_from, v_to
      FROM public.finance_ledger l
     WHERE l.event_id = v_event AND l.account_kind = 'ORGANISATEUR' AND l.entry_type = 'VENTE';

    RETURN jsonb_build_object(
        'ok', true,
        'event_id', v_event,
        'status', e.status::text,
        'after_end', v_after_end,
        'absents', jsonb_build_object('count', v_absent_count, 'list_available', v_after_end, 'list', v_list),
        'z', v_z,
        'finance', jsonb_build_object(
            'organizer_net', v_summary->'organizer_net',
            'online_sales', v_summary->'online_sales',
            'refunded', v_summary->'refunded',
            'available', v_summary->'available',
            'pending', v_summary->'pending',
            'buyer_service_fees', v_summary->'buyer_service_fees',
            'cash_sales', v_summary->'cash_sales',
            'cash_tickets', v_summary->'cash_tickets',
            'funds_available_from', v_from,
            'funds_available_to', v_to),
        'report', public.pilotage_compute_overview(v_event),
        'entries', public.pilotage_compute_entries(v_event, FALSE),
        'computed_at', now());
END;
$$;


-- ----------------------------------------------------------------------------
-- 8. F44 scan_refusal_alert (nouvelle) + trigger : alerte de refus en série à une porte (arbitrage 21, X8,
-- rectifications 1, 2 et 5 de D)
-- ----------------------------------------------------------------------------
-- Porte = event_gates de la ligne, sinon point d'entrée exact (même clé que by_gate et by_entry_point). Un refus hors
-- liste sort avant tout verrou ; une décision à la fois par (événement, porte) : verrou consultatif de transaction
-- puis comptage à clock_timestamp() (le comptage voit les refus validés pendant l'attente du verrou). Au plus une
-- alerte par porte et par durée : aucune alerte si la porte en a déjà reçu une dans la durée observée (lignes de
-- notification_outbox de même préfixe de clé, y compris celles de la transaction en cours), et clé
-- d'idempotence par tranche de durée (notif_enqueue : ON CONFLICT DO NOTHING). Destinataire : la propriétaire
-- seule ; compte suspendu : lignes SKIPPED ACCOUNT_SUSPENDED (politique BLOCK du registre). Le verdict du scan ne
-- dépend jamais de ce trigger. Aucune écriture dans admin_signals.
CREATE OR REPLACE FUNCTION public.scan_refusal_alert()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    s record;
    v_gate_key text;
    v_prefix text;
    v_now timestamptz;
    v_n integer;
    v_owner uuid;
    v_gate text;
    v_zone text;
BEGIN
    IF NOT public.scan_alert_refusal(NEW.result, NEW.zone_result) THEN
        RETURN NULL;
    END IF;
    v_gate_key := CASE WHEN NEW.gate_id IS NOT NULL THEN NEW.gate_id::text ELSE 'ep:' || COALESCE(NEW.entry_point, '') END;
    -- une seule décision à la fois par (événement, porte) : le comptage suivant voit les refus déjà validés
    PERFORM pg_advisory_xact_lock(hashtextextended('scan_refusal_alert:' || NEW.event_id::text || ':' || v_gate_key, 0));
    SELECT * INTO s FROM public.scan_refusal_alert_settings();
    v_now := clock_timestamp();
    SELECT count(*) INTO v_n FROM public.ticket_scans sc
     WHERE sc.event_id = NEW.event_id AND NOT sc.accepted
       AND sc.created_at > v_now - make_interval(mins => s.minutes)
       AND (CASE WHEN sc.gate_id IS NOT NULL THEN sc.gate_id::text ELSE 'ep:' || COALESCE(sc.entry_point, '') END) = v_gate_key
       AND public.scan_alert_refusal(sc.result, sc.zone_result);
    IF v_n < s.threshold THEN
        RETURN NULL;
    END IF;
    v_prefix := 'SCAN_REFUSALS_ALERT:' || NEW.event_id::text || ':' || md5(v_gate_key) || ':';
    IF EXISTS (SELECT 1 FROM public.notification_outbox o
                WHERE o.event_id = NEW.event_id AND o.type = 'SCAN_REFUSALS_ALERT'
                  AND left(o.group_key, length(v_prefix)) = v_prefix
                  AND o.created_at > v_now - make_interval(mins => s.minutes)) THEN
        RETURN NULL;
    END IF;
    SELECT p.user_id INTO v_owner FROM public.events e JOIN public.partners p ON p.id = e.partner_id WHERE e.id = NEW.event_id;
    IF v_owner IS NULL THEN
        -- aucun destinataire (événement sans compte partenaire) : rien à mettre en file, le scan n'en dépend pas
        RETURN NULL;
    END IF;
    IF NEW.gate_id IS NOT NULL THEN
        SELECT g.name, z.name INTO v_gate, v_zone
          FROM public.event_gates g JOIN public.event_zones z ON z.id = g.zone_id WHERE g.id = NEW.gate_id;
    ELSE
        v_gate := COALESCE(NULLIF(btrim(NEW.entry_point), ''), 'Point d’entrée non précisé');
    END IF;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'SCAN_REFUSALS_ALERT',
        'key', v_prefix || floor(extract(epoch FROM v_now) / (s.minutes * 60))::bigint,
        'user_id', v_owner,
        'event_id', NEW.event_id,
        'data', COALESCE(public.notif_event_data(NEW.event_id), '{}'::jsonb)
                || jsonb_build_object('gate_name', v_gate, 'zone_name', v_zone, 'refused_count', v_n,
                                      'window_minutes', s.minutes, 'threshold', s.threshold)));
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_scans_refusal_alert ON public.ticket_scans;
CREATE TRIGGER trg_ticket_scans_refusal_alert
    AFTER INSERT ON public.ticket_scans
    FOR EACH ROW
    WHEN (NOT NEW.accepted AND NEW.event_id IS NOT NULL)
    EXECUTE FUNCTION public.scan_refusal_alert();


-- ----------------------------------------------------------------------------
-- 9. F48 participants_export (recopie, 20261109000004_lot9bis_droits.sql:186-266) : origine au lieu du canal
-- (règle unique ticket_origin), zone et porte de l'entrée, « Invité, entré par la liste » ; tickets.guest_name
-- jamais lu (x12)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.participants_export(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_purpose text := NULLIF(btrim(COALESCE(p->>'purpose', '')), '');
    v_contacts boolean;
    v_code text;
    v_title text;
    v_rows jsonb;
    v_count integer;
    v_export uuid;
    v_configured boolean;
BEGIN
    -- Lot 9 bis (R2, B31) : téléphones et emails des participants pour un admin non propriétaire = partners.read
    IF p->'include_contacts' = 'true'::jsonb
       AND v_event IS NOT NULL AND v_actor IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.events WHERE id = v_event)
       AND NOT (SELECT pr.is_owner FROM public.event_actor_profile_perm(v_event, v_actor, 'partners.read') pr)
       AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text IN ('ADMIN', 'SUPERADMIN'))
       AND NOT public.admin_can(v_actor, 'partners.read') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PERMISSION_MISSING', 'permission', 'partners.read',
            'message', 'Action non autorisée : votre compte n’a pas la permission « Consulter les partenaires et leurs contacts ».');
    END IF;
    v_code := public.pilotage_access(v_event, v_actor);
    IF v_code IS NOT NULL THEN
        RETURN public.pilotage_refusal(v_code);
    END IF;
    IF jsonb_typeof(p->'include_contacts') IS DISTINCT FROM 'boolean' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT',
                                  'message', 'Indiquez si le téléphone et l’email doivent figurer dans l’export.');
    END IF;
    v_contacts := (p->>'include_contacts')::boolean;
    IF v_contacts AND (v_purpose IS NULL OR v_purpose NOT IN ('URGENT_EVENT_INFO', 'SAFETY_AND_RECEPTION')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PURPOSE_REQUIRED',
            'message', 'Pour exporter le téléphone et l’email, choisissez une finalité : information urgente sur l’événement, ou sécurité et accueil.');
    END IF;
    IF NOT v_contacts THEN
        v_purpose := NULL;
    END IF;
    SELECT title INTO v_title FROM public.events WHERE id = v_event;
    -- Lot 9 ter (9t.18) : sans zone, un billet entré l'est par la zone implicite « Entrée »
    v_configured := EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = v_event);

    -- Participants = billets VALIDE et UTILISE, invitations comprises ; ni paiement, ni prix, ni numéro de billet
    SELECT COALESCE(jsonb_agg(r.line ORDER BY r.sort_name NULLS LAST, r.category, r.created_at, r.id), '[]'::jsonb), count(*)
      INTO v_rows, v_count
      FROM (
          SELECT tk.id, tk.created_at, c.name AS category,
                 public.pilotage_display_name(u.first_name, u.last_name) AS sort_name,
                 jsonb_build_object(
                     'name', COALESCE(public.pilotage_display_name(u.first_name, u.last_name),
                                      CASE WHEN tk.user_id IS NULL AND tk.sale_channel = 'INVITATION' AND tk.status::text = 'UTILISE' THEN 'Invité, entré par la liste'
                                           WHEN tk.user_id IS NULL AND tk.sale_channel = 'INVITATION' THEN 'Invitation en attente'
                                           WHEN tk.user_id IS NULL THEN 'Vente au guichet' ELSE 'Participant sans nom' END),
                     'category', c.name,
                     'origin', public.ticket_origin_label(public.ticket_origin(tk.sale_channel, tk.price,
                                                                               pay.id IS NOT NULL AND NOT pay.is_platform_payment)),
                     'status', public.pilotage_ticket_status_label(tk.status::text),
                     'entered_at', CASE WHEN tk.status::text = 'UTILISE' THEN
                                       COALESCE(to_char(COALESCE(tk.checked_in_at, sc.created_at) AT TIME ZONE 'Africa/Dakar', 'DD/MM/YYYY HH24:MI'),
                                                'Entrée enregistrée')
                                   END,
                     'zone', COALESCE(z.name, CASE WHEN tk.status::text = 'UTILISE' AND NOT v_configured THEN 'Entrée' END),
                     'gate', COALESCE(g.name, sc.entry_point))
                 || CASE WHEN v_contacts THEN jsonb_build_object('phone', u.phone, 'email', u.email) ELSE '{}'::jsonb END AS line
            FROM public.tickets tk
            JOIN public.ticket_categories c ON c.id = tk.category_id
            LEFT JOIN public.users u ON u.id = tk.user_id
            LEFT JOIN public.payments pay ON pay.id = tk.payment_id
            LEFT JOIN LATERAL (SELECT x.created_at, x.zone_id, x.gate_id, x.entry_point FROM public.ticket_scans x
                                WHERE x.ticket_id = tk.id AND x.accepted ORDER BY x.created_at LIMIT 1) sc ON TRUE
            LEFT JOIN public.event_zones z ON z.id = sc.zone_id
            LEFT JOIN public.event_gates g ON g.id = sc.gate_id
           WHERE tk.event_id = v_event AND tk.status::text IN ('VALIDE', 'UTILISE')
      ) r;

    INSERT INTO public.participant_exports (event_id, actor_id, include_contacts, purpose, row_count)
    VALUES (v_event, v_actor, v_contacts, v_purpose, v_count)
    RETURNING id INTO v_export;

    RETURN jsonb_build_object('ok', true, 'export_id', v_export, 'event_id', v_event, 'title', v_title,
                              'include_contacts', v_contacts, 'purpose', v_purpose, 'row_count', v_count, 'rows', v_rows);
END;
$$;


-- ----------------------------------------------------------------------------
-- 10. Privilèges : service_role seul ; fonction de trigger (groupe c) : REVOKE seulement
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.ticket_origin_label(text)',
        'public.scan_alert_refusal(text, text)',
        'public.scan_refusal_alert_settings()',
        'public.pilotage_compute_entries(uuid, boolean)',
        'public.pilotage_compute_overview(uuid)',
        'public.pilotage_entries(jsonb)',
        'public.pilotage_closing(jsonb)',
        'public.participants_export(jsonb)',
        'public.pilotage_scan_result_label(text)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
    EXECUTE 'REVOKE ALL ON FUNCTION public.scan_refusal_alert() FROM PUBLIC, anon, authenticated';
END;
$$;
