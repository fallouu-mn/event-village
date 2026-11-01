-- ============================================================================
-- EVENT VILLAGE — LOT 5 : page de pilotage (5.10), liste du partenaire (5.11), liste admin (5.7),
-- invariant (l) (5.12)
-- ============================================================================
--  - Une seule source pour les chiffres d'un événement : les fonctions internes pilotage_compute_*
--    (service_role seul, reprises par l'invariant (l)) et les RPC pilotage_* qui vérifient l'accès
--    (partenaire propriétaire avec compte ACTIF, ou admin avec compte ACTIF ; sinon EVENT_NOT_FOUND,
--    sans aucune donnée). Aucun calcul dans le navigateur.
--  - Définitions (contrat I et U) :
--      vendus        = billets VALIDE et UTILISE, tous canaux, hors invitations (sale_channel INVITATION) ;
--      invitations   = billets VALIDE et UTILISE du canal INVITATION, comptés à part ;
--      capacité      = Σ total_quantity des catégories actives (events.capacity reste la jauge déclarée) ;
--      en cours      = réservations ACTIVE non échues ;
--      restants      = capacité − vendus − invitations − en cours (catégories actives) ;
--      CA en ligne   = grand livre ORGANISATEUR de l'événement, VENTE + REMBOURSEMENT (prix faciaux) ;
--      CA espèces    = Σ paiements hors plateforme SUCCESS de l'événement ;
--      remboursé     = remboursements en ligne + remboursements espèces à la charge de l'organisateur ;
--      entrées       = scans acceptés (= billets UTILISE), dont le guichet (méthode COUNTER) ;
--      refus         = tentatives non acceptées, hors cash_required consommé par un encaissement ;
--      taux          = entrées / (vendus + invitations).
--  - participants_export : liste fermée des finalités, journal participant_exports écrit dans la même
--    transaction que la lecture (RLS : propriétaire et admins), aucune donnée de paiement ni numéro de billet.
--  - event_controller_set_cash : permission espèces par affectation, propriétaire seul, journalisée.
--  - partner_events_overview : compteurs et totaux sur TOUS les événements du partenaire.
--  - admin_events_list : liste admin filtrée (statut, recherche littérale dans le titre), paginée, compteurs.
--  - finance_partner_summary : cash_sales n'inclut plus les billets sans paiement (« à régler sur place »
--    impayés).
-- Fuseau : Africa/Dakar (UTC+0 toute l'année, écrit explicitement pour les jours et les quarts d'heure).
-- ============================================================================

-- ── Journal des exports de participants ─────────────────────────────────────
-- actor_id sans clé étrangère : le journal garde l'auteur même si son compte est supprimé (ajout seul).
CREATE TABLE IF NOT EXISTS public.participant_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL,
    include_contacts BOOLEAN NOT NULL,
    purpose TEXT CHECK (purpose IS NULL OR purpose IN ('URGENT_EVENT_INFO', 'SAFETY_AND_RECEPTION')),
    row_count INTEGER NOT NULL CHECK (row_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT participant_exports_purpose_with_contacts CHECK (include_contacts = (purpose IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_participant_exports_event ON public.participant_exports (event_id, created_at);
COMMENT ON TABLE public.participant_exports IS
    'Lot 5 (5.10) : journal des exports de la liste des participants (acteur, contacts, finalité, nombre de lignes), écrit par participants_export dans la même transaction que la lecture. Aucune donnée de participant. Lecture : partenaire propriétaire et admins.';

ALTER TABLE public.participant_exports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.participant_exports FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.participant_exports TO authenticated, service_role;
DROP POLICY IF EXISTS participant_exports_owner_admin_select ON public.participant_exports;
CREATE POLICY participant_exports_owner_admin_select ON public.participant_exports
    FOR SELECT TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.events e
                    WHERE e.id = participant_exports.event_id AND public.is_partner_owner(e.partner_id))
    );

-- Ajout seul : seule la cascade de la suppression de l'événement efface une ligne.
CREATE OR REPLACE FUNCTION public.participant_exports_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = OLD.event_id) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Le journal des exports de participants est en ajout seul' USING ERRCODE = 'EV422';
END;
$$;
DROP TRIGGER IF EXISTS trg_participant_exports_append_only ON public.participant_exports;
CREATE TRIGGER trg_participant_exports_append_only BEFORE UPDATE OR DELETE ON public.participant_exports
    FOR EACH ROW EXECUTE FUNCTION public.participant_exports_append_only();

