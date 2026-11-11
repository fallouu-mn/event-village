-- ============================================================================
-- EVENT VILLAGE — LOT 9 BIS : mode réel sûr (contrat M12, sections 3.1, 3.2 et 4.7 ; S-I, vague S3)
-- ============================================================================
-- Écrite tâche après tâche (section 10) :
--   Tâche I1 (contrat 5.63, X13, B108 ; D-ree 1) :
--     1. colonne public.users.demo_account (compte créé par seed:dev), écrite par service_role seul : aucune
--        autorisation de colonne n'est accordée (REVOKE UPDATE ON public.users, 20261031000003:17 ; les dernières
--        colonnes accordées sont retirées par 20261108000004_lot9_compte.sql:46) ;
--     2. index partiel idx_users_demo_account ;
--     3. notification_demo_recipients(p jsonb) (nouvelle, STABLE) : destinataires de démonstration d'un lot, lue par
--        l'envoyeur et par les envois synchrones (lib/notifications/demo-guard.ts) ;
--     4. reprise rejouable des comptes déjà semés (marque is_essai_fixture ou adresse du domaine du seed).
--   Tâche I2 (contrat 5.64, B109 ; D-ree 2) :
--     5. essai_check_reel(p jsonb DEFAULT '{}') (nouvelle, STABLE : PostgreSQL y refuse toute écriture) : ce qui
--        ferait partir de vrais messages ou de l'argent vers des comptes de démonstration ; lue par
--        npm run essai:check-reel (scripts/dev/essai-check-reel.mjs).
-- Aucune fonction existante recopiée. Aucun verrou pris (lectures seules, puis une reprise de users par ligne).
-- Aucun BEGIN ni COMMIT ; rejouable (ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, CREATE OR REPLACE, reprise
-- gardée par IS DISTINCT FROM). DDL et fonctions d'abord, DML en fin de fichier.
-- ============================================================================


-- ============================================================================
-- Tâche I1 — 1, 2. users.demo_account et son index
-- ============================================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS demo_account boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.demo_account IS
    'Lot 9 bis (I1) : compte créé par seed:dev. Hors simulation, aucun SMS, email ni push ne lui est envoyé. Seul service_role l''écrit.';

CREATE INDEX IF NOT EXISTS idx_users_demo_account ON public.users (id) WHERE demo_account;


