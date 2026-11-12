/**
 * Lot 9 ter (contrat section 6) — invariants du lot, vérifiés à la fin de chaque suite nouvelle du lot 9 ter qui
 * écrit, de migration-lot9ter-rejouable et, dans le commit fix(9t.seed) seulement, du seed de démonstration et de la
 * recette, par une requête SQL sur TOUTE la base LOCALE (lecture seule). Règles x1 à x13 :
 *  (x1, x2)  0.1 : aucune colonne sensible écrivable par anon ou authenticated ; aucune écriture REST dans public ;
 *  (x3, x4)  0.3 : « non versé » constaté par un SUPERADMIN dans la même transaction ; jamais de renvoi automatique ;
 *  (x5)      0.5 : toute affectation a son lien partenaire–contrôleur ;
 *  (x6)      0.2 : le détenteur actuel d'un billet transféré remboursé est prévenu, lui seul ;
 *  (x7)      R106 a : aucun VALIDE fini après le cron, tout ended_unpublished est TERMINE et invisible du public ;
 *  (x8, x9)  zones : entrée par une porte d'entrée, un contrôle de zone ne composte jamais ;
 *  (x10)     catégorie active d'un événement à zones admise par au moins une zone d'entrée ;
 *  (x11)     liste des invités cohérente ; (x12) aucun numéro ni nom d'invité en clair ;
 *  (x13)     résumé public du stock juste (lignes présentes seulement, X30).
 *
 * Ordre de assertLot9terInvariants(label) : (a) à (v) et (w1) à (w21) par assertLot9bisInvariants (cron de fin et
 * envoyeur compris), contrôle du schéma du lot (échec explicite qui nomme chaque objet absent ; jamais d'erreur
 * Postgres brute, jamais de faux vert), puis (x). Sortie brute `[INVARIANT-LOT9TER]` (filtrée par
 * e2e/support/parcours.ts sur « [INVARIANT »).
 *
 * lot9bis-invariants.ts et les aides plus anciennes ne changent pas : les suites existantes gardent leur comportement
 * au run « avant ». Une suite annoncée verte dès l'écriture appelle assertLot9bisInvariants : assertLot9terInvariants
 * échoue tant que les migrations 20261110000001 à …11 ne sont pas toutes livrées (garde de schéma, rouge jusqu'à 11).
 * seed-demo et invariants-run ne passent à cette aide que dans le commit fix(9t.seed).
 */
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { inspect } from './db';
import { assertLot9bisInvariants } from './lot9bis-invariants';
import type { RecetteViolation } from './recette-invariants';

/**
 * Requête des invariants (contrat 6.1 à 6.5, SQL recopié tel quel, X4 : colonnes `regle`, `objet`, `detail`) : lignes
 * triées par règle puis objet. `x1_cols` et `x6_concerned` sont des CTE d'appui, jamais dans l'union.
 */