-- ── Libellés (jamais d'enum brut dans une réponse) ──────────────────────────
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
        ELSE 'Autre refus' END
$$;

CREATE OR REPLACE FUNCTION public.pilotage_ticket_status_label(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE p_status
        WHEN 'VALIDE' THEN 'Valide'
        WHEN 'UTILISE' THEN 'Utilisé'
        WHEN 'ANNULE' THEN 'Annulé'
        WHEN 'REMBOURSE' THEN 'Remboursé'
        WHEN 'REMBOURSEMENT_EN_COURS' THEN 'Remboursement en cours'
        ELSE 'Autre statut' END
$$;

-- Nom affichable d'un compte (prénom nom), NULL si vide
CREATE OR REPLACE FUNCTION public.pilotage_display_name(p_first text, p_last text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NULLIF(btrim(COALESCE(p_first, '') || ' ' || COALESCE(p_last, '')), '')
$$;

-- ── Accès ───────────────────────────────────────────────────────────────────
-- NULL si l'acteur peut lire le pilotage de l'événement, sinon le code du refus. Un tiers (partenaire
-- B, client) reçoit EVENT_NOT_FOUND, comme pour un événement inconnu : aucune donnée, aucun indice.
CREATE OR REPLACE FUNCTION public.pilotage_access(p_event uuid, p_actor uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    a record;
BEGIN
    IF p_event IS NULL OR p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event) THEN
        RETURN 'EVENT_NOT_FOUND';
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(p_event, p_actor);
    IF NOT (a.is_owner OR a.is_staff) THEN
        RETURN 'EVENT_NOT_FOUND';
    END IF;
    IF NOT a.is_active THEN
        RETURN 'ACCOUNT_NOT_ACTIVE';
    END IF;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.pilotage_refusal(p_code text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object('ok', false, 'code', p_code, 'message', CASE p_code
        WHEN 'EVENT_NOT_FOUND' THEN 'Événement introuvable.'
        WHEN 'ACCOUNT_NOT_ACTIVE' THEN 'Votre compte n’est pas actif.'
        WHEN 'INVALID_INPUT' THEN 'Demande invalide.'
        ELSE 'Accès refusé.' END)
$$;

-- ── Chiffres par catégorie (source de l'aperçu et des ventes) ───────────────
CREATE OR REPLACE FUNCTION public.pilotage_category_stats(p_event uuid)
RETURNS TABLE (
    category_id uuid, name text, price numeric, is_active boolean, is_visible boolean, total integer,
    sold bigint, invitations bigint, in_payment bigint, sold_online bigint, sold_cash bigint, sold_unpaid bigint,
    revenue_online numeric, sold_quantity integer, held_quantity integer, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT c.id, c.name::text, c.price::numeric, c.is_active, c.is_visible, c.total_quantity::integer,
           COALESCE(t.sold, 0)::bigint, COALESCE(t.invitations, 0)::bigint, COALESCE(r.held, 0)::bigint,
           COALESCE(t.online, 0)::bigint, COALESCE(t.cash, 0)::bigint, COALESCE(t.unpaid, 0)::bigint,
           COALESCE(t.revenue_online, 0)::numeric, c.sold_quantity::integer, c.held_quantity::integer, c.created_at
      FROM public.ticket_categories c
      LEFT JOIN LATERAL (
          SELECT count(*) FILTER (WHERE tk.sale_channel IS DISTINCT FROM 'INVITATION') AS sold,
                 count(*) FILTER (WHERE tk.sale_channel = 'INVITATION') AS invitations,
                 count(*) FILTER (WHERE tk.sale_channel IS DISTINCT FROM 'INVITATION' AND pay.is_platform_payment) AS online,
                 count(*) FILTER (WHERE tk.sale_channel IS DISTINCT FROM 'INVITATION' AND pay.id IS NOT NULL
                                    AND NOT pay.is_platform_payment) AS cash,
                 count(*) FILTER (WHERE tk.sale_channel IS DISTINCT FROM 'INVITATION' AND pay.id IS NULL AND tk.price > 0) AS unpaid,
                 COALESCE(sum(tk.price) FILTER (WHERE tk.sale_channel IS DISTINCT FROM 'INVITATION' AND pay.is_platform_payment), 0) AS revenue_online
            FROM public.tickets tk
            LEFT JOIN public.payments pay ON pay.id = tk.payment_id
           WHERE tk.category_id = c.id AND tk.status::text IN ('VALIDE', 'UTILISE')
      ) t ON TRUE
      LEFT JOIN LATERAL (
          SELECT COALESCE(sum(sr.quantity), 0) AS held
            FROM public.stock_reservations sr
           WHERE sr.category_id = c.id AND sr.status = 'ACTIVE' AND sr.expires_at > now()
      ) r ON TRUE
     WHERE c.event_id = p_event
$$;

-- ── Fonctions internes reprises par l'invariant (l) ─────────────────────────
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
           count(*) FILTER (WHERE NOT sc.accepted AND NOT (sc.result = 'cash_required' AND sc.consumed_at IS NOT NULL)) AS refused
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

-- pilotage_compute_cash(event_id) → { shifts[], by_controller[], totals } (contrat U) ; espèces d'une
-- caisse = Σ des paiements hors plateforme SUCCESS rattachés (égal à expected_cash_total, invariant (h)).
CREATE OR REPLACE FUNCTION public.pilotage_compute_cash(p_event uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH sh AS (
        SELECT s.id, s.controller_id, s.status::text AS status, s.opened_at, s.closed_at,
               s.opening_float_amount, s.expected_cash_total, s.declared_cash_total, s.discrepancy_amount,
               s.discrepancy_justification, s.closing_confirmed_by_pin,
               public.pilotage_display_name(u.first_name, u.last_name) AS controller_name,
               COALESCE(p.collected, 0) AS collected,
               COALESCE(p.scan_n, 0) AS scan_n, COALESCE(p.scan_amount, 0) AS scan_amount,
               COALESCE(p.counter_n, 0) AS counter_n, COALESCE(p.counter_amount, 0) AS counter_amount
          FROM public.controller_shifts s
          LEFT JOIN public.users u ON u.id = s.controller_id
          LEFT JOIN LATERAL (
              SELECT sum(pay.amount) AS collected,
                     count(*) FILTER (WHERE pay.metadata->>'source' = 'COUNTER_SALE') AS counter_n,
                     COALESCE(sum(pay.amount) FILTER (WHERE pay.metadata->>'source' = 'COUNTER_SALE'), 0) AS counter_amount,
                     count(*) FILTER (WHERE pay.metadata->>'source' IS DISTINCT FROM 'COUNTER_SALE') AS scan_n,
                     COALESCE(sum(pay.amount) FILTER (WHERE pay.metadata->>'source' IS DISTINCT FROM 'COUNTER_SALE'), 0) AS scan_amount
                FROM public.payments pay
               WHERE pay.shift_id = s.id AND NOT pay.is_platform_payment AND pay.status::text = 'SUCCESS'
          ) p ON TRUE
         WHERE s.event_id = p_event
    )
    SELECT jsonb_build_object(
        'shifts', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', sh.id,
                       'controller_id', sh.controller_id,
                       'controller_name', sh.controller_name,
                       'status', sh.status,
                       'opened_at', sh.opened_at,
                       'closed_at', sh.closed_at,
                       'opening_float', sh.opening_float_amount,
                       'cash_collected', sh.collected,
                       'expected', sh.expected_cash_total,
                       'declared', CASE WHEN sh.status = 'OUVERT' THEN NULL ELSE sh.declared_cash_total END,
                       'difference', CASE WHEN sh.status = 'OUVERT' THEN NULL ELSE sh.discrepancy_amount END,
                       'justification', sh.discrepancy_justification,
                       'pin_cosigned', COALESCE(sh.closing_confirmed_by_pin, false),
                       'scan_count', sh.scan_n,
                       'scan_amount', sh.scan_amount,
                       'counter_count', sh.counter_n,
                       'counter_amount', sh.counter_amount)
                   ORDER BY sh.opened_at, sh.id)
              FROM sh), '[]'::jsonb),
        'by_controller', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'controller_id', x.controller_id,
                       'name', x.name,
                       'cash_collected', x.collected,
                       'shifts', x.n,
                       'open_shifts', x.open_n)
                   ORDER BY x.collected DESC, x.controller_id)
              FROM (SELECT controller_id, max(controller_name) AS name, sum(collected) AS collected, count(*) AS n,
                           count(*) FILTER (WHERE status = 'OUVERT') AS open_n
                      FROM sh GROUP BY controller_id) x), '[]'::jsonb),
        'totals', jsonb_build_object(
            'cash_collected', COALESCE((SELECT sum(collected) FROM sh), 0),
            'open', (SELECT count(*) FROM sh WHERE status = 'OUVERT'),
            'closed', (SELECT count(*) FROM sh WHERE status <> 'OUVERT'),
            'difference', COALESCE((SELECT sum(discrepancy_amount) FROM sh WHERE status <> 'OUVERT'), 0)))
