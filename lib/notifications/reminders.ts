/**
 * Lot 6, tâche 6.5 (contrat I2, I3) — planification des rappels J-1, H-3 et du rappel du contrôleur.
 *
 * Un seul appel de la RPC notification_reminders_schedule : la base crée, à l'échéance seulement (fenêtre
 * de 15 min, sans rattrapage), une ligne de boîte d'envoi par canal et par compte, avec une clé
 * d'idempotence qui contient le début de l'événement (un second passage ne crée rien). Rien n'est envoyé
 * ici : l'envoyeur unique (lib/notifications/dispatcher.ts) s'en charge à son passage suivant.
 *
 * Horloge : `now` (tests, fumée) est transmis tel quel ; une heure passée est refusée par la base
 * (INVALID_NOW) et lève ici. La route de cron appelle scheduleReminders() sans argument.
 *
 * Aucune erreur avalée : une erreur de la RPC (dont un réglage notif.* absent, décision 25) ou un refus
 * lève ; la route répond 500.
 */
import { rpcWithRetry } from '@/lib/payments/rpc';

export type ReminderType = 'REMINDER_J1' | 'REMINDER_H3' | 'CONTROLLER_REMINDER';

export const REMINDER_TYPES: readonly ReminderType[] = ['REMINDER_J1', 'REMINDER_H3', 'CONTROLLER_REMINDER'];

export interface ScheduleRemindersOptions {
    /** Horloge simulée (tests, fumée) ; jamais dans le passé. */
    now?: Date;
    /** Restreint la planification à ces événements (tests, fumée). */
    onlyEventIds?: string[];
}

export interface ScheduleRemindersReport {
    /** Lignes de boîte d'envoi créées par type de rappel. */
    created: Record<ReminderType, number>;
    /** Événements dont une fenêtre de rappel était ouverte. */
    events: number;
}

interface ScheduleReply {
    ok?: boolean;
    code?: string;
    message?: string;
    created?: Partial<Record<ReminderType, unknown>>;
    events?: unknown;
}

function failure(detail: string): Error {
    return new Error(`[rappels] notification_reminders_schedule : ${detail}`);
}

function count(v: unknown, what: string): number {
    const n = typeof v === 'number' ? v : Number.NaN;
    if (!Number.isInteger(n) || n < 0) throw failure(`réponse illisible (${what} : ${JSON.stringify(v)})`);
    return n;
}

export async function scheduleReminders(opts: ScheduleRemindersOptions = {}): Promise<ScheduleRemindersReport> {
    const p: Record<string, unknown> = {};
    if (opts.now) p.now = opts.now.toISOString();
    if (opts.onlyEventIds) p.only_event_ids = opts.onlyEventIds;

    // Rejeu sans risque (40P01, 40001) : la planification est idempotente par clé.
    const { data, error } = await rpcWithRetry<ScheduleReply>('notification_reminders_schedule', { p });
    if (error) throw failure(`${error.code} ${error.message}`);
    if (!data || data.ok !== true) throw failure(`${data?.code ?? 'réponse vide'} ${data?.message ?? ''}`.trim());

    const created = {} as Record<ReminderType, number>;
    for (const type of REMINDER_TYPES) created[type] = count(data.created?.[type], `created.${type}`);
    return { created, events: count(data.events, 'events') };
}
