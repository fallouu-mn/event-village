-- ============================================================================
-- EVENT VILLAGE — LOT 9 BIS : l'argent (M06, agent S-A ; contrat sections 3.1, 3.2, 3.3, 4.1, 5.2 à 5.5, 5.9, 5.10)
-- ============================================================================
-- Rejouable : aucun BEGIN ni COMMIT ; CREATE TABLE / INDEX IF NOT EXISTS, CREATE OR REPLACE, privilèges réappliqués ;
-- aucune reprise de données. DDL avant les fonctions. Écrite tâche après tâche (section 10), un commit par tâche.
--
-- Tâche 2 (R4, R5 ; B14 à B18, A7) :
--  1. Table partner_suspension_cascades : trace de la cascade de suspension d'une partenaire (service_role seul).
--  2. fin_frozen_amount(p_owner, p_kind, p_at) (nouvelle, STABLE) : gel calculé à la lecture, jamais écrit :
--     Σ max(0, net échu) des événements SUSPENDU du compte ORGANISATEUR ; 0 pour PARRAINAGE ; un événement ANNULE
--     n'est pas gelé (ses débits sont écrits).
--  3. fin_withdrawal_check(p_user, p_kind, p_gross, p_at) (nouvelle, STABLE) : règle unique du retrait (B15),
--     appelée par withdrawal_request sous le verrou du compte : statut du compte, minimum, solde, gel, frais, net.
--  4. finance_account_balance : base 20261101000004_lot3_grand_livre.sql:304-339, recopie intégrale, signature
--     (uuid, text → jsonb) et STABLE identiques. Changements : `frozen` ajouté, `withdrawable` réduit du gel ;
--     `available` et `pending` inchangés (invariant (e)).
--  5. withdrawal_request : base 20261101000014_lot4_correctif_retraits_concurrents.sql:12-137, recopie intégrale,
--     signature (jsonb → jsonb) identique. Changements : minimum, solde et frais remplacés par fin_withdrawal_check
--     lue à l'heure réelle (clock_timestamp, correctif du lot 4) après le verrou et le contrôle de la clé ; nouveau
--     refus FUNDS_FROZEN ; texte du minimum du contrat 4.1 ; VOLATILE écrit (volatilité par défaut, aucune
--     différence de comportement).
--  6. partner_status_set : base 20261103000006_lot6_pros_admin.sql:698-769, recopie intégrale, signature
--     (jsonb → jsonb) et VOLATILE identiques. Changements : cascade. À la suspension, chaque événement PUBLIE de la
--     partenaire passe SUSPENDU (« Organisateur suspendu », acteur et rôle ADMIN) avec sa trace ; à la réactivation,
--     seuls les événements tracés encore SUSPENDU, dont la ligne d'historique de la cascade est la dernière et dont
--     la fin n'est pas passée, reviennent PUBLIE (« Organisateur réactivé ») ; les autres traces sont fermées
--     LEFT_ENDED (intact mais fini, B20) ou LEFT_CHANGED. Marqueur transactionnel ev.partner_cascade = '1' pendant
--     les deux boucles, lu par notif_event_status_changed (M09, S-D) : aucun EVENT_SUSPENDED ni EVENT_REACTIVATED
--     par événement à la partenaire (A7). Réponse + events_suspended, events_restored, events_left_suspended.
--     Verrou de la fiche : FOR NO KEY UPDATE au lieu de FOR UPDATE. payment_confirm tient l'événement (FOR NO KEY
--     UPDATE) puis écrit la VENTE au grand livre, dont la clé étrangère partner_id prend FOR KEY SHARE sur la fiche ;
--     un FOR UPDATE sur la fiche suivi du verrou des événements fermerait ce cycle. FOR NO KEY UPDATE sérialise
--     toujours deux changements de statut de la même fiche (aucune colonne de clé n'est écrite).
--     Ordre des verrous (3.3) : partners FOR NO KEY UPDATE, compte, événements ORDER BY id FOR NO KEY UPDATE,
--     historique, traces.
--
-- Tâche 3 (R11 ; B21, et B45 pour l'audit, tâche 19) :
--  7. ticket_refund_request : base 20261108000001_lot9_securite.sql:21-129, recopie intégrale, signature
--     (uuid, uuid, text → jsonb) et VOLATILE identiques, verrous inchangés (paiement, catégorie NKU, billet).
--     Changements :
--     - règle d'acteur après les verrous, dans la fonction qui fait sortir l'argent. Événement ANNULE : contexte
--       d'annulation (event_cancel), exempté de la règle de date ; l'acteur doit être la propriétaire ou un compte
--       ADMIN ou SUPERADMIN. Sinon, un compte ACTIF : admin_can(acteur, 'refunds.manage') (M04) avant comme après la
--       fin ; propriétaire jusqu'à event_end_at, puis REFUND_CLOSED_AFTER_EVENT ; tout autre acteur FORBIDDEN ;
--     - « déjà remboursé » (rejeu) rendu seulement à un acteur lié au billet (propriétaire, compte ADMIN ou
--       SUPERADMIN, porteur) : un tiers ne lit rien du remboursement ;
--     - refus du paiement (PAYMENT_NOT_REFUNDABLE, ALREADY_REFUNDED) décidés avant toute écriture, puis une ligne
--       audit_logs TICKET_REFUND_REQUESTED (object_type tickets, metadata { as, context, reason, mode, amount })
--       dans la transaction (contrat 6.3, w20), puis les écritures des trois branches, inchangées.
--
-- Tâche 4 (R20, §76 ; B22) :
--  8. Table event_cash_refund_marks : seules les marques « Remboursé » sont stockées (clé primaire payment_id :
--     une marque par vente, irréversible) ; la liste est calculée en direct.
--  9. event_cash_refunds(p) (nouvelle, STABLE) : ventes au guichet d'un événement ANNULE (paiements hors
--     plateforme, TICKET, SUCCESS, montant > 0), référence du reçu, billets, montant, numéro masqué, vendeur,
--     marque ; totaux ; can_mark pour la seule propriétaire ACTIF. Lecture : propriétaire ou admin_can(events.read)
--     (M04) ; un compte ADMIN sans la permission reçoit PERMISSION_MISSING, tout autre acteur EVENT_NOT_FOUND.
-- 10. event_cash_refund_mark(p) (nouvelle) : propriétaire ACTIF seule (un compte ADMIN ou SUPERADMIN reçoit
--     FORBIDDEN, un tiers EVENT_NOT_FOUND), événement ANNULE, vente de la liste ; idempotent (ALREADY_MARKED rend
--     la marque), irréversible ; audit CASH_REFUND_MARKED dans la transaction. Aucun verrou explicite : une course
--     sur la clé primaire (unique_violation) rend ALREADY_MARKED (3.3).
-- 11. event_cancellation_impact : base 20261102000003_lot5_cycle.sql:687-758, recopie intégrale, signature
--     (jsonb → jsonb) et STABLE identiques. Changement : `counter { sales, tickets, total }` (ventes au guichet de
--     l'événement, billets de ces ventes, montant), champs existants inchangés.
--
-- Tâche 5 (R32 ; B23, B24) :
-- 12. Table event_start_changes : journal des changements de début d'un événement (ancien et nouveau début, acteur),
--     écrit par event_update (M09, S-D, fix(9b.5-SD)) ; service_role seul. actor_id sans clé étrangère : event_update
--     tient l'événement, une clé vers users prendrait FOR KEY SHARE sur le compte de l'acteur après ce verrou.
-- 13. ticket_postponement_refund_open(p_ticket) (nouvelle, STABLE) : droit au remboursement d'un report. Billet
--     VALIDE payant, payé en ligne (paiement TICKET SUCCESS ou PARTIAL), événement PUBLIE ou SUSPENDU, pas encore
--     commencé, et début actuel postérieur de plus de 24 h au début en vigueur à l'achat (old_start_at du premier
--     changement enregistré après la création du paiement ; reports cumulés). Un billet acheté après le report n'a
--     aucun droit ; une avance n'ouvre rien (le début actuel n'est pas postérieur).
-- 14. tickets_postponement_offers(p) (nouvelle, STABLE) : { user_id } → { ok, items: [{ ticket_id, amount, until,
--     to_original_buyer }] } pour GET /api/tickets (S-C, fix(9b.5-SC)) ; montant = part que rendrait
--     ticket_refund_request (prix + frais de service, borné au reste du paiement), until = début actuel.
-- 15. ticket_refund_request : le porteur (tickets.user_id) est admis quand son droit de report est ouvert (as
--     HOLDER, context POSTPONEMENT), sinon POSTPONEMENT_REFUND_CLOSED ; l'argent va au payeur d'origine (branche
--     CASHOUT inchangée, p.client_id et p.payer_phone).
--
-- Tâche 9 (ex-10.0 a ; B26) :
-- 16. fin_withdrawal_check : après le gel, refus WITHDRAWAL_LOCKED_PHONE_CHANGE (unlock_at = dernière ligne
--     audit_logs ACCOUNT_PHONE_CHANGED du compte + 24 h fixes, à l'heure lue, clock_timestamp sous le verrou du
--     retrait) pour les deux comptes ; aucune colonne, aucune recopie d'account_phone_finalize. Ordre final :
--     statut, minimum, solde, gel, verrou de numéro, frais.
-- ============================================================================


