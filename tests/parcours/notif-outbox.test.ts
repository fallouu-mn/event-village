/**
 * Lot 6, tâche 6.1 — schéma de la boîte d'envoi unique et fonctions SQL communes (contrat C1 à C6, D ;
 * migration 20261103000002).
 *  - C1 : registre public.notification_types rempli avec TOUTES les lignes de la table G2 (famille,
 *    sujet, canaux, audience, politique « compte suspendu », journal synchrone, permission admin),
 *    amendement 2 de l'orchestrateur compris (plus de canal EMAIL pour TRANSFER_OFFERED et
 *    TRANSFER_CANCELLED) ;
 *  - C2 : colonnes et types, contraintes nommées, clé d'idempotence UNIQUE, index de regroupement des SMS
 *    de changement (un seul PENDING par porteur et par événement), contrainte « pas de secret » (code,
 *    otp, jeton, lien de réclamation, mot de passe, QR…), triggers ; chaque CHECK refuse une ligne
 *    fabriquée dans une transaction annulée, à côté d'une ligne conforme acceptée ;
 *  - garde des statuts `NT409` par le service_role (REST) : une ligne SENT, SKIPPED, CANCELLED ou
 *    UNCERTAIN ne change plus de statut, de clé ni de destinataire ; FAILED → PENDING refusé hors
 *    relance manuelle ; PENDING → PENDING admis ;
 *  - jamais publiée en temps réel (ni les préférences, ni les abonnements push, ni le registre) ; RLS
 *    activée sans politique, aucun privilège pour anon et authenticated, service_role seul ;
 *  - C5 (préférences, abonnements push) et C6 (admin_signals : nouveaux types, un signal par objet) ;
 *  - D : chaque fonction existe, SECURITY DEFINER, search_path = public, volatilité du contrat,
 *    EXECUTE retiré à anon et authenticated et accordé au service_role ; comportements de
 *    event_start_at, notif_in_quiet_hours, notif_setting_int, notif_account_blocked,
 *    notif_preference_enabled, notif_admin_recipients ;
 *  - notif_enqueue : une ligne par canal du registre, PENDING, clés `<group_key>:<canal>`, données
 *    copiées, numéro du compte NON recopié ; SKIPPED dès l'insertion avec motif et instantané (`skip`
 *    fourni, compte suspendu ou partenaire suspendu sous politique BLOCK, préférence désactivée, sans
 *    téléphone, email factice) ; ordre des cas ; IN_APP et PUSH seulement avec un compte ; rejeu sans
 *    doublon (ON CONFLICT) ; erreurs NT001, NT002, NT003 ; notif_enqueue_admins (permission du type,
 *    SUPERADMIN, clé par admin) ;
 *  - notification_sync_log : journal synchrone (OTP, invitation) sans code ni lien, statut final, une
 *    seule ligne par référence, type non synchrone refusé.
 * Les essais d'écriture de schéma passent par pg dans des transactions annulées (aucune ligne laissée) ;
 * la garde NT409 et le journal synchrone passent par le service_role (REST), comme l'application.
 *
 * Rouge avant correctif : aucune table notification_outbox, notification_types, notification_preferences,
 * push_subscriptions, aucune fonction notif_* ni notification_sync_log (grep vide dans
 * supabase/migrations) : chaque cas échoue en nommant l'objet absent (assertNotificationSchema,
 * to_regclass / to_regprocedure, PGRST205 / PGRST202 du service_role).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { loadFixtures } from '../helpers/fixtures';
import { assertNotificationSchema } from '../helpers/notification-invariants';
import { service, newBuyer, type Buyer } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { assertNotificationInvariants, insertOutboxRow, outboxRows, type OutboxRow } from './notif-helpers';
import { randomEmail, randomSenegalPhone } from './helpers';

after(async () => {
    await assertNotificationInvariants('notif-outbox');
});

// ── Registre attendu (contrat G2, amendement 2) ────────────────────────────

type Ch = 'IN_APP' | 'SMS' | 'EMAIL' | 'PUSH';
const I: Ch = 'IN_APP';
const S: Ch = 'SMS';
const M: Ch = 'EMAIL';
const P: Ch = 'PUSH';

interface RegistryRow {
    type: string;
    family: 'ESSENTIAL' | 'OPTIONAL';
    topic: 'REMINDERS' | 'EVENT_UPDATES' | 'PRO_ACTIVITY' | null;
    channels: Ch[];
    audience: 'CLIENT' | 'PARTNER' | 'CONTROLLER' | 'ADMIN' | 'ANY';
    suspended_policy: 'BLOCK' | 'ALLOW';
    sync_only: boolean;
    admin_permission: string | null;
}

type Audience = RegistryRow['audience'];
const ess = (type: string, channels: Ch[], audience: Audience, sus: 'A' | 'B', perm: string | null = null): RegistryRow => ({
    type, family: 'ESSENTIAL', topic: null, channels, audience, suspended_policy: sus === 'A' ? 'ALLOW' : 'BLOCK', sync_only: false, admin_permission: perm,
});
const opt = (type: string, topic: 'REMINDERS' | 'EVENT_UPDATES' | 'PRO_ACTIVITY', channels: Ch[], audience: Audience): RegistryRow => ({
    type, family: 'OPTIONAL', topic, channels, audience, suspended_policy: 'BLOCK', sync_only: false, admin_permission: null,
});
const sync = (type: string): RegistryRow => ({
    type, family: 'ESSENTIAL', topic: null, channels: [S], audience: 'ANY', suspended_policy: 'ALLOW', sync_only: true, admin_permission: null,
});

const EXPECTED_REGISTRY: RegistryRow[] = [
    ess('PURCHASE_CONFIRMED', [I, S, M], 'CLIENT', 'A'),
    ess('FREE_TICKETS_CONFIRMED', [I, S, M], 'CLIENT', 'B'),
    ess('COUNTER_RECEIPT', [S], 'ANY', 'A'),
    ess('INVITATION_RECEIVED', [S], 'ANY', 'A'), // lot 9, tâche 9.0 (migration 20261108000002)
    ess('TRANSFER_OFFERED', [S, I, P], 'CLIENT', 'B'),
    ess('TRANSFER_CANCELLED', [S, I, P], 'CLIENT', 'B'),
    ess('TRANSFER_EXPIRED', [I, P], 'CLIENT', 'B'),
    ess('TRANSFER_CLAIMED_SENDER', [I, P], 'CLIENT', 'B'),
    ess('TRANSFER_RECEIVED', [I, P, M], 'CLIENT', 'B'), // lot 7, tâche 7.9 (D91, migration 20261105000007)
    ess('TICKET_SCANNED', [I, P], 'CLIENT', 'B'),
    ess('EVENT_CANCELLED', [I, S, M, P], 'CLIENT', 'A'),
    opt('EVENT_SUSPENDED_HOLDER', 'EVENT_UPDATES', [I, P], 'CLIENT'),
    opt('EVENT_REACTIVATED_HOLDER', 'EVENT_UPDATES', [I, P], 'CLIENT'),
    opt('EVENT_CHANGED', 'EVENT_UPDATES', [I, P, S], 'CLIENT'),
    opt('REMINDER_J1', 'REMINDERS', [I, P, S, M], 'CLIENT'),
    opt('REMINDER_H3', 'REMINDERS', [I, P, S], 'CLIENT'),
    ess('REFUND_REQUESTED', [I], 'CLIENT', 'A'),
    ess('REFUND_PAID', [I, S, M, P], 'CLIENT', 'A'),
    ess('PASSWORD_CHANGED', [I, S, M], 'ANY', 'B'),
    ess('PHONE_CHANGED', [S], 'ANY', 'A'), // lot 9, tâche 9.2 (migration 20261108000004)
    ess('PUSH_TEST', [P], 'ANY', 'B'),
    ess('EVENT_VALIDATED', [I, S, M, P], 'PARTNER', 'B'),
    ess('EVENT_REJECTED', [I, S, M, P], 'PARTNER', 'B'),
    ess('EVENT_SUSPENDED', [I, S, M, P], 'PARTNER', 'B'),
    ess('EVENT_REACTIVATED', [I, S, M, P], 'PARTNER', 'B'),
    ess('EVENT_PUBLISHED_BY_ADMIN', [I, P], 'PARTNER', 'B'),
    opt('FIRST_TICKET_SOLD', 'PRO_ACTIVITY', [I, P, S, M], 'PARTNER'),
    opt('NEW_ORDER', 'PRO_ACTIVITY', [I], 'PARTNER'),
    opt('CATEGORY_SOLD_OUT', 'PRO_ACTIVITY', [I, P, S, M], 'PARTNER'),
    opt('EVENT_SOLD_OUT', 'PRO_ACTIVITY', [I, P, S, M], 'PARTNER'),
    ess('SHIFT_DISCREPANCY', [I, S, P], 'PARTNER', 'A'),
    ess('WITHDRAWAL_PAID', [I, S, M, P], 'ANY', 'A'),
    ess('WITHDRAWAL_REJECTED', [I, S, M, P], 'ANY', 'A'),
    ess('WITHDRAWAL_UNCERTAIN', [I, S, P], 'ANY', 'A'),
    ess('CANCEL_REFUNDS_DONE', [I, M, P], 'PARTNER', 'A'),
    ess('CANCEL_REFUNDS_BLOCKED', [I, M, P], 'PARTNER', 'A'),
    ess('PARTNER_REGISTERED_ACK', [I, M], 'PARTNER', 'B'),
    ess('PARTNER_VALIDATED', [I, S, M], 'PARTNER', 'B'),
    ess('PARTNER_REJECTED', [I, S, M], 'PARTNER', 'B'),
    ess('PARTNER_SUSPENDED', [I, S, M], 'PARTNER', 'A'),
    ess('PARTNER_REACTIVATED', [I, S, M], 'PARTNER', 'B'),
    ess('TRIAL_STARTED', [I, S], 'PARTNER', 'B'),
    ess('SUBSCRIPTION_ACTIVATED', [I], 'PARTNER', 'A'),
    ess('PAYMENT_SUCCESS', [I], 'CLIENT', 'A'),
    ess('HALL_RESERVATION_REQUESTED', [I], 'PARTNER', 'B'),
    ess('HALL_RESERVATION_CONFIRMED', [I], 'CLIENT', 'B'),
    ess('HALL_RESERVATION_CANCELLED', [I], 'ANY', 'B'),
    ess('PROMOTION_DECIDED', [I], 'PARTNER', 'B'),
    ess('CONTROLLER_ASSIGNED', [I, P, S], 'CONTROLLER', 'B'),
    ess('CONTROLLER_UNASSIGNED', [I, P, S], 'CONTROLLER', 'B'),
    opt('CONTROLLER_REMINDER', 'REMINDERS', [I, P, S], 'CONTROLLER'),
    ess('SHIFT_CLOSED_BY_OTHER', [I, P], 'CONTROLLER', 'A'),
    ess('CONTROLLER_ACTIVATED', [I, S], 'CONTROLLER', 'B'),
    ess('ADMIN_EVENT_SUBMITTED', [I, P, M], 'ADMIN', 'B', 'events.read'),
    ess('ADMIN_PARTNER_REGISTERED', [I, P, M], 'ADMIN', 'B', 'partners.read'),
    ess('ADMIN_REFUND_TO_RETRY', [I, P, M], 'ADMIN', 'B', 'refunds.manage'),
    ess('ADMIN_DUPLICATE_PAYMENT', [I, P, M], 'ADMIN', 'B', 'refunds.manage'), // lot 8, tâche 8.2 a (L32, migration 20261106000003)
    ess('ADMIN_CASHOUT_UNCERTAIN', [I, P, M], 'ADMIN', 'B', 'refunds.manage'),
    ess('ADMIN_WITHDRAWAL_REJECTED', [I, M], 'ADMIN', 'B', 'refunds.manage'),
    ess('ADMIN_FINANCE_DEBT', [I, M], 'ADMIN', 'B', 'payments.read'),
    ess('ADMIN_NOTIFICATION_FAILED', [I], 'ADMIN', 'B', 'notifications.read'),
    ess('ADMIN_SMS_DAILY_THRESHOLD', [I, M], 'ADMIN', 'B', 'notifications.read'),
    ess('ADMIN_SMS_CAP_GLOBAL', [I], 'ADMIN', 'B', 'notifications.read'),
    ess('ADMIN_SMS_CAP_NON_OTP', [I], 'ADMIN', 'B', 'notifications.read'),
    // Lot 7, tâche 7.0 a (contrat M2.1, D15) : alerte à 80 % du plafond optionnel, prévision de la veille.
    ess('ADMIN_SMS_OPTIONAL_80', [I, M], 'ADMIN', 'B', 'notifications.read'),
    ess('ADMIN_SMS_FORECAST', [I, M], 'ADMIN', 'B', 'notifications.read'),
    sync('OTP_LOGIN'),
    sync('OTP_REGISTER'),
    sync('OTP_PASSWORD_RESET'),
    sync('OTP_WITHDRAWAL'),
    sync('OTP_PHONE_CHANGE'), // lot 9, tâche 9.2 (migration 20261108000004)
    sync('OTP_AUTH_HOOK'),
    sync('CONTROLLER_INVITE'),
];

const LOT6_TABLES = ['notification_outbox', 'notification_types', 'notification_preferences', 'push_subscriptions'] as const;

/** Clés interdites dans template_data (contrainte notification_outbox_no_secret_chk). */
const SECRET_KEYS = ['code', 'otp', 'otp_code', 'token', 'claim_token', 'claim_url', 'password', 'secret', 'pin', 'qr_code', 'totp_secret'] as const;

