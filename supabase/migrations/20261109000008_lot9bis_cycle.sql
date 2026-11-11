-- ============================================================================
-- EVENT VILLAGE — LOT 9 BIS : le cycle de l'événement (M08, agent S-C ; contrat sections 3.1, 3.2, 3.3, 4.3, 5.20 à 5.29)
-- ============================================================================
-- Rejouable : aucun BEGIN ni COMMIT ; ADD COLUMN IF NOT EXISTS, CREATE TABLE / INDEX IF NOT EXISTS, DROP … IF EXISTS
-- puis ADD pour les contraintes, INSERT … ON CONFLICT DO NOTHING, CREATE OR REPLACE, privilèges réappliqués ; aucune
-- reprise de données (A12 : les fins par défaut ne sont pas réécrites, elles sont recalculées à la lecture).
-- Écrite tâche après tâche (section 10), un commit par tâche ; le bloc des privilèges, en fin de fichier, grandit avec
-- chaque tâche. Chaque recopie part de la dernière définition (grep de toutes les migrations), signature, type de
-- retour et volatilité identiques.
--
-- Tâche 20 (R3 ; B46, D1) :
--  1. Ligne de transition SUSPENDU → TERMINE (ADMIN, motif obligatoire, canal TRANSITION, « Clore l’événement »).
--  2. event_transition(jsonb) : base 20261103000005_lot6_billetterie.sql:942-1054, recopie intégrale, signature et
--     VOLATILE identiques. Changement : SUSPENDU → TERMINE refusé EVENT_NOT_ENDED tant que la fin (event_end_at) n'est
--     pas passée (contrôlé après le motif, avant EVENT_NOT_STARTED). La permission events.write vient de
--     event_actor_profile (M04).
--  3. event_actions(jsonb) : base 20261102000003_lot5_cycle.sql:482-547, recopie intégrale, signature et STABLE
--     identiques. Changement : aucune action que event_transition refuserait par la date : PUBLIE retiré une fois la
--     fin passée (EVENT_ENDED), TERMINE depuis SUSPENDU retiré tant que la fin n'est pas passée (EVENT_NOT_ENDED).
--  Avis EVENT_CLOSED_HOLDER et EVENT_CLOSED_BY_ADMIN : trigger notif_event_status_changed (M09, S-D, fix(9b.20-SD)).
--
-- Tâche 21 (R16 ; B47, B48, X7, A12) :
--  4. event_end_from_v2(p_start_date, p_start_time, p_end_date, p_end_time) (nouvelle, LANGUAGE sql, IMMUTABLE) : fin
--     d'un événement à partir de ses colonnes ; date et heure de fin ; date de fin sans heure → 23:59 ; aucune date de
--     fin → début + 6 h. Nom nouveau (A2, X7) : event_end_from(date, date, time) reste telle quelle, sans appelant
--     après ce fichier et la recopie de event_update (M09).
--  5. event_end_at(uuid) : base 20261102000003_lot5_cycle.sql:149-159, recopie, signature, LANGUAGE sql et STABLE
--     identiques. Changement : sans date de fin, début + 6 h (au lieu du début à 23:59). Formule écrite en ligne : une
--     fonction LANGUAGE sql ne cite que des objets d'un fichier antérieur (section 1). Aucune donnée réécrite.
--  6. event_create(jsonb) : base 20261106000001_lot8_canaux.sql:637-827, recopie intégrale, signature et VOLATILE
--     identiques. Changement : la fin vient de event_end_from_v2 (début + 6 h sans fin) pour borner les ventes.
--  7. scan_states(p jsonb) (nouvelle, STABLE) : p { event_ids[], actor_id? } → { ok, items[{ event_id, open, problem,
--     opens_at, closes_at }] } ; problem = scan_event_problem, bornes = scan_window ; avec actor_id, chaque événement
--     doit être permis par scan_scanner_authorized, sinon SCAN_FORBIDDEN sans aucune donnée.
--  8. DO de fin de fichier : RAISE NOTICE du nombre de catégories dont la fin de vente dépasse la nouvelle fin (A12),
--     sans reprise.
--
-- Tâche 22 (R42, R17 ; B49, B51, D7, D8 ; R43 : SHIFT_OPEN_AT_END par M09, fix(9b.22-SD)) :
--  9. shift_open(jsonb) : base 20261102000003_lot5_cycle.sql:963-999, recopie intégrale, signature identique
--     (VOLATILE écrit, défaut de la base). Changement : pin_verified vrai exigé, sinon PIN_REQUIRED, rien
--     d'écrit (le haché est contrôlé par ShiftService avant l'appel).
-- 10. shift_close(jsonb) : base 20261103000006_lot6_pros_admin.sql:165-308, recopie intégrale, signature et VOLATILE
--     identiques. Changement : rôle ADMIN par admin_can(events.write) ; un compte ADMIN ou SUPERADMIN sans la
--     permission (ni contrôleur de la caisse ni propriétaire) reçoit PERMISSION_MISSING, rien d'écrit. Verrous inchangés.
--
-- Tâche 23 (R19, R44, R46 ; B52, B55, B56, X27 ; R61 par M06 fix(9b.23-SA), R63 par M04 fix(9b.23-SB)) :
-- 11. DDL : ticket_transfers.declined_at et CHECK « DECLINED ⇒ declined_at » (valeur DECLINED posée par M02) ;
--     ticket_scans_result_check recréée avec transfer_pending (aucune migration rejouée ne la recrée, contrat 3.1).
-- 12. ticket_transfers_expire_due(p_ticket, p_skip_locked) (nouvelle, VOLATILE) : expire les transferts PENDING échus
--     du billet (EXPIRED, TRANSFER_EXPIRED à l'expéditeur, même clé que le cron : aucun doublon), lève le verrou du
--     billet s'il ne reste aucun transfert en attente, et rend vrai s'il en reste un. p_skip_locked (ticket_scan, qui
--     tient déjà le billet) : FOR UPDATE SKIP LOCKED sur les transferts, un transfert tenu par une acceptation compte
--     comme en attente, sans attente ni interblocage (X27).
-- 13. ticket_scan(jsonb) : base 20261108000005_lot9_nettoyage.sql:21-216, recopie intégrale, seule recopie du lot
--     (AR5), signature et VOLATILE identiques. Changement : étape 7 bis, billet VALIDE verrouillé par un transfert
--     encore en attente (après ticket_transfers_expire_due en SKIP LOCKED) → transfer_pending, rien de composté.
-- 14. ticket_manual_lookup(jsonb) : base 20261108000005_lot9_nettoyage.sql:222-307, recopie intégrale, signature et
--     VOLATILE identiques. Changement : preview transfer_pending (même règle, ticket_transfers_expire_due sans SKIP).
-- 15. ticket_transfer_decline(p jsonb) (nouvelle) : refus par le destinataire ; mêmes refus d'identité que
--     ticket_transfer_accept et dans le même ordre (aucune fuite) ; échu → expiré, TRANSFER_EXPIRED ; DECLINED et
--     declined_at ; transfert d'un expéditeur : billet déverrouillé, TRANSFER_DECLINED_SENDER ; invitation sans
--     expéditeur : billet ANNULE, place rendue (comme ticket_invitation_cancel), aucun avis. Verrous : events FOR SHARE
--     → (invitation) catégorie FOR NO KEY UPDATE → transfert → billet (ordre 3.3).
-- 16. ticket_transfer_initiate(jsonb) : base 20261103000005_lot6_billetterie.sql:78-170, recopie intégrale, signature
--     et VOLATILE identiques. Changement : l'expiration en ligne d'un transfert échu passe par
--     ticket_transfers_expire_due (avis TRANSFER_EXPIRED à l'expéditeur, comme le cron).
-- 17. ticket_transfers_expire(jsonb) : base 20261103000005_lot6_billetterie.sql:239-290, recopie intégrale, signature
--     et VOLATILE identiques. Changement : filtre facultatif `ticket_ids` (GET /api/tickets expire à la lecture les
--     transferts échus des billets du compte ; le cron passe sans filtre).
-- 18. ticket_transfer_accept(jsonb) : base 20261108000002_lot9_invitations.sql:91-199, recopie intégrale, signature et
--     VOLATILE identiques. Changement : un transfert échu est expiré pour de bon (ticket_transfers_expire_due) avant
--     le refus TRANSFER_EXPIRED ; DECLINED reste TRANSFER_NOT_PENDING.
-- 19. ticket_invitations_list(jsonb) : base 20261108000002_lot9_invitations.sql:582-631, recopie intégrale, signature
--     et STABLE identiques. Changement : invitation refusée par son destinataire → « Refusée ».
-- 20. pilotage_scan_result_label(text) : base 20261102000005_lot5_pilotage.sql:78-102, recopie, signature et IMMUTABLE
--     identiques. Changement : transfer_pending « Transfert en cours ».
--
-- Tâche 24 (R25, R66 ; B58, D5) :
-- 21. ticket_card_states(p jsonb) (nouvelle, STABLE) : p { user_id } → par billet du compte : statut et libellé de
--     l'événement, prix, frais de service, canal de vente, code_visible (billet VALIDE, libre, et scan non refusé
--     par l'événement : ni suspendu, ni annulé, ni fenêtre fermée), transfer_allowed (billet VALIDE, libre, non
--     composté, événement PUBLIE ou VALIDE avant sa fin, même règle que ticket_transfer_initiate) et notice.
--
-- Tâche 25 (R34, R94 ; B61 ; contrôle de sale_start dans event_update par M09, fix(9b.25-SD)) :
--  2 bis. event_transition (même définition, point 2) : à la soumission, début passé (manque start_date « La date
--     de début est passée : changez-la avant de soumettre. ») et catégorie active dont la période de vente dépasse la
--     fin (« La période de vente de « {nom} » dépasse la fin de l’événement. ») sont des manques ; le message de
--     SUBMIT_INCOMPLETE est « L’événement est incomplet : » suivi des manques, `missing` inchangé.
-- 22. ticket_category_update(jsonb) : base 20261106000001_lot8_canaux.sql:900-1041, recopie intégrale, signature et
--     VOLATILE identiques. Changement : un début de vente modifié au-delà ou à la fin de l'événement est refusé
--     SALE_START_AFTER_EVENT « Le début de vente doit précéder la fin de l’événement. ».
--
-- Tâche 26 (R37, R38, R39, R41 ; B62 à B64, D9, D10, D15 ; R102 et l'audit de la tâche 19 portés par la RPC commune) :
-- 23. Table controller_invitations (DDL en tête) : invitation d'un compte existant à devenir contrôleur d'une
--     partenaire, PENDING 72 h, ACCEPTED, DECLINED ou EXPIRED (expirée à la lecture) ; RLS sans politique,
--     service_role seul.
-- 24. controller_invitation_create(p jsonb) (nouvelle) : invitation et CONTROLLER_INVITATION (SMS, in-app, push,
--     email) dans la même transaction, aucun rôle ni affectation ; une invitation en attente de la même partenaire
--     pour le même compte est remplacée (EXPIRED).
-- 25. controller_invitation_respond(p jsonb) (nouvelle) : titulaire seul, compte ACTIF, invitation PENDING non
--     échue ; acceptation : rôle CONTROLEUR (user_roles), affectations aux événements encore VALIDE ou PUBLIE de la
--     partenaire en une instruction (CONTROLLER_ASSIGNED par le trigger existant, D9) ; refus : DECLINED. Verrous :
--     invitation FOR UPDATE → user_roles → event_controllers (3.3).
-- 26. controller_invitations_mine(p jsonb) (nouvelle, STABLE) : invitations en attente non échues du compte.
-- 27. controller_account_states(p jsonb) (nouvelle, STABLE) : état réel d'un compte de contrôleur lu dans
--     auth.users (marque is_temporary_controller_account) : ACTIVATED ou PENDING_ACTIVATION (R39).
-- 28. controller_assignments_sync(p jsonb) (nouvelle) : affectations d'un contrôleur chez une partenaire en une
--     transaction (retraits, ajouts, droit d'encaisser par événement, R41 ; tout ou rien, R102) et journal
--     CONTROLLER_ASSIGNMENTS_UPDATED dedans (tâche 19) ; un droit d'encaisser absent garde la valeur actuelle.
-- ============================================================================


-- ============================================================================
-- DDL (en tête du fichier : aucune DDL après une écriture de données, 55006)
-- ============================================================================

-- Tâche 23 — 11. Refus d'un transfert (R46) : date du refus, exigée pour un transfert DECLINED
ALTER TABLE public.ticket_transfers ADD COLUMN IF NOT EXISTS declined_at timestamptz;
COMMENT ON COLUMN public.ticket_transfers.declined_at IS
    'Lot 9 bis (R46) : refus du billet par son destinataire (ticket_transfer_decline), posé avec le statut DECLINED.';
ALTER TABLE public.ticket_transfers DROP CONSTRAINT IF EXISTS ticket_transfers_declined_at_chk;
ALTER TABLE public.ticket_transfers ADD CONSTRAINT ticket_transfers_declined_at_chk
    CHECK (status <> 'DECLINED' OR declined_at IS NOT NULL);

-- Tâche 23 — 11. Résultat de scan transfer_pending (R19) : billet en cours de transfert, refusé à l'entrée
ALTER TABLE public.ticket_scans DROP CONSTRAINT IF EXISTS ticket_scans_result_check;
ALTER TABLE public.ticket_scans ADD CONSTRAINT ticket_scans_result_check CHECK (result IN (
    'valid', 'already_used', 'invalid', 'cancelled', 'refunded', 'wrong_event', 'event_cancelled', 'event_ended',
    'event_suspended', 'event_not_open', 'payment_required', 'cash_required', 'qr_expired', 'dynamic_qr_required',
    'manual_entry_refused', 'forbidden', 'transfer_pending'));

-- Tâche 26 — 23. Invitations de contrôleur (R37) : le titulaire d'un compte existant accepte lui-même
CREATE TABLE IF NOT EXISTS public.controller_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    assignments JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(assignments) = 'array'),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '72 hours'),
    responded_at TIMESTAMPTZ,
    CONSTRAINT controller_invitations_dates CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_controller_invitations_user ON public.controller_invitations (user_id, status);
CREATE INDEX IF NOT EXISTS idx_controller_invitations_partner ON public.controller_invitations (partner_id, status);
COMMENT ON TABLE public.controller_invitations IS
    'Lot 9 bis (R37) : invitation d''un compte existant à contrôler les événements d''une partenaire ; aucun rôle ni affectation avant l''acceptation du titulaire (72 h). Service_role uniquement.';
ALTER TABLE public.controller_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.controller_invitations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.controller_invitations TO service_role;


-- ============================================================================
-- Tâche 20 — 1. Transition SUSPENDU → TERMINE par un admin (R3)
-- ============================================================================
INSERT INTO public.event_status_transitions (from_status, to_status, actor_kind, reason_required, channel, action_label)
VALUES ('SUSPENDU', 'TERMINE', 'ADMIN', TRUE, 'TRANSITION', 'Clore l’événement')
ON CONFLICT DO NOTHING;


-- ============================================================================
-- Tâche 20 — 2. event_transition (recopie, 20261103000005_lot6_billetterie.sql:942-1054)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.event_transition(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_to_text text := p->>'to_status';
    v_to event_status;
    v_event uuid;
    v_actor uuid;
    v_reason text := NULLIF(btrim(COALESCE(p->>'reason', '')), '');
    e record;
    a record;
    v_role text;
    v_reason_required boolean;
    v_role_missing boolean;
    v_missing jsonb := '[]'::jsonb;
    v_history uuid;
    v_owner uuid;
BEGIN
    IF v_to_text IS NULL OR NOT EXISTS (
        SELECT 1 FROM pg_enum WHERE enumtypid = 'public.event_status'::regtype AND enumlabel = v_to_text) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_STATUS', 'message', 'Statut demandé inconnu.');
    END IF;
    v_to := v_to_text::event_status;
    BEGIN
        v_event := (p->>'event_id')::uuid;
        v_actor := (p->>'actor_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END;
    IF v_event IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;

    SELECT id, partner_id, status, title, image_url, start_date, start_time INTO e
      FROM public.events WHERE id = v_event FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;

    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (a.is_owner OR a.is_staff) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'role_missing', true,
                                  'message', 'Vous n''êtes pas autorisé à changer le statut de cet événement.');
    END IF;
    IF NOT a.is_active THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n''est pas actif.');
    END IF;
    IF v_to = 'ANNULE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CANCELLATION_REQUIRED',
                                  'message', 'L''annulation passe par la procédure d''annulation, qui rembourse les acheteurs.');
    END IF;

    -- Règle de la table : le propriétaire agit comme partenaire, sinon l'admin comme admin
    IF a.is_owner THEN
        SELECT t.reason_required INTO v_reason_required FROM public.event_status_transitions t
         WHERE t.from_status = e.status AND t.to_status = v_to AND t.actor_kind = 'PARTENAIRE' AND t.channel = 'TRANSITION';
        IF FOUND THEN v_role := 'PARTENAIRE'; END IF;
    END IF;
    IF v_role IS NULL AND a.is_staff THEN
        SELECT t.reason_required INTO v_reason_required FROM public.event_status_transitions t
         WHERE t.from_status = e.status AND t.to_status = v_to AND t.actor_kind = 'ADMIN' AND t.channel = 'TRANSITION';
        IF FOUND THEN v_role := 'ADMIN'; END IF;
    END IF;
    IF v_role IS NULL THEN
        v_role_missing := EXISTS (SELECT 1 FROM public.event_status_transitions t
                                   WHERE t.from_status = e.status AND t.to_status = v_to AND t.channel <> 'CANCELLATION');
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSITION_NOT_ALLOWED', 'role_missing', v_role_missing,
            'message', CASE WHEN v_role_missing
                            THEN format('Votre rôle ne permet pas de passer cet événement de « %s » à « %s ».',
                                        public.event_status_label(e.status::text), public.event_status_label(v_to::text))
                            ELSE format('Un événement « %s » ne peut pas passer à « %s ».',
                                        public.event_status_label(e.status::text), public.event_status_label(v_to::text)) END);
    END IF;

    IF v_reason_required AND (v_reason IS NULL OR char_length(v_reason) < 3) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Un motif d''au moins 3 caractères est obligatoire.');
    END IF;

    IF e.status = 'BROUILLON' AND v_to = 'EN_ATTENTE' THEN
        IF NULLIF(btrim(COALESCE(e.image_url, '')), '') IS NULL THEN
            v_missing := v_missing || jsonb_build_object('field', 'image_url', 'message', 'Ajoutez une affiche à l''événement.');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.ticket_categories c WHERE c.event_id = v_event AND c.is_active) THEN
            v_missing := v_missing || jsonb_build_object('field', 'ticket_categories', 'message', 'Ajoutez au moins une catégorie de billets active.');
        END IF;
        -- Lot 9 bis (R94) : dates contrôlées à la soumission (début passé, période de vente au-delà de la fin)
        IF ((e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar') <= now() THEN
            v_missing := v_missing || jsonb_build_object('field', 'start_date', 'message', 'La date de début est passée : changez-la avant de soumettre.');
        END IF;
        SELECT v_missing || COALESCE(jsonb_agg(jsonb_build_object(
                   'field', 'ticket_categories',
                   'message', format('La période de vente de « %s » dépasse la fin de l’événement.', c.name)) ORDER BY c.name, c.id), '[]'::jsonb)
          INTO v_missing
          FROM public.ticket_categories c
         WHERE c.event_id = v_event AND c.is_active
           AND ((c.sale_start IS NOT NULL AND c.sale_start >= public.event_end_at(v_event))
             OR (c.sale_end IS NOT NULL AND c.sale_end > public.event_end_at(v_event)));
        IF jsonb_array_length(v_missing) > 0 THEN
            -- Lot 9 bis (R34) : le message liste les manques, pour que tout écran l'affiche tel quel
            RETURN jsonb_build_object('ok', false, 'code', 'SUBMIT_INCOMPLETE', 'missing', v_missing,
                                      'message', 'L’événement est incomplet : '
                                                 || (SELECT string_agg(m->>'message', ' ' ORDER BY o) FROM jsonb_array_elements(v_missing) WITH ORDINALITY AS x(m, o)));
        END IF;
    END IF;
    IF v_to = 'PUBLIE' AND public.event_end_at(v_event) <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_ENDED', 'message', 'La fin de cet événement est passée : il ne peut plus être publié.');
    END IF;
    -- Lot 9 bis (R3) : un SUSPENDU ne se clôt qu'une fois sa fin passée ; avant, il se réactive ou s'annule.
    IF e.status = 'SUSPENDU' AND v_to = 'TERMINE' AND public.event_end_at(v_event) > now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ENDED',
                                  'message', 'L’événement n’est pas fini : réactivez-le ou annulez-le.');
    END IF;
    IF v_to = 'TERMINE' AND ((e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar') > now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_STARTED',
                                  'message', 'Un événement qui n''a pas commencé ne se termine pas : suspendez-le ou annulez-le.');
    END IF;

    v_history := public.event_status_apply(v_event, e.status, v_to, v_actor, v_role, v_reason, 'TRANSITION');

    -- Lot 6 : les avis (partenaire, porteurs, administrateurs) sont mis en file par le trigger
    -- trg_event_status_notify sur la ligne d'historique, dans cette même transaction.
    SELECT user_id INTO v_owner FROM public.partners WHERE id = e.partner_id;

    RETURN jsonb_build_object('ok', true, 'event_id', v_event, 'from', e.status::text, 'to', v_to::text,
                              'actor_role', v_role, 'reason', v_reason, 'history_id', v_history,
                              'title', e.title, 'partner_user_id', v_owner);
END;
$$;


-- ============================================================================
-- Tâche 20 — 3. event_actions (recopie, 20261102000003_lot5_cycle.sql:482-547)
-- ============================================================================
-- p : { event_id, actor_id } → { ok, status, actions[{to, reason_required, label}], can_edit, can_cancel, last_reason? }
CREATE OR REPLACE FUNCTION public.event_actions(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid;
    v_actor uuid;
    e record;
    a record;
    h record;
    v_kinds text[] := ARRAY[]::text[];
    v_actions jsonb;
    v_last jsonb;
    v_ended boolean;
BEGIN
    BEGIN
        v_event := (p->>'event_id')::uuid;
        v_actor := (p->>'actor_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END;
    SELECT id, status INTO e FROM public.events WHERE id = v_event;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT (a.is_owner OR a.is_staff) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');
    END IF;
    IF a.is_owner THEN v_kinds := v_kinds || 'PARTENAIRE'::text; END IF;
    IF a.is_staff THEN v_kinds := v_kinds || 'ADMIN'::text; END IF;

    -- Lot 9 bis (R3) : aucune action que event_transition refuserait par la date
    v_ended := COALESCE(public.event_end_at(v_event) <= now(), FALSE);

    SELECT COALESCE(jsonb_agg(x.action ORDER BY x.to_status), '[]'::jsonb) INTO v_actions
      FROM (SELECT DISTINCT ON (t.to_status) t.to_status,
                   jsonb_build_object('to', t.to_status::text, 'reason_required', t.reason_required, 'label', t.action_label) AS action
              FROM public.event_status_transitions t
             WHERE t.from_status = e.status AND t.channel = 'TRANSITION' AND t.actor_kind = ANY (v_kinds)
               AND NOT (t.to_status = 'PUBLIE' AND v_ended)
               AND NOT (t.from_status = 'SUSPENDU' AND t.to_status = 'TERMINE' AND NOT v_ended)
             ORDER BY t.to_status, (t.actor_kind = 'PARTENAIRE') DESC) x;

    SELECT old_status::text AS old_status, new_status::text AS new_status, actor_role, reason, created_at INTO h
      FROM public.event_status_history
     WHERE event_id = v_event
     ORDER BY created_at DESC, txid DESC, id DESC
     LIMIT 1;
    -- Champs du record lus seulement s'il est affecté (pas de court-circuit garanti sur AND)
    IF FOUND THEN
        IF h.new_status = e.status::text THEN
            IF h.old_status = 'EN_ATTENTE' AND h.new_status = 'BROUILLON' AND h.actor_role = 'ADMIN' THEN
                v_last := jsonb_build_object('kind', 'REFUS', 'reason', h.reason, 'at', h.created_at);
            ELSIF h.old_status = 'PUBLIE' AND h.new_status = 'SUSPENDU' THEN
                v_last := jsonb_build_object('kind', 'SUSPENSION', 'reason', h.reason, 'at', h.created_at);
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'status', e.status::text,
        'actions', v_actions,
        'can_edit', a.is_owner AND e.status::text IN ('BROUILLON', 'VALIDE', 'PUBLIE', 'SUSPENDU'),
        'can_cancel', e.status::text IN ('VALIDE', 'PUBLIE', 'SUSPENDU'),
        'last_reason', v_last);
END;
$$;


-- ============================================================================
-- Tâche 21 — 4. event_end_from_v2 (nouvelle)
-- ============================================================================
-- Fin d'un événement à partir de ses colonnes (même règle que event_end_at, heure de Dakar) : date et heure de fin ;
-- date de fin sans heure → 23:59 ; aucune date de fin → début + 6 h.
CREATE OR REPLACE FUNCTION public.event_end_from_v2(p_start_date date, p_start_time time, p_end_date date, p_end_time time)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE WHEN p_end_date IS NOT NULL
                THEN ((p_end_date + COALESCE(p_end_time, time '23:59')) AT TIME ZONE 'Africa/Dakar')
                ELSE ((p_start_date + COALESCE(p_start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar') + interval '6 hours'
           END
$$;


-- ============================================================================
-- Tâche 21 — 5. event_end_at (recopie, 20261102000003_lot5_cycle.sql:149-159)
-- ============================================================================
-- Fin d'un événement (lot 9 bis, R16) : end_date + end_time à Dakar ; fin sans heure : end_date à 23:59 ;
-- sans fin : début (start_date + start_time) + 6 h.
CREATE OR REPLACE FUNCTION public.event_end_at(p_event_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE WHEN e.end_date IS NOT NULL
                THEN ((e.end_date + COALESCE(e.end_time, time '23:59')) AT TIME ZONE 'Africa/Dakar')
                ELSE ((e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar') + interval '6 hours'
           END
      FROM public.events e WHERE e.id = p_event_id
$$;


-- ============================================================================
-- Tâche 21 — 6. event_create (recopie, 20261106000001_lot8_canaux.sql:637-827)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.event_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_ev jsonb := p->'event';
    v_cats jsonb := COALESCE(p->'ticket_categories', '[]'::jsonb);
    v_partner record;
    v_key text;
    v_title text;
    v_category event_category;
    v_description text;
    v_start_date date;
    v_start_time time;
    v_end_date date;
    v_end_time time;
    v_location text;
    v_city text;
    v_lat double precision;
    v_lng double precision;
    v_image text;
    v_capacity integer;
    v_program jsonb;
    v_practical jsonb;
    v_start timestamptz;
    v_end timestamptz;
    v_cat jsonb;
    v_norm jsonb;
    v_idx integer;
    v_names text[] := ARRAY[]::text[];
    v_normalized jsonb := '[]'::jsonb;
    v_active_sum integer := 0;
    v_slug text;
    v_event_id uuid;
    v_row jsonb;
BEGIN
    IF v_actor IS NULL THEN
        RETURN public.event_edit_refusal('PARTNER_NOT_FOUND', 'Seul un organisateur disposant d''un profil partenaire peut créer un événement.');
    END IF;
    SELECT pa.id, pa.status::text AS status, u.status::text AS user_status INTO v_partner
      FROM public.partners pa JOIN public.users u ON u.id = pa.user_id
     WHERE pa.user_id = v_actor;
    IF NOT FOUND THEN
        RETURN public.event_edit_refusal('PARTNER_NOT_FOUND', 'Seul un organisateur disposant d''un profil partenaire peut créer un événement.');
    END IF;
    IF v_partner.user_status <> 'ACTIF' THEN
        RETURN public.event_edit_refusal('ACCOUNT_NOT_ACTIVE', 'Votre compte n''est pas actif.');
    END IF;
    IF v_partner.status <> 'VALIDE' THEN
        RETURN public.event_edit_refusal('PARTNER_NOT_VALIDATED', 'Votre profil d''organisateur doit être validé avant de créer un événement.');
    END IF;

    IF v_ev IS NULL OR jsonb_typeof(v_ev) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les informations de l''événement sont illisibles.');
    END IF;
    IF jsonb_typeof(v_cats) <> 'array' OR jsonb_array_length(v_cats) > 50 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les catégories de billets sont illisibles (50 au plus).', 'ticket_categories');
    END IF;
    SELECT k INTO v_key FROM jsonb_object_keys(v_ev) AS k
     WHERE k <> ALL (ARRAY['title', 'category', 'description', 'start_date', 'start_time', 'end_date', 'end_time', 'location', 'city',
                           'latitude', 'longitude', 'image_url', 'capacity', 'program', 'practical_info'])
     ORDER BY k LIMIT 1;
    IF v_key IS NOT NULL THEN
        RETURN public.event_edit_refusal('FIELD_NOT_EDITABLE', 'Ce champ ne peut pas être fourni à la création d''un événement.', v_key);
    END IF;

    BEGIN
        v_title := btrim(v_ev->>'title');
        v_key := 'category';
        v_category := (v_ev->>'category')::event_category;
        v_key := NULL;
        v_description := NULLIF(btrim(COALESCE(v_ev->>'description', '')), '');
        v_start_date := (v_ev->>'start_date')::date;
        v_start_time := (v_ev->>'start_time')::time;
        v_end_date := NULLIF(v_ev->>'end_date', '')::date;
        v_end_time := NULLIF(v_ev->>'end_time', '')::time;
        v_location := btrim(v_ev->>'location');
        v_city := btrim(v_ev->>'city');
        v_lat := (v_ev->>'latitude')::double precision;
        v_lng := (v_ev->>'longitude')::double precision;
        v_image := NULLIF(btrim(COALESCE(v_ev->>'image_url', '')), '');
        v_capacity := (v_ev->>'capacity')::integer;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
        IF v_key = 'category' THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une catégorie d''événement dans la liste.', 'category');
        END IF;
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Une valeur de l''événement est illisible.');
    END;
    v_program := COALESCE(v_ev->'program', '[]'::jsonb);
    v_practical := COALESCE(v_ev->'practical_info', '{}'::jsonb);

    IF v_title IS NULL OR char_length(v_title) < 3 OR char_length(v_title) > 120 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le titre compte de 3 à 120 caractères.', 'title');
    END IF;
    IF v_category IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une catégorie d''événement dans la liste.', 'category');
    END IF;
    IF v_description IS NOT NULL AND char_length(v_description) > 5000 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La description ne dépasse pas 5 000 caractères.', 'description');
    END IF;
    IF v_location IS NULL OR char_length(v_location) < 2 OR char_length(v_location) > 200 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le lieu compte de 2 à 200 caractères.', 'location');
    END IF;
    IF v_city IS NULL OR char_length(v_city) < 2 OR char_length(v_city) > 80 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La ville compte de 2 à 80 caractères.', 'city');
    END IF;
    IF v_lat IS NOT NULL AND (v_lat < -90 OR v_lat > 90) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La latitude est comprise entre -90 et 90.', 'latitude');
    END IF;
    IF v_lng IS NOT NULL AND (v_lng < -180 OR v_lng > 180) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La longitude est comprise entre -180 et 180.', 'longitude');
    END IF;
    IF v_capacity IS NOT NULL AND (v_capacity < 1 OR v_capacity > 100000) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La jauge est un nombre entier de 1 à 100 000.', 'capacity');
    END IF;
    IF NOT public.event_poster_path_ok(v_image, v_partner.id) THEN
        RETURN public.event_edit_refusal('IMAGE_ORIGIN_INVALID', 'L''affiche doit être déposée depuis le formulaire de l''événement.', 'image_url');
    END IF;
    IF jsonb_typeof(v_program) <> 'array' OR jsonb_array_length(v_program) > 50 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le programme compte 50 lignes au plus.', 'program');
    END IF;
    IF jsonb_typeof(v_practical) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les informations pratiques sont illisibles.', 'practical_info');
    END IF;

    IF v_end_time IS NOT NULL AND v_end_date IS NULL THEN
        RETURN public.event_edit_refusal('END_DATE_REQUIRED', 'Indiquez la date de fin pour l''heure de fin saisie.', 'end_date');
    END IF;
    v_start := (v_start_date + v_start_time) AT TIME ZONE 'Africa/Dakar';
    IF v_start <= now() THEN
        RETURN public.event_edit_refusal('EVENT_START_PAST', 'Le début de l''événement doit être dans le futur (heure de Dakar).', 'start_date');
    END IF;
    v_end := public.event_end_from_v2(v_start_date, v_start_time, v_end_date, v_end_time);
    IF v_end_date IS NOT NULL AND v_end <= v_start THEN
        RETURN public.event_edit_refusal('EVENT_END_BEFORE_START', 'La fin de l''événement doit être postérieure à son début.',
                                         CASE WHEN v_end_time IS NOT NULL THEN 'end_time' ELSE 'end_date' END);
    END IF;

    -- Catégories : toutes contrôlées avant la moindre écriture (tout ou rien)
    FOR v_cat, v_idx IN SELECT x.e, (x.o - 1)::int FROM jsonb_array_elements(v_cats) WITH ORDINALITY AS x(e, o) LOOP
        v_norm := public.ticket_category_normalize(v_cat, v_end, format('ticket_categories.%s.', v_idx));
        IF (v_norm->>'ok')::boolean IS NOT TRUE THEN
            RETURN v_norm;
        END IF;
        IF lower(v_norm->>'name') = ANY (v_names) THEN
            RETURN public.event_edit_refusal('CATEGORY_NAME_TAKEN',
                format('Deux catégories portent le nom « %s » : chaque nom doit être unique.', v_norm->>'name'),
                format('ticket_categories.%s.name', v_idx));
        END IF;
        v_names := array_append(v_names, lower(v_norm->>'name'));
        IF (v_norm->>'is_active')::boolean THEN
            v_active_sum := v_active_sum + (v_norm->>'total_quantity')::integer;
        END IF;
        v_normalized := v_normalized || jsonb_build_array(v_norm);
    END LOOP;
    IF v_capacity IS NOT NULL AND v_active_sum > v_capacity THEN
        RETURN public.event_edit_refusal('QUOTA_ABOVE_CAPACITY',
            format('La somme des quotas des catégories actives (%s) dépasse la jauge (%s).', v_active_sum, v_capacity), 'capacity');
    END IF;

    v_slug := btrim(regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'), '-');
    IF v_slug = '' THEN v_slug := 'evenement'; END IF;
    v_slug := left(v_slug, 60) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

    -- Statut forcé à BROUILLON par trg_events_force_draft, historique NULL → BROUILLON par trg_events_log_creation
    INSERT INTO public.events (partner_id, title, slug, category, description, start_date, start_time, end_date, end_time,
                               location, city, latitude, longitude, image_url, gallery_urls, capacity, program, practical_info, services)
    VALUES (v_partner.id, v_title, v_slug, v_category, v_description, v_start_date, v_start_time, v_end_date, v_end_time,
            v_location, v_city, v_lat, v_lng, v_image, '{}', v_capacity, v_program, v_practical,
            '{"ticketing": true, "tableBooking": false, "communication": false}'::jsonb)
    RETURNING id INTO v_event_id;

    INSERT INTO public.ticket_categories (event_id, name, description, price, total_quantity, sold_quantity, max_per_order,
                                          sale_start, sale_end, sale_online, sale_counter, is_active)
    SELECT v_event_id, c->>'name', c->>'description', (c->>'price')::numeric, (c->>'total_quantity')::integer, 0,
           (c->>'max_per_order')::integer, (c->>'sale_start')::timestamptz, (c->>'sale_end')::timestamptz,
           (c->>'sale_online')::boolean, (c->>'sale_counter')::boolean, (c->>'is_active')::boolean
      FROM jsonb_array_elements(v_normalized) AS c;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'EVENT_CREATED', 'EVENT', v_event_id,
            jsonb_build_object('categories', jsonb_array_length(v_normalized)));

    SELECT to_jsonb(ev) INTO v_row FROM public.events ev WHERE ev.id = v_event_id;
    RETURN jsonb_build_object('ok', true, 'event_id', v_event_id, 'event', v_row);
END;
$$;


-- ============================================================================
-- Tâche 21 — 7. scan_states (nouvelle)
-- ============================================================================
-- p : { event_ids[], actor_id? } → { ok, items[{ event_id, open, problem, opens_at, closes_at }] } ; le scanner et le
-- scan partenaire décident par `open` (même règle que ticket_scan : scan_event_problem et scan_window). Avec actor_id,
-- un seul événement non permis (scan_scanner_authorized) refuse tout : SCAN_FORBIDDEN, aucune donnée.
CREATE OR REPLACE FUNCTION public.scan_states(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_ids uuid[] := ARRAY[]::uuid[];
    v_id uuid;
    v_raw text;
    v_items jsonb := '[]'::jsonb;
    v_problem text;
    w record;
BEGIN
    IF jsonb_typeof(p->'event_ids') IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Liste d''événements illisible.');
    END IF;
    FOR v_raw IN SELECT jsonb_array_elements_text(p->'event_ids') LOOP
        v_id := public.try_uuid(v_raw);
        IF v_id IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Liste d''événements illisible.');
        END IF;
        IF NOT v_id = ANY (v_ids) THEN v_ids := v_ids || v_id; END IF;
    END LOOP;
    IF p ? 'actor_id' THEN
        IF v_actor IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'SCAN_FORBIDDEN');
        END IF;
        FOREACH v_id IN ARRAY v_ids LOOP
            IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = v_id) OR NOT public.scan_scanner_authorized(v_actor, v_id) THEN
                RETURN jsonb_build_object('ok', false, 'code', 'SCAN_FORBIDDEN');
            END IF;
        END LOOP;
    END IF;
    FOREACH v_id IN ARRAY v_ids LOOP
        CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.events WHERE id = v_id);
        v_problem := public.scan_event_problem(v_id);
        SELECT * INTO w FROM public.scan_window(v_id);
        v_items := v_items || jsonb_build_object('event_id', v_id, 'open', v_problem IS NULL, 'problem', v_problem,
                                                 'opens_at', w.opens_at, 'closes_at', w.closes_at);
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;


-- ============================================================================
-- Tâche 22 — 9. shift_open (recopie, 20261102000003_lot5_cycle.sql:963-999)
-- ============================================================================
-- Ouverture de caisse : PUBLIE, ou TERMINE tant que la fenêtre de scan est ouverte (D7) ; lot 9 bis (R42) : PIN
-- régisseur vérifié exigé (pin_verified posé par ShiftService après contrôle du haché), sinon PIN_REQUIRED.
CREATE OR REPLACE FUNCTION public.shift_open(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := (p->>'user_id')::uuid;
    v_event uuid := (p->>'event_id')::uuid;
    v_float numeric := COALESCE((p->>'opening_float')::numeric, 0);
    v_partner uuid;
    v_status text;
    v_id uuid;
BEGIN
    SELECT partner_id, status::text INTO v_partner, v_status FROM public.events WHERE id = v_event;
    IF v_partner IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_FOUND'); END IF;
    IF v_status NOT IN ('PUBLIE', 'TERMINE') THEN RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_OPEN', 'status', v_status); END IF;
    IF v_status = 'TERMINE' AND public.scan_event_problem(v_event) IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_OPEN', 'status', v_status);
    END IF;
    IF NOT public.shift_can_handle_cash(v_user, v_event) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CASH_FORBIDDEN', 'message', 'Encaissement réservé au contrôleur affecté avec la permission espèces, au partenaire propriétaire ou à un admin.');
    END IF;
    IF v_float < 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FLOAT'); END IF;
    IF COALESCE((p->>'pin_verified')::boolean, FALSE) IS NOT TRUE THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PIN_REQUIRED', 'message', 'Saisissez le code PIN du régisseur.');
    END IF;
    INSERT INTO public.controller_shifts (controller_id, event_id, partner_id, opening_float_amount, status, opening_confirmed_by_pin)
    VALUES (v_user, v_event, v_partner, v_float, 'OUVERT', COALESCE((p->>'pin_verified')::boolean, FALSE))
    ON CONFLICT (controller_id, event_id) WHERE status = 'OUVERT' DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM public.controller_shifts WHERE controller_id = v_user AND event_id = v_event AND status = 'OUVERT';
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_ALREADY_OPEN', 'shift_id', v_id);
    END IF;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_user, 'CAISSE', 'SHIFT_OPENED', 'controller_shifts', v_id, jsonb_build_object('event_id', v_event, 'opening_float', v_float));
    RETURN jsonb_build_object('ok', true, 'shift_id', v_id);
END;
$$;


-- ============================================================================
-- Tâche 22 — 10. shift_close (recopie, 20261103000006_lot6_pros_admin.sql:165-308)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.shift_close(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shift uuid := public.try_uuid(p->>'shift_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_just text := NULLIF(btrim(COALESCE(p->>'justification', '')), '');
    v_pin_salt text := NULLIF(p->>'pin_salt', '');
    v_pin_hash text := NULLIF(p->>'pin_hash', '');
    sh record;
    pin record;
    v_role text;
    v_declared numeric;
    v_disc numeric;
    v_cosigned boolean := FALSE;
    v_partner_user uuid;
    v_event_title text;
    v_ctrl_name text;
    v_event_data jsonb;
    v_alert_queued boolean := FALSE;
    v_created integer := 0;
BEGIN
    IF v_shift IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande de clôture incomplète.');
    END IF;
    SELECT * INTO sh FROM public.controller_shifts WHERE id = v_shift FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_FOUND', 'message', 'Session de caisse introuvable.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status = 'ACTIF') THEN
        v_role := CASE
            WHEN sh.controller_id = v_actor THEN 'CAISSE'
            WHEN EXISTS (SELECT 1 FROM public.partners pa WHERE pa.id = sh.partner_id AND pa.user_id = v_actor) THEN 'PARTENAIRE'
            -- Lot 9 bis (R17, B49) : un admin ferme la caisse d'un autre avec events.write (SUPERADMIN toujours)
            WHEN public.admin_can(v_actor, 'events.write') THEN 'ADMIN'
        END;
        IF v_role IS NULL AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role IN ('ADMIN', 'SUPERADMIN')) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PERMISSION_MISSING', 'permission', 'events.write',
                                      'message', 'Action non autorisée : votre compte n’a pas la permission « Gérer les événements ».');
        END IF;
    END IF;
    IF v_role IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_FOUND', 'message', 'Session de caisse introuvable.');
    END IF;
    IF sh.status <> 'OUVERT' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_OPEN', 'status', sh.status,
                                  'message', 'Cette session de caisse est déjà clôturée.');
    END IF;
    IF jsonb_typeof(p->'declared_cash_total') IS DISTINCT FROM 'number' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DECLARED', 'message', 'Le montant déclaré doit être un nombre entier de francs, positif ou nul.');
    END IF;
    v_declared := (p->>'declared_cash_total')::numeric;
    IF v_declared < 0 OR v_declared <> trunc(v_declared) OR v_declared > 9999999999 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DECLARED', 'message', 'Le montant déclaré doit être un nombre entier de francs, positif ou nul.');
    END IF;

    v_disc := v_declared - sh.expected_cash_total;   -- total attendu relu sous verrou
    IF v_disc <> 0 THEN
        IF v_just IS NULL OR char_length(v_just) < 10 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'JUSTIFICATION_REQUIRED', 'expected', sh.expected_cash_total,
                                      'declared', v_declared, 'discrepancy', v_disc,
                                      'message', 'Un écart de caisse doit être justifié (10 caractères au moins).');
        END IF;
        IF char_length(v_just) > 1000 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_JUSTIFICATION', 'message', 'La justification est limitée à 1 000 caractères.');
        END IF;
        IF v_pin_salt IS NULL OR v_pin_hash IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PIN_REQUIRED', 'expected', sh.expected_cash_total,
                                      'declared', v_declared, 'discrepancy', v_disc,
                                      'message', 'Le code PIN régisseur est obligatoire pour co-signer une clôture avec écart.');
        END IF;
        SELECT pin_hash, pin_salt INTO pin FROM public.event_regisseur_pins WHERE event_id = sh.event_id FOR SHARE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PIN_NOT_SET', 'message', 'Aucun code PIN régisseur n''a été généré pour cet événement.');
        END IF;
        IF pin.pin_salt IS DISTINCT FROM v_pin_salt OR pin.pin_hash IS DISTINCT FROM v_pin_hash THEN
            RETURN jsonb_build_object('ok', false, 'code', 'PIN_INVALID', 'message', 'Code PIN régisseur incorrect.');
        END IF;
        v_cosigned := TRUE;
    END IF;

    UPDATE public.controller_shifts
       SET status = 'CLOTURE',
           declared_cash_total = v_declared,
           discrepancy_amount = v_disc,
           discrepancy_justification = CASE WHEN v_disc <> 0 THEN v_just END,
           closed_at = now(),
           closed_by = v_actor,
           closing_confirmed_by_pin = v_cosigned,
           updated_at = now()
     WHERE id = sh.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, v_role, 'SHIFT_CLOSED', 'controller_shifts', sh.id,
            jsonb_build_object('event_id', sh.event_id, 'expected', sh.expected_cash_total, 'declared', v_declared,
                               'discrepancy', v_disc, 'pin_cosigned', v_cosigned, 'closed_by_role', v_role));

    SELECT title INTO v_event_title FROM public.events WHERE id = sh.event_id;
    SELECT NULLIF(btrim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '') INTO v_ctrl_name
      FROM public.users WHERE id = sh.controller_id;
    v_event_data := public.notif_pros_event_data(sh.event_id);

    -- Lot 6 (J2.1) : alerte d'écart au partenaire propriétaire, mise en file dans cette transaction.
    IF v_disc <> 0 THEN
        SELECT user_id INTO v_partner_user FROM public.partners WHERE id = sh.partner_id;
        IF v_partner_user IS NOT NULL THEN
            v_created := public.notif_enqueue(jsonb_build_object(
                'type', 'SHIFT_DISCREPANCY',
                'key', 'SHIFT_DISCREPANCY:' || sh.id::text,
                'user_id', v_partner_user,
                'event_id', sh.event_id,
                'shift_id', sh.id,
                'data', v_event_data || jsonb_build_object(
                    'shift_id', sh.id,
                    'controller_name', COALESCE(v_ctrl_name, 'votre contrôleur'),
                    'difference', v_disc,
                    'declared', v_declared,
                    'expected', sh.expected_cash_total,
                    'justification', v_just)
            ));
            v_alert_queued := v_created > 0;
        END IF;
    END IF;

    -- Lot 6 (J2.1) : caisse fermée par le partenaire ou un admin → avis au contrôleur de la caisse.
    IF v_role IN ('PARTENAIRE', 'ADMIN') THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'SHIFT_CLOSED_BY_OTHER',
            'key', 'SHIFT_CLOSED_BY_OTHER:' || sh.id::text,
            'user_id', sh.controller_id,
            'event_id', sh.event_id,
            'shift_id', sh.id,
            'data', v_event_data || jsonb_build_object(
                'shift_id', sh.id,
                'closed_by', CASE WHEN v_role = 'PARTENAIRE' THEN 'PARTNER' ELSE 'ADMIN' END,
                'declared', v_declared)
        ));
    END IF;

    RETURN jsonb_build_object('ok', true, 'shift_id', sh.id, 'event_id', sh.event_id, 'partner_id', sh.partner_id,
                              'expected', sh.expected_cash_total, 'declared', v_declared, 'discrepancy', v_disc,
                              'pin_cosigned', v_cosigned, 'closed_by', v_actor, 'closed_by_role', v_role,
                              'alert_queued', v_alert_queued, 'event_title', v_event_title, 'controller_name', v_ctrl_name,
                              'justification', CASE WHEN v_disc <> 0 THEN v_just END);
