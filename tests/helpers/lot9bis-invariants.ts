/**
 * Lot 9 bis (A19, B112, contrat section 6) — invariants du lot, vérifiés à la fin de chaque suite nouvelle du lot
 * 9 bis qui écrit, de migration-lot9bis-rejouable et, dans le commit fix(9b.seed) seulement, du seed de
 * démonstration et de la recette, par une requête SQL sur TOUTE la base LOCALE (lecture seule). Règles w1 à w21 :
 *  (w1 à w4) versements : couverture des « Versements à reprendre », renvoi d'un incertain, « Marquer versé »,
 *            cohérence retrait et versement ;
 *  (w5 à w7) cascade de suspension d'une partenaire ;
 *  (w8 à w11) transferts : scan pendant un transfert, billet non VALIDE, verrou, numéro de l'expéditeur ;
 *  (w12 à w14) email : adresse vérifiée, adresse technique, profil et authentification alignés ;
 *  (w15, w16) comptes de démonstration (I1) ;
 *  (w17 à w21) paiement en attente unique, commissions après la fin, frais réels, remboursement après la fin,
 *              marques d'espèces.
 *
 * Ordre de assertLot9bisInvariants(label) : (a) à (v) par assertLot9Invariants (envoyeur compris), contrôle du
 * schéma du lot (échec explicite qui nomme chaque objet absent ; jamais d'erreur Postgres brute, jamais de faux
 * vert), puis (w). La sortie brute est imprimée (`[INVARIANT-LOT9BIS]`, filtrée par e2e/support/parcours.ts sur
 * « [INVARIANT »).
 *
 * lot9-invariants.ts, recette-invariants.ts, terrain-invariants.ts et finance-invariants.ts ne changent pas (A19) :
 * les suites existantes gardent leur comportement au run « avant ». Une suite annoncée verte dès l'écriture appelle
 * assertLot9Invariants : assertLot9bisInvariants échoue tant que les migrations 20261109000001 à …12 ne sont pas
 * toutes livrées (garde de schéma, rouge jusqu'à M12). seed-demo et invariants-run ne passent à cette aide que dans
 * le commit fix(9b.seed) (T5).
 */
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { inspect } from './db';
import { assertLot9Invariants } from './lot9-invariants';
import type { RecetteViolation } from './recette-invariants';

