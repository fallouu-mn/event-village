-- ============================================================================
-- EVENT VILLAGE — LOT 9 TER : événements (contrat 3.1 n° 07, 3.4 F17 à F20, 3.6 B.2.3, 5.B 9t.9 et 9t.12)
-- ============================================================================
-- Rejouable : aucun BEGIN ni COMMIT ; ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY IF EXISTS puis CREATE,
-- ON CONFLICT DO NOTHING, privilèges réappliqués. DDL avant toute fonction ; aucune donnée reprise.
-- Tâches fusionnées, dans l'ordre de leurs commits (section 10) :
--  9t.9 (consigne 0.8, R93, fix(9t.9)) — verrous d'écran servis par le serveur :
--   2. event_edit_locks(p_event uuid) (nouvelle, F17) : photo des verrous de modification d'un événement, mêmes
--      expressions qu'event_update (20261109000009_lot9bis_messages.sql:605-618) et mêmes aides « il y a des ventes »
--      (event_has_sales, ticket_category_has_sales, 20261102000004_lot5_edition.sql:189-209 : un billet de tout
--      statut ou une réservation ACTIVE). Lecture sans verrou : le serveur reste juge à l'enregistrement.
--  9t.12 (consigne 0.8, R106 a et c, fix(9t.12)) — VALIDE jamais publié terminé par le cron, retraits en cours au brut :
--   1. Colonne events.ended_unpublished (faux par défaut : tout l'existant se comporte comme avant), posée par le cron
--      seul au passage VALIDE → TERMINE, jamais remise à faux. Aucune écriture REST (migration 01, x2).
--   3. events_finish_overdue (recopie F18, base 20261102000003_lot5_cycle.sql:828-854) : prend aussi les VALIDE dont
--      la fin est passée ; drapeau posé AVANT la transition (les synchronisations publiques le lisent au changement de
--      statut). Retour { ok, finished, ids } inchangé ; SKIP LOCKED : deux crons ne traitent la ligne qu'une fois.
--      Aucun message : EVENT_FINISHED n'est émis que depuis PUBLIE (20261109000009:339).
--   4. scan_event_problem (recopie F19, base 20261102000003_lot5_cycle.sql:871-892) : un événement terminé sans
--      publication n'est jamais scannable (event_not_open), au scan, au guichet et aux caisses (D-R106-1, B-D21).
--   5. finance_account_balance (recopie F20, base 20261109000006_lot9bis_argent.sql:601-643) : in_progress = somme des
--      montants bruts des retraits en cours (le grand livre réserve le brut, frais compris ; D-R106-3, B-D23).
--   6. Vue events_public_status (base 20261102000001_lot5_securite.sql:55-64) : sans les événements terminés sans
--      publication ; mêmes colonnes et privilèges.
--   7. Politique events_read_public (base 20261102000003_lot5_cycle.sql:1111-1117) : idem ; SELECT seulement.
--   8. Transition VALIDE → TERMINE (SYSTEM, CRON) : 17 lignes dans event_status_transitions.
--      Les résumés publics (public_event_state_sync, public_category_stock_sync) sont recopiés par la migration 11
--      (S-K, fix(9t.12-SK)) : une seule recopie par fonction.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- (1) DDL (9t.12) : events.ended_unpublished.
-- ----------------------------------------------------------------------------
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ended_unpublished boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.events.ended_unpublished IS
    'Lot 9 ter (R106 a) : vrai seulement quand le cron termine un événement VALIDE jamais publié ; jamais remis à faux. Un tel événement n''est ni public ni scannable.';


-- ----------------------------------------------------------------------------
-- (2) F17 event_edit_locks (nouvelle, 9t.9) : lue par GET /api/partner/events/[id] (clé edit_locks).
--     has_sales            : event_has_sales (règle d'event_update, LOCKED_AFTER_SALES) ;
--     engaged              : vendus + en cours de paiement, toutes catégories ;
--     active_quota         : somme des quotas des catégories actives (CAPACITY_BELOW_QUOTAS) ;
--     capacity_floor       : plancher de la jauge (avec ventes : max(engaged, active_quota) ; sinon active_quota) ;
--     capacity_removable   : la jauge peut être retirée (aucune vente) ;
--     categories[]         : { id, has_sales } par catégorie (ticket_category_has_sales), triées par identifiant.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_edit_locks(p_event uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH s AS (
        SELECT public.event_has_sales(p_event) AS has_sales,
               COALESCE(sum(c.sold_quantity + c.held_quantity), 0)::int AS engaged,
               COALESCE(sum(c.total_quantity) FILTER (WHERE c.is_active), 0)::int AS active_quota
          FROM public.ticket_categories c WHERE c.event_id = p_event)
    SELECT jsonb_build_object(
        'has_sales', s.has_sales,
        'engaged', s.engaged,
        'active_quota', s.active_quota,
        'capacity_floor', CASE WHEN s.has_sales THEN GREATEST(s.engaged, s.active_quota) ELSE s.active_quota END,
        'capacity_removable', NOT s.has_sales,
        'categories', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'has_sales', public.ticket_category_has_sales(c.id)) ORDER BY c.id)
                                  FROM public.ticket_categories c WHERE c.event_id = p_event), '[]'::jsonb))
      FROM s
