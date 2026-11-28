-- ============================================================================
-- EVENT VILLAGE — LOT « AVIS », PHASE 2, SOUS-LOT 2d : administrateurs regroupés (écarts B8, B9, B10 de docs/avis-inventaire.md)
-- ============================================================================
--  B8  produits à vérifier (ADMIN_PRODUCT_REVIEW, ADMIN_PRODUCTS_REVIEW_BATCH) : + notification du téléphone ; les produits
--      entrent dans le SMS regroupé des validations (ADMIN_REVIEW_SMS, au plus un toutes les 30 minutes par administrateur,
--      reporté la nuit) : nouvelle sorte PRODUCT_REVIEW comptée dans product_count (un lot de N produits compte N) ;
--  B9  argent à vérifier : UN SMS regroupé par heure et par administrateur (ADMIN_MONEY_SMS, nouveau, reporté la nuit),
--      alimenté par un déclencheur nouveau sur la boîte d'envoi à chaque alerte (ligne de cloche en attente) :
--      versements à reprendre (ADMIN_REFUND_TO_RETRY, ADMIN_CASHOUT_TO_RESUME, ADMIN_WITHDRAWAL_REJECTED), incertains
--      (ADMIN_CASHOUT_UNCERTAIN), doubles paiements (ADMIN_DUPLICATE_PAYMENT), créances (ADMIN_FINANCE_DEBT) ; aucune
--      fonction d'argent recopiée (notif_cashouts_notify : 9 définitions, suivie par les audits). Le SMS
--      ADMIN_ORDER_REFUND_BLOCKED est fondu dedans : le remboursement bloqué d'une commande est déjà compté par son alerte
--      ADMIN_REFUND_TO_RETRY ou ADMIN_CASHOUT_UNCERTAIN ; sa ligne SMS reste écrite, sautée (GROUPED_ADMIN_SMS), jamais
--      deux SMS ; notification ajoutée à ADMIN_WITHDRAWAL_REJECTED et ADMIN_FINANCE_DEBT ;
--  B10 plafonds de SMS atteints (ADMIN_SMS_CAP_GLOBAL, _NON_OTP, _NEW_NUMBERS) : + notification seulement (décision D4 :
--      jamais de SMS, le plafond le bloquerait).
-- Recopies (ajouts seuls) :
--  - notif_admin_review_sms, de 20261126000004_l10b_cv_correctifs.sql:317-421 (sorte PRODUCT_REVIEW, compte « count ») ;
--  - private.order_product_review_notify, de 20261224000001_l12c_verification.sql:441-467 (SMS regroupé) ;
--  - private.order_review_batch_done, de 20261224000005_l12c_cv_correctifs.sql:54-75 (SMS regroupé, N produits) ;
--  - private.order_refund_blocked_notify, de 20261224000005_l12c_cv_correctifs.sql:469-503 (SMS sauté, fondu).
-- Droits : fonctions private fermées à tous les rôles de l'API ; notif_admin_review_sms inchangée (CREATE OR REPLACE).
-- Sans BEGIN ni COMMIT, rejouable.
-- ============================================================================

-- 1. Registre
INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission, night_policy) VALUES
    ('ADMIN_MONEY_SMS', 'ESSENTIAL', NULL, ARRAY['SMS'], 'ADMIN', 'BLOCK', FALSE, NULL, 'DEFER')
ON CONFLICT (type) DO UPDATE SET
    family = EXCLUDED.family, topic = EXCLUDED.topic, channels = EXCLUDED.channels, audience = EXCLUDED.audience,
    suspended_policy = EXCLUDED.suspended_policy, sync_only = EXCLUDED.sync_only, admin_permission = EXCLUDED.admin_permission,
    night_policy = EXCLUDED.night_policy;
UPDATE public.notification_types SET channels = ARRAY['IN_APP','EMAIL','PUSH']
 WHERE type IN ('ADMIN_PRODUCT_REVIEW', 'ADMIN_PRODUCTS_REVIEW_BATCH', 'ADMIN_WITHDRAWAL_REJECTED', 'ADMIN_FINANCE_DEBT',
                'ADMIN_SMS_CAP_GLOBAL', 'ADMIN_SMS_CAP_NON_OTP', 'ADMIN_SMS_CAP_NEW_NUMBERS');

