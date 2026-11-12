/**
 * Lot 9 ter (contrat section 6) — garde-fous des invariants (x1) à (x13) du lot (requête LOT9TER_INVARIANT_SQL dans
 * tests/helpers/lot9ter-invariants.ts). Un invariant toujours vide ne prouverait rien : dans des transactions annulées
 * (inRolledBackTransaction, patron tests/parcours/lot9bis-invariant.test.ts), chaque règle détecte une violation
 * fabriquée exprès, à côté d'un témoin conforme écrit dans la même transaction :
 *  - les triggers utilisateur des tables écrites par le cas sont coupés dans la transaction (annulé avec elle) : sinon
 *    les gardes d'écriture, les avis, l'audit automatique, le lien partenaire–contrôleur (F11), l'admission par défaut
 *    des zones (F34) et l'alerte de refus (F44) changeraient la scène fabriquée ;
 *  - x1, x2 : sonde de droits (GRANT, CREATE POLICY) posée dans la transaction, jamais validée ;
 *  - x9 : la contrainte ticket_scans_zone_not_accepted (migration 09) est retirée dans la transaction pour fabriquer
 *    une ligne de contrôle de zone acceptée ;
 *  - garde de schéma : chaque objet du lot retiré dans une transaction annulée est nommé par missingLot9terSchema, et
 *    assertLot9terSchema et lot9terViolations échouent en le citant ; jamais un faux vert ;
 *  - dernier cas : après ROLLBACK, aucune ligne fabriquée ni sonde ne reste, et les triggers sont actifs.
 * Les violations sont filtrées par règle et par objet : la requête lit toute la base, et after() contrôle le reste.
 *
 * Rouge avant correctif : aucune des migrations 20261110000001 à …11 n'est livrée ; assertLot9terSchema échoue dans
 * chaque transaction en nommant chaque objet manquant, jamais par une erreur Postgres brute (contrat 6). Vert attendu
 * après la migration 11 (dernier objet gardé : public_event_state.stock_level).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { FIXTURE_USERS } from '../helpers/fixture-data';
import {
    assertLot9terInvariants,
    assertLot9terSchema,
    LOT9TER_NOTIFICATION_TYPES,
    LOT9TER_SETTING_KEYS,
    lot9terViolations,
    missingLot9terSchema,
    type Lot9terViolation,
} from '../helpers/lot9ter-invariants';
import { randomSenegalPhone } from './helpers';

type Row = Record<string, unknown>;

const X1 = (rol: string, policy: string, cmd: string): string => `${rol} peut écrire cette colonne par la politique ${policy} (${cmd})`;
const X2_PRIV = (rol: string, priv: string, kind: string): string => `${rol} : droit ${priv} (relkind ${kind})`;
const X2_POLICY = (policy: string, cmd: string): RegExp => new RegExp(`^politique d'écriture ${policy} \\(${cmd}, rôles .+\\)$`);
const X3 = 'versement incertain passé à ECHOUE sans constat « non versé » d\'un superadmin dans la même transaction';
const X4 = 'versement constaté non versé remis à envoyer sans décision humaine dans la même transaction';
const X5 = (user: string, event: string, partner: string): string => `affectation de ${user} à l'événement ${event} sans lien partner_controllers (partenaire ${partner})`;
const X6_MISSING = 'remboursement d\'un billet transféré sans TICKET_REFUNDED_HOLDER au porteur actuel';
const X6_WRONG = (to: string, holder: string): string => `TICKET_REFUNDED_HOLDER vers ${to}, porteur actuel ${holder}`;
const X7_OVERDUE = /^événement VALIDE dont la fin \(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} à Dakar\) est dépassée de plus d'une heure après le passage du cron$/;
const X7_STATUS = (status: string): string => `ended_unpublished vrai sur un événement ${status}`;
const X7_NO_HISTORY = 'ended_unpublished sans ligne d\'historique VALIDE → TERMINE (SYSTEM, CRON)';
const X7_NO_FLAG = 'passage VALIDE → TERMINE sans ended_unpublished';
const X7_PUBLIC = (src: string): string => `événement terminé sans publication présent dans ${src}`;
const X8A = 'entrée acceptée par une porte hors de sa zone d\'entrée';
const X8B = 'entrée acceptée sans porte sur un événement à zones';
const X8C = 'porte ou zone sur un scan d\'un événement sans zone';
const X9A = 'ligne de contrôle de zone acceptée';
const X9B = 'accès autorisé sans entrée antérieure du billet';
const X10 = 'catégorie active admise par aucune zone d\'entrée';
const X11A = 'validation par la liste hors invitation, hors événement ou sans pièce vérifiée';
const X11B = /^transfert ADMITTED incohérent : expéditeur .+, claimed_at .+, billet .+, porteur .+ \/ destinataire .+, \d+ validation\(s\) par la liste à claimed_at$/;
const X12A = (action: string): string => `${action} : numéro ou nom d'invité au journal`;
const X12B = (type: string): string => `${type} : nom d'invité dans les données du message`;
/** x13 : `format('%s', NULL)` rend une chaîne vide ; seul le cadre est fixé, le niveau est contrôlé à part. */
const X13_EVENT = /^résumé public faux : min_price .*\(attendu .*\), has_purchasable .*\(attendu .*\), stock_level .*\(attendu .*\)$/;
const X13_SLICE = (got: string, want: string): string => `tranche publique fausse : ${got} (attendu ${want})`;
const X13_FOREIGN = 'tranche publique d\'une catégorie inactive, hors vente en ligne ou d\'un événement non public';

/** Justification d'une décision humaine conforme (10 caractères au moins, x3 et x4). */
const REASON_OK = 'Confirmé par le support SamirPay';

/** Identifiants des lignes fabriquées par table (contrôle final après ROLLBACK ; tables qui ont une colonne id). */
const FABRICATED = new Map<string, Set<string>>();
/** Objets cités par une règle sans ligne propre (journal de x3 : identifiant de versement inventé). */
const OBJECTS_ONLY = new Set<string>();
/** Tables dont les triggers ont été coupés dans une transaction (contrôle final : actifs). */
const TOUCHED = new Set<string>();

function track(table: string, id: string): string {
    const ids = FABRICATED.get(table) ?? new Set<string>();
    ids.add(id);
    FABRICATED.set(table, ids);
    return id;
}

function invented(): string {
    const id = randomUUID();
    OBJECTS_ONLY.add(id);
    return id;
}

after(async () => {
    await assertLot9terInvariants('lot9ter-invariant');
});

// ── Outils locaux (dans la transaction annulée) ────────────────────────────

interface Scene { client: string; bis: string; partnerUser: string; admin: string; superadmin: string }

/** Schéma présent (échec explicite sinon, AVANT tout DDL), triggers utilisateur des tables écrites coupés, puis scène lue dans la transaction. */
async function inScene<T>(label: string, tables: readonly string[], fn: (db: Client, s: Scene) => Promise<T>): Promise<T> {
    return inRolledBackTransaction(async (db) => {
        await assertLot9terSchema(`lot9ter-invariant ${label}`, db);
        for (const table of tables) {
            await db.query(`ALTER TABLE public.${table} DISABLE TRIGGER USER`);
            TOUCHED.add(table);
        }
        return fn(db, await scene(db));
    });
}