/** Requête des invariants (contrat 6.3, recopiée telle quelle) : lignes `{ regle, objet, detail }`, triées par règle puis objet. */
export const LOT9BIS_INVARIANT_SQL = `
WITH demo AS (
    SELECT u.id,
           right(regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g'), 9) AS phone9,
           lower(COALESCE(u.email, '')) AS email
      FROM public.users u WHERE u.demo_account
), demo_events AS (
    SELECT e.id FROM public.events e JOIN public.partners p ON p.id = e.partner_id JOIN demo d ON d.id = p.user_id
), demo_outbox AS (
    SELECT o.*,
           (COALESCE(o.recipient_user_id IN (SELECT id FROM demo), FALSE)
            OR right(regexp_replace(COALESCE(o.recipient_phone, ''), '[^0-9]', '', 'g'), 9) IN (SELECT phone9 FROM demo WHERE phone9 <> '')
            OR lower(COALESCE(o.recipient_email, '')) IN (SELECT email FROM demo WHERE email <> '')
            OR lower(COALESCE(o.recipient_email, '')) LIKE '%@essai.eventvillage.invalid'
            OR COALESCE(o.event_id IN (SELECT id FROM demo_events), FALSE)) AS is_demo
      FROM public.notification_outbox o
     WHERE o.channel IN ('SMS', 'EMAIL', 'PUSH') AND o.status IN ('SENT', 'SKIPPED')
),
-- (w1) R1, R9, R10 : versement non final depuis plus de 30 min, absent des « Versements à reprendre » (oracle indépendant de la liste)
w1 AS (SELECT 'w1'::text AS regle, c.id::text AS objet,
              format('versement %s au statut %s depuis plus de 30 min, absent des versements à reprendre', c.kind, c.status) AS detail
         FROM public.cashouts c
        WHERE c.status IN ('A_ENVOYER', 'ENVOYE', 'INCERTAIN')
          AND COALESCE(c.blocked_reason, '') <> 'SIMULATED'
          AND COALESCE(c.sent_at, c.send_started_at, c.created_at) < now() - interval '30 minutes'
          AND c.id NOT IN (SELECT r.id FROM public.cashouts_to_resume() r)),
-- (w2) B2, B3 : un versement INCERTAIN n'est jamais renvoyé sans décision justifiée (trace de trg_audit_cashouts)
w2 AS (SELECT 'w2', a.object_id::text, 'versement incertain renvoyé sans décision justifiée'
         FROM public.audit_logs a
        WHERE a.object_type = 'cashouts' AND a.old_value->>'status' = 'INCERTAIN' AND a.new_value->>'status' IN ('A_ENVOYER', 'ENVOYE')
          AND NOT EXISTS (SELECT 1 FROM public.audit_logs d
                           WHERE d.object_id = a.object_id AND d.action = 'CASHOUT_RESENT' AND d.user_id IS NOT NULL
                             AND char_length(COALESCE(d.metadata->>'reason', '')) >= 10)),
-- (w3) « Marquer versé » toujours journalisé, avec la référence
w3 AS (SELECT 'w3', c.id::text, 'versement marqué versé sans journal ni référence'
         FROM public.cashouts c
        WHERE c.status = 'CONFIRME' AND c.provider_status = 'MANUEL'
          AND (c.samirpay_reference IS NULL
               OR NOT EXISTS (SELECT 1 FROM public.audit_logs d
                               WHERE d.object_id = c.id AND d.action = 'CASHOUT_MARKED_PAID' AND d.user_id IS NOT NULL
                                 AND COALESCE(d.metadata->>'reference', '') <> ''))),
-- (w4) retrait et versement cohérents (H7 : un 409 ne rend jamais le solde)
w4 AS (SELECT 'w4', w.id::text, format('retrait %s alors que son versement est %s', w.status, c.status)
         FROM public.withdrawals w JOIN public.cashouts c ON c.id = w.cashout_id
        WHERE (c.status = 'CONFIRME' AND w.status <> 'PAID')
           OR (c.status = 'ECHOUE' AND w.status <> 'REJECTED')
           OR (c.status IN ('INCERTAIN', 'ENVOYE') AND w.status IN ('REJECTED', 'PAID'))),
-- (w5) R5 : aucun événement PUBLIE d'une partenaire suspendue
w5 AS (SELECT 'w5', e.id::text, 'événement publié d''une partenaire suspendue'
         FROM public.events e JOIN public.partners p ON p.id = e.partner_id
        WHERE p.status = 'SUSPENDU' AND e.status = 'PUBLIE'),
-- (w6) trace de cascade ouverte sur un événement remis en ligne hors réactivation
w6 AS (SELECT 'w6', k.event_id::text, 'cascade ouverte sur un événement publié'
         FROM public.partner_suspension_cascades k JOIN public.events e ON e.id = k.event_id
        WHERE k.closed_at IS NULL AND e.status = 'PUBLIE'),
-- (w7) réactivation : aucune trace restée ouverte
w7 AS (SELECT 'w7', k.event_id::text, 'cascade non close après la réactivation de la partenaire'
         FROM public.partner_suspension_cascades k JOIN public.partners p ON p.id = k.partner_id
        WHERE k.closed_at IS NULL AND p.status <> 'SUSPENDU'),
-- (w8) R19 : aucune entrée acceptée pendant un transfert en attente
w8 AS (SELECT 'w8', s.id::text, 'entrée acceptée pendant un transfert en attente'
         FROM public.ticket_scans s JOIN public.ticket_transfers x ON x.ticket_id = s.ticket_id
        WHERE s.accepted AND s.created_at >= x.created_at
          AND s.created_at < LEAST(x.expires_at,
                                   COALESCE(x.claimed_at, x.cancelled_at, x.expired_at, x.declined_at, 'infinity'::timestamptz))),
-- (w9) R61 : aucun transfert en attente sur un billet qui n'est plus VALIDE
w9 AS (SELECT 'w9', x.id::text, 'transfert en attente sur un billet ' || t.status
         FROM public.ticket_transfers x JOIN public.tickets t ON t.id = x.ticket_id
        WHERE x.status = 'PENDING' AND t.status <> 'VALIDE'),
-- (w10) R44, R46 : verrou ⇔ transfert en attente
w10 AS (SELECT 'w10', t.id::text,
               CASE WHEN t.transfer_locked THEN 'billet verrouillé sans transfert en attente' ELSE 'transfert en attente sur un billet non verrouillé' END
          FROM public.tickets t
         WHERE t.transfer_locked IS DISTINCT FROM EXISTS (SELECT 1 FROM public.ticket_transfers x WHERE x.ticket_id = t.id AND x.status = 'PENDING')),
-- (w11) R103 : aucun transfert vers le numéro de l'expéditeur
w11 AS (SELECT 'w11', x.id::text, 'transfert vers le numéro de l''expéditeur'
          FROM public.ticket_transfers x JOIN public.users u ON u.id = x.from_user_id
         WHERE x.to_phone_or_email ~ '[0-9]{9}' AND u.phone IS NOT NULL
           AND right(regexp_replace(x.to_phone_or_email, '[^0-9]', '', 'g'), 9) = right(regexp_replace(u.phone, '[^0-9]', '', 'g'), 9)),
-- (w12) R87 : aucun email envoyé à une adresse non vérifiée (hors lien de vérification)
w12 AS (SELECT 'w12', o.id::text, 'email ' || o.type || ' envoyé à une adresse non vérifiée'
          FROM public.notification_outbox o
         WHERE o.channel = 'EMAIL' AND o.status = 'SENT' AND o.type <> 'EMAIL_VERIFICATION'
           AND COALESCE((o.decision->'email'->>'verified')::boolean, FALSE) IS NOT TRUE),
-- (w13) aucune adresse technique ne reçoit rien
w13 AS (SELECT 'w13', o.id::text, 'email envoyé à une adresse technique'
          FROM public.notification_outbox o
         WHERE o.channel = 'EMAIL' AND o.status = 'SENT' AND o.recipient_email ~* '@([a-z0-9-]+\\.)*eventvillage\\.sn$'),
-- (w14) adresse vérifiée jamais technique. Contre-vérification du lot 9 quinquies (point 2 ; invariant modifié, signalé au
-- rapport) : GoTrue ne porte plus l'adresse vérifiée (avant : identique dans le profil et dans l'authentification) mais
-- l'adresse technique d'empreinte secrète, jamais l'adresse du profil.
w14 AS (SELECT 'w14', u.id::text, 'adresse vérifiée technique, ou portée par GoTrue, ou identifiant GoTrue autre que l''adresse technique d''empreinte'
          FROM public.users u JOIN auth.users a ON a.id = u.id
         WHERE u.email_verified_at IS NOT NULL
           AND (lower(u.email) = lower(COALESCE(a.email, '')) OR u.email ~* '@([a-z0-9-]+\\.)*eventvillage\\.sn$'
                OR COALESCE(a.email, '') !~ '^k[0-9a-f]{40}@comptes\\.eventvillage\\.invalid$')),
-- (w15) I1 : rien d'envoyé (SMS, email, push) à un compte, un numéro, une adresse ou un événement de démonstration
w15 AS (SELECT 'w15', o.id::text, o.channel || ' envoyé à un destinataire de démonstration'
          FROM demo_outbox o WHERE o.status = 'SENT' AND o.is_demo),
-- (w16) la retenue « compte de démonstration » ne touche jamais un vrai destinataire
w16 AS (SELECT 'w16', o.id::text, 'message retenu « compte de démonstration » pour un destinataire réel'
          FROM demo_outbox o WHERE o.status = 'SKIPPED' AND o.reason = 'DEMO_ACCOUNT' AND NOT o.is_demo),
-- (w17) R47 : jamais deux paiements de billets PENDING du même compte pour le même événement
w17 AS (SELECT 'w17', min(p.id::text), format('%s paiements de billets en attente pour un compte et un événement', count(*))
          FROM public.payments p
         WHERE p.payment_target = 'TICKET' AND p.status = 'PENDING' AND p.client_id IS NOT NULL AND p.event_id IS NOT NULL
         GROUP BY p.client_id, p.event_id HAVING count(*) > 1),
-- (w18) R106 : aucune commission d'un billet disponible avant la fin de l'événement + N jours (lignes non retirées)
w18 AS (SELECT 'w18', c.id::text, format('commission disponible le %s, avant la fin de l''événement + délai', c.available_at)
          FROM public.referral_commissions c JOIN public.payments p ON p.id = c.payment_id
         WHERE c.kind = 'COMMISSION' AND c.cancelled_at IS NULL AND c.paid_amount = 0
           AND p.payment_target = 'TICKET' AND p.event_id IS NOT NULL
           AND c.available_at < public.fin_event_end(p.event_id)
                                + make_interval(days => public.fin_setting_num('finance.referral_availability_days')::int)),
-- (w19) H7, A6 : écriture de frais = frais réels d'un versement confirmé, datée comme le remboursement
w19 AS (SELECT 'w19', l.id::text, 'écriture de frais sans versement confirmé, de montant ou de date incohérents'
          FROM public.finance_ledger l
          LEFT JOIN public.cashouts c ON c.id::text = substr(l.source_key, length('CASHOUT_FEE-') + 1)
         WHERE l.source_key LIKE 'CASHOUT_FEE-%'
           AND (c.id IS NULL OR c.status <> 'CONFIRME' OR c.samirpay_fees IS NULL OR l.amount <> -c.samirpay_fees
                OR NOT EXISTS (SELECT 1 FROM public.finance_ledger r
                                WHERE r.entry_type = 'REMBOURSEMENT' AND r.owner_id = l.owner_id
                                  AND r.refund_id = c.refund_id AND r.available_at = l.available_at))),
-- (w20) R11 : aucun remboursement de billet demandé par la propriétaire après la fin de l'événement (hors annulation)
w20 AS (SELECT 'w20', a.object_id::text, 'remboursement de billet demandé par l''organisateur après la fin'
          FROM public.audit_logs a JOIN public.tickets t ON t.id = a.object_id JOIN public.events e ON e.id = t.event_id
         WHERE a.action = 'TICKET_REFUND_REQUESTED' AND a.metadata->>'as' = 'OWNER'
           AND a.created_at > public.event_end_at(e.id) AND COALESCE(a.metadata->>'context', '') <> 'CANCELLATION'),
-- (w21) R20 : aucune marque « espèces remboursées » sur un paiement plateforme
w21 AS (SELECT 'w21', m.payment_id::text, 'marque d''espèces sur un paiement en ligne'
          FROM public.event_cash_refund_marks m JOIN public.payments p ON p.id = m.payment_id
         WHERE p.is_platform_payment OR p.event_id IS DISTINCT FROM m.event_id)
SELECT * FROM w1 UNION ALL SELECT * FROM w2 UNION ALL SELECT * FROM w3 UNION ALL SELECT * FROM w4 UNION ALL SELECT * FROM w5
UNION ALL SELECT * FROM w6 UNION ALL SELECT * FROM w7 UNION ALL SELECT * FROM w8 UNION ALL SELECT * FROM w9 UNION ALL SELECT * FROM w10
UNION ALL SELECT * FROM w11 UNION ALL SELECT * FROM w12 UNION ALL SELECT * FROM w13 UNION ALL SELECT * FROM w14 UNION ALL SELECT * FROM w15
UNION ALL SELECT * FROM w16 UNION ALL SELECT * FROM w17 UNION ALL SELECT * FROM w18 UNION ALL SELECT * FROM w19 UNION ALL SELECT * FROM w20
UNION ALL SELECT * FROM w21
ORDER BY 1, 2`;

