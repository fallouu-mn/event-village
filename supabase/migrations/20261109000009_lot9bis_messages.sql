-- ============================================================================
-- EVENT VILLAGE — LOT 9 BIS : messages (contrat M09, sections 3.1, 3.2, 5.30 à 5.39, 11 ; S-D, vague S3)
-- ============================================================================
-- Une seule définition finale par fonction dans le lot (tableau 3.2) ; chaque recopie part de la dernière
-- définition, en entier, signature et retour identiques, puis porte les changements de toutes ses tâches :
--   - notif_event_status_changed() (base 20261103000005_lot6_billetterie.sql:1206-1323) ;
--   - event_update(jsonb) (base 20261108000001_lot9_securite.sql:143-506 ; propriétaire unique S-D, X15).
-- Écrite tâche après tâche (section 10), un commit par tâche ; chaque bloc dit ses tâches.
--
-- Tâche 30 (R12, B69 ; R81 / tâche 46, branche ORGANIZER rebranchée) : numéros sans compte prévenus par SMS
-- indispensable, une ligne par numéro, sans lien, aucun numéro dans template_data (notification_outbox_no_secret_chk) :
--   - annulation : invitations non réclamées (transfert PENDING sans expéditeur, billet sans porteur) → mode NONE ;
--     acheteurs au guichet (payments.payer_phone, vente COUNTER payée) → mode ORGANIZER ; numéros des comptes déjà
--     prévenus retirés ; clé EVENT_CANCELLED:<event>:t<plus petit billet du numéro>, recipient_kind PHONE ;
--   - changement de date ou de lieu (event_update) : mêmes numéros, mêmes statuts de billet que les porteurs à compte ;
--     SMS dû à maintenant + 10 minutes (B71), tout de suite si l'ancien ou le nouveau début est à moins d'une heure ;
--     ligne en attente du numéro fusionnée (index uq_outbox_event_change_pending_sms_phone, M03) ; réponse et audit
--     + notified_phones.
-- Tâche 31 (R13, B70) : à l'annulation, l'acheteur d'origine (payeur d'un paiement en ligne de billets encore
-- valables) est prévenu même sans billet (clé EVENT_CANCELLED:<event>:<compte>, mode AUTO, prioritaire) ; le porteur
-- d'un billet payé par un autre compte reçoit le mode TRANSFERRED (« Remboursement à l'acheteur d'origine. »).
-- Tâche 32 (R14, R26, B71) : EVENT_CHANGED est indispensable (registre M03) ; le SMS d'un porteur est créé à
-- maintenant + 10 minutes et fusionné sur une fenêtre fixe depuis le premier changement (la ligne en attente garde
-- son échéance) ; immédiat si l'ancien ou le nouveau début est à moins d'une heure (échéance ramenée à maintenant à
-- la fusion) ; in-app et push immédiats.
-- Tâche 33 (R15, R33, B72) : annulation par un admin → EVENT_CANCELLED_BY_ADMIN à la propriétaire (avis public) ;
-- annulation par la partenaire → ADMIN_EVENT_CANCELLED aux admins events.read (motif interne) ; contrôleurs affectés
-- (event_controllers : affectations acceptées) : CONTROLLER_EVENT_CANCELLED (SMS) à l'annulation,
-- CONTROLLER_EVENT_STATUS (in-app) à la suspension et à la reprise, CONTROLLER_EVENT_CHANGED (in-app immédiat, SMS
-- et email à 10 minutes, fusionnés) au changement de date ou de lieu ; notif_cancel_on_status recopiée (base
-- 20261103000004_lot6_rappels.sql:215-237) annule aussi le changement en attente d'un contrôleur.
-- Tâche 34 (R22, R23, B73) : ticket_invitation_cancel recopiée (base 20261108000002_lot9_invitations.sql:504-574)
-- met TICKET_CANCELLED (kind INVITATION) en file au porteur, ou par SMS au numéro de l'invitation non réclamée (lu
-- avant la révocation) ; à l'annulation, le destinataire d'un transfert en attente révoqué reçoit EVENT_CANCELLED par
-- SMS (numéro seul, NONE). Les branches gratuit et espèces de ticket_refund_request sont à S-A (fix(9b.34-SA), M06) ;
-- admin_user_status_set (R59) à S-B (M04).
-- Tâche 35 (R24) : décision, aucun code (EMAIL réglable des types *_HOLDER posé par M03).
-- Tâche 36 (R18, R95, B76) : ADMIN_EVENT_CHANGED aux admins events.read par deux triggers nouveaux, sans recopie de
-- event_update ni de ticket_category_create : trg_events_admin_change_alert (titre, affiche, lieu, ville, adresse,
-- dates et heures distincts sur un événement VALIDE, PUBLIE ou SUSPENDU ; clé par transaction) et
-- trg_ticket_categories_admin_alert (catégorie ajoutée à un tel événement) ; EVENT_SUBMITTED_ACK à la soumission.
-- Verrous : lectures sans verrou de partners et events, boîte d'envoi en dernier (3.3).
-- Tâche 37 (R72, R79, R78 ; B77 à B79, X11) : PUBLIE → TERMINE sans caisse ouverte → EVENT_FINISHED ; la dernière
-- caisse fermée d'un événement TERMINE → CLOSING_REPORT_READY (trigger nouveau trg_controller_shifts_report_ready) ;
-- notification_daily_checks recopiée (base 20261105000002_lot7_sms.sql:449-516) → FUNDS_AVAILABLE une fois par
-- événement terminé dont toutes les ventes sont disponibles ; ticket_invitation_create recopiée (base
-- 20261108000002_lot9_invitations.sql:348-495) → in-app et push au compte vérifié ; notif_tickets_scanned recopiée
-- (base 20261103000005_lot6_billetterie.sql:866-887) → avis regroupés par commande, dus à 2 minutes.
-- Tâche 38 (R29, R31 ; B80, B81) : notif_on_password_changed recopiée (base 20261103000006_lot6_pros_admin.sql:
-- 923-950) ne prévient pas l'activation d'un compte coquille de contrôleur ; notification_daily_checks compte les SMS
-- indispensables du jour et réémet ADMIN_SMS_DAILY_THRESHOLD au seuil notif.sms_essential_daily_alert (M01), une
-- fois par jour (TRIAL_STARTED sans SMS : registre M03 ; smsVar R27 : S2).
-- Tâche 39 (R28) : libellé de supervision livré en S2 (outbox-labels.ts), rien en base.
--
-- Délégations (8.3), S-D propriétaire des recopies :
--   - tâche 2 (S-A, R5, A7, B17) : une transition de la cascade de suspension d'une partenaire (marqueur
--     transactionnel ev.partner_cascade = '1' posé par partner_status_set, M06) ne met ni EVENT_SUSPENDED ni
--     EVENT_REACTIVATED en file à la partenaire ; porteurs (in-app, push) et contrôleurs (in-app) restent prévenus.
--   - tâche 5 (S-A, R32, B23) : event_update écrit event_start_changes (ancien et nouveau début, acteur) à chaque
--     changement de début, puis met refund_open dans les données EVENT_CHANGED du porteur dont un billet ouvre le
--     remboursement d'un report (ticket_postponement_refund_open, M06) : variante « report » du SMS et de l'in-app.
--   - tâche 20 (S-C, R3, B46, X10) : SUSPENDU → TERMINE (clôture par l'administration, ligne de transition de M08) →
--     EVENT_CLOSED_HOLDER à chaque porteur d'un billet VALIDE ou UTILISE, sans motif ; EVENT_CLOSED_BY_ADMIN à la
--     propriétaire avec le motif ; dans la transaction de la transition.
--   - tâche 22 (S-C, R43, B50, X11) : passage à TERMINE (cron depuis PUBLIE, clôture admin depuis SUSPENDU) avec au
--     moins une caisse OUVERT → SHIFT_OPEN_AT_END à la propriétaire (open_shifts) ; depuis PUBLIE, il remplace
--     EVENT_FINISHED (un seul avis par cas) ; jamais à l'annulation.
--   - tâche 21 (S-C, R16, B47, X7) : event_update calcule l'ancienne et la nouvelle fin par event_end_from_v2 (M08,
--     même règle que event_end_at : date et heure de fin ; date sans heure → 23:59 ; aucune fin → début + 6 h) au
--     lieu de event_end_from à trois arguments (laissée telle quelle, plus aucun appelant ici) ; contrôle des fins de
--     vente, report des fonds et données new_end_at en découlent.
--   - tâche 25 (S-C, R94, B61) : une modification de dates qui place la fin de l'événement au plus tard au début de
--     vente d'une catégorie est refusée SALE_START_AFTER_EVENT « Le début de vente doit précéder la fin de
--     l’événement. » (catégories en cause dans details), comme ticket_category_update (M08).
--   - tâche 41, R80 (S-E) : adresse vidée → address_cleared dans les données EVENT_CHANGED (variante « adresse retirée,
--     lieu … » du catalogue S2) ; à la fusion d'une ligne en attente (porteur, numéro seul, contrôleur), une adresse
--     changée de nouveau retire new_address et address_cleared hérités : l'adresse posée puis retirée dans la fenêtre
--     ne fuit plus.
--   - tâche 49 (S-G, G.49, B97) : EVENT_CHANGED gagne sa ligne EMAIL au porteur (créée à 10 minutes et fusionnée,
--     index uq_outbox_event_change_pending_email de M03) ; INVITATION_RECEIVED au compte vérifié passe aussi par
--     email ; l'adresse vérifiée est exigée par notif_enqueue de M10 (S-G). Les lignes « numéro seul » restent SMS.
--
-- Verrous (3.3) : rien de nouveau. Le trigger d'historique s'exécute dans event_status_apply, sous le verrou de
-- l'événement, avant la révocation des transferts (event_cancel) : il lit les transferts PENDING sans verrou.
-- event_update : events NKU → catégories → boîte d'envoi (fusion FOR UPDATE de la ligne en attente).
-- Aucun BEGIN ni COMMIT ; rejouable (CREATE OR REPLACE). Toute fonction : SECURITY DEFINER, search_path = public,
-- volatilité explicite, REVOKE ALL FROM PUBLIC, anon, authenticated ; GRANT EXECUTE TO service_role (RPC seulement ;
-- fonctions de trigger : rien à accorder).
-- ============================================================================


-- ============================================================================
-- 1. notif_event_status_changed (recopie de 20261103000005_lot6_billetterie.sql:1206-1323)
-- Tâche 30 : branche ANNULE, numéros sans compte (invitations non réclamées NONE, acheteurs au guichet ORGANIZER).
-- Tâche 31 : branche ANNULE, acheteurs d'origine prévenus (AUTO), porteurs d'un billet reçu en mode TRANSFERRED.
-- Tâche 33 : ANNULE → propriétaire (annulation admin) ou admins events.read (annulation partenaire), contrôleurs ;
-- PUBLIE ↔ SUSPENDU → contrôleurs (in-app).
-- Tâche 34 : ANNULE → destinataires des transferts en attente révoqués (numéro seul, NONE).
-- Tâche 36 : BROUILLON → EN_ATTENTE → accusé EVENT_SUBMITTED_ACK à la propriétaire.
-- Tâche 37 : PUBLIE → TERMINE sans caisse ouverte → EVENT_FINISHED à la propriétaire.
-- Tâche 2 (délégation 8.3, pour S-A) : transitions d'une cascade (marqueur ev.partner_cascade) sans
-- EVENT_SUSPENDED ni EVENT_REACTIVATED à la partenaire ; porteurs et contrôleurs prévenus.
-- Tâche 20 (délégation, S-C) : SUSPENDU → TERMINE → EVENT_CLOSED_HOLDER aux porteurs, EVENT_CLOSED_BY_ADMIN (motif).
-- Tâche 22 (délégation, S-C) : → TERMINE avec caisse ouverte → SHIFT_OPEN_AT_END à la propriétaire.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notif_event_status_changed()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old text := NEW.old_status::text;
    v_new text := NEW.new_status::text;
    v_owner uuid;
    v_company text;
    v_data jsonb;
    v_notice text;
    v_recipients uuid[];
    v_user uuid;
    v_open integer;
    v_cascade boolean := COALESCE(current_setting('ev.partner_cascade', true), '') = '1';
    h record;
    n record;