/** Comptes du seed, lus sur la transaction (mêmes identifiants stables que loadFixtures). */
async function scene(db: Client): Promise<Scene> {
    const emails = [FIXTURE_USERS.CLIENT.email, FIXTURE_USERS.CLIENT_BIS.email, FIXTURE_USERS.PARTNER_A.email, FIXTURE_USERS.ADMIN.email, FIXTURE_USERS.SUPERADMIN.email];
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
        superadmin: idOf(FIXTURE_USERS.SUPERADMIN.email),
    };
}

/** Horodatage relatif à now() (début de la transaction), en minutes : négatif dans le passé ; 0 = now() exactement. */
const at = (minutes: number): string => `now() + make_interval(mins => ${Math.trunc(minutes)})`;

/** INSERT générique : `values` en paramètres, `raw` en expressions SQL constantes du test. */
async function insert(db: Client, table: string, values: Row, raw: Record<string, string> = {}): Promise<void> {
    const cols = [...Object.keys(values), ...Object.keys(raw)];
    const exprs = [...Object.keys(values).map((_, i) => `$${i + 1}`), ...Object.values(raw)];
    await db.query(`INSERT INTO public.${table} (${cols.join(', ')}) VALUES (${exprs.join(', ')})`, Object.values(values));
}

async function insertPartner(db: Client, userId: string): Promise<string> {
    const id = track('partners', randomUUID());
    await db.query('INSERT INTO public.partners (id, user_id, company_name, status) VALUES ($1, $2, $3, $4::public.partner_status)',
        [id, userId, `TEST Invariant lot 9 ter ${id.slice(0, 8)}`, 'VALIDE']);
    return id;
}

interface EventSpec {
    status?: 'PUBLIE' | 'VALIDE' | 'TERMINE';
    /** Début dans `days` jours à 20:00, fin le même jour à 23:00 (défaut 30). */
    days?: number;
    /** Fin passée de `endedHoursAgo` heures (heure de Dakar), début 3 h avant la fin. Remplace `days`. */
    endedHoursAgo?: number;
    endedUnpublished?: boolean;
}

async function insertEvent(db: Client, partnerId: string, spec: EventSpec = {}): Promise<string> {
    const id = track('events', randomUUID());
    const dakar = `(now() AT TIME ZONE 'Africa/Dakar')`;
    const dates = spec.endedHoursAgo !== undefined
        ? {
            start_date: `(${dakar} - make_interval(hours => ${Math.trunc(spec.endedHoursAgo) + 3}))::date`,
            start_time: `(${dakar} - make_interval(hours => ${Math.trunc(spec.endedHoursAgo) + 3}))::time(0)`,
            end_date: `(${dakar} - make_interval(hours => ${Math.trunc(spec.endedHoursAgo)}))::date`,
            end_time: `(${dakar} - make_interval(hours => ${Math.trunc(spec.endedHoursAgo)}))::time(0)`,
        }
        : {
            start_date: `current_date + ${Math.trunc(spec.days ?? 30)}`, start_time: `'20:00'`,
            end_date: `current_date + ${Math.trunc(spec.days ?? 30)}`, end_time: `'23:00'`,
        };
    const values: Row = {
        id, partner_id: partnerId, title: `TEST Invariant lot 9 ter ${id.slice(0, 8)}`, slug: `test-lot9ter-inv-${id}`,
        location: 'Salle test', city: 'Dakar', status: spec.status ?? 'PUBLIE',
    };
    if (spec.endedUnpublished !== undefined) values.ended_unpublished = spec.endedUnpublished;
    await insert(db, 'events', values, dates);
    return id;
}

interface CategorySpec9t { price?: number; total?: number; sold?: number; active?: boolean }

async function insertCategory(db: Client, eventId: string, spec: CategorySpec9t = {}): Promise<string> {
    const id = track('ticket_categories', randomUUID());
    const active = spec.active ?? true;
    await insert(db, 'ticket_categories', {
        id, event_id: eventId, name: `TEST Invariant lot 9 ter ${id.slice(0, 8)}`, price: spec.price ?? 0,
        total_quantity: spec.total ?? 50, sold_quantity: spec.sold ?? 0, is_active: active, is_visible: true, sale_online: true,
        max_per_order: 10,
    });
    return id;
}

interface TicketSpec {
    user: string | null;
    status?: 'VALIDE' | 'UTILISE' | 'ANNULE';
    channel?: 'ONLINE' | 'INVITATION' | 'COUNTER';
    paymentId?: string | null;
}

async function insertTicket(db: Client, stage: { eventId: string; categoryId: string }, spec: TicketSpec): Promise<string> {
    const id = track('tickets', randomUUID());
    await insert(db, 'tickets', {
        id, event_id: stage.eventId, category_id: stage.categoryId, user_id: spec.user, ticket_number: `TCK-LOT9TER-INV-${id.slice(0, 8)}`,
        price: 0, qr_code: `EV-QR-LOT9TER-INV-${id}`, status: spec.status ?? 'VALIDE', sale_channel: spec.channel ?? 'ONLINE',
        transfer_locked: false, payment_id: spec.paymentId ?? null,
        sale_decision: JSON.stringify({ source: 'CATEGORIE', sale_online: true, sale_counter: true, decided_at: '2026-11-10T12:00:00+00:00' }),
    });
    return id;
}

interface TransferSpec {
    status: 'CLAIMED' | 'ADMITTED';
    from: string | null;
    toUser: string;
    claimedAt?: number;
}

async function insertTransfer(db: Client, ticketId: string, spec: TransferSpec): Promise<string> {
    const id = track('ticket_transfers', randomUUID());
    await insert(db, 'ticket_transfers', {
        id, ticket_id: ticketId, from_user_id: spec.from, to_phone_or_email: randomSenegalPhone('77'), status: spec.status, to_user_id: spec.toUser,
    }, { created_at: at(-60), expires_at: at(24 * 60), claimed_at: at(spec.claimedAt ?? 0) });
    return id;
}

interface ScanSpec {
    ticketId: string;
    eventId: string;
    scanner: string;
    minutes?: number;
    accepted?: boolean;
    result?: string | null;
    zoneResult?: string | null;
    method?: 'QR' | 'MANUAL' | 'COUNTER' | 'GUEST_LIST';
    identity?: boolean;
    gateId?: string | null;
    zoneId?: string | null;
}

async function insertScan(db: Client, spec: ScanSpec): Promise<string> {
    const id = track('ticket_scans', randomUUID());
    const accepted = spec.accepted ?? true;
    await insert(db, 'ticket_scans', {
        id, ticket_id: spec.ticketId, event_id: spec.eventId, scanner_id: spec.scanner,
        result: spec.result === undefined ? (accepted ? 'valid' : 'invalid') : spec.result,
        zone_result: spec.zoneResult ?? null, accepted, method: spec.method ?? 'QR', identity_verified: spec.identity ?? false,
        gate_id: spec.gateId ?? null, zone_id: spec.zoneId ?? null,
    }, { created_at: at(spec.minutes ?? 0) });
    return id;
}