export const LOT9TER_INVARIANT_SQL = `
WITH
-- (x1) 0.1 : aucune colonne sensible écrivable par anon ou authenticated (droit de colonne ET politique PERMISSIVE
--      INSERT, UPDATE ou ALL qui s'applique au rôle). Catalogue seul ; majore sans faux vert (expressions non analysées).
x1_cols AS (
    SELECT c.oid AS relid, c.relname::text AS relname, a.attname::text AS attname
      FROM pg_class c
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
     WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
       AND (a.attname = ANY (ARRAY['id', 'status', 'role', 'referral_status', 'user_id', 'partner_id', 'client_id', 'sponsor_id',
                                   'referred_id', 'controller_id', 'created_by', 'granted_by', 'processed_by', 'reviewed_by',
                                   'checked_in_by', 'event_id', 'category_id', 'ticket_id', 'payment_id', 'order_id', 'hall_id',
                                   'table_id', 'zone_id', 'product_id', 'price', 'amount', 'is_verified', 'is_founder', 'is_featured',
                                   'featured_until', 'is_active', 'is_visible', 'sale_online', 'sale_counter', 'subscription_plan_id',
                                   'trial_started_at', 'trial_ends_at', 'resubmitted_at', 'rejection_reason', 'suspended_reason',
                                   'phone_verified', 'phone_verified_at', 'email_verified_at', 'email_pending', 'email', 'phone',
                                   'demo_account', 'simulated', 'referral_code', 'checked_in_at', 'transfer_locked', 'security_version',
                                   'totp_secret', 'qr_code', 'sale_channel', 'sale_decision', 'sold_quantity', 'held_quantity',
                                   'held_expires_at', 'total_quantity', 'capacity', 'available_at', 'paid_at', 'processed_at',
                                   'permission', 'key', 'value', 'id_card_url', 'business_doc_url', 'ninea', 'rccm', 'created_at',
                                   'commission_rate']::name[])
            OR a.attname ~ '(_amount|_price|_fee|_fees|_rate|_quantity|_status|_verified|_verified_at)$')
),
x1 AS (
    SELECT DISTINCT 'x1'::text AS regle, s.relname || '.' || s.attname AS objet,
           format('%s peut écrire cette colonne par la politique %s (%s)', r.rol, p.policyname, p.cmd) AS detail
      FROM x1_cols s
      CROSS JOIN (VALUES ('anon'::name), ('authenticated'::name)) r(rol)
      JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = s.relname AND p.permissive = 'PERMISSIVE'
                        AND p.cmd IN ('INSERT', 'UPDATE', 'ALL') AND p.roles && ARRAY['public'::name, r.rol]
     WHERE (p.cmd IN ('UPDATE', 'ALL') AND has_column_privilege(r.rol, s.relid, s.attname, 'UPDATE'))
        OR (p.cmd IN ('INSERT', 'ALL') AND has_column_privilege(r.rol, s.relid, s.attname, 'INSERT'))
),
-- (x2) 0.1 : aucun droit INSERT, UPDATE, DELETE ou TRUNCATE (table, colonne, vue) pour anon ou authenticated dans
--      public, et aucune politique d'écriture
x2 AS (
    SELECT 'x2'::text AS regle, c.relname::text AS objet, format('%s : droit %s (relkind %s)', r.rol, k.priv, c.relkind) AS detail
      FROM pg_class c
      CROSS JOIN (VALUES ('anon'::name), ('authenticated'::name)) r(rol)
      CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) k(priv)
     WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
       AND CASE WHEN k.priv IN ('INSERT', 'UPDATE') THEN has_any_column_privilege(r.rol, c.oid, k.priv)
                ELSE has_table_privilege(r.rol, c.oid, k.priv) END
    UNION ALL
    SELECT 'x2', p.tablename::text, format('politique d''écriture %s (%s, rôles %s)', p.policyname, p.cmd, p.roles::text)
      FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
),
-- (x3) 0.3 : tout passage INCERTAIN → ECHOUE d'un versement a, dans la même transaction, un audit CASHOUT_NOT_SENT
--      d'un SUPERADMIN avec une référence de 1 à 100 caractères et un motif d'au moins 10 (E4)
x3 AS (
    SELECT 'x3'::text AS regle, a.object_id::text AS objet,
           'versement incertain passé à ECHOUE sans constat « non versé » d''un superadmin dans la même transaction' AS detail
      FROM public.audit_logs a
     WHERE a.object_type = 'cashouts' AND a.old_value->>'status' = 'INCERTAIN' AND a.new_value->>'status' = 'ECHOUE'
       AND NOT EXISTS (SELECT 1 FROM public.audit_logs d
                        WHERE d.object_type = 'cashouts' AND d.object_id = a.object_id AND d.action = 'CASHOUT_NOT_SENT'
                          AND d.user_id IS NOT NULL AND d.user_role = 'SUPERADMIN' AND d.created_at = a.created_at
                          AND char_length(btrim(COALESCE(d.metadata->>'reference', ''))) BETWEEN 1 AND 100
                          AND char_length(btrim(COALESCE(d.metadata->>'reason', ''))) >= 10)
),
-- (x4) 0.3 : jamais de renvoi automatique : toute remise à envoyer (ECHOUE → A_ENVOYER) d'un versement constaté non
--      versé, postérieure au constat, a dans la même transaction un CASHOUT_RESENT d'un humain, justifié (E4)
x4 AS (
    SELECT 'x4'::text AS regle, a.object_id::text AS objet,
           'versement constaté non versé remis à envoyer sans décision humaine dans la même transaction' AS detail
      FROM public.audit_logs a
      JOIN public.cashouts c ON c.id = a.object_id
     WHERE a.object_type = 'cashouts' AND c.not_sent_at IS NOT NULL
       AND a.old_value->>'status' = 'ECHOUE' AND a.new_value->>'status' = 'A_ENVOYER'
       AND a.created_at >= c.not_sent_at
       AND NOT EXISTS (SELECT 1 FROM public.audit_logs d
                        WHERE d.object_type = 'cashouts' AND d.object_id = a.object_id AND d.action = 'CASHOUT_RESENT'
                          AND d.user_id IS NOT NULL AND d.created_at = a.created_at
                          AND d.metadata->>'previous_status' = 'ECHOUE'
                          AND char_length(btrim(COALESCE(d.metadata->>'reason', ''))) >= 10)
),
-- (x5) 0.5 : toute affectation a son lien partenaire–contrôleur
x5 AS (SELECT 'x5', ec.id::text, format('affectation de %s à l''événement %s sans lien partner_controllers (partenaire %s)', ec.user_id, ec.event_id, e.partner_id)
         FROM public.event_controllers ec JOIN public.events e ON e.id = ec.event_id
        WHERE NOT EXISTS (SELECT 1 FROM public.partner_controllers pc
                           WHERE pc.partner_id = e.partner_id AND pc.user_id = ec.user_id)),
-- (x6) 0.2 : remboursement hors annulation d'un billet transféré et accepté → avis au porteur actuel, à lui seul
x6_concerned AS (
       SELECT t.id AS ticket_id, t.user_id
         FROM public.audit_logs a
         JOIN public.tickets t ON t.id = a.object_id
         LEFT JOIN public.payments pay ON pay.id = t.payment_id
        WHERE a.action = 'TICKET_REFUND_REQUESTED' AND a.object_type = 'tickets'
          AND a.metadata->>'context' <> 'CANCELLATION' AND a.metadata->>'mode' IN ('CASHOUT', 'ORGANISATEUR')
          AND t.user_id IS NOT NULL AND t.user_id IS DISTINCT FROM pay.client_id
          AND EXISTS (SELECT 1 FROM public.ticket_transfers x
                       WHERE x.ticket_id = t.id AND x.status::text = 'CLAIMED' AND x.from_user_id IS NOT NULL)),
x6 AS (SELECT 'x6', c.ticket_id::text, 'remboursement d''un billet transféré sans TICKET_REFUNDED_HOLDER au porteur actuel'
         FROM x6_concerned c
        WHERE NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                           WHERE o.type = 'TICKET_REFUNDED_HOLDER' AND o.group_key = 'TICKET_REFUNDED_HOLDER:' || c.ticket_id::text
                             AND o.recipient_user_id = c.user_id)
       UNION ALL
       SELECT 'x6', o.id::text, format('TICKET_REFUNDED_HOLDER vers %s, porteur actuel %s', o.recipient_user_id, t.user_id)
         FROM public.notification_outbox o
         LEFT JOIN public.tickets t ON t.id = public.try_uuid(o.template_data->>'ticket_id')
        WHERE o.type = 'TICKET_REFUNDED_HOLDER'
          AND (t.id IS NULL OR o.recipient_user_id IS DISTINCT FROM t.user_id
               OR NOT EXISTS (SELECT 1 FROM x6_concerned c WHERE c.ticket_id = t.id))),
-- (x7) R106 a : après le cron, aucun VALIDE fini ; tout ended_unpublished est TERMINE par le cron et invisible du public
x7 AS (SELECT 'x7', e.id::text,
              format('événement VALIDE dont la fin (%s à Dakar) est dépassée de plus d''une heure après le passage du cron',
                     to_char(public.event_end_at(e.id) AT TIME ZONE 'Africa/Dakar', 'DD/MM/YYYY HH24:MI'))
         FROM public.events e
        WHERE e.status::text = 'VALIDE' AND public.event_end_at(e.id) < now() - interval '1 hour'
       UNION ALL
       SELECT 'x7', e.id::text, format('ended_unpublished vrai sur un événement %s', e.status)
         FROM public.events e WHERE e.ended_unpublished AND e.status::text <> 'TERMINE'
       UNION ALL
       SELECT 'x7', e.id::text, 'ended_unpublished sans ligne d''historique VALIDE → TERMINE (SYSTEM, CRON)'
         FROM public.events e
        WHERE e.ended_unpublished AND NOT EXISTS (
              SELECT 1 FROM public.event_status_history h
               WHERE h.event_id = e.id AND h.old_status::text = 'VALIDE' AND h.new_status::text = 'TERMINE'
                 AND h.actor_role = 'SYSTEM' AND h.channel = 'CRON')
       UNION ALL
       SELECT 'x7', h.event_id::text, 'passage VALIDE → TERMINE sans ended_unpublished'
         FROM public.event_status_history h JOIN public.events e ON e.id = h.event_id
        WHERE h.old_status::text = 'VALIDE' AND h.new_status::text = 'TERMINE' AND NOT e.ended_unpublished
       UNION ALL
       SELECT 'x7', e.id::text, 'événement terminé sans publication présent dans ' || v.src
         FROM public.events e
        CROSS JOIN LATERAL (VALUES
              ('public_event_state',    EXISTS (SELECT 1 FROM public.public_event_state s WHERE s.event_id = e.id)),
              ('public_category_stock', EXISTS (SELECT 1 FROM public.public_category_stock s WHERE s.event_id = e.id)),
              ('events_public_status',  EXISTS (SELECT 1 FROM public.events_public_status s WHERE s.id = e.id))) AS v(src, present)
        WHERE e.ended_unpublished AND v.present),
-- (x8) entrée par une porte d'entrée ; porte posée sur un événement à zones ; rien sans zone
x8a AS (SELECT 'x8'::text AS regle, s.id::text AS objet,
               'entrée acceptée par une porte hors de sa zone d''entrée'::text AS detail
          FROM public.ticket_scans s
          JOIN public.event_gates g ON g.id = s.gate_id
          JOIN public.event_zones z ON z.id = g.zone_id
         WHERE s.accepted
           AND (s.zone_id IS DISTINCT FROM g.zone_id OR z.kind <> 'ENTREE' OR g.event_id IS DISTINCT FROM s.event_id)),
x8b AS (SELECT 'x8', s.id::text, 'entrée acceptée sans porte sur un événement à zones'
          FROM public.ticket_scans s
         WHERE s.accepted AND s.gate_id IS NULL
           AND s.created_at >= (SELECT min(z.created_at) FROM public.event_zones z WHERE z.event_id = s.event_id)),
x8c AS (SELECT 'x8', s.id::text, 'porte ou zone sur un scan d''un événement sans zone'
          FROM public.ticket_scans s
         WHERE (s.gate_id IS NOT NULL OR s.zone_id IS NOT NULL)
           AND NOT EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = s.event_id)),
-- (x9) un contrôle ne composte jamais ; un zone_ok suit l'entrée du billet
x9a AS (SELECT 'x9', s.id::text, 'ligne de contrôle de zone acceptée'
          FROM public.ticket_scans s WHERE s.zone_result IS NOT NULL AND s.accepted),
x9b AS (SELECT 'x9', s.id::text, 'accès autorisé sans entrée antérieure du billet'
          FROM public.ticket_scans s
         WHERE s.zone_result = 'zone_ok'
           AND NOT EXISTS (SELECT 1 FROM public.ticket_scans a
                            WHERE a.ticket_id = s.ticket_id AND a.accepted AND a.created_at < s.created_at)),
-- (x10) catégorie active d'un événement à zones admise par au moins une zone d'entrée
x10 AS (SELECT 'x10', c.id::text, 'catégorie active admise par aucune zone d''entrée'
          FROM public.ticket_categories c
         WHERE c.is_active
           AND EXISTS (SELECT 1 FROM public.event_zones z WHERE z.event_id = c.event_id)
           AND NOT EXISTS (SELECT 1 FROM public.zone_categories zc JOIN public.event_zones z ON z.id = zc.zone_id
                            WHERE zc.category_id = c.id AND z.kind = 'ENTREE')),
-- (x11) liste des invités cohérente
x11a AS (SELECT 'x11', s.id::text, 'validation par la liste hors invitation, hors événement ou sans pièce vérifiée'
           FROM public.ticket_scans s JOIN public.tickets t ON t.id = s.ticket_id
          WHERE s.accepted AND s.method = 'GUEST_LIST'
            AND (t.sale_channel IS DISTINCT FROM 'INVITATION' OR t.event_id IS DISTINCT FROM s.event_id OR NOT s.identity_verified)),
x11b AS (SELECT 'x11', x.id::text,
                format('transfert ADMITTED incohérent : expéditeur %s, claimed_at %s, billet %s, porteur %s / destinataire %s, %s validation(s) par la liste à claimed_at',
                       COALESCE(x.from_user_id::text, 'aucun'), COALESCE(x.claimed_at::text, 'absent'), t.status,
                       COALESCE(t.user_id::text, 'aucun'), COALESCE(x.to_user_id::text, 'aucun'),
                       (SELECT count(*) FROM public.ticket_scans s WHERE s.ticket_id = x.ticket_id AND s.accepted
                           AND s.method = 'GUEST_LIST' AND s.created_at = x.claimed_at))
           FROM public.ticket_transfers x JOIN public.tickets t ON t.id = x.ticket_id
          WHERE x.status::text = 'ADMITTED'
            AND (x.from_user_id IS NOT NULL OR x.claimed_at IS NULL OR t.status <> 'UTILISE'
                 OR t.user_id IS DISTINCT FROM x.to_user_id
                 OR (SELECT count(*) FROM public.ticket_scans s WHERE s.ticket_id = x.ticket_id AND s.accepted
                        AND s.method = 'GUEST_LIST' AND s.created_at = x.claimed_at) <> 1)),
-- (x12) aucun numéro ni nom en clair
x12a AS (SELECT 'x12', a.id::text, a.action || ' : numéro ou nom d''invité au journal'
           FROM public.audit_logs a
          WHERE a.action IN ('GUEST_LIST_SEARCH', 'TICKET_INVITATION_GUEST_NAMED')
            AND (a.metadata ? 'guest_name'
                 OR regexp_replace(COALESCE(a.old_value::text, '') || COALESCE(a.new_value::text, '') || a.metadata::text,
                                   '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '', 'gi')
                    ~ '(^|[^0-9])(\\+?221)?7[05678][0-9]{7}([^0-9]|$)')),
x12b AS (SELECT 'x12', o.id::text, o.type || ' : nom d''invité dans les données du message'
           FROM public.notification_outbox o WHERE o.template_data ? 'guest_name'),
-- (x13) résumé public juste : valeurs des lignes présentes égales au recalcul (seuil courant) ;
--        aucune tranche pour une catégorie qui n'est pas active, vendue en ligne, d'un événement public publiable
x13 AS (
  WITH thr AS (SELECT public.low_stock_threshold() AS t),
  cat AS (
    SELECT tc.id, tc.event_id, tc.price,
           GREATEST(COALESCE(tc.total_quantity, 0) - COALESCE(tc.sold_quantity, 0) - COALESCE(tc.held_quantity, 0), 0) AS r
      FROM public.ticket_categories tc
     WHERE tc.is_active AND tc.sale_online
  ),
  ev AS (
    SELECT s.event_id, s.min_price, s.has_purchasable, s.stock_level, e.status::text AS status,
           (SELECT min(c.price) FILTER (WHERE c.r > 0) FROM cat c WHERE c.event_id = s.event_id) AS want_min,
           (SELECT COALESCE(bool_or(c.r > 0), FALSE) FROM cat c WHERE c.event_id = s.event_id) AS want_any,
           (SELECT CASE WHEN count(*) = 0 THEN NULL
                        WHEN NOT bool_or(c.r > 0) THEN 'SOLD_OUT'
                        WHEN bool_and(c.r <= (SELECT t FROM thr)) FILTER (WHERE c.r > 0) THEN 'LOW'
                        ELSE 'AVAILABLE' END
              FROM cat c WHERE c.event_id = s.event_id) AS want_level
      FROM public.public_event_state s
      JOIN public.events e ON e.id = s.event_id
  )
  SELECT 'x13'::text AS regle, ev.event_id::text AS objet,
         format('résumé public faux : min_price %s (attendu %s), has_purchasable %s (attendu %s), stock_level %s (attendu %s)',
                ev.min_price, ev.want_min, ev.has_purchasable, (ev.status = 'PUBLIE' AND ev.want_any),
                COALESCE(ev.stock_level, 'NULL'), COALESCE(ev.want_level, 'NULL')) AS detail
    FROM ev
   WHERE ev.min_price IS DISTINCT FROM ev.want_min
      OR ev.has_purchasable IS DISTINCT FROM (ev.status = 'PUBLIE' AND ev.want_any)
      OR ev.stock_level IS DISTINCT FROM ev.want_level
  UNION ALL
  SELECT 'x13', s.category_id::text,
         format('tranche publique fausse : %s/%s (attendu %s/%s)', s.availability, COALESCE(s.remaining_hint::text, 'NULL'),
                CASE WHEN c.r = 0 THEN 'SOLD_OUT' WHEN c.r <= thr.t THEN 'LOW' ELSE 'AVAILABLE' END,
                CASE WHEN c.r > 0 AND c.r <= thr.t THEN c.r::text ELSE 'NULL' END)
    FROM public.public_category_stock s
    JOIN cat c ON c.id = s.category_id
   CROSS JOIN thr
   WHERE s.availability IS DISTINCT FROM (CASE WHEN c.r = 0 THEN 'SOLD_OUT' WHEN c.r <= thr.t THEN 'LOW' ELSE 'AVAILABLE' END)
      OR s.remaining_hint IS DISTINCT FROM (CASE WHEN c.r > 0 AND c.r <= thr.t THEN c.r END)
  UNION ALL
  SELECT 'x13', s.category_id::text, 'tranche publique d''une catégorie inactive, hors vente en ligne ou d''un événement non public'
    FROM public.public_category_stock s
    JOIN public.ticket_categories tc ON tc.id = s.category_id
    JOIN public.events e ON e.id = tc.event_id
   WHERE NOT (tc.is_active AND tc.sale_online AND e.status::text IN ('PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE'))
)
SELECT * FROM x1 UNION ALL SELECT * FROM x2 UNION ALL SELECT * FROM x3 UNION ALL SELECT * FROM x4 UNION ALL SELECT * FROM x5
UNION ALL SELECT * FROM x6 UNION ALL SELECT * FROM x7 UNION ALL SELECT * FROM x8a UNION ALL SELECT * FROM x8b UNION ALL SELECT * FROM x8c
UNION ALL SELECT * FROM x9a UNION ALL SELECT * FROM x9b UNION ALL SELECT * FROM x10 UNION ALL SELECT * FROM x11a UNION ALL SELECT * FROM x11b
UNION ALL SELECT * FROM x12a UNION ALL SELECT * FROM x12b UNION ALL SELECT * FROM x13
ORDER BY 1, 2`;

