/**
 * Lot 6, tâche 6.1 (contrat E4) — l'envoyeur unique de la boîte d'envoi.
 *
 * Boucle : réservation d'un lot (RPC notification_outbox_claim, FOR UPDATE SKIP LOCKED, revérification et
 * instantané de décision en base) → rendu par le catalogue (lib/notifications/catalog.ts) et envoi par les
 * adaptateurs → un seul marquage par lot (RPC notification_outbox_mark, par jeton de réservation). Au plus
 * 10 tours et 45 s ; arrêt sur un lot incomplet ; puis contrôle quotidien du volume de SMS
 * (notification_daily_checks).
 *
 * Seul module (avec les envois synchrones OTP et invitation) qui appelle les adaptateurs : contrôle statique
 * tests/parcours/notif-migration.test.ts.
 *
 * Horloge : `now` (tests, fumée) est passé tel quel à la réservation, au marquage et au contrôle du jour ;
 * une heure passée est refusée par la base (INVALID_NOW) et lève ici. Sans `now`, chaque RPC prend l'heure
 * de la base. La route de cron appelle dispatchNotifications() sans argument (aucune heure venue d'une
 * requête).
 *
 * Aucune erreur avalée : une RPC en erreur lève (la route répond 500) ; un échec d'envoi devient un statut
 * explicite (RETRY, FAILED, SKIPPED, UNCERTAIN avec motif). Un SMS dont l'issue est inconnue n'est jamais
 * renvoyé (UNCERTAIN).
 */
import { getServerEnv } from '@/lib/env';
import { EmailService } from '@/lib/email/email.service';
import { getPushAdapter } from '@/lib/integrations/registry';
import type { PushMessage, PushSendOptions, PushSendResult, PushTarget } from '@/lib/integrations/types';
import { NOTIFICATION_CATALOG, renderNotification, TemplateDataError } from '@/lib/notifications/catalog';
import { emailChannelAvailable } from '@/lib/notifications/channels';
import { smsSegments } from '@/lib/notifications/sms-format';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { getPushConfig, pushChannelAvailable } from '@/lib/push/config';
import { isAllowedPushEndpoint } from '@/lib/push/endpoints';
import { classifySmsResult, mTargetService, type MTargetSendResult } from '@/lib/sms/mtarget.service';
import { getServiceRoleClient } from '@/lib/supabase/server';

// ── Contrat public (E4) ─────────────────────────────────────────────────────

export interface DispatchOptions {
    /** Horloge simulée (tests, fumée) ; jamais dans le passé. */
    now?: Date;
    /** Lignes réservées par tour (1 à 500, défaut 100). */
    limit?: number;
    /** Tours au plus (défaut 10). */
    rounds?: number;
    /** Budget en millisecondes (défaut 45 000) : aucun nouveau tour au-delà. */
    budgetMs?: number;
    /** Restreint la réservation à ces lignes (tests). */
    onlyIds?: string[];
    /** Restreint la réservation aux lignes de ces événements (tests, fumée) ; exclut les lignes sans événement. */
    onlyEventIds?: string[];
}

export interface DispatchReport {
    claimed: number;
    sent: number;
    retried: number;
    failed: number;
    skipped: number;
    uncertain: number;
    cancelled: number;
    waiting: number;
    reclaimed: number;
    rounds: number;
    smsToday: number;
}

// ── Formes échangées avec la base (E1, E2) ──────────────────────────────────

type Channel = 'IN_APP' | 'SMS' | 'EMAIL' | 'PUSH';

interface ClaimedItem {
    id: string;
    claim_token: string;
    type: string;
    channel: Channel;
    family: 'ESSENTIAL' | 'OPTIONAL';
    topic: string | null;
    group_key: string;
    idempotency_key: string;
    attempts: number;
    max_attempts?: number;
    due_at?: string;
    recipient: { user_id: string | null; phone: string | null; email: string | null; first_name: string | null };
    event: { id: string; title: string | null; start_at: string | null; location: string | null; city: string | null } | null;
    actor_id: string | null;
    shift_id: string | null;
    template_data: Record<string, unknown> | null;
}