$$;

-- ── RPC des onglets (p : { event_id, actor_id }) ────────────────────────────
-- Aperçu : statut, actions possibles (event_actions), billets, chiffre d'affaires, entrées, taux
CREATE OR REPLACE FUNCTION public.pilotage_overview(p jsonb)
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
    v_actions jsonb;
    v_overview jsonb;
BEGIN
    v_code := public.pilotage_access(v_event, v_actor);
    IF v_code IS NOT NULL THEN
        RETURN public.pilotage_refusal(v_code);
    END IF;
    SELECT id, title, status, start_date, start_time, end_date, end_time, location, city, image_url, capacity
      INTO e FROM public.events WHERE id = v_event;
    v_actions := public.event_actions(jsonb_build_object('event_id', v_event, 'actor_id', v_actor));
    v_overview := public.pilotage_compute_overview(v_event);
    RETURN jsonb_build_object(
        'ok', true,
        'event', jsonb_build_object(
            'id', e.id, 'title', e.title, 'status', e.status::text,
            'status_label', public.event_status_label(e.status::text),
            'start_date', e.start_date, 'start_time', e.start_time, 'end_date', e.end_date, 'end_time', e.end_time,
            'end_at', public.event_end_at(e.id), 'location', e.location, 'city', e.city, 'image_url', e.image_url),
        'status', e.status::text,
        'status_label', public.event_status_label(e.status::text),
        'actions', COALESCE(v_actions->'actions', '[]'::jsonb),
        'can_edit', COALESCE((v_actions->>'can_edit')::boolean, false),
        'can_cancel', COALESCE((v_actions->>'can_cancel')::boolean, false),
        'last_reason', v_actions->'last_reason',
        'tickets', v_overview->'tickets',
        'entries', v_overview->'entries',
        'revenue', v_overview->'revenue',
        'computed_at', now());
END;
$$;

-- Ventes : par catégorie, et jour par jour (Dakar) sur la période de vente
CREATE OR REPLACE FUNCTION public.pilotage_sales(p jsonb)
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
    v_by_category jsonb;
    v_first date;
    v_last date;
    v_sale_start date;
    v_today date := (now() AT TIME ZONE 'Africa/Dakar')::date;
    v_end_day date;
    v_from date;
    v_to date;
    v_by_day jsonb;