END;
$$;


-- ============================================================================
-- Tâche 23 — 12. ticket_transfers_expire_due (nouvelle)
-- ============================================================================
-- Expiration à la lecture (R44) des transferts PENDING échus d'un billet ; rend vrai s'il reste un transfert en
-- attente. Ordre des verrous : transferts du billet, puis billet (3.3). p_skip_locked : l'appelant tient déjà le billet
-- (ticket_scan) ; un transfert tenu ailleurs (acceptation en cours) est sauté et compte comme en attente (X27).
CREATE OR REPLACE FUNCTION public.ticket_transfers_expire_due(p_ticket uuid, p_skip_locked boolean)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ids uuid[];
    v_event uuid;
    v_pending boolean;
    r record;
BEGIN
    IF p_ticket IS NULL THEN
        RETURN FALSE;
    END IF;
    IF COALESCE(p_skip_locked, FALSE) THEN
        SELECT array_agg(x.id ORDER BY x.id) INTO v_ids
          FROM (SELECT tt.id FROM public.ticket_transfers tt
                 WHERE tt.ticket_id = p_ticket AND tt.status = 'PENDING' AND tt.expires_at <= now()
                 ORDER BY tt.id
                   FOR UPDATE SKIP LOCKED) x;
    ELSE
        SELECT array_agg(x.id ORDER BY x.id) INTO v_ids
          FROM (SELECT tt.id FROM public.ticket_transfers tt
                 WHERE tt.ticket_id = p_ticket AND tt.status = 'PENDING' AND tt.expires_at <= now()
                 ORDER BY tt.id
                   FOR UPDATE) x;
    END IF;

    IF v_ids IS NOT NULL THEN
        UPDATE public.ticket_transfers SET status = 'EXPIRED', expired_at = now()
         WHERE id = ANY (v_ids) AND status = 'PENDING';
        SELECT t.event_id INTO v_event FROM public.tickets t WHERE t.id = p_ticket;
        -- Même avis et même clé que le cron ticket_transfers_expire : aucun doublon s'il passe ensuite
        FOR r IN SELECT tt.id, tt.from_user_id FROM public.ticket_transfers tt WHERE tt.id = ANY (v_ids) ORDER BY tt.id LOOP
            CONTINUE WHEN r.from_user_id IS NULL;
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'TRANSFER_EXPIRED', 'key', 'TRANSFER_EXPIRED:' || r.id::text,
                'user_id', r.from_user_id, 'event_id', v_event,
                'data', COALESCE(public.notif_event_data(v_event), '{}'::jsonb)
                        || jsonb_build_object('transfer_id', r.id, 'ticket_id', p_ticket)));
        END LOOP;
    END IF;

    v_pending := EXISTS (SELECT 1 FROM public.ticket_transfers tt WHERE tt.ticket_id = p_ticket AND tt.status = 'PENDING');
    IF v_ids IS NOT NULL AND NOT v_pending THEN
        UPDATE public.tickets SET transfer_locked = FALSE, updated_at = now() WHERE id = p_ticket AND transfer_locked;
    END IF;
    RETURN v_pending;