// ── Outils pg (transactions annulées) ──────────────────────────────────────

/** Expression SQL écrite telle quelle dans un INSERT. */
class Sql {
    constructor(readonly text: string) {}
}
const NOW = new Sql('now()');

async function insertRow(db: Client, table: string, row: Record<string, unknown>): Promise<void> {
    const cols: string[] = [];
    const vals: string[] = [];
    const params: unknown[] = [];
    for (const [col, value] of Object.entries(row)) {
        cols.push(col);
        if (value instanceof Sql) {
            vals.push(value.text);
        } else if (value !== null && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
            params.push(JSON.stringify(value));
            vals.push(`$${params.length}::jsonb`);
        } else {
            params.push(value);
            vals.push(`$${params.length}`);
        }
    }
    await db.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')})`, params);
}

interface PgFailure { code?: string; constraint?: string; message: string }

/** Exécute `fn` sous un point de sauvegarde ; renvoie l'erreur Postgres (et annule l'essai) ou null. */
async function attempt(db: Client, fn: () => Promise<unknown>): Promise<PgFailure | null> {
    await db.query('SAVEPOINT essai_lot6');
    try {
        await fn();
        await db.query('RELEASE SAVEPOINT essai_lot6');
        return null;
    } catch (err) {
        await db.query('ROLLBACK TO SAVEPOINT essai_lot6');
        const e = err as { code?: string; constraint?: string; message?: string };
        return { code: e.code, constraint: e.constraint, message: String(e.message ?? err) };
    }
}

/** Ligne conforme (PASSWORD_CHANGED, SMS vers un numéro neuf, PENDING), surchargée par `over`. */
function outboxRow(over: Record<string, unknown> = {}): Record<string, unknown> {
    const id = randomUUID();
    const channel = (over.channel as string | undefined) ?? 'SMS';
    const groupKey = `TEST-OUTBOX:${id}`;
    return {
        id,
        group_key: groupKey,
        idempotency_key: `${groupKey}:${channel}`,
        type: 'PASSWORD_CHANGED',
        family: 'ESSENTIAL',
        origin: 'OUTBOX',
        recipient_phone: randomSenegalPhone('76'),
        template_data: {},
        status: 'PENDING',
        attempts: 0,
        max_attempts: 5,
        due_at: NOW,
        next_attempt_at: NOW,
        ...over,
        channel,
    };
}

/** Prépare une transaction annulée : schéma présent, triggers utilisateur des tables citées coupés. */
async function prepare(db: Client, label: string, disableTriggersOn: string[] = []): Promise<void> {
    await assertNotificationSchema(`notif-outbox ${label}`, db);
    for (const t of disableTriggersOn) await db.query(`ALTER TABLE public.${t} DISABLE TRIGGER USER`);
}

interface PgOutbox {
    id: string;
    idempotency_key: string;
    group_key: string;
    type: string;
    family: string;
    topic: string | null;
    channel: Ch;
    origin: string;
    recipient_user_id: string | null;
    recipient_phone: string | null;
    recipient_email: string | null;
    event_id: string | null;
    template_data: Record<string, unknown>;
    status: string;
    reason: string | null;
    attempts: number;
    max_attempts: number;
    due_at: Date;
    next_attempt_at: Date;
    claimed_at: Date | null;
    claim_token: string | null;
    sent_at: Date | null;
    finished_at: Date | null;
    decision: Record<string, unknown> | null;
}

async function enqueue(db: Client, p: Record<string, unknown>): Promise<number> {
    const r = await db.query<{ n: number }>('SELECT public.notif_enqueue($1::jsonb) AS n', [JSON.stringify(p)]);
    return Number(r.rows[0].n);
}

async function groupRows(db: Client, groupKey: string): Promise<PgOutbox[]> {
    return (await db.query<PgOutbox>('SELECT * FROM public.notification_outbox WHERE group_key = $1 ORDER BY channel', [groupKey])).rows;
}

function byChannel(rows: PgOutbox[]): Partial<Record<Ch, PgOutbox>> {
    const out: Partial<Record<Ch, PgOutbox>> = {};
    for (const r of rows) out[r.channel] = r;
    return out;
}

function channelsOf(rows: Array<{ channel: string }>): string[] {
    return rows.map((r) => r.channel).sort();
}

function show(rows: PgOutbox[]): string {
    return JSON.stringify(rows.map((r) => ({ channel: r.channel, status: r.status, reason: r.reason })));
}

const FUTURE_MS = 2 * 3600_000;

function purchaseData(): Record<string, unknown> {
    return {
        event_id: randomUUID(), title: 'TEST Concert de la boîte d’envoi', start_at: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
        location: 'Grand Théâtre', city: 'Dakar', payment_id: randomUUID(), ticket_count: 2, service_fee: 300, total: 10_300,
    };
}

// ── Comptes neufs ──────────────────────────────────────────────────────────

let buyer: Buyer;
let partner: TestPartner;

before(async () => {
    buyer = await newBuyer('outbox');
    partner = await newPartner('outbox');
});

// ── C1 : registre ──────────────────────────────────────────────────────────

describe('6.1 Registre des types (contrat C1, table G2)', () => {
    test('public.notification_types contient exactement les types du contrat, avec famille, sujet, canaux, audience, politique, journal et permission', async () => {
        assert.equal(new Set(EXPECTED_REGISTRY.map((r) => r.type)).size, EXPECTED_REGISTRY.length, 'liste attendue sans doublon');
        const rows = await inspect(async (db) => {
            await assertNotificationSchema('notif-outbox registre', db);
            return (await db.query<RegistryRow>(
                `SELECT type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission
                   FROM public.notification_types ORDER BY type`)).rows;
        });
        const actual = new Map(rows.map((r) => [r.type, { ...r, channels: [...r.channels].sort() }]));
        const expected = new Map(EXPECTED_REGISTRY.map((r) => [r.type, { ...r, channels: [...r.channels].sort() }]));
        const missing = Array.from(expected.keys()).filter((t) => !actual.has(t));
        const extra = Array.from(actual.keys()).filter((t) => !expected.has(t));
        assert.deepEqual(missing, [], `types absents du registre : ${missing.join(', ')}`);
        assert.deepEqual(extra, [], `types hors contrat dans le registre : ${extra.join(', ')}`);
        const diffs: string[] = [];
        for (const [type, want] of Array.from(expected.entries())) {
            const got = actual.get(type)!;
            for (const k of Object.keys(want) as Array<keyof RegistryRow>) {
                if (JSON.stringify(got[k]) !== JSON.stringify(want[k])) diffs.push(`${type}.${k} : ${JSON.stringify(got[k])}, attendu ${JSON.stringify(want[k])}`);
            }
        }
        assert.deepEqual(diffs, [], `registre différent du contrat G2 :\n${diffs.join('\n')}`);
    });

    test('le registre refuse un type mal formé, une famille optionnelle sans sujet, un canal inconnu, une permission hors audience ADMIN', async () => {
        const failures = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'registre CHECK');
            const base = { family: 'ESSENTIAL', topic: null, audience: 'ANY', suspended_policy: 'BLOCK', sync_only: false, admin_permission: null };
            const ins = (row: Record<string, unknown>, channels: string[]) => attempt(db, () => db.query(
                `INSERT INTO public.notification_types (type, family, topic, channels, audience, suspended_policy, sync_only, admin_permission)
                 VALUES ($1, $2, $3, $4::text[], $5, $6, $7, $8)`,
                [row.type, row.family, row.topic, channels, row.audience, row.suspended_policy, row.sync_only, row.admin_permission]));
            return {
                witness: await ins({ ...base, type: 'TEST_LOT6_CONFORME' }, ['SMS']),
                lowercase: await ins({ ...base, type: 'test_minuscules' }, ['SMS']),
                optionalNoTopic: await ins({ ...base, type: 'TEST_LOT6_OPT', family: 'OPTIONAL' }, ['SMS']),
                essentialTopic: await ins({ ...base, type: 'TEST_LOT6_ESS', topic: 'REMINDERS' }, ['SMS']),
                badChannel: await ins({ ...base, type: 'TEST_LOT6_CANAL' }, ['WHATSAPP']),
                noChannel: await ins({ ...base, type: 'TEST_LOT6_VIDE' }, []),
                permNotAdmin: await ins({ ...base, type: 'TEST_LOT6_PERM', admin_permission: 'notifications.read' }, ['IN_APP']),
            };
        });
        assert.equal(failures.witness, null, `ligne conforme refusée : ${JSON.stringify(failures.witness)}`);
        for (const [k, f] of Object.entries(failures)) {
            if (k === 'witness') continue;
            assert.equal(f?.code, '23514', `${k} : CHECK attendu (23514), obtenu ${JSON.stringify(f)}`);
        }
    });
});