-- ============================================================================
-- 1. DDL
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 partner_suspension_cascades (tâche 2, B16) : une ligne par événement suspendu par la cascade.
--     outcome NULL tant que la trace est ouverte ; RESTORED, LEFT_ENDED ou LEFT_CHANGED une fois fermée.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_suspension_cascades (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id           uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    event_id             uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    suspended_history_id uuid REFERENCES public.event_status_history(id) ON DELETE SET NULL,
    created_at           timestamptz NOT NULL DEFAULT now(),
    closed_at            timestamptz,
    outcome              text,
    restored_history_id  uuid REFERENCES public.event_status_history(id) ON DELETE SET NULL,
    CONSTRAINT partner_suspension_cascades_outcome_chk
        CHECK (outcome IS NULL OR outcome IN ('RESTORED', 'LEFT_ENDED', 'LEFT_CHANGED')),
    CONSTRAINT partner_suspension_cascades_closed_chk
        CHECK ((closed_at IS NULL) = (outcome IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_suspension_cascades_open
    ON public.partner_suspension_cascades (event_id) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_partner_suspension_cascades_partner
    ON public.partner_suspension_cascades (partner_id) WHERE closed_at IS NULL;
COMMENT ON TABLE public.partner_suspension_cascades IS
    'Lot 9 bis (R5, B16) : événements suspendus par la suspension de leur partenaire ; seuls ceux-là sont rétablis à la réactivation. Service_role uniquement.';
ALTER TABLE public.partner_suspension_cascades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.partner_suspension_cascades FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.partner_suspension_cascades TO service_role;

-- ----------------------------------------------------------------------------
-- 1.2 event_cash_refund_marks (tâche 4, B22) : marque « Remboursé » d'une vente au guichet d'un événement annulé.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_cash_refund_marks (
    payment_id uuid PRIMARY KEY REFERENCES public.payments(id) ON DELETE CASCADE,
    event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    marked_by  uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    marked_at  timestamptz NOT NULL DEFAULT now(),
    note       text,
    CONSTRAINT event_cash_refund_marks_note_chk CHECK (note IS NULL OR char_length(note) <= 500)
);
CREATE INDEX IF NOT EXISTS idx_event_cash_refund_marks_event ON public.event_cash_refund_marks (event_id);
COMMENT ON TABLE public.event_cash_refund_marks IS
    'Lot 9 bis (R20, B22) : espèces d''une vente au guichet rendues par l''organisateur après l''annulation ; marque irréversible, une par paiement. Service_role uniquement.';
ALTER TABLE public.event_cash_refund_marks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.event_cash_refund_marks FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.event_cash_refund_marks TO service_role;

-- ----------------------------------------------------------------------------
-- 1.3 event_start_changes (tâche 5, B23) : un changement de début par ligne, écrit par event_update (M09).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_start_changes (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    old_start_at timestamptz NOT NULL,
    new_start_at timestamptz NOT NULL,
    actor_id     uuid,
    changed_at   timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_event_start_changes_event ON public.event_start_changes (event_id, changed_at);
COMMENT ON TABLE public.event_start_changes IS
    'Lot 9 bis (R32, B23) : changements de début d''un événement ; le droit au remboursement d''un report se mesure depuis le début en vigueur à l''achat. Service_role uniquement.';
COMMENT ON COLUMN public.event_start_changes.actor_id IS
    'Compte qui a changé le début (sans clé étrangère : event_update tient l''événement, aucune arête vers users).';
ALTER TABLE public.event_start_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.event_start_changes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.event_start_changes TO service_role;


-- ============================================================================
-- 2. Fonctions nouvelles
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 fin_frozen_amount (tâche 2, R4, B14) : fonds gelés d'un compte à l'instant p_at.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fin_frozen_amount(p_owner uuid, p_kind text, p_at timestamptz)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_frozen numeric;
BEGIN
    IF p_owner IS NULL OR p_kind IS DISTINCT FROM 'ORGANISATEUR' THEN
        RETURN 0;
    END IF;
    SELECT COALESCE(sum(GREATEST(n.net, 0)), 0) INTO v_frozen
      FROM (SELECT l.event_id, sum(l.amount) AS net
              FROM public.finance_ledger l
              JOIN public.events e ON e.id = l.event_id
             WHERE l.owner_id = p_owner AND l.account_kind = 'ORGANISATEUR'
               AND e.status::text = 'SUSPENDU'
               AND l.available_at <= COALESCE(p_at, now())
             GROUP BY l.event_id) n;
    RETURN v_frozen;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2.2 fin_withdrawal_check (tâche 2, B15) : règle unique d'un retrait, sans écriture ni verrou.
--     Ordre : statut du compte, minimum, solde, gel, verrou de numéro (tâche 9), frais et net. Rend { ok, minimum,
--     fee_rate, fee_amount,
--     net_amount, available, frozen, withdrawable } ou { ok:false, code, message, … }.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fin_withdrawal_check(p_user uuid, p_kind text, p_gross numeric, p_at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_at           timestamptz := COALESCE(p_at, now());
    v_status       text;
    v_min          numeric;
    v_available    numeric;
    v_frozen       numeric;
    v_withdrawable numeric;
    v_rate         numeric;
    v_fee          numeric;
    v_net          numeric;
    v_unlock       timestamptz;
BEGIN
    IF p_kind IS NULL OR p_kind NOT IN ('ORGANISATEUR', 'PARRAINAGE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ACCOUNT', 'message', 'Compte inconnu.');
    END IF;
    IF p_gross IS NULL OR p_gross <= 0 OR p_gross <> trunc(p_gross) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT', 'message', 'Montant entier en FCFA attendu.');
    END IF;

    -- Statut du compte
    SELECT u.status::text INTO v_status FROM public.users u WHERE u.id = p_user;
    IF v_status IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Compte inconnu.');
    END IF;
    IF v_status <> 'ACTIF' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Compte inactif.');
    END IF;
    IF p_kind = 'ORGANISATEUR'
       AND NOT EXISTS (SELECT 1 FROM public.partners pa WHERE pa.user_id = p_user AND pa.status::text = 'VALIDE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_PARTNER', 'message', 'Aucun compte organisateur validé.');
    END IF;

    -- Minimum (milliers séparés par une espace insécable)
    v_min := public.fin_setting_num('finance.withdrawal_min_amount');
    IF p_gross < v_min THEN
        RETURN jsonb_build_object('ok', false, 'code', 'BELOW_MINIMUM', 'minimum', v_min,
            'message', format('Le minimum de retrait est de %s F CFA.',
                              regexp_replace(trunc(v_min)::bigint::text, '(\d)(?=(\d{3})+$)', '\1' || chr(160), 'g')));
    END IF;

    -- Solde disponible (écritures échues à v_at)
    SELECT COALESCE(sum(amount), 0) INTO v_available FROM public.finance_ledger
     WHERE owner_id = p_user AND account_kind = p_kind AND available_at <= v_at;
    IF p_gross > public.fin_round_down(GREATEST(v_available, 0)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_BALANCE', 'available', v_available,
                                  'message', 'Solde disponible insuffisant.');
    END IF;

    -- Gel (R4) : le net échu des événements suspendus n'est pas retirable
    v_frozen := public.fin_frozen_amount(p_user, p_kind, v_at);
    v_withdrawable := public.fin_round_down(GREATEST(v_available - v_frozen, 0));
    IF p_gross > v_withdrawable THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FUNDS_FROZEN', 'frozen', v_frozen, 'withdrawable', v_withdrawable,
                                  'message', 'Une partie de vos fonds est gelée : un de vos événements est suspendu.');
    END IF;

    -- Lot 9 bis (ex-10.0 a, B26) : 24 h fixes après le dernier changement de numéro (audit écrit par
    -- account_phone_finalize dans sa transaction), pour les deux comptes et tous les moyens de retrait
    SELECT max(a.created_at) + interval '24 hours' INTO v_unlock
      FROM public.audit_logs a
     WHERE a.action = 'ACCOUNT_PHONE_CHANGED' AND a.object_type = 'users' AND a.object_id = p_user;
    IF v_unlock IS NOT NULL AND v_unlock > v_at THEN
        RETURN jsonb_build_object('ok', false, 'code', 'WITHDRAWAL_LOCKED_PHONE_CHANGE', 'unlock_at', v_unlock,
            'message', format('Retrait impossible pendant 24 h après un changement de numéro. Réessayez après le %s.',
                              to_char(v_unlock AT TIME ZONE 'Africa/Dakar', 'DD/MM/YYYY "à" HH24:MI')));
    END IF;

    -- Frais et net
    v_rate := public.fin_setting_num('finance.withdrawal_fee_rate');
    v_fee := public.fin_round_up(p_gross * v_rate / 100);
    v_net := p_gross - v_fee;
    IF v_net <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT', 'message', 'Montant trop faible après frais.');
    END IF;

    RETURN jsonb_build_object('ok', true, 'minimum', v_min, 'fee_rate', v_rate, 'fee_amount', v_fee, 'net_amount', v_net,
                              'available', v_available, 'frozen', v_frozen, 'withdrawable', v_withdrawable);
END;
$$;

-- ----------------------------------------------------------------------------
-- 2.3 event_cash_refunds (tâche 4, R20, B22) : liste des espèces à rendre par l'organisateur, calculée en direct.
--     p : { event_id, actor_id } → { ok, items[], count, total, refunded_count, refunded_total, can_mark }.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_cash_refunds(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event  uuid := public.try_uuid(p->>'event_id');
    v_actor  uuid := public.try_uuid(p->>'actor_id');
    v_status text;
    v_owner  uuid;
    v_active boolean;
    v_items  jsonb;
    v_count  bigint;
    v_total  numeric;
    v_rcount bigint;
    v_rtotal numeric;
BEGIN
    SELECT e.status::text, pa.user_id INTO v_status, v_owner
      FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = v_event;
    IF v_event IS NULL OR v_actor IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    v_active := EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF');
    IF v_owner IS DISTINCT FROM v_actor AND NOT public.admin_can(v_actor, 'events.read') THEN
        IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PERMISSION_MISSING', 'permission', 'events.read',
                'message', 'Action non autorisée : votre compte n’a pas la permission « Consulter les événements ».');
        END IF;
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF NOT v_active THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;
    IF v_status <> 'ANNULE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_CANCELLED',
                                  'message', 'La liste des espèces à rembourser n’existe que pour un événement annulé.');
    END IF;

    WITH sales AS (
        SELECT pay.id, pay.amount, COALESCE(pay.paid_at, pay.created_at) AS sold_at, pay.payer_phone,
               public.try_uuid(pay.metadata->>'seller_id') AS seller_id
          FROM public.payments pay
         WHERE pay.event_id = v_event AND NOT pay.is_platform_payment AND pay.payment_target::text = 'TICKET'
           AND pay.status::text = 'SUCCESS' AND pay.amount > 0
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'payment_id', s1.id,
               'reference', upper(left(s1.id::text, 8)),
               'ticket_count', (SELECT count(*) FROM public.tickets tk WHERE tk.payment_id = s1.id),
               'amount', s1.amount,
               'phone_masked', CASE WHEN NULLIF(regexp_replace(COALESCE(s1.payer_phone, ''), '[^0-9]', '', 'g'), '') IS NULL THEN NULL
                                    ELSE '*** ** ' || right(regexp_replace(s1.payer_phone, '[^0-9]', '', 'g'), 2) END,
               'sold_at', s1.sold_at,
               'seller', NULLIF(btrim(concat_ws(' ', su.first_name, su.last_name)), ''),
               'refunded_at', m.marked_at,
               'refunded_by', NULLIF(btrim(concat_ws(' ', mu.first_name, mu.last_name)), ''))
             ORDER BY s1.sold_at, s1.id), '[]'::jsonb),
           count(*), COALESCE(sum(s1.amount), 0),
           count(m.payment_id), COALESCE(sum(s1.amount) FILTER (WHERE m.payment_id IS NOT NULL), 0)
      INTO v_items, v_count, v_total, v_rcount, v_rtotal
      FROM sales s1
      LEFT JOIN public.users su ON su.id = s1.seller_id
      LEFT JOIN public.event_cash_refund_marks m ON m.payment_id = s1.id
      LEFT JOIN public.users mu ON mu.id = m.marked_by;

    RETURN jsonb_build_object('ok', true, 'items', v_items, 'count', v_count, 'total', v_total,
                              'refunded_count', v_rcount, 'refunded_total', v_rtotal,
                              'can_mark', v_owner = v_actor AND v_active);
END;
$$;

-- ----------------------------------------------------------------------------
-- 2.4 event_cash_refund_mark (tâche 4, R20, B22) : « Remboursé » coché par la propriétaire.
--     p : { event_id, payment_id, actor_id, note? } → { ok, code?, mark { payment_id, refunded_at, refunded_by, note } }.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_cash_refund_mark(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event   uuid := public.try_uuid(p->>'event_id');
    v_payment uuid := public.try_uuid(p->>'payment_id');
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_note    text := NULLIF(btrim(COALESCE(p->>'note', '')), '');
    v_status  text;
    v_owner   uuid;
    v_amount  numeric;
    m         record;
BEGIN
    SELECT e.status::text, pa.user_id INTO v_status, v_owner
      FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = v_event;
    IF v_event IS NULL OR v_actor IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF v_owner IS DISTINCT FROM v_actor THEN
        IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN',
                                      'message', 'Seul l’organisateur de l’événement marque les espèces rendues.');
        END IF;
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    END IF;
    IF v_status <> 'ANNULE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_CANCELLED',
                                  'message', 'La liste des espèces à rembourser n’existe que pour un événement annulé.');
    END IF;
    SELECT pay.amount INTO v_amount
      FROM public.payments pay
     WHERE pay.id = v_payment AND pay.event_id = v_event AND NOT pay.is_platform_payment
       AND pay.payment_target::text = 'TICKET' AND pay.status::text = 'SUCCESS' AND pay.amount > 0;
    IF v_payment IS NULL OR NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PAYMENT_NOT_FOUND', 'message', 'Vente introuvable dans la liste des espèces à rembourser.');
    END IF;
    IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'La note est limitée à 500 caractères.');
    END IF;

    SELECT * INTO m FROM public.event_cash_refund_marks WHERE payment_id = v_payment;
    IF NOT FOUND THEN
        BEGIN
            INSERT INTO public.event_cash_refund_marks (payment_id, event_id, marked_by, note)
            VALUES (v_payment, v_event, v_actor, v_note)
            RETURNING * INTO m;
            INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
            VALUES (v_actor, 'PARTENAIRE', 'CASH_REFUND_MARKED', 'payments', v_payment,
                    jsonb_build_object('event_id', v_event, 'payment_id', v_payment, 'amount', v_amount, 'note', v_note));
            RETURN jsonb_build_object('ok', true,
                'mark', jsonb_build_object('payment_id', m.payment_id, 'refunded_at', m.marked_at, 'refunded_by_id', m.marked_by,
                                           'refunded_by', (SELECT NULLIF(btrim(concat_ws(' ', u.first_name, u.last_name)), '')
                                                             FROM public.users u WHERE u.id = m.marked_by),
                                           'note', m.note));
        EXCEPTION WHEN unique_violation THEN
            -- Course sur la clé primaire : la marque concurrente fait foi (lue ci-dessous)
            SELECT * INTO m FROM public.event_cash_refund_marks WHERE payment_id = v_payment;
        END;
    END IF;
    RETURN jsonb_build_object('ok', true, 'code', 'ALREADY_MARKED',
        'message', 'Cette vente est déjà marquée remboursée.',
        'mark', jsonb_build_object('payment_id', m.payment_id, 'refunded_at', m.marked_at, 'refunded_by_id', m.marked_by,
                                   'refunded_by', (SELECT NULLIF(btrim(concat_ws(' ', u.first_name, u.last_name)), '')
                                                     FROM public.users u WHERE u.id = m.marked_by),
                                   'note', m.note));