BEGIN
    v_code := public.pilotage_access(v_event, v_actor);
    IF v_code IS NOT NULL THEN
        RETURN public.pilotage_refusal(v_code);
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'category_id', x.category_id,
               'name', x.name,
               'price', x.price,
               'is_active', x.is_active,
               'is_visible', x.is_visible,
               'total', x.total,
               'sold', x.sold,
               'sold_online', x.sold_online,
               'sold_cash', x.sold_cash,
               'sold_unpaid', x.sold_unpaid,
               'invitations', x.invitations,
               'in_payment', x.in_payment,
               -- Une catégorie inactive ne se vend plus : aucun restant
               'remaining', CASE WHEN x.is_active THEN x.total - x.sold - x.invitations - x.in_payment ELSE 0 END,
               'revenue_online', x.revenue_online,
               -- Contrôle : le compteur de stock en base suit-il les billets ?
               'sold_quantity_mismatch', x.sold_quantity IS DISTINCT FROM (x.sold + x.invitations)::integer)
             ORDER BY x.created_at, x.name, x.category_id), '[]'::jsonb)
      INTO v_by_category
      FROM public.pilotage_category_stats(v_event) x;

    SELECT min((tk.created_at AT TIME ZONE 'Africa/Dakar')::date), max((tk.created_at AT TIME ZONE 'Africa/Dakar')::date)
      INTO v_first, v_last
      FROM public.tickets tk
     WHERE tk.event_id = v_event AND tk.status::text IN ('VALIDE', 'UTILISE') AND tk.sale_channel IS DISTINCT FROM 'INVITATION';
    SELECT min((c.sale_start AT TIME ZONE 'Africa/Dakar')::date) INTO v_sale_start
      FROM public.ticket_categories c WHERE c.event_id = v_event AND c.is_active;
    v_end_day := (public.event_end_at(v_event) AT TIME ZONE 'Africa/Dakar')::date;

    v_by_day := '[]'::jsonb;
    IF v_first IS NOT NULL THEN
        -- Période : du début des ventes (ou de la première vente) à aujourd'hui, borné à la fin de l'événement
        v_from := LEAST(v_first, COALESCE(v_sale_start, v_first));
        v_to := GREATEST(v_last, LEAST(v_today, COALESCE(v_end_day, v_today)));
        IF v_to - v_from > 1000 THEN
            v_from := LEAST(v_first, v_to - 1000);
        END IF;
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                   'day', to_char(g.d, 'YYYY-MM-DD'),
                   'sold', COALESCE(x.sold, 0),
                   'sold_online', COALESCE(x.online, 0),
                   'sold_cash', COALESCE(x.cash, 0),
                   'revenue_online', COALESCE(x.revenue_online, 0))
                 ORDER BY g.d), '[]'::jsonb)
          INTO v_by_day
          FROM (SELECT gs::date AS d FROM generate_series(v_from::timestamp, v_to::timestamp, interval '1 day') gs) g
          LEFT JOIN (
              SELECT (tk.created_at AT TIME ZONE 'Africa/Dakar')::date AS d,
                     count(*) AS sold,
                     count(*) FILTER (WHERE pay.is_platform_payment) AS online,
                     count(*) FILTER (WHERE pay.id IS NOT NULL AND NOT pay.is_platform_payment) AS cash,
                     COALESCE(sum(tk.price) FILTER (WHERE pay.is_platform_payment), 0) AS revenue_online
                FROM public.tickets tk
                LEFT JOIN public.payments pay ON pay.id = tk.payment_id
               WHERE tk.event_id = v_event AND tk.status::text IN ('VALIDE', 'UTILISE')
                 AND tk.sale_channel IS DISTINCT FROM 'INVITATION'
               GROUP BY 1
          ) x ON x.d = g.d;
    END IF;

    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'by_category', v_by_category, 'by_day', v_by_day,
                              'computed_at', now());
