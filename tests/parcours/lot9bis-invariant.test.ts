/**
 * Lot 9 bis (A19, contrat 6.4) — garde-fous des invariants (w1) à (w21) du lot (requête LOT9BIS_INVARIANT_SQL dans
 * tests/helpers/lot9bis-invariants.ts). Un invariant toujours vide ne prouverait rien : dans des transactions
 * annulées (inRolledBackTransaction, patron lot9-invariant.test.ts), chaque règle détecte une violation fabriquée
 * exprès, à côté d'un témoin conforme écrit dans la même transaction :
 *  - les triggers utilisateur des tables écrites par le cas sont coupés dans la transaction (annulé avec elle) :
 *    sinon les gardes d'écriture, les avis et l'audit automatique changeraient la scène fabriquée. auth.users n'est
 *    pas coupé (hors du propriétaire postgres) ;
 *  - w1 : cashouts_to_resume() est remplacée dans la transaction par une version qui ne rend qu'un témoin
 *    (CREATE OR REPLACE transactionnel, même type de retour) : seul moyen de prouver que l'oracle voit un oubli ;
 *  - w14 : la contrainte users_email_verified_real_chk (M10) est retirée dans la transaction pour fabriquer une
 *    adresse technique vérifiée ;
 *  - tables nouvelles du lot (cascades, marques d'espèces) : seules les colonnes du contrat 6.2 sont écrites ; une
 *    colonne obligatoire sans défaut inconnue du contrat fait échouer le cas en la nommant ;
 *  - garde de schéma : chaque objet du lot retiré dans une transaction annulée est nommé par missingLot9bisSchema,
 *    et assertLot9bisSchema et lot9bisViolations échouent en le citant ; jamais un faux vert ;
 *  - dernier cas : après ROLLBACK, aucune ligne fabriquée ne reste, et les triggers sont actifs.
 * Les violations sont filtrées par objet : la requête lit toute la base, et after() contrôle le reste.
 *
 * Rouge avant correctif : aucune des migrations 20261109000001 à …12 n'est livrée ; assertLot9bisSchema échoue
 * dans chaque transaction en nommant chaque objet manquant, jamais par une erreur Postgres brute (contrat 6.4).
 * Vert attendu après M12 (dernière migration du lot à ajouter un objet gardé : users.demo_account).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { FIXTURE_USERS } from '../helpers/fixture-data';
import {
    assertLot9bisInvariants,
    assertLot9bisSchema,
    lot9bisViolations,
    missingLot9bisSchema,
    type Lot9bisViolation,
} from '../helpers/lot9bis-invariants';
import { randomSenegalPhone } from './helpers';

type Row = Record<string, unknown>;

const W1 = (kind: string, status: string): string => `versement ${kind} au statut ${status} depuis plus de 30 min, absent des versements à reprendre`;
const W2 = 'versement incertain renvoyé sans décision justifiée';
const W3 = 'versement marqué versé sans journal ni référence';
const W4 = (withdrawal: string, cashout: string): string => `retrait ${withdrawal} alors que son versement est ${cashout}`;
const W5 = 'événement publié d\'une partenaire suspendue';
const W6 = 'cascade ouverte sur un événement publié';
const W7 = 'cascade non close après la réactivation de la partenaire';
const W8 = 'entrée acceptée pendant un transfert en attente';
const W9 = (status: string): string => `transfert en attente sur un billet ${status}`;
const W10_LOCKED = 'billet verrouillé sans transfert en attente';
const W10_OPEN = 'transfert en attente sur un billet non verrouillé';
const W11 = 'transfert vers le numéro de l\'expéditeur';
const W12 = (type: string): string => `email ${type} envoyé à une adresse non vérifiée`;
const W13 = 'email envoyé à une adresse technique';
const W14 = 'adresse vérifiée technique, ou portée par GoTrue, ou identifiant GoTrue autre que l\'adresse technique d\'empreinte';
const W15 = (channel: string): string => `${channel} envoyé à un destinataire de démonstration`;
const W16 = 'message retenu « compte de démonstration » pour un destinataire réel';
const W17 = (n: number): string => `${n} paiements de billets en attente pour un compte et un événement`;
/** w18 : la date est formatée par Postgres (fuseau et style de la session) ; seul son cadre est fixé. */
const W18 = /^commission disponible le .+, avant la fin de l'événement \+ délai$/;
const W19 = 'écriture de frais sans versement confirmé, de montant ou de date incohérents';
const W20 = 'remboursement de billet demandé par l\'organisateur après la fin';
const W21 = 'marque d\'espèces sur un paiement en ligne';

/** Justification d'une décision admin conforme (10 caractères au moins, contrat B4). */
const REASON_OK = 'Statut SamirPay FAILED vérifié avant le renvoi';

/** Identifiants des lignes fabriquées par table (contrôle final après ROLLBACK). */
const FABRICATED = new Map<string, Set<string>>();
/** Objets cités par une règle sans ligne propre (journal de w2 : identifiant de versement inventé). */
const OBJECTS_ONLY = new Set<string>();
/** Tables dont les triggers ont été coupés dans une transaction (contrôle final : actifs). */
const TOUCHED = new Set<string>();

function track(table: string, id: string): string {
    const ids = FABRICATED.get(table) ?? new Set<string>();
    ids.add(id);
    FABRICATED.set(table, ids);
    return id;
}

after(async () => {
    await assertLot9bisInvariants('lot9bis-invariant');
});

// ── Outils locaux (dans la transaction annulée) ────────────────────────────

interface Scene { client: string; bis: string; partnerUser: string; admin: string }

/** Schéma présent (échec explicite sinon, AVANT tout DDL), triggers utilisateur des tables écrites coupés, puis scène lue dans la transaction. */
async function inScene<T>(label: string, tables: readonly string[], fn: (db: Client, s: Scene) => Promise<T>): Promise<T> {
    return inRolledBackTransaction(async (db) => {
        await assertLot9bisSchema(`lot9bis-invariant ${label}`, db);
        for (const table of tables) {
            await db.query(`ALTER TABLE public.${table} DISABLE TRIGGER USER`);
            TOUCHED.add(table);
        }
        return fn(db, await scene(db));
    });
}

/** Comptes du seed, lus sur la transaction (mêmes identifiants stables que loadFixtures). */
async function scene(db: Client): Promise<Scene> {
    const emails = [FIXTURE_USERS.CLIENT.email, FIXTURE_USERS.CLIENT_BIS.email, FIXTURE_USERS.PARTNER_A.email, FIXTURE_USERS.ADMIN.email];
    const { rows } = await db.query<{ id: string; email: string }>('SELECT id::text AS id, email FROM public.users WHERE email = ANY($1::text[])', [emails]);
    const idOf = (email: string): string => {
        const found = rows.find((u) => u.email === email);
        assert.ok(found, `fixture ${email} absente : seed de test incomplet`);
        return found.id;
    };
    return {
        client: idOf(FIXTURE_USERS.CLIENT.email),
        bis: idOf(FIXTURE_USERS.CLIENT_BIS.email),
        partnerUser: idOf(FIXTURE_USERS.PARTNER_A.email),
        admin: idOf(FIXTURE_USERS.ADMIN.email),
    };
}

/** Horodatage relatif à now() (début de la transaction), en minutes : négatif dans le passé. */
const at = (minutes: number): string => `now() + make_interval(mins => ${Math.trunc(minutes)})`;

/** INSERT générique : `values` en paramètres, `raw` en expressions SQL constantes du test. */
async function insert(db: Client, table: string, values: Row, raw: Record<string, string> = {}): Promise<void> {
    const cols = [...Object.keys(values), ...Object.keys(raw)];
    const exprs = [...Object.keys(values).map((_, i) => `$${i + 1}`), ...Object.values(raw)];
    await db.query(`INSERT INTO public.${table} (${cols.join(', ')}) VALUES (${exprs.join(', ')})`, Object.values(values));
}

/**
 * Ligne d'une table créée par le lot : seules les colonnes du contrat (6.2) sont écrites ; `optional` complète une
 * colonne seulement si elle existe. Une colonne obligatoire sans défaut, inconnue du contrat, fait échouer le cas en
 * la nommant (jamais une erreur Postgres brute).
 */
