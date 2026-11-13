-- ============================================================================
-- EVENT VILLAGE — LOT 9 QUINQUIES : contrôle avant le réel, contact du support (B1 : AUTH-06)
-- ============================================================================
-- B1 (décision du chef de projet) : npm run essai:check-reel exige au moins un moyen de joindre le support (réglages
--   support.whatsapp, support.phone, support.email) avant une séance réelle. Le script garde UNE seule lecture : la RPC.
-- Objet : recopie de essai_check_reel (20261109000012_lot9bis_mode_reel.sql:118-221) ; changement : champ `support`
--   (nombre de réglages renseignés). Droits inchangés (CREATE OR REPLACE ; service_role seul).
-- Aucun BEGIN ni COMMIT ; rejouable.
-- ============================================================================

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

    -- Lot 9 quinquies (B1 : AUTH-06) : réglages du contact du support renseignés (au moins un exigé avant le réel)
    RETURN jsonb_build_object(
        'ok', true,
        'outbox', v_outbox,
        'payments', v_payments,
        'cashouts', v_cashouts,
        'tickets', v_tickets,
        'seed_events_on_sale', v_seed,
        'support', jsonb_build_object('filled', (
            SELECT count(*) FROM public.platform_settings s
             WHERE s.key IN ('support.whatsapp', 'support.phone', 'support.email')
               AND jsonb_typeof(s.value -> 'value') = 'string' AND btrim(s.value ->> 'value') <> '')));
END;
$$;