-- 2. notif_admin_review_sms (recopie de 20261126000004_l10b_cv_correctifs.sql:317-421)
CREATE OR REPLACE FUNCTION public.notif_admin_review_sms(p jsonb)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_kind    text := btrim(COALESCE(p->>'kind', ''));
    -- Lot 10b : salle envoyée en validation (HALL_SUBMITTED), comptée à part (hall_count), même droit que les établissements
    v_is_hall boolean := btrim(COALESCE(p->>'kind', '')) IN ('HALL_SUBMITTED', 'HALL_CHANGED');
    -- Contre-vérification du lot 10b (T6) : salle validée modifiée (HALL_CHANGED), comptée dans hall_changed_count
    v_changed boolean := btrim(COALESCE(p->>'kind', '')) = 'HALL_CHANGED';
    v_ref     text := NULLIF(btrim(COALESCE(p->>'ref', '')), '');
    v_company text := NULLIF(btrim(COALESCE(p->>'company', '')), '');
    v_now     timestamptz := COALESCE(NULLIF(p->>'now', '')::timestamptz, now());
    v_perm    text;
    v_only    uuid[];
    v_admin   uuid;
    v_row     record;
    v_last    timestamptz;
    v_due     timestamptz;
    v_data    jsonb;
    v_refs    jsonb;
    v_touched integer := 0;
    -- Avis phase 2 (2d, B8) : produit « à vérifier » (PRODUCT_REVIEW), droit partners.validate, compté dans product_count ;
    -- un lot de produits compte « count » (revue groupée : order_review_batch_done)
    v_is_product boolean := btrim(COALESCE(p->>'kind', '')) = 'PRODUCT_REVIEW';
    v_products   integer := CASE WHEN btrim(COALESCE(p->>'kind', '')) = 'PRODUCT_REVIEW'
                                 THEN GREATEST(COALESCE(NULLIF(p->>'count', '')::integer, 1), 1) ELSE 0 END;
