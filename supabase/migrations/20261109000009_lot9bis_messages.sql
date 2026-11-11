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
        IF v_owner IS NOT NULL THEN
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
        IF v_owner IS NOT NULL THEN
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
    END IF;
    -- → TERMINE : aucun avis (les rappels en attente sont annulés par trg_notif_cancel_on_status).
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
    v_old_end := public.event_end_from(e.start_date, e.end_date, e.end_time);
    v_new_end := public.event_end_from(n_start_date, n_end_date, n_end_time);
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
            'old_title', CASE WHEN 'title' = ANY (v_changed) THEN e.title END));
        -- Lot 9 bis (B71) : SMS dû dans 10 minutes, tout de suite si l'ancien ou le nouveau début est à moins d'une heure
        v_urgent := v_old_start < now() + interval '1 hour' OR v_new_start < now() + interval '1 hour';
        v_due := CASE WHEN v_urgent THEN now() ELSE now() + interval '10 minutes' END;
    END IF;
    IF v_notified > 0 THEN
        FOREACH v_holder IN ARRAY v_holders LOOP
            v_nkey := 'EVENT_CHANGED:' || v_event::text || ':' || v_holder::text || ':v' || v_version::text;
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                'data', v_data, 'channels', jsonb_build_array('IN_APP', 'PUSH')));

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
                   SET template_data = (v_pending_data - 'migrated_from') || v_data || jsonb_build_object('changed_fields', (
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
                    'data', v_data, 'channels', jsonb_build_array('SMS'), 'due_at', v_due));
                IF EXISTS (SELECT 1 FROM public.notification_outbox o
                            WHERE o.idempotency_key = v_nkey || ':SMS' AND o.status = 'PENDING') THEN
                    v_sms_queued := v_sms_queued + 1;
                END IF;
            ELSIF NOT v_sms THEN
                -- Titre seul : aucun SMS, trace SKIPPED (le SMS déjà en attente porte le nouveau titre)
                PERFORM public.notif_enqueue(jsonb_build_object(
                    'type', 'EVENT_CHANGED', 'key', v_nkey, 'user_id', v_holder, 'event_id', v_event,
                    'data', v_data, 'channels', jsonb_build_array('SMS'),
                    'skip', jsonb_build_object('SMS', 'TITLE_ONLY')));
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
                   SET template_data = (v_pending_data - 'migrated_from') || v_data || jsonb_build_object(
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
                       SET template_data = v_pending_data || v_data || jsonb_build_object('changed_fields', (
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
    IF NOT (a.is_owner OR a.is_staff) THEN
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