/** Ligne de violation renvoyée par LOT9TER_INVARIANT_SQL (même forme que celles des lots précédents). */
export type Lot9terViolation = RecetteViolation;

/** Migrations du lot (contrat 3.1, noms exacts), citées par chaque objet absent. */
export const LOT9TER_MIGRATION = {
    M01: 'migration 20261110000001_lot9ter_rls',
    M02: 'migration 20261110000002_lot9ter_reglages',
    M03: 'migration 20261110000003_lot9ter_transfert_statut',
    M04: 'migration 20261110000004_lot9ter_registre',
    M05: 'migration 20261110000005_lot9ter_argent',
    M06: 'migration 20261110000006_lot9ter_equipe_messages',
    M07: 'migration 20261110000007_lot9ter_evenements',
    M08: 'migration 20261110000008_lot9ter_invites',
    M09: 'migration 20261110000009_lot9ter_zones',
    M10: 'migration 20261110000010_lot9ter_pilotage',
    M11: 'migration 20261110000011_lot9ter_stock',
} as const;

const M = LOT9TER_MIGRATION;

/**
 * Relations déjà en base avant le lot, lues par la requête (x1 compris : colonnes de la liste sensible, contrat 6) :
 * sans elles, une erreur Postgres brute remplacerait un échec qui nomme l'objet. Une vue est acceptée.
 */