END;
$$;

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
BEGIN
    v_code := public.pilotage_access(v_event, v_actor);
    IF v_code IS NOT NULL THEN
        RETURN public.pilotage_refusal(v_code);
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);

    SELECT count(*) FILTER (WHERE sc.accepted) AS total,
           count(*) FILTER (WHERE sc.accepted AND sc.method = 'COUNTER') AS counter,
           count(*) FILTER (WHERE NOT sc.accepted AND NOT (sc.result = 'cash_required' AND sc.consumed_at IS NOT NULL)) AS refused,
           count(*) FILTER (WHERE sc.result = 'cash_required' AND NOT sc.accepted AND sc.consumed_at IS NULL) AS cash_pending
      INTO s
      FROM public.ticket_scans sc
     WHERE sc.event_id = v_event;

    -- Par contrôleur (scanneurs et comptes qui ont déclaré un incident)
    WITH scans AS (
        SELECT sc.scanner_id,
               count(*) FILTER (WHERE sc.accepted) AS accepted,
               count(*) FILTER (WHERE NOT sc.accepted AND NOT (sc.result = 'cash_required' AND sc.consumed_at IS NOT NULL)) AS refused,
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
               'last_incident_at', inc.last_at)
             ORDER BY COALESCE(scans.accepted, 0) DESC, ids.scanner_id), '[]'::jsonb)
      INTO v_by_scanner
      FROM ids
      LEFT JOIN scans ON scans.scanner_id = ids.scanner_id
      LEFT JOIN inc ON inc.scanner_id = ids.scanner_id
      LEFT JOIN public.users u ON u.id = ids.scanner_id
      LEFT JOIN public.event_controllers ec ON ec.event_id = v_event AND ec.user_id = ids.scanner_id;

    -- Par point d'entrée (celui du moment du scan) ; les points d'entrée des affectations figurent même sans scan
    SELECT COALESCE(jsonb_agg(jsonb_build_object('entry_point', x.ep, 'accepted', x.accepted, 'refused', x.refused)
             ORDER BY x.accepted DESC, x.ep NULLS LAST), '[]'::jsonb)
      INTO v_by_entry
      FROM (
          SELECT u.ep, sum(u.accepted) AS accepted, sum(u.refused) AS refused
            FROM (
                SELECT sc.entry_point AS ep,
                       count(*) FILTER (WHERE sc.accepted) AS accepted,
                       count(*) FILTER (WHERE NOT sc.accepted AND NOT (sc.result = 'cash_required' AND sc.consumed_at IS NOT NULL)) AS refused
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

    -- Par catégorie (toutes les catégories de l'événement)
    SELECT COALESCE(jsonb_agg(jsonb_build_object('category_id', c.id, 'name', c.name, 'accepted', COALESCE(x.n, 0))
             ORDER BY c.created_at, c.name, c.id), '[]'::jsonb)
      INTO v_by_category
      FROM public.ticket_categories c
      LEFT JOIN (SELECT sc.category_id, count(*) AS n FROM public.ticket_scans sc
                  WHERE sc.event_id = v_event AND sc.accepted GROUP BY sc.category_id) x ON x.category_id = c.id
     WHERE c.event_id = v_event;

    -- Flux par quart d'heure, à Dakar (tout quart d'heure qui a une tentative)
    SELECT COALESCE(jsonb_agg(jsonb_build_object('start', x.q AT TIME ZONE 'Africa/Dakar', 'accepted', x.accepted, 'refused', x.refused)
             ORDER BY x.q), '[]'::jsonb)
      INTO v_by_quarter
      FROM (
          SELECT date_bin(interval '15 minutes', sc.created_at AT TIME ZONE 'Africa/Dakar', timestamp '2000-01-01 00:00:00') AS q,
                 count(*) FILTER (WHERE sc.accepted) AS accepted,
                 count(*) FILTER (WHERE NOT sc.accepted AND NOT (sc.result = 'cash_required' AND sc.consumed_at IS NOT NULL)) AS refused
            FROM public.ticket_scans sc
           WHERE sc.event_id = v_event
           GROUP BY 1
      ) x;

    -- Refus par motif (libellés français)
    SELECT COALESCE(jsonb_agg(jsonb_build_object('result', x.result, 'label', public.pilotage_scan_result_label(x.result), 'count', x.n)
             ORDER BY x.n DESC, x.result), '[]'::jsonb)
      INTO v_refusals
      FROM (SELECT sc.result, count(*) AS n FROM public.ticket_scans sc
             WHERE sc.event_id = v_event AND NOT sc.accepted AND NOT (sc.result = 'cash_required' AND sc.consumed_at IS NOT NULL)
             GROUP BY sc.result) x;

    -- Tentatives multiples : au moins 2 tentatives sur le même billet en 10 minutes, ou une tentative
    -- already_used ; le cash_required consommé par un encaissement n'est pas une tentative. Le numéro du
    -- billet n'est rendu qu'au partenaire propriétaire.
    WITH att AS (
        SELECT sc.id, sc.ticket_id, sc.result, sc.created_at,
               lag(sc.created_at) OVER (PARTITION BY sc.ticket_id ORDER BY sc.created_at, sc.id) AS prev_at
          FROM public.ticket_scans sc
         WHERE sc.event_id = v_event AND sc.ticket_id IS NOT NULL
           AND NOT (sc.result = 'cash_required' AND sc.consumed_at IS NOT NULL)
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

    RETURN jsonb_build_object(
        'ok', true,
        'event_id', v_event,
        'total', s.total,
        'counter', s.counter,
        'refused', s.refused,
        'cash_pending', s.cash_pending,
        'by_scanner', v_by_scanner,
        'by_entry_point', v_by_entry,
        'by_category', v_by_category,
        'by_quarter', v_by_quarter,
        'refusals_by_reason', v_refusals,
        'repeated_attempts', v_repeated,
        'incidents', v_incidents,
        'computed_at', now());
END;
$$;

-- Équipe : contrôleurs affectés, point d'entrée, permission espèces, caisse ouverte, dernière activité
CREATE OR REPLACE FUNCTION public.pilotage_team(p jsonb)
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
    v_rows jsonb;
BEGIN
    v_code := public.pilotage_access(v_event, v_actor);
    IF v_code IS NOT NULL THEN
        RETURN public.pilotage_refusal(v_code);
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'assignment_id', ec.id,
               'controller_id', ec.user_id,
               'name', COALESCE(public.pilotage_display_name(u.first_name, u.last_name), 'Compte sans nom'),
               'phone', u.phone,
               'account_status', u.status::text,
               'account_active', u.status::text = 'ACTIF',
               'entry_point', ec.entry_point,
               'can_accept_cash', ec.can_accept_cash,
               'assigned_at', ec.created_at,
               'open_shift_id', sh.id,
               'accepted', COALESCE(sc.accepted, 0),
               'last_activity_at', sc.last_at)
             ORDER BY public.pilotage_display_name(u.first_name, u.last_name) NULLS LAST, ec.id), '[]'::jsonb)
      INTO v_rows
      FROM public.event_controllers ec
      LEFT JOIN public.users u ON u.id = ec.user_id
      LEFT JOIN LATERAL (SELECT s.id FROM public.controller_shifts s
                          WHERE s.event_id = ec.event_id AND s.controller_id = ec.user_id AND s.status = 'OUVERT'
                          ORDER BY s.opened_at DESC LIMIT 1) sh ON TRUE
      LEFT JOIN LATERAL (SELECT count(*) FILTER (WHERE x.accepted) AS accepted, max(x.created_at) AS last_at
                           FROM public.ticket_scans x
                          WHERE x.event_id = ec.event_id AND x.scanner_id = ec.user_id) sc ON TRUE
     WHERE ec.event_id = v_event;

    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'controllers', v_rows,
                              'can_manage', a.is_owner, 'computed_at', now());