BEGIN
    IF NEW.channel = 'CREATION' OR v_old IS NULL THEN
        RETURN NULL;
    END IF;
    v_data := public.notif_event_data(NEW.event_id);
    IF v_data IS NULL THEN
        RETURN NULL;   -- événement absent (cascade) : rien à prévenir
    END IF;
    SELECT pa.user_id, pa.company_name INTO v_owner, v_company
      FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = NEW.event_id;

    IF v_old = 'BROUILLON' AND v_new = 'EN_ATTENTE' THEN
        PERFORM public.notif_enqueue_admins(jsonb_build_object(
            'type', 'ADMIN_EVENT_SUBMITTED', 'ref', NEW.id::text, 'event_id', NEW.event_id,
            'data', v_data || jsonb_strip_nulls(jsonb_build_object('company', v_company))));
        -- Lot 9 bis (R95, B76) : accusé de soumission à la propriétaire
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_SUBMITTED_ACK', 'key', 'EVENT_SUBMITTED_ACK:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id, 'data', v_data));
        END IF;

    ELSIF v_old = 'EN_ATTENTE' AND v_new = 'BROUILLON' AND NEW.actor_role = 'ADMIN' THEN
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_REJECTED', 'key', 'EVENT_REJECTED:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id,
                'data', v_data || jsonb_strip_nulls(jsonb_build_object('reason', NEW.reason))));
        END IF;

    ELSIF v_old = 'EN_ATTENTE' AND v_new = 'VALIDE' THEN
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_VALIDATED', 'key', 'EVENT_VALIDATED:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id, 'data', v_data));
        END IF;

    ELSIF v_old = 'VALIDE' AND v_new = 'PUBLIE' AND NEW.actor_role = 'ADMIN' THEN
        IF v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_PUBLISHED_BY_ADMIN', 'key', 'EVENT_PUBLISHED_BY_ADMIN:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id, 'data', v_data));
        END IF;

    ELSIF v_old = 'PUBLIE' AND v_new = 'SUSPENDU' THEN
        -- Lot 9 bis (A7, B17) : transition d'une cascade de suspension de la partenaire (marqueur posé par
        -- partner_status_set, M06) : aucun avis par événement à la partenaire, qui a déjà celui de son compte.
        IF v_owner IS NOT NULL AND NOT v_cascade THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_SUSPENDED', 'key', 'EVENT_SUSPENDED:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id,
                'data', v_data || jsonb_strip_nulls(jsonb_build_object('reason', NEW.reason))));
        END IF;
        FOR h IN
            SELECT DISTINCT t.user_id FROM public.tickets t
             WHERE t.event_id = NEW.event_id AND t.user_id IS NOT NULL AND t.status::text IN ('VALIDE', 'UTILISE')
             ORDER BY t.user_id
        LOOP
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_SUSPENDED_HOLDER', 'key', 'EVENT_SUSPENDED_HOLDER:' || NEW.id::text || ':' || h.user_id::text,
                'user_id', h.user_id, 'event_id', NEW.event_id, 'data', v_data));
        END LOOP;
        -- Lot 9 bis (R33, B72) : contrôleurs affectés (affectations acceptées), in-app et email, jamais de SMS
        FOR h IN
            SELECT ec.user_id FROM public.event_controllers ec WHERE ec.event_id = NEW.event_id ORDER BY ec.user_id
        LOOP
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'CONTROLLER_EVENT_STATUS', 'key', 'CONTROLLER_EVENT_STATUS:' || NEW.id::text || ':' || h.user_id::text,
                'user_id', h.user_id, 'event_id', NEW.event_id, 'data', v_data || jsonb_build_object('status', v_new)));
        END LOOP;

    ELSIF v_old = 'SUSPENDU' AND v_new = 'PUBLIE' THEN
        -- Lot 9 bis (A7, B17) : réactivation en cascade, aucun avis par événement à la partenaire
        IF v_owner IS NOT NULL AND NOT v_cascade THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_REACTIVATED', 'key', 'EVENT_REACTIVATED:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id, 'data', v_data));
        END IF;
        FOR h IN
            SELECT DISTINCT t.user_id FROM public.tickets t
             WHERE t.event_id = NEW.event_id AND t.user_id IS NOT NULL AND t.status::text IN ('VALIDE', 'UTILISE')
             ORDER BY t.user_id
        LOOP
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_REACTIVATED_HOLDER', 'key', 'EVENT_REACTIVATED_HOLDER:' || NEW.id::text || ':' || h.user_id::text,
                'user_id', h.user_id, 'event_id', NEW.event_id, 'data', v_data));
        END LOOP;
        -- Lot 9 bis (R33, B72) : contrôleurs affectés, in-app et email
        FOR h IN
            SELECT ec.user_id FROM public.event_controllers ec WHERE ec.event_id = NEW.event_id ORDER BY ec.user_id
        LOOP
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'CONTROLLER_EVENT_STATUS', 'key', 'CONTROLLER_EVENT_STATUS:' || NEW.id::text || ':' || h.user_id::text,
                'user_id', h.user_id, 'event_id', NEW.event_id, 'data', v_data || jsonb_build_object('status', v_new)));
        END LOOP;

    ELSIF v_new = 'ANNULE' THEN
        -- Avis public écrit par event_cancel avant la transition ; porteurs lus avant toute modification des
        -- billets (event_cancel ne les annule qu'après) ; mode de remboursement par porteur.
        -- Lot 9 bis (R13, B70) : destinataires = porteurs ∪ acheteurs d'origine (payeurs des paiements en ligne de
        -- billets encore valables, remboursés par event_cancel) ; mode par destinataire, premier vrai : AUTO pour le
        -- payeur (son remboursement est réel, prioritaire), TRANSFERRED pour le porteur d'un billet payé par un autre
        -- compte, ORGANIZER et NONE inchangés.
        SELECT c.public_notice INTO v_notice FROM public.event_cancellations c WHERE c.event_id = NEW.event_id;
        SELECT COALESCE(array_agg(x.uid ORDER BY x.uid), ARRAY[]::uuid[]) INTO v_recipients
          FROM (SELECT t.user_id AS uid FROM public.tickets t
                 WHERE t.event_id = NEW.event_id AND t.user_id IS NOT NULL AND t.status::text IN ('VALIDE', 'UTILISE')
                UNION
                SELECT py.client_id FROM public.tickets t
                  JOIN public.payments py ON py.id = t.payment_id
                 WHERE t.event_id = NEW.event_id AND t.status::text IN ('VALIDE', 'UTILISE') AND COALESCE(t.price, 0) > 0
                   AND py.client_id IS NOT NULL AND py.is_platform_payment AND py.payment_target::text = 'TICKET'
                   AND py.status::text IN ('SUCCESS', 'PARTIAL') AND py.amount > 0) x;
        FOREACH v_user IN ARRAY v_recipients LOOP
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_CANCELLED', 'key', 'EVENT_CANCELLED:' || NEW.event_id::text || ':' || v_user::text,
                'user_id', v_user, 'event_id', NEW.event_id,
                'data', v_data || jsonb_strip_nulls(jsonb_build_object(
                    'public_notice', NULLIF(btrim(COALESCE(v_notice, '')), ''),
                    'refund_mode', CASE
                        WHEN EXISTS (SELECT 1 FROM public.tickets t
                                       JOIN public.payments py ON py.id = t.payment_id
                                      WHERE t.event_id = NEW.event_id AND py.client_id = v_user
                                        AND t.status::text IN ('VALIDE', 'UTILISE') AND COALESCE(t.price, 0) > 0
                                        AND py.is_platform_payment AND py.payment_target::text = 'TICKET'
                                        AND py.status::text IN ('SUCCESS', 'PARTIAL') AND py.amount > 0) THEN 'AUTO'
                        WHEN EXISTS (SELECT 1 FROM public.tickets t
                                       JOIN public.payments py ON py.id = t.payment_id
                                      WHERE t.event_id = NEW.event_id AND t.user_id = v_user
                                        AND t.status::text IN ('VALIDE', 'UTILISE') AND py.is_platform_payment
                                        AND COALESCE(t.price, 0) > 0
                                        AND py.client_id IS DISTINCT FROM v_user) THEN 'TRANSFERRED'
                        WHEN EXISTS (SELECT 1 FROM public.tickets t
                                      WHERE t.event_id = NEW.event_id AND t.user_id = v_user
                                        AND t.status::text IN ('VALIDE', 'UTILISE') AND t.payment_id IS NULL
                                        AND t.order_id IS NOT NULL AND COALESCE(t.price, 0) > 0) THEN 'ORGANIZER'
                        ELSE 'NONE' END))));
        END LOOP;

        -- Lot 9 bis (R12, B69 ; R81) : numéros sans compte, une ligne SMS par numéro, sans lien. Invitation non
        -- réclamée et (R23) destinataire d'un transfert révoqué → NONE ; acheteur au guichet (numéro saisi, vente
        -- payée en espèces) → ORGANIZER, prioritaire.
        -- Les numéros des comptes déjà prévenus ci-dessus sont retirés. Aucun numéro dans les données.
        FOR n IN
            SELECT x.phone,
                   CASE WHEN bool_or(x.src = 'COUNTER') THEN 'ORGANIZER' ELSE 'NONE' END AS mode,
                   (array_agg(x.ticket_id ORDER BY x.ticket_id))[1] AS ticket_id
              FROM (SELECT tr.to_phone_or_email AS phone, 'INVITATION'::text AS src, t.id AS ticket_id
                      FROM public.ticket_transfers tr
                      JOIN public.tickets t ON t.id = tr.ticket_id
                     WHERE t.event_id = NEW.event_id AND tr.status::text = 'PENDING' AND tr.from_user_id IS NULL
                       AND t.user_id IS NULL AND t.status::text = 'VALIDE'
                    UNION ALL
                    SELECT '+221' || py.payer_phone, 'COUNTER', t.id
                      FROM public.tickets t
                      JOIN public.payments py ON py.id = t.payment_id
                     WHERE t.event_id = NEW.event_id AND t.sale_channel::text = 'COUNTER' AND NOT py.is_platform_payment
                       AND py.payer_phone ~ '^7[05678][0-9]{7}$'
                       AND t.status::text IN ('VALIDE', 'UTILISE') AND COALESCE(t.price, 0) > 0
                    UNION ALL
                    -- Lot 9 bis (R23, B73) : destinataire d'un transfert en attente, révoqué par event_cancel
                    SELECT tr.to_phone_or_email, 'TRANSFER', t.id
                      FROM public.ticket_transfers tr
                      JOIN public.tickets t ON t.id = tr.ticket_id
                     WHERE t.event_id = NEW.event_id AND tr.status::text = 'PENDING' AND tr.from_user_id IS NOT NULL
                       AND t.status::text = 'VALIDE') x
             WHERE x.phone ~ '^\+221[0-9]{9}$'
               AND NOT EXISTS (SELECT 1 FROM public.users u
                                WHERE u.id = ANY (v_recipients) AND u.phone IN (x.phone, substr(x.phone, 2)))
             GROUP BY x.phone
             ORDER BY x.phone
        LOOP
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_CANCELLED', 'key', 'EVENT_CANCELLED:' || NEW.event_id::text || ':t' || n.ticket_id::text,
                'phone', n.phone, 'event_id', NEW.event_id, 'channels', jsonb_build_array('SMS'),
                'data', v_data || jsonb_strip_nulls(jsonb_build_object(
                    'public_notice', NULLIF(btrim(COALESCE(v_notice, '')), ''),
                    'refund_mode', n.mode, 'recipient_kind', 'PHONE', 'ticket_id', n.ticket_id))));
        END LOOP;

        -- Lot 9 bis (R15, B72) : annulation par un admin → la propriétaire, avec l'avis public (jamais le motif
        -- interne), avant tout versement ; annulation par la partenaire → admins events.read, motif interne.
        IF NEW.actor_role = 'ADMIN' THEN
            IF v_owner IS NOT NULL THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CANCELLED_BY_ADMIN', 'key', 'EVENT_CANCELLED_BY_ADMIN:' || NEW.id::text,
                    'user_id', v_owner, 'event_id', NEW.event_id,
                    'data', v_data || jsonb_strip_nulls(jsonb_build_object('public_notice', NULLIF(btrim(COALESCE(v_notice, '')), '')))));
            END IF;
        ELSIF NEW.actor_role = 'PARTENAIRE' THEN
            PERFORM public.notif_enqueue_admins(jsonb_build_object(
                'type', 'ADMIN_EVENT_CANCELLED', 'ref', NEW.id::text, 'event_id', NEW.event_id,
                'data', v_data || jsonb_strip_nulls(jsonb_build_object(
                    'company', v_company,
                    'reason', (SELECT NULLIF(btrim(COALESCE(c.internal_reason, '')), '')
                                 FROM public.event_cancellations c WHERE c.event_id = NEW.event_id)))));
        END IF;

        -- Lot 9 bis (R33, B72) : contrôleurs affectés (affectations acceptées), SMS et in-app
        FOR h IN
            SELECT ec.user_id FROM public.event_controllers ec WHERE ec.event_id = NEW.event_id ORDER BY ec.user_id
        LOOP
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'CONTROLLER_EVENT_CANCELLED', 'key', 'CONTROLLER_EVENT_CANCELLED:' || NEW.event_id::text || ':' || h.user_id::text,
                'user_id', h.user_id, 'event_id', NEW.event_id, 'data', v_data));
        END LOOP;

    ELSIF v_new = 'TERMINE' THEN
        -- Lot 9 bis (R72, B77, X11) : un seul avis par cas à la propriétaire. Les rappels en attente sont annulés par
        -- trg_notif_cancel_on_status. Caisses encore ouvertes lues sans verrou (shift_close passe par la caisse).
        SELECT count(*)::integer INTO v_open
          FROM public.controller_shifts s WHERE s.event_id = NEW.event_id AND s.status = 'OUVERT';
        IF v_old = 'PUBLIE' AND v_open = 0 AND v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_FINISHED', 'key', 'EVENT_FINISHED:' || NEW.event_id::text,
                'user_id', v_owner, 'event_id', NEW.event_id, 'data', v_data));
        END IF;
        -- Lot 9 bis (R3, B46, X10) : un événement suspendu clos par l'administration. Porteurs (billets VALIDE ou
        -- UTILISE) : EVENT_CLOSED_HOLDER sans motif ; propriétaire : EVENT_CLOSED_BY_ADMIN avec le motif de l'admin.
        IF v_old = 'SUSPENDU' THEN
            FOR h IN
                SELECT DISTINCT t.user_id FROM public.tickets t
                 WHERE t.event_id = NEW.event_id AND t.user_id IS NOT NULL AND t.status::text IN ('VALIDE', 'UTILISE')
                 ORDER BY t.user_id
            LOOP
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CLOSED_HOLDER', 'key', 'EVENT_CLOSED_HOLDER:' || NEW.id::text || ':' || h.user_id::text,
                    'user_id', h.user_id, 'event_id', NEW.event_id, 'data', v_data));
            END LOOP;
            IF v_owner IS NOT NULL THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CLOSED_BY_ADMIN', 'key', 'EVENT_CLOSED_BY_ADMIN:' || NEW.id::text,
                    'user_id', v_owner, 'event_id', NEW.event_id,
                    'data', v_data || jsonb_strip_nulls(jsonb_build_object('reason', NULLIF(btrim(COALESCE(NEW.reason, '')), '')))));
            END IF;
        END IF;
        -- Lot 9 bis (R43, B50, X11) : caisse encore ouverte au passage à TERMINE (depuis PUBLIE ou SUSPENDU), jamais
        -- à l'annulation : SHIFT_OPEN_AT_END à la propriétaire, nombre de caisses ouvertes.
        IF v_open > 0 AND v_owner IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'SHIFT_OPEN_AT_END', 'key', 'SHIFT_OPEN_AT_END:' || NEW.id::text,
                'user_id', v_owner, 'event_id', NEW.event_id,
                'data', v_data || jsonb_build_object('open_shifts', v_open)));
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notif_event_status_changed() FROM PUBLIC, anon, authenticated;