// ── C2 : schéma de la boîte d'envoi ────────────────────────────────────────

describe('6.1 Boîte d’envoi : schéma (contrat C2)', () => {
    test('colonnes, types et nullabilité de public.notification_outbox', async () => {
        const expected: Record<string, [string, 'YES' | 'NO']> = {
            id: ['uuid', 'NO'], idempotency_key: ['text', 'NO'], group_key: ['text', 'NO'], type: ['text', 'NO'],
            family: ['text', 'NO'], topic: ['text', 'YES'], channel: ['text', 'NO'], origin: ['text', 'NO'],
            recipient_user_id: ['uuid', 'YES'], recipient_phone: ['text', 'YES'], recipient_email: ['text', 'YES'],
            event_id: ['uuid', 'YES'], actor_id: ['uuid', 'YES'], shift_id: ['uuid', 'YES'], template_data: ['jsonb', 'NO'],
            status: ['text', 'NO'], reason: ['text', 'YES'], reason_detail: ['text', 'YES'], attempts: ['int4', 'NO'],
            max_attempts: ['int4', 'NO'], due_at: ['timestamptz', 'NO'], next_attempt_at: ['timestamptz', 'NO'],
            claimed_at: ['timestamptz', 'YES'], claim_token: ['uuid', 'YES'], sent_at: ['timestamptz', 'YES'],
            finished_at: ['timestamptz', 'YES'], provider_message_id: ['text', 'YES'], notification_id: ['uuid', 'YES'],
            decision: ['jsonb', 'YES'], manual_retries: ['int4', 'NO'], created_at: ['timestamptz', 'NO'], updated_at: ['timestamptz', 'NO'],
        };
        const cols = await inspect(async (db) => {
            await assertNotificationSchema('notif-outbox colonnes', db);
            return (await db.query<{ column_name: string; udt_name: string; is_nullable: 'YES' | 'NO'; column_default: string | null }>(
                `SELECT column_name, udt_name, is_nullable, column_default FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'notification_outbox'`)).rows;
        });
        const got = Object.fromEntries(cols.map((c) => [c.column_name, [c.udt_name, c.is_nullable]]));
        assert.deepEqual(got, expected, 'colonnes de notification_outbox (nom, type, nullabilité)');
        const def = Object.fromEntries(cols.map((c) => [c.column_name, c.column_default ?? '']));
        assert.match(def.status, /'PENDING'/, `défaut de status : ${def.status}`);
        assert.match(def.origin, /'OUTBOX'/, `défaut de origin : ${def.origin}`);
        assert.match(def.attempts, /^0$/, `défaut de attempts : ${def.attempts}`);
        assert.match(def.max_attempts, /^5$/, `défaut de max_attempts : ${def.max_attempts}`);
        assert.match(def.manual_retries, /^0$/, `défaut de manual_retries : ${def.manual_retries}`);
        assert.match(def.id, /gen_random_uuid\(\)/, `défaut de id : ${def.id}`);
    });

    test('contraintes nommées, clés étrangères, index et triggers du contrat', async () => {
        const cat = await inspect(async (db) => {
            await assertNotificationSchema('notif-outbox contraintes', db);
            const cons = (await db.query<{ conname: string; contype: string }>(
                `SELECT conname, contype FROM pg_constraint WHERE conrelid = 'public.notification_outbox'::regclass`)).rows;
            const fks = (await db.query<{ col: string; target: string; deltype: string }>(
                `SELECT a.attname AS col, c.confrelid::regclass::text AS target, c.confdeltype::text AS deltype
                   FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
                  WHERE c.conrelid = 'public.notification_outbox'::regclass AND c.contype = 'f'`)).rows;
            const idx = (await db.query<{ indexname: string; indexdef: string }>(
                `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'notification_outbox'`)).rows;
            const trg = (await db.query<{ tgname: string; tgenabled: string }>(
                `SELECT tgname, tgenabled::text AS tgenabled FROM pg_trigger WHERE tgrelid = 'public.notification_outbox'::regclass AND NOT tgisinternal`)).rows;
            return { cons, fks, idx, trg };
        });
        const named = new Map(cat.cons.map((c) => [c.conname, c.contype]));
        const wanted: Array<[string, string]> = [
            ['notification_outbox_idempotency_key_key', 'u'], ['notification_outbox_recipient_chk', 'c'],
            ['notification_outbox_user_channel_chk', 'c'], ['notification_outbox_attempts_chk', 'c'],
            ['notification_outbox_reason_chk', 'c'], ['notification_outbox_sending_chk', 'c'], ['notification_outbox_sent_chk', 'c'],
            ['notification_outbox_sync_chk', 'c'], ['notification_outbox_no_secret_chk', 'c'],
        ];
        for (const [name, type] of wanted) assert.equal(named.get(name), type, `contrainte ${name} (${type}) : ${JSON.stringify(cat.cons)}`);

        const fk = Object.fromEntries(cat.fks.map((f) => [f.col, `${f.target.replace(/^public\./, '')}/${f.deltype}`]));
        assert.deepEqual(fk, {
            type: 'notification_types/a', recipient_user_id: 'users/c', event_id: 'events/n', actor_id: 'users/n',
            shift_id: 'controller_shifts/n', notification_id: 'notifications/n',
        }, 'clés étrangères (table cible / ON DELETE : a = NO ACTION, c = CASCADE, n = SET NULL)');

        const index = new Map(cat.idx.map((i) => [i.indexname, i.indexdef]));
        for (const name of ['idx_outbox_due', 'idx_outbox_sending', 'idx_outbox_event', 'idx_outbox_recipient', 'idx_outbox_group',
            'idx_outbox_stats', 'idx_outbox_admin_list', 'uq_outbox_event_change_pending_sms']) {
            assert.ok(index.has(name), `index ${name} absent : ${Array.from(index.keys()).join(', ')}`);
        }
        const regroup = index.get('uq_outbox_event_change_pending_sms')!;
        assert.match(regroup, /^CREATE UNIQUE INDEX .*\(event_id, recipient_user_id\) WHERE /, `index de regroupement : ${regroup}`);
        for (const word of ["'EVENT_CHANGED'", "'SMS'", "'PENDING'"]) assert.ok(regroup.includes(word), `index de regroupement sans ${word} : ${regroup}`);
        const due = index.get('idx_outbox_due')!;
        assert.match(due, /\(next_attempt_at\) WHERE .*'PENDING'.*'OUTBOX'/, `index des lignes dues : ${due}`);

        const triggers = new Map(cat.trg.map((t) => [t.tgname, t.tgenabled]));
        for (const t of ['trg_notification_outbox_updated_at', 'trg_notification_outbox_guard']) {
            assert.equal(triggers.get(t), 'O', `trigger ${t} présent et actif : ${JSON.stringify(cat.trg)}`);
        }
    });

    test('chaque CHECK refuse sa ligne fabriquée ; une ligne conforme est acceptée (transaction annulée)', async () => {
        const fx = await loadFixtures();
        const results = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'CHECK');
            const ins = (over: Record<string, unknown>) => attempt(db, () => insertRow(db, 'public.notification_outbox', outboxRow(over)));
            const out: Array<{ label: string; failure: PgFailure | null; code: string | null; constraint?: string }> = [];
            const expect = async (label: string, over: Record<string, unknown>, code: string | null, constraint?: string) => {
                out.push({ label, failure: await ins(over), code, constraint });
            };
            await expect('ligne conforme', {}, null);
            await expect('IN_APP avec compte', { channel: 'IN_APP', recipient_phone: null, recipient_user_id: fx.users.CLIENT.id }, null);
            await expect('journal OTP SENT', { origin: 'SYNC_LOG', type: 'OTP_LOGIN', status: 'SENT', attempts: 1, sent_at: NOW, finished_at: NOW }, null);
            await expect('aucun destinataire', { recipient_phone: null }, '23514', 'notification_outbox_recipient_chk');
            await expect('IN_APP sans compte', { channel: 'IN_APP' }, '23514', 'notification_outbox_user_channel_chk');
            await expect('PUSH sans compte', { channel: 'PUSH' }, '23514', 'notification_outbox_user_channel_chk');
            await expect('6 tentatives', { attempts: 6 }, '23514', 'notification_outbox_attempts_chk');
            await expect('tentatives négatives', { attempts: -1 }, '23514', 'notification_outbox_attempts_chk');
            await expect('maximum de 6', { max_attempts: 6 }, '23514', 'notification_outbox_attempts_chk');
            await expect('maximum de 0', { max_attempts: 0 }, '23514', 'notification_outbox_attempts_chk');
            await expect('tentatives au-delà du maximum', { attempts: 3, max_attempts: 2 }, '23514', 'notification_outbox_attempts_chk');
            await expect('FAILED sans motif', { status: 'FAILED', finished_at: NOW }, '23514', 'notification_outbox_reason_chk');
            await expect('SKIPPED au motif blanc', { status: 'SKIPPED', reason: '  ', finished_at: NOW }, '23514', 'notification_outbox_reason_chk');
            await expect('CANCELLED sans motif', { status: 'CANCELLED', finished_at: NOW }, '23514', 'notification_outbox_reason_chk');
            await expect('UNCERTAIN sans motif', { status: 'UNCERTAIN', attempts: 1, sent_at: NOW, finished_at: NOW }, '23514', 'notification_outbox_reason_chk');
            await expect('SENDING sans réservation', { status: 'SENDING', attempts: 1 }, '23514', 'notification_outbox_sending_chk');
            await expect('SENDING sans jeton', { status: 'SENDING', attempts: 1, claimed_at: NOW }, '23514', 'notification_outbox_sending_chk');
            await expect('SENT sans sent_at', { status: 'SENT', attempts: 1, finished_at: NOW }, '23514', 'notification_outbox_sent_chk');
            await expect('journal OTP en attente', { origin: 'SYNC_LOG', type: 'OTP_LOGIN' }, '23514', 'notification_outbox_sync_chk');
            await expect('journal OTP CANCELLED', { origin: 'SYNC_LOG', type: 'OTP_LOGIN', status: 'CANCELLED', reason: 'SUPERSEDED', finished_at: NOW }, '23514', 'notification_outbox_sync_chk');
            for (const key of SECRET_KEYS) {
                await expect(`template_data.${key}`, { template_data: { [key]: 'valeur-sensible-482913' } }, '23514', 'notification_outbox_no_secret_chk');
            }
            await expect('numéro étranger', { recipient_phone: '+33612345678' }, '23514');
            await expect('numéro sans indicatif +', { recipient_phone: '221771234567' }, '23514');
            await expect('numéro trop court', { recipient_phone: '+22177123456' }, '23514');
            await expect('email sans @', { recipient_phone: null, recipient_email: 'adresse-invalide' }, '23514');
            await expect('canal WHATSAPP', { channel: 'WHATSAPP' }, '23514');
            await expect('statut DELIVERED', { status: 'DELIVERED' }, '23514');
            await expect('famille MARKETING', { family: 'MARKETING' }, '23514');
            await expect('origine CRON', { origin: 'CRON' }, '23514');
            await expect('détail de plus de 500 caractères', { status: 'FAILED', reason: 'SMS_REJECTED', reason_detail: 'x'.repeat(501), finished_at: NOW }, '23514');
            await expect('type inconnu du registre', { type: 'TEST_TYPE_INCONNU' }, '23503');
            return out;
        });
        const wrong = results.filter((r) => r.code === null
            ? r.failure !== null
            : r.failure?.code !== r.code || (r.constraint !== undefined && r.failure?.constraint !== r.constraint));
        assert.deepEqual(wrong.map((r) => `${r.label} : attendu ${r.code ?? 'accepté'}${r.constraint ? ` (${r.constraint})` : ''}, obtenu ${JSON.stringify(r.failure)}`), [],
            'contraintes de notification_outbox');
    });

    test('clé d’idempotence UNIQUE ; un seul SMS de changement PENDING par porteur et par événement', async () => {
        const fx = await loadFixtures();
        const eventId = fx.events.A_PUBLIE.id;
        const r = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'UNIQUE');
            const first = outboxRow();
            const ok = await attempt(db, () => insertRow(db, 'public.notification_outbox', first));
            const dup = await attempt(db, () => insertRow(db, 'public.notification_outbox', outboxRow({ idempotency_key: first.idempotency_key })));
            const change = (userId: string, over: Record<string, unknown> = {}) => outboxRow({
                type: 'EVENT_CHANGED', family: 'OPTIONAL', topic: 'EVENT_UPDATES', event_id: eventId, recipient_user_id: userId, recipient_phone: null, ...over,
            });
            const pending1 = await attempt(db, () => insertRow(db, 'public.notification_outbox', change(fx.users.CLIENT.id)));
            const pending2 = await attempt(db, () => insertRow(db, 'public.notification_outbox', change(fx.users.CLIENT.id)));
            const sentSame = await attempt(db, () => insertRow(db, 'public.notification_outbox',
                change(fx.users.CLIENT.id, { status: 'SENT', attempts: 1, sent_at: NOW, finished_at: NOW })));
            const otherUser = await attempt(db, () => insertRow(db, 'public.notification_outbox', change(fx.users.CLIENT_BIS.id)));
            const inAppSame = await attempt(db, () => insertRow(db, 'public.notification_outbox', change(fx.users.CLIENT.id, { channel: 'IN_APP' })));
            return { ok, dup, pending1, pending2, sentSame, otherUser, inAppSame };
        });
        assert.equal(r.ok, null, `première ligne : ${JSON.stringify(r.ok)}`);
        assert.equal(r.dup?.code, '23505', `même clé : ${JSON.stringify(r.dup)}`);
        assert.equal(r.dup?.constraint, 'notification_outbox_idempotency_key_key', `contrainte de la clé : ${JSON.stringify(r.dup)}`);
        assert.equal(r.pending1, null, `premier SMS de changement PENDING : ${JSON.stringify(r.pending1)}`);
        assert.equal(r.pending2?.code, '23505', `second SMS de changement PENDING pour le même porteur : ${JSON.stringify(r.pending2)}`);
        assert.equal(r.pending2?.constraint, 'uq_outbox_event_change_pending_sms', `index de regroupement : ${JSON.stringify(r.pending2)}`);
        assert.equal(r.sentSame, null, `SMS de changement SENT à côté du PENDING : ${JSON.stringify(r.sentSame)}`);
        assert.equal(r.otherUser, null, `autre porteur : ${JSON.stringify(r.otherUser)}`);
        assert.equal(r.inAppSame, null, `in-app du même changement : ${JSON.stringify(r.inAppSame)}`);
    });
});