END;
$$;


-- ----------------------------------------------------------------------------
-- 2.5 ticket_postponement_refund_open (tâche 5, R32, B23) : droit de remboursement d'un billet après un report.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_postponement_refund_open(p_ticket uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r       record;
    v_start timestamptz;
    v_base  timestamptz;
BEGIN
    SELECT t.id, t.status::text AS status, t.price, t.event_id, e.status::text AS event_status,
           pay.created_at AS bought_at, pay.is_platform_payment, pay.status::text AS pay_status,
           pay.payment_target::text AS target
      INTO r
      FROM public.tickets t
      JOIN public.events e ON e.id = t.event_id
      JOIN public.payments pay ON pay.id = t.payment_id
     WHERE t.id = p_ticket;
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    IF r.status <> 'VALIDE' OR COALESCE(r.price, 0) <= 0 OR NOT COALESCE(r.is_platform_payment, FALSE)
       OR r.pay_status NOT IN ('SUCCESS', 'PARTIAL') OR r.target <> 'TICKET'
       OR r.event_status NOT IN ('PUBLIE', 'SUSPENDU') THEN
        RETURN FALSE;
    END IF;
    v_start := public.event_start_at(r.event_id);
    IF v_start IS NULL OR now() >= v_start THEN
        RETURN FALSE;
    END IF;
    -- Début en vigueur à l'achat : ancien début du premier changement enregistré après l'achat
    SELECT c.old_start_at INTO v_base
      FROM public.event_start_changes c
     WHERE c.event_id = r.event_id AND c.changed_at > r.bought_at
     ORDER BY c.changed_at, c.id
     LIMIT 1;
    RETURN v_base IS NOT NULL AND v_start - v_base > interval '24 hours';
