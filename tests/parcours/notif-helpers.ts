/**
 * Lot 6 — outils communs des suites de notifications (contrat S1, Conventions « Horloge », section Y).
 *
 *  - Horloge (Africa/Dakar = UTC+0 toute l'année, comme cycle-helpers et acces-helpers) : dakarAt,
 *    dakarDay, noonDakarTomorrow, addMinutes. Aucune horloge dans le passé : scheduleAt et dispatchAt
 *    refusent un `now` antérieur de plus de 30 s à l'heure réelle (la RPC refuse au-delà d'une minute,
 *    contrat Conventions : double envoi entre suites sinon).
 *  - Événement à date exacte : createReminderEvent (brouillon, dates posées par UPDATE de colonnes,
 *    puis advanceEventTo(…, 'PUBLIE')).
 *  - Planification et envoi dans le processus du test : scheduleAt (scheduleReminders, contrat I3),
 *    dispatchAt / flushNotifications (dispatchNotifications, contrat E4). Les modules du lot sont
 *    importés dynamiquement (loadLotModule) : avant correctif, l'aide échoue en nommant le module absent.
 *  - Lecture : outboxRows (boîte d'envoi filtrée, jamais globale), smsMark / smsTo, pushTo, emailsTo.
 *  - Réglages notif.* (withNotifSettings, par finance_setting_set, restaurés en finally ; lot 7, T0c :
 *    + notif.sms_optional_daily_cap et notif.free_ticket_reminder_sms, − notif.sms_daily_alert), variables
 *    d'environnement (withEnv), clés VAPID générées (newVapidKeys, withVapid), abonnement de navigateur
 *    à clés P-256 réelles (fakeBrowserSubscription).
 *  - Comptes : markPhoneVerified (users.phone_verified_at, contrat B1), markEmailVerified (lot 9 bis, G.49),
 *    newAdmin (rôle et permissions).
 *  - Lignes de boîte d'envoi écrites directement (insertOutboxRow, deleteOutboxRows) pour les tests admin.
 * Règle : compter par numéro neuf ou par clé d'idempotence, jamais globalement ni sur un compte du seed.
 */
import '../helpers/env';
import assert from 'node:assert/strict';
import crypto, { randomUUID } from 'node:crypto';
import { resetServerEnvCache } from '../../lib/env';
import { getFakes, type RecordedEmail, type RecordedPush, type RecordedSms } from '../fakes';
import { isModuleNotFound, type DispatchRunReport } from '../helpers/notification-invariants';
import { service, newBuyer, type Buyer, type CategorySpec } from './paiement-helpers';
import { superadminId } from './finance-helpers';
import { advanceEventTo, createDraftEvent, type DraftEvent, type EventOwner } from './cycle-helpers';
import { randomSenegalPhone } from './helpers';

export {
    assertNotificationInvariants, dispatchPendingNotifications, notificationViolations, missingNotificationSchema,
    NOTIFICATION_INVARIANT_SQL, type DispatchRunReport, type NotificationViolation,
} from '../helpers/notification-invariants';

// ── Modules du lot (import dynamique) ──────────────────────────────────────

/**
 * Importe un module du dépôt par un chemin relatif à ce fichier (ex. '../../lib/notifications/dispatcher').
 * Module absent : échec explicite « <what> absent : <chemin> » ; toute autre erreur de chargement remonte.
 */
export async function loadLotModule(relPath: string, what: string): Promise<Record<string, unknown>> {
    try {
        const spec = relPath;
        return (await import(spec)) as Record<string, unknown>;
    } catch (err) {
        if (isModuleNotFound(err, relPath)) {
            assert.fail(`${what} absent : ${relPath.replace(/^(\.\.\/)+/, '')} — ${(err as Error).message.split('\n')[0]}`);
        }
        throw err;
    }
}