// ── Garde des statuts (service_role) ───────────────────────────────────────

describe('6.1 Boîte d’envoi : garde des statuts NT409, y compris pour le service_role', () => {
    const TERMINAL: Array<{ status: 'SENT' | 'SKIPPED' | 'CANCELLED' | 'UNCERTAIN'; reason?: string; attempts: number }> = [
        { status: 'SENT', attempts: 1 },
        { status: 'SKIPPED', reason: 'NO_PHONE', attempts: 0 },
        { status: 'CANCELLED', reason: 'EVENT_ANNULE', attempts: 0 },
        { status: 'UNCERTAIN', reason: 'PROVIDER_TIMEOUT', attempts: 1 },
    ];

    for (const t of TERMINAL) {
        test(`ligne ${t.status} : statut, clé et destinataire figés (NT409 « Une notification terminée ne change plus. »)`, async () => {
            const row = await insertOutboxRow({ type: 'PASSWORD_CHANGED', status: t.status, reason: t.reason, attempts: t.attempts });
            const changes: Array<[string, Record<string, unknown>]> = [
                ['statut → PENDING', { status: 'PENDING', next_attempt_at: new Date(Date.now() + 30 * 24 * 3600_000).toISOString() }],
                ['statut → FAILED', { status: 'FAILED', reason: 'SMS_REJECTED' }],
                ['clé d’idempotence', { idempotency_key: `${row.idempotency_key}:MODIFIEE` }],
                ['numéro du destinataire', { recipient_phone: randomSenegalPhone('76') }],
                ['compte destinataire', { recipient_user_id: buyer.userId }],
            ];
            for (const [what, change] of changes) {
                const { data, error } = await service.from('notification_outbox').update(change).eq('id', row.id).select('id');
                assert.equal(error?.code, 'NT409', `${t.status}, ${what} : refus NT409 attendu, obtenu ${JSON.stringify({ data, error })}`);
                assert.match(error?.message ?? '', /Une notification terminée ne change plus\./, `${t.status}, ${what} : message`);
            }
            const [after1] = await outboxRows({ ids: [row.id] });
            assert.equal(after1.status, t.status, 'statut inchangé');
            assert.equal(after1.idempotency_key, row.idempotency_key, 'clé inchangée');
            assert.equal(after1.recipient_phone, row.recipient_phone, 'numéro inchangé');
            assert.equal(after1.recipient_user_id, null, 'compte destinataire inchangé');
        });
    }

    test('FAILED → PENDING refusé hors relance manuelle (GUC notif.manual_retry absente) ; PENDING → PENDING admis', async () => {
        const failed = await insertOutboxRow({ type: 'PASSWORD_CHANGED', status: 'FAILED', reason: 'SMS_REJECTED', attempts: 5 });
        const later = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
        const retry = await service.from('notification_outbox').update({ status: 'PENDING', attempts: 0, next_attempt_at: later }).eq('id', failed.id).select('id');
        assert.equal(retry.error?.code, 'NT409', `FAILED → PENDING sans relance manuelle : ${JSON.stringify(retry)}`);
        const [stillFailed] = await outboxRows({ ids: [failed.id] });
        assert.equal(stillFailed.status, 'FAILED', 'la ligne reste FAILED');

        const pending = await insertOutboxRow({ type: 'PASSWORD_CHANGED' });
        const upd = await service.from('notification_outbox').update({ template_data: { regroupe: true } }).eq('id', pending.id).select('id, template_data');
        assert.equal(upd.error, null, `PENDING → PENDING (données regroupées) : ${upd.error?.message}`);
        assert.deepEqual((upd.data ?? [])[0]?.template_data, { regroupe: true }, 'données modifiées');
        const [pendingAfter] = await outboxRows({ ids: [pending.id] });
        assert.ok(Date.parse(pendingAfter.updated_at) > Date.parse(pending.updated_at), `updated_at posé par le trigger : ${pending.updated_at} → ${pendingAfter.updated_at}`);
    });
});

// ── Publication, RLS, privileges ───────────────────────────────────────────