END;
$$;

-- ----------------------------------------------------------------------------
-- 2.6 tickets_postponement_offers (tâche 5, R32, B23) : offres de remboursement des billets d'un porteur.
--     p : { user_id } → { ok, items: [{ ticket_id, amount, until, to_original_buyer }] }.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tickets_postponement_offers(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user  uuid := public.try_uuid(p->>'user_id');
    v_items jsonb;
BEGIN
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Compte inconnu.');
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'ticket_id', t.id,
               'amount', LEAST(t.price + COALESCE(t.service_fee, 0),
                               pay.amount - COALESCE((SELECT sum(rf.amount) FROM public.refunds rf
                                                       WHERE rf.payment_id = pay.id AND rf.settlement = 'PLATEFORME'), 0)),
               'until', public.event_start_at(t.event_id),
               'to_original_buyer', pay.client_id IS DISTINCT FROM t.user_id)
             ORDER BY t.id), '[]'::jsonb)
      INTO v_items
      FROM public.tickets t
      JOIN public.payments pay ON pay.id = t.payment_id
     WHERE t.user_id = v_user AND t.status::text = 'VALIDE'
       AND public.ticket_postponement_refund_open(t.id);
    RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;


-- ============================================================================
-- 3. Recopies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 finance_account_balance (recopie de 20261101000004_lot3_grand_livre.sql:304-339) : + frozen, withdrawable
--     réduit du gel (tâche 2).
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
    SELECT COALESCE(sum(net_amount), 0) INTO v_in_progress
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
        'withdrawable', public.fin_round_down(GREATEST(v_available - v_frozen, 0)));
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.2 withdrawal_request (recopie de 20261101000014_lot4_correctif_retraits_concurrents.sql:12-137) :
--     minimum, solde et frais par fin_withdrawal_check sous le verrou (tâche 2).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.withdrawal_request(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := (p->>'user_id')::uuid;
    v_kind text := p->>'account_kind';
    v_method text := COALESCE(NULLIF(p->>'method', ''), 'MOBILE_MONEY');
    v_operator text := NULLIF(p->>'operator', '');
    v_phone text := NULLIF(p->>'phone_number', '');
    v_key text := NULLIF(p->>'client_key', '');
    v_gross numeric;
    v_u record;
    v_partner uuid;
    v_existing record;
    v_check jsonb;
    v_rate numeric;
    v_fee numeric;
    v_net numeric;
    v_id uuid;
    v_cashout uuid;
    v_blocked text;
BEGIN
    IF v_kind IS NULL OR v_kind NOT IN ('ORGANISATEUR', 'PARRAINAGE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ACCOUNT', 'message', 'Compte inconnu.');
    END IF;
    IF v_method NOT IN ('MOBILE_MONEY', 'BANK') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_METHOD', 'message', 'Moyen de retrait inconnu.');
    END IF;
    IF v_method = 'BANK' AND NOT public.fin_setting_bool('finance.withdrawal_bank_enabled') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'BANK_DISABLED', 'message', 'Les retraits par virement bancaire ne sont pas ouverts.');
    END IF;
    IF (p->>'gross_amount') IS NULL OR (p->>'gross_amount') !~ '^[0-9]+(\.0+)?$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT', 'message', 'Montant entier en FCFA attendu.');
    END IF;
    v_gross := (p->>'gross_amount')::numeric;
    IF v_gross <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT', 'message', 'Montant entier en FCFA attendu.');
    END IF;
    IF v_method = 'MOBILE_MONEY' AND (v_operator IS NULL OR v_operator NOT IN ('WAVE', 'ORANGE_MONEY')
                                       OR v_phone IS NULL OR v_phone !~ '^7[05678][0-9]{7}$') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DESTINATION', 'message', 'Choisissez Wave ou Orange Money et un numéro mobile sénégalais (9 chiffres).');
    END IF;

    SELECT id, first_name, last_name, status::text AS status INTO v_u FROM public.users WHERE id = v_user;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Compte inconnu.');
    END IF;
    IF v_u.status <> 'ACTIF' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Compte inactif.');
    END IF;
    IF v_kind = 'ORGANISATEUR' THEN
        SELECT id INTO v_partner FROM public.partners WHERE user_id = v_user AND status = 'VALIDE' ORDER BY created_at LIMIT 1;
        IF v_partner IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NOT_PARTNER', 'message', 'Aucun compte organisateur validé.');
        END IF;
    END IF;

    PERFORM public.fin_account_lock(v_user, v_kind);

    IF v_key IS NOT NULL THEN
        SELECT * INTO v_existing FROM public.withdrawals WHERE user_id = v_user AND client_idempotency_key = v_key;
        IF FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'DUPLICATE', 'message', 'Retrait déjà demandé avec cette clé.',
                                      'withdrawal_id', v_existing.id, 'cashout_id', v_existing.cashout_id,
                                      'gross_amount', v_existing.gross_amount, 'fee_amount', v_existing.fee_amount,
                                      'net_amount', v_existing.net_amount, 'status', v_existing.status::text);
        END IF;
    END IF;

    -- Lot 9 bis (B15) : règle unique (minimum, solde, gel, frais), lue à l'heure réelle et non à now() : une demande
    -- concurrente qui a attendu le verrou doit voir le débit de la précédente (correctif du lot 4). L'instruction
    -- commence après le verrou : la fonction STABLE lit l'instantané de cette instruction, qui voit ce débit validé.
    v_check := public.fin_withdrawal_check(v_user, v_kind, v_gross, clock_timestamp());
    IF NOT COALESCE((v_check->>'ok')::boolean, false) THEN
        RETURN v_check;
    END IF;
    v_rate := (v_check->>'fee_rate')::numeric;
    v_fee := (v_check->>'fee_amount')::numeric;
    v_net := (v_check->>'net_amount')::numeric;

    INSERT INTO public.withdrawals (user_id, gross_amount, fee_rate, fee_amount, net_amount, withdrawal_method, payment_details,
                                    status, account_kind, operator, phone_number, client_idempotency_key, otp_verified_at)
    VALUES (v_user, v_gross, v_rate, v_fee, v_net, v_method::withdrawal_method_enum,
            CASE WHEN v_method = 'BANK' THEN COALESCE(p->'bank_details', '{}'::jsonb)
                 ELSE jsonb_build_object('operator', v_operator, 'phone_number', v_phone) END,
            CASE WHEN v_method = 'BANK' THEN 'PENDING'::withdrawal_status_enum ELSE 'PROCESSING'::withdrawal_status_enum END,
            v_kind, v_operator, v_phone, v_key, NULLIF(p->>'otp_verified_at', '')::timestamptz)
    RETURNING id INTO v_id;

    -- Solde réservé tout de suite (rendu seulement si l'envoi est refusé)
    INSERT INTO public.finance_ledger (owner_id, account_kind, partner_id, entry_type, amount, available_at, withdrawal_id, source_key, description)
    VALUES (v_user, v_kind, v_partner, 'RETRAIT', -v_gross, now(), v_id, 'RETRAIT-' || v_id::text,
            format('Retrait %s F (frais %s F, versé %s F)', v_gross, v_fee, v_net));
    IF v_kind = 'PARRAINAGE' THEN
        PERFORM public.fin_referral_allocate(v_user, v_id, v_gross);
    END IF;

    IF v_method = 'MOBILE_MONEY' THEN
        v_blocked := CASE WHEN NULLIF(btrim(v_u.first_name), '') IS NULL OR NULLIF(btrim(v_u.last_name), '') IS NULL
                          THEN 'NAME_UNKNOWN' ELSE NULL END;
        INSERT INTO public.cashouts (kind, idempotency_key, withdrawal_id, beneficiary_user_id, operator, phone_number,
                                     first_name, last_name, amount, blocked_reason)
        VALUES ('WITHDRAWAL', 'WITHDRAWAL-' || v_id::text, v_id, v_user, v_operator, v_phone,
                NULLIF(btrim(v_u.first_name), ''), NULLIF(btrim(v_u.last_name), ''), v_net, v_blocked)
        RETURNING id INTO v_cashout;
        UPDATE public.withdrawals SET cashout_id = v_cashout WHERE id = v_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'withdrawal_id', v_id, 'cashout_id', v_cashout, 'gross_amount', v_gross,
                              'fee_amount', v_fee, 'net_amount', v_net,
                              'status', CASE WHEN v_method = 'BANK' THEN 'PENDING' ELSE 'PROCESSING' END);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.3 partner_status_set (recopie de 20261103000006_lot6_pros_admin.sql:698-769) : cascade sur les événements