async function insertLotRow(db: Client, table: string, values: Row, optional: Row = {}): Promise<void> {
    const { rows } = await db.query<{ column_name: string; required: boolean }>(
        `SELECT column_name, (is_nullable = 'NO' AND column_default IS NULL AND is_identity = 'NO' AND is_generated = 'NEVER') AS required
           FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [table]);
    const existing = new Set(rows.map((r) => r.column_name));
    const chosen: Row = { ...values };
    for (const [k, v] of Object.entries(optional)) if (existing.has(k) && !(k in chosen)) chosen[k] = v;
    const uncovered = rows.filter((r) => r.required && !(r.column_name in chosen)).map((r) => r.column_name);
    assert.deepEqual(uncovered, [], `public.${table} : colonne(s) obligatoire(s) sans défaut, absente(s) du contrat 6.2 : ${uncovered.join(', ')}`);
    await insert(db, table, chosen);
}

async function insertPartner(db: Client, userId: string, status: 'VALIDE' | 'SUSPENDU'): Promise<string> {
    const id = track('partners', randomUUID());
    await db.query('INSERT INTO public.partners (id, user_id, company_name, status) VALUES ($1, $2, $3, $4::public.partner_status)',
        [id, userId, `TEST Invariant lot 9 bis ${id.slice(0, 8)}`, status]);
    return id;
}

/** Événement fabriqué, début dans `days` jours à 20:00, fin le même jour à 23:00. */
async function insertEvent(db: Client, partnerId: string, status: 'PUBLIE' | 'SUSPENDU' | 'TERMINE', days = 30): Promise<string> {
    const id = track('events', randomUUID());
    await db.query(
        `INSERT INTO public.events (id, partner_id, title, slug, start_date, start_time, end_date, end_time, location, city, status)
         VALUES ($1, $2, $3, $4, current_date + $5::int, '20:00', current_date + $5::int, '23:00', 'Salle test', 'Dakar', $6::public.event_status)`,
        [id, partnerId, `TEST Invariant lot 9 bis ${id.slice(0, 8)}`, `test-lot9bis-inv-${id}`, days, status]);
    return id;
}

async function insertCategory(db: Client, eventId: string): Promise<string> {
    const id = track('ticket_categories', randomUUID());
    await db.query(
        `INSERT INTO public.ticket_categories (id, event_id, name, price, total_quantity, sold_quantity, is_active, is_visible, max_per_order)
         VALUES ($1, $2, $3, 0, 50, 0, TRUE, TRUE, 10)`, [id, eventId, `TEST Invariant lot 9 bis ${id.slice(0, 8)}`]);
    return id;
}

/** Événement PUBLIE d'une partenaire VALIDE et une catégorie : support des billets fabriqués. */
async function ticketStage(db: Client, s: Scene, days = 30): Promise<{ eventId: string; categoryId: string }> {
    const eventId = await insertEvent(db, await insertPartner(db, s.partnerUser, 'VALIDE'), 'PUBLIE', days);
    return { eventId, categoryId: await insertCategory(db, eventId) };
}

async function insertTicket(db: Client, stage: { eventId: string; categoryId: string }, userId: string,
    over: { status?: 'VALIDE' | 'ANNULE' | 'UTILISE'; locked?: boolean } = {}): Promise<string> {
    const id = track('tickets', randomUUID());
    await db.query(
        `INSERT INTO public.tickets (id, event_id, category_id, user_id, ticket_number, price, qr_code, status, sale_channel, transfer_locked, sale_decision)
         VALUES ($1, $2, $3, $4, $5, 0, $6, $7::public.ticket_status, 'ONLINE', $8, $9::jsonb)`,
        [id, stage.eventId, stage.categoryId, userId, `TCK-LOT9BIS-INV-${id.slice(0, 8)}`, `EV-QR-LOT9BIS-INV-${id}`,
            over.status ?? 'VALIDE', over.locked ?? false,
            JSON.stringify({ source: 'CATEGORIE', sale_online: true, sale_counter: true, decided_at: '2026-11-09T12:00:00+00:00' })]);
    return id;
}

interface TransferSpec {
    status?: 'PENDING' | 'CLAIMED' | 'CANCELLED' | 'EXPIRED';
    from?: string | null;
    to?: string;
    /** Destinataire inscrit (exigé par chk_ticket_transfers_claimed pour un transfert CLAIMED). */
    toUser?: string;
    createdAt?: number;
    expiresAt?: number;
    claimedAt?: number;
}

async function insertTransfer(db: Client, ticketId: string, over: TransferSpec = {}): Promise<string> {
    const id = track('ticket_transfers', randomUUID());
    const raw: Record<string, string> = {
        created_at: at(over.createdAt ?? 0),
        expires_at: at(over.expiresAt ?? 60),
    };
    if (over.claimedAt !== undefined) raw.claimed_at = at(over.claimedAt);
    if (over.status === 'CANCELLED') raw.cancelled_at = at(0);
    if (over.status === 'EXPIRED') raw.expired_at = at(0);
    await insert(db, 'ticket_transfers', {
        id, ticket_id: ticketId, from_user_id: over.from === undefined ? null : over.from,
        to_phone_or_email: over.to ?? randomSenegalPhone('77'), status: over.status ?? 'PENDING', to_user_id: over.toUser ?? null,
    }, raw);
    return id;
}

async function insertScan(db: Client, ticketId: string, eventId: string, scannerId: string, minutes: number): Promise<string> {
    const id = track('ticket_scans', randomUUID());
    await insert(db, 'ticket_scans', { id, ticket_id: ticketId, event_id: eventId, scanner_id: scannerId, result: 'valid', accepted: true, method: 'QR' },
        { created_at: at(minutes) });
    return id;
}

interface CashoutSpec {
    kind?: 'REFUND' | 'EVENT_CANCELLATION_REFUND' | 'TICKET_REFUND' | 'WITHDRAWAL';
    status: 'A_ENVOYER' | 'ENVOYE' | 'CONFIRME' | 'ECHOUE' | 'INCERTAIN';
    blockedReason?: string;
    createdAt?: number;
    sentAt?: number;
    providerStatus?: string;
    reference?: string;
    fees?: number;
    refundId?: string;
    withdrawalId?: string;
}

async function insertCashout(db: Client, spec: CashoutSpec): Promise<string> {
    const id = track('cashouts', randomUUID());
    const values: Row = { id, kind: spec.kind ?? 'REFUND', idempotency_key: `LOT9BIS-INV-${id}`, amount: 1000, status: spec.status };
    if (spec.blockedReason !== undefined) values.blocked_reason = spec.blockedReason;
    if (spec.providerStatus !== undefined) values.provider_status = spec.providerStatus;
    if (spec.reference !== undefined) values.samirpay_reference = spec.reference;
    if (spec.fees !== undefined) values.samirpay_fees = spec.fees;
    if (spec.refundId !== undefined) values.refund_id = spec.refundId;
    if (spec.withdrawalId !== undefined) values.withdrawal_id = spec.withdrawalId;
    const raw: Record<string, string> = { created_at: at(spec.createdAt ?? 0) };
    if (spec.sentAt !== undefined) raw.sent_at = at(spec.sentAt);
    await insert(db, 'cashouts', values, raw);
    return id;
}

async function insertAudit(db: Client, spec: { action: string; objectType: string; objectId: string; userId?: string | null; metadata?: Row; oldValue?: Row; newValue?: Row; createdAt?: number }): Promise<string> {
    const id = track('audit_logs', randomUUID());
    await insert(db, 'audit_logs', {
        id, user_id: spec.userId ?? null, action: spec.action, object_type: spec.objectType, object_id: spec.objectId,
        old_value: spec.oldValue ? JSON.stringify(spec.oldValue) : null, new_value: spec.newValue ? JSON.stringify(spec.newValue) : null,
        metadata: JSON.stringify(spec.metadata ?? {}),
    }, { created_at: at(spec.createdAt ?? 0) });
    return id;
}

interface PaymentSpec { client: string | null; eventId: string | null; status?: 'PENDING' | 'SUCCESS'; platform?: boolean }

async function insertPayment(db: Client, spec: PaymentSpec): Promise<string> {
    const id = track('payments', randomUUID());
    const platform = spec.platform ?? true;
    await db.query(
        `INSERT INTO public.payments (id, transaction_id, client_id, event_id, payment_target, amount, status, is_platform_payment, offline_payment_method,
                                      facial_amount, service_fee, aggregator_fee, net_event_village_revenue, partner_payout_amount)
         VALUES ($1, $2, $3, $4, 'TICKET', 1000, $5::public.payment_status_enum, $6, $7::public.offline_payment_method_enum, 1000, 0, 0, 0, 1000)`,
        [id, `TX-LOT9BIS-INV-${id}`, spec.client, spec.eventId, spec.status ?? 'SUCCESS', platform, platform ? null : 'ESPECES']);
    return id;
}

async function insertRefund(db: Client, paymentId: string): Promise<string> {
    const id = track('refunds', randomUUID());
    await insert(db, 'refunds', { id, payment_id: paymentId, refund_transaction_id: `RF-LOT9BIS-INV-${id}`, amount: 1000, reason: 'TEST invariant lot 9 bis' });
    return id;
}

async function insertLedger(db: Client, spec: { owner: string; entryType: 'REMBOURSEMENT' | 'REGULARISATION'; amount: number; availableAt: string; sourceKey: string; refundId?: string }): Promise<string> {
    const id = track('finance_ledger', randomUUID());
    await insert(db, 'finance_ledger', {
        id, owner_id: spec.owner, account_kind: 'ORGANISATEUR', entry_type: spec.entryType, amount: spec.amount,
        available_at: spec.availableAt, source_key: spec.sourceKey, refund_id: spec.refundId ?? null, description: 'violation fabriquée (lot 9 bis)',
    });
    return id;
}

interface OutboxSpec {
    type?: string;
    channel: 'SMS' | 'EMAIL' | 'PUSH' | 'IN_APP';
    status: 'SENT' | 'SKIPPED';
    user?: string;
    phone?: string;
    email?: string;
    eventId?: string;
    reason?: string;
    decision?: Row;
}

async function insertOutbox(db: Client, spec: OutboxSpec): Promise<string> {
    const id = track('notification_outbox', randomUUID());
    const key = `LOT9BIS-INV:${id}`;
    const raw: Record<string, string> = { due_at: 'now()', next_attempt_at: 'now()' };
    if (spec.status === 'SENT') raw.sent_at = 'now()';
    else raw.finished_at = 'now()';
    await insert(db, 'notification_outbox', {
        id, idempotency_key: key, group_key: key, type: spec.type ?? 'PHONE_CHANGED', family: 'ESSENTIAL', channel: spec.channel,
        status: spec.status, recipient_user_id: spec.user ?? null, recipient_phone: spec.phone ?? null, recipient_email: spec.email ?? null,
        event_id: spec.eventId ?? null, reason: spec.status === 'SKIPPED' ? (spec.reason ?? 'TEST') : null,
        decision: spec.decision ? JSON.stringify(spec.decision) : null,
    }, raw);
    return id;
}

/** Ligne d'historique de statut, support d'une trace de cascade (suspended_history_id). */
async function insertHistory(db: Client, eventId: string, actor: string): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
        `INSERT INTO public.event_status_history (event_id, old_status, new_status, actor_id, actor_role, reason, channel)
         VALUES ($1, 'PUBLIE', 'SUSPENDU', $2, 'ADMIN', 'Organisateur suspendu', 'TRANSITION') RETURNING id::text AS id`, [eventId, actor]);
    return rows[0].id;
}

/** Trace de cascade (contrat B16, table de M06) : ouverte, ou fermée `LEFT_CHANGED`. */
async function insertCascade(db: Client, s: Scene, partnerId: string, eventId: string, open: boolean): Promise<void> {
    const historyId = await insertHistory(db, eventId, s.admin);
    await insertLotRow(db, 'partner_suspension_cascades', {
        partner_id: partnerId, event_id: eventId, suspended_history_id: historyId,
        closed_at: open ? null : new Date().toISOString(), outcome: open ? null : 'LEFT_CHANGED',
    }, { created_at: new Date().toISOString(), suspended_at: new Date().toISOString() });
}

function about(rows: Lot9bisViolation[], objet: string): string {
    return JSON.stringify(rows.filter((r) => r.objet === objet));
}

function assertDetected(rows: Lot9bisViolation[], regle: string, objet: string, detail: string | RegExp, what: string): void {
    const match = (d: string): boolean => (typeof detail === 'string' ? d === detail : detail.test(d));
    assert.ok(rows.some((r) => r.regle === regle && r.objet === objet && match(r.detail)), `${what} : « (${regle}) ${String(detail)} » attendu : ${about(rows, objet)}`);
}

function assertClean(rows: Lot9bisViolation[], objet: string, what: string): void {
    assert.deepEqual(rows.filter((r) => r.objet === objet), [], `${what} : aucune violation attendue : ${about(rows, objet)}`);
}

// ── Garde de schéma : un objet retiré est nommé ────────────────────────────

/** `parent` : objet qui porte celui-ci (table d'une colonne) ; absent, la garde le nomme à sa place et le cas échoue avant toute coupure. */
interface GuardCase { what: string; needle: string; parent?: string; remove: (db: Client) => Promise<unknown> }

const dropTable = (table: string): GuardCase => ({
    what: `table ${table}`, needle: `table public.${table} `, remove: (db) => db.query(`DROP TABLE public.${table} CASCADE`),
});

const dropColumn = (table: string, column: string): GuardCase => ({
    what: `colonne ${table}.${column}`, needle: `colonne public.${table}.${column} `, parent: `table public.${table} `, remove: (db) => db.query(`ALTER TABLE public.${table} DROP COLUMN ${column} CASCADE`),
});

const dropFunction = (signature: string): GuardCase => ({
    what: `fonction ${signature}`, needle: `fonction public.${signature} `, remove: (db) => db.query(`DROP FUNCTION public.${signature} CASCADE`),
});

const GUARD_CASES: readonly GuardCase[] = [
    dropTable('partner_suspension_cascades'),
    dropTable('event_start_changes'),
    dropTable('event_cash_refund_marks'),
    dropTable('password_confirmations'),
    dropTable('email_verifications'),
    dropTable('controller_invitations'),
    ...(['suspended_history_id', 'outcome'] as const).map((c) => dropColumn('partner_suspension_cascades', c)),
    dropColumn('cashouts', 'delay_flagged_at'),
    dropColumn('cashouts', 'samirpay_fees'),
    dropColumn('cashouts', 'samirpay_net_amount'),
    dropColumn('cashouts', 'samirpay_ref_operator'),
    dropColumn('cashouts', 'samirpay_reference'),
    dropColumn('payments', 'samirpay_fees'),
    dropColumn('ticket_transfers', 'declined_at'),
    dropColumn('users', 'email_verified_at'),
    dropColumn('users', 'email_pending'),
    dropColumn('users', 'demo_account'),
    dropColumn('partners', 'ninea'),
    dropColumn('partners', 'rccm'),
    dropColumn('partners', 'resubmitted_at'),
    {
        what: 'valeur DECLINED de ticket_transfer_status',
        needle: 'valeur DECLINED',
        remove: (db) => db.query(`ALTER TYPE public.ticket_transfer_status RENAME VALUE 'DECLINED' TO 'DECLINED_RETIRE_PAR_LE_TEST'`),
    },
    dropFunction('cashouts_to_resume()'),
    dropFunction('admin_can(uuid,text)'),
    dropFunction('fin_frozen_amount(uuid,text,timestamptz)'),
    dropFunction('event_end_from_v2(date,time,date,time)'),
    {
        what: 'ligne de transition SUSPENDU → TERMINE (ADMIN)',
        needle: '(SUSPENDU, TERMINE, ADMIN)',
        remove: (db) => db.query(`DELETE FROM public.event_status_transitions WHERE from_status = 'SUSPENDU' AND to_status = 'TERMINE' AND actor_kind = 'ADMIN'`),
    },
    ...(['REFUND_DELAYED', 'TICKET_CANCELLED', 'EMAIL_VERIFICATION', 'SHIFT_OPEN_AT_END'] as const).map((type): GuardCase => ({
        what: `type ${type} au registre`,
        needle: `type ${type} `,
        remove: async (db) => {
            await db.query('DELETE FROM public.notification_outbox WHERE type = $1', [type]);
            await db.query('DELETE FROM public.notification_types WHERE type = $1', [type]);
        },
    })),
];

describe('Lot 9 bis, garde de schéma : chaque objet retiré est nommé, jamais un faux vert', () => {
    for (const c of GUARD_CASES) {
        test(`${c.what} : présent, puis retiré dans une transaction annulée, la garde le nomme`, async () => {
            await inRolledBackTransaction(async (db) => {
                const before = (await missingLot9bisSchema(db)).filter((m) => m.includes(c.needle) || (c.parent !== undefined && m.includes(c.parent)));
                assert.deepEqual(before, [], `${c.what} : l'objet doit exister avant la coupure (migrations 20261109000001 à …12 du lot) : ${before.join(' ; ')}`);

                await c.remove(db);

                const missing = await missingLot9bisSchema(db);
                assert.ok(missing.some((m) => m.includes(c.needle)), `${c.what} : la garde doit nommer l'objet retiré : ${JSON.stringify(missing)}`);
                await assert.rejects(assertLot9bisSchema('lot9bis-invariant garde', db), (err: Error) => err.message.includes(c.needle), `${c.what} : assertLot9bisSchema doit échouer en le citant`);
                await assert.rejects(lot9bisViolations(db), (err: Error) => err.message.includes(c.needle), `${c.what} : lot9bisViolations ne doit jamais passer sans l'objet`);
            });
        });
    }
});