const READ_COLUMNS: ReadonlyArray<[string, readonly string[]]> = [
    ['partners', ['id', 'status', 'is_verified', 'resubmitted_at', 'rejection_reason', 'suspended_reason', 'subscription_plan_id',
        'trial_started_at', 'trial_ends_at', 'is_founder', 'phone_verified', 'user_id', 'id_card_url', 'business_doc_url', 'ninea', 'rccm']],
    ['referral_commissions', ['commission_rate']],
    ['users', ['id', 'role', 'status', 'referral_status', 'demo_account', 'email_verified_at', 'email_pending', 'phone_verified_at',
        'referral_code', 'phone', 'email']],
    ['audit_logs', ['id', 'action', 'object_type', 'object_id', 'user_id', 'user_role', 'old_value', 'new_value', 'metadata', 'created_at']],
    ['cashouts', ['id']],
    ['event_controllers', ['id', 'event_id', 'user_id']],
    ['events', ['id', 'partner_id', 'status']],
    ['tickets', ['id', 'event_id', 'user_id', 'payment_id', 'status', 'sale_channel']],
    ['payments', ['id', 'client_id']],
    ['ticket_transfers', ['id', 'ticket_id', 'status', 'from_user_id', 'to_user_id', 'claimed_at']],
    ['notification_outbox', ['id', 'type', 'group_key', 'recipient_user_id', 'template_data']],
    ['event_status_history', ['event_id', 'old_status', 'new_status', 'actor_role', 'channel']],
    ['event_status_transitions', ['from_status', 'to_status', 'actor_kind', 'channel']],
    ['public_event_state', ['event_id', 'min_price', 'has_purchasable']],
    ['public_category_stock', ['category_id', 'event_id', 'availability', 'remaining_hint']],
    ['events_public_status', ['id']],
    ['ticket_scans', ['id', 'ticket_id', 'event_id', 'accepted', 'method', 'identity_verified', 'created_at']],
    ['ticket_categories', ['id', 'event_id', 'price', 'total_quantity', 'sold_quantity', 'held_quantity', 'is_active', 'sale_online']],
    ['notification_types', ['type']],
    ['platform_settings', ['key', 'value']],
];