--     (tâche 2, R5, B16, B17, A7).
--     p : { partner_id, actor_id, status ∈ VALIDE | REJETE | SUSPENDU, reason? }.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_status_set(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner uuid := public.try_uuid(p->>'partner_id');
    v_actor   uuid := public.try_uuid(p->>'actor_id');
    v_status  text := p->>'status';
    v_reason  text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    pa        record;
    v_revoked integer;
    v_row     record;
    v_ev        record;
    v_trace     record;
    v_history   uuid;
    v_untouched boolean;
    v_suspended uuid[] := ARRAY[]::uuid[];
    v_restored  uuid[] := ARRAY[]::uuid[];
    v_left      uuid[] := ARRAY[]::uuid[];
BEGIN
    IF v_partner IS NULL OR v_actor IS NULL OR v_status IS NULL OR v_status NOT IN ('VALIDE', 'REJETE', 'SUSPENDU') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande incomplète.');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.users u
         WHERE u.id = v_actor AND u.status::text = 'ACTIF'
           AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role::text IN ('ADMIN', 'SUPERADMIN'))
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Action réservée aux administrateurs.');
    END IF;
    -- Lot 9 bis : FOR NO KEY UPDATE (voir l'en-tête, point 6)
    SELECT * INTO pa FROM public.partners WHERE id = v_partner FOR NO KEY UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_FOUND', 'message', 'Partenaire introuvable.');
    END IF;
    IF pa.status::text = v_status THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'status', pa.status::text,
                                  'message', 'Le partenaire est déjà dans ce statut.');
    END IF;
    IF v_status IN ('REJETE', 'SUSPENDU') AND (v_reason IS NULL OR char_length(v_reason) < 3) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED',
                                  'message', 'Indiquez le motif (3 caractères au moins).');
    END IF;
    IF v_reason IS NOT NULL AND char_length(v_reason) > 1000 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Le motif est limité à 1 000 caractères.');
    END IF;

    -- Compte du partenaire (jamais un compte supprimé) : SUSPENDU à la suspension, ACTIF sinon.
    UPDATE public.users
       SET status = (CASE WHEN v_status = 'SUSPENDU' THEN 'SUSPENDU' ELSE 'ACTIF' END)::public.user_status,
           updated_at = now()
     WHERE id = pa.user_id AND status::text <> 'SUPPRIME';

    UPDATE public.partners
       SET status = v_status::public.partner_status,
           is_verified = (v_status = 'VALIDE'),
           rejection_reason = CASE WHEN v_status = 'REJETE' THEN v_reason ELSE rejection_reason END,
           suspended_reason = CASE
               WHEN v_status = 'SUSPENDU' THEN v_reason
               WHEN v_status = 'VALIDE' AND pa.status::text = 'SUSPENDU' THEN NULL
               ELSE suspended_reason END,
           updated_at = now()
     WHERE id = pa.id
     RETURNING status::text AS status, is_verified, rejection_reason, suspended_reason INTO v_row;

    IF v_status = 'SUSPENDU' THEN
        v_revoked := public.revoke_user_sessions(pa.user_id);
    END IF;

    -- Lot 9 bis (R5, B16, B17, A7) : cascade sur les événements de la partenaire. Le marqueur transactionnel
    -- ev.partner_cascade est lu par le trigger des avis de statut (aucun avis par événement à la partenaire).
    IF v_status = 'SUSPENDU' THEN
        PERFORM set_config('ev.partner_cascade', '1', true);
        FOR v_ev IN
            SELECT e.id FROM public.events e
             WHERE e.partner_id = pa.id AND e.status::text = 'PUBLIE'
             ORDER BY e.id
               FOR NO KEY UPDATE OF e
        LOOP
            v_history := public.event_status_apply(v_ev.id, 'PUBLIE', 'SUSPENDU', v_actor, 'ADMIN', 'Organisateur suspendu', 'TRANSITION');
            INSERT INTO public.partner_suspension_cascades (partner_id, event_id, suspended_history_id)
            VALUES (pa.id, v_ev.id, v_history);
            v_suspended := v_suspended || v_ev.id;
        END LOOP;
        PERFORM set_config('ev.partner_cascade', '0', true);
    ELSIF v_status = 'VALIDE' AND pa.status::text = 'SUSPENDU' THEN
        PERFORM set_config('ev.partner_cascade', '1', true);
        -- Événements avant les traces (ordre 3.3)
        PERFORM 1 FROM public.events e
         WHERE e.id IN (SELECT k.event_id FROM public.partner_suspension_cascades k
                         WHERE k.partner_id = pa.id AND k.closed_at IS NULL)
         ORDER BY e.id
           FOR NO KEY UPDATE OF e;
        FOR v_trace IN
            SELECT k.id, k.event_id, k.suspended_history_id, e.status::text AS status, h.created_at AS suspended_at
              FROM public.partner_suspension_cascades k
              JOIN public.events e ON e.id = k.event_id
              LEFT JOIN public.event_status_history h ON h.id = k.suspended_history_id
             WHERE k.partner_id = pa.id AND k.closed_at IS NULL
             ORDER BY k.event_id
               FOR UPDATE OF k
        LOOP
            -- Intact : toujours SUSPENDU et aucune ligne d'historique après celle de la cascade
            v_untouched := v_trace.status = 'SUSPENDU' AND v_trace.suspended_at IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM public.event_status_history h2
                                 WHERE h2.event_id = v_trace.event_id AND h2.id <> v_trace.suspended_history_id
                                   AND h2.created_at >= v_trace.suspended_at);
            IF v_untouched AND public.event_end_at(v_trace.event_id) > now() THEN
                v_history := public.event_status_apply(v_trace.event_id, 'SUSPENDU', 'PUBLIE', v_actor, 'ADMIN', 'Organisateur réactivé', 'TRANSITION');
                UPDATE public.partner_suspension_cascades
                   SET closed_at = now(), outcome = 'RESTORED', restored_history_id = v_history
                 WHERE id = v_trace.id;
                v_restored := v_restored || v_trace.event_id;
            ELSE
                UPDATE public.partner_suspension_cascades
                   SET closed_at = now(), outcome = CASE WHEN v_untouched THEN 'LEFT_ENDED' ELSE 'LEFT_CHANGED' END
                 WHERE id = v_trace.id;
                IF v_trace.status = 'SUSPENDU' THEN
                    v_left := v_left || v_trace.event_id;
                END IF;
            END IF;
        END LOOP;
        PERFORM set_config('ev.partner_cascade', '0', true);
    END IF;

    RETURN jsonb_build_object(
        'ok', true, 'partner_id', pa.id, 'user_id', pa.user_id, 'old_status', pa.status::text,
        'status', v_row.status, 'is_verified', v_row.is_verified,
        'rejection_reason', v_row.rejection_reason, 'suspended_reason', v_row.suspended_reason,
        'sessions_revoked', v_revoked,
        'events_suspended', to_jsonb(v_suspended), 'events_restored', to_jsonb(v_restored),
        'events_left_suspended', to_jsonb(v_left)
    );