END;
$$;

-- Caisse : caisses ouvertes et clôturées, espèces par contrôleur, écarts, PIN régisseur (sans le haché)
CREATE OR REPLACE FUNCTION public.pilotage_cash(p jsonb)
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
    v_cash jsonb;
    v_pin_at timestamptz;
    v_has_pin boolean;
BEGIN
    v_code := public.pilotage_access(v_event, v_actor);
    IF v_code IS NOT NULL THEN
        RETURN public.pilotage_refusal(v_code);
    END IF;
    v_cash := public.pilotage_compute_cash(v_event);
    SELECT updated_at INTO v_pin_at FROM public.event_regisseur_pins WHERE event_id = v_event;
    v_has_pin := FOUND;
    RETURN jsonb_build_object(
        'ok', true,
        'event_id', v_event,
        'shifts', v_cash->'shifts',
        'by_controller', v_cash->'by_controller',
        'totals', v_cash->'totals',
        'pin', jsonb_build_object('hasPin', v_has_pin, 'updatedAt', v_pin_at),
        'computed_at', now());
END;
$$;

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
        'computed_at', now());
END;
$$;

-- ── Export des participants (liste fermée des finalités, journal dans la même transaction) ─────
-- p : { event_id, actor_id, include_contacts (booléen), purpose? } → { ok, export_id, row_count, rows[] }
CREATE OR REPLACE FUNCTION public.participants_export(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
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
BEGIN
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

    -- Participants = billets VALIDE et UTILISE, invitations comprises ; ni paiement, ni prix, ni numéro de billet
    SELECT COALESCE(jsonb_agg(r.line ORDER BY r.sort_name NULLS LAST, r.category, r.created_at, r.id), '[]'::jsonb), count(*)
      INTO v_rows, v_count
      FROM (
          SELECT tk.id, tk.created_at, c.name AS category,
                 public.pilotage_display_name(u.first_name, u.last_name) AS sort_name,
                 jsonb_build_object(
                     'name', COALESCE(public.pilotage_display_name(u.first_name, u.last_name),
                                      CASE WHEN tk.user_id IS NULL THEN 'Vente au guichet' ELSE 'Participant sans nom' END),
                     'category', c.name,
                     'status', public.pilotage_ticket_status_label(tk.status::text),
                     'entered_at', CASE WHEN tk.status::text = 'UTILISE' THEN
                                       COALESCE(to_char(COALESCE(tk.checked_in_at, sc.created_at) AT TIME ZONE 'Africa/Dakar', 'DD/MM/YYYY HH24:MI'),
                                                'Entrée enregistrée')
                                   END)
                 || CASE WHEN v_contacts THEN jsonb_build_object('phone', u.phone, 'email', u.email) ELSE '{}'::jsonb END AS line
            FROM public.tickets tk
            JOIN public.ticket_categories c ON c.id = tk.category_id
            LEFT JOIN public.users u ON u.id = tk.user_id
            LEFT JOIN LATERAL (SELECT x.created_at FROM public.ticket_scans x
                                WHERE x.ticket_id = tk.id AND x.accepted ORDER BY x.created_at LIMIT 1) sc ON TRUE
           WHERE tk.event_id = v_event AND tk.status::text IN ('VALIDE', 'UTILISE')
      ) r;

    INSERT INTO public.participant_exports (event_id, actor_id, include_contacts, purpose, row_count)
    VALUES (v_event, v_actor, v_contacts, v_purpose, v_count)
    RETURNING id INTO v_export;

    RETURN jsonb_build_object('ok', true, 'export_id', v_export, 'event_id', v_event, 'title', v_title,
                              'include_contacts', v_contacts, 'purpose', v_purpose, 'row_count', v_count, 'rows', v_rows);
END;
$$;

-- ── Permission espèces d'une affectation (propriétaire seul, journalisée) ───
-- p : { assignment_id, actor_id, can_accept_cash (booléen) }
CREATE OR REPLACE FUNCTION public.event_controller_set_cash(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_assignment uuid := public.try_uuid(p->>'assignment_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_value boolean;
    r record;
    v_staff boolean;
    v_open boolean;
BEGIN
    IF v_actor IS NULL OR jsonb_typeof(p->'can_accept_cash') IS DISTINCT FROM 'boolean' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Indiquez la permission espèces (oui ou non).');
    END IF;
    v_value := (p->>'can_accept_cash')::boolean;
    IF v_assignment IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ASSIGNMENT_NOT_FOUND', 'message', 'Affectation introuvable.');
    END IF;

    SELECT ec.id, ec.event_id, ec.user_id, ec.can_accept_cash, pa.user_id AS owner_id
      INTO r
      FROM public.event_controllers ec
      JOIN public.events e ON e.id = ec.event_id
      JOIN public.partners pa ON pa.id = e.partner_id
     WHERE ec.id = v_assignment
       FOR UPDATE OF ec;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ASSIGNMENT_NOT_FOUND', 'message', 'Affectation introuvable.');
    END IF;
    IF r.owner_id IS DISTINCT FROM v_actor THEN
        v_staff := EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text IN ('ADMIN', 'SUPERADMIN'));
        IF v_staff THEN
            RETURN jsonb_build_object('ok', false, 'code', 'OWNER_ONLY',
                                      'message', 'Seul le partenaire organisateur modifie la permission espèces de son équipe.');
        END IF;
        RETURN jsonb_build_object('ok', false, 'code', 'ASSIGNMENT_NOT_FOUND', 'message', 'Affectation introuvable.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;

    UPDATE public.event_controllers SET can_accept_cash = v_value WHERE id = r.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'CONTROLLER_CASH_PERMISSION_SET', 'event_controllers', r.id,
            jsonb_build_object('can_accept_cash', r.can_accept_cash),
            jsonb_build_object('can_accept_cash', v_value),
            jsonb_build_object('event_id', r.event_id, 'controller_id', r.user_id));
    v_open := EXISTS (SELECT 1 FROM public.controller_shifts s
                       WHERE s.event_id = r.event_id AND s.controller_id = r.user_id AND s.status = 'OUVERT');

    RETURN jsonb_build_object('ok', true, 'assignment_id', r.id, 'event_id', r.event_id, 'controller_id', r.user_id,
                              'can_accept_cash', v_value, 'changed', r.can_accept_cash IS DISTINCT FROM v_value,
                              'open_shift', v_open);
END;
$$;

-- ── Liste du partenaire : compteurs et totaux sur TOUS ses événements (5.11) ─
-- p : { actor_id } → { ok, counts: {statut: n}, totals: { events, tickets_sold, invitations, revenue_online, revenue_cash } }
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

    SELECT COALESCE(sum(l.amount), 0) INTO v_online
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
            'revenue_cash', v_cash),
        'computed_at', now());