END;
$$;


-- ============================================================================
-- Tâche 23 — 13. ticket_scan (recopie, 20261108000005_lot9_nettoyage.sql:21-216)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ticket_scan(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_scanner uuid := (p->>'scanner_id')::uuid;
    v_event uuid := (p->>'event_id')::uuid;
    v_method text := COALESCE(p->>'method', 'QR');
    v_identity boolean := COALESCE((p->>'identity_verified')::boolean, FALSE);
    v_hash text := NULLIF(p->>'payload_hash', '');
    v_pre text := NULLIF(p->>'pre_result', '');
    v_key text := NULLIF(btrim(COALESCE(p->>'client_key', '')), '');
    -- Lot 8 (8.2 e) : lecture sans cast ; toute valeur non `false` compte comme un renvoi, jamais un compostage
    v_replay_only boolean := COALESCE(p->>'replay_only', 'false') <> 'false';
    v_version integer;
    v_ticket_id uuid;
    t record;
    s record;
    v_problem text;
    v_pay_status text;
    v_order_status text;
    v_scope text;
    v_scan uuid;
    v_info jsonb;
    v_reply jsonb;
    v_checked_at timestamptz;
    v_checked_by uuid;
BEGIN
    IF v_method NOT IN ('QR', 'MANUAL') THEN
        RAISE EXCEPTION 'ticket_scan : méthode % inconnue', v_method;
    END IF;
    -- Clé d'idempotence : facultative pour la RPC (seed, appels internes), obligatoire pour la route
    IF v_key IS NOT NULL AND v_key !~ '^[A-Za-z0-9_-]{8,100}$' THEN
        RETURN jsonb_build_object('http', 400, 'code', 'IDEMPOTENCY_KEY_REQUIRED');
    END IF;
    -- Lot 8 (8.2 e) : un renvoi sans clé ne désigne aucune lecture, refus avant toute écriture
    IF v_replay_only AND v_key IS NULL THEN
        RETURN jsonb_build_object('http', 400, 'code', 'IDEMPOTENCY_KEY_REQUIRED');
    END IF;
    -- Version du secret présentée (QR seulement) ; absente ou illisible : NULL, refusée à l'étape 5 (D32)
    IF v_method = 'QR' AND COALESCE(p->>'secret_version', '') ~ '^[1-9][0-9]{0,8}$' THEN
        v_version := (p->>'secret_version')::integer;
    END IF;
    -- 0. Deux envois simultanés de la même clé par le même scanneur : sérialisés
    IF v_key IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('scan:' || COALESCE(v_scanner::text, '') || ':' || v_key));
    END IF;
    -- 1. Droit du scanneur sur l'événement, avant toute lecture du billet ou du code
    --    (refus journalisé sans la clé : il n'est pas rejouable et ne bloque pas une lecture ultérieure)
    IF v_scanner IS NULL OR v_event IS NULL OR NOT public.scan_scanner_authorized(v_scanner, v_event) THEN
        -- Lot 8 (L43) : un renvoi n'écrit rien, pas même `forbidden`
        IF NOT v_replay_only THEN
            PERFORM public.scan_log(NULL, v_event, v_scanner, 'forbidden', FALSE, v_method, v_identity, v_hash, NULL, v_version, NULL);
        END IF;
        RETURN jsonb_build_object('http', 403, 'code', 'SCAN_FORBIDDEN');
    END IF;
    -- 1 bis. Rejeu de la même lecture (réponse perdue, relance automatique) : verdict d'origine, aucune ligne
    IF v_key IS NOT NULL THEN
        -- Lot 8 (8.2 e) : un renvoi est propre à l'événement demandé
        SELECT * INTO s FROM public.ticket_scans
         WHERE scanner_id = v_scanner AND client_key = v_key
           AND (NOT v_replay_only OR event_id = v_event);
        IF FOUND THEN
            v_reply := jsonb_build_object('result', s.result, 'scan_id', s.id, 'replayed', TRUE,
                                          'consumed', s.consumed_at IS NOT NULL);
            IF s.amount_due IS NOT NULL THEN
                v_reply := v_reply || jsonb_build_object('amount_due', s.amount_due);
            END IF;
            -- Le billet n'est rendu que si la réponse d'origine le rendait (jamais pour un billet introuvable,
            -- d'un autre événement, ou une lecture refusée avant le billet)
            IF s.ticket_id IS NOT NULL AND s.result NOT IN ('invalid', 'wrong_event', 'dynamic_qr_required', 'manual_entry_refused', 'forbidden') THEN
                SELECT jsonb_build_object('id', tk.id, 'ticket_number', tk.ticket_number, 'category', c.name,
                                          'holder', CASE WHEN tk.user_id IS NULL THEN 'Vente au guichet'
                                                         ELSE btrim(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) END,
                                          'price', tk.price, 'is_manual_entry', s.method = 'MANUAL',
                                          'checked_in_at', tk.checked_in_at,
                                          'checked_in_by_me', tk.checked_in_by IS NOT DISTINCT FROM v_scanner)
                  INTO v_info
                  FROM public.tickets tk
                  JOIN public.ticket_categories c ON c.id = tk.category_id
                  LEFT JOIN public.users u ON u.id = tk.user_id
                 WHERE tk.id = s.ticket_id;
                IF v_info IS NOT NULL THEN
                    v_reply := v_reply || jsonb_build_object('ticket', v_info);
                END IF;
            END IF;
            RETURN v_reply;
        END IF;
    END IF;
    -- 1 ter. Lot 8 (L42) : renvoi sans ligne pour cette clé, rien n'a été traité et rien ne l'est ici. Le
    --        spectateur n'est plus devant le contrôleur : les étapes 2 à 9 ne sont jamais atteintes.
    IF v_replay_only THEN
        RETURN jsonb_build_object('result', 'not_processed', 'replayed', FALSE, 'code', 'REPLAY_NOT_FOUND');
    END IF;
    -- 2. Refus décidé avant la base (payload qui n'est pas un QR dynamique)
    IF v_pre IS NOT NULL THEN
        v_scan := public.scan_log(NULL, v_event, v_scanner, v_pre, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
        RETURN jsonb_build_object('result', v_pre, 'scan_id', v_scan);
    END IF;
    -- 3. Saisie manuelle : périmètre réglé et pièce d'identité vérifiée
    IF v_method = 'MANUAL' THEN
        v_scope := public.fin_setting_text('access.manual_entry_scope');
        IF NOT v_identity
           OR (v_scope = 'ASSIGNED_CONTROLLER' AND NOT EXISTS (
                   SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_scanner)) THEN
            v_scan := public.scan_log(NULL, v_event, v_scanner, 'manual_entry_refused', FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
            RETURN jsonb_build_object('result', 'manual_entry_refused', 'scan_id', v_scan);
        END IF;
        SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = upper(btrim(p->>'ticket_number'));
    ELSE
        v_ticket_id := NULLIF(p->>'ticket_id', '')::uuid;
    END IF;
    -- 4. Billet de l'événement (aucune donnée sinon), sous verrou
    SELECT tk.*, c.name AS category_name, u.first_name, u.last_name
      INTO t
      FROM public.tickets tk
      JOIN public.ticket_categories c ON c.id = tk.category_id
      LEFT JOIN public.users u ON u.id = tk.user_id
     WHERE tk.id = v_ticket_id
       FOR UPDATE OF tk;
    IF NOT FOUND THEN
        v_scan := public.scan_log(NULL, v_event, v_scanner, 'invalid', FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
        RETURN jsonb_build_object('result', 'invalid', 'scan_id', v_scan);
    END IF;
    IF t.event_id <> v_event THEN
        v_scan := public.scan_log(t.id, v_event, v_scanner, 'wrong_event', FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
        RETURN jsonb_build_object('result', 'wrong_event', 'scan_id', v_scan);
    END IF;
    v_info := jsonb_build_object('id', t.id, 'ticket_number', t.ticket_number, 'category', t.category_name,
                                 'holder', CASE WHEN t.user_id IS NULL THEN 'Vente au guichet' ELSE btrim(COALESCE(t.first_name, '') || ' ' || COALESCE(t.last_name, '')) END, 'price', t.price,
                                 'is_manual_entry', v_method = 'MANUAL');
    -- 5. Code dynamique (calculé hors base avec la clé maître) et version du secret, lus sous le verrou du
    --    billet : une rotation (transfert, annulation, remboursement, régénération) validée avant le verrou
    --    rend le code présenté périmé. Statut d'annulation contrôlé avant la version (D3).
    IF v_method = 'QR' AND (NOT COALESCE((p->>'totp_ok')::boolean, FALSE) OR v_version IS DISTINCT FROM t.security_version) THEN
        v_problem := CASE
            WHEN (SELECT e.status::text FROM public.events e WHERE e.id = v_event) = 'ANNULE' THEN 'event_cancelled'
            WHEN t.status::text = 'ANNULE' THEN 'cancelled'
            WHEN t.status::text IN ('REMBOURSE', 'REMBOURSEMENT_EN_COURS') THEN 'refunded'
            ELSE 'qr_expired' END;
        v_scan := public.scan_log(t.id, v_event, v_scanner, v_problem, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'ticket', v_info);
    END IF;
    -- 6. Événement : statut et fenêtre
    v_problem := public.scan_event_problem(v_event);
    IF v_problem IS NOT NULL THEN
        v_scan := public.scan_log(t.id, v_event, v_scanner, v_problem, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan, 'ticket', v_info);
    END IF;
    -- 7. Billet
    v_problem := CASE t.status::text
        WHEN 'VALIDE' THEN NULL
        WHEN 'UTILISE' THEN 'already_used'
        WHEN 'ANNULE' THEN 'cancelled'
        WHEN 'REMBOURSE' THEN 'refunded'
        WHEN 'REMBOURSEMENT_EN_COURS' THEN 'refunded'
        ELSE 'invalid' END;
    IF v_problem IS NOT NULL THEN
        v_scan := public.scan_log(t.id, v_event, v_scanner, v_problem, FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
        RETURN jsonb_build_object('result', v_problem, 'scan_id', v_scan,
                                  'ticket', v_info || jsonb_build_object('checked_in_at', t.checked_in_at,
                                                                         'checked_in_by_me', t.checked_in_by IS NOT DISTINCT FROM v_scanner));
    END IF;
    -- 7 bis. Lot 9 bis (R19, R44) : billet engagé dans un transfert encore en attente → refusé, rien de composté.
    --        Un transfert échu est d'abord expiré ; un transfert tenu par une acceptation est sauté (SKIP LOCKED,
    --        X27) et compte comme en attente. Conditions imbriquées : aucun court-circuit garanti sur AND.
    IF t.transfer_locked THEN
        IF public.ticket_transfers_expire_due(t.id, TRUE) THEN
            v_scan := public.scan_log(t.id, v_event, v_scanner, 'transfer_pending', FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
            RETURN jsonb_build_object('result', 'transfer_pending', 'scan_id', v_scan, 'ticket', v_info);
        END IF;
    END IF;
    -- 8. Paiement
    IF t.price > 0 THEN
        IF t.payment_id IS NOT NULL THEN
            SELECT status::text INTO v_pay_status FROM public.payments WHERE id = t.payment_id;
        END IF;
        IF v_pay_status IS NULL OR v_pay_status NOT IN ('SUCCESS', 'PARTIAL') THEN
            IF t.order_id IS NOT NULL THEN
                SELECT payment_status::text INTO v_order_status FROM public.orders WHERE id = t.order_id;
            END IF;
            IF v_order_status IS DISTINCT FROM 'SUCCESS' THEN
                v_scan := public.scan_log(t.id, v_event, v_scanner, 'payment_required', FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
                RETURN jsonb_build_object('result', 'payment_required', 'scan_id', v_scan, 'ticket', v_info);
            END IF;
        END IF;
    END IF;
    -- 9. Compostage (une seule ligne modifiée, sous verrou)
    UPDATE public.tickets SET status = 'UTILISE', checked_in_at = now(), checked_in_by = v_scanner, updated_at = now()
     WHERE id = t.id AND status = 'VALIDE';
    IF NOT FOUND THEN
        SELECT checked_in_at, checked_in_by INTO v_checked_at, v_checked_by FROM public.tickets WHERE id = t.id;
        v_scan := public.scan_log(t.id, v_event, v_scanner, 'already_used', FALSE, v_method, v_identity, v_hash, NULL, v_version, v_key);
        RETURN jsonb_build_object('result', 'already_used', 'scan_id', v_scan,
                                  'ticket', v_info || jsonb_build_object('checked_in_at', v_checked_at,
                                                                         'checked_in_by_me', v_checked_by IS NOT DISTINCT FROM v_scanner));
    END IF;
    v_scan := public.scan_log(t.id, v_event, v_scanner, 'valid', TRUE, v_method, v_identity, v_hash, NULL, v_version, v_key);
    RETURN jsonb_build_object('result', 'valid', 'scan_id', v_scan,
                              'ticket', v_info || jsonb_build_object('checked_in_at', now(), 'checked_in_by_me', TRUE));
END;
$$;


-- ============================================================================
-- Tâche 23 — 14. ticket_manual_lookup (recopie, 20261108000005_lot9_nettoyage.sql:222-307)
-- ============================================================================
-- Résultat qu'aurait le scan, mêmes étapes que ticket_scan : la branche cash_required part aussi d'ici.
CREATE OR REPLACE FUNCTION public.ticket_manual_lookup(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_scanner uuid := public.try_uuid(p->>'scanner_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_number text := upper(btrim(COALESCE(p->>'ticket_number', '')));
    v_hash text;
    v_scope text;
    t record;
    v_found boolean := FALSE;
    v_preview text;
    v_pay_status text;
    v_order_status text;
BEGIN
    IF v_scanner IS NULL OR v_event IS NULL OR v_number = '' THEN
        RETURN jsonb_build_object('ok', false, 'http', 400, 'code', 'INVALID_INPUT');
    END IF;
    v_hash := encode(sha256(convert_to(v_number, 'UTF8')), 'hex');
    v_scope := public.fin_setting_text('access.manual_entry_scope');
    IF NOT public.scan_scanner_authorized(v_scanner, v_event)
       OR (v_scope = 'ASSIGNED_CONTROLLER' AND NOT EXISTS (
               SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = v_event AND ec.user_id = v_scanner)) THEN
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
        VALUES (v_scanner, 'CONTROLE', 'MANUAL_LOOKUP', 'tickets', NULL,
                jsonb_build_object('event_id', v_event, 'found', NULL, 'refused', 'SCAN_FORBIDDEN', 'ticket_number_hash', v_hash));
        RETURN jsonb_build_object('ok', false, 'http', 403, 'code', 'SCAN_FORBIDDEN');
    END IF;

    SELECT tk.id, tk.event_id, tk.ticket_number, tk.status::text AS status, tk.price, tk.payment_id, tk.order_id, tk.user_id,
           tk.transfer_locked, c.name AS category_name, u.first_name, u.last_name
      INTO t
      FROM public.tickets tk
      JOIN public.ticket_categories c ON c.id = tk.category_id
      LEFT JOIN public.users u ON u.id = tk.user_id
     WHERE tk.ticket_number = v_number;
    IF FOUND THEN
        v_found := t.event_id = v_event;
    END IF;
    IF NOT v_found THEN
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
        VALUES (v_scanner, 'CONTROLE', 'MANUAL_LOOKUP', 'tickets', NULL,
                jsonb_build_object('event_id', v_event, 'found', false, 'ticket_number_hash', v_hash));
        RETURN jsonb_build_object('ok', true, 'found', false);
    END IF;

    -- Résultat qu'aurait le scan (étapes 6 à 8 de ticket_scan), sans rien écrire
    v_preview := public.scan_event_problem(v_event);
    IF v_preview IS NULL THEN
        v_preview := CASE t.status
            WHEN 'VALIDE' THEN NULL
            WHEN 'UTILISE' THEN 'already_used'
            WHEN 'ANNULE' THEN 'cancelled'
            WHEN 'REMBOURSE' THEN 'refunded'
            WHEN 'REMBOURSEMENT_EN_COURS' THEN 'refunded'
            ELSE 'invalid' END;
    END IF;
    -- Lot 9 bis (R19, R44) : étape 7 bis de ticket_scan ; un transfert échu est expiré ici aussi (verrous :
    -- transferts du billet, puis billet).
    IF v_preview IS NULL AND t.transfer_locked THEN
        IF public.ticket_transfers_expire_due(t.id, FALSE) THEN
            v_preview := 'transfer_pending';
        END IF;
    END IF;
    IF v_preview IS NULL AND t.price > 0 THEN
        IF t.payment_id IS NOT NULL THEN
            SELECT status::text INTO v_pay_status FROM public.payments WHERE id = t.payment_id;
        END IF;
        IF v_pay_status IS NULL OR v_pay_status NOT IN ('SUCCESS', 'PARTIAL') THEN
            IF t.order_id IS NOT NULL THEN
                SELECT payment_status::text INTO v_order_status FROM public.orders WHERE id = t.order_id;
            END IF;
            IF v_order_status IS DISTINCT FROM 'SUCCESS' THEN
                v_preview := 'payment_required';
            END IF;
        END IF;
    END IF;
    v_preview := COALESCE(v_preview, 'valid');

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_scanner, 'CONTROLE', 'MANUAL_LOOKUP', 'tickets', t.id,
            jsonb_build_object('event_id', v_event, 'found', true, 'ticket_number_hash', v_hash));
    RETURN jsonb_build_object('ok', true, 'found', true, 'ticket', jsonb_build_object(
        'ticket_number', t.ticket_number,
        'holder', CASE WHEN t.user_id IS NULL THEN 'Vente au guichet' ELSE btrim(COALESCE(t.first_name, '') || ' ' || COALESCE(t.last_name, '')) END,
        'category', t.category_name,
        'status', t.status,
        'preview', v_preview));
END;
$$;


-- ============================================================================
-- Tâche 23 — 15. ticket_transfer_decline (nouvelle)
-- ============================================================================
-- p : { transfer_id, actor_id } → { ok, transfer_id, ticket_id, kind: 'TRANSFER' | 'INVITATION' }. Refus : mêmes
-- codes, même ordre et mêmes messages que ticket_transfer_accept (TRANSFER_NOT_FOUND pour un tiers comme pour
-- l'expéditeur, PHONE_NOT_VERIFIED, TRANSFER_NOT_PENDING, TRANSFER_EXPIRED, SELF_TRANSFER).
CREATE OR REPLACE FUNCTION public.ticket_transfer_decline(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transfer uuid := public.try_uuid(p->>'transfer_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_ticket uuid;
    v_from uuid;
    v_event uuid;
    v_category uuid;
    v_identity text;
    v_status text;
    tr record;
BEGIN
    IF v_transfer IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande incomplète.');
    END IF;

    -- Billet, expéditeur, événement et catégorie d'un transfert ne changent jamais : lecture sans verrou, puis
    -- verrous dans l'ordre 3.3 (événement FOR SHARE, catégorie d'une invitation, transfert, billet).
    SELECT x.ticket_id, x.from_user_id INTO v_ticket, v_from FROM public.ticket_transfers x WHERE x.id = v_transfer;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_FOUND', 'message', 'Ce transfert est introuvable.');
    END IF;
    SELECT t.event_id, t.category_id INTO v_event, v_category FROM public.tickets t WHERE t.id = v_ticket;
    PERFORM 1 FROM public.events ev WHERE ev.id = v_event FOR SHARE;
    IF v_from IS NULL THEN
        PERFORM 1 FROM public.ticket_categories c WHERE c.id = v_category FOR NO KEY UPDATE;
    END IF;

    SELECT * INTO tr FROM public.ticket_transfers WHERE id = v_transfer FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_FOUND', 'message', 'Ce transfert est introuvable.');
    END IF;
    v_identity := public.ticket_transfer_identity(tr.to_phone_or_email, v_actor);
    IF v_identity = 'PHONE_NOT_VERIFIED' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PHONE_NOT_VERIFIED', 'message', 'Confirmez d''abord votre numéro par un code SMS.');
    END IF;
    IF v_identity IS DISTINCT FROM 'MATCH' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_FOUND', 'message', 'Ce transfert est introuvable.');
    END IF;
    IF tr.status::text <> 'PENDING' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_PENDING', 'message', 'Ce transfert n''est plus en attente.');
    END IF;
    IF tr.expires_at <= now() THEN
        PERFORM public.ticket_transfers_expire_due(tr.ticket_id, FALSE);
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_EXPIRED',
                                  'message', 'Ce billet ne peut plus être accepté : le délai est dépassé.');
    END IF;
    IF tr.from_user_id = v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SELF_TRANSFER', 'message', 'Vous êtes déjà le propriétaire de ce billet.');
    END IF;

    SELECT t.status::text INTO v_status FROM public.tickets t WHERE t.id = tr.ticket_id FOR UPDATE;
    UPDATE public.ticket_transfers SET status = 'DECLINED', declined_at = now() WHERE id = tr.id;

    IF tr.from_user_id IS NOT NULL THEN
        -- Transfert d'un particulier : le billet reste à l'expéditeur, libre ; il est prévenu.
        UPDATE public.tickets SET transfer_locked = FALSE, updated_at = now() WHERE id = tr.ticket_id;
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'TRANSFER_DECLINED_SENDER', 'key', 'TRANSFER_DECLINED_SENDER:' || tr.id::text,
            'user_id', tr.from_user_id, 'event_id', v_event,
            'data', COALESCE(public.notif_event_data(v_event), '{}'::jsonb)
                    || jsonb_build_object('transfer_id', tr.id, 'ticket_id', tr.ticket_id)));
    ELSE
        -- Invitation refusée (B55, D11) : billet annulé et place rendue, comme ticket_invitation_cancel ; aucun avis.
        IF v_status = 'VALIDE' THEN
            UPDATE public.tickets SET status = 'ANNULE', transfer_locked = FALSE, updated_at = now() WHERE id = tr.ticket_id;
            UPDATE public.ticket_categories SET sold_quantity = sold_quantity - 1 WHERE id = v_category;
        ELSE
            UPDATE public.tickets SET transfer_locked = FALSE, updated_at = now() WHERE id = tr.ticket_id AND transfer_locked;
        END IF;
    END IF;

    RETURN jsonb_build_object('ok', true, 'transfer_id', tr.id, 'ticket_id', tr.ticket_id,
                              'kind', CASE WHEN tr.from_user_id IS NULL THEN 'INVITATION' ELSE 'TRANSFER' END);
END;
$$;


-- ============================================================================
-- Tâche 23 — 16. ticket_transfer_initiate (recopie, 20261103000005_lot6_billetterie.sql:78-170)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ticket_transfer_initiate(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ticket uuid := public.try_uuid(p->>'ticket_id');
    v_actor uuid := public.try_uuid(COALESCE(p->>'actor_id', p->>'from_user_id'));
    v_recipient text := NULLIF(btrim(COALESCE(p->>'recipient', p->>'to_phone_or_email', '')), '');
    v_expires timestamptz;
    t record;
    v_event_status text;
    v_event_title text;
    v_id uuid;
    v_target uuid;
    v_data jsonb;
BEGIN
    IF v_ticket IS NULL OR v_actor IS NULL OR v_recipient IS NULL OR char_length(v_recipient) > 254
       OR NULLIF(p->>'expires_at', '') IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande de transfert incomplète.');
    END IF;
    IF position('@' IN v_recipient) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RECIPIENT_PHONE_REQUIRED',
                                  'message', 'Le billet se transfère vers un numéro de téléphone.');
    END IF;
    IF v_recipient !~ '^\+221[0-9]{9}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Numéro du destinataire invalide.');
    END IF;
    v_expires := (p->>'expires_at')::timestamptz;
    IF v_expires <= now() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Échéance du transfert invalide.');
    END IF;

    PERFORM 1 FROM public.ticket_transfers WHERE ticket_id = v_ticket AND status = 'PENDING' FOR UPDATE;
    SELECT * INTO t FROM public.tickets WHERE id = v_ticket FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_FOUND', 'message', 'Billet introuvable.');
    END IF;
    IF t.user_id IS DISTINCT FROM v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_OWNER', 'message', 'Vous n''êtes pas le porteur de ce billet.');
    END IF;
    IF t.status::text <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_TRANSFERABLE', 'status', t.status::text,
                                  'message', 'Seul un billet valide peut être transféré.');
    END IF;
    IF t.checked_in_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_USED', 'message', 'Ce billet a déjà servi à l''entrée.');
    END IF;
    SELECT status::text, title INTO v_event_status, v_event_title FROM public.events WHERE id = t.event_id;
    IF v_event_status IS NULL OR v_event_status NOT IN ('PUBLIE', 'VALIDE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ACTIVE', 'message', 'Cet événement n''accepte plus les transferts de billets.');
    END IF;

    -- Un transfert échu que le cron n'a pas encore traité ne bloque pas le porteur (lot 9 bis, R44 : expiré comme
    -- par le cron, avec l'avis à l'expéditeur, par ticket_transfers_expire_due)
    IF public.ticket_transfers_expire_due(v_ticket, FALSE) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_PENDING', 'message', 'Ce billet est déjà engagé dans un transfert en attente.');
    END IF;

    INSERT INTO public.ticket_transfers (ticket_id, from_user_id, to_phone_or_email, status, claim_token_hash, expires_at)
    VALUES (v_ticket, v_actor, v_recipient, 'PENDING', NULL, v_expires)
    RETURNING id INTO v_id;
    UPDATE public.tickets SET transfer_locked = TRUE, updated_at = now() WHERE id = v_ticket;

    -- Offre au destinataire, même transaction : SMS au numéro (compté sur l'expéditeur), IN_APP et PUSH au
    -- compte dont le numéro vérifié par code est la cible (règle B2).
    v_data := COALESCE(public.notif_event_data(t.event_id), '{}'::jsonb)
              || jsonb_build_object('transfer_id', v_id, 'ticket_id', t.id, 'expires_at', v_expires, 'recipient_kind', 'PHONE');
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'TRANSFER_OFFERED', 'key', 'TRANSFER_OFFERED:' || v_id::text,
        'phone', v_recipient, 'actor_id', v_actor, 'event_id', t.event_id,
        'data', v_data, 'channels', jsonb_build_array('SMS')));
    SELECT u.id INTO v_target
      FROM public.users u
     WHERE u.phone = v_recipient AND u.id <> v_actor
       AND public.ticket_transfer_identity(v_recipient, u.id) = 'MATCH'
     ORDER BY u.id
     LIMIT 1;
    IF v_target IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'TRANSFER_OFFERED', 'key', 'TRANSFER_OFFERED:' || v_id::text,
            'user_id', v_target, 'actor_id', v_actor, 'event_id', t.event_id,
            'data', v_data, 'channels', jsonb_build_array('IN_APP', 'PUSH')));
    END IF;

    RETURN jsonb_build_object('ok', true, 'transfer_id', v_id, 'ticket_id', t.id, 'ticket_number', t.ticket_number,
                              'event_id', t.event_id, 'event_title', v_event_title, 'expires_at', v_expires,
                              'recipient_notification', 'QUEUED');
END;
$$;


-- ============================================================================
-- Tâche 23 — 17. ticket_transfers_expire (recopie, 20261103000005_lot6_billetterie.sql:239-290)
-- ============================================================================
-- p : { limit?, ticket_ids? } (défaut 500). Les transferts en cours de réclamation (verrouillés) sont laissés au
-- passage suivant. Lot 9 bis (R44) : ticket_ids limite l'expiration aux billets donnés (lecture de Mes billets).
CREATE OR REPLACE FUNCTION public.ticket_transfers_expire(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit integer := 500;
    v_tickets uuid[];
    v_expired jsonb;
    v_unlocked integer;
    r record;
BEGIN
    IF jsonb_typeof(p->'limit') = 'number' THEN
        v_limit := GREATEST(1, LEAST(5000, (p->>'limit')::numeric::integer));
    END IF;
    IF jsonb_typeof(p->'ticket_ids') = 'array' THEN
        SELECT COALESCE(array_agg(public.try_uuid(x)) FILTER (WHERE public.try_uuid(x) IS NOT NULL), ARRAY[]::uuid[])
          INTO v_tickets FROM jsonb_array_elements_text(p->'ticket_ids') AS x;
    END IF;
    WITH due AS (
        SELECT id FROM public.ticket_transfers
         WHERE status = 'PENDING' AND expires_at <= now()
           AND (v_tickets IS NULL OR ticket_id = ANY (v_tickets))
         ORDER BY expires_at, id
         LIMIT v_limit
           FOR UPDATE SKIP LOCKED
    ), upd AS (
        UPDATE public.ticket_transfers tt SET status = 'EXPIRED', expired_at = now()
          FROM due WHERE tt.id = due.id
        RETURNING tt.id, tt.ticket_id, tt.from_user_id, tt.to_phone_or_email
    ), unlocked AS (
        UPDATE public.tickets t SET transfer_locked = FALSE, updated_at = now()
          FROM upd WHERE t.id = upd.ticket_id AND t.transfer_locked
        RETURNING t.id
    )
    SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'ticket_id', u.ticket_id, 'from_user_id', u.from_user_id,
                                                         'to_phone_or_email', u.to_phone_or_email) ORDER BY u.id) FROM upd u), '[]'::jsonb),
           (SELECT count(*)::int FROM unlocked)
      INTO v_expired, v_unlocked;

    FOR r IN
        SELECT (x->>'id')::uuid AS id, (x->>'ticket_id')::uuid AS ticket_id, (x->>'from_user_id')::uuid AS from_user_id, t.event_id
          FROM jsonb_array_elements(v_expired) AS x
          JOIN public.tickets t ON t.id = (x->>'ticket_id')::uuid
    LOOP
        CONTINUE WHEN r.from_user_id IS NULL;
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'TRANSFER_EXPIRED', 'key', 'TRANSFER_EXPIRED:' || r.id::text,
            'user_id', r.from_user_id, 'event_id', r.event_id,
            'data', COALESCE(public.notif_event_data(r.event_id), '{}'::jsonb)
                    || jsonb_build_object('transfer_id', r.id, 'ticket_id', r.ticket_id)));
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'expired_count', jsonb_array_length(v_expired), 'unlocked_count', v_unlocked, 'expired', v_expired);
END;
$$;


