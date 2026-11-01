/**
 * Lot 5 (contrat F3) — envoi des SMS de changement d'un événement (dates, heures, lieu).
 *
 * La RPC event_update écrit, dans la transaction de la modification, la notification dans l'application et une
 * ligne event_change_notifications par porteur (SMS en attente, regroupé si un autre changement attend déjà).
 * Ce module vide la file : event_change_notifications_claim (lignes passées à SENDING, FOR UPDATE SKIP LOCKED),
 * envoi par mTargetService (garde SMS : part non OTP du plafond global, limite par numéro, sans actorId),
 * puis event_change_notifications_mark (SENT, nouvel essai, refus ou échec). Le texte reprend les informations
 * actuelles de l'événement au moment de l'envoi. Appelé par le cron /api/cron/event-change-notifications.
 */
import { rpcWithRetry } from '@/lib/payments/rpc';
import { mTargetService } from '@/lib/sms/mtarget.service';

interface ClaimedChange {
    id: string;
    event_id: string;
    user_id: string;
    phone: string | null;
    changed_fields: string[];
    attempts: number;
    title: string;
    start_date: string;
    start_time: string;
    end_date: string | null;
    end_time: string | null;
    location: string;
    city: string | null;
    address: string | null;
}

type Outcome = 'SENT' | 'RETRY' | 'REFUSED' | 'FAILED';

interface MarkResult {
    id: string;
    outcome: Outcome;
    code?: string;
    retry_after_seconds?: number;
}

export interface EventChangeRunReport {
    claimed: number;
    sent: number;
    retried: number;
    refused: number;
    failed: number;
}

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Dakar', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** « sam. 15 nov. 2026 à 20:00 » (Africa/Dakar = UTC+0). */
function dakarDateLabel(date: string, time: string): string {
    const d = new Date(`${date}T12:00:00Z`);
    return `${DATE_FORMAT.format(d)} à ${time}`;
}

/** Codes de la garde SMS qui justifient un nouvel essai plus tard (plafond, garde indisponible). */
const RETRYABLE_CODES = new Set(['SMS_DAILY_CAP_REACHED', 'SMS_GUARD_UNAVAILABLE', 'SMS_RATE_LIMITED']);

/** Texte du SMS : ce qui a changé, puis les informations actuelles de l'événement. */
export function eventChangeSmsText(c: Pick<ClaimedChange, 'changed_fields' | 'title' | 'start_date' | 'start_time' | 'location' | 'city'>): string {
    const fields = new Set(c.changed_fields);
    const dateChanged = ['start_date', 'start_time', 'end_date', 'end_time'].some((f) => fields.has(f));
    const placeChanged = ['location', 'city', 'address'].some((f) => fields.has(f));
    const what = dateChanged && placeChanged ? 'nouvelle date et nouveau lieu' : dateChanged ? 'nouvelle date' : 'nouveau lieu';
    const place = c.city ? `${c.location}, ${c.city}` : c.location;
    return `Event Village : ${what} pour « ${c.title} » : ${dakarDateLabel(c.start_date, c.start_time)}, ${place}. Vos billets restent valables.`;
}

async function sendOne(c: ClaimedChange): Promise<MarkResult> {
    if (!c.phone) return { id: c.id, outcome: 'REFUSED', code: 'NO_PHONE' };
    try {
        const sent = await mTargetService.sendSms(c.phone, eventChangeSmsText(c));
        if (sent.success) return { id: c.id, outcome: 'SENT' };
        const code = sent.code ?? 'SMS_SEND_FAILED';
        if (!sent.code || RETRYABLE_CODES.has(code)) {
            return { id: c.id, outcome: 'RETRY', code, ...(sent.retryAfterSeconds ? { retry_after_seconds: sent.retryAfterSeconds } : {}) };
        }
        return { id: c.id, outcome: 'REFUSED', code };
    } catch (err) {
        console.error(`[event-change-notifications] envoi ${c.id} en échec :`, err instanceof Error ? err.message : String(err));
        return { id: c.id, outcome: 'RETRY', code: 'SMS_SEND_ERROR' };
    }
}

/**
 * Un passage du cron : au plus `rounds` lots de `batch` lignes. Lève une erreur si la file est illisible ou si un
 * compte rendu ne peut pas être enregistré (les lignes restent en SENDING et seront reprises après 15 minutes).
 */
export async function processEventChangeNotifications(batch = 100, rounds = 5): Promise<EventChangeRunReport> {
    const report: EventChangeRunReport = { claimed: 0, sent: 0, retried: 0, refused: 0, failed: 0 };
    for (let round = 0; round < rounds; round++) {
        const { data, error } = await rpcWithRetry<{ ok?: boolean; items?: ClaimedChange[] }>('event_change_notifications_claim', { p: { limit: batch } });
        if (error || !data || data.ok !== true) {
            throw new Error(`file des changements illisible : ${error ? `${error.code} ${error.message}` : JSON.stringify(data)}`);
        }
        const items = data.items ?? [];
        if (items.length === 0) break;
        report.claimed += items.length;
        const results: MarkResult[] = [];
        for (const item of items) results.push(await sendOne(item));
        const marked = await rpcWithRetry<{ ok?: boolean }>('event_change_notifications_mark', { p: { results } });
        if (marked.error || !marked.data || marked.data.ok !== true) {
            throw new Error(`compte rendu d'envoi non enregistré : ${marked.error ? `${marked.error.code} ${marked.error.message}` : JSON.stringify(marked.data)}`);
        }
        for (const r of results) {
            if (r.outcome === 'SENT') report.sent += 1;
            else if (r.outcome === 'RETRY') report.retried += 1;
            else if (r.outcome === 'REFUSED') report.refused += 1;
            else report.failed += 1;
        }
        if (items.length < batch) break;
    }
    return report;
}
