/**
 * Lot 6 (contrat P3 et Y, tâche 6.12) — horloge simulée de la fumée prolongée.
 *
 * La planification des rappels (scheduleReminders, contrat I3) et l'envoyeur (dispatchNotifications,
 * contrat E4) tournent avec une heure FUTURE donnée par la fumée (veille 10:01, début moins 3 h) : les
 * routes de cron n'acceptent jamais d'heure venue d'une requête. Les adaptateurs sont les VRAIS
 * (EV_INTEGRATIONS absent), pointés par `.env.e2e` sur les faux services locaux : le SMS du rappel
 * arrive donc au faux MTarget (GET /__test/sms).
 *
 * Deux modes, le premier qui fonctionne, toujours annoncé (jamais silencieux) :
 *  1. « processus » : import des modules du dépôt dans le processus Playwright (alias @/ de tsconfig) ;
 *  2. « script » (repli prévu par la section Y du contrat) : si l'import échoue, scripts/e2e/clock-run.ts
 *     lancé par `node --import tsx` fait le même appel et rend son rapport en JSON.
 * Une horloge dans le passé est refusée par la base (INVALID_NOW) et lève.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { e2eConfig } from './env';

export interface ClockScheduleReport {
    created: Record<string, number>;
    events: number;
}

export interface ClockDispatchReport {
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

export interface SimulatedClock {
    mode: 'processus' | 'script';
    /** Raison du repli (mode « script »), sinon null. */
    fallbackReason: string | null;
    schedule(now: Date, eventIds: string[]): Promise<ClockScheduleReport>;
    dispatch(now: Date, eventIds: string[]): Promise<ClockDispatchReport>;
    /** Texte SMS attendu, rendu par le catalogue unique (lib/notifications/catalog.ts), lien vers NEXT_PUBLIC_APP_URL. */
    renderSms(type: string, data: Record<string, unknown>): Promise<string>;
}

type ScheduleFn = (o: { now?: Date; onlyEventIds?: string[] }) => Promise<ClockScheduleReport>;
type DispatchFn = (o: { now?: Date; onlyEventIds?: string[] }) => Promise<ClockDispatchReport>;

/** Même contexte de rendu que l'envoyeur (dispatcher.ts, renderContext) : URL publique sans « / » final. */
export function renderAppUrl(): string {
    const url = process.env.NEXT_PUBLIC_APP_URL;
    if (!url) throw new Error('[e2e][horloge] NEXT_PUBLIC_APP_URL absente : texte SMS attendu impossible à rendre');
    return url.replace(/\/+$/, '');
}

async function inProcess(): Promise<SimulatedClock> {
    const reminders = await import('@/lib/notifications/reminders');
    const dispatcher = await import('@/lib/notifications/dispatcher');
    const catalog = await import('@/lib/notifications/catalog');
    const schedule = reminders.scheduleReminders as unknown as ScheduleFn;
    const dispatch = dispatcher.dispatchNotifications as unknown as DispatchFn;
    if (typeof schedule !== 'function' || typeof dispatch !== 'function' || typeof catalog.renderNotification !== 'function') {
        throw new Error('scheduleReminders, dispatchNotifications ou renderNotification non exporté');
    }
    return {
        mode: 'processus',
        fallbackReason: null,
        schedule: (now, eventIds) => schedule({ now, onlyEventIds: eventIds }),
        dispatch: (now, eventIds) => dispatch({ now, onlyEventIds: eventIds }),
        renderSms: async (type, data) => {
            const rendered = catalog.renderNotification(type, 'SMS', data, { appUrl: renderAppUrl() });
            if (rendered.channel !== 'SMS') throw new Error(`[e2e][horloge] rendu ${type} : canal ${rendered.channel} au lieu de SMS`);
            return rendered.text;
        },
    };
}

const CLOCK_SCRIPT = path.join('scripts', 'e2e', 'clock-run.ts');

function runScript<T>(command: 'schedule' | 'dispatch' | 'render-sms', rest: string[]): T {
    const args = ['--import', 'tsx', CLOCK_SCRIPT, command, ...rest];
    const r = spawnSync(process.execPath, args, { cwd: process.cwd(), env: process.env, encoding: 'utf8', timeout: 120_000 });
    if (r.error) throw new Error(`[e2e][horloge] ${CLOCK_SCRIPT} ${command} : ${r.error.message}`);
    const out = (r.stdout ?? '').trim().split(/\r?\n/).filter(Boolean);
    const last = out[out.length - 1] ?? '';
    if (r.status !== 0) {
        throw new Error(`[e2e][horloge] ${CLOCK_SCRIPT} ${command} : code ${r.status}\n${(r.stderr ?? '').slice(-1500)}\n${out.slice(-5).join('\n')}`);
    }
    try {
        return JSON.parse(last) as T;
    } catch (err) {
        throw new Error(`[e2e][horloge] ${CLOCK_SCRIPT} ${command} : rapport illisible (${err instanceof Error ? err.message : String(err)}) : ${last.slice(0, 300)}`);
    }
}

function clockArgs(now: Date, eventIds: string[]): string[] {
    return ['--now', now.toISOString(), ...eventIds.flatMap((id) => ['--event', id])];
}

/** Horloge simulée : import dans le processus, sinon script (repli annoncé dans le journal). */
export async function simulatedClock(): Promise<SimulatedClock> {
    e2eConfig(); // .env.e2e chargé et URL locales vérifiées avant tout import du dépôt
    try {
        return await inProcess();
    } catch (err) {
        const reason = err instanceof Error ? err.message.split('\n')[0] : String(err);
        console.warn(`[e2e][horloge] import des modules du dépôt impossible dans Playwright (${reason}) : repli sur ${CLOCK_SCRIPT} (contrat, section Y)`);
        return {
            mode: 'script',
            fallbackReason: reason,
            schedule: async (now, eventIds) => runScript<ClockScheduleReport>('schedule', clockArgs(now, eventIds)),
            dispatch: async (now, eventIds) => runScript<ClockDispatchReport>('dispatch', clockArgs(now, eventIds)),
            renderSms: async (type, data) => runScript<{ text: string }>('render-sms', ['--type', type, '--data', JSON.stringify(data)]).text,
        };
    }
}