-- ============================================================================
-- Tâche 23 — 18. ticket_transfer_accept (recopie, 20261108000002_lot9_invitations.sql:91-199)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ticket_transfer_accept(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transfer uuid := public.try_uuid(p->>'transfer_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    tr record;
    v_identity text;
    v_claim jsonb;
    v_ticket uuid;
    v_event uuid;
    v_event_status text;
    v_title text;
    v_data jsonb;
    v_claimed_at timestamptz;
BEGIN
    IF v_transfer IS NULL OR v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Demande incomplète.');
    END IF;

    -- Lot 7 (D20) : l'événement du billet est verrouillé (FOR SHARE) avant le transfert. Le billet d'un
    -- transfert et l'événement d'un billet ne changent jamais : la lecture sans verrou suffit pour les trouver.
    SELECT x.ticket_id INTO v_ticket FROM public.ticket_transfers x WHERE x.id = v_transfer;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_FOUND', 'message', 'Ce transfert est introuvable.');
    END IF;
    SELECT t.event_id INTO v_event FROM public.tickets t WHERE t.id = v_ticket;
    SELECT ev.status::text INTO v_event_status FROM public.events ev WHERE ev.id = v_event FOR SHARE;

    SELECT * INTO tr FROM public.ticket_transfers WHERE id = v_transfer FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_FOUND', 'message', 'Ce transfert est introuvable.');
    END IF;
    v_identity := public.ticket_transfer_identity(tr.to_phone_or_email, v_actor);
    IF v_identity = 'PHONE_NOT_VERIFIED' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PHONE_NOT_VERIFIED', 'message', 'Confirmez d''abord votre numéro par un code SMS.');
    END IF;
    IF v_identity IS DISTINCT FROM 'MATCH' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_FOUND', 'message', 'Ce transfert est introuvable.');
    END IF;
    IF tr.status::text <> 'PENDING' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_NOT_PENDING', 'message', 'Ce transfert n''est plus en attente.');
    END IF;
    IF tr.expires_at <= now() THEN
        -- Lot 9 bis (R44) : le transfert échu est expiré pour de bon (billet rendu à l'expéditeur, avis du cron)
        PERFORM public.ticket_transfers_expire_due(tr.ticket_id, FALSE);
        RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_EXPIRED', 'message', 'Ce transfert a expiré (délai de 48 h dépassé).');
    END IF;
    IF tr.from_user_id = v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SELF_TRANSFER', 'message', 'Vous êtes déjà le propriétaire de ce billet.');
    END IF;
    -- Lot 7 (D20) : statut lu sous le verrou FOR SHARE pris plus haut. Contrôlé après l'identité (aucune
    -- fuite d'existence) et après l'état du transfert (un transfert révoqué par l'annulation reste
    -- TRANSFER_NOT_PENDING, comme au lot 6).
    IF v_event_status IS NULL OR v_event_status NOT IN ('PUBLIE', 'VALIDE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ACTIVE', 'message', 'Cet événement n''accepte plus de transfert.');
    END IF;

    v_claim := public.ticket_transfer_claim(tr.id, v_actor);
    IF NOT COALESCE((v_claim->>'ok')::boolean, false) THEN
        RETURN jsonb_build_object('ok', false, 'code', COALESCE(v_claim->>'code', 'TICKET_NOT_TRANSFERABLE'),
            'message', CASE v_claim->>'code'
                WHEN 'OWNER_CHANGED' THEN 'L''expéditeur n''est plus le propriétaire de ce billet.'
                WHEN 'TICKET_NOT_TRANSFERABLE' THEN 'Ce billet n''est plus transférable.'
                WHEN 'TRANSFER_NOT_PENDING' THEN 'Ce transfert n''est plus en attente.'
                WHEN 'TRANSFER_EXPIRED' THEN 'Ce transfert a expiré (délai de 48 h dépassé).'
                WHEN 'SELF_TRANSFER' THEN 'Vous êtes déjà le propriétaire de ce billet.'
                WHEN 'EVENT_NOT_ACTIVE' THEN 'Cet événement n''accepte plus de transfert.'
                ELSE 'Ce transfert est introuvable.' END);
    END IF;

    SELECT t.event_id, e.title INTO v_event, v_title
      FROM public.tickets t JOIN public.events e ON e.id = t.event_id
     WHERE t.id = tr.ticket_id;
    SELECT x.claimed_at INTO v_claimed_at FROM public.ticket_transfers x WHERE x.id = tr.id;

    v_data := COALESCE(public.notif_event_data(v_event), '{}'::jsonb)
              || jsonb_build_object('transfer_id', tr.id, 'ticket_id', tr.ticket_id);
    IF tr.from_user_id IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'TRANSFER_CLAIMED_SENDER', 'key', 'TRANSFER_CLAIMED_SENDER:' || tr.id::text,
            'user_id', tr.from_user_id, 'event_id', v_event, 'data', v_data));
    END IF;
    -- Lot 7 (7.9, D88) : nouveau numéro (le transfert le renouvelle) et catégorie du billet reçu, figés à
    -- l'émission ; champs absents plutôt que nuls.
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'TRANSFER_RECEIVED', 'key', 'TRANSFER_RECEIVED:' || tr.id::text,
        'user_id', v_actor, 'event_id', v_event,
        'data', v_data || jsonb_strip_nulls(jsonb_build_object(
            'ticket_number', v_claim->>'ticket_number',
            'category', (SELECT c.name FROM public.tickets t JOIN public.ticket_categories c ON c.id = t.category_id
                          WHERE t.id = tr.ticket_id)))));

    -- I4 : l'ancien porteur sans billet VALIDE de l'événement ne reçoit plus les rappels en attente.
    IF tr.from_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tickets t
                    WHERE t.event_id = v_event AND t.user_id = tr.from_user_id AND t.status::text = 'VALIDE') THEN
        UPDATE public.notification_outbox
           SET status = 'CANCELLED', reason = 'NO_LONGER_HOLDER', finished_at = now()
         WHERE event_id = v_event AND recipient_user_id = tr.from_user_id AND status = 'PENDING'
           AND type IN ('REMINDER_J1', 'REMINDER_H3');
    END IF;

    RETURN jsonb_build_object('ok', true, 'transfer_id', tr.id, 'ticket_id', tr.ticket_id,
                              'ticket_number', v_claim->>'ticket_number', 'event_title', v_title,
                              'claimed_at', v_claimed_at);
