'use client';

import { useServerData, type ServerData } from '@/components/partner/useServerData';
import type { TablesReport } from './types';

/**
 * Lot 11c-c — lecture des tables d'un événement (GET …/tables/report), partagée par la page et l'onglet chargé à la
 * demande : la réponse sert à décider si l'onglet « Tables » est proposé, puis est passée à l'écran (pas de double
 * lecture). `signal` : relecture silencieuse (temps réel du pilotage, enregistrement).
 */
export function useTablesReport(eventId: string | null, signal = 0, admin = false): ServerData<TablesReport> {
    const url = eventId ? (admin ? `/api/admin/events/${eventId}/tables` : `/api/partner/events/${eventId}/tables/report`) : null;
    return useServerData<TablesReport>(url, signal);
}