-- ============================================================================
-- 2. event_update (recopie de 20261108000001_lot9_securite.sql:143-506 ; propriétaire unique S-D, X15)
-- Tâche 30 : numéros sans compte (invitations non réclamées, acheteurs au guichet) prévenus d'un changement de date
-- ou de lieu, SMS dû à maintenant + 10 min (tout de suite si un début est à moins d'une heure), fusionné par numéro ;
-- réponse et audit + notified_phones.
-- Tâche 32 : SMS d'un porteur dû dans 10 minutes, fusion à fenêtre fixe, immédiat si un début est à moins d'une heure.
-- Tâche 33 : contrôleurs affectés (CONTROLLER_EVENT_CHANGED, in-app immédiat, SMS et email à 10 minutes, fusionnés).
-- Tâche 5 (délégation, S-A) : event_start_changes écrit à chaque changement de début ; refund_open par porteur.
-- Tâche 21 (délégation, S-C) : ancienne et nouvelle fin par event_end_from_v2 (sans fin : début + 6 h).
-- Tâche 25 (délégation, S-C) : SALE_START_AFTER_EVENT quand un début de vente atteint la nouvelle fin.
-- Tâche 41 (R80, délégation, S-E) : address_cleared ; à la fusion, l'ancienne adresse (posée ou retirée) est remplacée.
-- Tâche 49 (G.49, délégation, S-G) : email du changement au porteur, dû à 10 minutes et fusionné comme le SMS.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.event_update(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event uuid := public.try_uuid(p->>'event_id');
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_patch jsonb := p->'patch';
    v_expected timestamptz;
    e public.events%ROWTYPE;
    a record;
    v_key text;
    v_forbidden text[] := ARRAY['status', 'services', 'gallery_urls', 'ticket_categories', 'slug', 'partner_id', 'is_featured',
                                'featured_until', 'id', 'created_at', 'updated_at'];
    v_allowed text[] := ARRAY['title', 'category', 'description', 'start_date', 'start_time', 'end_date', 'end_time', 'location',
                              'city', 'latitude', 'longitude', 'image_url', 'capacity', 'program', 'practical_info'];
    n_title text;
    n_category event_category;
    n_description text;
    n_start_date date;
    n_start_time time;
    n_end_date date;
    n_end_time time;
    n_location text;
    n_city text;
    n_lat double precision;
    n_lng double precision;
    n_image text;
    n_capacity integer;
    n_program jsonb;
    n_practical jsonb;
    v_post boolean;
    v_has_sales boolean;
    v_start_changed boolean;
    v_dates_changed boolean;
    v_new_start timestamptz;
    v_old_start timestamptz;
    v_old_end timestamptz;
    v_new_end timestamptz;
    v_engaged integer;
    v_quota integer;
    v_late jsonb;
    v_late_names text;
    v_changed text[] := ARRAY[]::text[];
    v_labels text[] := ARRAY[]::text[];
    v_sms boolean := false;
    v_holders uuid[];
    v_notified integer := 0;
    v_phones integer := 0;
    v_sms_queued integer := 0;
    v_version integer;
    v_row jsonb;
    v_holder uuid;
    v_nkey text;
    v_data jsonb;
    v_hdata jsonb;
    v_drop text[] := ARRAY['migrated_from'];
    v_pending_id uuid;
    v_pending_data jsonb;
    v_urgent boolean := false;
    v_due timestamptz;
    v_ch text;
    n record;
BEGIN
    IF v_event IS NULL THEN
        RETURN public.event_edit_refusal('EVENT_NOT_FOUND', 'Événement introuvable.');
    END IF;
    IF v_patch IS NULL OR jsonb_typeof(v_patch) <> 'object' THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Les modifications de l''événement sont illisibles.');
    END IF;
    BEGIN
        v_expected := (p->>'expected_updated_at')::timestamptz;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
        v_expected := NULL;
    END;
    IF v_expected IS NULL THEN
        RETURN public.event_edit_refusal('EXPECTED_VERSION_REQUIRED', 'Version de l''événement manquante : rechargez la page puis recommencez.');
    END IF;

    SELECT * INTO e FROM public.events WHERE id = v_event FOR NO KEY UPDATE;
    IF NOT FOUND THEN
        RETURN public.event_edit_refusal('EVENT_NOT_FOUND', 'Événement introuvable.');
    END IF;
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    IF NOT a.is_owner THEN
        IF a.is_staff THEN
            RETURN public.event_edit_refusal('ADMIN_CANNOT_EDIT', 'Seul l''organisateur modifie son événement ; l''administration agit par les changements de statut.');
        END IF;
        RETURN public.event_edit_refusal('EVENT_NOT_FOUND', 'Événement introuvable.');
    END IF;
    IF NOT a.is_active THEN
        RETURN public.event_edit_refusal('ACCOUNT_NOT_ACTIVE', 'Votre compte n''est pas actif.');
    END IF;

    SELECT k INTO v_key FROM jsonb_object_keys(v_patch) AS k
     WHERE k = ANY (v_forbidden) OR k <> ALL (v_allowed)
     ORDER BY k LIMIT 1;
    IF v_key IS NOT NULL THEN
        RETURN public.event_edit_refusal('FIELD_NOT_EDITABLE', 'Ce champ ne se modifie pas depuis le formulaire de l''événement.', v_key);
    END IF;

    IF e.status::text = 'EN_ATTENTE' THEN
        RETURN public.event_edit_refusal('WITHDRAW_TO_EDIT', 'L''événement est en cours de validation : retirez-le de la validation pour le modifier.');
    END IF;
    IF e.status::text IN ('TERMINE', 'ANNULE') THEN
        RETURN public.event_edit_refusal('EVENT_LOCKED', 'Un événement terminé ou annulé ne peut plus être modifié.');
    END IF;
    IF e.updated_at IS DISTINCT FROM v_expected THEN
        RETURN public.event_edit_refusal('EDIT_CONFLICT', 'L''événement a été modifié entre-temps : rechargez la page pour voir la dernière version.');
    END IF;
    v_post := e.status::text IN ('VALIDE', 'PUBLIE', 'SUSPENDU');

    -- Nouvelles valeurs (colonnes absentes du patch : inchangées)
    n_title := e.title; n_category := e.category; n_description := e.description;
    n_start_date := e.start_date; n_start_time := e.start_time; n_end_date := e.end_date; n_end_time := e.end_time;
    n_location := e.location; n_city := e.city; n_lat := e.latitude; n_lng := e.longitude; n_image := e.image_url;
    n_capacity := e.capacity; n_program := e.program; n_practical := e.practical_info;
    BEGIN
        IF v_patch ? 'title' THEN n_title := btrim(v_patch->>'title'); END IF;
        v_key := 'category';
        IF v_patch ? 'category' THEN n_category := (v_patch->>'category')::event_category; END IF;
        v_key := NULL;
        IF v_patch ? 'description' THEN n_description := NULLIF(btrim(COALESCE(v_patch->>'description', '')), ''); END IF;
        IF v_patch ? 'start_date' THEN n_start_date := (v_patch->>'start_date')::date; END IF;
        IF v_patch ? 'start_time' THEN n_start_time := (v_patch->>'start_time')::time; END IF;
        IF v_patch ? 'end_date' THEN n_end_date := NULLIF(v_patch->>'end_date', '')::date; END IF;
        IF v_patch ? 'end_time' THEN n_end_time := NULLIF(v_patch->>'end_time', '')::time; END IF;
        IF v_patch ? 'location' THEN n_location := btrim(v_patch->>'location'); END IF;
        IF v_patch ? 'city' THEN n_city := btrim(v_patch->>'city'); END IF;
        IF v_patch ? 'latitude' THEN n_lat := (v_patch->>'latitude')::double precision; END IF;
        IF v_patch ? 'longitude' THEN n_lng := (v_patch->>'longitude')::double precision; END IF;
        IF v_patch ? 'image_url' THEN n_image := NULLIF(btrim(COALESCE(v_patch->>'image_url', '')), ''); END IF;
        IF v_patch ? 'capacity' THEN n_capacity := (v_patch->>'capacity')::integer; END IF;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
        IF v_key = 'category' THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une catégorie d''événement dans la liste.', 'category');
        END IF;
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Une valeur modifiée est illisible.');
    END;
    IF v_patch ? 'program' THEN
        n_program := CASE jsonb_typeof(v_patch->'program') WHEN 'array' THEN v_patch->'program' WHEN 'null' THEN '[]'::jsonb END;
        IF n_program IS NULL OR jsonb_array_length(n_program) > 50 THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Le programme compte 50 lignes au plus.', 'program');
        END IF;
    END IF;
    IF v_patch ? 'practical_info' THEN
        n_practical := CASE jsonb_typeof(v_patch->'practical_info') WHEN 'object' THEN v_patch->'practical_info' WHEN 'null' THEN '{}'::jsonb END;
        IF n_practical IS NULL THEN
            RETURN public.event_edit_refusal('INVALID_INPUT', 'Les informations pratiques sont illisibles.', 'practical_info');
        END IF;
    END IF;
    -- Heure renvoyée par le formulaire en HH:mm : identique à la minute près = inchangée (R29)
    IF n_start_time IS NOT NULL AND e.start_time IS NOT NULL AND to_char(n_start_time, 'HH24:MI') = to_char(e.start_time, 'HH24:MI') THEN
        n_start_time := e.start_time;
    END IF;
    IF n_end_time IS NOT NULL AND e.end_time IS NOT NULL AND to_char(n_end_time, 'HH24:MI') = to_char(e.end_time, 'HH24:MI') THEN
        n_end_time := e.end_time;
    END IF;

    -- Défense : bornes de F1 (déjà contrôlées par le schéma partagé), sur les seuls champs envoyés
    IF v_patch ? 'title' AND (n_title IS NULL OR char_length(n_title) < 3 OR char_length(n_title) > 120) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le titre compte de 3 à 120 caractères.', 'title');
    END IF;
    IF v_patch ? 'category' AND n_category IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Choisissez une catégorie d''événement dans la liste.', 'category');
    END IF;
    IF v_patch ? 'description' AND n_description IS NOT NULL AND char_length(n_description) > 5000 THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La description ne dépasse pas 5 000 caractères.', 'description');
    END IF;
    IF v_patch ? 'location' AND (n_location IS NULL OR char_length(n_location) < 2 OR char_length(n_location) > 200) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'Le lieu compte de 2 à 200 caractères.', 'location');
    END IF;
    IF v_patch ? 'city' AND (n_city IS NULL OR char_length(n_city) < 2 OR char_length(n_city) > 80) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La ville compte de 2 à 80 caractères.', 'city');
    END IF;
    IF n_start_date IS NULL OR n_start_time IS NULL THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La date et l''heure de début sont obligatoires.', 'start_date');
    END IF;
    IF n_lat IS NOT NULL AND (n_lat < -90 OR n_lat > 90) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La latitude est comprise entre -90 et 90.', 'latitude');
    END IF;
    IF n_lng IS NOT NULL AND (n_lng < -180 OR n_lng > 180) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La longitude est comprise entre -180 et 180.', 'longitude');
    END IF;
    IF n_capacity IS NOT NULL AND (n_capacity < 1 OR n_capacity > 100000) THEN
        RETURN public.event_edit_refusal('INVALID_INPUT', 'La jauge est un nombre entier de 1 à 100 000.', 'capacity');
    END IF;
    IF n_image IS DISTINCT FROM e.image_url AND NOT public.event_poster_path_ok(n_image, e.partner_id) THEN
        RETURN public.event_edit_refusal('IMAGE_ORIGIN_INVALID', 'L''affiche doit être déposée depuis le formulaire de l''événement.', 'image_url');
    END IF;

    -- Dates (Africa/Dakar) : début dans le futur s'il change, fin après le début
    v_start_changed := n_start_date IS DISTINCT FROM e.start_date OR n_start_time IS DISTINCT FROM e.start_time;
    v_dates_changed := v_start_changed OR n_end_date IS DISTINCT FROM e.end_date OR n_end_time IS DISTINCT FROM e.end_time;
    IF n_end_time IS NOT NULL AND n_end_date IS NULL THEN
        RETURN public.event_edit_refusal('END_DATE_REQUIRED', 'Indiquez la date de fin pour l''heure de fin saisie.', 'end_date');
    END IF;
    v_new_start := (n_start_date + n_start_time) AT TIME ZONE 'Africa/Dakar';
    v_old_start := (e.start_date + e.start_time) AT TIME ZONE 'Africa/Dakar';
    IF v_start_changed AND v_new_start <= now() THEN
        RETURN public.event_edit_refusal('EVENT_START_PAST', 'Le nouveau début de l''événement doit être dans le futur (heure de Dakar).', 'start_date');
    END IF;
    -- Lot 9 bis (R16, B47, X7) : fin par event_end_from_v2 (M08), même règle que event_end_at (sans fin : début + 6 h)
    v_old_end := public.event_end_from_v2(e.start_date, e.start_time, e.end_date, e.end_time);
    v_new_end := public.event_end_from_v2(n_start_date, n_start_time, n_end_date, n_end_time);
    IF v_dates_changed AND n_end_date IS NOT NULL AND v_new_end <= v_new_start THEN
        RETURN public.event_edit_refusal('EVENT_END_BEFORE_START', 'La fin de l''événement doit être postérieure à son début.',
                                         CASE WHEN n_end_time IS NOT NULL THEN 'end_time' ELSE 'end_date' END);
    END IF;

    PERFORM 1 FROM public.ticket_categories WHERE event_id = v_event ORDER BY id FOR UPDATE;
    v_has_sales := public.event_has_sales(v_event);

    -- Verrouillés dès qu'il y a des ventes : catégorie d'événement, jauge supprimée ou sous vendus + réservés
    IF v_has_sales AND n_category IS DISTINCT FROM e.category THEN
        RETURN public.event_edit_refusal('LOCKED_AFTER_SALES', 'La catégorie de l''événement ne change plus : des billets ont été vendus ou réservés.', 'category');
    END IF;
    IF n_capacity IS DISTINCT FROM e.capacity THEN
        SELECT COALESCE(sum(c.sold_quantity + c.held_quantity), 0)::int,
               COALESCE(sum(c.total_quantity) FILTER (WHERE c.is_active), 0)::int
          INTO v_engaged, v_quota
          FROM public.ticket_categories c WHERE c.event_id = v_event;
        IF v_has_sales AND n_capacity IS NULL THEN
            RETURN public.event_edit_refusal('LOCKED_AFTER_SALES', 'La jauge ne peut plus être supprimée : des billets ont été vendus ou réservés.', 'capacity');
        END IF;
        IF v_has_sales AND n_capacity < v_engaged THEN
            RETURN public.event_edit_refusal('LOCKED_AFTER_SALES',
                format('La jauge ne peut pas descendre sous %s : billets vendus et paiements en cours compris.', v_engaged), 'capacity');
        END IF;
        IF n_capacity IS NOT NULL AND n_capacity < v_quota THEN
            RETURN public.event_edit_refusal('CAPACITY_BELOW_QUOTAS',
                format('La jauge ne peut pas descendre sous la somme des quotas des catégories actives (%s) : baissez d''abord les quotas.', v_quota), 'capacity');
        END IF;
    END IF;

    -- Une fin de vente ne dépasse jamais la fin de l'événement
    IF v_dates_changed THEN
        SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'sale_end', c.sale_end) ORDER BY c.name, c.id),
               string_agg(format('« %s »', c.name), ', ' ORDER BY c.name, c.id)
          INTO v_late, v_late_names
          FROM public.ticket_categories c
         WHERE c.event_id = v_event AND c.sale_end IS NOT NULL AND c.sale_end > v_new_end;
        IF v_late IS NOT NULL THEN
            RETURN public.event_edit_refusal('SALE_END_AFTER_EVENT',
                format('La fin de vente de %s dépasse la nouvelle fin de l''événement : avancez d''abord la fin de vente.', v_late_names),
                CASE WHEN v_patch ? 'end_time' THEN 'end_time' WHEN v_patch ? 'end_date' THEN 'end_date' ELSE 'start_date' END,
                jsonb_build_object('categories', v_late));
        END IF;
        -- Lot 9 bis (R94, B61) : un début de vente précède toujours la fin de l'événement
        SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'sale_start', c.sale_start) ORDER BY c.name, c.id)
          INTO v_late
          FROM public.ticket_categories c
         WHERE c.event_id = v_event AND c.sale_start IS NOT NULL AND c.sale_start >= v_new_end;
        IF v_late IS NOT NULL THEN
            RETURN public.event_edit_refusal('SALE_START_AFTER_EVENT', 'Le début de vente doit précéder la fin de l’événement.',
                CASE WHEN v_patch ? 'end_time' THEN 'end_time' WHEN v_patch ? 'end_date' THEN 'end_date' ELSE 'start_date' END,
                jsonb_build_object('categories', v_late));
        END IF;
    END IF;

    -- Champs notifiés (après publication) : titre, dates et heures, lieu, ville, adresse
    IF v_post THEN
        IF n_title IS DISTINCT FROM e.title THEN
            v_changed := array_append(v_changed, 'title'); v_labels := array_append(v_labels, 'le titre');
        END IF;
        IF n_start_date IS DISTINCT FROM e.start_date OR n_end_date IS DISTINCT FROM e.end_date THEN
            IF n_start_date IS DISTINCT FROM e.start_date THEN v_changed := array_append(v_changed, 'start_date'); END IF;
            IF n_end_date IS DISTINCT FROM e.end_date THEN v_changed := array_append(v_changed, 'end_date'); END IF;
            v_labels := array_append(v_labels, 'la date');
        END IF;
        IF n_start_time IS DISTINCT FROM e.start_time OR n_end_time IS DISTINCT FROM e.end_time THEN
            IF n_start_time IS DISTINCT FROM e.start_time THEN v_changed := array_append(v_changed, 'start_time'); END IF;
            IF n_end_time IS DISTINCT FROM e.end_time THEN v_changed := array_append(v_changed, 'end_time'); END IF;
            v_labels := array_append(v_labels, 'l''horaire');
        END IF;
        IF n_location IS DISTINCT FROM e.location OR n_city IS DISTINCT FROM e.city
           OR NULLIF(btrim(COALESCE(n_practical->>'address', '')), '') IS DISTINCT FROM NULLIF(btrim(COALESCE(e.practical_info->>'address', '')), '') THEN
            IF n_location IS DISTINCT FROM e.location THEN v_changed := array_append(v_changed, 'location'); END IF;
            IF n_city IS DISTINCT FROM e.city THEN v_changed := array_append(v_changed, 'city'); END IF;
            IF NULLIF(btrim(COALESCE(n_practical->>'address', '')), '') IS DISTINCT FROM NULLIF(btrim(COALESCE(e.practical_info->>'address', '')), '') THEN
                v_changed := array_append(v_changed, 'address');
            END IF;
            v_labels := array_append(v_labels, 'le lieu');
        END IF;
        v_sms := EXISTS (SELECT 1 FROM unnest(v_changed) AS f WHERE f <> 'title');
    END IF;
    v_version := e.notify_version + CASE WHEN cardinality(v_changed) > 0 THEN 1 ELSE 0 END;

    UPDATE public.events
       SET title = n_title, category = n_category, description = n_description,
           start_date = n_start_date, start_time = n_start_time, end_date = n_end_date, end_time = n_end_time,
           location = n_location, city = n_city, latitude = n_lat, longitude = n_lng, image_url = n_image,
           capacity = n_capacity, program = n_program, practical_info = n_practical, notify_version = v_version,
           updated_at = now()
     WHERE id = v_event;

    -- Lot 9 bis (R32, B23) : changement de début journalisé ; le droit au remboursement d'un report se mesure depuis
    -- le début en vigueur à l'achat (ticket_postponement_refund_open, M06). Ordre : events NKU → catégories →
    -- event_start_changes (clé étrangère vers l'événement déjà tenu) → boîte d'envoi.
    IF v_start_changed THEN
        INSERT INTO public.event_start_changes (event_id, old_start_at, new_start_at, actor_id)
        VALUES (v_event, v_old_start, v_new_start, v_actor);
    END IF;

    -- Fonds : une fin qui recule repousse la disponibilité des crédits VENTE pas encore disponibles ; jamais d'avancement
    IF v_new_end > v_old_end THEN
        UPDATE public.finance_ledger l
           SET available_at = GREATEST(l.available_at, public.fin_payout_available_at(l.payment_id))
         WHERE l.entry_type = 'VENTE' AND l.available_at > now()
           AND l.payment_id IN (SELECT py.id FROM public.payments py WHERE py.event_id = v_event);
    END IF;

    -- Porteurs prévenus : billets VALIDE (et UTILISE pour un événement de plusieurs jours), comptes non supprimés
    IF cardinality(v_changed) > 0 THEN
        SELECT array_agg(DISTINCT t.user_id) INTO v_holders
          FROM public.tickets t JOIN public.users u ON u.id = t.user_id
         WHERE t.event_id = v_event AND t.user_id IS NOT NULL AND u.status::text <> 'SUPPRIME'
           AND (t.status::text = 'VALIDE'
                OR (t.status::text = 'UTILISE' AND n_end_date IS NOT NULL AND n_end_date > n_start_date));
        v_notified := COALESCE(cardinality(v_holders), 0);
        -- Données du modèle EVENT_CHANGED (valeurs d'après la modification, nouvelles valeurs des champs changés)
        v_data := jsonb_strip_nulls(jsonb_build_object(
            'event_id', v_event, 'title', n_title, 'start_at', v_new_start, 'location', n_location, 'city', n_city,
            'changed_fields', to_jsonb(v_changed),
            'new_start_at', CASE WHEN v_start_changed THEN v_new_start END,
            'new_end_at', CASE WHEN 'end_date' = ANY (v_changed) OR 'end_time' = ANY (v_changed) THEN v_new_end END,
            'new_location', CASE WHEN 'location' = ANY (v_changed) THEN n_location END,
            'new_address', CASE WHEN 'address' = ANY (v_changed) THEN NULLIF(btrim(COALESCE(n_practical->>'address', '')), '') END,
            'new_city', CASE WHEN 'city' = ANY (v_changed) THEN n_city END,
            'old_title', CASE WHEN 'title' = ANY (v_changed) THEN e.title END,
            -- Lot 9 bis (R80) : adresse retirée (variante « adresse retirée, lieu … » du SMS)
            'address_cleared', CASE WHEN 'address' = ANY (v_changed)
                                         AND NULLIF(btrim(COALESCE(n_practical->>'address', '')), '') IS NULL THEN true END));
        -- Lot 9 bis (R80) : à la fusion, une adresse changée de nouveau remplace l'ancienne (posée ou retirée)
        v_drop := ARRAY['migrated_from']
                  || CASE WHEN 'address' = ANY (v_changed) THEN ARRAY['new_address', 'address_cleared'] ELSE ARRAY[]::text[] END;
        -- Lot 9 bis (B71) : SMS dû dans 10 minutes, tout de suite si l'ancien ou le nouveau début est à moins d'une heure
        v_urgent := v_old_start < now() + interval '1 hour' OR v_new_start < now() + interval '1 hour';
        v_due := CASE WHEN v_urgent THEN now() ELSE now() + interval '10 minutes' END;
    END IF;
    IF v_notified > 0 THEN
        FOREACH v_holder IN ARRAY v_holders LOOP
            v_nkey := 'EVENT_CHANGED:' || v_event::text || ':' || v_holder::text || ':v' || v_version::text;
            -- Lot 9 bis (R32, B23) : report qui ouvre le remboursement d'un billet du porteur (règle de M06, lue après
            -- l'écriture du nouveau début et de event_start_changes) → variante « report » du modèle
            v_hdata := v_data || CASE WHEN EXISTS (SELECT 1 FROM public.tickets t
                                                    WHERE t.event_id = v_event AND t.user_id = v_holder
                                                      AND public.ticket_postponement_refund_open(t.id))
                                      THEN jsonb_build_object('refund_open', true) ELSE '{}'::jsonb END;
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                'data', v_hdata, 'channels', jsonb_build_array('IN_APP', 'PUSH')));

            -- SMS regroupé : la ligne en attente du porteur pour cet événement reçoit l'union des champs ; lot 9 bis
            -- (R26, B71) : fenêtre fixe de 10 minutes depuis le premier changement, jamais prolongée, ramenée à
            -- maintenant si un début est à moins d'une heure.
            v_pending_id := NULL;
            SELECT o.id, o.template_data INTO v_pending_id, v_pending_data
              FROM public.notification_outbox o
             WHERE o.event_id = v_event AND o.recipient_user_id = v_holder
               AND o.type = 'EVENT_CHANGED' AND o.channel = 'SMS' AND o.status = 'PENDING'
             ORDER BY o.created_at, o.id
             LIMIT 1
               FOR UPDATE;
            IF v_pending_id IS NOT NULL THEN
                UPDATE public.notification_outbox
                   SET template_data = (v_pending_data - v_drop - 'refund_open') || v_hdata || jsonb_build_object('changed_fields', (
                           SELECT COALESCE(jsonb_agg(f ORDER BY f), '[]'::jsonb)
                             FROM (SELECT jsonb_array_elements_text(COALESCE(v_pending_data->'changed_fields', '[]'::jsonb)) AS f
                                   UNION
                                   SELECT unnest(v_changed)) x)),
                       due_at = CASE WHEN v_urgent THEN LEAST(due_at, now()) ELSE due_at END,
                       next_attempt_at = CASE WHEN v_urgent THEN LEAST(next_attempt_at, now()) ELSE next_attempt_at END
                 WHERE id = v_pending_id;
                IF v_sms THEN
                    v_sms_queued := v_sms_queued + 1;
                END IF;
            END IF;
            IF v_sms AND v_pending_id IS NULL THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                    'data', v_hdata, 'channels', jsonb_build_array('SMS'), 'due_at', v_due));
                IF EXISTS (SELECT 1 FROM public.notification_outbox o
                            WHERE o.idempotency_key = v_nkey || ':SMS' AND o.status = 'PENDING') THEN
                    v_sms_queued := v_sms_queued + 1;
                END IF;
            ELSIF NOT v_sms THEN
                -- Titre seul : aucun SMS, trace SKIPPED (le SMS déjà en attente porte le nouveau titre)
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                    'data', v_hdata, 'channels', jsonb_build_array('SMS'),
                    'skip', jsonb_build_object('SMS', 'TITLE_ONLY')));
            END IF;

            -- Lot 9 bis (G.49, B97, B71) : email du changement au compte, dû à 10 minutes et fusionné comme le SMS
            -- (index uq_outbox_event_change_pending_email) ; titre seul : fusion seulement, aucune ligne nouvelle.
            v_pending_id := NULL;
            SELECT o.id, o.template_data INTO v_pending_id, v_pending_data
              FROM public.notification_outbox o
             WHERE o.event_id = v_event AND o.recipient_user_id = v_holder
               AND o.type = 'EVENT_CHANGED' AND o.channel = 'EMAIL' AND o.status = 'PENDING'
             ORDER BY o.created_at, o.id
             LIMIT 1
               FOR UPDATE;
            IF v_pending_id IS NOT NULL THEN
                UPDATE public.notification_outbox
                   SET template_data = (v_pending_data - v_drop - 'refund_open') || v_hdata || jsonb_build_object('changed_fields', (
                           SELECT COALESCE(jsonb_agg(f ORDER BY f), '[]'::jsonb)
                             FROM (SELECT jsonb_array_elements_text(COALESCE(v_pending_data->'changed_fields', '[]'::jsonb)) AS f
                                   UNION
                                   SELECT unnest(v_changed)) x)),
                       due_at = CASE WHEN v_urgent THEN LEAST(due_at, now()) ELSE due_at END,
                       next_attempt_at = CASE WHEN v_urgent THEN LEAST(next_attempt_at, now()) ELSE next_attempt_at END
                 WHERE id = v_pending_id;
            ELSIF v_sms THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                    'data', v_hdata, 'channels', jsonb_build_array('EMAIL'), 'due_at', v_due));
            END IF;
        END LOOP;
    END IF;

    -- Lot 9 bis (R12, B69) : numéros sans compte (invitations non réclamées, acheteurs au guichet), mêmes statuts de
    -- billet que les porteurs ; un SMS par numéro, fusionné par numéro ; numéros des porteurs prévenus retirés.
    IF cardinality(v_changed) > 0 THEN
        FOR n IN
            SELECT x.phone, (array_agg(x.ticket_id ORDER BY x.ticket_id))[1] AS ticket_id
              FROM (SELECT tr.to_phone_or_email AS phone, t.id AS ticket_id
                      FROM public.ticket_transfers tr
                      JOIN public.tickets t ON t.id = tr.ticket_id
                     WHERE t.event_id = v_event AND tr.status::text = 'PENDING' AND tr.from_user_id IS NULL
                       AND t.user_id IS NULL AND t.status::text = 'VALIDE'
                    UNION ALL
                    SELECT '+221' || py.payer_phone, t.id
                      FROM public.tickets t
                      JOIN public.payments py ON py.id = t.payment_id
                     WHERE t.event_id = v_event AND t.sale_channel::text = 'COUNTER' AND NOT py.is_platform_payment
                       AND py.payer_phone ~ '^7[05678][0-9]{7}$'
                       AND (t.status::text = 'VALIDE'
                            OR (t.status::text = 'UTILISE' AND n_end_date IS NOT NULL AND n_end_date > n_start_date))) x
             WHERE x.phone ~ '^\+221[0-9]{9}$'
               AND NOT EXISTS (SELECT 1 FROM public.users u
                                WHERE u.id = ANY (COALESCE(v_holders, ARRAY[]::uuid[])) AND u.phone IN (x.phone, substr(x.phone, 2)))
             GROUP BY x.phone
             ORDER BY x.phone
        LOOP
            v_phones := v_phones + 1;
            v_pending_id := NULL;
            SELECT o.id, o.template_data INTO v_pending_id, v_pending_data
              FROM public.notification_outbox o
             WHERE o.event_id = v_event AND o.recipient_phone = n.phone AND o.recipient_user_id IS NULL
               AND o.type = 'EVENT_CHANGED' AND o.channel = 'SMS' AND o.status = 'PENDING'
             ORDER BY o.created_at, o.id
             LIMIT 1
               FOR UPDATE;
            IF v_pending_id IS NOT NULL THEN
                UPDATE public.notification_outbox
                   SET template_data = (v_pending_data - v_drop) || v_data || jsonb_build_object(
                           'recipient_kind', 'PHONE', 'ticket_id', n.ticket_id, 'changed_fields', (
                           SELECT COALESCE(jsonb_agg(f ORDER BY f), '[]'::jsonb)
                             FROM (SELECT jsonb_array_elements_text(COALESCE(v_pending_data->'changed_fields', '[]'::jsonb)) AS f
                                   UNION
                                   SELECT unnest(v_changed)) x)),
                       due_at = CASE WHEN v_urgent THEN LEAST(due_at, now()) ELSE due_at END,
                       next_attempt_at = CASE WHEN v_urgent THEN LEAST(next_attempt_at, now()) ELSE next_attempt_at END
                 WHERE id = v_pending_id;
                IF v_sms THEN
                    v_sms_queued := v_sms_queued + 1;
                END IF;
            ELSIF v_sms THEN
                v_nkey := 'EVENT_CHANGED:' || v_event::text || ':t' || n.ticket_id::text || ':v' || v_version::text;
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'phone', n.phone, 'event_id', v_event,
                    'data', v_data || jsonb_build_object('recipient_kind', 'PHONE', 'ticket_id', n.ticket_id),
                    'channels', jsonb_build_array('SMS'), 'due_at', v_due));
                IF EXISTS (SELECT 1 FROM public.notification_outbox o
                            WHERE o.idempotency_key = v_nkey || ':SMS' AND o.status = 'PENDING') THEN
                    v_sms_queued := v_sms_queued + 1;
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- Lot 9 bis (R33, B72) : contrôleurs affectés (affectations acceptées) prévenus d'un changement de date ou de lieu :
    -- in-app tout de suite ; SMS et email dus dans 10 minutes, fusionnés comme EVENT_CHANGED (ligne en attente du
    -- contrôleur, index uq_outbox_controller_change_pending_sms pour le SMS) ; titre seul : fusion seulement.
    IF cardinality(v_changed) > 0 THEN
        FOR n IN
            SELECT ec.user_id FROM public.event_controllers ec WHERE ec.event_id = v_event ORDER BY ec.user_id
        LOOP
            v_nkey := 'CONTROLLER_EVENT_CHANGED:' || v_event::text || ':' || n.user_id::text || ':v' || v_version::text;
            IF v_sms THEN
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'CONTROLLER_EVENT_CHANGED', 'key', v_nkey, 'user_id', n.user_id, 'event_id', v_event,
                    'data', v_data, 'channels', jsonb_build_array('IN_APP')));
            END IF;
            FOREACH v_ch IN ARRAY ARRAY['SMS', 'EMAIL'] LOOP
                v_pending_id := NULL;
                SELECT o.id, o.template_data INTO v_pending_id, v_pending_data
                  FROM public.notification_outbox o
                 WHERE o.event_id = v_event AND o.recipient_user_id = n.user_id
                   AND o.type = 'CONTROLLER_EVENT_CHANGED' AND o.channel = v_ch AND o.status = 'PENDING'
                 ORDER BY o.created_at, o.id
                 LIMIT 1
                   FOR UPDATE;
                IF v_pending_id IS NOT NULL THEN
                    UPDATE public.notification_outbox
                       SET template_data = (v_pending_data - v_drop) || v_data || jsonb_build_object('changed_fields', (
                               SELECT COALESCE(jsonb_agg(f ORDER BY f), '[]'::jsonb)
                                 FROM (SELECT jsonb_array_elements_text(COALESCE(v_pending_data->'changed_fields', '[]'::jsonb)) AS f
                                       UNION
                                       SELECT unnest(v_changed)) x)),
                           due_at = CASE WHEN v_urgent THEN LEAST(due_at, now()) ELSE due_at END,
                           next_attempt_at = CASE WHEN v_urgent THEN LEAST(next_attempt_at, now()) ELSE next_attempt_at END
                     WHERE id = v_pending_id;
                ELSIF v_sms THEN
                    PERFORM public.notif_enqueue(jsonb_build_object(
                        'type', 'CONTROLLER_EVENT_CHANGED', 'key', v_nkey, 'user_id', n.user_id, 'event_id', v_event,
                        'data', v_data, 'channels', jsonb_build_array(v_ch), 'due_at', v_due));
                END IF;
            END LOOP;
        END LOOP;
    END IF;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, 'PARTENAIRE', CASE WHEN v_post THEN 'EVENT_LIVE_UPDATED' ELSE 'EVENT_UPDATED' END, 'EVENT', v_event,
            jsonb_build_object('status', e.status::text,
                               'fields', (SELECT COALESCE(jsonb_agg(k ORDER BY k), '[]'::jsonb) FROM jsonb_object_keys(v_patch) AS k),
                               'notified_fields', to_jsonb(v_changed), 'notified_holders', v_notified, 'notified_phones', v_phones,
                               'sms_queued', v_sms_queued, 'end_moved_later', v_new_end > v_old_end));

    SELECT to_jsonb(ev) INTO v_row FROM public.events ev WHERE ev.id = v_event;
    RETURN jsonb_build_object('ok', true, 'event', v_row, 'notified_holders', v_notified, 'notified_phones', v_phones,
                              'sms_queued', v_sms_queued, 'changed_fields', to_jsonb(v_changed));