$$;
COMMENT ON FUNCTION public.event_edit_locks(uuid) IS
    'Lot 9 ter (R93, F17) : verrous de modification d''un événement pour l''écran, mêmes règles qu''event_update ; photo sans verrou.';


-- ----------------------------------------------------------------------------
-- (3) F18 events_finish_overdue (recopie de 20261102000003_lot5_cycle.sql:828-854, 9t.12) : + VALIDE fini.
-- ── D7 : passage automatique à TERMINE (cron) ───────────────────────────────
-- p : { limit } → { ok, finished, ids }
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.events_finish_overdue(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit integer := 200;
    r record;
    v_ids uuid[] := ARRAY[]::uuid[];
BEGIN
    IF p ? 'limit' AND jsonb_typeof(p->'limit') = 'number' THEN
        v_limit := LEAST(GREATEST((p->>'limit')::numeric::integer, 1), 1000);
    END IF;
    FOR r IN
        SELECT e.id, e.status::text AS status FROM public.events e
         WHERE e.status IN ('PUBLIE', 'VALIDE') AND public.event_end_at(e.id) < now()
         ORDER BY e.id
         LIMIT v_limit
           FOR UPDATE SKIP LOCKED
    LOOP
        IF r.status = 'VALIDE' THEN
            -- Lot 9 ter (R106 a) : jamais publié ; drapeau posé avant la transition, jamais remis à faux
            UPDATE public.events SET ended_unpublished = TRUE
             WHERE id = r.id AND status = 'VALIDE' AND ended_unpublished IS DISTINCT FROM TRUE;
            PERFORM public.event_status_apply(r.id, 'VALIDE', 'TERMINE', NULL, 'SYSTEM', NULL, 'CRON');
        ELSE
            PERFORM public.event_status_apply(r.id, 'PUBLIE', 'TERMINE', NULL, 'SYSTEM', NULL, 'CRON');
        END IF;
        v_ids := array_append(v_ids, r.id);
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'finished', COALESCE(array_length(v_ids, 1), 0), 'ids', to_jsonb(v_ids));
END;
$$;


-- ----------------------------------------------------------------------------
-- (4) F19 scan_event_problem (recopie de 20261102000003_lot5_cycle.sql:871-892, 9t.12) : + terminé sans publication.
-- TERMINE reste ouvert au scan et à l'encaissement jusqu'à la fermeture de la fenêtre ; ANNULE et SUSPENDU refusés
-- Lot 9 ter (R106 a) : un événement terminé sans avoir été publié n'est jamais ouvert (event_not_open, comme un VALIDE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scan_event_problem(p_event uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status text;
    v_unpublished boolean;
    w record;
BEGIN
    SELECT status::text, ended_unpublished INTO v_status, v_unpublished FROM public.events WHERE id = p_event;
    IF v_status IS NULL THEN RETURN 'invalid'; END IF;
    IF v_status = 'ANNULE' THEN RETURN 'event_cancelled'; END IF;
    IF v_status = 'SUSPENDU' THEN RETURN 'event_suspended'; END IF;
    IF v_status NOT IN ('PUBLIE', 'TERMINE') THEN RETURN 'event_not_open'; END IF;
    IF v_unpublished THEN RETURN 'event_not_open'; END IF;
    SELECT * INTO w FROM public.scan_window(p_event);
    IF now() > w.closes_at THEN RETURN 'event_ended'; END IF;
    IF now() < w.opens_at THEN RETURN 'event_not_open'; END IF;
    RETURN NULL;
END;
$$;