async function insertZone(db: Client, eventId: string, name: string, kind: 'ENTREE' | 'CONTROLE', position: number): Promise<string> {
    const id = track('event_zones', randomUUID());
    await insert(db, 'event_zones', { id, event_id: eventId, name, kind, position });
    return id;
}

async function insertGate(db: Client, eventId: string, zoneId: string, name: string): Promise<string> {
    const id = track('event_gates', randomUUID());
    await insert(db, 'event_gates', { id, event_id: eventId, zone_id: zoneId, name });
    return id;
}

async function admit(db: Client, eventId: string, zoneId: string, categoryId: string): Promise<void> {
    await insert(db, 'zone_categories', { event_id: eventId, zone_id: zoneId, category_id: categoryId });
}

interface AuditSpec {
    action: string;
    objectType: string;
    objectId: string;
    userId?: string | null;
    userRole?: string | null;
    metadata?: Row;
    oldValue?: Row;
    newValue?: Row;
    createdAt?: number;
}

async function insertAudit(db: Client, spec: AuditSpec): Promise<string> {
    const id = track('audit_logs', randomUUID());
    await insert(db, 'audit_logs', {
        id, user_id: spec.userId ?? null, user_role: spec.userRole ?? null, action: spec.action, object_type: spec.objectType,
        object_id: spec.objectId,
        old_value: spec.oldValue ? JSON.stringify(spec.oldValue) : null, new_value: spec.newValue ? JSON.stringify(spec.newValue) : null,
        metadata: JSON.stringify(spec.metadata ?? {}),
    }, { created_at: at(spec.createdAt ?? 0) });
    return id;
}

/** Versement fabriqué ; `notSent` pose le constat « non versé » complet (contrainte cashouts_not_sent_chk, migration 05). */
async function insertCashout(db: Client, spec: { status: string; notSent?: { by: string; minutes: number } }): Promise<string> {
    const id = track('cashouts', randomUUID());
    const values: Row = { id, kind: 'REFUND', idempotency_key: `LOT9TER-INV-${id}`, amount: 1000, status: spec.status };
    const raw: Record<string, string> = { created_at: at(-120) };
    if (spec.notSent) {
        values.not_sent_reference = 'SUP-12345';
        values.not_sent_reason = REASON_OK;
        values.not_sent_by = spec.notSent.by;
        raw.not_sent_at = at(spec.notSent.minutes);
    }
    await insert(db, 'cashouts', values, raw);
    return id;
}

async function insertPayment(db: Client, client: string, eventId: string): Promise<string> {
    const id = track('payments', randomUUID());
    await db.query(
        `INSERT INTO public.payments (id, transaction_id, client_id, event_id, payment_target, amount, status, is_platform_payment,
                                      facial_amount, service_fee, aggregator_fee, net_event_village_revenue, partner_payout_amount)
         VALUES ($1, $2, $3, $4, 'TICKET', 1000, 'SUCCESS'::public.payment_status_enum, TRUE, 1000, 0, 0, 0, 1000)`,
        [id, `TX-LOT9TER-INV-${id}`, client, eventId]);
    return id;
}

async function insertOutbox(db: Client, spec: { type: string; user: string; groupKey?: string; templateData?: Row }): Promise<string> {
    const id = track('notification_outbox', randomUUID());
    const key = `LOT9TER-INV:${id}`;
    await insert(db, 'notification_outbox', {
        id, idempotency_key: key, group_key: spec.groupKey ?? key, type: spec.type, family: 'ESSENTIAL', channel: 'IN_APP',
        status: 'SENT', recipient_user_id: spec.user, template_data: JSON.stringify(spec.templateData ?? {}),
    }, { due_at: 'now()', next_attempt_at: 'now()', sent_at: 'now()' });
    return id;
}

async function insertHistory(db: Client, eventId: string, from: string, to: string, role: 'SYSTEM' | 'ADMIN', channel: 'CRON' | 'TRANSITION'): Promise<void> {
    await db.query(
        `INSERT INTO public.event_status_history (event_id, old_status, new_status, actor_id, actor_role, reason, channel)
         VALUES ($1, $2::public.event_status, $3::public.event_status, NULL, $4, NULL, $5)`, [eventId, from, to, role, channel]);
}

/** Événement à zones : « Entrée générale » (ENTREE, Porte Nord) et « Carré VIP » (CONTROLE, Porte VIP). */
interface ZonedStage { eventId: string; categoryId: string; entree: string; controle: string; porteNord: string; porteVip: string }

async function zonedStage(db: Client, s: Scene): Promise<ZonedStage> {
    const eventId = await insertEvent(db, await insertPartner(db, s.partnerUser));
    const categoryId = await insertCategory(db, eventId);
    const entree = await insertZone(db, eventId, 'Entrée générale', 'ENTREE', 0);
    const controle = await insertZone(db, eventId, 'Carré VIP', 'CONTROLE', 1);
    const porteNord = await insertGate(db, eventId, entree, 'Porte Nord');
    const porteVip = await insertGate(db, eventId, controle, 'Porte VIP');
    await admit(db, eventId, entree, categoryId);
    await admit(db, eventId, controle, categoryId);
    return { eventId, categoryId, entree, controle, porteNord, porteVip };
}

async function plainStage(db: Client, s: Scene, spec: EventSpec = {}): Promise<{ eventId: string; categoryId: string }> {
    const eventId = await insertEvent(db, await insertPartner(db, s.partnerUser), spec);
    return { eventId, categoryId: await insertCategory(db, eventId) };
}

function about(rows: Lot9terViolation[], objet: string): string {
    return JSON.stringify(rows.filter((r) => r.objet === objet));
}

function assertDetected(rows: Lot9terViolation[], regle: string, objet: string, detail: string | RegExp, what: string): void {
    const match = (d: string): boolean => (typeof detail === 'string' ? d === detail : detail.test(d));
    assert.ok(rows.some((r) => r.regle === regle && r.objet === objet && match(r.detail)), `${what} : « (${regle}) ${String(detail)} » attendu : ${about(rows, objet)}`);
}

function assertClean(rows: Lot9terViolation[], objet: string, what: string, regle?: string): void {
    assert.deepEqual(rows.filter((r) => r.objet === objet && (regle === undefined || r.regle === regle)), [],
        `${what} : aucune violation${regle ? ` (${regle})` : ''} attendue : ${about(rows, objet)}`);
}

// ── Garde de schéma : un objet retiré est nommé ────────────────────────────

/** `parent` : objet qui porte celui-ci (table d'une colonne) ; absent, la garde le nomme à sa place et le cas échoue avant toute coupure. */
interface GuardCase { what: string; needle: string; parent?: string; remove: (db: Client) => Promise<unknown> }

const dropTable = (table: string): GuardCase => ({
    what: `table ${table}`, needle: `table public.${table} `, remove: (db) => db.query(`DROP TABLE public.${table} CASCADE`),
});

const dropColumn = (table: string, column: string): GuardCase => ({
    what: `colonne ${table}.${column}`, needle: `colonne public.${table}.${column} `, parent: `table public.${table} `,
    remove: (db) => db.query(`ALTER TABLE public.${table} DROP COLUMN ${column} CASCADE`),
});

const dropFunction = (signature: string): GuardCase => ({
    what: `fonction ${signature}`, needle: `fonction public.${signature} `, remove: (db) => db.query(`DROP FUNCTION public.${signature} CASCADE`),
});