END;
$$;


-- ============================================================================
-- Tâche 23 — 19. ticket_invitations_list (recopie, 20261108000002_lot9_invitations.sql:582-631)
-- ============================================================================
-- p = { actor_id, event_id, page }. Lecture par pilotage_access, 50 par page, plus récentes d'abord.
-- Ni numéro de billet, ni QR, ni état « en attente » : même ligne avec ou sans compte. Lot 9 bis (R46) : invitation
-- refusée par son destinataire → « Refusée ».
CREATE OR REPLACE FUNCTION public.ticket_invitations_list(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_page integer := CASE WHEN COALESCE(p->>'page', '') ~ '^[0-9]{1,6}$' THEN GREATEST((p->>'page')::integer, 1) ELSE 1 END;
    v_page_size CONSTANT integer := 50;
    v_code text;
    v_items jsonb;
    v_total integer;
BEGIN
    v_code := public.pilotage_access(v_event, v_actor);
    IF v_code IS NOT NULL THEN
        RETURN public.pilotage_refusal(v_code);
    END IF;

    SELECT count(*) INTO v_total FROM public.tickets t WHERE t.event_id = v_event AND t.sale_channel = 'INVITATION';

    SELECT COALESCE(jsonb_agg(r.item ORDER BY r.created_at DESC, r.id DESC), '[]'::jsonb) INTO v_items
      FROM (
          SELECT t.id, t.created_at,
                 jsonb_build_object(
                     'ticket_id', t.id,
                     'category', c.name,
                     'created_at', t.created_at,
                     'price', t.price,
                     'channel', 'Invitation',
                     'status_label', CASE WHEN t.status::text = 'VALIDE' THEN 'Envoyée'
                                          WHEN t.status::text = 'UTILISE' THEN 'Entrée validée'
                                          WHEN x.status::text = 'DECLINED' THEN 'Refusée'
                                          ELSE 'Annulée' END,
                     'phone_masked', CASE WHEN COALESCE(x.to_phone_or_email, u.phone) IS NOT NULL
                                          THEN '+221***' || right(COALESCE(x.to_phone_or_email, u.phone), 2) END,
                     'can_cancel', t.status::text = 'VALIDE') AS item
            FROM public.tickets t
            JOIN public.ticket_categories c ON c.id = t.category_id
            LEFT JOIN public.users u ON u.id = t.user_id
            LEFT JOIN LATERAL (SELECT tr.to_phone_or_email, tr.status FROM public.ticket_transfers tr
                                WHERE tr.ticket_id = t.id AND tr.from_user_id IS NULL
                                ORDER BY tr.created_at LIMIT 1) x ON TRUE
           WHERE t.event_id = v_event AND t.sale_channel = 'INVITATION'
           ORDER BY t.created_at DESC, t.id DESC
           LIMIT v_page_size OFFSET (v_page - 1) * v_page_size
      ) r;

    RETURN jsonb_build_object('ok', true, 'items', v_items, 'page', v_page, 'page_size', v_page_size, 'total_count', v_total);
END;
$$;


-- ============================================================================
-- Tâche 23 — 20. pilotage_scan_result_label (recopie, 20261102000005_lot5_pilotage.sql:78-102)
-- ============================================================================
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
        ELSE 'Autre refus' END
$$;


-- ============================================================================
-- Tâche 24 — 21. ticket_card_states (nouvelle)
-- ============================================================================
-- p : { user_id } → { ok, tickets[{ ticket_id, event_status, event_status_label, price, service_fee, sale_channel,
-- code_visible, transfer_allowed, notice }] }. La carte du billet n'affiche que ce que le serveur accepterait.
CREATE OR REPLACE FUNCTION public.ticket_card_states(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := public.try_uuid(p->>'user_id');
    v_items jsonb;
BEGIN
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'ticket_id', x.id,
               'event_status', x.event_status,
               'event_status_label', public.event_status_label(x.event_status),
               'price', x.price,
               'service_fee', x.service_fee,
               'sale_channel', x.sale_channel,
               'code_visible', x.code_visible,
               'transfer_allowed', x.transfer_allowed,
               'notice', CASE
                   WHEN x.event_status = 'SUSPENDU' THEN 'Événement suspendu : l’entrée n’est pas possible pour le moment.'
                   WHEN NOT x.code_visible AND (x.event_status = 'TERMINE' OR x.problem = 'event_ended') THEN 'Événement terminé.'
               END) ORDER BY x.id), '[]'::jsonb)
      INTO v_items
      FROM (SELECT t.id, e.status::text AS event_status, t.price, t.service_fee, t.sale_channel, s.problem,
                   (t.status::text = 'VALIDE' AND NOT t.transfer_locked
                    AND COALESCE(s.problem, '') NOT IN ('event_suspended', 'event_cancelled', 'event_ended')) AS code_visible,
                   (t.status::text = 'VALIDE' AND NOT t.transfer_locked AND t.checked_in_at IS NULL
                    AND e.status::text IN ('PUBLIE', 'VALIDE')
                    AND COALESCE(public.event_end_at(e.id) > now(), FALSE)) AS transfer_allowed
              FROM public.tickets t
              JOIN public.events e ON e.id = t.event_id
              CROSS JOIN LATERAL (SELECT public.scan_event_problem(e.id) AS problem) s
             WHERE t.user_id = v_user) x;
    RETURN jsonb_build_object('ok', true, 'tickets', v_items);