/** Fonctions existantes lues par la requête (x6, x7, x13). */
const READ_FUNCTIONS: readonly string[] = ['try_uuid(text)', 'event_end_at(uuid)', 'low_stock_threshold()'];

/** Tables créées par le lot (contrat 3.8.1) et colonnes exigées. */
const LOT_TABLES: ReadonlyArray<[string, readonly string[], string]> = [
    ['partner_controllers', ['partner_id', 'user_id', 'first_seen_at'], M.M06],
    ['event_zones', ['id', 'event_id', 'name', 'kind', 'position', 'created_at', 'updated_at'], M.M09],
    ['zone_categories', ['event_id', 'zone_id', 'category_id'], M.M09],
    ['event_gates', ['id', 'event_id', 'zone_id', 'name', 'created_at'], M.M09],
];

/** Colonnes ajoutées par le lot à des tables existantes (contrat 3.8.2). */
const LOT_COLUMNS: ReadonlyArray<[string, string, string]> = [
    ['cashouts', 'not_sent_reference', M.M05],
    ['cashouts', 'not_sent_reason', M.M05],
    ['cashouts', 'not_sent_at', M.M05],
    ['cashouts', 'not_sent_by', M.M05],
    ['events', 'ended_unpublished', M.M07],
    ['tickets', 'guest_name', M.M08],
    ['event_controllers', 'gate_id', M.M09],
    ['event_controllers', 'gate_change_allowed', M.M09],
    ['ticket_scans', 'gate_id', M.M09],
    ['ticket_scans', 'zone_id', M.M09],
    ['ticket_scans', 'zone_result', M.M09],
    ['ticket_categories', 'scan_color', M.M09],
    ['ticket_categories', 'entry_instruction', M.M09],
    ['public_event_state', 'stock_level', M.M11],
];