const GUARD_CASES: readonly GuardCase[] = [
    dropTable('partner_controllers'),
    dropTable('zone_categories'),
    dropTable('event_gates'),
    dropTable('event_zones'),
    dropColumn('partner_controllers', 'first_seen_at'),
    dropColumn('event_zones', 'kind'),
    dropColumn('event_gates', 'zone_id'),
    dropColumn('cashouts', 'not_sent_reference'),
    dropColumn('cashouts', 'not_sent_reason'),
    dropColumn('cashouts', 'not_sent_at'),
    dropColumn('cashouts', 'not_sent_by'),
    dropColumn('events', 'ended_unpublished'),
    dropColumn('tickets', 'guest_name'),
    dropColumn('event_controllers', 'gate_id'),
    dropColumn('event_controllers', 'gate_change_allowed'),
    dropColumn('ticket_scans', 'gate_id'),
    dropColumn('ticket_scans', 'zone_id'),
    dropColumn('ticket_scans', 'zone_result'),
    dropColumn('ticket_categories', 'scan_color'),
    dropColumn('ticket_categories', 'entry_instruction'),
    dropColumn('public_event_state', 'stock_level'),
    dropFunction('ticket_origin(text,numeric,boolean)'),
    dropFunction('scan_is_refusal(boolean,text,text,timestamptz)'),
    dropFunction('cashout_admin_not_sent(jsonb)'),
    dropFunction('partner_controller_known(uuid,uuid)'),
    dropFunction('event_edit_locks(uuid)'),
    dropFunction('ticket_guest_list_search(jsonb)'),
    dropFunction('scan_gate_context(uuid,uuid,uuid,boolean)'),
    dropFunction('pilotage_compute_entries(uuid,boolean)'),
    {
        what: 'valeur ADMITTED de ticket_transfer_status',
        needle: 'valeur ADMITTED',
        remove: (db) => db.query(`ALTER TYPE public.ticket_transfer_status RENAME VALUE 'ADMITTED' TO 'ADMITTED_RETIRE_PAR_LE_TEST'`),
    },
    {
        what: 'contrainte public_event_state_stock_level_check',
        needle: 'contrainte public_event_state_stock_level_check ',
        remove: (db) => db.query('ALTER TABLE public.public_event_state DROP CONSTRAINT public_event_state_stock_level_check'),
    },
    {
        what: 'ligne de transition VALIDE → TERMINE (SYSTEM, CRON)',
        needle: '(VALIDE, TERMINE, SYSTEM, CRON)',
        remove: (db) => db.query(`DELETE FROM public.event_status_transitions WHERE from_status::text = 'VALIDE' AND to_status::text = 'TERMINE' AND actor_kind = 'SYSTEM' AND channel = 'CRON'`),
    },
    ...LOT9TER_NOTIFICATION_TYPES.map((type): GuardCase => ({
        what: `type ${type} au registre`,
        needle: `type ${type} `,
        remove: async (db) => {
            await db.query('DELETE FROM public.notification_outbox WHERE type = $1', [type]);
            await db.query('DELETE FROM public.notification_types WHERE type = $1', [type]);
        },
    })),
    ...LOT9TER_SETTING_KEYS.map((key): GuardCase => ({
        what: `réglage ${key}`,
        needle: `réglage ${key} `,
        remove: async (db) => {
            await db.query('ALTER TABLE public.platform_settings DISABLE TRIGGER USER');
            await db.query('DELETE FROM public.platform_settings WHERE key = $1', [key]);
        },
    })),
];

describe('Lot 9 ter, garde de schéma : chaque objet retiré est nommé, jamais un faux vert', () => {
    for (const c of GUARD_CASES) {
        test(`${c.what} : présent, puis retiré dans une transaction annulée, la garde le nomme`, async () => {
            await inRolledBackTransaction(async (db) => {
                const before = (await missingLot9terSchema(db)).filter((m) => m.includes(c.needle) || (c.parent !== undefined && m.includes(c.parent)));
                assert.deepEqual(before, [], `${c.what} : l'objet doit exister avant la coupure (migrations 20261110000001 à …11 du lot) : ${before.join(' ; ')}`);

                await c.remove(db);

                const missing = await missingLot9terSchema(db);
                assert.ok(missing.some((m) => m.includes(c.needle)), `${c.what} : la garde doit nommer l'objet retiré : ${JSON.stringify(missing)}`);
                await assert.rejects(assertLot9terSchema('lot9ter-invariant garde', db), (err: Error) => err.message.includes(c.needle), `${c.what} : assertLot9terSchema doit échouer en le citant`);
                await assert.rejects(lot9terViolations(db), (err: Error) => err.message.includes(c.needle), `${c.what} : lot9terViolations ne doit jamais passer sans l'objet`);
            });
        });
    }
});

// ── Violations fabriquées : sécurité (x1, x2) ──────────────────────────────

describe('Lot 9 ter Invariants (x1) et (x2) : aucune écriture REST', () => {
    test('x1 : politique UPDATE pour authenticated et droit UPDATE (status) sur partners → partners.status nommé', async () => {
        const rows = await inScene('x1', [], async (db) => {
            await db.query('CREATE POLICY lot9ter_sonde ON public.partners FOR UPDATE TO authenticated USING (true)');
            await db.query('GRANT UPDATE (status) ON public.partners TO authenticated');
            return lot9terViolations(db);
        });
        assertDetected(rows, 'x1', 'partners.status', X1('authenticated', 'lot9ter_sonde', 'UPDATE'), '(x1) colonne sensible écrivable');
        assertDetected(rows, 'x2', 'partners', X2_POLICY('lot9ter_sonde', 'UPDATE'), '(x2) la sonde est aussi une politique d\'écriture');
    });

    test('x1 témoin : même politique, droit UPDATE (description) → x1 muet sur partners.description, x2 détecte partners', async () => {
        const rows = await inScene('x1 témoin', [], async (db) => {
            await db.query('CREATE POLICY lot9ter_sonde ON public.partners FOR UPDATE TO authenticated USING (true)');
            await db.query('GRANT UPDATE (description) ON public.partners TO authenticated');
            return lot9terViolations(db);
        });
        assertClean(rows, 'partners.description', '(x1) colonne non sensible', 'x1');
        assertDetected(rows, 'x2', 'partners', X2_PRIV('authenticated', 'UPDATE', 'r'), '(x2) droit UPDATE de colonne');
        assertDetected(rows, 'x2', 'partners', X2_POLICY('lot9ter_sonde', 'UPDATE'), '(x2) politique d\'écriture');
    });

    test('x2 : GRANT INSERT ON halls TO anon → « anon : droit INSERT » ; témoin : politique de lecture seule, muet', async () => {
        const bad = await inScene('x2', [], async (db) => {
            await db.query('GRANT INSERT ON public.halls TO anon');
            return lot9terViolations(db);
        });
        assertDetected(bad, 'x2', 'halls', X2_PRIV('anon', 'INSERT', 'r'), '(x2) droit INSERT');

        const ok = await inScene('x2 témoin', [], async (db) => {
            await db.query('CREATE POLICY lot9ter_sonde_lecture ON public.halls FOR SELECT USING (true)');
            return lot9terViolations(db);
        });
        assertClean(ok, 'halls', '(x2) politique SELECT seule', 'x2');
    });
});