END;
$$;

REVOKE ALL ON FUNCTION public.event_update(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_update(jsonb) TO service_role;


-- ============================================================================
-- 3. notif_cancel_on_status (recopie de 20261103000004_lot6_rappels.sql:215-237)
-- Tâche 33 (R33) : à ANNULE ou TERMINE, le changement en attente d'un contrôleur (CONTROLLER_EVENT_CHANGED) est
-- annulé comme celui des porteurs. Trigger trg_notif_cancel_on_status inchangé.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notif_cancel_on_status()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.notification_outbox
       SET status = 'CANCELLED', reason = 'EVENT_' || NEW.new_status::text, finished_at = now()
     WHERE event_id = NEW.event_id
       AND status = 'PENDING'
       AND type IN ('REMINDER_J1', 'REMINDER_H3', 'CONTROLLER_REMINDER');
    IF NEW.new_status::text IN ('ANNULE', 'TERMINE') THEN
        UPDATE public.notification_outbox
           SET status = 'CANCELLED', reason = 'NO_LONGER_RELEVANT', finished_at = now()
         WHERE event_id = NEW.event_id
           AND status = 'PENDING'
           AND type IN ('EVENT_CHANGED', 'CONTROLLER_EVENT_CHANGED');
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notif_cancel_on_status() FROM PUBLIC, anon, authenticated;


-- ============================================================================
-- 4. ticket_invitation_cancel (recopie de 20261108000002_lot9_invitations.sql:504-574)
-- p = { actor_id, event_id, ticket_id }. Mêmes droits que la création, statut de l'événement non contrôlé.
-- Billet ANNULE, transferts PENDING annulés, stock rendu, audit.
-- La catégorie est prise en NO KEY UPDATE : un scan tient son billet et prend KEY SHARE sur la catégorie (3.3).
-- Tâche 34 (R22, B73 ; renverse L11 du lot 9) : TICKET_CANCELLED (kind INVITATION, clé TICKET_CANCELLED:<billet>)
-- au porteur (canaux du registre : in-app, SMS, email), sinon par SMS au numéro de l'invitation non réclamée, lu sous
-- le verrou avant la révocation ; aucun numéro dans les données ni dans l'audit (u5). Verrous inchangés.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ticket_invitation_cancel(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_ticket uuid := public.try_uuid(p->>'ticket_id');
    a record;
    v_role text;
    v_ticket_event uuid;
    v_channel text;
    v_category uuid;
    v_status text;
    v_holder uuid;
    v_phone text;
BEGIN
    IF v_actor IS NULL OR v_event IS NULL OR v_ticket IS NULL THEN
        RETURN public.pilotage_refusal('INVALID_INPUT');
    END IF;

    PERFORM 1 FROM public.events e WHERE e.id = v_event FOR SHARE;
    IF NOT FOUND THEN
        RETURN public.pilotage_refusal('EVENT_NOT_FOUND');
    END IF;

    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    -- Reste S3 (R2, B30) : event_actor_profile n'appelle plus « staff » qu'un admin muni d'events.write ; un admin
    -- sans cette permission garde le refus 403 FORBIDDEN du lot 9 (invitations-annulation:261), jamais un 404.
    IF NOT (a.is_owner OR a.is_staff)
       AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
        RETURN public.pilotage_refusal('EVENT_NOT_FOUND');
    END IF;
    IF NOT a.is_active THEN
        RETURN public.pilotage_refusal('ACCOUNT_NOT_ACTIVE');
    END IF;
    IF NOT a.is_owner
       AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN')
       AND NOT EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = v_actor AND ap.permission = 'events.write') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit d’annuler les invitations de cet événement.');
    END IF;
    v_role := CASE WHEN a.is_owner THEN 'PARTENAIRE' ELSE 'ADMIN' END;

    -- Catégorie et événement d'un billet ne changent jamais : la lecture sans verrou suffit
    SELECT t.event_id, t.sale_channel, t.category_id INTO v_ticket_event, v_channel, v_category
      FROM public.tickets t WHERE t.id = v_ticket;
    IF NOT FOUND OR v_ticket_event <> v_event OR v_channel <> 'INVITATION' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_FOUND', 'message', 'Invitation introuvable.');
    END IF;

    PERFORM 1 FROM public.ticket_categories c WHERE c.id = v_category FOR NO KEY UPDATE;
    PERFORM 1 FROM public.ticket_transfers x WHERE x.ticket_id = v_ticket AND x.status = 'PENDING' FOR UPDATE;
    SELECT t.status::text, t.user_id INTO v_status, v_holder FROM public.tickets t WHERE t.id = v_ticket FOR UPDATE;

    IF v_status = 'UTILISE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_ALREADY_USED', 'message', 'Ce billet a déjà été scanné : l’invitation ne peut plus être annulée.');
    END IF;
    IF v_status <> 'VALIDE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'TICKET_NOT_CANCELLABLE', 'message', 'Cette invitation ne peut plus être annulée.');
    END IF;

    -- Lot 9 bis (R22) : invitation non réclamée, son numéro est lu avant la révocation du transfert
    IF v_holder IS NULL THEN
        SELECT x.to_phone_or_email INTO v_phone
          FROM public.ticket_transfers x
         WHERE x.ticket_id = v_ticket AND x.status = 'PENDING' AND x.to_phone_or_email ~ '^\+221[0-9]{9}$'
         ORDER BY x.created_at DESC, x.id
         LIMIT 1;
    END IF;

    UPDATE public.ticket_transfers SET status = 'CANCELLED', cancelled_at = now()
     WHERE ticket_id = v_ticket AND status = 'PENDING';
    UPDATE public.tickets SET status = 'ANNULE', transfer_locked = FALSE, updated_at = now() WHERE id = v_ticket;
    UPDATE public.ticket_categories SET sold_quantity = sold_quantity - 1 WHERE id = v_category;

    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, v_role, 'TICKET_INVITATION_CANCELLED', 'tickets', v_ticket,
            jsonb_build_object('event_id', v_event, 'category_id', v_category));

    -- Lot 9 bis (R22, B73) : avis au porteur, sinon au numéro de l'invitation (SMS seul, aucun compte)
    IF v_holder IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'TICKET_CANCELLED', 'key', 'TICKET_CANCELLED:' || v_ticket::text,
            'user_id', v_holder, 'event_id', v_event,
            'data', COALESCE(public.notif_event_data(v_event), '{}'::jsonb)
                    || jsonb_build_object('kind', 'INVITATION', 'ticket_id', v_ticket)));
    ELSIF v_phone IS NOT NULL THEN
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'TICKET_CANCELLED', 'key', 'TICKET_CANCELLED:' || v_ticket::text,
            'phone', v_phone, 'event_id', v_event, 'channels', jsonb_build_array('SMS'),
            'data', COALESCE(public.notif_event_data(v_event), '{}'::jsonb)
                    || jsonb_build_object('kind', 'INVITATION', 'ticket_id', v_ticket)));
    END IF;

    RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_invitation_cancel(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_invitation_cancel(jsonb) TO service_role;


-- ============================================================================
-- 5. notif_events_admin_change_alert (nouvelle, trigger trg_events_admin_change_alert) — tâche 36 (R18, B76)
-- Après validation (VALIDE, PUBLIE, SUSPENDU), un titre, une affiche, un lieu (lieu, ville, adresse) ou une date
-- (début, fin) réellement changés : ADMIN_EVENT_CHANGED aux admins events.read (in-app, email), données `changes`
-- (TITLE, POSTER, PLACE, DATE), ancien titre, société. Clé ADMIN_EVENT_CHANGED:<event>:tx<transaction>:<admin> :
-- une alerte par enregistrement. Une colonne citée par UPDATE mais inchangée (event_update réécrit toutes les
-- colonnes) ne compte pas : comparaison OLD / NEW.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notif_events_admin_change_alert()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_changes text[] := ARRAY[]::text[];
    v_company text;
BEGIN
    IF NEW.status::text NOT IN ('VALIDE', 'PUBLIE', 'SUSPENDU') THEN
        RETURN NULL;
    END IF;
    IF NEW.title IS DISTINCT FROM OLD.title THEN
        v_changes := array_append(v_changes, 'TITLE');
    END IF;
    IF NEW.image_url IS DISTINCT FROM OLD.image_url THEN
        v_changes := array_append(v_changes, 'POSTER');
    END IF;
    IF NEW.location IS DISTINCT FROM OLD.location OR NEW.city IS DISTINCT FROM OLD.city
       OR NULLIF(btrim(COALESCE(NEW.practical_info->>'address', '')), '') IS DISTINCT FROM NULLIF(btrim(COALESCE(OLD.practical_info->>'address', '')), '') THEN
        v_changes := array_append(v_changes, 'PLACE');
    END IF;
    IF NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.start_time IS DISTINCT FROM OLD.start_time
       OR NEW.end_date IS DISTINCT FROM OLD.end_date OR NEW.end_time IS DISTINCT FROM OLD.end_time THEN
        v_changes := array_append(v_changes, 'DATE');
    END IF;
    IF cardinality(v_changes) = 0 THEN
        RETURN NULL;
    END IF;
    SELECT pa.company_name INTO v_company FROM public.partners pa WHERE pa.id = NEW.partner_id;
    PERFORM public.notif_enqueue_admins(jsonb_build_object(
        'type', 'ADMIN_EVENT_CHANGED', 'ref', NEW.id::text || ':tx' || txid_current()::text, 'event_id', NEW.id,
        'data', COALESCE(public.notif_event_data(NEW.id), '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
            'changes', to_jsonb(v_changes),
            'old_title', CASE WHEN 'TITLE' = ANY (v_changes) THEN OLD.title END,
            'company', v_company))));
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notif_events_admin_change_alert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_events_admin_change_alert ON public.events;
CREATE TRIGGER trg_events_admin_change_alert
    AFTER UPDATE OF title, image_url, location, city, practical_info, start_date, start_time, end_date, end_time ON public.events
    FOR EACH ROW
    WHEN (NEW.status::text IN ('VALIDE', 'PUBLIE', 'SUSPENDU'))
    EXECUTE FUNCTION public.notif_events_admin_change_alert();