-- ----------------------------------------------------------------------------
-- (5) F20 finance_account_balance (recopie de 20261109000006_lot9bis_argent.sql:601-643, 9t.12 c) :
--     in_progress au brut réservé (frais compris), comme le grand livre ; autres clés inchangées.
-- 3.1 finance_account_balance (recopie de 20261101000004_lot3_grand_livre.sql:304-339) : + frozen, withdrawable
--     réduit du gel (tâche 2) ; + withdrawal_min_amount, withdrawal_fee_rate (tâche 10).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_account_balance(p_owner uuid, p_kind text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_available numeric;
    v_pending numeric;
    v_next timestamptz;
    v_in_progress numeric;
    v_debt numeric;
    v_frozen numeric;
BEGIN
    IF p_kind NOT IN ('ORGANISATEUR', 'PARRAINAGE') THEN
        RAISE EXCEPTION 'finance_account_balance : compte % inconnu', p_kind;
    END IF;
    SELECT COALESCE(sum(amount) FILTER (WHERE available_at <= now()), 0),
           COALESCE(sum(amount) FILTER (WHERE available_at > now()), 0),
           min(available_at) FILTER (WHERE available_at > now() AND amount > 0)
      INTO v_available, v_pending, v_next
      FROM public.finance_ledger WHERE owner_id = p_owner AND account_kind = p_kind;
    -- Lot 9 ter (R106 c) : montant brut réservé par le grand livre (frais compris), et non le net versé
    SELECT COALESCE(sum(gross_amount), 0) INTO v_in_progress
      FROM public.withdrawals WHERE user_id = p_owner AND account_kind = p_kind AND status IN ('PENDING', 'PROCESSING');
    SELECT COALESCE(sum(remaining), 0) INTO v_debt
      FROM public.finance_debts WHERE owner_id = p_owner AND account_kind = p_kind;
    -- Lot 9 bis (R4) : gel calculé, `available` inchangé (invariant (e))
    v_frozen := public.fin_frozen_amount(p_owner, p_kind, now());
    RETURN jsonb_build_object(
        'account_kind', p_kind,
        'available', v_available,
        'pending', v_pending,
        'next_available_at', v_next,
        'in_progress', v_in_progress,
        'debt', v_debt,
        'frozen', v_frozen,
        'withdrawable', public.fin_round_down(GREATEST(v_available - v_frozen, 0)),
        -- Lot 9 bis (R62, B27) : règles servies à l'écran avant la demande du code
        'withdrawal_min_amount', public.fin_setting_num('finance.withdrawal_min_amount'),
        'withdrawal_fee_rate', public.fin_setting_num('finance.withdrawal_fee_rate'));
END;
$$;


-- ----------------------------------------------------------------------------
-- (6) Vue events_public_status (base 20261102000001_lot5_securite.sql:55-64, 9t.12) : modifiée, pas créée (A4).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.events_public_status
WITH (security_barrier = true) AS
SELECT e.id, e.status
  FROM public.events e
 WHERE e.status::text IN ('PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE') AND NOT e.ended_unpublished;
COMMENT ON VIEW public.events_public_status IS
    'Lot 5 (A3) : identifiant et statut des événements dans un statut public (PUBLIE, SUSPENDU, ANNULE, TERMINE), pour la politique de lecture de ticket_categories. Lot 9 ter (R106 a) : un événement terminé sans avoir été publié n''y figure pas.';
REVOKE ALL ON public.events_public_status FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.events_public_status TO anon, authenticated;
GRANT ALL ON public.events_public_status TO service_role;


-- ----------------------------------------------------------------------------
-- (7) Politique events_read_public (base 20261102000003_lot5_cycle.sql:1111-1117, 9t.12) : SELECT seulement (x2).
-- Le motif interne d'une annulation n'est plus sur events (seule source : event_cancellations, illisible par anon).
-- Les statuts non publics restent réservés au propriétaire et aux admins ; un événement terminé sans publication aussi.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "events_read_public" ON public.events;
CREATE POLICY "events_read_public" ON public.events
    FOR SELECT USING (
        (status IN ('PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE') AND NOT ended_unpublished)
        OR public.is_partner_owner(partner_id)
        OR public.is_admin()
    );


-- ----------------------------------------------------------------------------
-- (8) DML (9t.12) : transition VALIDE → TERMINE par le cron (17 lignes).
-- ----------------------------------------------------------------------------
INSERT INTO public.event_status_transitions (from_status, to_status, actor_kind, reason_required, channel, action_label)
VALUES ('VALIDE', 'TERMINE', 'SYSTEM', FALSE, 'CRON', 'Terminer automatiquement')
ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- (9) Privilèges : service_role seul.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.event_edit_locks(uuid)',
        'public.events_finish_overdue(jsonb)',
        'public.scan_event_problem(uuid)',
        'public.finance_account_balance(uuid, text)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