describe('6.1 Tables du lot : jamais publiées, RLS sans politique, service_role seul (contrat C2, C5)', () => {
    test('aucune table du lot dans la publication supabase_realtime', async () => {
        const r = await inspect(async (db) => {
            await assertNotificationSchema('notif-outbox publication', db);
            const exists = (await db.query<{ t: string; ok: boolean }>(
                `SELECT t, to_regclass('public.' || t) IS NOT NULL AS ok FROM unnest($1::text[]) AS t`, [[...LOT6_TABLES]])).rows;
            const published = (await db.query<{ tablename: string }>(
                `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = ANY($1::text[])`,
                [[...LOT6_TABLES]])).rows;
            return { exists, published };
        });
        assert.deepEqual(r.exists.filter((e) => !e.ok).map((e) => e.t), [], 'tables du lot présentes (sinon l’absence de publication ne prouve rien)');
        assert.deepEqual(r.published.map((p) => p.tablename), [], 'tables du lot publiées en temps réel');
    });

    test('RLS activée, aucune politique, aucun privilège pour anon et authenticated, service_role complet', async () => {
        const rows = await inspect(async (db) => {
            await assertNotificationSchema('notif-outbox privilèges', db);
            const out: Array<Record<string, unknown>> = [];
            for (const t of LOT6_TABLES) {
                const rel = `public.${t}`;
                const { rows: [r] } = await db.query<Record<string, unknown>>(
                    `SELECT c.relrowsecurity AS rls,
                            (SELECT count(*)::int FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = $2::text) AS policies,
                            has_any_column_privilege('anon', $1::text, 'SELECT') AS anon_select,
                            has_table_privilege('anon', $1::text, 'INSERT') AS anon_insert,
                            has_any_column_privilege('anon', $1::text, 'UPDATE') AS anon_update,
                            has_table_privilege('anon', $1::text, 'DELETE') AS anon_delete,
                            has_any_column_privilege('authenticated', $1::text, 'SELECT') AS auth_select,
                            has_table_privilege('authenticated', $1::text, 'INSERT') AS auth_insert,
                            has_any_column_privilege('authenticated', $1::text, 'UPDATE') AS auth_update,
                            has_table_privilege('authenticated', $1::text, 'DELETE') AS auth_delete,
                            has_table_privilege('authenticated', $1::text, 'TRUNCATE') AS auth_truncate,
                            has_table_privilege('service_role', $1::text, 'SELECT') AS svc_select,
                            has_table_privilege('service_role', $1::text, 'INSERT') AS svc_insert,
                            has_table_privilege('service_role', $1::text, 'UPDATE') AS svc_update,
                            has_table_privilege('service_role', $1::text, 'DELETE') AS svc_delete
                       FROM pg_class c WHERE c.oid = $1::text::regclass`, [rel, t]);
                out.push({ table: t, ...r });
            }
            return out;
        });
        const problems: string[] = [];
        for (const r of rows) {
            if (r.rls !== true) problems.push(`${r.table} : RLS non activée`);
            if (r.policies !== 0) problems.push(`${r.table} : ${r.policies} politique(s), aucune attendue`);
            for (const k of ['anon_select', 'anon_insert', 'anon_update', 'anon_delete', 'auth_select', 'auth_insert', 'auth_update', 'auth_delete', 'auth_truncate']) {
                if (r[k] !== false) problems.push(`${r.table} : privilège ${k} accordé`);
            }
            const svc = r.table === 'notification_types' ? ['svc_select'] : ['svc_select', 'svc_insert', 'svc_update', 'svc_delete'];
            for (const k of svc) if (r[k] !== true) problems.push(`${r.table} : privilège ${k} manquant au service_role`);
        }
        assert.deepEqual(problems, [], 'RLS et privilèges des tables du lot');
    });

    test('préférences et abonnements push : clés, CHECK et unicité (contrat C5)', async () => {
        const fx = await loadFixtures();
        const user = fx.users.CLIENT_BIS.id;
        const r = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'C5');
            await db.query('DELETE FROM public.notification_preferences WHERE user_id = $1', [user]);
            const pref = (topic: string, channel: string) => attempt(db, () => db.query(
                'INSERT INTO public.notification_preferences (user_id, topic, channel, enabled) VALUES ($1, $2, $3, false)', [user, topic, channel]));
            const okPref = await pref('REMINDERS', 'SMS');
            const dupPref = await pref('REMINDERS', 'SMS');
            const badTopic = await pref('MARKETING', 'SMS');
            const badChannel = await pref('REMINDERS', 'WHATSAPP');
            const endpoint = `https://fcm.googleapis.com/fcm/send/${randomUUID()}`;
            const sub = (over: Record<string, unknown>) => attempt(db, () => insertRow(db, 'public.push_subscriptions', {
                user_id: user, endpoint: `https://fcm.googleapis.com/fcm/send/${randomUUID()}`,
                p256dh: 'B'.repeat(87), auth: 'A'.repeat(22), vapid_key_id: 'K'.repeat(16), ...over,
            }));
            const okSub = await sub({ endpoint });
            const dupEndpoint = await sub({ endpoint });
            const ftp = await sub({ endpoint: 'ftp://push.example/abc' });
            const shortKey = await sub({ p256dh: 'B'.repeat(86) });
            const badAuth = await sub({ auth: 'A'.repeat(21) + '=' });
            const badKeyId = await sub({ vapid_key_id: 'K'.repeat(15) });
            return { okPref, dupPref, badTopic, badChannel, okSub, dupEndpoint, ftp, shortKey, badAuth, badKeyId };
        });
        assert.equal(r.okPref, null, `préférence conforme : ${JSON.stringify(r.okPref)}`);
        assert.equal(r.dupPref?.code, '23505', `clé (user_id, topic, channel) : ${JSON.stringify(r.dupPref)}`);
        assert.equal(r.badTopic?.code, '23514', `sujet inconnu : ${JSON.stringify(r.badTopic)}`);
        assert.equal(r.badChannel?.code, '23514', `canal inconnu : ${JSON.stringify(r.badChannel)}`);
        assert.equal(r.okSub, null, `abonnement conforme : ${JSON.stringify(r.okSub)}`);
        assert.equal(r.dupEndpoint?.code, '23505', `endpoint UNIQUE : ${JSON.stringify(r.dupEndpoint)}`);
        for (const k of ['ftp', 'shortKey', 'badAuth', 'badKeyId'] as const) assert.equal(r[k]?.code, '23514', `${k} : ${JSON.stringify(r[k])}`);
    });

    test('admin_signals accepte les nouveaux types et garde un seul signal par objet pour eux (contrat C6)', async () => {
        const ref = randomUUID();
        const r = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'C6');
            const sig = (kind: string, refId: string) => attempt(db, () => db.query('INSERT INTO public.admin_signals (kind, ref_id) VALUES ($1, $2)', [kind, refId]));
            const out: Record<string, PgFailure | null> = {};
            for (const kind of ['NOTIFICATION_FAILED', 'SMS_DAILY_THRESHOLD', 'CASHOUT_UNCERTAIN', 'REFUND_TO_RETRY', 'EVENT_SUBMITTED', 'PARTNER_REGISTERED']) {
                out[kind] = await sig(kind, ref);
            }
            out.duplicateFailed = await sig('NOTIFICATION_FAILED', ref);
            out.duplicateSubmitted = await sig('EVENT_SUBMITTED', ref);
            out.unknown = await sig('AUTRE_SIGNAL', randomUUID());
            return out;
        });
        for (const kind of ['NOTIFICATION_FAILED', 'SMS_DAILY_THRESHOLD', 'CASHOUT_UNCERTAIN', 'REFUND_TO_RETRY', 'EVENT_SUBMITTED', 'PARTNER_REGISTERED']) {
            assert.equal(r[kind], null, `signal ${kind} accepté : ${JSON.stringify(r[kind])}`);
        }
        assert.equal(r.duplicateFailed?.code, '23505', `second NOTIFICATION_FAILED pour la même ligne : ${JSON.stringify(r.duplicateFailed)}`);
        assert.equal(r.duplicateFailed?.constraint, 'uq_admin_signals_lot6', `index uq_admin_signals_lot6 : ${JSON.stringify(r.duplicateFailed)}`);
        assert.equal(r.duplicateSubmitted, null, `EVENT_SUBMITTED reste sans unicité (lot 5) : ${JSON.stringify(r.duplicateSubmitted)}`);
        assert.equal(r.unknown?.code, '23514', `type de signal inconnu : ${JSON.stringify(r.unknown)}`);
    });
});

// ── D : fonctions communes ─────────────────────────────────────────────────