/** Ligne de violation renvoyée par LOT9BIS_INVARIANT_SQL (même forme que celles de la recette et du lot 9). */
export type Lot9bisViolation = RecetteViolation;

/** Migrations du lot (contrat 3.1), citées par chaque objet absent. */
export const LOT9BIS_MIGRATION = {
    M02: 'migration 20261109000002_lot9bis_transfert_statut',
    M03: 'migration 20261109000003_lot9bis_registre',
    M04: 'migration 20261109000004_lot9bis_droits',
    M05: 'migration 20261109000005_lot9bis_samirpay',
    M06: 'migration 20261109000006_lot9bis_argent',
    M07: 'migration 20261109000007_lot9bis_versements',
    M08: 'migration 20261109000008_lot9bis_cycle',
    M10: 'migration 20261109000010_lot9bis_email',
    M12: 'migration 20261109000012_lot9bis_mode_reel',
} as const;

const M = LOT9BIS_MIGRATION;

/** Colonnes déjà en base avant le lot, lues par la requête : sans elles, une erreur Postgres brute remplacerait un échec qui nomme l'objet. */
const READ_COLUMNS: ReadonlyArray<[string, string, readonly string[]]> = [
    ['public', 'cashouts', ['id', 'kind', 'status', 'blocked_reason', 'sent_at', 'send_started_at', 'created_at', 'provider_status', 'refund_id']],
    ['public', 'withdrawals', ['id', 'status', 'cashout_id']],
    ['public', 'audit_logs', ['action', 'object_type', 'object_id', 'user_id', 'old_value', 'new_value', 'metadata', 'created_at']],
    ['public', 'events', ['id', 'partner_id', 'status']],
    ['public', 'partners', ['id', 'user_id', 'status']],
    ['public', 'ticket_scans', ['id', 'ticket_id', 'accepted', 'created_at']],
    ['public', 'ticket_transfers', ['id', 'ticket_id', 'from_user_id', 'to_phone_or_email', 'status', 'created_at', 'expires_at', 'claimed_at', 'cancelled_at', 'expired_at']],
    ['public', 'tickets', ['id', 'event_id', 'status', 'transfer_locked']],
    ['public', 'users', ['id', 'phone', 'email']],
    ['public', 'notification_outbox', ['id', 'type', 'channel', 'status', 'reason', 'recipient_user_id', 'recipient_phone', 'recipient_email', 'event_id', 'decision']],
    ['public', 'payments', ['id', 'payment_target', 'status', 'client_id', 'event_id', 'is_platform_payment']],
    ['public', 'referral_commissions', ['id', 'kind', 'payment_id', 'available_at', 'cancelled_at', 'paid_amount']],
    ['public', 'finance_ledger', ['id', 'owner_id', 'entry_type', 'amount', 'available_at', 'refund_id', 'source_key']],
    ['public', 'notification_types', ['type']],
    ['public', 'event_status_transitions', ['from_status', 'to_status', 'actor_kind']],
    ['auth', 'users', ['id', 'email']],
];