interface ClaimReply {
    ok?: boolean;
    code?: string;
    message?: string;
    claimed?: ClaimedItem[];
    examined?: number;
    skipped?: number;
    cancelled?: number;
    reclaimed?: number;
    uncertain?: number;
    waiting?: number;
    failed?: number;
}

type MarkOutcome = 'SENT' | 'RETRY' | 'FAILED' | 'SKIPPED' | 'UNCERTAIN';

interface MarkResult {
    id: string;
    claim_token: string;
    outcome: MarkOutcome;
    reason?: string;
    detail?: string;
    provider_message_id?: string;
    retry_after_seconds?: number;
    in_app?: { type: string; title: string; content: string; metadata: Record<string, unknown> };
    delivery?: Record<string, unknown>;
}

interface MarkReply { ok?: boolean; code?: string; message?: string; marked?: number; stale?: number; failed_ids?: string[] }

interface DailyReply { ok?: boolean; code?: string; message?: string; sms_today?: number; threshold?: number | null }

// ── Catalogue (contrat G1) : vue structurelle des modèles ──────────────────

interface RenderCtx { appUrl: string }

interface TemplateView {
    inAppType: string;
    link(d: unknown): string;
    inApp?(d: unknown): { title: string; content: string };
    sms?(d: unknown, ctx: RenderCtx): string;
    push?(d: unknown): { title: string; body: string };
    email?(d: unknown, ctx: RenderCtx): { subject: string; html: string; text: string };
}

type RenderType = Parameters<typeof renderNotification>[0];
type RenderChannel = Parameters<typeof renderNotification>[1];

function templateOf(type: string): TemplateView | undefined {
    return (NOTIFICATION_CATALOG as unknown as Record<string, TemplateView | undefined>)[type];
}

/** Erreur de rendu (variable manquante, canal non prévu, lien non interne) : ligne FAILED TEMPLATE_ERROR. */
class RenderFailure extends Error {}

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;
const DEFAULT_ROUNDS = 10;
const DEFAULT_BUDGET_MS = 45_000;
const CONCURRENCY = 5;
const PUSH_BODY_MAX = 160;
const PUSH_PAYLOAD_MAX_BYTES = 2048;
const DAY_SECONDS = 86_400;
const HIGH_URGENCY_TYPES = ['REMINDER_H3', 'EVENT_CANCELLED', 'PUSH_TEST'];
const FAKE_EMAIL = /^[0-9]+@eventvillage\.sn$/i;

const MISSING_SETTING_WARNED = Symbol.for('event-village.notif-sms-daily-alert-missing-warned');
type ProcessFlags = typeof globalThis & { [MISSING_SETTING_WARNED]?: boolean };

function renderContext(): RenderCtx {
    return { appUrl: getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, '') };
}