END;
$$;


-- ============================================================================
-- Tâche 25 — 22. ticket_category_update (recopie, 20261106000001_lot8_canaux.sql:900-1041)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ticket_category_update(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_category uuid := public.try_uuid(p->>'category_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_patch jsonb := p->'patch';
    v_guard jsonb;
    v_capacity integer;
    c public.ticket_categories%ROWTYPE;
    v_key text;
    n_name text;
    n_desc text;
    n_price numeric;
    n_total integer;
    n_max integer;
    n_start timestamptz;
    n_end timestamptz;
    n_online boolean;
    n_counter boolean;
    n_active boolean;
    v_sum integer;
    v_row jsonb;
BEGIN
    IF v_patch IS NULL OR jsonb_typeof(v_patch) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les modifications de la catégorie sont illisibles.');
    END IF;
    v_guard := public.ticket_category_guard(v_event, v_actor);
    IF (v_guard->>'ok')::boolean IS NOT TRUE THEN
        RETURN v_guard;
    END IF;
    SELECT * INTO c FROM public.ticket_categories WHERE id = v_category AND event_id = v_event;
    IF NOT FOUND THEN
        RETURN public.event_edit_refusal('CATEGORY_NOT_FOUND', 'Catégorie de billets introuvable pour cet événement.');
    END IF;
    SELECT k INTO v_key FROM jsonb_object_keys(v_patch) AS k
     WHERE k <> ALL (ARRAY['name', 'description', 'price', 'total_quantity', 'max_per_order', 'sale_start', 'sale_end', 'sale_online', 'sale_counter', 'is_visible', 'is_active'])
     ORDER BY k LIMIT 1;
    IF v_key IS NOT NULL THEN
        RETURN public.event_edit_refusal('FIELD_NOT_EDITABLE', 'Ce champ de la catégorie de billets ne se modifie pas.', v_key);
    END IF;

    n_name := c.name; n_desc := c.description; n_price := c.price; n_total := c.total_quantity; n_max := c.max_per_order;
    n_start := c.sale_start; n_end := c.sale_end; n_online := c.sale_online; n_counter := c.sale_counter; n_active := c.is_active;
    BEGIN
        IF v_patch ? 'name' THEN n_name := btrim(v_patch->>'name'); END IF;
        IF v_patch ? 'description' THEN n_desc := NULLIF(btrim(COALESCE(v_patch->>'description', '')), ''); END IF;
        IF v_patch ? 'price' THEN n_price := (v_patch->>'price')::numeric; END IF;
        IF v_patch ? 'total_quantity' THEN n_total := (v_patch->>'total_quantity')::integer; END IF;
        IF v_patch ? 'max_per_order' THEN n_max := (v_patch->>'max_per_order')::integer; END IF;
        IF v_patch ? 'sale_start' THEN n_start := NULLIF(v_patch->>'sale_start', '')::timestamptz; END IF;
        IF v_patch ? 'sale_end' THEN n_end := NULLIF(v_patch->>'sale_end', '')::timestamptz; END IF;
        IF v_patch ? 'is_visible' THEN n_online := (v_patch->>'is_visible')::boolean; END IF;
        IF v_patch ? 'sale_online' THEN n_online := (v_patch->>'sale_online')::boolean; END IF;
        IF v_patch ? 'sale_counter' THEN n_counter := (v_patch->>'sale_counter')::boolean; END IF;
        IF v_patch ? 'is_active' THEN n_active := (v_patch->>'is_active')::boolean; END IF;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Une valeur modifiée de la catégorie est illisible.');
    END;
    IF n_name IS NULL OR char_length(n_name) < 1 OR char_length(n_name) > 60 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le nom de la catégorie compte de 1 à 60 caractères.', 'name');
    END IF;
    IF n_desc IS NOT NULL AND char_length(n_desc) > 300 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La description de la catégorie ne dépasse pas 300 caractères.', 'description');
    END IF;
    IF n_price IS NULL OR n_price < 0 OR n_price > 10000000 OR n_price <> trunc(n_price) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le prix est un montant entier de 0 à 10 000 000 F CFA.', 'price');
    END IF;
    IF n_total IS NULL OR n_total < 1 OR n_total > 100000 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le quota est un nombre entier de 1 à 100 000 billets.', 'total_quantity');
    END IF;
    IF n_max IS NULL OR n_max < 1 OR n_max > 50 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le maximum par commande est un nombre entier de 1 à 50.', 'max_per_order');
    END IF;
    IF n_online IS NULL OR n_counter IS NULL OR n_active IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Indiquez oui ou non pour les canaux de vente et la mise en vente.',
                                         CASE WHEN n_online IS NULL THEN CASE WHEN v_patch ? 'sale_online' THEN 'sale_online' ELSE 'is_visible' END
                                              WHEN n_counter IS NULL THEN 'sale_counter' ELSE 'is_active' END);
    END IF;

    -- Prix : modifiable seulement sans billet ni réservation en cours
    IF n_price <> c.price AND public.ticket_category_has_sales(c.id) THEN
        RETURN public.event_edit_refusal('PRICE_LOCKED_AFTER_SALES',
            'Le prix de cette catégorie est verrouillé : des billets ont été vendus ou réservés. Créez une nouvelle catégorie pour un autre tarif.', 'price');
    END IF;
    -- Quota : jamais sous les vendus, ni sous vendus + réservés (paiements en cours)
    IF n_total < c.sold_quantity THEN
        RETURN public.event_edit_refusal('QUOTA_BELOW_SOLD',
            format('Le quota ne peut pas descendre sous les %s billet(s) déjà vendus.', c.sold_quantity), 'total_quantity');
    END IF;
    IF n_total < c.sold_quantity + c.held_quantity THEN
        RETURN public.event_edit_refusal('QUOTA_BELOW_HELD',
            format('Le quota ne peut pas descendre sous %s : %s billet(s) vendus et %s en cours de paiement.',
                   c.sold_quantity + c.held_quantity, c.sold_quantity, c.held_quantity), 'total_quantity');
    END IF;
    -- Somme des quotas des catégories actives ≤ jauge (contrôlée quand le quota monte ou que la catégorie est activée)
    SELECT capacity INTO v_capacity FROM public.events WHERE id = v_event;
    IF v_capacity IS NOT NULL AND n_active AND (n_total > c.total_quantity OR NOT c.is_active) THEN
        SELECT COALESCE(sum(o.total_quantity), 0)::int INTO v_sum
          FROM public.ticket_categories o WHERE o.event_id = v_event AND o.is_active AND o.id <> c.id;
        IF v_sum + n_total > v_capacity THEN
            RETURN public.event_edit_refusal('QUOTA_ABOVE_CAPACITY',
                format('La somme des quotas des catégories actives (%s) dépasserait la jauge de l''événement (%s).', v_sum + n_total, v_capacity),
                'total_quantity');
        END IF;
    END IF;
    -- Nom unique dans l'événement, sans tenir compte de la casse
    IF lower(n_name) IS DISTINCT FROM lower(btrim(c.name)) AND EXISTS (
        SELECT 1 FROM public.ticket_categories o
         WHERE o.event_id = v_event AND o.id <> c.id AND lower(btrim(o.name)) = lower(n_name)) THEN
        RETURN public.event_edit_refusal('CATEGORY_NAME_TAKEN',
            format('Une catégorie « %s » existe déjà pour cet événement : choisissez un autre nom.', n_name), 'name');
    END IF;
    -- Dates de vente : début < fin ≤ fin de l'événement
    IF (v_patch ? 'sale_start' OR v_patch ? 'sale_end') AND n_start IS NOT NULL AND n_end IS NOT NULL AND n_start >= n_end THEN
        RETURN public.event_edit_refusal('SALE_DATES_INVALID', 'La fin de vente doit être postérieure au début de vente.', 'sale_end');
    END IF;
    IF v_patch ? 'sale_end' AND n_end IS NOT NULL AND n_end > public.event_end_at(v_event) THEN
        RETURN public.event_edit_refusal('SALE_END_AFTER_EVENT', 'La fin de vente ne peut pas dépasser la fin de l''événement.', 'sale_end');
    END IF;
    -- Lot 9 bis (R94) : un début de vente modifié précède la fin de l'événement
    IF v_patch ? 'sale_start' AND n_start IS NOT NULL AND n_start >= public.event_end_at(v_event) THEN
        RETURN public.event_edit_refusal('SALE_START_AFTER_EVENT', 'Le début de vente doit précéder la fin de l’événement.', 'sale_start');
    END IF;

    UPDATE public.ticket_categories
       SET name = n_name, description = n_desc, price = n_price, total_quantity = n_total, max_per_order = n_max,
           sale_start = n_start, sale_end = n_end, sale_online = n_online, sale_counter = n_counter, is_active = n_active, updated_at = now()
     WHERE id = c.id;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', 'CATEGORY_UPDATED', 'TICKET_CATEGORY', c.id,
            jsonb_build_object('event_id', v_event,
                               'fields', (SELECT COALESCE(jsonb_agg(k ORDER BY k), '[]'::jsonb) FROM jsonb_object_keys(v_patch) AS k),
                               'old', jsonb_build_object('price', c.price, 'total_quantity', c.total_quantity, 'is_active', c.is_active, 'is_visible', c.is_visible, 'sale_online', c.sale_online, 'sale_counter', c.sale_counter),
                               'new', jsonb_build_object('price', n_price, 'total_quantity', n_total, 'is_active', n_active, 'is_visible', n_online, 'sale_online', n_online, 'sale_counter', n_counter)));

    SELECT to_jsonb(x) INTO v_row FROM public.ticket_categories x WHERE x.id = c.id;
    RETURN jsonb_build_object('ok', true, 'category', v_row);