BEGIN
    -- Lot 10b : une salle suit le chemin d'un établissement (même droit), comptée à part
    IF v_is_hall THEN
        v_kind := 'VENUE_SUBMITTED';
    END IF;
    -- Lot 11a : établissement soumis à la validation (VENUE_SUBMITTED, droit partners.validate)
    -- Avis phase 2 (2d, B8) : la sorte PRODUCT_REVIEW est acceptée en plus des quatre sortes connues
    IF NOT v_is_product THEN
    IF v_kind NOT IN ('PARTNER_NEW', 'PARTNER_RESUBMITTED', 'EVENT_SUBMITTED', 'VENUE_SUBMITTED') THEN
        RAISE EXCEPTION USING ERRCODE = 'NT004', MESSAGE = format('Élément à valider inconnu : %s.', COALESCE(NULLIF(v_kind, ''), '(vide)'));
    END IF;
    END IF;
    IF v_ref IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'NT004', MESSAGE = 'Référence de l''élément à valider absente.';
    END IF;
    IF v_now < now() - interval '1 minute' THEN
        RAISE EXCEPTION USING ERRCODE = 'NT003', MESSAGE = 'Horloge refusée : une heure dans le passé n''est jamais acceptée.';
    END IF;
    v_perm := CASE WHEN v_kind = 'EVENT_SUBMITTED' THEN 'events.write' ELSE 'partners.validate' END;
    -- Lot 10b : établissements et salles prévenus aux administrateurs qui ont halls.validate
    IF v_kind = 'VENUE_SUBMITTED' THEN
        v_perm := 'halls.validate';
    END IF;
    IF jsonb_typeof(p->'only_admin_ids') = 'array' THEN
        v_only := ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(p->'only_admin_ids') AS x);
    END IF;

    FOR v_admin IN
        SELECT x.admin_id FROM public.notif_admin_recipients(v_perm) AS x(admin_id)
         WHERE v_only IS NULL OR x.admin_id = ANY (v_only)
         ORDER BY x.admin_id
    LOOP
        PERFORM pg_advisory_xact_lock(hashtext('notif.admin_review_sms:' || v_admin::text));

        SELECT o.id, o.template_data INTO v_row
          FROM public.notification_outbox o
         WHERE o.type = 'ADMIN_REVIEW_SMS' AND o.channel = 'SMS' AND o.recipient_user_id = v_admin AND o.status = 'PENDING'
         ORDER BY o.due_at, o.id
         LIMIT 1
           FOR UPDATE;

        IF FOUND THEN
            v_refs := COALESCE(v_row.template_data->'refs', '[]'::jsonb);
            IF NOT (v_refs ? v_ref) THEN
                v_data := jsonb_build_object(
                    'partner_count', COALESCE((v_row.template_data->>'partner_count')::integer, 0) + CASE WHEN v_kind IN ('PARTNER_NEW', 'PARTNER_RESUBMITTED') THEN 1 ELSE 0 END,
                    'venue_count', COALESCE((v_row.template_data->>'venue_count')::integer, 0) + CASE WHEN v_kind = 'VENUE_SUBMITTED' AND NOT v_is_hall THEN 1 ELSE 0 END,
                    'hall_count', COALESCE((v_row.template_data->>'hall_count')::integer, 0) + CASE WHEN v_is_hall AND NOT v_changed THEN 1 ELSE 0 END,
                    'hall_changed_count', COALESCE((v_row.template_data->>'hall_changed_count')::integer, 0) + CASE WHEN v_changed THEN 1 ELSE 0 END,
                    'event_count', COALESCE((v_row.template_data->>'event_count')::integer, 0) + CASE WHEN v_kind = 'EVENT_SUBMITTED' THEN 1 ELSE 0 END,
                    -- Avis phase 2 (2d, B8) : produits à vérifier
                    'product_count', COALESCE((v_row.template_data->>'product_count')::integer, 0) + v_products,
                    'refs', v_refs || to_jsonb(v_ref)
                );
                UPDATE public.notification_outbox SET template_data = v_data WHERE id = v_row.id;
            END IF;
        ELSE
            SELECT max(COALESCE(o.sent_at, o.claimed_at, o.finished_at)) INTO v_last
              FROM public.notification_outbox o
             WHERE o.type = 'ADMIN_REVIEW_SMS' AND o.channel = 'SMS' AND o.recipient_user_id = v_admin
               AND o.status IN ('SENDING', 'SENT', 'UNCERTAIN');
            v_due := public.notif_admin_review_due(GREATEST(v_now, COALESCE(v_last + interval '30 minutes', v_now)));
            v_data := jsonb_strip_nulls(jsonb_build_object(
                'partner_count', CASE WHEN v_kind IN ('PARTNER_NEW', 'PARTNER_RESUBMITTED') THEN 1 ELSE 0 END,
                'venue_count', CASE WHEN v_kind = 'VENUE_SUBMITTED' AND NOT v_is_hall THEN 1 ELSE 0 END,
                'hall_count', CASE WHEN v_is_hall AND NOT v_changed THEN 1 ELSE 0 END,
                'hall_changed_count', CASE WHEN v_changed THEN 1 ELSE 0 END,
                'event_count', CASE WHEN v_kind = 'EVENT_SUBMITTED' THEN 1 ELSE 0 END,
                -- Avis phase 2 (2d, B8) : produits à vérifier
                'product_count', v_products,
                'company', CASE WHEN v_kind = 'PARTNER_NEW' THEN COALESCE(v_company, 'Une structure') END,
                'refs', jsonb_build_array(v_ref)
            ));
            PERFORM public.notif_enqueue(jsonb_build_object(
                'type', 'ADMIN_REVIEW_SMS',
                'key', 'ADMIN_REVIEW_SMS:' || v_admin::text || ':' || gen_random_uuid()::text,
                'user_id', v_admin,
                'data', v_data,
                'due_at', v_due,
                'now', v_now
            ));
        END IF;
        v_touched := v_touched + 1;
    END LOOP;
    RETURN v_touched;
END;
$$;

