/**
 * Fin d'un événement, miroir exact de la fonction SQL public.event_end_at (lot 9 bis, R16, B47 :
 * supabase/migrations/20261109000008_lot9bis_cycle.sql) : date et heure de fin saisies ; date de fin sans heure :
 * cette date à 23:59 ; aucune date de fin : début (date et heure) + 6 h. Fuseau Africa/Dakar = UTC+0 toute l'année.
 * Sert aux lectures publiques (catalogue, fiche, Mes billets) ; les décisions (cron, vente, scan) restent en base.
 */
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