-- ============================================================================
-- 6. notif_ticket_categories_admin_alert (nouvelle, trigger trg_ticket_categories_admin_alert) — tâche 36 (R18)
-- Catégorie ajoutée à un événement VALIDE, PUBLIE ou SUSPENDU : ADMIN_EVENT_CHANGED (changes CATEGORY, nom de la
-- catégorie) aux admins events.read ; clé ADMIN_EVENT_CHANGED:<event>:cat<catégorie>:<admin>. event_create insère
-- ses catégories sur un BROUILLON : aucune alerte.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notif_ticket_categories_admin_alert()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status text;
    v_company text;
BEGIN
    SELECT e.status::text, pa.company_name INTO v_status, v_company
      FROM public.events e LEFT JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = NEW.event_id;
    IF v_status IS NULL OR v_status NOT IN ('VALIDE', 'PUBLIE', 'SUSPENDU') THEN
        RETURN NULL;
    END IF;
    PERFORM public.notif_enqueue_admins(jsonb_build_object(
        'type', 'ADMIN_EVENT_CHANGED', 'ref', NEW.event_id::text || ':cat' || NEW.id::text, 'event_id', NEW.event_id,
        'data', COALESCE(public.notif_event_data(NEW.event_id), '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
            'changes', jsonb_build_array('CATEGORY'), 'category', NEW.name, 'company', v_company))));
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notif_ticket_categories_admin_alert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ticket_categories_admin_alert ON public.ticket_categories;
CREATE TRIGGER trg_ticket_categories_admin_alert
    AFTER INSERT ON public.ticket_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.notif_ticket_categories_admin_alert();