/** Fonctions existantes lues par la requête (w18, w20). */
const READ_FUNCTIONS: readonly string[] = ['fin_event_end(uuid)', 'fin_setting_num(text)', 'event_end_at(uuid)'];

/** Tables créées par le lot (contrat 6.2) et colonnes exigées (lues par la requête ou fixées par le contrat). */
const LOT_TABLES: ReadonlyArray<[string, readonly string[], string]> = [
    ['partner_suspension_cascades', ['partner_id', 'event_id', 'suspended_history_id', 'closed_at', 'outcome'], M.M06],
    ['event_start_changes', [], M.M06],
    ['event_cash_refund_marks', ['payment_id', 'event_id'], M.M06],
    ['password_confirmations', [], M.M04],
    ['email_verifications', [], M.M10],
    ['controller_invitations', [], M.M08],
];

/** Colonnes ajoutées par le lot à des tables existantes (contrat 6.2). */
const LOT_COLUMNS: ReadonlyArray<[string, string, string]> = [
    ['cashouts', 'delay_flagged_at', M.M07],
    ['cashouts', 'samirpay_fees', M.M05],
    ['cashouts', 'samirpay_net_amount', M.M05],
    ['cashouts', 'samirpay_ref_operator', M.M05],
    ['cashouts', 'samirpay_reference', M.M05],
    ['payments', 'samirpay_fees', M.M05],
    ['ticket_transfers', 'declined_at', M.M08],
    ['users', 'email_verified_at', M.M10],
    ['users', 'email_pending', M.M10],
    ['users', 'demo_account', M.M12],
    ['partners', 'ninea', M.M04],
    ['partners', 'rccm', M.M04],
    ['partners', 'resubmitted_at', M.M04],
];