/** Fonction exportée d'un module du lot ; échec explicite si le module ou l'export manque. */
export async function lotFunction<F extends (...args: never[]) => unknown>(relPath: string, name: string, what: string): Promise<F> {
    const mod = await loadLotModule(relPath, what);
    assert.equal(typeof mod[name], 'function', `${relPath.replace(/^(\.\.\/)+/, '')} : ${name} non exporté (${what})`);
    return mod[name] as F;
}

// ── Horloge (Africa/Dakar = UTC+0) ─────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** Instant de Dakar : `date` AAAA-MM-JJ, `hhmm` HH:MM (ou HH:MM:SS). */
export function dakarAt(date: string, hhmm: string): Date {
    assert.match(date, DATE_RE, `dakarAt : date invalide « ${date} » (AAAA-MM-JJ attendu)`);
    assert.match(hhmm, TIME_RE, `dakarAt : heure invalide « ${hhmm} » (HH:MM attendu)`);
    const time = hhmm.length === 5 ? `${hhmm}:00` : hhmm;
    const d = new Date(`${date}T${time}.000Z`);
    assert.ok(!Number.isNaN(d.getTime()), `dakarAt : instant invalide ${date} ${hhmm}`);
    return d;
}

/** Jour de Dakar (AAAA-MM-JJ) décalé de `offsetDays` jours depuis `from` (défaut : maintenant). */
export function dakarDay(offsetDays = 0, from: Date = new Date()): string {
    const d = new Date(from.getTime());
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().slice(0, 10);
}

/** Midi à Dakar le lendemain : heure hors plage de silence par défaut (22 h - 8 h), toujours dans le futur. */
export function noonDakarTomorrow(): Date {
    return dakarAt(dakarDay(1), '12:00');
}

export function addMinutes(d: Date, minutes: number): Date {
    return new Date(d.getTime() + minutes * 60_000);
}

/** Tolérance d'horloge des aides : un `now` plus ancien que l'heure réelle moins 30 s est refusé. */
export const PAST_CLOCK_TOLERANCE_MS = 30_000;

function assertNotPast(now: Date, what: string): void {
    assert.ok(now instanceof Date && !Number.isNaN(now.getTime()), `${what} : horloge invalide`);
    assert.ok(now.getTime() >= Date.now() - PAST_CLOCK_TOLERANCE_MS,
        `${what} : horloge dans le passé refusée (${now.toISOString()} < maintenant - 30 s) — risque de double envoi entre suites (contrat, Conventions)`);
}

// ── Événement à date exacte ────────────────────────────────────────────────

export interface ReminderEventOptions {
    /** Jour du début à Dakar (AAAA-MM-JJ). */
    startDate: string;
    /** Heure du début à Dakar (HH:MM ou HH:MM:SS). */
    startTime: string;
    /** Défaut : une catégorie « Standard » à 5 000 F CFA, 50 places. */
    categories?: CategorySpec[];
    /** Durée en heures (défaut : 3) ; null : événement sans fin (lot 9 bis, R16 : fin = début + 6 h ; avant : début à 23:59). */
    durationHours?: number | null;
    title?: string;
    location?: string;
    city?: string;
}

export interface ReminderEvent extends DraftEvent {
    /** Début de l'événement (instant), égal à event_start_at(event_id). */
    startAt: Date;
    startDate: string;
    startTime: string;
    endDate: string | null;
    endTime: string | null;
}

export const DEFAULT_REMINDER_CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 5_000, total: 50 }];

/**
 * Événement PUBLIE du propriétaire, à la date exacte demandée (début futur exigé) : brouillon
 * (createDraftEvent), dates posées par UPDATE des seules colonnes de date, puis advanceEventTo(PUBLIE)
 * par les RPC du lot 5.
 */