-- ============================================================================
-- 7. notif_controller_shifts_report_ready (nouvelle, trigger trg_controller_shifts_report_ready) — tâche 37 (R72)
-- La dernière caisse ouverte d'un événement TERMINE se ferme (OUVERT → CLOTURE ou LITIGE) : CLOSING_REPORT_READY à
-- la propriétaire, une fois (clé CLOSING_REPORT_READY:<event>). Deux clôtures concurrentes : verrou consultatif par
-- événement pris avant le comptage, la seconde voit la première validée (READ COMMITTED, nouvelle image par
-- instruction) ; aucune n'est perdue, la clé empêche le double.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notif_controller_shifts_report_ready()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status text;
    v_owner uuid;
BEGIN
    SELECT e.status::text, pa.user_id INTO v_status, v_owner
      FROM public.events e JOIN public.partners pa ON pa.id = e.partner_id
     WHERE e.id = NEW.event_id;
    IF v_status IS DISTINCT FROM 'TERMINE' OR v_owner IS NULL THEN
        RETURN NULL;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('notif.closing_report_ready:' || NEW.event_id::text));
    IF EXISTS (SELECT 1 FROM public.controller_shifts s WHERE s.event_id = NEW.event_id AND s.status = 'OUVERT') THEN
        RETURN NULL;
    END IF;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'CLOSING_REPORT_READY', 'key', 'CLOSING_REPORT_READY:' || NEW.event_id::text,
        'user_id', v_owner, 'event_id', NEW.event_id,
        'data', COALESCE(public.notif_event_data(NEW.event_id), '{}'::jsonb)));
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notif_controller_shifts_report_ready() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_controller_shifts_report_ready ON public.controller_shifts;
CREATE TRIGGER trg_controller_shifts_report_ready
    AFTER UPDATE OF status ON public.controller_shifts
    FOR EACH ROW
    WHEN (OLD.status = 'OUVERT' AND NEW.status IS DISTINCT FROM 'OUVERT')
    EXECUTE FUNCTION public.notif_controller_shifts_report_ready();