-- 3. private.order_product_review_notify (recopie de 20261224000001_l12c_verification.sql:441-467)
CREATE OR REPLACE FUNCTION private.order_product_review_notify(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r record;
BEGIN
    SELECT pr.id, pr.name, pr.review_words, pr.review_requested_at, v.name AS venue_name,
           COALESCE(pa.commercial_name, pa.company_name) AS company
      INTO r
      FROM public.products pr JOIN public.partners pa ON pa.id = pr.partner_id
      LEFT JOIN public.venues v ON v.id = pr.venue_id
     WHERE pr.id = p_product_id AND pr.review_state IS NOT NULL;
    IF NOT FOUND THEN
        RETURN;
    END IF;
    PERFORM public.notif_enqueue_admins(jsonb_build_object(
        'type', 'ADMIN_PRODUCT_REVIEW',
        'ref', r.id::text || ':' || to_char(r.review_requested_at, 'YYYYMMDDHH24MISSUS'),
        'data', jsonb_strip_nulls(jsonb_build_object(
            'product_id', r.id, 'product_name', r.name, 'venue_name', r.venue_name, 'company', r.company,
            'words', to_jsonb(r.review_words)))));
    -- Avis phase 2 (2d, B8) : le produit entre dans le SMS regroupé des validations (même référence que l'alerte)
    PERFORM public.notif_admin_review_sms(jsonb_build_object(
        'kind', 'PRODUCT_REVIEW', 'ref', 'PRODUCT:' || r.id::text || ':' || to_char(r.review_requested_at, 'YYYYMMDDHH24MISSUS')));
END;
$$;
REVOKE ALL ON FUNCTION private.order_product_review_notify(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 4. private.order_review_batch_done (recopie de 20261224000005_l12c_cv_correctifs.sql:54-75)
CREATE OR REPLACE FUNCTION private.order_review_batch_done(p_count integer, p_origin text, p_actor uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF COALESCE(p_count, 0) <= 0 THEN
        RETURN 0;
    END IF;
    INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
    VALUES (p_actor, CASE WHEN p_actor IS NULL THEN 'SYSTEM' WHEN p_origin = 'CATEGORIE' THEN 'PARTENAIRE' ELSE 'SUPERADMIN' END,
            'PRODUCT_REVIEW_BACKFILL', 'products', NULL,
            jsonb_build_object('count', p_count, 'origin', p_origin));
    PERFORM public.notif_enqueue_admins(jsonb_build_object(
        'type', 'ADMIN_PRODUCTS_REVIEW_BATCH',
        'ref', p_origin || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'),
        'data', jsonb_build_object('count', p_count, 'origin', p_origin)));
    -- Avis phase 2 (2d, B8) : les N produits du lot entrent dans le SMS regroupé des validations
    PERFORM public.notif_admin_review_sms(jsonb_build_object(
        'kind', 'PRODUCT_REVIEW', 'count', p_count,
        'ref', 'PRODUCTS:' || p_origin || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS')));
    RETURN p_count;
END;
$$;
REVOKE ALL ON FUNCTION private.order_review_batch_done(integer, text, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 5. private.order_refund_blocked_notify (recopie de 20261224000005_l12c_cv_correctifs.sql:469-503)
CREATE OR REPLACE FUNCTION private.order_refund_blocked_notify()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_number text;
    v_state  text;
    -- Avis phase 2 (2d, B9) : SMS fondu dans ADMIN_MONEY_SMS
    v_admin  uuid;
BEGIN
    IF NEW.kind <> 'REFUND' OR NEW.payment_id IS NULL THEN
        RETURN NULL;
    END IF;
    v_state := CASE
        WHEN NEW.status = 'ECHOUE' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'ECHOUE') THEN 'ECHOUE'
        WHEN NEW.status = 'INCERTAIN' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'INCERTAIN') THEN 'INCERTAIN'
        WHEN NEW.status = 'A_ENVOYER' AND NEW.blocked_reason IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.blocked_reason IS NULL) THEN 'BLOQUE'
    END;
    IF v_state IS NULL THEN
        RETURN NULL;
    END IF;
    SELECT o.order_number INTO v_number
      FROM public.payments p JOIN public.orders o ON o.id = p.order_id
     WHERE p.id = NEW.payment_id AND o.venue_id IS NOT NULL;
    IF v_number IS NULL THEN
        RETURN NULL;
    END IF;
    -- Avis phase 2 (2d, B9) : ce remboursement bloqué est déjà compté dans le SMS regroupé « argent à vérifier » (par son
    -- alerte ADMIN_REFUND_TO_RETRY ou ADMIN_CASHOUT_UNCERTAIN) : la ligne SMS de chaque administrateur est d'abord écrite,
    -- sautée (GROUPED_ADMIN_SMS) ; l'appel qui suit garde la trace et n'ajoute aucun SMS (même clé, ON CONFLICT DO NOTHING)
    FOR v_admin IN
        SELECT x.admin_id FROM public.notif_admin_recipients(
                   (SELECT t.admin_permission FROM public.notification_types t WHERE t.type = 'ADMIN_ORDER_REFUND_BLOCKED')) AS x(admin_id)
    LOOP
        PERFORM public.notif_enqueue(jsonb_build_object(
            'type', 'ADMIN_ORDER_REFUND_BLOCKED',
            'key', 'ADMIN_ORDER_REFUND_BLOCKED:' || NEW.id::text || ':' || COALESCE(NEW.attempt_count, 0)::text || ':' || v_state || ':' || v_admin::text,
            'user_id', v_admin,
            'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'order_number', v_number, 'cashout_status', v_state),
            'skip', jsonb_build_object('SMS', 'GROUPED_ADMIN_SMS')));
    END LOOP;
    PERFORM public.notif_enqueue_admins(jsonb_build_object(
        'type', 'ADMIN_ORDER_REFUND_BLOCKED',
        'ref', NEW.id::text || ':' || COALESCE(NEW.attempt_count, 0)::text || ':' || v_state,
        'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'order_number', v_number, 'cashout_status', v_state)));
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.order_refund_blocked_notify() FROM PUBLIC, anon, authenticated, service_role;

-- 6. B9 : SMS regroupé « argent à vérifier », un par heure et par administrateur
CREATE OR REPLACE FUNCTION private.notif_admin_money_sms(p_admin uuid, p_kind text, p_ref text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row  record;
    v_last timestamptz;
    v_refs jsonb;
    v_key  text;
BEGIN
    IF p_admin IS NULL OR p_ref IS NULL OR p_kind NOT IN ('RESUME', 'UNCERTAIN', 'DUPLICATE', 'DEBT') THEN
        RETURN;
    END IF;
    v_key := CASE p_kind WHEN 'RESUME' THEN 'resume_count' WHEN 'UNCERTAIN' THEN 'uncertain_count'
                         WHEN 'DUPLICATE' THEN 'duplicate_count' ELSE 'debt_count' END;
    PERFORM pg_advisory_xact_lock(hashtext('notif.admin_money_sms:' || p_admin::text));
    SELECT o.id, o.template_data INTO v_row
      FROM public.notification_outbox o
     WHERE o.type = 'ADMIN_MONEY_SMS' AND o.channel = 'SMS' AND o.recipient_user_id = p_admin AND o.status = 'PENDING'
     ORDER BY o.due_at, o.id
     LIMIT 1
       FOR UPDATE;
    IF FOUND THEN
        v_refs := COALESCE(v_row.template_data->'refs', '[]'::jsonb);
        IF NOT (v_refs ? p_ref) THEN
            UPDATE public.notification_outbox
               SET template_data = v_row.template_data
                                   || jsonb_build_object(v_key, COALESCE((v_row.template_data->>v_key)::integer, 0) + 1, 'refs', v_refs || to_jsonb(p_ref))
             WHERE id = v_row.id;
        END IF;
        RETURN;
    END IF;
    -- Un SMS par heure au plus : échéance une heure après le dernier parti (ou réservé)
    SELECT max(COALESCE(o.sent_at, o.claimed_at, o.finished_at)) INTO v_last
      FROM public.notification_outbox o
     WHERE o.type = 'ADMIN_MONEY_SMS' AND o.channel = 'SMS' AND o.recipient_user_id = p_admin
       AND o.status IN ('SENDING', 'SENT', 'UNCERTAIN');
    PERFORM public.notif_enqueue(jsonb_build_object(
        'type', 'ADMIN_MONEY_SMS',
        'key', 'ADMIN_MONEY_SMS:' || p_admin::text || ':' || gen_random_uuid()::text,
        'user_id', p_admin,
        'due_at', GREATEST(now(), COALESCE(v_last + interval '1 hour', now())),
        'data', jsonb_build_object('resume_count', 0, 'uncertain_count', 0, 'duplicate_count', 0, 'debt_count', 0, 'refs', jsonb_build_array(p_ref))
                || jsonb_build_object(v_key, 1)));
END;
$$;
REVOKE ALL ON FUNCTION private.notif_admin_money_sms(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Alerte d'argent écrite dans la cloche d'un administrateur (ligne en attente) → son SMS regroupé la compte
CREATE OR REPLACE FUNCTION private.notif_admin_money_on_alert()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM private.notif_admin_money_sms(
        NEW.recipient_user_id,
        CASE NEW.type
            WHEN 'ADMIN_CASHOUT_UNCERTAIN' THEN 'UNCERTAIN'
            WHEN 'ADMIN_DUPLICATE_PAYMENT' THEN 'DUPLICATE'
            WHEN 'ADMIN_FINANCE_DEBT' THEN 'DEBT'
            ELSE 'RESUME' END,
        NEW.group_key);
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.notif_admin_money_on_alert() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_outbox_admin_money_sms ON public.notification_outbox;
CREATE TRIGGER trg_outbox_admin_money_sms
    AFTER INSERT ON public.notification_outbox
    FOR EACH ROW
    WHEN (NEW.channel = 'IN_APP' AND NEW.status = 'PENDING' AND NEW.recipient_user_id IS NOT NULL
          AND NEW.type IN ('ADMIN_REFUND_TO_RETRY', 'ADMIN_CASHOUT_TO_RESUME', 'ADMIN_WITHDRAWAL_REJECTED', 'ADMIN_CASHOUT_UNCERTAIN',
                           'ADMIN_DUPLICATE_PAYMENT', 'ADMIN_FINANCE_DEBT'))
    EXECUTE FUNCTION private.notif_admin_money_on_alert();