describe('6.1 Fonctions SQL communes (contrat D)', () => {
    const FUNCTIONS: Array<[string, 'i' | 's' | 'v' | null]> = [
        ['public.event_start_at(uuid)', 's'],
        ['public.notif_in_quiet_hours(timestamptz, integer, integer)', 'i'],
        ['public.notif_setting_int(text)', 's'],
        ['public.notif_account_blocked(uuid)', 's'],
        ['public.notif_preference_enabled(uuid, text, text)', 's'],
        ['public.notif_admin_recipients(text)', 's'],
        ['public.notif_enqueue(jsonb)', null],
        ['public.notif_enqueue_admins(jsonb)', null],
        ['public.ticket_transfer_identity(text, uuid)', 's'],
        ['public.notification_sync_log(jsonb)', null],
        ['public.notification_admin_alert(jsonb)', null],
    ];

    test('chaque fonction existe, SECURITY DEFINER, search_path = public, volatilité du contrat, EXECUTE au service_role seul', async () => {
        const rows = await inspect(async (db) => {
            const out: Array<Record<string, unknown>> = [];
            for (const [sig] of FUNCTIONS) {
                const { rows: [r] } = await db.query<Record<string, unknown>>(
                    `SELECT to_regprocedure($1::text) IS NOT NULL AS present,
                            p.prosecdef AS secdef, p.provolatile::text AS volatile, p.proconfig AS config,
                            CASE WHEN p.oid IS NULL THEN NULL ELSE has_function_privilege('anon', p.oid, 'EXECUTE') END AS anon,
                            CASE WHEN p.oid IS NULL THEN NULL ELSE has_function_privilege('authenticated', p.oid, 'EXECUTE') END AS auth,
                            CASE WHEN p.oid IS NULL THEN NULL ELSE has_function_privilege('service_role', p.oid, 'EXECUTE') END AS svc
                       FROM (SELECT to_regprocedure($1::text)::oid AS oid) x LEFT JOIN pg_proc p ON p.oid = x.oid`, [sig]);
                out.push({ sig, ...r });
            }
            return out;
        });
        const problems: string[] = [];
        for (const r of rows) {
            const want = FUNCTIONS.find(([s]) => s === r.sig)![1];
            if (r.present !== true) { problems.push(`${r.sig} : absente (migration 20261103000002)`); continue; }
            if (r.secdef !== true) problems.push(`${r.sig} : SECURITY DEFINER attendu`);
            if (!Array.isArray(r.config) || !(r.config as string[]).some((c) => /^search_path=("?public"?)$/.test(c))) problems.push(`${r.sig} : SET search_path = public attendu (${JSON.stringify(r.config)})`);
            if (want && r.volatile !== want) problems.push(`${r.sig} : volatilité ${r.volatile}, attendu ${want}`);
            if (r.anon !== false) problems.push(`${r.sig} : EXECUTE accordé à anon`);
            if (r.auth !== false) problems.push(`${r.sig} : EXECUTE accordé à authenticated`);
            if (r.svc !== true) problems.push(`${r.sig} : EXECUTE manquant au service_role`);
        }
        assert.deepEqual(problems, [], 'fonctions du contrat D');
    });

    test('event_start_at : début de l’événement à l’heure de Dakar (UTC+0)', async () => {
        const fx = await loadFixtures();
        const eventId = fx.events.A_PUBLIE.id;
        const start = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'event_start_at', ['events']);
            await db.query(`UPDATE public.events SET start_date = '2027-03-14', start_time = '20:30:00', end_date = '2027-03-14', end_time = '23:30:00' WHERE id = $1`, [eventId]);
            return (await db.query<{ s: Date }>('SELECT public.event_start_at($1::uuid) AS s', [eventId])).rows[0].s;
        });
        assert.equal(new Date(start).toISOString(), '2027-03-14T20:30:00.000Z', 'début = 14/03/2027 20:30 à Dakar');
    });

    test('notif_in_quiet_hours : plage qui passe minuit, plage dans la journée, plage vide, heure de Dakar', async () => {
        const cases: Array<[string, number, number, boolean]> = [
            ['2026-12-01T23:00:00Z', 22, 8, true],
            ['2026-12-01T22:00:00Z', 22, 8, true],
            ['2026-12-01T21:59:59Z', 22, 8, false],
            ['2026-12-02T03:00:00Z', 22, 8, true],
            ['2026-12-02T07:59:00Z', 22, 8, true],
            ['2026-12-02T08:00:00Z', 22, 8, false],
            ['2026-12-01T12:00:00Z', 22, 8, false],
            ['2026-12-01T23:30:00+01:00', 22, 8, true],
            ['2026-12-01T22:30:00-01:00', 22, 8, true],
            ['2026-12-01T00:30:00Z', 0, 0, false],
            ['2026-12-01T12:00:00Z', 12, 12, false],
            ['2026-12-01T09:00:00Z', 9, 17, true],
            ['2026-12-01T16:59:00Z', 9, 17, true],
            ['2026-12-01T17:00:00Z', 9, 17, false],
            ['2026-12-01T08:59:00Z', 9, 17, false],
        ];
        const got = await inspect(async (db) => {
            const out: string[] = [];
            for (const [at, s, e, want] of cases) {
                const r = (await db.query<{ q: boolean }>('SELECT public.notif_in_quiet_hours($1::timestamptz, $2::int, $3::int) AS q', [at, s, e])).rows[0].q;
                if (r !== want) out.push(`${at} (${s} h - ${e} h) : ${r}, attendu ${want}`);
            }
            return out;
        });
        assert.deepEqual(got, [], 'plage de silence');
    });

    test('notif_setting_int : entier lu, NULL si la clé manque ou si la valeur n’est pas entière (jamais de défaut caché)', async () => {
        const r = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'notif_setting_int', ['platform_settings']);
            await db.query(`INSERT INTO public.platform_settings (key, value, description) VALUES
                ('notif.test_lot6_entier', '{"value": 7}', 'test'), ('notif.test_lot6_texte', '{"value": "sept"}', 'test'),
                ('notif.test_lot6_decimal', '{"value": 7.5}', 'test')`);
            const read = async (k: string) => (await db.query<{ v: number | null }>('SELECT public.notif_setting_int($1) AS v', [k])).rows[0].v;
            return {
                entier: await read('notif.test_lot6_entier'), texte: await read('notif.test_lot6_texte'),
                decimal: await read('notif.test_lot6_decimal'), absent: await read('notif.test_lot6_absent'),
            };
        });
        assert.deepEqual(r, { entier: 7, texte: null, decimal: null, absent: null }, 'lectures de notif_setting_int');
    });

    test('notif_account_blocked : SUSPENDU, SUPPRIME et partenaire SUSPENDU bloquent ; ACTIF et EN_ATTENTE non', async () => {
        const fx = await loadFixtures();
        const r = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'notif_account_blocked', ['users', 'partners']);
            await db.query(`UPDATE public.users SET status = 'SUPPRIME' WHERE id = $1`, [fx.users.CLIENT_BIS.id]);
            await db.query(`UPDATE public.users SET status = 'EN_ATTENTE' WHERE id = $1`, [fx.users.CONTROLLER_A.id]);
            await db.query(`UPDATE public.users SET status = 'ACTIF' WHERE id = $1`, [fx.partners.A.userId]);
            await db.query(`UPDATE public.partners SET status = 'SUSPENDU' WHERE id = $1`, [fx.partners.A.id]);
            await db.query(`UPDATE public.partners SET status = 'VALIDE' WHERE id = $1`, [fx.partners.B.id]);
            const blocked = async (id: string) => (await db.query<{ b: boolean }>('SELECT public.notif_account_blocked($1::uuid) AS b', [id])).rows[0].b;
            return {
                actif: await blocked(fx.users.CLIENT.id), suspendu: await blocked(fx.users.SUSPENDED.id),
                supprime: await blocked(fx.users.CLIENT_BIS.id), enAttente: await blocked(fx.users.CONTROLLER_A.id),
                partenaireSuspendu: await blocked(fx.partners.A.userId), partenaireValide: await blocked(fx.partners.B.userId),
            };
        });
        assert.deepEqual(r, { actif: false, suspendu: true, supprime: true, enAttente: false, partenaireSuspendu: true, partenaireValide: false },
            'comptes bloqués (et seulement eux)');
    });

    test('notif_preference_enabled : activée sans ligne, sinon la valeur enregistrée', async () => {
        const fx = await loadFixtures();
        const user = fx.users.CLIENT.id;
        const r = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'notif_preference_enabled');
            await db.query('DELETE FROM public.notification_preferences WHERE user_id = $1', [user]);
            const read = async (topic: string, channel: string) => (await db.query<{ e: boolean }>(
                'SELECT public.notif_preference_enabled($1::uuid, $2, $3) AS e', [user, topic, channel])).rows[0].e;
            const sansLigne = await read('REMINDERS', 'SMS');
            await db.query(`INSERT INTO public.notification_preferences (user_id, topic, channel, enabled) VALUES ($1, 'REMINDERS', 'SMS', false)`, [user]);
            const desactivee = await read('REMINDERS', 'SMS');
            const autreCanal = await read('REMINDERS', 'PUSH');
            const autreSujet = await read('EVENT_UPDATES', 'SMS');
            await db.query(`UPDATE public.notification_preferences SET enabled = true WHERE user_id = $1 AND topic = 'REMINDERS' AND channel = 'SMS'`, [user]);
            const reactivee = await read('REMINDERS', 'SMS');
            return { sansLigne, desactivee, autreCanal, autreSujet, reactivee };
        });
        assert.deepEqual(r, { sansLigne: true, desactivee: false, autreCanal: true, autreSujet: true, reactivee: true }, 'préférences lues');
    });

    test('notif_admin_recipients : SUPERADMIN actif, ADMIN avec la permission ; users.role ignoré, comptes non actifs exclus', async () => {
        const fx = await loadFixtures();
        const withPerm = fx.users.CLIENT_BIS.id;
        const noPerm = fx.users.CONTROLLER_A.id;
        const legacyRole = fx.users.CLIENT.id;
        const suspendedSuper = fx.users.SUSPENDED.id;
        const r = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'notif_admin_recipients', ['users', 'user_roles', 'admin_permissions']);
            await db.query(`INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'ADMIN'), ($2, 'ADMIN'), ($3, 'SUPERADMIN') ON CONFLICT DO NOTHING`,
                [withPerm, noPerm, suspendedSuper]);
            await db.query(`INSERT INTO public.admin_permissions (user_id, permission) VALUES ($1, 'notifications.read') ON CONFLICT DO NOTHING`, [withPerm]);
            await db.query(`DELETE FROM public.user_roles WHERE user_id = $1 AND role IN ('ADMIN', 'SUPERADMIN')`, [legacyRole]);
            await db.query(`UPDATE public.users SET role = 'ADMIN' WHERE id = $1`, [legacyRole]);
            const list = async (perm: string | null) => new Set((await db.query<{ id: string }>(
                'SELECT r::text AS id FROM public.notif_admin_recipients($1::text) AS r', [perm])).rows.map((x) => x.id));
            return { notif: await list('notifications.read'), events: await list('events.read'), any: await list(null) };
        });
        const superadmin = fx.users.SUPERADMIN.id;
        assert.ok(r.notif.has(superadmin) && r.events.has(superadmin) && r.any.has(superadmin), 'le SUPERADMIN actif reçoit tout');
        assert.ok(r.notif.has(withPerm), 'ADMIN avec notifications.read : destinataire de notifications.read');
        assert.ok(!r.events.has(withPerm), 'ADMIN sans events.read : pas destinataire de events.read');
        assert.ok(r.any.has(withPerm) && r.any.has(noPerm), 'permission NULL : tout ADMIN actif');
        assert.ok(!r.notif.has(noPerm), 'ADMIN sans la permission : exclu');
        assert.ok(!r.notif.has(legacyRole) && !r.any.has(legacyRole), 'users.role = ADMIN sans user_roles : jamais destinataire');
        assert.ok(!r.notif.has(suspendedSuper) && !r.any.has(suspendedSuper), 'SUPERADMIN suspendu : exclu');
    });
});

// ── notif_enqueue ──────────────────────────────────────────────────────────

