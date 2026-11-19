-- ============================================================================
-- EVENT VILLAGE — DESIGN 1c bis, migration 01 : « Mes événements » en brut → remboursements → recettes nettes ;
-- message des réglages en mots simples
-- ============================================================================
-- 1. partner_events_overview : recopie de 20261102000005_lot5_pilotage.sql:1028-1092 ; ajouts : revenue_online_gross (Σ VENTE
--    du grand livre, compte ORGANISATEUR) et revenue_online_refunded (−Σ REMBOURSEMENT), même convention que
--    pilotage_compute_overview (online_gross, refunded_online) ; revenue_online (recettes nettes) inchangée.
-- 2. finance_setting_set : recopie de 20261123000101_l11a_reglages.sql:30-82 ; seul changement : le refus FORBIDDEN dit
--    « Seul un super-administrateur actif peut modifier les réglages. » (au lieu de « Seul un SUPERADMIN actif modifie
--    les réglages de la plateforme. », code brut affiché à l'écran des réglages).
-- Rejouable : CREATE OR REPLACE (droits d'exécution conservés : REVOKE/GRANT des migrations d'origine).
-- ============================================================================

-- 1. Recopie de 20261102000005_lot5_pilotage.sql:1028-1092 ; changement : brut et remboursements servis.
CREATE OR REPLACE FUNCTION public.partner_events_overview(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_partner uuid;
    v_counts jsonb;
    v_events bigint;
    t record;
    v_online numeric;
    v_gross numeric;
    v_refunded numeric;
    v_cash numeric;
BEGIN
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande invalide.');
    END IF;
    SELECT pa.id INTO v_partner FROM public.partners pa WHERE pa.user_id = v_actor ORDER BY pa.created_at, pa.id LIMIT 1;
    IF v_partner IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_FOUND', 'message', 'Profil partenaire introuvable pour ce compte.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;

    SELECT jsonb_object_agg(s.status, COALESCE(x.n, 0)), COALESCE(sum(x.n), 0)
      INTO v_counts, v_events
      FROM (SELECT enumlabel::text AS status FROM pg_enum WHERE enumtypid = 'public.event_status'::regtype) s
      LEFT JOIN (SELECT e.status::text AS status, count(*) AS n FROM public.events e
                  WHERE e.partner_id = v_partner GROUP BY 1) x ON x.status = s.status;

    SELECT count(*) FILTER (WHERE tk.sale_channel IS DISTINCT FROM 'INVITATION') AS sold,
           count(*) FILTER (WHERE tk.sale_channel = 'INVITATION') AS invitations
      INTO t
      FROM public.tickets tk
      JOIN public.events e ON e.id = tk.event_id
     WHERE e.partner_id = v_partner AND tk.status::text IN ('VALIDE', 'UTILISE');

    -- Design 1c bis : brut (Σ VENTE) et remboursements (−Σ REMBOURSEMENT), même convention que pilotage_compute_overview
    -- (online_gross, refunded_online) ; recettes nettes = brut − remboursements = Σ VENTE + REMBOURSEMENT (inchangé).
    SELECT COALESCE(sum(l.amount) FILTER (WHERE l.entry_type = 'VENTE'), 0),
           COALESCE(-sum(l.amount) FILTER (WHERE l.entry_type = 'REMBOURSEMENT'), 0),
           COALESCE(sum(l.amount), 0)
      INTO v_gross, v_refunded, v_online
      FROM public.finance_ledger l
     WHERE l.account_kind = 'ORGANISATEUR' AND l.entry_type IN ('VENTE', 'REMBOURSEMENT')
       AND l.event_id IN (SELECT e.id FROM public.events e WHERE e.partner_id = v_partner);

    SELECT COALESCE(sum(pay.amount), 0) INTO v_cash
      FROM public.payments pay
     WHERE pay.id IN (SELECT x.id FROM public.payments x JOIN public.events e ON e.id = x.event_id WHERE e.partner_id = v_partner
                      UNION
                      SELECT tk.payment_id FROM public.tickets tk JOIN public.events e ON e.id = tk.event_id
                       WHERE e.partner_id = v_partner AND tk.payment_id IS NOT NULL)
       AND NOT pay.is_platform_payment AND pay.status::text = 'SUCCESS';

    RETURN jsonb_build_object(
        'ok', true,
        'counts', v_counts,
        'totals', jsonb_build_object(
            'events', v_events,
            'tickets_sold', t.sold,
            'invitations', t.invitations,
            'revenue_online', v_online,
            'revenue_online_gross', v_gross,
            'revenue_online_refunded', v_refunded,
            'revenue_cash', v_cash),
        'computed_at', now());
END;
$$;

-- 2. Recopie de 20261123000101_l11a_reglages.sql:30-82 ; changement : message du refus FORBIDDEN.
CREATE OR REPLACE FUNCTION public.finance_setting_set(p_key text, p_value jsonb, p_actor uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb := p_value->'value';
BEGIN
    IF p_key IS NULL OR p_key NOT IN (
        'finance.service_fee_rate', 'finance.aggregator_fee_rate.WAVE', 'finance.aggregator_fee_rate.ORANGE_MONEY',
        'finance.cancellation_aggregator_fee_bearer', 'finance.payout_hold_enabled', 'finance.payout_delay_hours',
        'finance.withdrawal_fee_rate', 'finance.withdrawal_min_amount', 'finance.withdrawal_bank_enabled',
        'finance.referral_availability_days', 'access.manual_entry_scope', 'access.scan_window_before_hours',
        'access.scan_window_after_hours', 'access.counter_sale_enabled', 'access.low_stock_threshold',
        'notif.reminder_j1_enabled', 'notif.reminder_j1_hour', 'notif.reminder_h3_enabled', 'notif.reminder_h3_hours',
        'notif.j1_sms', 'notif.h3_sms', 'notif.sms_quiet_start', 'notif.sms_quiet_end',
        'notif.sms_optional_daily_cap', 'notif.free_ticket_reminder_sms',
        'features.halls_enabled', 'features.tables_enabled', 'features.orders_enabled',
        'finance.payment_hold_minutes', 'finance.min_paid_price', 'notif.sms_essential_daily_alert',
        'access.refusal_alert_threshold', 'access.refusal_alert_minutes',
        'support.whatsapp', 'support.phone', 'support.email',
        -- Finition 3a (2) : réserve de prudence
        'finance.safety_reserve_mode', 'finance.safety_reserve_amount',
        -- Lot 10a : réservation de salles
        'halls.service_fee_rate', 'halls.commission_rate', 'halls.deposit_default_percent', 'halls.balance_due_days',
        'halls.hold_minutes', 'halls.validation_required', 'halls.cancel_partial_percent', 'halls.cancel_souple_full_days',
        'halls.cancel_moderee_full_days', 'halls.cancel_moderee_partial_days', 'halls.cancel_stricte_partial_days',
        -- Correctifs de la contre-vérification du lot 10a (T4)
        'halls.full_payment_margin_hours',
        -- Lot 11a : réservation de tables
        'tables.service_fee_rate', 'tables.commission_rate', 'tables.validation_required', 'tables.slot_minutes',
        'tables.hold_minutes', 'tables.response_minutes', 'tables.no_show_minutes', 'tables.cancel_free_hours',
        'tables.max_pending_per_client', 'tables.reminder_hours') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_KEY', 'message', 'Réglage inconnu.');
    END IF;
    IF p_actor IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_roles r JOIN public.users u ON u.id = r.user_id
         WHERE r.user_id = p_actor AND r.role = 'SUPERADMIN' AND u.status = 'ACTIF'
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Seul un super-administrateur actif peut modifier les réglages.');
    END IF;
    IF NOT public.fin_setting_valid(p_key, v) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_VALUE', 'message', format('Valeur refusée pour %s : %s', p_key, COALESCE(v::text, 'absente')));
    END IF;
    PERFORM set_config('finance.change_reason', COALESCE(p_reason, ''), true);
    INSERT INTO public.platform_settings (key, value, updated_by, updated_at)
    VALUES (p_key, jsonb_build_object('value', v), p_actor, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
    RETURN jsonb_build_object('ok', true, 'key', p_key, 'value', v);
END;
$$;