END;
$$;


-- ============================================================================
-- Tâche 26 — 24. controller_invitation_create (nouvelle)
-- ============================================================================
-- p : { actor_id, partner_id, user_id, assignments[{ event_id, can_accept_cash }] } → { ok, invitation_id, expires_at }.
-- Le compte invité est ACTIF ; chaque événement est à la partenaire et VALIDE ou PUBLIE (mêmes refus que la route).
CREATE OR REPLACE FUNCTION public.controller_invitation_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_partner uuid := public.try_uuid(p->>'partner_id');
    v_user uuid := public.try_uuid(p->>'user_id');
    v_assignments jsonb;
    v_company text;
    v_events jsonb;
    v_id uuid;
    v_expires timestamptz;
BEGIN
    IF v_actor IS NULL OR v_partner IS NULL OR v_user IS NULL OR jsonb_typeof(p->'assignments') IS DISTINCT FROM 'array'
       OR jsonb_array_length(p->'assignments') = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Invitation incomplète.');
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p->'assignments') a
                WHERE public.try_uuid(a->>'event_id') IS NULL
                   OR jsonb_typeof(a->'can_accept_cash') NOT IN ('boolean', 'null')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Invitation incomplète.');
    END IF;
    SELECT COALESCE(NULLIF(btrim(pa.commercial_name), ''), pa.company_name) INTO v_company
      FROM public.partners pa WHERE pa.id = v_partner;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PARTNER_NOT_FOUND', 'message', 'Organisateur introuvable.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Ce compte n''est pas actif.');
    END IF;

    -- Une ligne par événement (le dernier droit d'encaisser donné l'emporte), événements de la partenaire seulement
    SELECT jsonb_agg(jsonb_build_object('event_id', x.event_id, 'can_accept_cash', x.cash) ORDER BY x.event_id)
      INTO v_assignments
      FROM (SELECT DISTINCT ON (public.try_uuid(a->>'event_id')) public.try_uuid(a->>'event_id') AS event_id,
                   COALESCE((a->>'can_accept_cash')::boolean, FALSE) AS cash
              FROM jsonb_array_elements(p->'assignments') WITH ORDINALITY AS t(a, o)
             ORDER BY public.try_uuid(a->>'event_id'), o DESC) x;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_assignments) a
                LEFT JOIN public.events e ON e.id = (a->>'event_id')::uuid
                WHERE e.id IS NULL OR e.partner_id IS DISTINCT FROM v_partner) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_OWNED', 'message', 'Vous n''êtes pas propriétaire de tous les événements sélectionnés.');
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_assignments) a
                JOIN public.events e ON e.id = (a->>'event_id')::uuid
                WHERE e.status::text NOT IN ('VALIDE', 'PUBLIE')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ELIGIBLE', 'message', 'Seuls les événements validés ou publiés peuvent être affectés.');
    END IF;

    -- Une seule invitation en attente par partenaire et par compte : la précédente est remplacée
    UPDATE public.controller_invitations
       SET status = 'EXPIRED', responded_at = now()
     WHERE partner_id = v_partner AND user_id = v_user AND status = 'PENDING';

    INSERT INTO public.controller_invitations (partner_id, user_id, created_by, assignments)
    VALUES (v_partner, v_user, v_actor, v_assignments)
    RETURNING id, expires_at INTO v_id, v_expires;

    SELECT jsonb_agg(jsonb_build_object(
               'event_id', e.id, 'title', e.title,
               'start_at', (e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar')
           ORDER BY e.start_date, e.start_time, e.id)
      INTO v_events
      FROM public.events e
     WHERE e.id IN (SELECT (a->>'event_id')::uuid FROM jsonb_array_elements(v_assignments) a);

    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'CONTROLLER_INVITATION', 'key', 'CONTROLLER_INVITATION:' || v_id::text,
        'user_id', v_user, 'actor_id', v_actor,
        'data', jsonb_build_object('invitation_id', v_id, 'company', v_company, 'expires_at', v_expires, 'events', v_events)));

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value, metadata)
    VALUES (v_actor, COALESCE(NULLIF(p->>'actor_role', ''), 'PARTENAIRE'), 'CONTROLLER_INVITATION_CREATED', 'controller_invitations', v_id,
            jsonb_build_object('user_id', v_user, 'assignments', v_assignments),
            jsonb_build_object('partner_id', v_partner, 'expires_at', v_expires));

    RETURN jsonb_build_object('ok', true, 'invitation_id', v_id, 'expires_at', v_expires);