-- ============================================================================
-- 8. notification_daily_checks (recopie de 20261105000002_lot7_sms.sql:449-516)
-- Tâche 37 (R72, B77) : FUNDS_AVAILABLE à la propriétaire d'un événement TERMINE fini depuis moins de 30 jours dont
-- toutes les ventes (écritures VENTE du compte ORGANISATEUR) sont disponibles à `now` ; une fois (clé
-- FUNDS_AVAILABLE:<event>), 100 événements au plus par passage, sans montant. Un événement SUSPENDU n'est jamais
-- TERMINE : ses fonds gelés (B14) ne sont pas annoncés ; partenaire suspendue : politique BLOCK du type.
-- Tâche 38 (R31, B81) : essential_today = SMS indispensables du jour (SENDING, SENT, UNCERTAIN ; file et journaux
-- synchrones ; COALESCE(claimed_at, sent_at, finished_at), index idx_outbox_sms_essential_day de M03) ; au seuil
-- notif.sms_essential_daily_alert, ADMIN_SMS_DAILY_THRESHOLD aux admins notifications.read et signal
-- SMS_DAILY_THRESHOLD, une fois par jour.
-- ============================================================================
-- sms_today : SMS du jour de Dakar de v_now, lignes SMS SENT ou UNCERTAIN (journaux OTP compris), inchangé.
-- optional_today : SMS optionnels réservés du jour (notif_sms_optional_used, même compteur que le budget).
-- Alerte ADMIN_SMS_OPTIONAL_80 (in-app, email) aux admins notifications.read et signal SMS_OPTIONAL_80 quand
-- optional_today ≥ ceil(0,8 × plafond), une seule fois par jour ; plafond 0 ou absent : ni seuil ni alerte.
CREATE OR REPLACE FUNCTION public.notification_daily_checks(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now       timestamptz;
    v_day       date;
    v_day_txt   text;
    v_start     timestamptz;
    v_count     integer;
    v_cap       integer;
    v_used      integer;
    v_threshold integer;
    v_prefix    text;
    v_first     uuid;
    v_n         integer;
    v_alerted   boolean := false;
    v_funds     integer := 0;
    v_essential integer;
    v_essential_threshold integer;
    v_essential_alerted boolean := false;
    f           record;
BEGIN
    v_now := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    IF v_now < now() - interval '1 minute' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_NOW',
            'message', 'Horloge refusée : une heure dans le passé n''est jamais acceptée.');
    END IF;
    v_day := (v_now AT TIME ZONE 'Africa/Dakar')::date;
    v_day_txt := to_char(v_day, 'YYYY-MM-DD');
    v_start := v_day::timestamp AT TIME ZONE 'Africa/Dakar';

    SELECT count(*)::integer INTO v_count
      FROM public.notification_outbox o
     WHERE o.channel = 'SMS' AND o.status IN ('SENT', 'UNCERTAIN')
       AND COALESCE(o.sent_at, o.finished_at) >= v_start
       AND COALESCE(o.sent_at, o.finished_at) < v_start + interval '1 day';

    v_cap := public.notif_setting_int('notif.sms_optional_daily_cap');
    v_used := public.notif_sms_optional_used(v_day);
    IF v_cap IS NOT NULL AND v_cap > 0 THEN
        v_threshold := ceil((v_cap * 8)::numeric / 10)::integer;
    END IF;

    IF v_threshold IS NOT NULL AND v_used >= v_threshold THEN
        PERFORM pg_advisory_xact_lock(hashtext('notif.sms_optional_80:' || v_day_txt));
        v_prefix := 'ADMIN_SMS_OPTIONAL_80:' || v_day_txt || ':';
        IF NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                        WHERE o.type = 'ADMIN_SMS_OPTIONAL_80'
                          AND left(o.idempotency_key, length(v_prefix)) = v_prefix) THEN
            v_n := public.notif_enqueue_admins(jsonb_build_object(
                'type', 'ADMIN_SMS_OPTIONAL_80', 'ref', v_day_txt,
                'data', jsonb_build_object('day', v_day_txt, 'used', v_used, 'cap', v_cap, 'threshold', v_threshold,
                                           'percent', (100 * v_used::bigint / v_cap)::integer),
                'now', v_now));
            IF v_n > 0 THEN
                SELECT o.id INTO v_first
                  FROM public.notification_outbox o
                 WHERE o.type = 'ADMIN_SMS_OPTIONAL_80' AND left(o.idempotency_key, length(v_prefix)) = v_prefix
                 ORDER BY o.created_at, o.id LIMIT 1;
                INSERT INTO public.admin_signals (kind, ref_id) VALUES ('SMS_OPTIONAL_80', v_first) ON CONFLICT DO NOTHING;
                v_alerted := true;
            END IF;
        END IF;
    END IF;

    -- Lot 9 bis (R31, B81) : SMS indispensables du jour (file et journaux synchrones ; réservés, envoyés ou incertains),
    -- alerte ADMIN_SMS_DAILY_THRESHOLD aux admins notifications.read et signal SMS_DAILY_THRESHOLD au seuil réglable
    -- notif.sms_essential_daily_alert, une seule fois par jour (verrou et préfixe de clé du jour).
    SELECT count(*)::integer INTO v_essential
      FROM public.notification_outbox o
     WHERE o.channel = 'SMS' AND o.family = 'ESSENTIAL' AND o.status IN ('SENDING', 'SENT', 'UNCERTAIN')
       AND COALESCE(o.claimed_at, o.sent_at, o.finished_at) >= v_start
       AND COALESCE(o.claimed_at, o.sent_at, o.finished_at) < v_start + interval '1 day';
    v_essential_threshold := public.notif_setting_int('notif.sms_essential_daily_alert');
    IF v_essential_threshold IS NOT NULL AND v_essential_threshold > 0 AND v_essential >= v_essential_threshold THEN
        PERFORM pg_advisory_xact_lock(hashtext('notif.sms_essential_daily_alert:' || v_day_txt));
        v_prefix := 'ADMIN_SMS_DAILY_THRESHOLD:' || v_day_txt || ':';
        IF NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                        WHERE o.type = 'ADMIN_SMS_DAILY_THRESHOLD'
                          AND left(o.idempotency_key, length(v_prefix)) = v_prefix) THEN
            v_n := public.notif_enqueue_admins(jsonb_build_object(
                'type', 'ADMIN_SMS_DAILY_THRESHOLD', 'ref', v_day_txt,
                'data', jsonb_build_object('day', v_day_txt, 'count', v_essential, 'threshold', v_essential_threshold),
                'now', v_now));
            IF v_n > 0 THEN
                SELECT o.id INTO v_first
                  FROM public.notification_outbox o
                 WHERE o.type = 'ADMIN_SMS_DAILY_THRESHOLD' AND left(o.idempotency_key, length(v_prefix)) = v_prefix
                 ORDER BY o.created_at, o.id LIMIT 1;
                INSERT INTO public.admin_signals (kind, ref_id) VALUES ('SMS_DAILY_THRESHOLD', v_first) ON CONFLICT DO NOTHING;
                v_essential_alerted := true;
            END IF;
        END IF;
    END IF;

    -- Lot 9 bis (R72, B77) : recettes disponibles d'un événement terminé, une fois par événement
    FOR f IN
        SELECT e.id, pa.user_id AS owner_id
          FROM public.events e
          JOIN public.partners pa ON pa.id = e.partner_id
         WHERE e.status::text = 'TERMINE' AND pa.user_id IS NOT NULL
           AND public.event_end_at(e.id) > v_now - interval '30 days'
           AND EXISTS (SELECT 1 FROM public.finance_ledger l
                        WHERE l.event_id = e.id AND l.owner_id = pa.user_id AND l.account_kind = 'ORGANISATEUR'
                          AND l.entry_type = 'VENTE')
           AND NOT EXISTS (SELECT 1 FROM public.finance_ledger l
                            WHERE l.event_id = e.id AND l.owner_id = pa.user_id AND l.account_kind = 'ORGANISATEUR'
                              AND l.entry_type = 'VENTE' AND l.available_at > v_now)
           AND NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                            WHERE o.idempotency_key = 'FUNDS_AVAILABLE:' || e.id::text || ':IN_APP')
         ORDER BY e.id
         LIMIT 100
    LOOP
        v_funds := v_funds + public.notif_enqueue(jsonb_build_object(
            'type', 'FUNDS_AVAILABLE', 'key', 'FUNDS_AVAILABLE:' || f.id::text,
            'user_id', f.owner_id, 'event_id', f.id,
            'data', COALESCE(public.notif_event_data(f.id), '{}'::jsonb), 'now', v_now));
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'day', v_day_txt, 'sms_today', v_count,
        'optional_today', v_used, 'optional_cap', v_cap, 'optional_threshold', v_threshold, 'alerted', v_alerted,
        'essential_today', v_essential, 'essential_threshold', v_essential_threshold, 'essential_alerted', v_essential_alerted,
        'funds_available', v_funds);
END;
$$;

