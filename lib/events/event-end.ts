/**
 * Lot 5 (contrat D7) — fin d'un événement, miroir exact de la fonction SQL public.event_end_at
 * (supabase/migrations/20261102000003_lot5_cycle.sql) : end_date + end_time ; fin sans heure : end_date
 * à 23:59 ; sans fin : start_date à 23:59. Fuseau Africa/Dakar = UTC+0 toute l'année.
 * Sert aux lectures publiques (catalogue, fiche) ; les décisions (cron, vente, scan) restent en base.
 */
export function eventEndAt(row: { start_date: string; end_date?: string | null; end_time?: string | null }): Date {
    const day = row.end_date || row.start_date;
    const time = row.end_date && row.end_time ? row.end_time : '23:59:00';
    const hhmmss = time.length === 5 ? `${time}:00` : time.slice(0, 8);
    return new Date(`${day}T${hhmmss}Z`);
}