function errorText(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function clip(text: string | undefined | null, max = 500): string | undefined {
    if (!text) return undefined;
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

/**
 * Données du rendu : template_data, complété (sans rien écraser) par les champs de l'événement relus à la
 * réservation. Les métadonnées in-app gardent template_data tel quel.
 */
function renderData(item: ClaimedItem): Record<string, unknown> {
    const data: Record<string, unknown> = { ...(item.template_data ?? {}) };
    const ev = item.event;
    if (ev) {
        const fill: Record<string, unknown> = { event_id: ev.id, title: ev.title, start_at: ev.start_at, location: ev.location, city: ev.city };
        for (const [k, v] of Object.entries(fill)) {
            if (data[k] === undefined && v !== null && v !== undefined) data[k] = v;
        }
    }
    return data;
}

/** Valide les variables (TemplateDataError) puis renvoie le modèle du type. */
function prepare(item: ClaimedItem, data: Record<string, unknown>, ctx: RenderCtx): TemplateView {
    const tpl = templateOf(item.type);
    if (!tpl) throw new RenderFailure(`Type absent du catalogue : ${item.type}.`);
    renderNotification(item.type as RenderType, item.channel as RenderChannel, data, ctx);
    return tpl;
}

function internalLink(tpl: TemplateView, data: Record<string, unknown>): string {
    const link = tpl.link(data);
    if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//')) {
        throw new RenderFailure('Lien du modèle hors de l’application.');
    }
    return link;
}

function templateFailure(item: ClaimedItem, err: unknown): MarkResult {
    if (err instanceof TemplateDataError) {
        const variable = (err as { variable?: unknown }).variable;
        return failed(item, 'TEMPLATE_ERROR', `Variable manquante : ${typeof variable === 'string' && variable ? variable : errorText(err)}`);
    }
    if (err instanceof RenderFailure) return failed(item, 'TEMPLATE_ERROR', err.message);
    console.error(`[notifications] rendu impossible (${item.type}, ${item.channel}, ligne ${item.id}) :`, errorText(err));
    return failed(item, 'TEMPLATE_ERROR', `Rendu impossible : ${errorText(err)}`);
}

function base(item: ClaimedItem): Pick<MarkResult, 'id' | 'claim_token'> {
    return { id: item.id, claim_token: item.claim_token };
}

function failed(item: ClaimedItem, reason: string, detail?: string, delivery?: Record<string, unknown>): MarkResult {
    return { ...base(item), outcome: 'FAILED', reason, detail: clip(detail), delivery };
}

function skipped(item: ClaimedItem, reason: string, detail?: string, delivery?: Record<string, unknown>): MarkResult {
    return { ...base(item), outcome: 'SKIPPED', reason, detail: clip(detail), delivery };
}

function retry(item: ClaimedItem, reason: string, detail?: string, retryAfterSeconds?: number, delivery?: Record<string, unknown>): MarkResult {
    const r: MarkResult = { ...base(item), outcome: 'RETRY', reason, detail: clip(detail), delivery };
    if (retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) r.retry_after_seconds = Math.ceil(retryAfterSeconds);
    return r;
}

// ── Canaux ─────────────────────────────────────────────────────────────────

function deliverInApp(item: ClaimedItem, data: Record<string, unknown>, ctx: RenderCtx): MarkResult {
    let tpl: TemplateView;
    let rendered: { title: string; content: string };
    let link: string;
    try {
        tpl = prepare(item, data, ctx);
        if (!tpl.inApp) throw new RenderFailure(`Le modèle ${item.type} n’a pas de texte pour l’application.`);
        rendered = tpl.inApp(data);
        link = internalLink(tpl, data);
    } catch (err) {
        return templateFailure(item, err);
    }
    return {
        ...base(item),
        outcome: 'SENT',
        in_app: {
            type: tpl.inAppType,
            title: rendered.title,
            content: rendered.content,
            metadata: { ...(item.template_data ?? {}), actionUrl: link, outbox_id: item.id },
        },
    };
}

async function deliverSms(item: ClaimedItem, data: Record<string, unknown>, ctx: RenderCtx): Promise<MarkResult> {
    const phone = item.recipient.phone;
    if (!phone) return skipped(item, 'NO_PHONE');
    let text: string;
    try {
        const tpl = prepare(item, data, ctx);
        if (!tpl.sms) throw new RenderFailure(`Le modèle ${item.type} n’a pas de texte SMS.`);
        text = tpl.sms(data, ctx);
    } catch (err) {
        return templateFailure(item, err);
    }
    const isReceipt = item.type === 'COUNTER_RECEIPT';
    if (isReceipt && !item.shift_id) return failed(item, 'TEMPLATE_ERROR', 'Reçu du guichet sans caisse : quota par caisse impossible.');
    const seg = smsSegments(text);

    let res: MTargetSendResult;
    try {
        res = await mTargetService.sendSms(phone, text, {
            category: isReceipt ? 'COUNTER_RECEIPT' : 'TRANSACTIONAL',
            actorId: item.actor_id ?? undefined,
            shiftId: item.shift_id ?? undefined,
        });
    } catch (err) {
        // L'issue d'un envoi interrompu par une exception est inconnue : jamais de second envoi.
        console.error(`[notifications] SMS ${item.type} (ligne ${item.id}) : exception pendant l’envoi :`, errorText(err));
        return {
            ...base(item), outcome: 'UNCERTAIN', reason: 'PROVIDER_UNREADABLE', detail: clip(`Exception pendant l’envoi : ${errorText(err)}`),
            delivery: { outcome: 'UNCERTAIN', code: null, segments: seg.segments, encoding: seg.encoding },
        };
    }
    const delivery: Record<string, unknown> = {
        outcome: res.outcome ?? (res.success ? 'SENT' : 'REJECTED'),
        code: res.code ?? res.providerCode ?? null,
        segments: seg.segments,
        encoding: seg.encoding,
    };
    const c = classifySmsResult(res);
    switch (c.kind) {
        case 'SENT':
            return { ...base(item), outcome: 'SENT', provider_message_id: res.messageId, delivery };
        case 'GUARD_REFUSED':
            return skipped(item, isReceipt && c.reason === 'SMS_RECIPIENT_CAP' ? 'COUNTER_RECEIPT_CAP' : c.reason ?? 'SMS_RECIPIENT_CAP', c.detail, delivery);
        case 'GUARD_UNAVAILABLE':
            return retry(item, 'SMS_GUARD_UNAVAILABLE', c.detail, res.retryAfterSeconds, delivery);
        case 'RETRYABLE':
            return retry(item, 'SMS_PROVIDER_ERROR', c.detail, res.retryAfterSeconds, delivery);
        case 'UNCERTAIN':
            return { ...base(item), outcome: 'UNCERTAIN', reason: c.reason ?? 'PROVIDER_TIMEOUT', detail: clip(c.detail), provider_message_id: res.messageId, delivery };
        default:
            return failed(item, 'SMS_REJECTED', c.detail, delivery);
    }
}

async function deliverEmail(item: ClaimedItem, data: Record<string, unknown>, ctx: RenderCtx): Promise<MarkResult> {
    // Canal facultatif : sans RESEND_API_KEY, aucun appel (un seul avertissement par processus, channels.ts).
    if (!emailChannelAvailable()) return skipped(item, 'EMAIL_NOT_CONFIGURED');
    const to = item.recipient.email;
    if (!to || to.indexOf('@') <= 0 || FAKE_EMAIL.test(to)) return skipped(item, 'NO_REAL_EMAIL');
    let mail: { subject: string; html: string; text: string };
    try {
        const tpl = prepare(item, data, ctx);
        if (!tpl.email) throw new RenderFailure(`Le modèle ${item.type} n’a pas de version email.`);
        mail = tpl.email(data, ctx);
    } catch (err) {
        return templateFailure(item, err);
    }
    const headers: Record<string, string> = {};
    if (item.family === 'OPTIONAL' && item.topic) {
        headers['List-Unsubscribe'] = `<${ctx.appUrl}/profile/notifications?topic=${encodeURIComponent(item.topic)}>`;
    }
    type SendPayload = Parameters<typeof EmailService.send>[0] & { text?: string; headers?: Record<string, string>; idempotencyKey?: string };
    const payload: SendPayload = {
        to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        idempotencyKey: item.idempotency_key,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
    };
    let res: { sent: boolean; id?: string; error?: string; retryable?: boolean };
    try {
        res = await EmailService.send(payload);
    } catch (err) {
        // Clé d'idempotence transmise au fournisseur : un nouvel essai ne double pas l'email.
        console.error(`[notifications] email ${item.type} (ligne ${item.id}) : exception pendant l’envoi :`, errorText(err));
        return retry(item, 'EMAIL_PROVIDER_ERROR', `Exception pendant l’envoi : ${errorText(err)}`);
    }
    if (res.sent) return { ...base(item), outcome: 'SENT', provider_message_id: res.id, delivery: { id: res.id ?? null } };
    if (res.error === 'EMAIL_CHANNEL_DISABLED') return skipped(item, 'EMAIL_NOT_CONFIGURED');
    if (res.retryable === true) return retry(item, 'EMAIL_PROVIDER_ERROR', res.error);
    return failed(item, 'EMAIL_REJECTED', res.error);
}

interface SubscriptionRow { id: string; endpoint: string; p256dh: string; auth: string; vapid_key_id: string; failure_count: number | null }

function pushTtlSeconds(item: ClaimedItem, data: Record<string, unknown>, nowMs: number): number {
    if (item.type !== 'REMINDER_H3') return DAY_SECONDS;
    const startRaw = item.event?.start_at ?? (typeof data.start_at === 'string' ? data.start_at : null);
    const start = startRaw ? Date.parse(startRaw) : NaN;
    if (!Number.isFinite(start)) return DAY_SECONDS;
    return Math.max(60, Math.floor((start - nowMs) / 1000));
}

function truncate(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text;
}

async function deliverPush(item: ClaimedItem, data: Record<string, unknown>, ctx: RenderCtx, now: Date): Promise<MarkResult> {
    const userId = item.recipient.user_id;
    if (!userId) return skipped(item, 'NO_PUSH_SUBSCRIPTION');
    // Canal facultatif : sans VAPID, aucun appel (un seul avertissement par processus, lib/push/config.ts).
    if (!pushChannelAvailable()) return skipped(item, 'PUSH_NOT_CONFIGURED');
    const config = getPushConfig();
    if (!config.enabled) return skipped(item, 'PUSH_NOT_CONFIGURED');

    let message: PushMessage;
    try {
        const tpl = prepare(item, data, ctx);
        const rendered = tpl.push ? tpl.push(data) : tpl.inApp ? (() => { const r = tpl.inApp!(data); return { title: r.title, body: r.content }; })() : null;
        if (!rendered) throw new RenderFailure(`Le modèle ${item.type} n’a pas de texte push.`);
        message = { title: rendered.title, body: truncate(rendered.body, PUSH_BODY_MAX), url: internalLink(tpl, data), tag: item.group_key };
    } catch (err) {
        return templateFailure(item, err);
    }
    if (Buffer.byteLength(JSON.stringify(message), 'utf8') > PUSH_PAYLOAD_MAX_BYTES) {
        return failed(item, 'PUSH_PAYLOAD_TOO_LARGE', 'Charge de la notification au-delà de 2 Ko.');
    }

    const supabase = getServiceRoleClient();
    const { data: subs, error } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth, vapid_key_id, failure_count')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
    if (error) {
        console.error(`[notifications] push (ligne ${item.id}) : lecture des appareils impossible :`, error.message);
        return retry(item, 'PUSH_PROVIDER_ERROR', `Lecture des appareils impossible : ${error.message}`);
    }
    const rows = (subs ?? []) as SubscriptionRow[];
    const stale = rows.filter((s) => s.vapid_key_id !== config.keyId);
    if (stale.length > 0) {
        // Abonnements d'une ancienne clé VAPID : inutilisables, supprimés (réabonnement à la prochaine ouverture).
        const { error: delErr } = await supabase.from('push_subscriptions').delete().in('id', stale.map((s) => s.id));
        if (delErr) console.error(`[notifications] push : suppression des abonnements d’une ancienne clé impossible :`, delErr.message);
    }
    const current = rows.filter((s) => s.vapid_key_id === config.keyId);
    if (current.length === 0) return skipped(item, 'NO_PUSH_SUBSCRIPTION');

    const options: PushSendOptions = {
        ttlSeconds: pushTtlSeconds(item, data, now.getTime()),
        urgency: HIGH_URGENCY_TYPES.includes(item.type) ? 'high' : 'normal',
    };
    const adapter = getPushAdapter();
    const nowIso = now.toISOString();
    const devices: Array<{ subscription_id: string; status: string; status_code: number | null }> = [];
    let accepted = 0;
    let retryable = 0;
    let gone = 0;
    let tooLarge = 0;
    let rejected = 0;
    let retryAfter: number | undefined;

    for (const sub of current) {
        if (!isAllowedPushEndpoint(sub.endpoint)) {
            // Anti-SSRF : un point d'arrivée hors liste blanche n'est jamais appelé.
            devices.push({ subscription_id: sub.id, status: 'ENDPOINT_REFUSED', status_code: null });
            continue;
        }
        const target: PushTarget = { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth };
        let res: PushSendResult;
        try {
            res = await adapter.send(target, message, options);
        } catch (err) {
            console.error(`[notifications] push (ligne ${item.id}, appareil ${sub.id}) : exception pendant l’envoi :`, errorText(err));
            res = { outcome: 'RETRY', statusCode: null, error: errorText(err) };
        }
        devices.push({ subscription_id: sub.id, status: res.outcome, status_code: res.statusCode });
        if (res.outcome === 'ACCEPTED') {
            accepted++;
            const { error: upErr } = await supabase.from('push_subscriptions')
                .update({ last_success_at: nowIso, failure_count: 0, updated_at: nowIso }).eq('id', sub.id);
            if (upErr) console.error('[notifications] push : mise à jour de l’appareil impossible :', upErr.message);
        } else if (res.outcome === 'GONE') {
            gone++;
            const { error: delErr } = await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            if (delErr) console.error('[notifications] push : suppression d’un abonnement expiré impossible :', delErr.message);
        } else {
            if (res.outcome === 'RETRY') {
                retryable++;
                if (res.retryAfterSeconds !== undefined) retryAfter = Math.max(retryAfter ?? 0, res.retryAfterSeconds);
            } else if (res.outcome === 'TOO_LARGE') {
                tooLarge++;
            } else {
                rejected++;
            }
            const { error: upErr } = await supabase.from('push_subscriptions')
                .update({ last_failure_at: nowIso, failure_count: (sub.failure_count ?? 0) + 1, updated_at: nowIso }).eq('id', sub.id);
            if (upErr) console.error('[notifications] push : mise à jour de l’appareil impossible :', upErr.message);
        }
    }

    const delivery = { devices };
    if (accepted > 0) return { ...base(item), outcome: 'SENT', delivery };
    if (retryable > 0) return retry(item, 'PUSH_PROVIDER_ERROR', 'Service push momentanément indisponible.', retryAfter, delivery);
    if (tooLarge === 0 && rejected === 0) return skipped(item, 'NO_PUSH_SUBSCRIPTION', gone > 0 ? 'Abonnements expirés supprimés.' : 'Aucun appareil autorisé.', delivery);
    if (tooLarge > 0) return failed(item, 'PUSH_PAYLOAD_TOO_LARGE', 'Charge refusée par le service push (413).', delivery);
    return failed(item, 'PUSH_REJECTED', 'Notification refusée par le service push.', delivery);
}

async function deliver(item: ClaimedItem, ctx: RenderCtx, now: Date): Promise<MarkResult> {
    const data = renderData(item);
    try {
        switch (item.channel) {
            case 'IN_APP': return deliverInApp(item, data, ctx);
            case 'SMS': return await deliverSms(item, data, ctx);
            case 'EMAIL': return await deliverEmail(item, data, ctx);
            case 'PUSH': return await deliverPush(item, data, ctx, now);
            default: return failed(item, 'TEMPLATE_ERROR', `Canal inconnu : ${String(item.channel)}.`);
        }
    } catch (err) {
        // Défaut inattendu : statut explicite, jamais d'absence silencieuse. Un SMS n'est jamais renvoyé.
        console.error(`[notifications] envoi ${item.type}/${item.channel} (ligne ${item.id}) :`, errorText(err));
        if (item.channel === 'SMS') {
            return { ...base(item), outcome: 'UNCERTAIN', reason: 'PROVIDER_UNREADABLE', detail: clip(`Exception pendant l’envoi : ${errorText(err)}`) };
        }
        const reason = item.channel === 'EMAIL' ? 'EMAIL_PROVIDER_ERROR' : item.channel === 'PUSH' ? 'PUSH_PROVIDER_ERROR' : 'TEMPLATE_ERROR';
        return item.channel === 'IN_APP' ? failed(item, reason, errorText(err)) : retry(item, reason, errorText(err));
    }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const out = new Array<R>(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i]);
        }
    });
    await Promise.all(workers);
    return out;
}