END;
$$;

COMMENT ON FUNCTION public.partner_status_set(jsonb) IS
    'Lot 6 (J2.6), lot 9 bis (R5) : validation, refus, suspension ou réactivation d''un partenaire ; partners.status et users.status dans la même transaction, sessions révoquées à la suspension, avis par trg_partners_notify ; cascade sur les événements PUBLIE (partner_suspension_cascades), rétablissement ciblé à la réactivation. Service_role uniquement.';

-- ----------------------------------------------------------------------------
-- 3.4 ticket_refund_request (recopie de 20261108000001_lot9_securite.sql:21-129) : règle d'acteur R11, audit
--     (tâches 3 et 19), porteur après un report (tâche 5).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_refund_request(p_ticket_id uuid, p_actor uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key text := 'REFUND-TKT-' || p_ticket_id::text;
    v_payment_id uuid;
    v_category uuid;
    p record;
    t record;
    v_ref record;
    v_user record;
    v_blocked text;
    v_refund uuid;
    v_cashout uuid;
    v_share numeric;
    v_prev_amount numeric;
    v_prev_agg numeric;
    v_agg_share numeric;
    v_bearer text;
    v_apply jsonb;
    v_platform boolean;
    v_ev record;
    v_is_owner boolean;
    v_is_staff boolean;
    v_is_holder boolean;
    v_active boolean;
    v_as text;
    v_ctx text;
    v_mode text;
    v_amount numeric;
BEGIN
    SELECT payment_id, category_id INTO v_payment_id, v_category FROM public.tickets WHERE id = p_ticket_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_FOUND', 'message', 'Billet introuvable.');
    END IF;
    IF v_payment_id IS NOT NULL THEN
        SELECT * INTO p FROM public.payments WHERE id = v_payment_id FOR UPDATE;
    END IF;
    PERFORM 1 FROM public.ticket_categories WHERE id = v_category FOR NO KEY UPDATE;
    SELECT * INTO t FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    -- Lot 9 bis (R11, B21) : qui agit, sur quel événement (lecture sans verrou, comme event_transition)
    SELECT e.id, e.status::text AS status, pa.user_id AS owner_id INTO v_ev
      FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = t.event_id;
    v_is_owner := p_actor IS NOT NULL AND v_ev.owner_id IS NOT DISTINCT FROM p_actor;
    v_is_staff := p_actor IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles r
                                                   WHERE r.user_id = p_actor AND r.role::text IN ('ADMIN', 'SUPERADMIN'));
    v_is_holder := p_actor IS NOT NULL AND t.user_id IS NOT DISTINCT FROM p_actor;
    v_active := EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_actor AND u.status::text = 'ACTIF');

    SELECT * INTO v_ref FROM public.refunds WHERE refund_transaction_id = v_key;
    IF FOUND AND (v_is_owner OR v_is_staff OR v_is_holder) THEN
        RETURN jsonb_build_object('ok', true, 'already', true,
            'mode', CASE WHEN v_ref.settlement = 'ORGANISATEUR' THEN 'ORGANISATEUR' ELSE 'CASHOUT' END,
            'refund_id', v_ref.id, 'cashout_id', v_ref.cashout_id, 'amount', v_ref.amount);
    END IF;

    IF v_ev.status = 'ANNULE' THEN
        -- Contexte d'annulation (event_cancel) : aucune règle de date, l'acteur a été contrôlé par event_cancel
        v_ctx := 'CANCELLATION';
        v_as := CASE WHEN v_is_owner THEN 'OWNER' WHEN v_is_staff THEN 'ADMIN' END;
    ELSIF NOT v_active THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');
    ELSIF public.admin_can(p_actor, 'refunds.manage') THEN
        v_ctx := 'DIRECT';
        v_as := 'ADMIN';
    ELSIF v_is_owner THEN
        IF now() > public.event_end_at(v_ev.id) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'REFUND_CLOSED_AFTER_EVENT',
                'message', 'L’événement est terminé : seul Event Village peut encore rembourser ce billet. Contactez le support.');
        END IF;
        v_ctx := 'DIRECT';
        v_as := 'OWNER';
    ELSIF v_is_holder THEN
        -- Lot 9 bis (R32, B23) : le porteur, seulement quand un report de plus de 24 h lui ouvre le droit
        IF NOT public.ticket_postponement_refund_open(t.id) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'POSTPONEMENT_REFUND_CLOSED',
                'message', 'Ce billet n’ouvre pas de remboursement : l’événement n’a pas été reporté de plus de 24 h, ou il a commencé.');
        END IF;
        v_ctx := 'POSTPONEMENT';
        v_as := 'HOLDER';
    END IF;
    IF v_as IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN',
                                  'message', 'Remboursement réservé à l’organisateur ou à un administrateur habilité.');
    END IF;

    IF t.status::text <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_REFUNDABLE', 'status', t.status::text,
                                  'message', format('Billet %s : remboursement impossible.', t.status));
    END IF;

    -- Branche du billet et refus du paiement, décidés avant toute écriture
    IF v_payment_id IS NOT NULL THEN
        v_platform := p.is_platform_payment;
    END IF;
    IF COALESCE(t.price, 0) = 0 THEN
        -- Billet gratuit ou invitation : annulé, rien à rembourser
        v_mode := 'AUCUN';
        v_amount := 0;
    ELSIF NOT COALESCE(v_platform, FALSE) THEN
        -- Billet payé hors plateforme (espèces) : à rembourser par l'organisateur, aucun cashout
        v_mode := 'ORGANISATEUR';
        v_amount := t.price;
    ELSE
        IF p.status::text NOT IN ('SUCCESS', 'PARTIAL') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PAYMENT_NOT_REFUNDABLE', 'status', p.status::text,
                                      'message', 'Le paiement de ce billet ne peut pas être remboursé.');
        END IF;
        -- Part du paiement correspondant au billet, jamais au-delà du reste à rembourser
        SELECT COALESCE(sum(amount), 0), COALESCE(sum(aggregator_fee_share), 0) INTO v_prev_amount, v_prev_agg
          FROM public.refunds WHERE payment_id = p.id AND settlement = 'PLATEFORME';
        v_share := LEAST(t.price + t.service_fee, p.amount - v_prev_amount);
        IF v_share <= 0 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_REFUNDED', 'message', 'Ce paiement est déjà entièrement remboursé.');
        END IF;
        v_mode := 'CASHOUT';
        v_amount := v_share;
    END IF;

    -- Lot 9 bis (B45, contrat 6.3) : journal dans la transaction ; un échec du journal annule le remboursement
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (p_actor, CASE v_as WHEN 'OWNER' THEN 'PARTENAIRE' WHEN 'ADMIN' THEN 'ADMIN' ELSE 'CLIENT' END,
            'TICKET_REFUND_REQUESTED', 'tickets', t.id,
            jsonb_build_object('as', v_as, 'context', v_ctx, 'reason', COALESCE(p_reason, 'Remboursement'),
                               'mode', v_mode, 'amount', v_amount, 'event_id', t.event_id, 'payment_id', v_payment_id));

    IF v_mode = 'AUCUN' THEN
        UPDATE public.tickets SET status = 'ANNULE' WHERE id = t.id;
        UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = t.category_id;
        RETURN jsonb_build_object('ok', true, 'mode', 'AUCUN', 'amount', 0);
    END IF;

    IF v_mode = 'ORGANISATEUR' THEN
        INSERT INTO public.refunds (payment_id, ticket_id, refund_transaction_id, amount, reason, status, settlement, processed_by, kind, facial_part)
        VALUES (v_payment_id, t.id, v_key, t.price, COALESCE(p_reason, 'Remboursement'), 'PENDING', 'ORGANISATEUR', p_actor, 'TICKET_REFUND', t.price)
        RETURNING id INTO v_refund;
        UPDATE public.tickets SET status = 'ANNULE' WHERE id = t.id;
        UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = t.category_id;
        RETURN jsonb_build_object('ok', true, 'mode', 'ORGANISATEUR', 'refund_id', v_refund, 'amount', t.price);
    END IF;

    v_agg_share := CASE WHEN v_prev_amount + v_share >= p.amount THEN p.aggregator_fee - v_prev_agg
                        ELSE public.fin_round_2(p.aggregator_fee * v_share / p.amount) END;
    v_bearer := public.fin_setting_text('finance.cancellation_aggregator_fee_bearer');

    SELECT first_name, last_name INTO v_user FROM public.users WHERE id = p.client_id;
    v_blocked := CASE
        WHEN p.operator IS NULL THEN 'OPERATOR_UNKNOWN'
        WHEN p.payer_phone IS NULL THEN 'PHONE_UNKNOWN'
        WHEN NULLIF(btrim(v_user.first_name), '') IS NULL OR NULLIF(btrim(v_user.last_name), '') IS NULL THEN 'NAME_UNKNOWN'
        ELSE NULL END;

    INSERT INTO public.refunds (payment_id, ticket_id, refund_transaction_id, amount, reason, status, settlement, processed_by,
                                kind, facial_part, service_part, aggregator_fee_share, aggregator_fee_bearer, net_revenue_reversal)
    VALUES (p.id, t.id, v_key, v_share, COALESCE(p_reason, 'Remboursement'), 'PENDING', 'PLATEFORME', p_actor,
            'TICKET_REFUND', t.price, t.service_fee, v_agg_share, v_bearer,
            CASE WHEN v_bearer = 'ORGANISATEUR' THEN t.service_fee - v_agg_share ELSE t.service_fee END)
    RETURNING id INTO v_refund;
    INSERT INTO public.cashouts (kind, idempotency_key, payment_id, refund_id, ticket_id, beneficiary_user_id, operator, phone_number,
                                 first_name, last_name, amount, blocked_reason)
    VALUES ('TICKET_REFUND', v_key, p.id, v_refund, t.id, p.client_id, p.operator, p.payer_phone,
            NULLIF(btrim(v_user.first_name), ''), NULLIF(btrim(v_user.last_name), ''), v_share, v_blocked)
    RETURNING id INTO v_cashout;
    UPDATE public.refunds SET cashout_id = v_cashout WHERE id = v_refund;
    UPDATE public.tickets SET status = 'REMBOURSEMENT_EN_COURS' WHERE id = t.id;
    UPDATE public.ticket_categories SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = t.category_id;
    v_apply := public.fin_refund_apply(v_refund);
    RETURN jsonb_build_object('ok', true, 'mode', 'CASHOUT', 'refund_id', v_refund, 'cashout_id', v_cashout,
                              'amount', v_share, 'blocked_reason', v_blocked, 'debt', COALESCE(v_apply->'debt', '0'::jsonb));
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.5 event_cancellation_impact (recopie de 20261102000003_lot5_cycle.sql:687-758) : + counter (tâche 4).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_cancellation_impact(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid;
    v_actor uuid;
    a record;
    k record;
    v_online_total numeric;
    v_pending integer;
    v_counter jsonb;
BEGIN
    BEGIN
        v_event := (p->>'event_id')::uuid;
        v_actor := (p->>'actor_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END;
    IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = v_event) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (a.is_owner OR a.is_staff) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;

    WITH t AS (
        SELECT tk.id, tk.user_id, tk.price, tk.payment_id,
               CASE WHEN tk.sale_channel = 'INVITATION' THEN 'INVITATION'
                    WHEN COALESCE(tk.price, 0) = 0 THEN 'FREE'
                    WHEN pay.is_platform_payment THEN 'ONLINE'
                    ELSE 'CASH' END AS kind
          FROM public.tickets tk
          LEFT JOIN public.payments pay ON pay.id = tk.payment_id
         WHERE tk.event_id = v_event AND tk.status::text = 'VALIDE'
    )
    SELECT count(*) FILTER (WHERE kind = 'ONLINE') AS online,
           count(*) FILTER (WHERE kind = 'CASH') AS cash,
           count(*) FILTER (WHERE kind = 'FREE') AS free,
           count(*) FILTER (WHERE kind = 'INVITATION') AS invitations,
           count(DISTINCT user_id) AS buyers,
           COALESCE(sum(price) FILTER (WHERE kind = 'CASH' AND payment_id IS NOT NULL), 0) AS cash_total
      INTO k FROM t;

    SELECT COALESCE(sum(pay.amount - COALESCE((SELECT sum(rf.amount) FROM public.refunds rf
                                                WHERE rf.payment_id = pay.id AND rf.settlement = 'PLATEFORME'), 0)), 0)
      INTO v_online_total
      FROM public.payments pay
     WHERE pay.is_platform_payment AND pay.payment_target::text = 'TICKET'
       AND pay.status::text IN ('SUCCESS', 'PARTIAL') AND pay.amount > 0
       AND (pay.event_id = v_event
            OR pay.id IN (SELECT tk.payment_id FROM public.tickets tk WHERE tk.event_id = v_event AND tk.payment_id IS NOT NULL));

    SELECT count(*) INTO v_pending
      FROM public.payments pay
     WHERE pay.is_platform_payment AND pay.payment_target::text = 'TICKET' AND pay.status::text = 'PENDING'
       AND (pay.event_id = v_event
            OR EXISTS (SELECT 1 FROM public.stock_reservations sr JOIN public.ticket_categories c ON c.id = sr.category_id
                        WHERE sr.payment_id = pay.id AND c.event_id = v_event));

    -- Lot 9 bis (R20, B22) : ventes au guichet (hors plateforme), jamais remboursées par Event Village
    SELECT jsonb_build_object('sales', count(*),
                              'tickets', COALESCE(sum((SELECT count(*) FROM public.tickets tk WHERE tk.payment_id = pay.id)), 0),
                              'total', COALESCE(sum(pay.amount), 0))
      INTO v_counter
      FROM public.payments pay
     WHERE pay.event_id = v_event AND NOT pay.is_platform_payment AND pay.payment_target::text = 'TICKET'
       AND pay.status::text = 'SUCCESS' AND pay.amount > 0;

    RETURN jsonb_build_object(
        'ok', true,
        'tickets', jsonb_build_object('online', k.online, 'cash', k.cash, 'free', k.free, 'invitations', k.invitations),
        'buyers', k.buyers,
        'online_refund_total', GREATEST(v_online_total, 0),
        'cash_refund_total', k.cash_total,
        'pending_payments', v_pending,
        'counter', v_counter);
END;
$$;


-- ============================================================================
-- 9. Privilèges : service_role uniquement
-- ============================================================================
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.fin_frozen_amount(uuid, text, timestamptz)',
        'public.fin_withdrawal_check(uuid, text, numeric, timestamptz)',
        'public.finance_account_balance(uuid, text)',
        'public.withdrawal_request(jsonb)',
        'public.partner_status_set(jsonb)',
        'public.ticket_refund_request(uuid, uuid, text)',
        'public.event_cash_refunds(jsonb)',
        'public.event_cash_refund_mark(jsonb)',
        'public.event_cancellation_impact(jsonb)',
        'public.ticket_postponement_refund_open(uuid)',
        'public.tickets_postponement_offers(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;