// ── Violations fabriquées : argent (x3, x4) ────────────────────────────────

describe('Lot 9 ter Invariants (x3) et (x4) : versements « non versé »', () => {
    test('x3 : INCERTAIN → ECHOUE sans constat, constat d\'un ADMIN, référence de 101 caractères, autre heure ; témoin : constat SUPERADMIN de même created_at', async () => {
        const ids = { none: '', admin: '', longRef: '', otherTime: '', ok: '' };
        const rows = await inScene('x3', ['audit_logs'], async (db, s) => {
            const failed = async (constat: { role: string; reference: string; minutes: number } | null): Promise<string> => {
                const id = invented();
                await insertAudit(db, { action: 'UPDATE', objectType: 'cashouts', objectId: id, oldValue: { status: 'INCERTAIN' }, newValue: { status: 'ECHOUE' } });
                if (constat) {
                    await insertAudit(db, {
                        action: 'CASHOUT_NOT_SENT', objectType: 'cashouts', objectId: id, userId: s.superadmin, userRole: constat.role,
                        metadata: { reference: constat.reference, reason: REASON_OK, previous_status: 'INCERTAIN' }, createdAt: constat.minutes,
                    });
                }
                return id;
            };
            ids.none = await failed(null);
            ids.admin = await failed({ role: 'ADMIN', reference: 'SUP-12345', minutes: 0 });
            ids.longRef = await failed({ role: 'SUPERADMIN', reference: 'R'.repeat(101), minutes: 0 });
            ids.otherTime = await failed({ role: 'SUPERADMIN', reference: 'SUP-12345', minutes: -1 });
            ids.ok = await failed({ role: 'SUPERADMIN', reference: 'SUP-12345', minutes: 0 });
            return lot9terViolations(db);
        });
        assertDetected(rows, 'x3', ids.none, X3, '(x3) sans constat');
        assertDetected(rows, 'x3', ids.admin, X3, '(x3) constat d\'un ADMIN');
        assertDetected(rows, 'x3', ids.longRef, X3, '(x3) référence de 101 caractères');
        assertDetected(rows, 'x3', ids.otherTime, X3, '(x3) constat d\'une autre transaction');
        assertClean(rows, ids.ok, '(x3) témoin constat SUPERADMIN de même created_at', 'x3');
    });

    test('x4 : remise à envoyer d\'un constaté sans CASHOUT_RESENT, ou avec un CASHOUT_RESENT à une autre heure ; témoins : renvoi humain de même created_at, versement sans constat', async () => {
        const ids = { none: '', otherTime: '', ok: '', notConstated: '' };
        const rows = await inScene('x4', ['audit_logs', 'cashouts'], async (db, s) => {
            const resent = async (notSent: boolean, decision: { minutes: number } | null): Promise<string> => {
                const id = await insertCashout(db, { status: 'A_ENVOYER', notSent: notSent ? { by: s.superadmin, minutes: -10 } : undefined });
                await insertAudit(db, { action: 'UPDATE', objectType: 'cashouts', objectId: id, oldValue: { status: 'ECHOUE' }, newValue: { status: 'A_ENVOYER' } });
                if (decision) {
                    await insertAudit(db, {
                        action: 'CASHOUT_RESENT', objectType: 'cashouts', objectId: id, userId: s.admin, userRole: 'ADMIN',
                        metadata: { previous_status: 'ECHOUE', reason: REASON_OK }, createdAt: decision.minutes,
                    });
                }
                return id;
            };
            ids.none = await resent(true, null);
            ids.otherTime = await resent(true, { minutes: -1 });
            ids.ok = await resent(true, { minutes: 0 });
            ids.notConstated = await resent(false, null);
            return lot9terViolations(db);
        });
        assertDetected(rows, 'x4', ids.none, X4, '(x4) sans décision humaine');
        assertDetected(rows, 'x4', ids.otherTime, X4, '(x4) décision d\'une autre transaction');
        assertClean(rows, ids.ok, '(x4) témoin renvoi humain de même created_at', 'x4');
        assertClean(rows, ids.notConstated, '(x4) témoin versement sans constat', 'x4');
    });
});

// ── Violations fabriquées : équipe, messages, événements (x5 à x7) ─────────