END;
$$;

-- ── Liste admin des événements (5.7) ────────────────────────────────────────
-- p : { actor_id, status?, q?, page?, page_size? } → { ok, items[], page, page_size, total, counts }
-- Recherche littérale dans le titre (insensible à la casse ; % et _ sans valeur de joker) ; compteurs par
-- statut calculés avec la recherche mais sans le filtre de statut.
CREATE OR REPLACE FUNCTION public.admin_events_list(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_status_text text := NULLIF(btrim(COALESCE(p->>'status', '')), '');
    v_status event_status;
    v_q text := NULLIF(btrim(COALESCE(p->>'q', '')), '');
    v_page integer := 1;
    v_size integer := 20;
    v_total bigint;
    v_items jsonb;
    v_counts jsonb;
BEGIN
    IF v_actor IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF')
       OR NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Accès réservé aux administrateurs.');
    END IF;
    IF v_status_text IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.event_status'::regtype AND enumlabel = v_status_text) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_STATUS', 'message', 'Statut demandé inconnu.');
        END IF;
        v_status := v_status_text::event_status;
    END IF;
    IF v_q IS NOT NULL THEN
        v_q := lower(left(v_q, 100));
    END IF;
    IF jsonb_typeof(p->'page') = 'number' THEN
        v_page := GREATEST(LEAST(trunc((p->>'page')::numeric), 100000), 1)::integer;
    END IF;
    IF jsonb_typeof(p->'page_size') = 'number' THEN
        v_size := GREATEST(LEAST(trunc((p->>'page_size')::numeric), 50), 1)::integer;
    END IF;

    SELECT count(*) INTO v_total
      FROM public.events e
     WHERE (v_status IS NULL OR e.status = v_status)
       AND (v_q IS NULL OR strpos(lower(e.title), v_q) > 0);

    SELECT COALESCE(jsonb_agg(x.item ORDER BY x.created_at DESC, x.id DESC), '[]'::jsonb) INTO v_items
      FROM (
          SELECT e.id, e.created_at,
                 jsonb_build_object(
                     'id', e.id,
                     'title', e.title,
                     'status', e.status::text,
                     'status_label', public.event_status_label(e.status::text),
                     'start_date', e.start_date,
                     'start_time', e.start_time,
                     'end_date', e.end_date,
                     'end_time', e.end_time,
                     'location', e.location,
                     'city', e.city,
                     'image_url', e.image_url,
                     'created_at', e.created_at,
                     'updated_at', e.updated_at,
                     'submitted_at', (SELECT max(h.created_at) FROM public.event_status_history h
                                       WHERE h.event_id = e.id AND h.new_status = 'EN_ATTENTE'),
                     'partner', jsonb_build_object('id', pa.id, 'company_name', pa.company_name)) AS item
            FROM public.events e
            LEFT JOIN public.partners pa ON pa.id = e.partner_id
           WHERE (v_status IS NULL OR e.status = v_status)
             AND (v_q IS NULL OR strpos(lower(e.title), v_q) > 0)
           ORDER BY e.created_at DESC, e.id DESC
           LIMIT v_size OFFSET (v_page - 1)::bigint * v_size
      ) x;

    SELECT jsonb_object_agg(s.status, COALESCE(c.n, 0)) INTO v_counts
      FROM (SELECT enumlabel::text AS status FROM pg_enum WHERE enumtypid = 'public.event_status'::regtype) s
      LEFT JOIN (SELECT e.status::text AS status, count(*) AS n FROM public.events e
                  WHERE v_q IS NULL OR strpos(lower(e.title), v_q) > 0
                  GROUP BY 1) c ON c.status = s.status;

    RETURN jsonb_build_object('ok', true, 'items', v_items, 'page', v_page, 'page_size', v_size, 'total', v_total,
                              'counts', v_counts);