export async function createReminderEvent(owner: EventOwner, label: string, opts: ReminderEventOptions): Promise<ReminderEvent> {
    const startAt = dakarAt(opts.startDate, opts.startTime);
    assert.ok(startAt.getTime() > Date.now() + 60_000, `createReminderEvent ${label} : début ${startAt.toISOString()} passé ou imminent`);
    const startTime = opts.startTime.length === 5 ? `${opts.startTime}:00` : opts.startTime;
    const duration = opts.durationHours === undefined ? 3 : opts.durationHours;
    let endDate: string | null = null;
    let endTime: string | null = null;
    if (duration !== null) {
        assert.ok(duration > 0, `createReminderEvent ${label} : durée ${duration} h invalide`);
        const end = new Date(startAt.getTime() + duration * 3600_000).toISOString();
        endDate = end.slice(0, 10);
        endTime = end.slice(11, 19);
    }
    const draft = await createDraftEvent(owner, label, opts.categories ?? DEFAULT_REMINDER_CATEGORIES, {
        startsInHours: Math.max(1, Math.round((startAt.getTime() - Date.now()) / 3600_000)),
        durationHours: duration,
        title: opts.title ?? `TEST Rappels ${label} ${Date.now()}`,
        location: opts.location,
        city: opts.city,
    });
    const { data, error } = await service.from('events')
        .update({ start_date: opts.startDate, start_time: startTime, end_date: endDate, end_time: endTime })
        .eq('id', draft.eventId).select('id');
    assert.equal(error, null, `createReminderEvent ${label} : dates exactes : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `createReminderEvent ${label} : événement ${draft.eventId} introuvable`);
    await advanceEventTo(draft.eventId, 'PUBLIE', { partnerUserId: owner.userId });
    return { ...draft, startAt, startDate: opts.startDate, startTime, endDate, endTime };
}

// ── Planification et envoi (dans le processus du test) ─────────────────────

const REMINDERS_MODULE = '../../lib/notifications/reminders';
const DISPATCHER_MODULE = '../../lib/notifications/dispatcher';

/** Rapport de scheduleReminders (contrat I3). */
export interface ScheduleReport {
    created: Record<string, number>;
    events: number;
}

/** scheduleReminders({ now, onlyEventIds }) — `now` jamais dans le passé. */
export async function scheduleAt(now: Date, eventIds?: string[]): Promise<ScheduleReport> {
    assertNotPast(now, 'scheduleAt');
    const schedule = await lotFunction<(o: Record<string, unknown>) => Promise<ScheduleReport>>(
        REMINDERS_MODULE, 'scheduleReminders', 'planificateur des rappels (contrat I3)');
    const opts: Record<string, unknown> = { now };
    if (eventIds) opts.onlyEventIds = eventIds;
    const report = await schedule(opts);
    assert.ok(report && typeof report === 'object', `scheduleReminders : rapport absent (${JSON.stringify(report)})`);
    return report;
}

export interface DispatchFilter {
    /** onlyEventIds : exclut les lignes sans event_id (section Y). */
    eventIds?: string[];
    /** onlyIds : ids lus par outboxRows (alertes admin, journaux OTP). */
    ids?: string[];
    limit?: number;
    rounds?: number;
}

/** dispatchNotifications({ now, onlyEventIds, onlyIds, limit, rounds }) — `now` jamais dans le passé. */
export async function dispatchAt(now: Date, opts: DispatchFilter = {}): Promise<DispatchRunReport> {
    assertNotPast(now, 'dispatchAt');
    const dispatch = await lotFunction<(o: Record<string, unknown>) => Promise<DispatchRunReport>>(
        DISPATCHER_MODULE, 'dispatchNotifications', 'envoyeur (contrat E4)');
    const args: Record<string, unknown> = { now };
    if (opts.eventIds) args.onlyEventIds = opts.eventIds;
    if (opts.ids) args.onlyIds = opts.ids;
    if (opts.limit !== undefined) args.limit = opts.limit;
    if (opts.rounds !== undefined) args.rounds = opts.rounds;
    const report = await dispatch(args);
    assert.ok(report && typeof report === 'object', `dispatchNotifications : rapport absent (${JSON.stringify(report)})`);
    return report;
}

/** Passage de l'envoyeur à l'heure réelle : dispatchAt(new Date(), opts). */
export async function flushNotifications(opts: DispatchFilter = {}): Promise<DispatchRunReport> {
    return dispatchAt(new Date(), opts);
}

// ── Boîte d'envoi ──────────────────────────────────────────────────────────

export type OutboxChannel = 'IN_APP' | 'SMS' | 'EMAIL' | 'PUSH';
export type OutboxStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED' | 'CANCELLED' | 'UNCERTAIN';

/** Ligne de public.notification_outbox (contrat C2). */
export interface OutboxRow {
    id: string;
    idempotency_key: string;
    group_key: string;
    type: string;
    family: 'ESSENTIAL' | 'OPTIONAL';
    topic: string | null;
    channel: OutboxChannel;
    origin: 'OUTBOX' | 'SYNC_LOG';
    recipient_user_id: string | null;
    recipient_phone: string | null;
    recipient_email: string | null;
    event_id: string | null;
    actor_id: string | null;
    shift_id: string | null;
    template_data: Record<string, unknown>;
    status: OutboxStatus;
    reason: string | null;
    reason_detail: string | null;
    attempts: number;
    max_attempts: number;
    due_at: string;
    next_attempt_at: string;
    claimed_at: string | null;
    claim_token: string | null;
    sent_at: string | null;
    finished_at: string | null;
    provider_message_id: string | null;
    notification_id: string | null;
    decision: Record<string, unknown> | null;
    manual_retries: number;
    created_at: string;
    updated_at: string;
}

export interface OutboxFilter {
    type?: string | string[];
    eventId?: string;
    /** recipient_user_id */
    userId?: string;
    /** recipient_phone (forme +221XXXXXXXXX) */
    phone?: string;
    channel?: OutboxChannel;
    status?: OutboxStatus | OutboxStatus[];
    /** Préfixe de idempotency_key (ex. `REMINDER_J1:<event_id>:<user_id>:`). */
    keyPrefix?: string;
    ids?: string[];
}

/**
 * Lignes de la boîte d'envoi qui satisfont TOUS les filtres, triées par created_at puis id. Au moins un
 * filtre est exigé (jamais de lecture globale : la base est partagée par toutes les suites).
 */
export async function outboxRows(filter: OutboxFilter): Promise<OutboxRow[]> {
    const keys = Object.entries(filter).filter(([, v]) => v !== undefined).map(([k]) => k);
    assert.ok(keys.length > 0, 'outboxRows : au moins un filtre est exigé (type, eventId, userId, phone, channel, status, keyPrefix, ids)');
    let q = service.from('notification_outbox').select('*');
    if (filter.type !== undefined) q = Array.isArray(filter.type) ? q.in('type', filter.type) : q.eq('type', filter.type);
    if (filter.eventId !== undefined) q = q.eq('event_id', filter.eventId);
    if (filter.userId !== undefined) q = q.eq('recipient_user_id', filter.userId);
    if (filter.phone !== undefined) q = q.eq('recipient_phone', filter.phone);
    if (filter.channel !== undefined) q = q.eq('channel', filter.channel);
    if (filter.status !== undefined) q = Array.isArray(filter.status) ? q.in('status', filter.status) : q.eq('status', filter.status);
    if (filter.ids !== undefined) q = q.in('id', filter.ids.length > 0 ? filter.ids : [randomUUID()]);
    // LIKE puis startsWith : `_` et `%` des clés ne doivent pas élargir le filtre.
    if (filter.keyPrefix !== undefined) q = q.like('idempotency_key', `${filter.keyPrefix}%`);
    const { data, error } = await q.order('created_at', { ascending: true }).order('id', { ascending: true });
    assert.equal(error, null, `lecture de notification_outbox (${JSON.stringify(filter)}) : ${error?.message} (code ${error?.code}) — table du contrat C2, migration 20261103000002`);
    const rows = (data ?? []) as OutboxRow[];
    return filter.keyPrefix === undefined ? rows : rows.filter((r) => r.idempotency_key.startsWith(filter.keyPrefix!));
}

/** Champs acceptés par insertOutboxRow (colonnes de C2) ; les absents prennent les défauts documentés. */
export type OutboxInsert = Partial<Omit<OutboxRow, 'id' | 'created_at' | 'updated_at'>> & Record<string, unknown>;

/**
 * Ligne écrite directement par le service_role (tests de la page admin). Défauts : type
 * PURCHASE_CONFIRMED, famille ESSENTIAL, canal SMS, numéro neuf si aucun destinataire n'est donné,
 * statut PENDING, `due_at` et `next_attempt_at` dans 30 jours (jamais réservée par l'envoyeur pendant la
 * CI), clé `TEST:<uuid>:<canal>`. SENT et UNCERTAIN reçoivent `sent_at` et `finished_at` = maintenant,
 * les autres statuts terminaux `finished_at` ; le motif (`reason`) reste à fournir quand C2 l'exige.
 * La ligne doit respecter (m)(n)(o) (vérifiés en fin de suite) ou être supprimée par deleteOutboxRows.
 */
export async function insertOutboxRow(row: OutboxInsert = {}): Promise<OutboxRow> {
    const nowIso = new Date().toISOString();
    const later = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
    const channel = (row.channel ?? 'SMS') as OutboxChannel;
    const groupKey = row.group_key ?? `TEST:${randomUUID()}`;
    const status = (row.status ?? 'PENDING') as OutboxStatus;
    const hasRecipient = row.recipient_user_id != null || row.recipient_phone != null || row.recipient_email != null;
    const values: Record<string, unknown> = {
        type: 'PURCHASE_CONFIRMED',
        family: 'ESSENTIAL',
        origin: 'OUTBOX',
        template_data: {},
        attempts: 0,
        max_attempts: 5,
        due_at: later,
        next_attempt_at: later,
        ...(hasRecipient || channel === 'IN_APP' || channel === 'PUSH' ? {} : { recipient_phone: randomSenegalPhone('76') }),
        ...(status === 'SENT' || status === 'UNCERTAIN' ? { sent_at: nowIso, finished_at: nowIso } : {}),
        ...(['FAILED', 'SKIPPED', 'CANCELLED'].includes(status) ? { finished_at: nowIso } : {}),
        ...row,
        channel,
        status,
        group_key: groupKey,
        idempotency_key: row.idempotency_key ?? `${groupKey}:${channel}`,
    };
    const { data, error } = await service.from('notification_outbox').insert(values).select('*').single();
    assert.equal(error, null, `insertOutboxRow ${JSON.stringify(values)} : ${error?.message} (code ${error?.code})`);
    return data as OutboxRow;
}

/** Supprime des lignes écrites par insertOutboxRow (service_role) ; exige que toutes existent. */
export async function deleteOutboxRows(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { data, error } = await service.from('notification_outbox').delete().in('id', ids).select('id');
    assert.equal(error, null, `suppression de lignes de notification_outbox : ${error?.message}`);
    assert.equal((data ?? []).length, ids.length, `suppression de lignes de notification_outbox : ${(data ?? []).length} / ${ids.length}`);
}

// ── Faux adaptateurs : lecture par destinataire ────────────────────────────

/** Nombre de SMS enregistrés pour ce numéro (toutes issues) : repère à passer ensuite à smsTo. */
export function smsMark(phone: string): number {
    return getFakes().sms.messagesTo(phone).length;
}

/** SMS remis (`outcome === 'SENT'`) à ce numéro parmi ceux enregistrés après le repère `since` (smsMark). */
export function smsTo(phone: string, since = 0): RecordedSms[] {
    return getFakes().sms.messagesTo(phone).slice(since).filter((m) => m.outcome === 'SENT');
}

/** Push acceptés pour cet appareil parmi ceux enregistrés après le repère `since` (messagesTo(endpoint).length). */
export function pushTo(endpoint: string, since = 0): RecordedPush[] {
    return getFakes().push.messagesTo(endpoint).slice(since).filter((p) => p.outcome === 'ACCEPTED');
}

/** Emails remis à cette adresse parmi ceux enregistrés après le repère `since` (messagesTo(address).length). */
export function emailsTo(address: string, since = 0): RecordedEmail[] {
    return getFakes().email.messagesTo(address).slice(since).filter((m) => m.success);
}

// ── Réglages notif.* (contrat I1 du lot 6 ; lot 7, M1 et D15) ──────────────

/**
 * Clés notif.* en vigueur au lot 7 : les 8 du lot 6 encore présentes, plus notif.sms_optional_daily_cap
 * (7.0 a) et notif.free_ticket_reminder_sms (7.0 b). notif.sms_daily_alert est supprimée (D15).
 * Lot 9 bis (R31, T50, contrat 12.1) : + notif.sms_essential_daily_alert (2 000, entier de 1 à 1 000 000), clé distincte
 * de l'ancienne notif.sms_daily_alert, qui reste retirée.
 */
export type NotifSettingKey =
    | 'notif.reminder_j1_enabled'
    | 'notif.reminder_j1_hour'
    | 'notif.reminder_h3_enabled'
    | 'notif.reminder_h3_hours'
    | 'notif.j1_sms'
    | 'notif.h3_sms'
    | 'notif.sms_quiet_start'
    | 'notif.sms_quiet_end'
    | 'notif.sms_optional_daily_cap'
    | 'notif.free_ticket_reminder_sms'
    | 'notif.sms_essential_daily_alert';

/**
 * Clé supprimée au lot 7 (D15, migration 20261105000001). Acceptée par getNotifSetting, setNotifSetting et
 * withNotifSettings pour que les suites du lot 6 qui la posent encore compilent jusqu'à leur adaptation
 * (section 13, T1 à T5) ; après fix(7.0a), la base ne la connaît plus et ces aides échouent en le disant.
 */
export type RetiredNotifSettingKey = 'notif.sms_daily_alert';

/** Défauts des clés en vigueur (contrat I1 du lot 6, M1 du lot 7, 12.1 du lot 9 bis). */
export const NOTIF_SETTING_DEFAULTS: Readonly<Record<NotifSettingKey, unknown>> = {
    'notif.reminder_j1_enabled': true,
    'notif.reminder_j1_hour': 10,
    'notif.reminder_h3_enabled': true,
    'notif.reminder_h3_hours': 3,
    'notif.j1_sms': 'ALWAYS',
    'notif.h3_sms': 'IF_NO_PUSH',
    'notif.sms_quiet_start': 22,
    'notif.sms_quiet_end': 8,
    'notif.sms_optional_daily_cap': 700,
    'notif.free_ticket_reminder_sms': 'NEVER',
    'notif.sms_essential_daily_alert': 2000,
};

export async function getNotifSetting(key: NotifSettingKey | RetiredNotifSettingKey): Promise<unknown> {
    const { data, error } = await service.from('platform_settings').select('value').eq('key', key).maybeSingle();
    assert.equal(error, null, `lecture du réglage ${key} : ${error?.message}`);
    assert.ok(data, `réglage ${key} absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)`);
    return (data.value as { value?: unknown }).value;
}

export async function setNotifSetting(key: NotifSettingKey | RetiredNotifSettingKey, value: unknown, reason = 'test du lot 6'): Promise<void> {
    const { data, error } = await service.rpc('finance_setting_set', { p_key: key, p_value: { value }, p_actor: await superadminId(), p_reason: reason });
    assert.equal(error, null, `réglage ${key} : ${error?.message}`);
    assert.equal((data as { ok?: boolean } | null)?.ok, true, `réglage ${key} refusé : ${JSON.stringify(data)}`);
}

/** Applique des réglages notif.* le temps de fn (finance_setting_set, historisé), puis remet les valeurs lues avant. */
export async function withNotifSettings<T>(overrides: Partial<Record<NotifSettingKey | RetiredNotifSettingKey, unknown>>, fn: () => Promise<T>): Promise<T> {
    const keys = Object.keys(overrides) as Array<NotifSettingKey | RetiredNotifSettingKey>;
    const saved = new Map<NotifSettingKey | RetiredNotifSettingKey, unknown>();
    for (const k of keys) saved.set(k, await getNotifSetting(k));
    const applied: Array<NotifSettingKey | RetiredNotifSettingKey> = [];
    try {
        for (const k of keys) {
            await setNotifSetting(k, overrides[k]);
            applied.push(k);
        }
        return await fn();
    } finally {
        for (const k of applied) await setNotifSetting(k, saved.get(k), 'restauration après un test du lot 6');
    }
}

// ── Variables d'environnement ──────────────────────────────────────────────

const PUSH_CONFIG_MODULE = '../../lib/push/config';

/**
 * Vide les caches de configuration : lib/env (resetServerEnvCache) et, s'il existe et l'exporte,
 * resetPushConfigCache() de lib/push/config.ts. Module absent : rien à vider.
 */
export async function resetConfigCaches(): Promise<void> {
    resetServerEnvCache();
    let mod: Record<string, unknown> | null = null;
    try {
        const spec = PUSH_CONFIG_MODULE;
        mod = (await import(spec)) as Record<string, unknown>;
    } catch (err) {
        if (!isModuleNotFound(err, PUSH_CONFIG_MODULE)) throw err;
        mod = null; // lib/push/config.ts pas encore écrit (avant le correctif 6.2) : aucun cache à vider
    }
    if (mod && typeof mod.resetPushConfigCache === 'function') (mod.resetPushConfigCache as () => void)();
}

/** Pose des variables (`undefined` : variable retirée) le temps de fn, caches de configuration vidés avant et après. */
export async function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
    const saved = new Map<string, string | undefined>();
    for (const [k, v] of Object.entries(overrides)) {
        saved.set(k, process.env[k]);
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    await resetConfigCaches();
    try {
        return await fn();
    } finally {
        saved.forEach((v, k) => {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        });
        await resetConfigCaches();
    }
}

// ── Push web : clés VAPID et abonnement de navigateur ──────────────────────

export interface VapidKeys {
    /** Point P-256 non compressé (65 octets), base64url sans « = ». */
    publicKey: string;
    /** Scalaire privé (32 octets), base64url sans « = ». */
    privateKey: string;
    subject: string;
    /** base64url(sha256(clé publique brute)).slice(0, 16) (contrat F4, `vapid_key_id`). */
    keyId: string;
}

export const TEST_VAPID_SUBJECT = 'mailto:notifications@test.eventvillage.local';

function pad32(b: Buffer): Buffer {
    return b.length >= 32 ? b : Buffer.concat([Buffer.alloc(32 - b.length), b]);
}

/** Identifiant de clé VAPID du contrat F4 pour une clé publique base64url. */
export function vapidKeyId(publicKey: string): string {
    return crypto.createHash('sha256').update(Buffer.from(publicKey, 'base64url')).digest('base64url').slice(0, 16);
}

/** Paire VAPID neuve (P-256), générée pour le test : jamais lue d'un fichier. */
export function newVapidKeys(subject: string = TEST_VAPID_SUBJECT): VapidKeys {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    const publicKey = ecdh.getPublicKey().toString('base64url');
    const privateKey = pad32(ecdh.getPrivateKey()).toString('base64url');
    return { publicKey, privateKey, subject, keyId: vapidKeyId(publicKey) };
}

/** VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT posées le temps de fn (withEnv), puis restaurées. */
export async function withVapid<T>(fn: (keys: VapidKeys) => Promise<T>, keys: VapidKeys = newVapidKeys()): Promise<T> {
    return withEnv(
        { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: keys.subject },
        () => fn(keys),
    );
}

export interface FakeBrowserSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    /** Paire ECDH du « navigateur » (déchiffrement aes128gcm par un faux service push local). */
    ecdh: crypto.ECDH;
    /** Secret d'authentification brut (16 octets). */
    authSecret: Buffer;
    /** Corps de POST /api/push/subscriptions (`{ endpoint, keys }`). */
    json: { endpoint: string; keys: { p256dh: string; auth: string } };
}

/**
 * Abonnement de navigateur à clés P-256 réelles : p256dh = point non compressé (87 caractères base64url),
 * auth = 16 octets (22 caractères). Point d'arrivée par défaut sur un service de la liste blanche F4
 * (`https://fcm.googleapis.com/fcm/send/<id>`) ; `origin` (ex. `http://127.0.0.1:4010`) donne
 * `<origin>/push/<id>` pour un faux service local ; `endpoint` l'impose tel quel.
 */
export function fakeBrowserSubscription(opts: { endpoint?: string; origin?: string } = {}): FakeBrowserSubscription {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    const authSecret = crypto.randomBytes(16);
    const id = crypto.randomBytes(24).toString('base64url');
    const endpoint = opts.endpoint ?? (opts.origin ? `${opts.origin.replace(/\/+$/, '')}/push/${id}` : `https://fcm.googleapis.com/fcm/send/${id}`);
    const keys = { p256dh: ecdh.getPublicKey().toString('base64url'), auth: authSecret.toString('base64url') };
    assert.equal(keys.p256dh.length, 87, 'fakeBrowserSubscription : p256dh de 87 caractères attendu');
    assert.equal(keys.auth.length, 22, 'fakeBrowserSubscription : auth de 22 caractères attendu');
    return { endpoint, keys, ecdh, authSecret, json: { endpoint, keys: { ...keys } } };
}

// ── Comptes ────────────────────────────────────────────────────────────────

/** Pose users.phone_verified_at (contrat B1) : preuve de possession du numéro, comme verify-otp. */
export async function markPhoneVerified(userId: string, at: Date = new Date()): Promise<void> {
    const { data, error } = await service.from('users').update({ phone_verified_at: at.toISOString() }).eq('id', userId).select('id');
    assert.equal(error, null, `markPhoneVerified ${userId} : ${error?.message} (code ${error?.code}) — colonne users.phone_verified_at du contrat B1, migration 20261103000002`);
    assert.equal((data ?? []).length, 1, `markPhoneVerified : compte ${userId} introuvable`);
}

/**
 * Lot 9 bis (G.49, B96, T53) : pose users.email_verified_at (colonne de M10) ; un message n'est envoyé par email qu'à
 * une adresse vérifiée. Échoue en nommant la colonne si elle manque.
 */
export async function markEmailVerified(userId: string, at: Date = new Date()): Promise<void> {
    const { data, error } = await service.from('users').update({ email_verified_at: at.toISOString() }).eq('id', userId).select('id');
    assert.equal(error, null, `markEmailVerified ${userId} : ${error?.message} (code ${error?.code}) — colonne users.email_verified_at, migration M10 du lot 9 bis`);
    assert.equal((data ?? []).length, 1, `markEmailVerified : compte ${userId} introuvable`);
}

export interface TestAdmin extends Buyer {
    role: 'ADMIN' | 'SUPERADMIN';
    permissions: string[];
}

/**
 * Compte ACTIF neuf (newBuyer) avec le rôle ADMIN (défaut) ou SUPERADMIN dans user_roles et les
 * permissions données dans admin_permissions (ex. ['notifications.read']). users.role n'est pas écrit.
 */
export async function newAdmin(label: string, permissions: string[] = [], opts: { role?: 'ADMIN' | 'SUPERADMIN' } = {}): Promise<TestAdmin> {
    const role = opts.role ?? 'ADMIN';
    const user = await newBuyer(`adm-${label}`, { firstName: 'Ndeye', lastName: 'Administratrice' });
    const { error } = await service.from('user_roles').upsert([{ user_id: user.userId, role }], { onConflict: 'user_id,role' });
    assert.equal(error, null, `rôle ${role} : ${error?.message}`);
    for (const permission of permissions) {
        const { error: pErr } = await service.from('admin_permissions').upsert({ user_id: user.userId, permission }, { onConflict: 'user_id,permission' });
        assert.equal(pErr, null, `permission ${permission} : ${pErr?.message}`);
    }
    return { ...user, role, permissions: [...permissions] };
}