describe('Lot 9 ter Invariants (x5) à (x7) : équipe, détenteur actuel, fin d\'un VALIDE', () => {
    test('x5 : affectation sans lien partner_controllers (trigger de lien coupé) ; témoin : lien posé', async () => {
        const ids = { bad: '', ok: '', eventId: '', partnerId: '', controller: '' };
        const rows = await inScene('x5', ['partners', 'events', 'event_controllers'], async (db, s) => {
            ids.controller = s.client;
            ids.partnerId = await insertPartner(db, s.partnerUser);
            ids.eventId = await insertEvent(db, ids.partnerId);
            const assign = async (userId: string): Promise<string> => {
                const id = track('event_controllers', randomUUID());
                await insert(db, 'event_controllers', { id, event_id: ids.eventId, user_id: userId, can_accept_cash: false, created_by: s.partnerUser });
                return id;
            };
            ids.bad = await assign(s.client);
            await insert(db, 'partner_controllers', { partner_id: ids.partnerId, user_id: s.bis });
            ids.ok = await assign(s.bis);
            return lot9terViolations(db);
        });
        assertDetected(rows, 'x5', ids.bad, X5(ids.controller, ids.eventId, ids.partnerId), '(x5) affectation sans lien');
        assertClean(rows, ids.ok, '(x5) témoin lien posé', 'x5');
    });

    test('x6 : remboursement hors annulation d\'un billet transféré sans avis, puis avis à l\'ancien détenteur ; témoins : avis au porteur actuel, contexte d\'annulation', async () => {
        const ids = { missing: '', wrongTicket: '', wrongLine: '', ok: '', okLine: '', cancellation: '', payer: '', holder: '' };
        const rows = await inScene('x6', ['partners', 'events', 'ticket_categories', 'payments', 'tickets', 'ticket_transfers', 'audit_logs', 'notification_outbox'], async (db, s) => {
            ids.payer = s.client;
            ids.holder = s.bis;
            const stage = await plainStage(db, s);
            const refunded = async (context: string): Promise<string> => {
                const paymentId = await insertPayment(db, s.client, stage.eventId);
                const ticket = await insertTicket(db, stage, { user: s.bis, paymentId });
                await insertTransfer(db, ticket, { status: 'CLAIMED', from: s.client, toUser: s.bis, claimedAt: -30 });
                await insertAudit(db, {
                    action: 'TICKET_REFUND_REQUESTED', objectType: 'tickets', objectId: ticket, userId: s.partnerUser, userRole: 'PARTENAIRE',
                    metadata: { as: 'OWNER', context, reason: 'TEST invariant lot 9 ter', mode: 'CASHOUT', amount: 1000 },
                });
                return ticket;
            };
            const notice = (ticket: string, to: string): Promise<string> => insertOutbox(db, {
                type: 'TICKET_REFUNDED_HOLDER', user: to, groupKey: `TICKET_REFUNDED_HOLDER:${ticket}`, templateData: { ticket_id: ticket },
            });
            ids.missing = await refunded('DIRECT');
            ids.wrongTicket = await refunded('DIRECT');
            ids.wrongLine = await notice(ids.wrongTicket, s.client);
            ids.ok = await refunded('DIRECT');
            ids.okLine = await notice(ids.ok, s.bis);
            ids.cancellation = await refunded('CANCELLATION');
            return lot9terViolations(db);
        });
        assertDetected(rows, 'x6', ids.missing, X6_MISSING, '(x6) aucun avis');
        assertDetected(rows, 'x6', ids.wrongTicket, X6_MISSING, '(x6) avis à l\'ancien détenteur seulement : le porteur actuel n\'est pas prévenu');
        assertDetected(rows, 'x6', ids.wrongLine, X6_WRONG(ids.payer, ids.holder), '(x6) avis vers un autre destinataire');
        assertClean(rows, ids.ok, '(x6) témoin avis au porteur actuel', 'x6');
        assertClean(rows, ids.okLine, '(x6) témoin ligne d\'avis conforme', 'x6');
        assertClean(rows, ids.cancellation, '(x6) témoin remboursement d\'annulation', 'x6');
    });

    test('x7 : VALIDE fini depuis 2 h, ended_unpublished sur un PUBLIE, passage VALIDE → TERMINE sans drapeau ; témoins : VALIDE à venir, terminé sans publication conforme', async () => {
        const ids = { overdue: '', flaggedPublie: '', noFlag: '', future: '', ok: '' };
        const rows = await inScene('x7', ['partners', 'events', 'event_status_history'], async (db, s) => {
            const partner = await insertPartner(db, s.partnerUser);
            ids.overdue = await insertEvent(db, partner, { status: 'VALIDE', endedHoursAgo: 2 });
            ids.flaggedPublie = await insertEvent(db, partner, { status: 'PUBLIE', endedUnpublished: true });
            ids.noFlag = await insertEvent(db, partner, { status: 'TERMINE', endedHoursAgo: 3 });
            await insertHistory(db, ids.noFlag, 'VALIDE', 'TERMINE', 'SYSTEM', 'CRON');
            ids.future = await insertEvent(db, partner, { status: 'VALIDE', days: 30 });
            ids.ok = await insertEvent(db, partner, { status: 'TERMINE', endedHoursAgo: 3, endedUnpublished: true });
            await insertHistory(db, ids.ok, 'VALIDE', 'TERMINE', 'SYSTEM', 'CRON');
            return lot9terViolations(db);
        });
        assertDetected(rows, 'x7', ids.overdue, X7_OVERDUE, '(x7) VALIDE fini depuis plus d\'une heure');
        assertDetected(rows, 'x7', ids.flaggedPublie, X7_STATUS('PUBLIE'), '(x7) drapeau sur un PUBLIE');
        assertDetected(rows, 'x7', ids.flaggedPublie, X7_NO_HISTORY, '(x7) drapeau sans historique du cron');
        assertDetected(rows, 'x7', ids.noFlag, X7_NO_FLAG, '(x7) passage du cron sans drapeau');
        assertClean(rows, ids.future, '(x7) témoin VALIDE à venir', 'x7');
        assertClean(rows, ids.ok, '(x7) témoin terminé sans publication : TERMINE, historique du cron, absent de events_public_status', 'x7');
        assert.ok(!rows.some((r) => r.objet === ids.ok && r.detail === X7_PUBLIC('events_public_status')), '(x7) la vue publique ne montre pas un événement jamais publié');
    });
});

// ── Violations fabriquées : zones (x8 à x10) ───────────────────────────────

describe('Lot 9 ter Invariants (x8) à (x10) : zones et portes', () => {
    const SCAN_TABLES = ['partners', 'events', 'ticket_categories', 'tickets', 'ticket_scans', 'event_zones', 'event_gates', 'zone_categories'] as const;

    test('x8 : entrée acceptée à une porte de contrôle, zone fausse, sans porte sur un événement à zones, porte sur un événement sans zone ; témoins conformes', async () => {
        const ids = { atControl: '', wrongZone: '', noGate: '', foreignGate: '', ok: '', beforeZones: '', plain: '' };
        const rows = await inScene('x8', SCAN_TABLES, async (db, s) => {
            const z = await zonedStage(db, s);
            const plain = await plainStage(db, s);
            const ticketZ = (): Promise<string> => insertTicket(db, z, { user: s.client });
            const ticketP = (): Promise<string> => insertTicket(db, plain, { user: s.client });
            ids.atControl = await insertScan(db, { ticketId: await ticketZ(), eventId: z.eventId, scanner: s.bis, gateId: z.porteVip, zoneId: z.controle });
            ids.wrongZone = await insertScan(db, { ticketId: await ticketZ(), eventId: z.eventId, scanner: s.bis, gateId: z.porteNord, zoneId: z.controle });
            ids.noGate = await insertScan(db, { ticketId: await ticketZ(), eventId: z.eventId, scanner: s.bis, minutes: 1 });
            ids.ok = await insertScan(db, { ticketId: await ticketZ(), eventId: z.eventId, scanner: s.bis, gateId: z.porteNord, zoneId: z.entree });
            ids.beforeZones = await insertScan(db, { ticketId: await ticketZ(), eventId: z.eventId, scanner: s.bis, minutes: -10 });
            ids.foreignGate = await insertScan(db, { ticketId: await ticketP(), eventId: plain.eventId, scanner: s.bis, gateId: z.porteNord });
            ids.plain = await insertScan(db, { ticketId: await ticketP(), eventId: plain.eventId, scanner: s.bis });
            return lot9terViolations(db);
        });
        assertDetected(rows, 'x8', ids.atControl, X8A, '(x8) entrée à une porte de zone CONTRÔLE');
        assertDetected(rows, 'x8', ids.wrongZone, X8A, '(x8) zone différente de celle de la porte');
        assertDetected(rows, 'x8', ids.noGate, X8B, '(x8) sans porte sur un événement à zones');
        assertDetected(rows, 'x8', ids.foreignGate, X8C, '(x8) porte sur un événement sans zone');
        assertClean(rows, ids.ok, '(x8) témoin entrée à une porte d\'entrée', 'x8');
        assertClean(rows, ids.beforeZones, '(x8) témoin entrée antérieure à la première zone', 'x8');
        assertClean(rows, ids.plain, '(x8) témoin événement sans zone, sans porte', 'x8');
    });

    test('x9 : zone_ok sans entrée antérieure ; témoins : zone_ok après l\'entrée, wrong_zone sans entrée', async () => {
        const ids = { orphan: '', ok: '', wrong: '' };
        const rows = await inScene('x9', SCAN_TABLES, async (db, s) => {
            const z = await zonedStage(db, s);
            const control = (ticketId: string, zoneResult: string): Promise<string> => insertScan(db, {
                ticketId, eventId: z.eventId, scanner: s.bis, accepted: false, result: null, zoneResult, gateId: z.porteVip, zoneId: z.controle,
            });
            ids.orphan = await control(await insertTicket(db, z, { user: s.client }), 'zone_ok');
            const entered = await insertTicket(db, z, { user: s.client, status: 'UTILISE' });
            await insertScan(db, { ticketId: entered, eventId: z.eventId, scanner: s.bis, gateId: z.porteNord, zoneId: z.entree, minutes: -5 });
            ids.ok = await control(entered, 'zone_ok');
            ids.wrong = await control(await insertTicket(db, z, { user: s.client }), 'wrong_zone');
            return lot9terViolations(db);
        });
        assertDetected(rows, 'x9', ids.orphan, X9B, '(x9) accès autorisé sans entrée');
        assertClean(rows, ids.ok, '(x9) témoin zone_ok après l\'entrée', 'x9');
        assertClean(rows, ids.wrong, '(x9) témoin wrong_zone', 'x9');
    });

    test('x9 : ligne de contrôle de zone acceptée (contrainte ticket_scans_zone_not_accepted retirée dans la transaction)', async () => {
        const ids = { accepted: '' };
        const rows = await inScene('x9 acceptée', SCAN_TABLES, async (db, s) => {
            const z = await zonedStage(db, s);
            await db.query('ALTER TABLE public.ticket_scans DROP CONSTRAINT ticket_scans_zone_not_accepted');
            ids.accepted = await insertScan(db, {
                ticketId: await insertTicket(db, z, { user: s.client }), eventId: z.eventId, scanner: s.bis, accepted: true, result: null,
                zoneResult: 'zone_ok', gateId: z.porteVip, zoneId: z.controle,
            });
            return lot9terViolations(db);
        });
        assertDetected(rows, 'x9', ids.accepted, X9A, '(x9) contrôle de zone accepté');
    });

    test('x10 : catégorie admise seulement par une zone de contrôle, admission retirée ; témoins : admise à l\'entrée, inactive, événement sans zone', async () => {
        const ids = { controlOnly: '', removed: '', ok: '', inactive: '', plain: '' };
        const rows = await inScene('x10', SCAN_TABLES, async (db, s) => {
            const z = await zonedStage(db, s);
            ids.ok = z.categoryId;
            ids.controlOnly = await insertCategory(db, z.eventId);
            await admit(db, z.eventId, z.controle, ids.controlOnly);
            ids.removed = await insertCategory(db, z.eventId);
            await admit(db, z.eventId, z.entree, ids.removed);
            await db.query('DELETE FROM public.zone_categories WHERE category_id = $1', [ids.removed]);
            ids.inactive = await insertCategory(db, z.eventId, { active: false });
            ids.plain = (await plainStage(db, s)).categoryId;
            return lot9terViolations(db);
        });
        assertDetected(rows, 'x10', ids.controlOnly, X10, '(x10) admise seulement par une zone de contrôle');
        assertDetected(rows, 'x10', ids.removed, X10, '(x10) admission retirée');
        assertClean(rows, ids.ok, '(x10) témoin admise à l\'entrée', 'x10');
        assertClean(rows, ids.inactive, '(x10) témoin catégorie inactive', 'x10');
        assertClean(rows, ids.plain, '(x10) témoin événement sans zone', 'x10');
    });
});