END;
$$;

-- ── finance_partner_summary : billets sans paiement exclus de cash_sales (contrat I) ─────────
-- Même définition qu'au lot 3, sauf les ventes espèces : seuls les billets rattachés à un paiement
-- hors plateforme SUCCESS y figurent (un billet « à régler sur place » impayé n'est pas une vente).
CREATE OR REPLACE FUNCTION public.finance_partner_summary(p_partner_id uuid, p_event_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ledger record;
    v_by_target jsonb;
    v_fees numeric;
    v_cash numeric;
    v_cash_count integer;
BEGIN
    SELECT COALESCE(sum(l.amount) FILTER (WHERE l.entry_type IN ('VENTE', 'REMBOURSEMENT')), 0) AS net,
           COALESCE(sum(l.amount) FILTER (WHERE l.entry_type = 'VENTE'), 0) AS sales,
           COALESCE(-sum(l.amount) FILTER (WHERE l.entry_type = 'REMBOURSEMENT'), 0) AS refunded,
           COALESCE(sum(l.amount) FILTER (WHERE l.entry_type IN ('VENTE', 'REMBOURSEMENT') AND l.available_at <= now()), 0) AS available,
           COALESCE(sum(l.amount) FILTER (WHERE l.entry_type IN ('VENTE', 'REMBOURSEMENT') AND l.available_at > now()), 0) AS pending
      INTO v_ledger
      FROM public.finance_ledger l
     WHERE l.partner_id = p_partner_id AND l.account_kind = 'ORGANISATEUR'
       AND (p_event_id IS NULL OR l.event_id = p_event_id);

    SELECT COALESCE(jsonb_object_agg(target, net), '{}'::jsonb) INTO v_by_target
      FROM (SELECT p.payment_target::text AS target, sum(l.amount) AS net
              FROM public.finance_ledger l JOIN public.payments p ON p.id = l.payment_id
             WHERE l.partner_id = p_partner_id AND l.account_kind = 'ORGANISATEUR'
               AND l.entry_type IN ('VENTE', 'REMBOURSEMENT')
               AND (p_event_id IS NULL OR l.event_id = p_event_id)
             GROUP BY p.payment_target) s;

    SELECT COALESCE(sum(t.service_fee), 0) INTO v_fees
      FROM public.tickets t
      JOIN public.events e ON e.id = t.event_id
      JOIN public.payments p ON p.id = t.payment_id
     WHERE e.partner_id = p_partner_id AND (p_event_id IS NULL OR t.event_id = p_event_id)
       AND p.is_platform_payment AND t.status IN ('VALIDE', 'UTILISE');

    SELECT COALESCE(sum(t.price), 0), count(*) INTO v_cash, v_cash_count
      FROM public.tickets t
      JOIN public.events e ON e.id = t.event_id
      JOIN public.payments p ON p.id = t.payment_id
     WHERE e.partner_id = p_partner_id AND (p_event_id IS NULL OR t.event_id = p_event_id)
       AND t.price > 0 AND t.status IN ('VALIDE', 'UTILISE')
       AND NOT p.is_platform_payment AND p.status::text = 'SUCCESS';

    RETURN jsonb_build_object(
        'partner_id', p_partner_id,
        'event_id', p_event_id,
        'organizer_net', v_ledger.net,
        'online_sales', v_ledger.sales,
        'refunded', v_ledger.refunded,
        'available', v_ledger.available,
        'pending', v_ledger.pending,
        'by_target', v_by_target,
        'buyer_service_fees', v_fees,
        'cash_sales', v_cash,
        'cash_tickets', v_cash_count);
END;
$$;

-- ── Privilèges ──────────────────────────────────────────────────────────────
DO $$
DECLARE
    f text;
BEGIN
    -- RPC et fonctions internes : service_role uniquement
    FOREACH f IN ARRAY ARRAY[
        'public.pilotage_scan_result_label(text)',
        'public.pilotage_ticket_status_label(text)',
        'public.pilotage_display_name(text, text)',
        'public.pilotage_access(uuid, uuid)',
        'public.pilotage_refusal(text)',
        'public.pilotage_category_stats(uuid)',
        'public.pilotage_compute_overview(uuid)',
        'public.pilotage_compute_cash(uuid)',
        'public.pilotage_overview(jsonb)',
        'public.pilotage_sales(jsonb)',
        'public.pilotage_entries(jsonb)',
        'public.pilotage_team(jsonb)',
        'public.pilotage_cash(jsonb)',
        'public.pilotage_closing(jsonb)',
        'public.participants_export(jsonb)',
        'public.event_controller_set_cash(jsonb)',
        'public.partner_events_overview(jsonb)',
        'public.admin_events_list(jsonb)',
        'public.finance_partner_summary(uuid, uuid)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
    -- Fonction de trigger : aucun EXECUTE pour anon et authenticated ; le service_role garde EXECUTE
    -- (contrôle 1A.3 de supabase/hotfix/2026-10-31-lot1a/03-verification.sql)
    EXECUTE 'REVOKE ALL ON FUNCTION public.participant_exports_append_only() FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.participant_exports_append_only() TO service_role';
END;
$$;