describe('6.1 notif_enqueue : mise en file dans la transaction de l’appelant (contrat D)', () => {
    test('une ligne PENDING par canal du registre, clés, données copiées, numéro non recopié ; rejeu sans doublon', async () => {
        const now = new Date(Date.now() + FUTURE_MS);
        const key = `PURCHASE_CONFIRMED:${randomUUID()}`;
        const data = purchaseData();
        const r = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'notif_enqueue');
            const created = await enqueue(db, { type: 'PURCHASE_CONFIRMED', key, user_id: buyer.userId, data, now: now.toISOString() });
            const rows = await groupRows(db, key);
            const replay = await enqueue(db, { type: 'PURCHASE_CONFIRMED', key, user_id: buyer.userId, data: { ...data, total: 1 }, now: now.toISOString() });
            const rowsAfter = await groupRows(db, key);
            return { created, rows, replay, rowsAfter };
        });
        assert.equal(r.created, 3, `lignes créées : ${show(r.rows)}`);
        assert.deepEqual(channelsOf(r.rows), ['EMAIL', 'IN_APP', 'SMS'], 'canaux du registre (I S M)');
        for (const row of r.rows) {
            const what = `ligne ${row.channel}`;
            assert.equal(row.idempotency_key, `${key}:${row.channel}`, `${what} : clé`);
            assert.equal(row.group_key, key, `${what} : clé de groupe`);
            assert.equal(row.type, 'PURCHASE_CONFIRMED');
            assert.equal(row.family, 'ESSENTIAL', `${what} : famille copiée du registre`);
            assert.equal(row.topic, null, `${what} : sujet`);
            assert.equal(row.origin, 'OUTBOX');
            assert.equal(row.recipient_user_id, buyer.userId, `${what} : compte`);
            assert.equal(row.recipient_phone, null, `${what} : le numéro du compte n’est pas recopié (résolu à l’envoi)`);
            assert.equal(row.recipient_email, null, `${what} : l’email du compte n’est pas recopié`);
            assert.equal(row.status, 'PENDING', `${what} : statut`);
            assert.equal(row.reason, null, `${what} : motif`);
            assert.equal(row.attempts, 0);
            assert.equal(row.max_attempts, 5);
            assert.equal(new Date(row.due_at).getTime(), now.getTime(), `${what} : due_at = p.now`);
            assert.equal(new Date(row.next_attempt_at).getTime(), now.getTime(), `${what} : next_attempt_at = due_at`);
            assert.deepEqual(row.template_data, data, `${what} : données copiées`);
            assert.equal(row.finished_at, null, `${what} : pas terminée`);
            assert.equal(row.claimed_at, null);
            assert.equal(row.claim_token, null);
        }
        assert.equal(r.replay, 0, 'rejeu : aucune ligne créée (ON CONFLICT DO NOTHING)');
        assert.deepEqual(r.rowsAfter.map((x) => [x.id, x.template_data]), r.rows.map((x) => [x.id, x.template_data]), 'rejeu : lignes et données inchangées');
    });

    test('due_at fourni ; filtre des canaux ; IN_APP et PUSH seulement avec un compte', async () => {
        const now = new Date(Date.now() + FUTURE_MS);
        const due = new Date(now.getTime() + 3600_000);
        const phone = randomSenegalPhone('76');
        const k = { due: `PURCHASE_CONFIRMED:${randomUUID()}`, sms: `PURCHASE_CONFIRMED:${randomUUID()}`, phoneOnly: `TRANSFER_OFFERED:${randomUUID()}` };
        const r = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'notif_enqueue canaux');
            const nDue = await enqueue(db, { type: 'PURCHASE_CONFIRMED', key: k.due, user_id: buyer.userId, data: purchaseData(), due_at: due.toISOString(), now: now.toISOString() });
            const nSms = await enqueue(db, { type: 'PURCHASE_CONFIRMED', key: k.sms, user_id: buyer.userId, data: purchaseData(), channels: ['SMS'], now: now.toISOString() });
            const nPhone = await enqueue(db, { type: 'TRANSFER_OFFERED', key: k.phoneOnly, phone, data: { transfer_id: randomUUID() }, now: now.toISOString() });
            return { nDue, due: await groupRows(db, k.due), nSms, sms: await groupRows(db, k.sms), nPhone, phone: await groupRows(db, k.phoneOnly) };
        });
        assert.equal(r.nDue, 3);
        for (const row of r.due) {
            assert.equal(new Date(row.due_at).getTime(), due.getTime(), `${row.channel} : due_at fourni`);
            assert.equal(new Date(row.next_attempt_at).getTime(), due.getTime(), `${row.channel} : next_attempt_at = due_at`);
        }
        assert.equal(r.nSms, 1, `channels: ['SMS'] : ${show(r.sms)}`);
        assert.deepEqual(channelsOf(r.sms), ['SMS']);
        assert.equal(r.nPhone, 1, `TRANSFER_OFFERED vers un numéro seul : SMS seulement (IN_APP et PUSH exigent un compte) : ${show(r.phone)}`);
        assert.deepEqual(channelsOf(r.phone), ['SMS']);
        assert.equal(r.phone[0].recipient_phone, phone, 'numéro fourni recopié');
        assert.equal(r.phone[0].recipient_user_id, null);
        assert.equal(r.phone[0].status, 'PENDING');
    });

    test('SKIPPED dès l’insertion : motif fourni (skip), préférence désactivée ; instantané et finished_at posés', async () => {
        const now = new Date(Date.now() + FUTURE_MS);
        const k = { skip: `REMINDER_J1:${randomUUID()}`, pref: `REMINDER_H3:${randomUUID()}` };
        const reminderData = { event_id: randomUUID(), title: 'TEST Rappel', start_at: new Date(now.getTime() + 24 * 3600_000).toISOString(), location: 'Lieu', city: 'Dakar', sms_policy: 'NEVER' };
        const r = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'notif_enqueue SKIPPED');
            await db.query('DELETE FROM public.notification_preferences WHERE user_id = $1', [buyer.userId]);
            const nSkip = await enqueue(db, { type: 'REMINDER_J1', key: k.skip, user_id: buyer.userId, data: reminderData, skip: { SMS: 'SMS_POLICY_NEVER' }, now: now.toISOString() });
            await db.query(`INSERT INTO public.notification_preferences (user_id, topic, channel, enabled) VALUES ($1, 'REMINDERS', 'PUSH', false)`, [buyer.userId]);
            const nPref = await enqueue(db, { type: 'REMINDER_H3', key: k.pref, user_id: buyer.userId, data: { ...reminderData, sms_policy: 'IF_NO_PUSH' }, now: now.toISOString() });
            return { nSkip, skip: await groupRows(db, k.skip), nPref, pref: await groupRows(db, k.pref) };
        });
        assert.equal(r.nSkip, 4, `REMINDER_J1 : une ligne par canal, SKIPPED compris : ${show(r.skip)}`);
        const s = byChannel(r.skip);
        assert.equal(s.SMS?.status, 'SKIPPED', `SMS : ${show(r.skip)}`);
        assert.equal(s.SMS?.reason, 'SMS_POLICY_NEVER');
        assert.equal(new Date(s.SMS!.finished_at!).getTime(), now.getTime(), 'SKIPPED : finished_at = p.now');
        assert.ok(s.SMS?.decision, 'SKIPPED : instantané de décision écrit');
        assert.equal(s.SMS!.decision!.stage, 'ENQUEUE');
        assert.equal(s.SMS!.decision!.outcome, 'SKIP');
        assert.equal(s.SMS!.decision!.reason, 'SMS_POLICY_NEVER');
        for (const ch of ['IN_APP', 'PUSH', 'EMAIL'] as const) {
            assert.equal(s[ch]?.status, 'PENDING', `${ch} : ${show(r.skip)}`);
            assert.equal(s[ch]?.family, 'OPTIONAL');
            assert.equal(s[ch]?.topic, 'REMINDERS');
        }
        assert.equal(r.nPref, 3, `REMINDER_H3 : ${show(r.pref)}`);
        const p = byChannel(r.pref);
        assert.equal(p.PUSH?.status, 'SKIPPED', `PUSH désactivé : ${show(r.pref)}`);
        assert.equal(p.PUSH?.reason, 'PREFERENCE_DISABLED');
        assert.deepEqual(p.PUSH?.decision?.preference, { topic: 'REMINDERS', channel: 'PUSH', enabled: false }, 'instantané de la préférence');
        assert.equal(p.IN_APP?.status, 'PENDING');
        assert.equal(p.SMS?.status, 'PENDING');
    });

    test('compte suspendu ou partenaire suspendu : SKIPPED ACCOUNT_SUSPENDED sous politique BLOCK, avant la préférence ; ALLOW passe', async () => {
        const now = new Date(Date.now() + FUTURE_MS);
        const k = {
            block: `REMINDER_J1:${randomUUID()}`, allow: `PURCHASE_CONFIRMED:${randomUUID()}`,
            partnerBlock: `EVENT_VALIDATED:${randomUUID()}`, partnerAllow: `SHIFT_DISCREPANCY:${randomUUID()}`,
        };
        const r = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'notif_enqueue suspendu', ['users', 'partners']);
            await db.query('DELETE FROM public.notification_preferences WHERE user_id = $1', [buyer.userId]);
            await db.query(`INSERT INTO public.notification_preferences (user_id, topic, channel, enabled) VALUES ($1, 'REMINDERS', 'SMS', false)`, [buyer.userId]);
            await db.query(`UPDATE public.users SET status = 'SUSPENDU' WHERE id = $1`, [buyer.userId]);
            await db.query(`UPDATE public.partners SET status = 'SUSPENDU' WHERE id = $1`, [partner.partnerId]);
            const n = {
                block: await enqueue(db, { type: 'REMINDER_J1', key: k.block, user_id: buyer.userId, data: { title: 'TEST' }, now: now.toISOString() }),
                allow: await enqueue(db, { type: 'PURCHASE_CONFIRMED', key: k.allow, user_id: buyer.userId, data: purchaseData(), now: now.toISOString() }),
                partnerBlock: await enqueue(db, { type: 'EVENT_VALIDATED', key: k.partnerBlock, user_id: partner.userId, data: { title: 'TEST' }, now: now.toISOString() }),
                partnerAllow: await enqueue(db, { type: 'SHIFT_DISCREPANCY', key: k.partnerAllow, user_id: partner.userId, data: { title: 'TEST' }, now: now.toISOString() }),
            };
            return {
                n, block: await groupRows(db, k.block), allow: await groupRows(db, k.allow),
                partnerBlock: await groupRows(db, k.partnerBlock), partnerAllow: await groupRows(db, k.partnerAllow),
            };
        });
        assert.deepEqual(r.n, { block: 4, allow: 3, partnerBlock: 4, partnerAllow: 3 }, 'une ligne par canal du registre, SKIPPED compris');
        for (const row of [...r.block, ...r.partnerBlock]) {
            assert.equal(row.status, 'SKIPPED', `${row.type}/${row.channel} : ${show([row])}`);
            assert.equal(row.reason, 'ACCOUNT_SUSPENDED', `${row.type}/${row.channel} : le compte bloqué passe avant la préférence`);
            assert.equal((row.decision?.account as { blocked?: boolean } | undefined)?.blocked, true, `${row.type}/${row.channel} : instantané du compte`);
        }
        for (const row of [...r.allow, ...r.partnerAllow]) {
            assert.equal(row.status, 'PENDING', `${row.type}/${row.channel} : politique ALLOW (messages liés à l’argent) : ${show([row])}`);
        }
    });

    test('sans téléphone : SMS SKIPPED NO_PHONE (numéro fourni : PENDING) ; email factice : EMAIL SKIPPED NO_REAL_EMAIL (adresse fournie : PENDING)', async () => {
        const now = new Date(Date.now() + FUTURE_MS);
        const phone = randomSenegalPhone('76');
        const email = randomEmail('outbox-email');
        const k = { noPhone: `PURCHASE_CONFIRMED:${randomUUID()}`, withPhone: `PURCHASE_CONFIRMED:${randomUUID()}`, fakeEmail: `PURCHASE_CONFIRMED:${randomUUID()}`, withEmail: `PURCHASE_CONFIRMED:${randomUUID()}` };
        const r = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'notif_enqueue destinataires', ['users']);
            await db.query('UPDATE public.users SET phone = NULL WHERE id = $1', [buyer.userId]);
            await enqueue(db, { type: 'PURCHASE_CONFIRMED', key: k.noPhone, user_id: buyer.userId, data: purchaseData(), now: now.toISOString() });
            await enqueue(db, { type: 'PURCHASE_CONFIRMED', key: k.withPhone, user_id: buyer.userId, phone, data: purchaseData(), now: now.toISOString() });
            await db.query('UPDATE public.users SET email = $2 WHERE id = $1', [buyer.userId, `${Date.now()}${Math.floor(Math.random() * 1000)}@eventvillage.sn`]);
            await enqueue(db, { type: 'PURCHASE_CONFIRMED', key: k.fakeEmail, user_id: buyer.userId, data: purchaseData(), now: now.toISOString() });
            await enqueue(db, { type: 'PURCHASE_CONFIRMED', key: k.withEmail, user_id: buyer.userId, email, data: purchaseData(), now: now.toISOString() });
            return {
                noPhone: byChannel(await groupRows(db, k.noPhone)), withPhone: byChannel(await groupRows(db, k.withPhone)),
                fakeEmail: byChannel(await groupRows(db, k.fakeEmail)), withEmail: byChannel(await groupRows(db, k.withEmail)),
            };
        });
        assert.equal(r.noPhone.SMS?.status, 'SKIPPED', 'compte sans numéro');
        assert.equal(r.noPhone.SMS?.reason, 'NO_PHONE');
        assert.equal(r.noPhone.IN_APP?.status, 'PENDING', 'in-app inchangé');
        assert.equal(r.withPhone.SMS?.status, 'PENDING', 'numéro fourni (numéro payeur)');
        assert.equal(r.withPhone.SMS?.recipient_phone, phone);
        assert.equal(r.fakeEmail.EMAIL?.status, 'SKIPPED', 'adresse factice <chiffres>@eventvillage.sn');
        assert.equal(r.fakeEmail.EMAIL?.reason, 'NO_REAL_EMAIL');
        assert.equal(r.withEmail.EMAIL?.status, 'PENDING', 'adresse réelle fournie');
        assert.equal(r.withEmail.EMAIL?.recipient_email, email);
    });

    test('erreurs : type inconnu NT001, type synchrone NT002, horloge dans le passé NT003', async () => {
        const r = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'notif_enqueue erreurs');
            const call = (p: Record<string, unknown>) => attempt(db, () => enqueue(db, p));
            return {
                unknown: await call({ type: 'TEST_TYPE_INCONNU', key: `TEST:${randomUUID()}`, phone: randomSenegalPhone('76'), data: {} }),
                sync: await call({ type: 'OTP_LOGIN', key: `OTP_LOGIN:${randomUUID()}`, phone: randomSenegalPhone('76'), data: {} }),
                past: await call({ type: 'PASSWORD_CHANGED', key: `PASSWORD_CHANGED:${randomUUID()}`, phone: randomSenegalPhone('76'), data: {},
                    now: new Date(Date.now() - 5 * 60_000).toISOString() }),
            };
        });
        assert.equal(r.unknown?.code, 'NT001', `type inconnu : ${JSON.stringify(r.unknown)}`);
        assert.equal(r.sync?.code, 'NT002', `type sync_only : ${JSON.stringify(r.sync)}`);
        assert.equal(r.past?.code, 'NT003', `horloge dans le passé : ${JSON.stringify(r.past)}`);
    });

    test('notif_enqueue_admins : une ligne par destinataire de la permission du type, clé par admin, rejeu sans doublon', async () => {
        const fx = await loadFixtures();
        const withPerm = fx.users.CLIENT_BIS.id;
        const noPerm = fx.users.CONTROLLER_A.id;
        const ref = randomUUID();
        const prefix = `ADMIN_NOTIFICATION_FAILED:${ref}:`;
        const r = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'notif_enqueue_admins', ['user_roles', 'admin_permissions']);
            await db.query(`INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'ADMIN'), ($2, 'ADMIN') ON CONFLICT DO NOTHING`, [withPerm, noPerm]);
            await db.query(`INSERT INTO public.admin_permissions (user_id, permission) VALUES ($1, 'notifications.read') ON CONFLICT DO NOTHING`, [withPerm]);
            const p = { type: 'ADMIN_NOTIFICATION_FAILED', ref, data: { outbox_id: ref, failed_type: 'PASSWORD_CHANGED', channel: 'SMS', reason: 'SMS_REJECTED' } };
            const sql = 'SELECT public.notif_enqueue_admins($1::jsonb) AS n';
            const first = Number((await db.query<{ n: number }>(sql, [JSON.stringify(p)])).rows[0].n);
            const rows = (await db.query<PgOutbox>('SELECT * FROM public.notification_outbox WHERE idempotency_key LIKE $1 ORDER BY idempotency_key', [`${prefix}%`])).rows;
            const replay = Number((await db.query<{ n: number }>(sql, [JSON.stringify(p)])).rows[0].n);
            return { first, rows, replay };
        });
        assert.equal(r.first, r.rows.length, `nombre renvoyé = lignes créées : ${show(r.rows)}`);
        const keys = new Set(r.rows.map((x) => x.idempotency_key));
        assert.ok(keys.has(`${prefix}${fx.users.SUPERADMIN.id}:IN_APP`), `SUPERADMIN du seed destinataire : ${Array.from(keys).join(', ')}`);
        assert.ok(keys.has(`${prefix}${withPerm}:IN_APP`), 'ADMIN avec notifications.read destinataire');
        assert.ok(!Array.from(keys).some((key) => key.includes(noPerm)), 'ADMIN sans la permission : aucune ligne');
        for (const row of r.rows) {
            assert.equal(row.channel, 'IN_APP', 'canal du registre (I)');
            assert.equal(row.idempotency_key, `${prefix}${row.recipient_user_id}:IN_APP`, 'clé type:ref:admin:canal');
            assert.equal((row.template_data as { outbox_id?: string }).outbox_id, ref, 'données copiées');
        }
        assert.equal(r.replay, 0, 'rejeu sans doublon');
    });
});