// ── Violations fabriquées : liste des invités (x11, x12) ───────────────────

describe('Lot 9 ter Invariants (x11) et (x12) : liste des invités', () => {
    const GUEST_TABLES = ['partners', 'events', 'ticket_categories', 'tickets', 'ticket_scans', 'ticket_transfers'] as const;

    test('x11 : validation par la liste d\'un billet en ligne, sans pièce, d\'un autre événement ; témoin : invitation, pièce vérifiée', async () => {
        const ids = { online: '', noId: '', otherEvent: '', ok: '' };
        const rows = await inScene('x11 validations', GUEST_TABLES, async (db, s) => {
            const stage = await plainStage(db, s);
            const other = await plainStage(db, s);
            const guest = async (st: { eventId: string; categoryId: string }, channel: 'ONLINE' | 'INVITATION', identity: boolean): Promise<string> =>
                insertScan(db, {
                    ticketId: await insertTicket(db, st, { user: channel === 'ONLINE' ? s.client : null, channel, status: 'UTILISE' }),
                    eventId: stage.eventId, scanner: s.bis, method: 'GUEST_LIST', identity,
                });
            ids.online = await guest(stage, 'ONLINE', true);
            ids.noId = await guest(stage, 'INVITATION', false);
            ids.otherEvent = await guest(other, 'INVITATION', true);
            ids.ok = await guest(stage, 'INVITATION', true);
            return lot9terViolations(db);
        });
        assertDetected(rows, 'x11', ids.online, X11A, '(x11) billet en ligne');
        assertDetected(rows, 'x11', ids.noId, X11A, '(x11) pièce non vérifiée');
        assertDetected(rows, 'x11', ids.otherEvent, X11A, '(x11) billet d\'un autre événement');
        assertClean(rows, ids.ok, '(x11) témoin invitation, pièce vérifiée', 'x11');
    });

    test('x11 : transfert ADMITTED sans validation par la liste, billet resté VALIDE ; témoin : une validation GUEST_LIST à claimed_at', async () => {
        const ids = { noScan: '', notUsed: '', ok: '' };
        const rows = await inScene('x11 transferts', GUEST_TABLES, async (db, s) => {
            const stage = await plainStage(db, s);
            const admitted = async (status: 'UTILISE' | 'VALIDE', withScan: boolean): Promise<string> => {
                const ticket = await insertTicket(db, stage, { user: s.client, channel: 'INVITATION', status });
                const transfer = await insertTransfer(db, ticket, { status: 'ADMITTED', from: null, toUser: s.client, claimedAt: 0 });
                if (withScan) await insertScan(db, { ticketId: ticket, eventId: stage.eventId, scanner: s.bis, method: 'GUEST_LIST', identity: true, minutes: 0 });
                return transfer;
            };
            ids.noScan = await admitted('UTILISE', false);
            ids.notUsed = await admitted('VALIDE', true);
            ids.ok = await admitted('UTILISE', true);
            return lot9terViolations(db);
        });
        assertDetected(rows, 'x11', ids.noScan, X11B, '(x11) ADMITTED sans validation par la liste');
        assertDetected(rows, 'x11', ids.notUsed, X11B, '(x11) ADMITTED sur un billet non utilisé');
        assertClean(rows, ids.ok, '(x11) témoin ADMITTED conforme', 'x11');
    });

    test('x12 : numéro au journal d\'une recherche, nom d\'invité au journal et dans un message ; témoins : journal sans numéro, message sans nom', async () => {
        const ids = { phone: '', named: '', okSearch: '', okNamed: '', leak: '', okOutbox: '' };
        const rows = await inScene('x12', ['audit_logs', 'notification_outbox'], async (db, s) => {
            ids.phone = await insertAudit(db, { action: 'GUEST_LIST_SEARCH', objectType: 'events', objectId: invented(), userId: s.bis, userRole: 'CONTROLEUR', metadata: { q: '771234567' } });
            ids.named = await insertAudit(db, { action: 'TICKET_INVITATION_GUEST_NAMED', objectType: 'tickets', objectId: invented(), userId: s.partnerUser, userRole: 'PARTENAIRE', metadata: { guest_name: 'Awa Diop' } });
            ids.okSearch = await insertAudit(db, {
                action: 'GUEST_LIST_SEARCH', objectType: 'events', objectId: invented(), userId: s.bis, userRole: 'CONTROLEUR',
                metadata: { event_id: randomUUID(), query_length: 4, results: 1 },
            });
            ids.okNamed = await insertAudit(db, { action: 'TICKET_INVITATION_GUEST_NAMED', objectType: 'tickets', objectId: invented(), userId: s.partnerUser, userRole: 'PARTENAIRE', metadata: { named: true } });
            ids.leak = await insertOutbox(db, { type: 'PHONE_CHANGED', user: s.client, templateData: { guest_name: 'Awa Diop' } });
            ids.okOutbox = await insertOutbox(db, { type: 'PHONE_CHANGED', user: s.client, templateData: { event_title: 'Soirée test' } });
            return lot9terViolations(db);
        });
        assertDetected(rows, 'x12', ids.phone, X12A('GUEST_LIST_SEARCH'), '(x12) numéro au journal');
        assertDetected(rows, 'x12', ids.named, X12A('TICKET_INVITATION_GUEST_NAMED'), '(x12) nom au journal');
        assertDetected(rows, 'x12', ids.leak, X12B('PHONE_CHANGED'), '(x12) nom dans les données d\'un message');
        assertClean(rows, ids.okSearch, '(x12) témoin recherche sans numéro (identifiant retiré avant le motif)', 'x12');
        assertClean(rows, ids.okNamed, '(x12) témoin nom posé sans le nom au journal', 'x12');
        assertClean(rows, ids.okOutbox, '(x12) témoin message sans nom', 'x12');
    });
});