REVOKE ALL ON FUNCTION public.notification_daily_checks(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_daily_checks(jsonb) TO service_role;


-- ============================================================================
-- 9. ticket_invitation_create (recopie de 20261108000002_lot9_invitations.sql:348-495)
-- p = { actor_id, event_id, category_id, phones[], quantity, limits: { per_event_hour, per_phone_day } }.
-- Droits : propriétaire, SUPERADMIN, ou ADMIN avec events.write (lu sur user_roles et admin_permissions, L15).
-- Quotas réservés après les droits et le stock (AR15), dans la même transaction : un refus ne consomme rien.
-- Réponse identique avec ou sans compte (L7). SMS sans actor_id ni user_id (AR15).
-- Tâche 37 (R79, B78 ; renverse L10 du lot 9) : billet attribué à un compte vérifié → INVITATION_RECEIVED aussi en
-- in-app et push au compte (même clé, lignes distinctes par canal) ; la ligne SMS reste au numéro, sans compte ni
-- acteur (AR15). Verrous inchangés.
-- Tâche 49 (G.49, délégation, S-G) : la ligne du compte vérifié passe aussi par email.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ticket_invitation_create(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := public.try_uuid(p->>'actor_id');
    v_event uuid := public.try_uuid(p->>'event_id');
    v_category uuid := public.try_uuid(p->>'category_id');
    v_phones text[];
    v_quantity integer;
    v_per_event integer;
    v_per_phone integer;
    v_total integer;
    v_status text;
    a record;
    v_role text;
    v_category_name text;
    v_problems jsonb;
    v_rules jsonb;
    v_quota jsonb;
    v_end timestamptz;
    v_data jsonb;
    v_phone text;
    v_account uuid;
    v_new uuid[];
    v_masked text[] := ARRAY[]::text[];
BEGIN
    -- Étape 1 : forme (le chemin normal passe d'abord par Zod)
    IF v_actor IS NULL OR v_event IS NULL OR v_category IS NULL
       OR jsonb_typeof(p->'phones') IS DISTINCT FROM 'array'
       OR COALESCE(p->>'quantity', '') !~ '^[1-4]$'
       OR COALESCE(p->'limits'->>'per_event_hour', '') !~ '^[0-9]{1,9}$'
       OR COALESCE(p->'limits'->>'per_phone_day', '') !~ '^[0-9]{1,9}$' THEN
        RETURN public.pilotage_refusal('INVALID_INPUT');
    END IF;
    v_phones := ARRAY(SELECT jsonb_array_elements_text(p->'phones'));
    IF cardinality(v_phones) NOT BETWEEN 1 AND 10
       OR EXISTS (SELECT 1 FROM unnest(v_phones) AS x WHERE x IS NULL OR x !~ '^\+2217[05678][0-9]{7}$')
       OR (SELECT count(DISTINCT x) FROM unnest(v_phones) AS x) <> cardinality(v_phones) THEN
        RETURN public.pilotage_refusal('INVALID_INPUT');
    END IF;
    v_quantity := (p->>'quantity')::integer;
    v_per_event := (p->'limits'->>'per_event_hour')::integer;
    v_per_phone := (p->'limits'->>'per_phone_day')::integer;
    v_total := cardinality(v_phones) * v_quantity;

    -- Étape 2 : événement verrouillé (FOR SHARE : event_cancel et event_update attendent)
    SELECT e.status::text INTO v_status FROM public.events e WHERE e.id = v_event FOR SHARE;
    IF NOT FOUND THEN
        RETURN public.pilotage_refusal('EVENT_NOT_FOUND');
    END IF;

    -- Étape 3 : droits
    SELECT * INTO a FROM public.event_actor_profile(v_event, v_actor);
    -- Reste S3 (R2, B30) : event_actor_profile n'appelle plus « staff » qu'un admin muni d'events.write ; un admin
    -- sans cette permission garde le refus 403 FORBIDDEN du lot 9 (invitations:190), jamais un 404.
    IF NOT (a.is_owner OR a.is_staff)
       AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text IN ('ADMIN', 'SUPERADMIN')) THEN
        RETURN public.pilotage_refusal('EVENT_NOT_FOUND');
    END IF;
    IF NOT a.is_active THEN
        RETURN public.pilotage_refusal('ACCOUNT_NOT_ACTIVE');
    END IF;
    IF NOT a.is_owner
       AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_actor AND r.role::text = 'SUPERADMIN')
       AND NOT EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = v_actor AND ap.permission = 'events.write') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Vous n’avez pas le droit d’envoyer des invitations pour cet événement.');
    END IF;
    v_role := CASE WHEN a.is_owner THEN 'PARTENAIRE' ELSE 'ADMIN' END;

    -- Étape 4 : statut, lu sous le verrou
    IF v_status NOT IN ('PUBLIE', 'VALIDE') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'EVENT_NOT_ACTIVE', 'message', 'Cet événement n’accepte pas d’invitations pour le moment.');
    END IF;

    -- Étape 5 : catégorie de cet événement ; absente, l'étape 6 rend CATEGORY_NOT_FOUND
    SELECT c.name INTO v_category_name FROM public.ticket_categories c
     WHERE c.id = v_category AND c.event_id = v_event FOR UPDATE;

    -- Étape 6 : contrôles de vente en liste blanche, toute catégorie étant admise quels que soient ses canaux
    SELECT COALESCE(jsonb_agg(s.problem ORDER BY s.ord), '[]'::jsonb) INTO v_problems
      FROM jsonb_array_elements(public.ticket_sale_problems(v_event,
               jsonb_build_array(jsonb_build_object('category_id', v_category, 'quantity', v_total)))) WITH ORDINALITY AS s(problem, ord)
     WHERE s.problem->>'code' IN ('INVALID_ITEMS', 'EVENT_NOT_FOUND', 'CATEGORY_NOT_FOUND', 'INVALID_QUANTITY',
                                  'CATEGORY_INACTIVE', 'EVENT_PAST', 'INSUFFICIENT_STOCK');
    IF jsonb_array_length(v_problems) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SALE_CHECK_FAILED', 'message', 'Ces invitations ne peuvent pas être envoyées.', 'problems', v_problems);
    END IF;

    -- Étape 7 : quotas, tout ou rien ; une règle événement et une règle numéro par numéro (L4)
    SELECT jsonb_agg(q.rule) INTO v_rules
      FROM (SELECT jsonb_build_object('scope', 'invitation_event', 'bucket', v_event::text, 'window_secs', 3600, 'max', v_per_event) AS rule
              FROM unnest(v_phones)
            UNION ALL
            SELECT jsonb_build_object('scope', 'invitation_phone', 'bucket', x, 'window_secs', 86400, 'max', v_per_phone)
              FROM unnest(v_phones) AS x) q;
    v_quota := public.quota_reserve(v_rules);
    IF NOT COALESCE((v_quota->>'allowed')::boolean, false) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'QUOTA_EXCEEDED', 'message', 'Limite d’invitations atteinte. Réessayez plus tard.',
                                  'scope', v_quota->>'scope', 'retry_after_seconds', (v_quota->>'retry_after_seconds')::integer);
    END IF;

    -- Étape 8 : stock, puis billets numéro par numéro
    UPDATE public.ticket_categories SET sold_quantity = sold_quantity + v_total WHERE id = v_category;
    v_end := public.event_end_at(v_event);
    v_data := COALESCE(public.notif_event_data(v_event), '{}'::jsonb);

    FOREACH v_phone IN ARRAY v_phones LOOP
        SELECT u.id INTO v_account
          FROM public.users u
         WHERE u.phone = v_phone AND public.ticket_transfer_identity(v_phone, u.id) = 'MATCH'
         ORDER BY u.id
         LIMIT 1;

        WITH ins AS (
            INSERT INTO public.tickets (event_id, category_id, user_id, ticket_number, price, qr_code, status, sale_channel, transfer_locked)
            SELECT v_event, v_category, v_account,
                   'TCK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
                   0, 'EV-QR-' || replace(gen_random_uuid()::text, '-', ''), 'VALIDE', 'INVITATION', v_account IS NULL
              FROM generate_series(1, v_quantity)
            RETURNING id
        )
        SELECT array_agg(id ORDER BY id) INTO v_new FROM ins;

        IF v_account IS NULL THEN
            INSERT INTO public.ticket_transfers (ticket_id, from_user_id, to_phone_or_email, status, claim_token_hash, expires_at)
            SELECT x, NULL, v_phone, 'PENDING', NULL, v_end FROM unnest(v_new) AS x;
        END IF;

        -- Étape 9 : un SMS par numéro, sans actor_id ni user_id (AR15), hors quota par compte
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'INVITATION_RECEIVED', 'key', 'INVITATION_RECEIVED:' || v_new[1]::text,
            'phone', v_phone, 'event_id', v_event,
            'data', v_data || jsonb_build_object('ticket_count', v_quantity, 'ticket_id', v_new[1]),
            'channels', jsonb_build_array('SMS')));
        -- Lot 9 bis (R79, B78 ; G.49, B97) : billets attribués à un compte vérifié → in-app, push et email au compte,
        -- sans acteur
        IF v_account IS NOT NULL THEN
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'INVITATION_RECEIVED', 'key', 'INVITATION_RECEIVED:' || v_new[1]::text,
                'user_id', v_account, 'event_id', v_event,
                'data', v_data || jsonb_build_object('ticket_count', v_quantity, 'ticket_id', v_new[1]),
                'channels', jsonb_build_array('IN_APP', 'PUSH', 'EMAIL')));
        END IF;

        v_masked := v_masked || ('+221***' || right(v_phone, 2));
    END LOOP;

    -- Étape 10 : audit, numéros masqués
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (v_actor, v_role, 'TICKET_INVITATIONS_SENT', 'events', v_event,
            jsonb_build_object('category_id', v_category, 'category', v_category_name, 'phone_count', cardinality(v_phones),
                               'ticket_count', v_total, 'quantity', v_quantity, 'phones_masked', to_jsonb(v_masked)));

    RETURN jsonb_build_object('ok', true, 'ticket_count', v_total, 'phone_count', cardinality(v_phones));
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_invitation_create(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_invitation_create(jsonb) TO service_role;


-- ============================================================================
-- 10. notif_tickets_scanned (recopie de 20261103000005_lot6_billetterie.sql:866-887)
-- Billet contrôlé à l'entrée (ticket_scan, ticket_cash_checkin) : avis au porteur.
-- Tâche 37 (R78, B79) : avis regroupés par commande (même porteur, même événement, même paiement, ou sans paiement),
-- dus à maintenant + 2 minutes : la ligne IN_APP en attente du groupe est prise FOR UPDATE et ses lignes en attente
-- (IN_APP, PUSH, EMAIL) comptent le billet (ticket_count) ; sinon un groupe neuf (clé TICKET_SCANNED:<premier billet>,
-- ticket_count 1, payment_id). Verrous : billet (déjà tenu par le scan) → boîte d'envoi (3.3). Trigger inchangé.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notif_tickets_scanned()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group text;
    v_count integer;
BEGIN
    SELECT o.group_key,
           CASE WHEN o.template_data->>'ticket_count' ~ '^[0-9]{1,6}$' THEN (o.template_data->>'ticket_count')::integer ELSE 1 END
      INTO v_group, v_count
      FROM public.notification_outbox o
     WHERE o.type = 'TICKET_SCANNED' AND o.channel = 'IN_APP' AND o.status = 'PENDING'
       AND o.recipient_user_id = NEW.user_id AND o.event_id = NEW.event_id
       AND (o.template_data->>'payment_id') IS NOT DISTINCT FROM NEW.payment_id::text
     ORDER BY o.created_at, o.id
     LIMIT 1
       FOR UPDATE;
    IF v_group IS NOT NULL THEN
        UPDATE public.notification_outbox
           SET template_data = jsonb_set(template_data, '{ticket_count}', to_jsonb(v_count + 1))
         WHERE group_key = v_group AND type = 'TICKET_SCANNED' AND status = 'PENDING';
        RETURN NULL;
    END IF;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'TICKET_SCANNED', 'key', 'TICKET_SCANNED:' || NEW.id::text,
        'user_id', NEW.user_id, 'event_id', NEW.event_id, 'due_at', now() + interval '2 minutes',
        'data', COALESCE(public.notif_event_data(NEW.event_id), '{}'::jsonb)
                || jsonb_strip_nulls(jsonb_build_object('ticket_id', NEW.id, 'payment_id', NEW.payment_id, 'ticket_count', 1))));
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notif_tickets_scanned() FROM PUBLIC, anon, authenticated;


-- ============================================================================
-- 11. notif_on_password_changed (recopie de 20261103000006_lot6_pros_admin.sql:923-950)
-- Mot de passe défini ou modifié (réinitialisation par le navigateur, profil du contrôleur, activation d'un
-- contrôleur) : trigger sur auth.users. Clé : compte et instant de la modification.
-- Tâche 38 (R29, B80) : aucun avis à l'activation d'un compte coquille de contrôleur (la même écriture pose le mot
-- de passe et retire le marqueur is_temporary_controller_account, après le code reçu par SMS) ; toute pose
-- ultérieure reste prévenue. Trigger on_auth_user_password_changed inchangé.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notif_on_password_changed()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.id) THEN
        RETURN NEW;
    END IF;
    -- Lot 9 bis (R29) : activation du compte coquille, aucune alerte de sécurité
    IF COALESCE(OLD.raw_user_meta_data->>'is_temporary_controller_account', '') = 'true'
       AND COALESCE(NEW.raw_user_meta_data->>'is_temporary_controller_account', '') <> 'true' THEN
        RETURN NEW;
    END IF;
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'PASSWORD_CHANGED',
        'key', 'PASSWORD_CHANGED:' || NEW.id::text || ':'
               || COALESCE(floor(extract(epoch FROM NEW.updated_at) * 1000000)::bigint::text, 'tx' || txid_current()::text),
        'user_id', NEW.id,
        'data', '{}'::jsonb
    ));
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notif_on_password_changed() FROM PUBLIC, anon, authenticated;