/** Fonctions créées par le lot et gardées (contrat 6 : F5, F6, F7, F12, F17, F21, F27, F43 ; signature exacte, 3.4). */
const LOT_FUNCTIONS: ReadonlyArray<[string, string]> = [
    ['ticket_origin(text,numeric,boolean)', M.M02],
    ['scan_is_refusal(boolean,text,text,timestamptz)', M.M02],
    ['cashout_admin_not_sent(jsonb)', M.M05],
    ['partner_controller_known(uuid,uuid)', M.M06],
    ['event_edit_locks(uuid)', M.M07],
    ['ticket_guest_list_search(jsonb)', M.M08],
    ['scan_gate_context(uuid,uuid,uuid,boolean)', M.M09],
    ['pilotage_compute_entries(uuid,boolean)', M.M10],
];

/** Types du registre des notifications exigés (contrat 3.1, migration 04 ; section 11.1). */
export const LOT9TER_NOTIFICATION_TYPES: readonly string[] = ['TICKET_REFUNDED_HOLDER', 'ADMIN_EVENT_PUBLISHED', 'ADMIN_EVENT_WITHDRAWN', 'SCAN_REFUSALS_ALERT'];

/** Réglages exigés (contrat 3.1, migration 02 ; arbitrage 21). */
export const LOT9TER_SETTING_KEYS: readonly string[] = ['access.refusal_alert_threshold', 'access.refusal_alert_minutes'];