// ── Boucle de l'envoyeur ───────────────────────────────────────────────────

function emptyReport(): DispatchReport {
    return { claimed: 0, sent: 0, retried: 0, failed: 0, skipped: 0, uncertain: 0, cancelled: 0, waiting: 0, reclaimed: 0, rounds: 0, smsToday: 0 };
}

function rpcFailure(fn: string, detail: string): Error {
    return new Error(`[notifications] ${fn} : ${detail}`);
}

export async function dispatchNotifications(opts: DispatchOptions = {}): Promise<DispatchReport> {
    const limit = Math.min(Math.max(Math.trunc(opts.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
    const maxRounds = Math.max(Math.trunc(opts.rounds ?? DEFAULT_ROUNDS), 1);
    const budgetMs = opts.budgetMs ?? DEFAULT_BUDGET_MS;
    const started = Date.now();
    const report = emptyReport();
    const ctx = renderContext();
    const supabase = getServiceRoleClient();
    const nowIso = opts.now ? opts.now.toISOString() : undefined;

    for (let round = 1; round <= maxRounds; round++) {
        const claimArgs: Record<string, unknown> = { limit };
        if (nowIso) claimArgs.now = nowIso;
        if (opts.onlyIds) claimArgs.only_ids = opts.onlyIds;
        if (opts.onlyEventIds) claimArgs.only_event_ids = opts.onlyEventIds;
        // Réservation sans rejeu automatique : une réservation rejouée laisserait des lignes SENDING.
        const { data: claimData, error: claimErr } = await supabase.rpc('notification_outbox_claim', { p: claimArgs });
        if (claimErr) throw rpcFailure('notification_outbox_claim', `${claimErr.code} ${claimErr.message}`);
        const claim = (claimData ?? null) as ClaimReply | null;
        if (!claim || claim.ok !== true) throw rpcFailure('notification_outbox_claim', `${claim?.code ?? 'réponse vide'} ${claim?.message ?? ''}`.trim());

        report.rounds = round;
        const items = Array.isArray(claim.claimed) ? claim.claimed : [];
        report.claimed += items.length;
        report.skipped += Number(claim.skipped ?? 0);
        report.cancelled += Number(claim.cancelled ?? 0);
        report.waiting += Number(claim.waiting ?? 0);
        report.reclaimed += Number(claim.reclaimed ?? 0);
        report.uncertain += Number(claim.uncertain ?? 0);
        report.failed += Number(claim.failed ?? 0);

        if (items.length > 0) {
            const clock = opts.now ?? new Date();
            const results = await mapPool(items, CONCURRENCY, (item) => deliver(item, ctx, clock));
            const markArgs: Record<string, unknown> = { results };
            if (nowIso) markArgs.now = nowIso;
            // Marquage rejouable sans risque : une ligne déjà marquée est ignorée (stale).
            const { data: markData, error: markErr } = await rpcWithRetry<MarkReply>('notification_outbox_mark', { p: markArgs });
            if (markErr) throw rpcFailure('notification_outbox_mark', `${markErr.code} ${markErr.message}`);
            if (!markData || markData.ok !== true) throw rpcFailure('notification_outbox_mark', `${markData?.code ?? 'réponse vide'} ${markData?.message ?? ''}`.trim());
            const failedIds = new Set((markData.failed_ids ?? []).map(String));
            report.failed += failedIds.size;
            for (const r of results) {
                if (failedIds.has(r.id)) continue;
                if (r.outcome === 'SENT') report.sent++;
                else if (r.outcome === 'RETRY') report.retried++;
                else if (r.outcome === 'SKIPPED') report.skipped++;
                else if (r.outcome === 'UNCERTAIN') report.uncertain++;
            }
        }

        const examined = Number(claim.examined ?? items.length);
        if (examined < limit) break;
        if (Date.now() - started >= budgetMs) break;
    }

    const dailyArgs: Record<string, unknown> = {};
    if (nowIso) dailyArgs.now = nowIso;
    const { data: dailyData, error: dailyErr } = await rpcWithRetry<DailyReply>('notification_daily_checks', { p: dailyArgs });
    if (dailyErr) throw rpcFailure('notification_daily_checks', `${dailyErr.code} ${dailyErr.message}`);
    if (!dailyData || dailyData.ok !== true) throw rpcFailure('notification_daily_checks', `${dailyData?.code ?? 'réponse vide'} ${dailyData?.message ?? ''}`.trim());
    report.smsToday = Number(dailyData.sms_today ?? 0);
    if (dailyData.threshold === null || dailyData.threshold === undefined) {
        const flags = globalThis as ProcessFlags;
        if (!flags[MISSING_SETTING_WARNED]) {
            flags[MISSING_SETTING_WARNED] = true;
            console.warn('[notifications] Réglage notif.sms_daily_alert absent : aucune alerte de volume de SMS du jour.');
        }
    }
    return report;
}