/** Fonctions créées par le lot (signature exacte, contrat 6.2 et 3.2). */
const LOT_FUNCTIONS: ReadonlyArray<[string, string]> = [
    ['cashouts_to_resume()', M.M07],
    ['admin_can(uuid,text)', M.M04],
    ['fin_frozen_amount(uuid,text,timestamptz)', M.M06],
    ['event_end_from_v2(date,time,date,time)', M.M08],
];

/** Types du registre des notifications exigés (contrat 6.2, section 11.1). */
const LOT_NOTIFICATION_TYPES: readonly string[] = ['REFUND_DELAYED', 'TICKET_CANCELLED', 'EMAIL_VERIFICATION', 'SHIFT_OPEN_AT_END'];

/**
 * Objets du lot 9 bis absents de la base locale, décrits en clair (liste vide : schéma complet pour (w)). Chaque
 * contrôle lit le catalogue (jamais une table absente) : la liste nomme TOUS les objets manquants d'un coup.
 * Avec `db` : sur ce client (dans sa transaction) ; sans `db` : transaction READ ONLY sur une connexion neuve.
 */
export async function missingLot9bisSchema(db?: Client): Promise<string[]> {
    const run = async (client: Client): Promise<string[]> => {
        const missing: string[] = [];

        const columnsOf = async (schema: string, table: string): Promise<Set<string>> => {
            const r = await client.query<{ attname: string }>(
                `SELECT a.attname FROM pg_attribute a
                   JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = $1 AND c.relname = $2 AND c.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped`, [schema, table]);
            return new Set(r.rows.map((row) => row.attname));
        };

        const present = new Map<string, Set<string>>();
        for (const [schema, table, wanted] of READ_COLUMNS) {
            const cols = await columnsOf(schema, table);
            present.set(`${schema}.${table}`, cols);
            if (cols.size === 0) {
                missing.push(`table ${schema}.${table} absente — lue par les invariants du lot 9 bis (contrat 6.3)`);
                continue;
            }
            for (const c of wanted) if (!cols.has(c)) missing.push(`colonne ${schema}.${table}.${c} absente — lue par les invariants du lot 9 bis (contrat 6.3)`);
        }

        for (const signature of READ_FUNCTIONS) {
            const f = await client.query<{ ok: boolean }>('SELECT to_regprocedure($1) IS NOT NULL AS ok', [`public.${signature}`]);
            if (!f.rows[0].ok) missing.push(`fonction public.${signature} absente — lue par les invariants du lot 9 bis (contrat 6.3)`);
        }

        for (const [table, wanted, where] of LOT_TABLES) {
            const cols = await columnsOf('public', table);
            if (cols.size === 0) {
                missing.push(`table public.${table} absente — ${where} (contrat 6.2)`);
                continue;
            }
            for (const c of wanted) if (!cols.has(c)) missing.push(`colonne public.${table}.${c} absente — ${where} (contrat 6.2)`);
        }

        for (const [table, column, where] of LOT_COLUMNS) {
            const cols = present.get(`public.${table}`) ?? await columnsOf('public', table);
            if (!cols.has(column)) missing.push(`colonne public.${table}.${column} absente — ${where} (contrat 6.2)`);
        }

        const declined = await client.query<{ ok: boolean }>(
            `SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
                             WHERE n.nspname = 'public' AND t.typname = 'ticket_transfer_status' AND e.enumlabel = 'DECLINED') AS ok`);
        if (!declined.rows[0].ok) missing.push(`valeur DECLINED absente du type public.ticket_transfer_status — ${M.M02} (contrat 6.2)`);

        for (const [signature, where] of LOT_FUNCTIONS) {
            const f = await client.query<{ result: string | null }>(
                'SELECT pg_get_function_result(to_regprocedure($1)) AS result', [`public.${signature}`]);
            const result = f.rows[0].result;
            if (result === null) {
                missing.push(`fonction public.${signature} absente — ${where} (contrat 6.2)`);
            } else if (signature === 'cashouts_to_resume()' && !/\bid uuid\b/.test(result)) {
                missing.push(`fonction public.${signature} sans colonne « id uuid » (rend ${result}) — ${where} (contrat X1, lue par w1)`);
            }
        }

        if ((present.get('public.event_status_transitions')?.size ?? 0) > 0) {
            const row = await client.query<{ ok: boolean }>(
                `SELECT EXISTS (SELECT 1 FROM public.event_status_transitions
                                 WHERE from_status::text = 'SUSPENDU' AND to_status::text = 'TERMINE' AND actor_kind = 'ADMIN') AS ok`);
            if (!row.rows[0].ok) missing.push(`ligne public.event_status_transitions (SUSPENDU, TERMINE, ADMIN) absente — ${M.M08} (contrat 6.2)`);
        }

        if ((present.get('public.notification_types')?.size ?? 0) > 0) {
            const types = await client.query<{ type: string }>(
                'SELECT type FROM public.notification_types WHERE type = ANY($1::text[])', [LOT_NOTIFICATION_TYPES]);
            const registered = new Set(types.rows.map((row) => row.type));
            for (const type of LOT_NOTIFICATION_TYPES) {
                if (!registered.has(type)) missing.push(`type ${type} absent de public.notification_types — ${M.M03} (contrat 6.2)`);
            }
        }

        return missing;
    };
    return db ? run(db) : inspect(run);
}