// ── Violations fabriquées : stock public (x13) ─────────────────────────────

describe('Lot 9 ter Invariant (x13) : résumé public du stock', () => {
    test('x13 : stock_level LOW d\'un événement épuisé, tranche LOW au restant faux, tranche d\'une catégorie inactive ; témoin : événement en vente juste', async () => {
        const ids = { soldOut: '', lowSlice: '', inactive: '', okEvent: '', okSlice: '' };
        const rows = await inScene('x13', ['partners', 'events', 'ticket_categories', 'public_event_state', 'public_category_stock'], async (db, s) => {
            const { rows: t } = await db.query<{ t: number }>('SELECT public.low_stock_threshold() AS t');
            const thr = Number(t[0].t);
            assert.ok(Number.isInteger(thr) && thr >= 1, `seuil courant lisible : ${thr}`);
            const partner = await insertPartner(db, s.partnerUser);
            const summary = (eventId: string, minPrice: number | null, purchasable: boolean, level: string): Promise<void> =>
                insert(db, 'public_event_state', { event_id: eventId, status: 'PUBLIE', title: 'TEST Invariant lot 9 ter', min_price: minPrice, has_purchasable: purchasable, stock_level: level });
            const slice = (categoryId: string, eventId: string, availability: string, hint: number | null): Promise<void> =>
                insert(db, 'public_category_stock', { category_id: categoryId, event_id: eventId, availability, remaining_hint: hint });

            ids.soldOut = await insertEvent(db, partner);
            await insertCategory(db, ids.soldOut, { price: 5000, total: 10, sold: 10 });
            await summary(ids.soldOut, null, false, 'LOW');

            const lowEvent = await insertEvent(db, partner);
            ids.lowSlice = await insertCategory(db, lowEvent, { price: 5000, total: 5, sold: 4 });
            await slice(ids.lowSlice, lowEvent, 'LOW', 2);
            ids.inactive = await insertCategory(db, lowEvent, { price: 5000, total: 50, sold: 0, active: false });
            await slice(ids.inactive, lowEvent, 'AVAILABLE', null);

            ids.okEvent = await insertEvent(db, partner);
            ids.okSlice = await insertCategory(db, ids.okEvent, { price: 5000, total: thr + 20, sold: 1 });
            await summary(ids.okEvent, 5000, true, 'AVAILABLE');
            await slice(ids.okSlice, ids.okEvent, 'AVAILABLE', null);
            return lot9terViolations(db);
        });
        assertDetected(rows, 'x13', ids.soldOut, X13_EVENT, '(x13) résumé « LOW » d\'un événement épuisé');
        assert.ok(rows.some((r) => r.regle === 'x13' && r.objet === ids.soldOut && r.detail.endsWith('stock_level LOW (attendu SOLD_OUT)')),
            `(x13) niveau attendu SOLD_OUT nommé : ${about(rows, ids.soldOut)}`);
        assertDetected(rows, 'x13', ids.lowSlice, X13_SLICE('LOW/2', 'LOW/1'), '(x13) tranche LOW au restant faux');
        assertDetected(rows, 'x13', ids.inactive, X13_FOREIGN, '(x13) tranche d\'une catégorie inactive');
        assertClean(rows, ids.okEvent, '(x13) témoin résumé juste', 'x13');
        assertClean(rows, ids.okSlice, '(x13) témoin tranche juste', 'x13');
    });
});

// ── Après ROLLBACK ─────────────────────────────────────────────────────────

describe('Lot 9 ter Invariant sur l\'état réel', () => {
    test('schéma du lot présent ; après ROLLBACK, aucune ligne fabriquée ni sonde ne reste et les triggers sont actifs', async () => {
        assert.deepEqual(await missingLot9terSchema(), [], 'schéma du lot 9 ter (contrat 3.8, 6)');
        const total = Array.from(FABRICATED.values()).reduce((n, ids) => n + ids.size, 0);
        assert.ok(FABRICATED.size >= 10 && total > 0, `les garde-fous ci-dessus ont fabriqué des lignes (${FABRICATED.size} tables, ${total} lignes)`);

        const left = await inspect(async (db) => {
            const found: string[] = [];
            for (const [table, ids] of Array.from(FABRICATED)) {
                const { rows } = await db.query<{ id: string }>(`SELECT id::text AS id FROM public.${table} WHERE id = ANY($1::uuid[])`, [Array.from(ids)]);
                for (const r of rows) found.push(`${table} ${r.id}`);
            }
            const probes = await db.query<{ policyname: string }>(`SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND policyname LIKE 'lot9ter_sonde%'`);
            for (const r of probes.rows) found.push(`politique ${r.policyname}`);
            return found;
        });
        assert.deepEqual(left, [], `lignes ou sondes fabriquées encore présentes après ROLLBACK : ${JSON.stringify(left)}`);

        const disabled = await inspect(async (db) => (await db.query<{ tgname: string }>(
            `SELECT c.relname || '.' || tg.tgname AS tgname FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relname = ANY($1::text[]) AND NOT tg.tgisinternal AND tg.tgenabled = 'D'`, [Array.from(TOUCHED)])).rows.map((r) => r.tgname));
        assert.deepEqual(disabled, [], `triggers restés coupés : ${JSON.stringify(disabled)}`);

        const fabricated = new Set([...Array.from(FABRICATED.values()).flatMap((ids) => Array.from(ids)), ...Array.from(OBJECTS_ONLY), 'partners.status', 'partners.description', 'halls']);
        const leaked = (await lot9terViolations()).filter((r) => fabricated.has(r.objet));
        assert.deepEqual(leaked, [], `violations fabriquées visibles après ROLLBACK : ${JSON.stringify(leaked)}`);
    });
});
