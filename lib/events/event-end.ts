/**
 * Fin d'un événement, miroir exact de la fonction SQL public.event_end_at (lot 9 bis, R16, B47 :
 * supabase/migrations/20261109000008_lot9bis_cycle.sql) : date et heure de fin saisies ; date de fin sans heure :
 * cette date à 23:59 ; aucune date de fin : début (date et heure) + 6 h. Fuseau Africa/Dakar = UTC+0 toute l'année.
 * Sert aux lectures publiques (catalogue, fiche, Mes billets) ; les décisions (cron, vente, scan) restent en base.
 * Finition 2a (2, E-01) : retainedEnd donne la même fin, prête à afficher (formulaire, fiche admin, onglet Infos du
 * pilotage) ; l'équipe et « Mes soirées » lisent event_end_at en base (migration 20261116000002).
 */
import { formatDateTime, formatTime } from '../format';

const DEFAULT_DURATION_MS = 6 * 3600_000;

function clock(time: string): string {
    return time.length === 5 ? `${time}:00` : time.slice(0, 8);
}

export function eventEndAt(row: {
    start_date: string;
    start_time: string | null;
    end_date?: string | null;
    end_time?: string | null;
}): Date {
    if (row.end_date) {
        return new Date(`${row.end_date}T${clock(row.end_time || '23:59:00')}Z`);
    }
    const start = new Date(`${row.start_date}T${clock(row.start_time || '00:00:00')}Z`);
    return new Date(start.getTime() + DEFAULT_DURATION_MS);
}

export interface RetainedEnd {
    /** Instant de fin, même calcul que public.event_end_at. */
    at: Date;
    /** Heure de fin à Dakar, « HH:MM ». */
    time: string;
    /** Jour et heure à Dakar : « mar. 17 nov. 2026 à 04:00 ». */
    text: string;
    /** Vrai quand aucune heure de fin n'est saisie : la fin vient de la règle. */
    computed: boolean;
    /** Explication de la fin calculée, ou null quand la fin est saisie. */
    note: string | null;
}

/**
 * Finition 2a (2, E-01) — fin retenue d'un événement, prête à afficher. null si la date ou l'heure de début manque ou
 * est illisible (formulaire en cours de saisie).
 */
export function retainedEnd(row: {
    start_date: string | null | undefined;
    start_time: string | null | undefined;
    end_date?: string | null;
    end_time?: string | null;
}): RetainedEnd | null {
    if (!row.start_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.start_date)) return null;
    if (row.end_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.end_date)) return null;
    const at = eventEndAt({ start_date: row.start_date, start_time: row.start_time ?? null, end_date: row.end_date ?? null, end_time: row.end_time ?? null });
    if (Number.isNaN(at.getTime())) return null;
    const computed = !row.end_date || !row.end_time;
    return {
        at,
        time: formatTime(at),
        text: formatDateTime(at),
        computed,
        note: !row.end_date
            ? 'Aucune fin saisie : 6 heures après le début.'
            : !row.end_time
                ? 'Aucune heure de fin saisie : fin du jour indiqué, à 23:59.'
                : null,
    };
}