/** Contraintes nouvelles gardées (contrat 6.5). */
const LOT_CONSTRAINTS: ReadonlyArray<[string, string, string]> = [
    ['public_event_state', 'public_event_state_stock_level_check', M.M11],
];

/**
 * Objets du lot 9 ter absents de la base locale, décrits en clair (liste vide : schéma complet pour (x)). Chaque
 * contrôle lit le catalogue (jamais une table absente) : la liste nomme TOUS les objets manquants d'un coup.
 * Avec `db` : sur ce client (dans sa transaction) ; sans `db` : transaction READ ONLY sur une connexion neuve.
 */
export async function missingLot9terSchema(db?: Client): Promise<string[]> {
    const run = async (client: Client): Promise<string[]> => {
        const missing: string[] = [];

        const columnsOf = async (table: string): Promise<Set<string>> => {
            const r = await client.query<{ attname: string }>(
                `SELECT a.attname FROM pg_attribute a
                   JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind IN ('r', 'p', 'v') AND a.attnum > 0 AND NOT a.attisdropped`, [table]);
            return new Set(r.rows.map((row) => row.attname));
        };

        const present = new Map<string, Set<string>>();
        for (const [table, wanted] of READ_COLUMNS) {
            const cols = await columnsOf(table);
            present.set(table, cols);
            if (cols.size === 0) {
                missing.push(`table public.${table} absente — lue par les invariants du lot 9 ter (contrat 6)`);
                continue;
            }
            for (const c of wanted) if (!cols.has(c)) missing.push(`colonne public.${table}.${c} absente — lue par les invariants du lot 9 ter (contrat 6)`);
        }

        for (const signature of READ_FUNCTIONS) {
            const f = await client.query<{ ok: boolean }>('SELECT to_regprocedure($1) IS NOT NULL AS ok', [`public.${signature}`]);
            if (!f.rows[0].ok) missing.push(`fonction public.${signature} absente — lue par les invariants du lot 9 ter (contrat 6)`);
        }

        for (const [table, wanted, where] of LOT_TABLES) {
            const cols = await columnsOf(table);
            present.set(table, cols);
            if (cols.size === 0) {
                missing.push(`table public.${table} absente — ${where} (contrat 3.8.1)`);
                continue;
            }
            for (const c of wanted) if (!cols.has(c)) missing.push(`colonne public.${table}.${c} absente — ${where} (contrat 3.8.1)`);
        }

        for (const [table, column, where] of LOT_COLUMNS) {
            const cols = present.get(table) ?? await columnsOf(table);
            if (!cols.has(column)) missing.push(`colonne public.${table}.${column} absente — ${where} (contrat 3.8.2)`);
        }

        for (const [signature, where] of LOT_FUNCTIONS) {
            const f = await client.query<{ ok: boolean }>('SELECT to_regprocedure($1) IS NOT NULL AS ok', [`public.${signature}`]);
            if (!f.rows[0].ok) missing.push(`fonction public.${signature} absente — ${where} (contrat 3.4)`);
        }

        const admitted = await client.query<{ ok: boolean }>(
            `SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
                             WHERE n.nspname = 'public' AND t.typname = 'ticket_transfer_status' AND e.enumlabel = 'ADMITTED') AS ok`);
        if (!admitted.rows[0].ok) missing.push(`valeur ADMITTED absente du type public.ticket_transfer_status — ${M.M03} (contrat 3.8.3)`);

        for (const [table, name, where] of LOT_CONSTRAINTS) {
            const c = await client.query<{ ok: boolean }>(
                `SELECT EXISTS (SELECT 1 FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
                                 WHERE n.nspname = 'public' AND c.relname = $1 AND k.conname = $2) AS ok`, [table, name]);
            if (!c.rows[0].ok) missing.push(`contrainte ${name} absente de public.${table} — ${where} (contrat 3.8.4)`);
        }

        if ((present.get('notification_types')?.size ?? 0) > 0) {
            const types = await client.query<{ type: string }>(
                'SELECT type FROM public.notification_types WHERE type = ANY($1::text[])', [LOT9TER_NOTIFICATION_TYPES]);
            const registered = new Set(types.rows.map((row) => row.type));
            for (const type of LOT9TER_NOTIFICATION_TYPES) {
                if (!registered.has(type)) missing.push(`type ${type} absent de public.notification_types — ${M.M04} (contrat 3.1)`);
            }
        }

        if ((present.get('platform_settings')?.size ?? 0) > 0) {
            const keys = await client.query<{ key: string }>(
                'SELECT key FROM public.platform_settings WHERE key = ANY($1::text[])', [LOT9TER_SETTING_KEYS]);
            const found = new Set(keys.rows.map((row) => row.key));
            for (const key of LOT9TER_SETTING_KEYS) {
                if (!found.has(key)) missing.push(`réglage ${key} absent de public.platform_settings — ${M.M02} (contrat 3.1)`);
            }
        }

        if ((present.get('event_status_transitions')?.size ?? 0) > 0) {
            const row = await client.query<{ ok: boolean }>(
                `SELECT EXISTS (SELECT 1 FROM public.event_status_transitions
                                 WHERE from_status::text = 'VALIDE' AND to_status::text = 'TERMINE'
                                   AND actor_kind = 'SYSTEM' AND channel = 'CRON') AS ok`);
            if (!row.rows[0].ok) missing.push(`ligne public.event_status_transitions (VALIDE, TERMINE, SYSTEM, CRON) absente — ${M.M07} (contrat 3.8.3)`);
        }

        return missing;
    };
    return db ? run(db) : inspect(run);
}