// ── notification_sync_log ──────────────────────────────────────────────────

describe('6.1 notification_sync_log : journal des envois synchrones (OTP, invitation), jamais le code', () => {
    async function syncLog(p: Record<string, unknown>): Promise<{ data: Record<string, unknown> | null; error: { code?: string; message: string } | null }> {
        const { data, error } = await service.rpc('notification_sync_log', { p });
        return { data: (data ?? null) as Record<string, unknown> | null, error };
    }

    function assertNoSecret(row: OutboxRow): void {
        const keys = Object.keys(row.template_data ?? {});
        assert.deepEqual(keys.filter((k) => k !== 'purpose'), [], `template_data du journal : seulement « purpose » (${JSON.stringify(row.template_data)})`);
        const text = `${JSON.stringify(row.template_data)} ${row.reason_detail ?? ''}`;
        assert.doesNotMatch(text, /\b\d{6}\b/, 'aucun code à 6 chiffres');
        assert.doesNotMatch(text, /https?:\/\/|\/setup|token|claim/i, 'aucun lien ni jeton');
    }

    test('OTP envoyé : ligne SYNC_LOG SENT, une tentative, horodatée, sans code ; rejeu : une seule ligne', async () => {
        const ref = randomUUID();
        const phone = randomSenegalPhone('76');
        const p = { type: 'OTP_LOGIN', ref, phone, user_id: buyer.userId, outcome: 'SENT', provider_message_id: `fake-sms-journal-${ref.slice(0, 8)}` };
        const first = await syncLog(p);
        assert.equal(first.error, null, `notification_sync_log : ${first.error?.message} (code ${first.error?.code})`);
        assert.equal(first.data?.ok, true, `réponse : ${JSON.stringify(first.data)}`);
        const rows = await outboxRows({ keyPrefix: `OTP_LOGIN:${ref}:` });
        assert.equal(rows.length, 1, `une ligne : ${JSON.stringify(rows)}`);
        const row = rows[0];
        assert.equal(first.data?.id, row.id, 'identifiant renvoyé');
        assert.equal(row.idempotency_key, `OTP_LOGIN:${ref}:SMS`);
        assert.equal(row.group_key, `OTP_LOGIN:${ref}`);
        assert.equal(row.origin, 'SYNC_LOG');
        assert.equal(row.channel, 'SMS');
        assert.equal(row.family, 'ESSENTIAL');
        assert.equal(row.status, 'SENT');
        assert.equal(row.attempts, 1);
        assert.equal(row.recipient_phone, phone);
        assert.equal(row.recipient_user_id, buyer.userId);
        assert.equal(row.provider_message_id, p.provider_message_id);
        assert.ok(row.sent_at && row.finished_at, 'sent_at et finished_at posés');
        assert.ok(Math.abs(Date.parse(row.sent_at!) - Date.now()) < 5 * 60_000, `sent_at à l’heure réelle : ${row.sent_at}`);
        assert.equal(typeof row.template_data.purpose, 'string', 'objet du code (purpose) journalisé');
        assertNoSecret(row);

        const replay = await syncLog(p);
        assert.equal(replay.error, null, `rejeu : ${replay.error?.message}`);
        assert.equal(replay.data?.ok, true, `rejeu : ${JSON.stringify(replay.data)}`);
        assert.equal((await outboxRows({ keyPrefix: `OTP_LOGIN:${ref}:` })).length, 1, 'rejeu : toujours une seule ligne');
    });

    test('invitation en échec : FAILED avec motif ; refus de la garde : SKIPPED avec motif, sans sent_at', async () => {
        const failedRef = randomUUID();
        const skippedRef = randomUUID();
        const failed = await syncLog({ type: 'CONTROLLER_INVITE', ref: failedRef, phone: randomSenegalPhone('76'), outcome: 'FAILED', reason: 'SMS_PROVIDER_ERROR' });
        assert.equal(failed.error, null, `FAILED : ${failed.error?.message}`);
        assert.equal(failed.data?.ok, true, `FAILED : ${JSON.stringify(failed.data)}`);
        const [f] = await outboxRows({ keyPrefix: `CONTROLLER_INVITE:${failedRef}:` });
        assert.equal(f?.status, 'FAILED', JSON.stringify(f));
        assert.equal(f.reason, 'SMS_PROVIDER_ERROR');
        assert.equal(f.origin, 'SYNC_LOG');
        assert.ok(f.finished_at, 'finished_at posé');
        assertNoSecret(f);

        const skipped = await syncLog({ type: 'OTP_REGISTER', ref: skippedRef, phone: randomSenegalPhone('76'), outcome: 'SKIPPED', reason: 'SMS_DAILY_CAP' });
        assert.equal(skipped.error, null, `SKIPPED : ${skipped.error?.message}`);
        const [s] = await outboxRows({ keyPrefix: `OTP_REGISTER:${skippedRef}:` });
        assert.equal(s?.status, 'SKIPPED', JSON.stringify(s));
        assert.equal(s.reason, 'SMS_DAILY_CAP');
        assert.equal(s.sent_at, null, 'SKIPPED : rien n’est parti');
        assertNoSecret(s);
    });

    test('type non synchrone refusé : aucune ligne écrite', async () => {
        const ref = randomUUID();
        const res = await syncLog({ type: 'PURCHASE_CONFIRMED', ref, phone: randomSenegalPhone('76'), outcome: 'SENT' });
        assert.ok(res.error !== null || res.data?.ok === false, `type PURCHASE_CONFIRMED accepté par le journal synchrone : ${JSON.stringify(res)}`);
        assert.ok(res.error === null || res.error.code !== 'PGRST202', `fonction absente (PGRST202) : ${res.error?.message}`);
        assert.deepEqual(await outboxRows({ keyPrefix: `PURCHASE_CONFIRMED:${ref}:` }), [], 'aucune ligne');
    });
});