END;
$$;


-- ============================================================================
-- Tâche 26 — 25. controller_invitation_respond (nouvelle)
-- ============================================================================
-- p : { invitation_id, actor_id, accept } → { ok, status, assigned_event_ids? }. Tiers ou invitation inconnue :
-- INVITATION_NOT_FOUND (aucun indice) ; déjà traitée : INVITATION_NOT_PENDING ; échue : INVITATION_EXPIRED.
CREATE OR REPLACE FUNCTION public.controller_invitation_respond(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid := public.try_uuid(p->>'invitation_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_accept boolean;
    inv record;
    v_assigned uuid[];
BEGIN
    IF v_id IS NULL OR v_actor IS NULL OR jsonb_typeof(p->'accept') IS DISTINCT FROM 'boolean' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Réponse incomplète.');
    END IF;
    v_accept := (p->>'accept')::boolean;
    SELECT * INTO inv FROM public.controller_invitations WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    IF inv.user_id IS DISTINCT FROM v_actor THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_actor AND u.status::text = 'ACTIF') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n''est pas actif.');
    END IF;
    IF inv.status <> 'PENDING' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_NOT_PENDING', 'status', inv.status, 'message', 'Cette invitation a déjà reçu une réponse.');
    END IF;
    IF inv.expires_at <= now() THEN
        UPDATE public.controller_invitations SET status = 'EXPIRED', responded_at = now() WHERE id = inv.id;
        RETURN jsonb_build_object('ok', false, 'code', 'INVITATION_EXPIRED', 'message', 'Cette invitation a expiré.');
    END IF;

    IF NOT v_accept THEN
        UPDATE public.controller_invitations SET status = 'DECLINED', responded_at = now() WHERE id = inv.id;
        INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
        VALUES (v_actor, 'CLIENT', 'CONTROLLER_INVITATION_DECLINED', 'controller_invitations', inv.id,
                jsonb_build_object('partner_id', inv.partner_id));
        RETURN jsonb_build_object('ok', true, 'status', 'DECLINED');
    END IF;

    -- Rôle CONTROLEUR ajouté au compte, sans toucher au reste (users.role recalculé par le trigger de user_roles)
    INSERT INTO public.user_roles (user_id, role) VALUES (v_actor, 'CLIENT'), (v_actor, 'CONTROLEUR')
    ON CONFLICT (user_id, role) DO NOTHING;
    -- Affectations aux événements encore VALIDE ou PUBLIE de la partenaire, en une instruction (un SMS regroupé)
    WITH ins AS (
        INSERT INTO public.event_controllers (event_id, user_id, can_accept_cash, created_by)
        SELECT e.id, v_actor, COALESCE((a->>'can_accept_cash')::boolean, FALSE), inv.created_by
          FROM jsonb_array_elements(inv.assignments) a
          JOIN public.events e ON e.id = public.try_uuid(a->>'event_id')
         WHERE e.partner_id = inv.partner_id AND e.status::text IN ('VALIDE', 'PUBLIE')
        ON CONFLICT (event_id, user_id) DO NOTHING
        RETURNING event_id
    )
    SELECT COALESCE(array_agg(event_id ORDER BY event_id), ARRAY[]::uuid[]) INTO v_assigned FROM ins;
    UPDATE public.controller_invitations SET status = 'ACCEPTED', responded_at = now() WHERE id = inv.id;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, new_value, metadata)
    VALUES (v_actor, 'CLIENT', 'CONTROLLER_INVITATION_ACCEPTED', 'controller_invitations', inv.id,
            jsonb_build_object('assigned_event_ids', to_jsonb(v_assigned)), jsonb_build_object('partner_id', inv.partner_id));
    RETURN jsonb_build_object('ok', true, 'status', 'ACCEPTED', 'assigned_event_ids', to_jsonb(v_assigned));
END;
$$;


-- ============================================================================
-- Tâche 26 — 26. controller_invitations_mine (nouvelle)
-- ============================================================================
-- p : { actor_id } → { ok, items[{ id, company, events[{ id, title, start_at }], expires_at }] } : invitations en
-- attente non échues du compte, plus anciennes d'abord.
CREATE OR REPLACE FUNCTION public.controller_invitations_mine(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_items jsonb;
BEGIN
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', ci.id,
               'company', COALESCE(NULLIF(btrim(pa.commercial_name), ''), pa.company_name),
               'events', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                                          'id', e.id, 'title', e.title,
                                          'start_at', (e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar')
                                      ORDER BY e.start_date, e.start_time, e.id)
                                     FROM public.events e
                                    WHERE e.id IN (SELECT public.try_uuid(a->>'event_id') FROM jsonb_array_elements(ci.assignments) a)),
                                  '[]'::jsonb),
               'expires_at', ci.expires_at) ORDER BY ci.created_at, ci.id), '[]'::jsonb)
      INTO v_items
      FROM public.controller_invitations ci
      JOIN public.partners pa ON pa.id = ci.partner_id
     WHERE ci.user_id = v_actor AND ci.status = 'PENDING' AND ci.expires_at > now();
    RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;


-- ============================================================================
-- Tâche 26 — 27. controller_account_states (nouvelle)
-- ============================================================================
-- p : { user_ids[] } → { ok, items[{ user_id, account_state }] } : PENDING_ACTIVATION pour un compte créé par une
-- invitation et jamais activé (marque is_temporary_controller_account vraie dans auth.users), ACTIVATED sinon.
CREATE OR REPLACE FUNCTION public.controller_account_states(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_items jsonb;
BEGIN
    IF jsonb_typeof(p->'user_ids') IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'user_id', u.id,
               'account_state', CASE WHEN COALESCE(a.raw_user_meta_data->>'is_temporary_controller_account', 'false') = 'true'
                                     THEN 'PENDING_ACTIVATION' ELSE 'ACTIVATED' END) ORDER BY u.id), '[]'::jsonb)
      INTO v_items
      FROM public.users u
      LEFT JOIN auth.users a ON a.id = u.id
     WHERE u.id IN (SELECT public.try_uuid(x) FROM jsonb_array_elements_text(p->'user_ids') AS x);
    RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;


-- ============================================================================
-- Tâche 26 — 28. controller_assignments_sync (nouvelle)
-- ============================================================================
-- p : { actor_id, actor_role, controller_id, partner_id?, assignments[{ event_id, can_accept_cash? }] } →
-- { ok, added[], removed[], updated }. Périmètre : événements de partner_id (tous si NULL, admin). Retraits, ajouts et
-- droit d'encaisser en une transaction ; une caisse ouverte sur un retrait lève CONTROLLER_HAS_OPEN_SHIFT (EV409,
-- trigger existant) et rien n'est écrit ; un droit d'encaisser absent (null) garde la valeur actuelle (false à
-- l'ajout). Journal CONTROLLER_ASSIGNMENTS_UPDATED dans la transaction : refusé, tout est annulé.
CREATE OR REPLACE FUNCTION public.controller_assignments_sync(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_ctrl uuid := public.try_uuid(p->>'controller_id');
    v_partner uuid := public.try_uuid(p->>'partner_id');
    v_role text := COALESCE(NULLIF(p->>'actor_role', ''), 'PARTENAIRE');
    v_req jsonb;
    v_requested uuid[];
    v_current uuid[];
    v_added uuid[];
    v_removed uuid[];
    v_updated integer := 0;
BEGIN
    IF v_actor IS NULL OR v_ctrl IS NULL OR jsonb_typeof(p->'assignments') IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Affectations illisibles.');
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p->'assignments') a
                WHERE public.try_uuid(a->>'event_id') IS NULL
                   OR COALESCE(jsonb_typeof(a->'can_accept_cash'), 'null') NOT IN ('boolean', 'null')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Affectations illisibles.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_ctrl) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CONTROLLER_NOT_FOUND', 'message', 'Contrôleur introuvable.');
    END IF;

    -- Une ligne par événement (la dernière l'emporte)
    SELECT COALESCE(jsonb_agg(jsonb_build_object('event_id', x.event_id, 'can_accept_cash', x.cash) ORDER BY x.event_id), '[]'::jsonb)
      INTO v_req
      FROM (SELECT DISTINCT ON (public.try_uuid(a->>'event_id')) public.try_uuid(a->>'event_id') AS event_id,
                   CASE WHEN jsonb_typeof(a->'can_accept_cash') = 'boolean' THEN (a->>'can_accept_cash')::boolean END AS cash
              FROM jsonb_array_elements(p->'assignments') WITH ORDINALITY AS t(a, o)
             ORDER BY public.try_uuid(a->>'event_id'), o DESC) x;
    SELECT COALESCE(array_agg((a->>'event_id')::uuid), ARRAY[]::uuid[]) INTO v_requested FROM jsonb_array_elements(v_req) a;

    IF EXISTS (SELECT 1 FROM unnest(v_requested) r(id) LEFT JOIN public.events e ON e.id = r.id
                WHERE e.id IS NULL OR (v_partner IS NOT NULL AND e.partner_id IS DISTINCT FROM v_partner)) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_OWNED', 'message', 'Vous n''êtes pas propriétaire de tous les événements sélectionnés.');
    END IF;

    SELECT COALESCE(array_agg(ec.event_id), ARRAY[]::uuid[]) INTO v_current
      FROM public.event_controllers ec JOIN public.events e ON e.id = ec.event_id
     WHERE ec.user_id = v_ctrl AND (v_partner IS NULL OR e.partner_id = v_partner);
    SELECT COALESCE(array_agg(r.id ORDER BY r.id), ARRAY[]::uuid[]) INTO v_added FROM unnest(v_requested) r(id) WHERE NOT r.id = ANY (v_current);
    SELECT COALESCE(array_agg(c.id ORDER BY c.id), ARRAY[]::uuid[]) INTO v_removed FROM unnest(v_current) c(id) WHERE NOT c.id = ANY (v_requested);

    -- Seuls les événements confirmés (VALIDE ou PUBLIE) sont nouvellement affectés
    IF EXISTS (SELECT 1 FROM public.events e WHERE e.id = ANY (v_added) AND e.status::text NOT IN ('VALIDE', 'PUBLIE')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ELIGIBLE', 'message', 'Seuls les événements validés ou publiés peuvent être affectés.');
    END IF;

    IF cardinality(v_removed) > 0 THEN
        DELETE FROM public.event_controllers WHERE user_id = v_ctrl AND event_id = ANY (v_removed);
    END IF;
    IF cardinality(v_added) > 0 THEN
        INSERT INTO public.event_controllers (event_id, user_id, can_accept_cash, created_by)
        SELECT (a->>'event_id')::uuid, v_ctrl, COALESCE((a->>'can_accept_cash')::boolean, FALSE), v_actor
          FROM jsonb_array_elements(v_req) a
         WHERE (a->>'event_id')::uuid = ANY (v_added);
    END IF;
    UPDATE public.event_controllers ec
       SET can_accept_cash = (a->>'can_accept_cash')::boolean
      FROM jsonb_array_elements(v_req) a
     WHERE ec.user_id = v_ctrl AND ec.event_id = (a->>'event_id')::uuid
       AND NOT ec.event_id = ANY (v_added)
       AND jsonb_typeof(a->'can_accept_cash') = 'boolean'
       AND ec.can_accept_cash IS DISTINCT FROM (a->>'can_accept_cash')::boolean;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, old_value, new_value, metadata)
    VALUES (v_actor, v_role, 'CONTROLLER_ASSIGNMENTS_UPDATED', 'event_controllers', v_ctrl,
            jsonb_build_object('event_ids', to_jsonb(v_current)),
            jsonb_build_object('event_ids', to_jsonb(v_requested), 'added', to_jsonb(v_added), 'removed', to_jsonb(v_removed),
                               'cash_updated', v_updated),
            jsonb_build_object('partner_id', v_partner, 'controller_id', v_ctrl));

    RETURN jsonb_build_object('ok', true, 'added', to_jsonb(v_added), 'removed', to_jsonb(v_removed), 'updated', v_updated);
END;
$$;


-- ============================================================================
-- Privilèges (toutes les fonctions du fichier) : service_role uniquement
-- ============================================================================
DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.event_transition(jsonb)',
        'public.event_actions(jsonb)',
        'public.event_end_from_v2(date, time, date, time)',
        'public.event_end_at(uuid)',
        'public.event_create(jsonb)',
        'public.scan_states(jsonb)',
        'public.shift_open(jsonb)',
        'public.shift_close(jsonb)',
        'public.ticket_transfers_expire_due(uuid, boolean)',
        'public.ticket_scan(jsonb)',
        'public.ticket_manual_lookup(jsonb)',
        'public.ticket_transfer_decline(jsonb)',
        'public.ticket_transfer_initiate(jsonb)',
        'public.ticket_transfers_expire(jsonb)',
        'public.ticket_transfer_accept(jsonb)',
        'public.ticket_invitations_list(jsonb)',
        'public.pilotage_scan_result_label(text)',
        'public.ticket_card_states(jsonb)',
        'public.ticket_category_update(jsonb)',
        'public.controller_invitation_create(jsonb)',
        'public.controller_invitation_respond(jsonb)',
        'public.controller_invitations_mine(jsonb)',
        'public.controller_account_states(jsonb)',
        'public.controller_assignments_sync(jsonb)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END;
$$;


-- ============================================================================
-- Tâche 21 — 8. Fins de vente au-delà de la nouvelle fin par défaut (A12 : comptées, jamais réécrites)
-- ============================================================================
DO $$
DECLARE
    v_count integer;
BEGIN
    SELECT count(*) INTO v_count
      FROM public.ticket_categories c
      JOIN public.events e ON e.id = c.event_id
     WHERE e.end_date IS NULL
       AND c.sale_end IS NOT NULL
       AND e.status::text NOT IN ('ANNULE', 'TERMINE')
       AND c.sale_end > public.event_end_at(e.id);
    RAISE NOTICE 'lot 9 bis (R16) : % catégorie(s) d''un événement sans date de fin ont une fin de vente après début + 6 h (non réécrites, rapport section 14)', v_count;
END;
$$;