/** Échoue en nommant chaque objet manquant si le schéma du lot 9 ter n'est pas en place. */
export async function assertLot9terSchema(label: string, db?: Client): Promise<void> {
    const missing = await missingLot9terSchema(db);
    if (missing.length > 0) {
        console.log(`[INVARIANT-LOT9TER] ${label} — schéma du lot 9 ter incomplet : ${missing.length} objet(s) manquant(s)`);
        for (const m of missing) console.log(`[INVARIANT-LOT9TER]   ${m}`);
    }
    assert.deepEqual(missing, [], `schéma du lot 9 ter incomplet (${label}) : invariants (x) impossibles à vérifier :\n${missing.join('\n')}`);
}

/**
 * Violations de (x) sur toute la base. Avec `db` : la requête s'exécute sur ce client, dans sa transaction
 * (garde-fous de lot9ter-invariant.test.ts, violation fabriquée dans inRolledBackTransaction) ; sans `db` :
 * transaction READ ONLY sur une connexion neuve. Le schéma est contrôlé d'abord (échec explicite s'il manque).
 */
export async function lot9terViolations(db?: Client): Promise<Lot9terViolation[]> {
    await assertLot9terSchema('lot9terViolations', db);
    if (db) return (await db.query<Lot9terViolation>(LOT9TER_INVARIANT_SQL)).rows;
    return inspect(async (client) => (await client.query<Lot9terViolation>(LOT9TER_INVARIANT_SQL)).rows);
}

/**
 * À appeler dans after() de chaque suite nouvelle du lot 9 ter qui écrit : (a) à (v) et (w) par
 * assertLot9bisInvariants (envoyeur et cron de fin compris : aucun after() ne compte de SMS), schéma du lot 9 ter,
 * puis (x).
 */
export async function assertLot9terInvariants(label: string): Promise<void> {
    await assertLot9bisInvariants(label);
    await assertLot9terSchema(label);
    const rows = await lot9terViolations();
    console.log(`[INVARIANT-LOT9TER] ${label} — (x) : ${rows.length} violation(s)`);
    for (const r of rows) console.log(`[INVARIANT-LOT9TER]   (${r.regle}) ${r.objet} : ${r.detail}`);
    assert.deepEqual(rows, [], `invariants (x) violés (${label}) :\n${rows.map((r) => `(${r.regle}) ${r.objet} : ${r.detail}`).join('\n')}`);
}