-- ============================================================================
-- Tâche I1 — 3. notification_demo_recipients (nouvelle)
-- ============================================================================
-- p = { items: [{ key, user_id?, phone?, email?, event_id? }] }, 500 éléments au plus.
-- Un élément est retenu (sa clé figure dans `blocked`) si l'une de ces règles est vraie, les mêmes que les
-- invariants w15 et w16 (tests/helpers/lot9bis-invariants.ts) :
--   (a) user_id est un compte demo_account ;
--   (b) les 9 derniers chiffres du numéro sont ceux d'un compte demo_account (formes +221…, 221…, 00221…, 7…) ;
--   (c) l'adresse, en minuscules, est celle d'un compte demo_account, ou appartient au domaine du seed
--       (suffixe exact, celui de SEED_DOMAIN de scripts/dev/seed-dev.core.ts) ;
--   (d) l'événement appartient à une partenaire dont le compte est demo_account.
-- Retour : { ok: true, blocked: [clé…] } ; { ok: false, code: INVALID_INPUT, message }. Aucun numéro ni adresse rendu.
CREATE OR REPLACE FUNCTION public.notification_demo_recipients(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
    v_items   jsonb := p -> 'items';
    v_blocked jsonb;
BEGIN
    IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT',
            'message', 'Liste de destinataires attendue (500 au plus).');
    END IF;

    WITH demo AS (
        SELECT u.id,
               right(regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g'), 9) AS phone9,
               lower(COALESCE(u.email, '')) AS email
          FROM public.users u
         WHERE u.demo_account
    ), demo_events AS (
        SELECT e.id
          FROM public.events e
          JOIN public.partners pa ON pa.id = e.partner_id
          JOIN demo d ON d.id = pa.user_id
    ), items AS (
        SELECT i ->> 'key' AS key,
               CASE WHEN COALESCE(i ->> 'user_id', '') ~ v_uuid_re THEN (i ->> 'user_id')::uuid END AS user_id,
               right(regexp_replace(COALESCE(i ->> 'phone', ''), '[^0-9]', '', 'g'), 9) AS phone9,
               lower(btrim(COALESCE(i ->> 'email', ''))) AS email,
               CASE WHEN COALESCE(i ->> 'event_id', '') ~ v_uuid_re THEN (i ->> 'event_id')::uuid END AS event_id
          FROM jsonb_array_elements(v_items) AS i
         WHERE jsonb_typeof(i) = 'object'
           AND COALESCE(i ->> 'key', '') <> ''
    )
    SELECT COALESCE(jsonb_agg(DISTINCT it.key), '[]'::jsonb)
      INTO v_blocked
      FROM items it
     WHERE COALESCE(it.user_id IN (SELECT d.id FROM demo d), FALSE)
        OR (it.phone9 <> '' AND it.phone9 IN (SELECT d.phone9 FROM demo d WHERE d.phone9 <> ''))
        OR (it.email <> '' AND it.email IN (SELECT d.email FROM demo d WHERE d.email <> ''))
        OR it.email LIKE '%@essai.eventvillage.invalid'
        OR COALESCE(it.event_id IN (SELECT de.id FROM demo_events de), FALSE);

    RETURN jsonb_build_object('ok', true, 'blocked', v_blocked);
END;
$$;

REVOKE ALL ON FUNCTION public.notification_demo_recipients(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_demo_recipients(jsonb) TO service_role;
COMMENT ON FUNCTION public.notification_demo_recipients(jsonb) IS
    'Lot 9 bis (I1) : clés des destinataires de démonstration d''un lot (compte, numéro, adresse, événement d''une partenaire de démonstration). Service_role uniquement.';


-- ============================================================================
-- Tâche I2 — 5. essai_check_reel (nouvelle, STABLE)
-- ============================================================================
-- Rubriques (forme figée par tests/schema/essai-check-reel.test.ts) ; aucun numéro, aucune adresse, aucun nom rendu :
--   outbox   : lignes PENDING ou SENDING hors IN_APP, total et détail par canal ;
--   payments : paiements simulés PENDING ; 10 exemples { id, created_at, amount } ;
--   cashouts : versements A_ENVOYER, ENVOYE ou INCERTAIN, simulés hors blocage SIMULATED (un versement simulé refusé
--              par un serveur réel reste bloqué SIMULATED pour toujours, D-ree constat 10), ou réels vers un compte de
--              démonstration (D-I2-1) ; 10 exemples { id, kind, status, amount } ;
--   tickets  : billets VALIDE sur un événement ni ANNULE ni TERMINE dont la fin (event_end_at) est à venir, quand le
--              porteur est un compte de démonstration, le paiement est simulé ou l'événement appartient à une
--              partenaire de démonstration ; regroupés par événement { event_id, title, slug, status, start_date, count } ;
--   seed_events_on_sale : événements PUBLIE à venir d'une partenaire de démonstration, information sans effet sur le
--              code de sortie du script (D-I2-2) { event_id, title, slug, start_date }.
-- `p` est réservé (aucune option) ; la signature (p jsonb) est celle de toutes les RPC appelées par PostgREST.
CREATE OR REPLACE FUNCTION public.essai_check_reel(p jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_outbox   jsonb;
    v_payments jsonb;
    v_cashouts jsonb;
    v_tickets  jsonb;
    v_seed     jsonb;
BEGIN
    SELECT jsonb_build_object(
               'total', count(*),
               'sms',   count(*) FILTER (WHERE o.channel = 'SMS'),
               'email', count(*) FILTER (WHERE o.channel = 'EMAIL'),
               'push',  count(*) FILTER (WHERE o.channel = 'PUSH'))
      INTO v_outbox
      FROM public.notification_outbox o
     WHERE o.status IN ('PENDING', 'SENDING')
       AND o.channel <> 'IN_APP';

    WITH pending AS (
        SELECT pay.id, pay.created_at, pay.amount
          FROM public.payments pay
         WHERE pay.simulated
           AND pay.status::text = 'PENDING'
    )
    SELECT jsonb_build_object(
               'total', (SELECT count(*) FROM pending),
               'examples', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'created_at', x.created_at, 'amount', x.amount)
                                                      ORDER BY x.created_at, x.id)
                                       FROM (SELECT * FROM pending ORDER BY created_at, id LIMIT 10) x), '[]'::jsonb))
      INTO v_payments;

    WITH running AS (
        SELECT c.id, c.kind, c.status, c.amount, c.created_at
          FROM public.cashouts c
         WHERE c.status IN ('A_ENVOYER', 'ENVOYE', 'INCERTAIN')
           AND ((c.simulated AND c.blocked_reason IS DISTINCT FROM 'SIMULATED')
                OR (NOT c.simulated AND EXISTS (SELECT 1 FROM public.users u
                                                 WHERE u.id = c.beneficiary_user_id AND u.demo_account)))
    )
    SELECT jsonb_build_object(
               'total', (SELECT count(*) FROM running),
               'examples', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'kind', x.kind, 'status', x.status, 'amount', x.amount)
                                                      ORDER BY x.created_at, x.id)
                                       FROM (SELECT * FROM running ORDER BY created_at, id LIMIT 10) x), '[]'::jsonb))
      INTO v_cashouts;

    WITH demo_partners AS (
        SELECT pa.id
          FROM public.partners pa
          JOIN public.users u ON u.id = pa.user_id
         WHERE u.demo_account
    ), per_event AS (
        SELECT e.id, e.title, e.slug, e.status::text AS status, e.start_date, count(*) AS n
          FROM public.tickets t
          JOIN public.events e ON e.id = t.event_id
          LEFT JOIN public.payments pay ON pay.id = t.payment_id
          LEFT JOIN public.users holder ON holder.id = t.user_id
         WHERE t.status::text = 'VALIDE'
           AND e.status::text NOT IN ('ANNULE', 'TERMINE')
           AND public.event_end_at(e.id) > now()
           AND (COALESCE(holder.demo_account, FALSE)
                OR COALESCE(pay.simulated, FALSE)
                OR e.partner_id IN (SELECT dp.id FROM demo_partners dp))
         GROUP BY e.id, e.title, e.slug, e.status, e.start_date
    )
    SELECT jsonb_build_object(
               'total', COALESCE((SELECT sum(pe.n)::bigint FROM per_event pe), 0),
               'events', COALESCE((SELECT jsonb_agg(jsonb_build_object('event_id', pe.id, 'title', pe.title, 'slug', pe.slug,
                                                                       'status', pe.status, 'start_date', pe.start_date, 'count', pe.n)
                                                    ORDER BY pe.start_date, pe.id)
                                     FROM per_event pe), '[]'::jsonb))
      INTO v_tickets;

    WITH on_sale AS (
        SELECT e.id, e.title, e.slug, e.start_date
          FROM public.events e
          JOIN public.partners pa ON pa.id = e.partner_id
          JOIN public.users u ON u.id = pa.user_id
         WHERE u.demo_account
           AND e.status::text = 'PUBLIE'
           AND public.event_end_at(e.id) > now()
    )
    SELECT jsonb_build_object(
               'total', (SELECT count(*) FROM on_sale),
               'events', COALESCE((SELECT jsonb_agg(jsonb_build_object('event_id', s.id, 'title', s.title, 'slug', s.slug, 'start_date', s.start_date)
                                                    ORDER BY s.start_date, s.id)
                                     FROM on_sale s), '[]'::jsonb))
      INTO v_seed;

    RETURN jsonb_build_object(
        'ok', true,
        'outbox', v_outbox,
        'payments', v_payments,
        'cashouts', v_cashouts,
        'tickets', v_tickets,
        'seed_events_on_sale', v_seed);
END;
$$;

REVOKE ALL ON FUNCTION public.essai_check_reel(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.essai_check_reel(jsonb) TO service_role;
COMMENT ON FUNCTION public.essai_check_reel(jsonb) IS
    'Lot 9 bis (I2) : contrôle avant le passage en réel (file des notifications, paiements et versements simulés, billets de démonstration à venir). Lecture seule (STABLE), service_role uniquement.';


-- ============================================================================
-- Tâche I1 — 4. Reprise des comptes déjà semés (DML, en fin de fichier)
-- ============================================================================
-- Les deux critères de countRealAccounts (scripts/dev/seed-dev.core.ts) : marque is_essai_fixture posée par le seed
-- dans user_metadata, ou adresse du domaine du seed. Rejouable : seules les lignes encore à false sont écrites.
UPDATE public.users u
   SET demo_account = true
  FROM auth.users a
 WHERE a.id = u.id
   AND u.demo_account IS DISTINCT FROM true
   AND ((a.raw_user_meta_data ->> 'is_essai_fixture') = 'true'
        OR lower(COALESCE(a.email, '')) LIKE '%@essai.eventvillage.invalid');