/** Échoue en nommant chaque objet manquant si le schéma du lot 9 bis n'est pas en place. */
export async function assertLot9bisSchema(label: string, db?: Client): Promise<void> {
    const missing = await missingLot9bisSchema(db);
    if (missing.length > 0) {
        console.log(`[INVARIANT-LOT9BIS] ${label} — schéma du lot 9 bis incomplet : ${missing.length} objet(s) manquant(s)`);
        for (const m of missing) console.log(`[INVARIANT-LOT9BIS]   ${m}`);
    }
    assert.deepEqual(missing, [], `schéma du lot 9 bis incomplet (${label}) : invariants (w) impossibles à vérifier :\n${missing.join('\n')}`);
}

/**
 * Violations de (w) sur toute la base. Avec `db` : la requête s'exécute sur ce client, dans sa transaction
 * (garde-fous de lot9bis-invariant.test.ts, violation fabriquée dans inRolledBackTransaction) ; sans `db` :
 * transaction READ ONLY sur une connexion neuve. Le schéma est contrôlé d'abord (échec explicite s'il manque).
 */
export async function lot9bisViolations(db?: Client): Promise<Lot9bisViolation[]> {
    await assertLot9bisSchema('lot9bisViolations', db);
    if (db) return (await db.query<Lot9bisViolation>(LOT9BIS_INVARIANT_SQL)).rows;
    return inspect(async (client) => (await client.query<Lot9bisViolation>(LOT9BIS_INVARIANT_SQL)).rows);
}

/**
 * À appeler dans after() de chaque suite nouvelle du lot 9 bis qui écrit : (a) à (v) par assertLot9Invariants
 * (envoyeur compris : aucun after() ne compte de SMS), schéma du lot 9 bis, puis (w).
 */
export async function assertLot9bisInvariants(label: string): Promise<void> {
    await assertLot9Invariants(label);
    await assertLot9bisSchema(label);
    const rows = await lot9bisViolations();
    console.log(`[INVARIANT-LOT9BIS] ${label} — (w) : ${rows.length} violation(s)`);
    for (const r of rows) console.log(`[INVARIANT-LOT9BIS]   (${r.regle}) ${r.objet} : ${r.detail}`);
    assert.deepEqual(rows, [], `invariants (w) violés (${label}) :\n${rows.map((r) => `(${r.regle}) ${r.objet} : ${r.detail}`).join('\n')}`);
}