// ── Violations fabriquées : versements ─────────────────────────────────────

describe('Lot 9 bis Invariants (w1) à (w4) : versements', () => {
    test('w1 : A_ENVOYER, ENVOYE et INCERTAIN anciens absents de la liste ; témoins : ancien listé, récent, confirmé, simulé, envoyé récemment', async () => {
        const ids = { aEnvoyer: '', envoye: '', incertain: '', listed: '', recent: '', confirme: '', simule: '', sentRecently: '' };
        const rows = await inScene('w1', ['cashouts'], async (db) => {
            ids.aEnvoyer = await insertCashout(db, { kind: 'TICKET_REFUND', status: 'A_ENVOYER', createdAt: -60 });
            ids.envoye = await insertCashout(db, { kind: 'WITHDRAWAL', status: 'ENVOYE', createdAt: -120, sentAt: -45 });
            ids.incertain = await insertCashout(db, { kind: 'REFUND', status: 'INCERTAIN', createdAt: -90, blockedReason: 'SOLDE_INSUFFISANT' });
            ids.listed = await insertCashout(db, { kind: 'EVENT_CANCELLATION_REFUND', status: 'A_ENVOYER', createdAt: -60 });
            ids.recent = await insertCashout(db, { status: 'A_ENVOYER', createdAt: -5 });
            ids.confirme = await insertCashout(db, { status: 'CONFIRME', createdAt: -120 });
            ids.simule = await insertCashout(db, { status: 'A_ENVOYER', createdAt: -120, blockedReason: 'SIMULATED' });
            ids.sentRecently = await insertCashout(db, { status: 'ENVOYE', createdAt: -120, sentAt: -5 });

            const { rows: sig } = await db.query<{ result: string }>(`SELECT pg_get_function_result('public.cashouts_to_resume()'::regprocedure) AS result`);
            await db.query(`CREATE OR REPLACE FUNCTION public.cashouts_to_resume() RETURNS ${sig[0].result} LANGUAGE plpgsql AS $fn$
                BEGIN id := '${ids.listed}'::uuid; RETURN NEXT; END $fn$`);
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w1', ids.aEnvoyer, W1('TICKET_REFUND', 'A_ENVOYER'), '(w1) A_ENVOYER');
        assertDetected(rows, 'w1', ids.envoye, W1('WITHDRAWAL', 'ENVOYE'), '(w1) ENVOYE');
        assertDetected(rows, 'w1', ids.incertain, W1('REFUND', 'INCERTAIN'), '(w1) INCERTAIN bloqué');
        assertClean(rows, ids.listed, '(w1) témoin ancien rendu par cashouts_to_resume()');
        assertClean(rows, ids.recent, '(w1) témoin de moins de 30 min');
        assertClean(rows, ids.confirme, '(w1) témoin confirmé');
        assertClean(rows, ids.simule, '(w1) témoin bloqué SIMULATED');
        assertClean(rows, ids.sentRecently, '(w1) témoin envoyé il y a 5 min');
    });

    test('w2 : INCERTAIN renvoyé sans décision, avec un motif court, sans auteur ; témoins : décision justifiée, autre passage', async () => {
        const ids = { none: '', short: '', anonymous: '', justified: '', notIncertain: '', confirmed: '' };
        const rows = await inScene('w2', [], async (db, s) => {
            const resend = async (id: string, to: 'A_ENVOYER' | 'ENVOYE', from = 'INCERTAIN'): Promise<string> => {
                await insertAudit(db, { action: 'UPDATE', objectType: 'cashouts', objectId: id, oldValue: { status: from }, newValue: { status: to } });
                return id;
            };
            const invented = (): string => {
                const id = randomUUID();
                OBJECTS_ONLY.add(id);
                return id;
            };
            ids.none = await resend(invented(), 'A_ENVOYER');
            ids.short = await resend(invented(), 'ENVOYE');
            await insertAudit(db, { action: 'CASHOUT_RESENT', objectType: 'cashouts', objectId: ids.short, userId: s.admin, metadata: { reason: 'court' } });
            ids.anonymous = await resend(invented(), 'A_ENVOYER');
            await insertAudit(db, { action: 'CASHOUT_RESENT', objectType: 'cashouts', objectId: ids.anonymous, userId: null, metadata: { reason: REASON_OK } });
            ids.justified = await resend(invented(), 'A_ENVOYER');
            await insertAudit(db, { action: 'CASHOUT_RESENT', objectType: 'cashouts', objectId: ids.justified, userId: s.admin, metadata: { reason: REASON_OK } });
            ids.notIncertain = await resend(invented(), 'ENVOYE', 'A_ENVOYER');
            ids.confirmed = invented();
            await insertAudit(db, { action: 'UPDATE', objectType: 'cashouts', objectId: ids.confirmed, oldValue: { status: 'INCERTAIN' }, newValue: { status: 'CONFIRME' } });
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w2', ids.none, W2, '(w2) sans décision');
        assertDetected(rows, 'w2', ids.short, W2, '(w2) motif de moins de 10 caractères');
        assertDetected(rows, 'w2', ids.anonymous, W2, '(w2) décision sans auteur');
        assertClean(rows, ids.justified, '(w2) témoin décision justifiée');
        assertClean(rows, ids.notIncertain, '(w2) témoin A_ENVOYER → ENVOYE');
        assertClean(rows, ids.confirmed, '(w2) témoin INCERTAIN → CONFIRME');
    });

    test('w3 : « Marquer versé » sans référence, sans journal, sans auteur, référence vide ; témoins : journal complet, confirmé par SamirPay', async () => {
        const ids = { noRef: '', noAudit: '', anonymous: '', emptyRef: '', ok: '', provider: '' };
        const rows = await inScene('w3', ['cashouts'], async (db, s) => {
            const marked = async (reference: string | undefined, audit: { userId: string | null; reference: string } | null): Promise<string> => {
                const id = await insertCashout(db, { status: 'CONFIRME', providerStatus: 'MANUEL', reference });
                if (audit) await insertAudit(db, { action: 'CASHOUT_MARKED_PAID', objectType: 'cashouts', objectId: id, userId: audit.userId, metadata: { reason: REASON_OK, reference: audit.reference } });
                return id;
            };
            ids.noRef = await marked(undefined, { userId: s.admin, reference: 'SP-REF-001' });
            ids.noAudit = await marked('SP-REF-002', null);
            ids.anonymous = await marked('SP-REF-003', { userId: null, reference: 'SP-REF-003' });
            ids.emptyRef = await marked('SP-REF-004', { userId: s.admin, reference: '' });
            ids.ok = await marked('SP-REF-005', { userId: s.admin, reference: 'SP-REF-005' });
            ids.provider = await insertCashout(db, { status: 'CONFIRME', providerStatus: 'SUCCESS' });
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w3', ids.noRef, W3, '(w3) sans référence');
        assertDetected(rows, 'w3', ids.noAudit, W3, '(w3) sans journal');
        assertDetected(rows, 'w3', ids.anonymous, W3, '(w3) journal sans auteur');
        assertDetected(rows, 'w3', ids.emptyRef, W3, '(w3) référence vide au journal');
        assertClean(rows, ids.ok, '(w3) témoin journal complet');
        assertClean(rows, ids.provider, '(w3) témoin confirmé par SamirPay');
    });

    test('w4 : retrait incohérent avec son versement (4 cas) ; témoins : 4 couples cohérents', async () => {
        const pairs: Array<[string, string, boolean]> = [
            ['PENDING', 'CONFIRME', true], ['PAID', 'ECHOUE', true], ['REJECTED', 'INCERTAIN', true], ['PAID', 'ENVOYE', true],
            ['PAID', 'CONFIRME', false], ['REJECTED', 'ECHOUE', false], ['PROCESSING', 'INCERTAIN', false], ['PENDING', 'A_ENVOYER', false],
        ];
        const made: Array<[string, string, string, boolean]> = [];
        const rows = await inScene('w4', ['withdrawals', 'cashouts'], async (db, s) => {
            for (const [wStatus, cStatus, bad] of pairs) {
                const wid = track('withdrawals', randomUUID());
                await insert(db, 'withdrawals', {
                    id: wid, user_id: s.partnerUser, gross_amount: 5000, fee_rate: 1, fee_amount: 50, net_amount: 4950,
                    withdrawal_method: 'MOBILE_MONEY', payment_details: JSON.stringify({}), status: wStatus, account_kind: 'ORGANISATEUR',
                });
                const cid = await insertCashout(db, { kind: 'WITHDRAWAL', status: cStatus as CashoutSpec['status'], withdrawalId: wid });
                await db.query('UPDATE public.withdrawals SET cashout_id = $2 WHERE id = $1', [wid, cid]);
                made.push([wid, wStatus, cStatus, bad]);
            }
            return lot9bisViolations(db);
        });
        for (const [wid, wStatus, cStatus, bad] of made) {
            if (bad) assertDetected(rows, 'w4', wid, W4(wStatus, cStatus), `(w4) retrait ${wStatus} / versement ${cStatus}`);
            else assertClean(rows, wid, `(w4) témoin retrait ${wStatus} / versement ${cStatus}`);
        }
    });
});

// ── Violations fabriquées : cascade de suspension ──────────────────────────

describe('Lot 9 bis Invariants (w5) à (w7) : cascade de suspension d\'une partenaire', () => {
    test('w5 : événement PUBLIE d\'une partenaire SUSPENDU ; témoins : SUSPENDU de la même partenaire, PUBLIE d\'une partenaire VALIDE', async () => {
        const ids = { published: '', suspended: '', valid: '' };
        const rows = await inScene('w5', ['partners', 'events'], async (db, s) => {
            const suspendue = await insertPartner(db, s.partnerUser, 'SUSPENDU');
            const valide = await insertPartner(db, s.partnerUser, 'VALIDE');
            ids.published = await insertEvent(db, suspendue, 'PUBLIE');
            ids.suspended = await insertEvent(db, suspendue, 'SUSPENDU');
            ids.valid = await insertEvent(db, valide, 'PUBLIE');
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w5', ids.published, W5, '(w5)');
        assertClean(rows, ids.suspended, '(w5) témoin événement suspendu');
        assertClean(rows, ids.valid, '(w5) témoin partenaire validée');
    });

    test('w6 : trace ouverte sur un événement PUBLIE ; témoins : trace ouverte sur un SUSPENDU, trace fermée sur un PUBLIE', async () => {
        const ids = { open: '', openSuspended: '', closed: '' };
        const rows = await inScene('w6', ['partners', 'events', 'event_status_history'], async (db, s) => {
            const suspendue = await insertPartner(db, s.partnerUser, 'SUSPENDU');
            const valide = await insertPartner(db, s.partnerUser, 'VALIDE');
            ids.open = await insertEvent(db, suspendue, 'PUBLIE');
            await insertCascade(db, s, suspendue, ids.open, true);
            ids.openSuspended = await insertEvent(db, suspendue, 'SUSPENDU');
            await insertCascade(db, s, suspendue, ids.openSuspended, true);
            ids.closed = await insertEvent(db, valide, 'PUBLIE');
            await insertCascade(db, s, valide, ids.closed, false);
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w6', ids.open, W6, '(w6)');
        assertClean(rows, ids.openSuspended, '(w6) témoin trace ouverte, événement suspendu');
        assertClean(rows, ids.closed, '(w6) témoin trace fermée');
    });

    test('w7 : trace ouverte d\'une partenaire réactivée ; témoins : partenaire encore suspendue, trace fermée', async () => {
        const ids = { reactivated: '', stillSuspended: '', closed: '' };
        const rows = await inScene('w7', ['partners', 'events', 'event_status_history'], async (db, s) => {
            const suspendue = await insertPartner(db, s.partnerUser, 'SUSPENDU');
            const valide = await insertPartner(db, s.partnerUser, 'VALIDE');
            ids.reactivated = await insertEvent(db, valide, 'SUSPENDU');
            await insertCascade(db, s, valide, ids.reactivated, true);
            ids.stillSuspended = await insertEvent(db, suspendue, 'SUSPENDU');
            await insertCascade(db, s, suspendue, ids.stillSuspended, true);
            ids.closed = await insertEvent(db, valide, 'SUSPENDU');
            await insertCascade(db, s, valide, ids.closed, false);
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w7', ids.reactivated, W7, '(w7)');
        assertClean(rows, ids.stillSuspended, '(w7) témoin partenaire suspendue');
        assertClean(rows, ids.closed, '(w7) témoin trace fermée');
    });
});

// ── Violations fabriquées : transferts ─────────────────────────────────────

const TICKET_TABLES = ['partners', 'events', 'ticket_categories', 'tickets', 'ticket_transfers', 'ticket_scans'] as const;

describe('Lot 9 bis Invariants (w8) à (w11) : transferts', () => {
    test('w8 : entrée acceptée pendant un transfert en attente ; témoins : après l\'acceptation du transfert, avant le transfert, après l\'échéance', async () => {
        const ids = { during: '', afterClaim: '', before: '', afterExpiry: '' };
        const rows = await inScene('w8', TICKET_TABLES, async (db, s) => {
            const stage = await ticketStage(db, s);
            const scanAround = async (transfer: TransferSpec, scanAt: number): Promise<string> => {
                const ticket = await insertTicket(db, stage, s.client, { locked: transfer.status === 'PENDING' });
                await insertTransfer(db, ticket, { from: s.client, ...transfer });
                return insertScan(db, ticket, stage.eventId, s.partnerUser, scanAt);
            };
            ids.during = await scanAround({ status: 'PENDING', createdAt: -120, expiresAt: 60 }, -60);
            ids.afterClaim = await scanAround({ status: 'CLAIMED', toUser: s.bis, createdAt: -120, expiresAt: 60, claimedAt: -90 }, -60);
            ids.before = await scanAround({ status: 'PENDING', createdAt: -120, expiresAt: 60 }, -180);
            ids.afterExpiry = await scanAround({ status: 'PENDING', createdAt: -180, expiresAt: -120 }, -60);
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w8', ids.during, W8, '(w8)');
        assertClean(rows, ids.afterClaim, '(w8) témoin après l\'acceptation');
        assertClean(rows, ids.before, '(w8) témoin avant le transfert');
        assertClean(rows, ids.afterExpiry, '(w8) témoin après l\'échéance (B56)');
    });

    test('w9 : transfert en attente sur un billet ANNULE ; témoins : en attente sur un VALIDE, annulé sur un ANNULE', async () => {
        const ids = { pendingCancelled: '', pendingValid: '', cancelledCancelled: '' };
        const rows = await inScene('w9', TICKET_TABLES, async (db, s) => {
            const stage = await ticketStage(db, s);
            ids.pendingCancelled = await insertTransfer(db, await insertTicket(db, stage, s.client, { status: 'ANNULE', locked: true }), { from: s.client });
            ids.pendingValid = await insertTransfer(db, await insertTicket(db, stage, s.client, { locked: true }), { from: s.client });
            ids.cancelledCancelled = await insertTransfer(db, await insertTicket(db, stage, s.client, { status: 'ANNULE' }), { from: s.client, status: 'CANCELLED' });
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w9', ids.pendingCancelled, W9('ANNULE'), '(w9)');
        assertClean(rows, ids.pendingValid, '(w9) témoin billet VALIDE');
        assertClean(rows, ids.cancelledCancelled, '(w9) témoin transfert annulé');
    });

    test('w10 : billet verrouillé sans transfert, transfert sur un billet non verrouillé ; témoins : verrouillé avec transfert, libre sans transfert', async () => {
        const ids = { lockedAlone: '', openWithTransfer: '', lockedWithTransfer: '', freeAlone: '' };
        const rows = await inScene('w10', TICKET_TABLES, async (db, s) => {
            const stage = await ticketStage(db, s);
            ids.lockedAlone = await insertTicket(db, stage, s.client, { locked: true });
            await insertTransfer(db, ids.lockedAlone, { from: s.client, status: 'EXPIRED' });
            ids.openWithTransfer = await insertTicket(db, stage, s.client, { locked: false });
            await insertTransfer(db, ids.openWithTransfer, { from: s.client });
            ids.lockedWithTransfer = await insertTicket(db, stage, s.client, { locked: true });
            await insertTransfer(db, ids.lockedWithTransfer, { from: s.client });
            ids.freeAlone = await insertTicket(db, stage, s.client, { locked: false });
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w10', ids.lockedAlone, W10_LOCKED, '(w10) verrou sans transfert');
        assertDetected(rows, 'w10', ids.openWithTransfer, W10_OPEN, '(w10) transfert sans verrou');
        assertClean(rows, ids.lockedWithTransfer, '(w10) témoin verrouillé avec transfert');
        assertClean(rows, ids.freeAlone, '(w10) témoin libre sans transfert');
    });

    test('w11 : transfert vers le numéro de l\'expéditeur (formes +221…, 221… et 9 chiffres) ; témoins : autre numéro, email', async () => {
        const ids = { plus: '', bare: '', nine: '', other: '', email: '' };
        const rows = await inScene('w11', TICKET_TABLES, async (db, s) => {
            const { rows: me } = await db.query<{ phone: string | null }>('SELECT phone FROM public.users WHERE id = $1', [s.client]);
            const phone = me[0]?.phone;
            assert.ok(phone && /^\+221[0-9]{9}$/.test(phone), `fixture ${FIXTURE_USERS.CLIENT.email} : numéro +221 attendu, obtenu ${String(phone)}`);
            const stage = await ticketStage(db, s);
            const send = async (to: string): Promise<string> => insertTransfer(db, await insertTicket(db, stage, s.client, { locked: true }), { from: s.client, to });
            ids.plus = await send(phone);
            ids.bare = await send(phone.slice(1));
            ids.nine = await send(phone.slice(4));
            ids.other = await send(randomSenegalPhone('77'));
            ids.email = await send(`lot9bis-w11-${randomUUID()}@test.eventvillage.local`);
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w11', ids.plus, W11, '(w11) +221…');
        assertDetected(rows, 'w11', ids.bare, W11, '(w11) 221…');
        assertDetected(rows, 'w11', ids.nine, W11, '(w11) 9 chiffres');
        assertClean(rows, ids.other, '(w11) témoin autre numéro');
        assertClean(rows, ids.email, '(w11) témoin email');
    });
});

// ── Violations fabriquées : email ──────────────────────────────────────────

describe('Lot 9 bis Invariants (w12) à (w14) : email', () => {
    const anyEmail = (label: string): string => `lot9bis-${label}-${randomUUID()}@exemple.invalid`;

    test('w12 : email envoyé sans décision, puis avec verified faux ; témoins : verified vrai, lien de vérification, email retenu', async () => {
        const ids = { noDecision: '', notVerified: '', verified: '', verification: '', skipped: '' };
        const rows = await inScene('w12', [], async (db) => {
            ids.noDecision = await insertOutbox(db, { channel: 'EMAIL', status: 'SENT', email: anyEmail('w12') });
            ids.notVerified = await insertOutbox(db, { channel: 'EMAIL', status: 'SENT', email: anyEmail('w12'), decision: { email: { verified: false } } });
            ids.verified = await insertOutbox(db, { channel: 'EMAIL', status: 'SENT', email: anyEmail('w12'), decision: { email: { verified: true } } });
            ids.verification = await insertOutbox(db, { type: 'EMAIL_VERIFICATION', channel: 'EMAIL', status: 'SENT', email: anyEmail('w12') });
            ids.skipped = await insertOutbox(db, { channel: 'EMAIL', status: 'SKIPPED', email: anyEmail('w12'), reason: 'EMAIL_NOT_VERIFIED' });
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w12', ids.noDecision, W12('PHONE_CHANGED'), '(w12) sans décision');
        assertDetected(rows, 'w12', ids.notVerified, W12('PHONE_CHANGED'), '(w12) verified faux');
        assertClean(rows, ids.verified, '(w12) témoin adresse vérifiée');
        assertClean(rows, ids.verification, '(w12) témoin lien de vérification');
        assertClean(rows, ids.skipped, '(w12) témoin email retenu');
    });

    test('w13 : email envoyé à …@eventvillage.sn, …@deleted.eventvillage.sn, casse mêlée ; témoins : domaine voisin, email retenu', async () => {
        const ids = { root: '', deleted: '', mixed: '', neighbour: '', skipped: '' };
        const verified = { email: { verified: true } };
        const rows = await inScene('w13', [], async (db) => {
            ids.root = await insertOutbox(db, { channel: 'EMAIL', status: 'SENT', email: `u-${randomUUID()}@eventvillage.sn`, decision: verified });
            ids.deleted = await insertOutbox(db, { channel: 'EMAIL', status: 'SENT', email: `u-${randomUUID()}@deleted.eventvillage.sn`, decision: verified });
            ids.mixed = await insertOutbox(db, { channel: 'EMAIL', status: 'SENT', email: `u-${randomUUID()}@Comptes.EventVillage.SN`, decision: verified });
            ids.neighbour = await insertOutbox(db, { channel: 'EMAIL', status: 'SENT', email: `u-${randomUUID()}@noteventvillage.sn`, decision: verified });
            ids.skipped = await insertOutbox(db, { channel: 'EMAIL', status: 'SKIPPED', email: `u-${randomUUID()}@eventvillage.sn`, reason: 'NO_EMAIL' });
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w13', ids.root, W13, '(w13) @eventvillage.sn');
        assertDetected(rows, 'w13', ids.deleted, W13, '(w13) @deleted.eventvillage.sn');
        assertDetected(rows, 'w13', ids.mixed, W13, '(w13) casse mêlée');
        assertClean(rows, ids.neighbour, '(w13) témoin domaine voisin');
        assertClean(rows, ids.skipped, '(w13) témoin email retenu');
    });

    // Contre-vérification du lot 9 quinquies (point 2 ; test réécrit, signalé au rapport) : GoTrue ne porte plus l'adresse
    // vérifiée mais l'adresse technique d'empreinte secrète (la base la remet à chaque écriture de auth.users). Violations
    // fabriquées : adresse vérifiée qui recopie l'identifiant GoTrue (contraintes de réservation retirées dans la
    // transaction), adresse technique vérifiée. Avant : adresse vérifiée différente de l'authentification.
    test('w14 : adresse vérifiée qui recopie l\'identifiant GoTrue, adresse technique vérifiée ; témoins : adresse vérifiée réelle, copie non vérifiée', async () => {
        const ids = { copied: '', technical: '', real: '', unverified: '' };
        const rows = await inScene('w14', ['users'], async (db, s) => {
            await db.query('ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_verified_real_chk');
            await db.query('ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_verified_reserved_chk');
            const setEmail = async (userId: string, pub: string | null, verified: boolean): Promise<string> => {
                const p = await db.query(
                    `UPDATE public.users u SET email = COALESCE($2, (SELECT a.email FROM auth.users a WHERE a.id = u.id)),
                            email_verified_at = CASE WHEN $3 THEN now() END WHERE u.id = $1`, [userId, pub, verified]);
                assert.equal(p.rowCount, 1, `compte ${userId} : public.users introuvable`);
                return userId;
            };
            ids.copied = await setEmail(s.client, null, true);
            ids.technical = await setEmail(s.bis, `lot9bis-w14-${randomUUID()}@eventvillage.sn`, true);
            ids.real = await setEmail(s.partnerUser, `lot9bis-w14-reelle-${randomUUID()}@test.eventvillage.local`, true);
            ids.unverified = await setEmail(s.admin, null, false);
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w14', ids.copied, W14, '(w14) adresse vérifiée qui recopie l\'identifiant GoTrue');
        assertDetected(rows, 'w14', ids.technical, W14, '(w14) adresse technique');
        assertClean(rows, ids.real, '(w14) témoin adresse vérifiée réelle');
        assertClean(rows, ids.unverified, '(w14) témoin non vérifiée');
    });
});

// ── Violations fabriquées : comptes de démonstration ───────────────────────

describe('Lot 9 bis Invariants (w15), (w16) : comptes de démonstration (I1)', () => {
    /** Marque CLIENT_BIS comme compte de démonstration dans la transaction ; rend son numéro et son adresse. */
    async function markDemo(db: Client, userId: string): Promise<{ phone: string; email: string }> {
        const { rows } = await db.query<{ phone: string | null; email: string | null }>(
            'UPDATE public.users SET demo_account = TRUE WHERE id = $1 RETURNING phone, email', [userId]);
        assert.equal(rows.length, 1, `compte ${userId} : public.users introuvable`);
        const { phone, email } = rows[0];
        assert.ok(phone && /^\+221[0-9]{9}$/.test(phone) && email, `fixture ${FIXTURE_USERS.CLIENT_BIS.email} : numéro +221 et adresse attendus`);
        return { phone, email };
    }

    test('w15 : SMS au compte, SMS au numéro, email à l\'adresse, email @essai…invalid, push sur un événement de démonstration ; témoins : vrai destinataire, IN_APP, retenu', async () => {
        const ids = { smsUser: '', smsPhone: '', emailAddress: '', emailEssai: '', pushEvent: '', real: '', inApp: '', skipped: '' };
        const verified = { email: { verified: true } };
        const rows = await inScene('w15', ['users', 'partners', 'events'], async (db, s) => {
            const demo = await markDemo(db, s.bis);
            const demoEvent = await insertEvent(db, await insertPartner(db, s.bis, 'VALIDE'), 'PUBLIE');
            ids.smsUser = await insertOutbox(db, { channel: 'SMS', status: 'SENT', user: s.bis, phone: randomSenegalPhone('76') });
            ids.smsPhone = await insertOutbox(db, { channel: 'SMS', status: 'SENT', phone: demo.phone });
            ids.emailAddress = await insertOutbox(db, { channel: 'EMAIL', status: 'SENT', email: demo.email.toUpperCase(), decision: verified });
            ids.emailEssai = await insertOutbox(db, { channel: 'EMAIL', status: 'SENT', email: `seed-${randomUUID()}@essai.eventvillage.invalid`, decision: verified });
            ids.pushEvent = await insertOutbox(db, { channel: 'PUSH', status: 'SENT', user: s.client, eventId: demoEvent });
            ids.real = await insertOutbox(db, { channel: 'SMS', status: 'SENT', user: s.client, phone: randomSenegalPhone('77') });
            ids.inApp = await insertOutbox(db, { channel: 'IN_APP', status: 'SENT', user: s.bis });
            ids.skipped = await insertOutbox(db, { channel: 'SMS', status: 'SKIPPED', user: s.bis, phone: demo.phone, reason: 'DEMO_ACCOUNT' });
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w15', ids.smsUser, W15('SMS'), '(w15) SMS au compte');
        assertDetected(rows, 'w15', ids.smsPhone, W15('SMS'), '(w15) SMS au numéro');
        assertDetected(rows, 'w15', ids.emailAddress, W15('EMAIL'), '(w15) email à l\'adresse du compte');
        assertDetected(rows, 'w15', ids.emailEssai, W15('EMAIL'), '(w15) email @essai.eventvillage.invalid');
        assertDetected(rows, 'w15', ids.pushEvent, W15('PUSH'), '(w15) push sur un événement de démonstration');
        assertClean(rows, ids.real, '(w15) témoin vrai destinataire');
        assertClean(rows, ids.inApp, '(w15) témoin IN_APP');
        assertClean(rows, ids.skipped, '(w15) témoin retenu DEMO_ACCOUNT');
    });

    test('w16 : retenue DEMO_ACCOUNT pour un vrai compte ; témoins : retenue pour le compte de démonstration, autre motif pour un vrai compte', async () => {
        const ids = { real: '', demo: '', otherReason: '' };
        const rows = await inScene('w16', ['users'], async (db, s) => {
            const demo = await markDemo(db, s.bis);
            ids.real = await insertOutbox(db, { channel: 'SMS', status: 'SKIPPED', user: s.client, phone: randomSenegalPhone('77'), reason: 'DEMO_ACCOUNT' });
            ids.demo = await insertOutbox(db, { channel: 'SMS', status: 'SKIPPED', phone: demo.phone, reason: 'DEMO_ACCOUNT' });
            ids.otherReason = await insertOutbox(db, { channel: 'SMS', status: 'SKIPPED', user: s.client, phone: randomSenegalPhone('78'), reason: 'QUIET_HOURS' });
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w16', ids.real, W16, '(w16)');
        assertClean(rows, ids.demo, '(w16) témoin compte de démonstration');
        assertClean(rows, ids.otherReason, '(w16) témoin autre motif');
    });
});

// ── Violations fabriquées : paiements, commissions, frais, remboursements, espèces ──

describe('Lot 9 bis Invariants (w17) à (w21) : paiements, commissions, frais, remboursements, espèces', () => {
    test('w17 : deux paiements de billets PENDING du même compte pour le même événement ; témoins : un PENDING et un réussi, deux comptes, deux événements', async () => {
        const ids = { first: '', second: '', pendingAlone: '', success: '', otherClient: '', bisPending: '', eventOne: '', eventTwo: '' };
        const rows = await inScene('w17', ['partners', 'events', 'payments'], async (db, s) => {
            const partner = await insertPartner(db, s.partnerUser, 'VALIDE');
            const [e1, e2, e3, e4, e5] = [await insertEvent(db, partner, 'PUBLIE'), await insertEvent(db, partner, 'PUBLIE'), await insertEvent(db, partner, 'PUBLIE'),
                await insertEvent(db, partner, 'PUBLIE'), await insertEvent(db, partner, 'PUBLIE')];
            ids.first = await insertPayment(db, { client: s.client, eventId: e1, status: 'PENDING' });
            ids.second = await insertPayment(db, { client: s.client, eventId: e1, status: 'PENDING' });
            ids.pendingAlone = await insertPayment(db, { client: s.client, eventId: e2, status: 'PENDING' });
            ids.success = await insertPayment(db, { client: s.client, eventId: e2, status: 'SUCCESS' });
            ids.otherClient = await insertPayment(db, { client: s.client, eventId: e3, status: 'PENDING' });
            ids.bisPending = await insertPayment(db, { client: s.bis, eventId: e3, status: 'PENDING' });
            ids.eventOne = await insertPayment(db, { client: s.bis, eventId: e4, status: 'PENDING' });
            ids.eventTwo = await insertPayment(db, { client: s.bis, eventId: e5, status: 'PENDING' });
            return lot9bisViolations(db);
        });
        const objet = [ids.first, ids.second].sort()[0];
        assertDetected(rows, 'w17', objet, W17(2), '(w17) deux paiements en attente');
        for (const [id, what] of [[ids.pendingAlone, 'un PENDING et un réussi'], [ids.success, 'paiement réussi'], [ids.otherClient, 'deux comptes'],
            [ids.bisPending, 'deux comptes, second'], [ids.eventOne, 'deux événements'], [ids.eventTwo, 'deux événements, second']] as const) {
            assertClean(rows, id, `(w17) témoin ${what}`);
        }
    });

    test('w18 : commission d\'un billet disponible avant la fin + délai ; témoins : après le délai, déjà retirée, annulée, paiement sans événement', async () => {
        const ids = { early: '', late: '', withdrawn: '', cancelled: '', noEvent: '' };
        const rows = await inScene('w18', ['partners', 'events', 'payments', 'referral_commissions'], async (db, s) => {
            const eventId = await insertEvent(db, await insertPartner(db, s.partnerUser, 'VALIDE'), 'PUBLIE', 30);
            const commission = async (payment: string, over: { availableInDays: number; paid?: number; cancelled?: boolean }): Promise<string> => {
                const id = track('referral_commissions', randomUUID());
                const raw: Record<string, string> = { available_at: `now() + make_interval(days => ${Math.trunc(over.availableInDays)})` };
                if (over.cancelled) raw.cancelled_at = 'now()';
                await insert(db, 'referral_commissions', {
                    id, sponsor_id: s.bis, referred_id: s.client, generation: 'N1', referral_type: 'CLIENT_TO_CLIENT', payment_id: payment,
                    eligible_net_revenue: 34.25, commission_rate: 5, amount: 1.71, status: over.paid ? 'PAID' : 'AVAILABLE',
                    idempotency_key: `LOT9BIS-INV-${id}`, kind: 'COMMISSION', paid_amount: over.paid ?? 0,
                }, raw);
                return id;
            };
            const ticketPayment = (): Promise<string> => insertPayment(db, { client: s.client, eventId });
            ids.early = await commission(await ticketPayment(), { availableInDays: 0 });
            ids.late = await commission(await ticketPayment(), { availableInDays: 60 });
            ids.withdrawn = await commission(await ticketPayment(), { availableInDays: 0, paid: 1.71 });
            ids.cancelled = await commission(await ticketPayment(), { availableInDays: 0, cancelled: true });
            ids.noEvent = await commission(await insertPayment(db, { client: s.client, eventId: null }), { availableInDays: 0 });
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w18', ids.early, W18, '(w18) disponible avant la fin');
        assertClean(rows, ids.late, '(w18) témoin après fin + délai');
        assertClean(rows, ids.withdrawn, '(w18) témoin déjà retirée (B12)');
        assertClean(rows, ids.cancelled, '(w18) témoin annulée');
        assertClean(rows, ids.noEvent, '(w18) témoin paiement sans événement');
    });

    test('w19 : frais sur un versement non confirmé, de montant faux, de date fausse, sans versement, sans frais réels ; témoin : frais datés comme le remboursement', async () => {
        const ids = { notConfirmed: '', wrongAmount: '', wrongDate: '', orphan: '', noFees: '', ok: '' };
        const rows = await inScene('w19', ['partners', 'events', 'payments', 'refunds', 'cashouts', 'finance_ledger'], async (db, s) => {
            const eventId = await insertEvent(db, await insertPartner(db, s.partnerUser, 'VALIDE'), 'PUBLIE');
            const refundId = await insertRefund(db, await insertPayment(db, { client: s.client, eventId }));
            const { rows: t } = await db.query<{ base: string; later: string }>(
                `SELECT (now() + interval '3 days')::text AS base, (now() + interval '4 days')::text AS later`);
            const { base, later } = t[0];
            await insertLedger(db, { owner: s.partnerUser, entryType: 'REMBOURSEMENT', amount: -1000, availableAt: base, sourceKey: `LOT9BIS-INV-REMB-${refundId}`, refundId });
            const fee = async (cashoutId: string, amount: number, availableAt: string): Promise<string> =>
                insertLedger(db, { owner: s.partnerUser, entryType: 'REGULARISATION', amount, availableAt, sourceKey: `CASHOUT_FEE-${cashoutId}`, refundId });
            ids.notConfirmed = await fee(await insertCashout(db, { kind: 'EVENT_CANCELLATION_REFUND', status: 'ENVOYE', refundId, fees: 15 }), -15, base);
            ids.wrongAmount = await fee(await insertCashout(db, { kind: 'EVENT_CANCELLATION_REFUND', status: 'CONFIRME', refundId, fees: 15 }), -20, base);
            ids.wrongDate = await fee(await insertCashout(db, { kind: 'EVENT_CANCELLATION_REFUND', status: 'CONFIRME', refundId, fees: 15 }), -15, later);
            ids.orphan = await fee(randomUUID(), -15, base);
            ids.noFees = await fee(await insertCashout(db, { kind: 'EVENT_CANCELLATION_REFUND', status: 'CONFIRME', refundId }), -15, base);
            ids.ok = await fee(await insertCashout(db, { kind: 'EVENT_CANCELLATION_REFUND', status: 'CONFIRME', refundId, fees: 15 }), -15, base);
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w19', ids.notConfirmed, W19, '(w19) versement non confirmé');
        assertDetected(rows, 'w19', ids.wrongAmount, W19, '(w19) montant différent des frais réels');
        assertDetected(rows, 'w19', ids.wrongDate, W19, '(w19) date différente du remboursement (A6)');
        assertDetected(rows, 'w19', ids.orphan, W19, '(w19) versement absent');
        assertDetected(rows, 'w19', ids.noFees, W19, '(w19) frais réels inconnus');
        assertClean(rows, ids.ok, '(w19) témoin conforme');
    });

    test('w20 : remboursement demandé par la propriétaire après la fin ; témoins : contexte d\'annulation, admin, avant la fin', async () => {
        const ids = { late: '', cancellation: '', admin: '', early: '' };
        const rows = await inScene('w20', ['partners', 'events', 'ticket_categories', 'tickets'], async (db, s) => {
            const partner = await insertPartner(db, s.partnerUser, 'VALIDE');
            const eventId = await insertEvent(db, partner, 'TERMINE', -3);
            const stage = { eventId, categoryId: await insertCategory(db, eventId) };
            const request = async (as: string, context: string, minutes: number): Promise<string> => {
                const ticket = await insertTicket(db, stage, s.client);
                await insertAudit(db, { action: 'TICKET_REFUND_REQUESTED', objectType: 'tickets', objectId: ticket, userId: s.partnerUser, metadata: { as, context, reason: 'TEST' }, createdAt: minutes });
                return ticket;
            };
            ids.late = await request('OWNER', 'DIRECT', 0);
            ids.cancellation = await request('OWNER', 'CANCELLATION', 0);
            ids.admin = await request('ADMIN', 'DIRECT', 0);
            ids.early = await request('OWNER', 'DIRECT', -5 * 24 * 60);
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w20', ids.late, W20, '(w20)');
        assertClean(rows, ids.cancellation, '(w20) témoin contexte d\'annulation');
        assertClean(rows, ids.admin, '(w20) témoin admin');
        assertClean(rows, ids.early, '(w20) témoin avant la fin');
    });

    test('w21 : marque d\'espèces sur un paiement en ligne, puis sur un paiement d\'un autre événement ; témoin : espèces du même événement', async () => {
        const ids = { online: '', otherEvent: '', ok: '' };
        const rows = await inScene('w21', ['partners', 'events', 'payments'], async (db, s) => {
            const partner = await insertPartner(db, s.partnerUser, 'VALIDE');
            const eventId = await insertEvent(db, partner, 'PUBLIE');
            const otherEvent = await insertEvent(db, partner, 'PUBLIE');
            const mark = async (paymentId: string): Promise<string> => {
                const now = new Date().toISOString();
                await insertLotRow(db, 'event_cash_refund_marks', { payment_id: paymentId, event_id: eventId },
                    { marked_by: s.partnerUser, actor_id: s.partnerUser, user_id: s.partnerUser, created_by: s.partnerUser, marked_at: now, created_at: now });
                return paymentId;
            };
            ids.online = await mark(await insertPayment(db, { client: s.client, eventId, platform: true }));
            ids.otherEvent = await mark(await insertPayment(db, { client: s.client, eventId: otherEvent, platform: false }));
            ids.ok = await mark(await insertPayment(db, { client: s.client, eventId, platform: false }));
            return lot9bisViolations(db);
        });
        assertDetected(rows, 'w21', ids.online, W21, '(w21) paiement en ligne');
        assertDetected(rows, 'w21', ids.otherEvent, W21, '(w21) paiement d\'un autre événement');
        assertClean(rows, ids.ok, '(w21) témoin espèces du même événement');
    });
});

// ── Après ROLLBACK ─────────────────────────────────────────────────────────

describe('Lot 9 bis Invariant sur l\'état réel', () => {
    test('schéma du lot présent ; après ROLLBACK, aucune ligne fabriquée ne reste et les triggers sont actifs', async () => {
        assert.deepEqual(await missingLot9bisSchema(), [], 'schéma du lot 9 bis (contrat 6.2)');
        const total = Array.from(FABRICATED.values()).reduce((n, ids) => n + ids.size, 0);
        assert.ok(FABRICATED.size >= 10 && total > 0, `les garde-fous ci-dessus ont fabriqué des lignes (${FABRICATED.size} tables, ${total} lignes)`);

        const left = await inspect(async (db) => {
            const found: string[] = [];
            for (const [table, ids] of Array.from(FABRICATED)) {
                const { rows } = await db.query<{ id: string }>(`SELECT id::text AS id FROM public.${table} WHERE id = ANY($1::uuid[])`, [Array.from(ids)]);
                for (const r of rows) found.push(`${table} ${r.id}`);
            }
            return found;
        });
        assert.deepEqual(left, [], `lignes fabriquées encore présentes après ROLLBACK : ${JSON.stringify(left)}`);

        const disabled = await inspect(async (db) => (await db.query<{ tgname: string }>(
            `SELECT c.relname || '.' || tg.tgname AS tgname FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relname = ANY($1::text[]) AND NOT tg.tgisinternal AND tg.tgenabled = 'D'`, [Array.from(TOUCHED)])).rows.map((r) => r.tgname));
        assert.deepEqual(disabled, [], `triggers restés coupés : ${JSON.stringify(disabled)}`);

        const fabricated = new Set([...Array.from(FABRICATED.values()).flatMap((ids) => Array.from(ids)), ...Array.from(OBJECTS_ONLY)]);
        const leaked = (await lot9bisViolations()).filter((r) => fabricated.has(r.objet));
        assert.deepEqual(leaked, [], `violations fabriquées visibles après ROLLBACK : ${JSON.stringify(leaked)}`);
    });
});
